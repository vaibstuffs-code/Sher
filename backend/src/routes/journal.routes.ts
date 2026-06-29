/**
 * journal.routes.ts — trade journal CRUD, CSV import, and stats.
 * Auth middleware (attachUser) is expected to populate req.userId before
 * these handlers run; see middleware/auth.middleware.ts.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import Papa from "papaparse";
import { z } from "zod";
import { JournalRepository } from "../repositories/journal.repository";
import { computeJournalStats, JournalEntryStatsInput } from "../services/journalStats.service";
import { tradeLogger, logger } from "../utils/logger.util";

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB cap

const createEntrySchema = z.object({
  date: z.string().datetime().or(z.string()),
  pair: z.string().min(1),
  marketMode: z.enum(["LIVE", "OTC"]).default("LIVE"),
  direction: z.enum(["BUY", "SELL", "WAIT"]),
  entryPrice: z.number().optional(),
  exitPrice: z.number().optional(),
  stake: z.number().optional(),
  result: z.enum(["WIN", "LOSS", "BREAKEVEN", "PENDING"]).default("PENDING"),
  profit: z.number().optional(),
  confidence: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  emotion: z.string().optional(),
  mistakes: z.string().optional(),
});

// Expected CSV columns. Extra columns are ignored; missing required columns
// cause that row to be skipped and reported back, not silently dropped.
const CSV_REQUIRED_COLUMNS = ["date", "pair", "direction", "result"] as const;

export function createJournalRoutes(repo: JournalRepository): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req);
      const { from, to, pair, limit } = req.query;
      const entries = await repo.listByUser(userId, {
        from: from ? new Date(String(from)) : undefined,
        to: to ? new Date(String(to)) : undefined,
        pair: pair ? String(pair) : undefined,
        limit: limit ? parseInt(String(limit), 10) : undefined,
      });
      res.json(entries);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post("/", async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req);
      const body = createEntrySchema.parse(req.body);
      const entry = await repo.create({ ...body, userId, date: new Date(body.date) });
      tradeLogger.info("journal_entry_created", { userId, pair: body.pair, result: body.result });
      res.status(201).json(entry);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.patch("/:id", async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req);
      const patch = createEntrySchema.partial().parse(req.body);
      const updated = await repo.update(req.params.id, userId, {
        ...patch,
        date: patch.date ? new Date(patch.date) : undefined,
      });
      if (!updated) {
        res.status(404).json({ error: "Journal entry not found", statusCode: 404 });
        return;
      }
      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.delete("/:id", async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req);
      const deleted = await repo.delete(req.params.id, userId);
      if (!deleted) {
        res.status(404).json({ error: "Journal entry not found", statusCode: 404 });
        return;
      }
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  });

  router.get("/stats", async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req);
      const entries = await repo.listByUser(userId, { limit: 5000 });
      const statsInput: JournalEntryStatsInput[] = entries.map((e) => ({
        date: e.date.toISOString(),
        pair: e.pair,
        marketMode: e.marketMode,
        result: e.result,
        profit: e.profit,
        confidence: e.confidence,
      }));
      res.json(computeJournalStats(statsInput));
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post("/import", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req);
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded", statusCode: 400 });
        return;
      }

      const csvText = req.file.buffer.toString("utf-8");
      const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });

      if (parsed.errors.length > 0) {
        res.status(400).json({
          error: `CSV parse error: ${parsed.errors[0].message}`,
          statusCode: 400,
        });
        return;
      }

      const headers = parsed.meta.fields ?? [];
      const missingColumns = CSV_REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
      if (missingColumns.length > 0) {
        res.status(400).json({
          error: `CSV is missing required columns: ${missingColumns.join(", ")}`,
          statusCode: 400,
        });
        return;
      }

      const validRows: ReturnType<typeof createEntrySchema.parse>[] = [];
      const skippedRows: { row: number; reason: string }[] = [];

      parsed.data.forEach((row, idx) => {
        try {
          const candidate = {
            date: row.date,
            pair: row.pair,
            marketMode: (row.marketMode?.toUpperCase() === "OTC" ? "OTC" : "LIVE") as "LIVE" | "OTC",
            direction: row.direction?.toUpperCase() as "BUY" | "SELL" | "WAIT",
            entryPrice: row.entryPrice ? parseFloat(row.entryPrice) : undefined,
            exitPrice: row.exitPrice ? parseFloat(row.exitPrice) : undefined,
            stake: row.stake ? parseFloat(row.stake) : undefined,
            result: row.result?.toUpperCase() as "WIN" | "LOSS" | "BREAKEVEN" | "PENDING",
            profit: row.profit ? parseFloat(row.profit) : undefined,
            confidence: row.confidence ? parseFloat(row.confidence) : undefined,
            notes: row.notes || undefined,
            emotion: row.emotion || undefined,
            mistakes: row.mistakes || undefined,
          };
          validRows.push(createEntrySchema.parse(candidate));
        } catch (err) {
          const reason = err instanceof z.ZodError ? err.issues.map((i) => i.message).join(", ") : "invalid row";
          skippedRows.push({ row: idx + 2, reason }); // +2: 1-indexed + header row
        }
      });

      const inserted = await repo.bulkCreate(
        validRows.map((row) => ({ ...row, userId, date: new Date(row.date) }))
      );

      tradeLogger.info("journal_csv_import", { userId, inserted, skipped: skippedRows.length });
      res.json({ inserted, skipped: skippedRows.length, skippedRows: skippedRows.slice(0, 50) });
    } catch (err) {
      handleError(err, res);
    }
  });

  return router;
}

function requireUserId(req: Request): string {
  const userId = (req as Request & { userId?: string }).userId;
  if (!userId) throw new AuthRequiredError();
  return userId;
}

class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
  }
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof AuthRequiredError) {
    res.status(401).json({ error: err.message, statusCode: 401 });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: `Invalid request: ${err.issues.map((i) => i.message).join(", ")}`, statusCode: 400 });
    return;
  }
  logger.error(`Unhandled journal route error: ${err instanceof Error ? err.message : String(err)}`);
  res.status(500).json({ error: "Internal server error", statusCode: 500 });
}
