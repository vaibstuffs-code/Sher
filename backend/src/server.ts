/**
 * server.ts — application entry point.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { MarketDataService } from "./services/marketData.service";
import { JournalRepository } from "./repositories/journal.repository";
import { WatchlistRepository } from "./repositories/watchlist.repository";
import { createMarketRoutes } from "./routes/market.routes";
import { createJournalRoutes } from "./routes/journal.routes";
import { createWatchlistRoutes } from "./routes/watchlist.routes";
import { logger } from "./utils/logger.util";

dotenv.config();

const PORT = parseInt(process.env.PORT || "4000", 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const app = express();
const prisma = new PrismaClient();

const marketData = new MarketDataService({
  redisUrl: process.env.REDIS_URL,
  apiKey: process.env.TWELVE_DATA_API_KEY || "",
  baseUrl: process.env.TWELVE_DATA_BASE_URL || "https://api.twelvedata.com",
  cacheTtlSeconds: 10,
});
const journalRepo = new JournalRepository(prisma);
const watchlistRepo = new WatchlistRepository(prisma);

app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(compression());
app.use(express.json({ limit: "2mb" }));

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use("/api", apiLimiter);

// NOTE: a real deployment must populate req.userId via a JWT auth
// middleware before journal routes run. Wire that in here, e.g.:
//   app.use("/api/journal", authMiddleware, createJournalRoutes(journalRepo));
app.use("/api", createMarketRoutes(marketData));
app.use("/api/journal", createJournalRoutes(journalRepo));
app.use("/api/watchlist", createWatchlistRoutes(watchlistRepo));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: "Internal server error", statusCode: 500 });
});

const server = app.listen(PORT, () => {
  logger.info(`Sher backend listening on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close();
  await marketData.close();
  await prisma.$disconnect();
  process.exit(0);
});
