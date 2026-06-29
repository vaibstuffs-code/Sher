/**
 * market.routes.ts — candles, signal, and market-status endpoints.
 * All candle data flows through MarketDataService, which only talks to
 * Twelve Data. There is no code path here that can serve OTC/synthetic data.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { MarketDataService, MarketDataError } from "../services/marketData.service";
import { computeSignal, summarizeMultiTimeframe, DEFAULT_WEIGHTS, DEFAULT_SMART_FILTERS } from "../services/signal.service";
import { getMarketStatus } from "../utils/istTime.util";
import { SUPPORTED_PAIRS, SUPPORTED_TIMEFRAMES, SupportedPair, SupportedTimeframe } from "../types/market.types";
import { signalLogger, logger } from "../utils/logger.util";

const pairSchema = z.enum(SUPPORTED_PAIRS as unknown as [string, ...string[]]);
const timeframeSchema = z.enum(SUPPORTED_TIMEFRAMES as unknown as [string, ...string[]]);

const countSchema = z.coerce.number().int().positive().max(1000).optional();

export function createMarketRoutes(marketData: MarketDataService): Router {
  const router = Router();

  router.get("/candles", async (req: Request, res: Response) => {
    try {
      const pair = pairSchema.parse(req.query.pair) as SupportedPair;
      const timeframe = timeframeSchema.parse(req.query.timeframe) as SupportedTimeframe;
      const count = countSchema.parse(req.query.count) ?? 220;
      const candles = await marketData.getCandles(pair, timeframe, count);
      res.json(candles);
    } catch (err) {
      handleRouteError(err, res);
    }
  });

  router.get("/signal", async (req: Request, res: Response) => {
    try {
      const pair = pairSchema.parse(req.query.pair) as SupportedPair;
      const timeframe = timeframeSchema.parse(req.query.timeframe) as SupportedTimeframe;
      const candles = await marketData.getCandles(pair, timeframe, 220);
      const result = computeSignal(candles, DEFAULT_WEIGHTS, DEFAULT_SMART_FILTERS);
      if (!result) {
        res.status(422).json({ error: "Insufficient candle history to compute a signal", statusCode: 422 });
        return;
      }
      signalLogger.info("signal_computed", { pair, timeframe, signal: result.signal, confidence: result.confidence });
      res.json(result);
    } catch (err) {
      handleRouteError(err, res);
    }
  });

  router.get("/signal/multi-timeframe", async (req: Request, res: Response) => {
    try {
      const pair = pairSchema.parse(req.query.pair) as SupportedPair;
      const timeframesRaw = String(req.query.timeframes || "").split(",").filter(Boolean);
      const timeframes = timeframesRaw.map((tf) => timeframeSchema.parse(tf) as SupportedTimeframe);
      if (timeframes.length === 0) {
        res.status(400).json({ error: "At least one timeframe is required", statusCode: 400 });
        return;
      }

      const results = await Promise.all(
        timeframes.map(async (timeframe) => {
          const candles = await marketData.getCandles(pair, timeframe, 220);
          return { timeframe, result: computeSignal(candles, DEFAULT_WEIGHTS, DEFAULT_SMART_FILTERS) };
        })
      );
      const summary = summarizeMultiTimeframe(results);
      res.json(summary);
    } catch (err) {
      handleRouteError(err, res);
    }
  });

  router.get("/market-status", (_req: Request, res: Response) => {
    res.json(getMarketStatus());
  });

  router.get("/scanner", async (req: Request, res: Response) => {
    try {
      const timeframe = timeframeSchema.parse(req.query.timeframe) as SupportedTimeframe;
      const batch = await marketData.getCandlesBatch(SUPPORTED_PAIRS as unknown as SupportedPair[], timeframe, 220);
      const results = batch.map(({ pair, candles, error }) => {
        if (!candles) return { pair, result: null, error };
        return { pair, result: computeSignal(candles, DEFAULT_WEIGHTS, DEFAULT_SMART_FILTERS), error: null as string | null };
      });
      res.json(results);
    } catch (err) {
      handleRouteError(err, res);
    }
  });

  return router;
}

function handleRouteError(err: unknown, res: Response): void {
  if (err instanceof MarketDataError) {
    res.status(err.statusCode).json({ error: err.message, statusCode: err.statusCode });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: `Invalid request parameters: ${err.issues.map((i) => i.message).join(", ")}`, statusCode: 400 });
    return;
  }
  logger.error(`Unhandled route error: ${err instanceof Error ? err.message : String(err)}`);
  res.status(500).json({ error: "Internal server error", statusCode: 500 });
}
