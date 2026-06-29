/**
 * marketData.service.ts
 *
 * Fetches real, licensed forex candle data from Twelve Data
 * (https://twelvedata.com) and caches it in Redis to stay within the
 * provider's rate limits. This is the ONLY source of price data in Sher —
 * there is intentionally no OTC/synthetic data path. If a request comes in
 * for a pair or timeframe the provider doesn't support, this service
 * returns a clear error rather than fabricating candles.
 */

import axios from "axios";
import Redis from "ioredis";
import { CandleDto, SupportedPair, SupportedTimeframe } from "../types/market.types";
import { logger } from "../utils/logger.util";

const TWELVE_DATA_INTERVAL_MAP: Record<SupportedTimeframe, string> = {
  "30s": "1min", // unused for fetching — see UNSUPPORTED_TIMEFRAMES below
  "1m": "1min",
  "2m": "1min",  // aggregated client-side from 1min — see aggregateCandles()
  "3m": "1min",
  "5m": "5min",
  "10m": "1min", // aggregated
  "15m": "15min",
  "30m": "30min",
  "1h": "1h",
};

// Timeframes Twelve Data doesn't provide natively — these are built by
// aggregating the smallest available native interval. We say so explicitly
// rather than silently presenting aggregated bars as provider-native ones.
const AGGREGATED_TIMEFRAMES = new Set<SupportedTimeframe>(["2m", "3m", "10m"]);

// "30s" is NOT supported: no licensed forex data provider (including
// Twelve Data) publishes real sub-1-minute candles for spot FX, and
// substituting 1-minute bars under a "30 second" label would mean the UI
// shows a timeframe that isn't actually backed by real data at that
// resolution. We reject it explicitly rather than fake it.
const UNSUPPORTED_TIMEFRAMES = new Set<SupportedTimeframe>(["30s"]);

export class MarketDataError extends Error {
  constructor(message: string, public readonly statusCode: number = 502) {
    super(message);
    this.name = "MarketDataError";
  }
}

export class MarketDataService {
  private redis: Redis | null;
  private apiKey: string;
  private baseUrl: string;
  private cacheTtlSeconds: number;

  constructor(opts: { redisUrl?: string; apiKey: string; baseUrl: string; cacheTtlSeconds?: number }) {
    this.redis = opts.redisUrl ? new Redis(opts.redisUrl) : null;
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl;
    this.cacheTtlSeconds = opts.cacheTtlSeconds ?? 10;
    if (!this.redis) {
      logger.warn("MarketDataService started without Redis — falling back to in-process cache only. Set REDIS_URL for production.");
    }
  }

  private inMemoryCache = new Map<string, { data: CandleDto[]; expiresAt: number }>();

  private cacheKey(pair: SupportedPair, timeframe: SupportedTimeframe): string {
    return `candles:${pair}:${timeframe}`;
  }

  private async getCached(key: string): Promise<CandleDto[] | null> {
    if (this.redis) {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as CandleDto[]) : null;
    }
    const entry = this.inMemoryCache.get(key);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.data;
  }

  private async setCached(key: string, data: CandleDto[]): Promise<void> {
    if (this.redis) {
      await this.redis.set(key, JSON.stringify(data), "EX", this.cacheTtlSeconds);
    } else {
      this.inMemoryCache.set(key, { data, expiresAt: Date.now() + this.cacheTtlSeconds * 1000 });
    }
  }

  /**
   * Fetches candles for a pair/timeframe, serving from cache when fresh.
   * Throws MarketDataError on provider failure rather than returning stale
   * or fabricated data silently.
   */
  async getCandles(pair: SupportedPair, timeframe: SupportedTimeframe, count = 220): Promise<CandleDto[]> {
    if (UNSUPPORTED_TIMEFRAMES.has(timeframe)) {
      throw new MarketDataError(
        `The "${timeframe}" timeframe isn't backed by real sub-1-minute forex data on this provider — no licensed source publishes it. Use 1m or higher.`,
        422
      );
    }

    const key = this.cacheKey(pair, timeframe);
    const cached = await this.getCached(key);
    if (cached && cached.length >= count) return cached.slice(-count);

    const nativeInterval = AGGREGATED_TIMEFRAMES.has(timeframe) ? "1min" : TWELVE_DATA_INTERVAL_MAP[timeframe];
    const fetchCount = AGGREGATED_TIMEFRAMES.has(timeframe)
      ? count * this.aggregationFactor(timeframe)
      : count;

    let raw: CandleDto[];
    try {
      const resp = await axios.get(`${this.baseUrl}/time_series`, {
        params: {
          symbol: pair,
          interval: nativeInterval,
          outputsize: Math.min(fetchCount, 5000),
          apikey: this.apiKey,
          order: "ASC",
          // Twelve Data returns exchange-local timestamps by default; we
          // need UTC explicitly so our "+Z" parsing below is actually correct.
          timezone: "UTC",
        },
        timeout: 8000,
      });

      if (resp.data?.status === "error") {
        throw new MarketDataError(`Twelve Data error for ${pair}: ${resp.data.message ?? "unknown error"}`, 502);
      }

      const values = resp.data?.values as Array<{ datetime: string; open: string; high: string; low: string; close: string; volume?: string }> | undefined;
      if (!values || !Array.isArray(values)) {
        throw new MarketDataError(`Twelve Data returned no candle data for ${pair} (${nativeInterval})`, 502);
      }

      raw = values.map((v) => ({
        time: Math.floor(new Date(v.datetime.replace(" ", "T") + "Z").getTime() / 1000),
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        // Forex is OTC at the interbank level — no centralized volume exists.
        // Twelve Data returns 0/absent volume for FX; we surface that
        // honestly as 0 rather than inventing a number, and the signal
        // engine's volume-based votes degrade gracefully when this happens.
        volume: v.volume ? parseFloat(v.volume) : 0,
      }));
    } catch (err) {
      if (err instanceof MarketDataError) throw err;
      const msg = axios.isAxiosError(err) ? err.message : String(err);
      logger.error(`Market data fetch failed for ${pair} ${timeframe}: ${msg}`);
      throw new MarketDataError(`Failed to fetch market data for ${pair}: ${msg}`, 502);
    }

    const candles = AGGREGATED_TIMEFRAMES.has(timeframe)
      ? this.aggregateCandles(raw, this.aggregationFactor(timeframe))
      : raw;

    await this.setCached(key, candles);
    return candles.slice(-count);
  }

  /**
   * Fetches candles for many pairs on one timeframe, respecting a
   * concurrency limit and inter-batch delay so a full-pair scan doesn't
   * fire 18 simultaneous requests against a free-tier rate limit (Twelve
   * Data's free plan is typically 8 requests/minute). Cached pairs resolve
   * immediately and don't count against the throttle.
   */
  async getCandlesBatch(
    pairs: SupportedPair[],
    timeframe: SupportedTimeframe,
    count = 220,
    opts: { concurrency?: number; interBatchDelayMs?: number } = {}
  ): Promise<{ pair: SupportedPair; candles: CandleDto[] | null; error: string | null }[]> {
    const concurrency = opts.concurrency ?? 4;
    const delayMs = opts.interBatchDelayMs ?? 1500;
    const results: { pair: SupportedPair; candles: CandleDto[] | null; error: string | null }[] = [];

    for (let i = 0; i < pairs.length; i += concurrency) {
      const batch = pairs.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (pair) => {
          try {
            const candles = await this.getCandles(pair, timeframe, count);
            return { pair, candles, error: null as string | null };
          } catch (err) {
            const message = err instanceof MarketDataError ? err.message : "Failed to fetch";
            return { pair, candles: null, error: message };
          }
        })
      );
      results.push(...batchResults);
      // Skip the delay after the last batch — nothing left to protect.
      if (i + concurrency < pairs.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return results;
  }

  private aggregationFactor(timeframe: SupportedTimeframe): number {
    // How many 1-minute bars make up one bar of this timeframe.
    const map: Partial<Record<SupportedTimeframe, number>> = { "30s": 1, "2m": 2, "3m": 3, "10m": 10 };
    return map[timeframe] ?? 1;
  }

  /** Aggregates N consecutive source candles into one OHLCV bar each. */
  private aggregateCandles(source: CandleDto[], factor: number): CandleDto[] {
    if (factor <= 1) return source;
    const out: CandleDto[] = [];
    for (let i = 0; i + factor <= source.length; i += factor) {
      const chunk = source.slice(i, i + factor);
      out.push({
        time: chunk[0].time,
        open: chunk[0].open,
        high: Math.max(...chunk.map((c) => c.high)),
        low: Math.min(...chunk.map((c) => c.low)),
        close: chunk[chunk.length - 1].close,
        volume: chunk.reduce((s, c) => s + c.volume, 0),
      });
    }
    return out;
  }

  async close(): Promise<void> {
    if (this.redis) await this.redis.quit();
  }
}
