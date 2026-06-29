/**
 * watchlist.routes.ts — add/remove/favorite/list watchlist pairs.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { WatchlistRepository } from "../repositories/watchlist.repository";
import { SUPPORTED_PAIRS } from "../types/market.types";
import { logger } from "../utils/logger.util";

const pairSchema = z.enum(SUPPORTED_PAIRS as unknown as [string, ...string[]]);
const marketModeSchema = z.enum(["LIVE", "OTC"]).default("LIVE");

class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
  }
}

function requireUserId(req: Request): string {
  const userId = (req as Request & { userId?: string }).userId;
  if (!userId) throw new AuthRequiredError();
  return userId;
}

export function createWatchlistRoutes(repo: WatchlistRepository): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req);
      const items = await repo.listByUser(userId);
      res.json(items);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post("/", async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req);
      const pair = pairSchema.parse(req.body.pair);
      const marketMode = marketModeSchema.parse(req.body.marketMode);
      const item = await repo.add(userId, pair, marketMode);
      res.status(201).json(item);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.delete("/:pair", async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req);
      const pair = pairSchema.parse(decodeURIComponent(req.params.pair));
      const marketMode = marketModeSchema.parse(req.query.marketMode);
      const removed = await repo.remove(userId, pair, marketMode);
      if (!removed) {
        res.status(404).json({ error: "Watchlist item not found", statusCode: 404 });
        return;
      }
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  });

  router.patch("/:pair/favorite", async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req);
      const pair = pairSchema.parse(decodeURIComponent(req.params.pair));
      const marketMode = marketModeSchema.parse(req.body.marketMode);
      const updated = await repo.toggleFavorite(userId, pair, marketMode);
      if (!updated) {
        res.status(404).json({ error: "Watchlist item not found", statusCode: 404 });
        return;
      }
      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  });

  return router;
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
  logger.error(`Unhandled watchlist route error: ${err instanceof Error ? err.message : String(err)}`);
  res.status(500).json({ error: "Internal server error", statusCode: 500 });
}
