/**
 * market.types.ts — shared types for pairs, timeframes, and candle data
 * used across services, routes, and the WebSocket layer.
 */

export const SUPPORTED_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF", "NZD/USD", "USD/CAD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/CAD", "AUD/CHF", "AUD/JPY",
  "EUR/CAD", "EUR/CHF", "GBP/CAD", "GBP/CHF", "NZD/JPY",
] as const;
export type SupportedPair = typeof SUPPORTED_PAIRS[number];

// Sher only analyzes real, licensed market data. There is deliberately no
// "OTC" market mode: OTC quotes on retail trading platforms are generated
// internally by the broker and are not published by any licensed data
// provider, so no external analysis tool — including this one — can
// observe or validate them. See README.md for the full rationale.
//
// NOTE on "30s": no licensed forex data provider publishes real sub-1-minute
// candles for spot FX. This timeframe is present in the type for UI
// completeness but the backend's MarketDataService rejects it with a 422
// rather than silently substituting 1-minute data under a misleading label.
// The frontend should grey it out / show this explanation rather than call it.
export const SUPPORTED_TIMEFRAMES = [
  "30s", "1m", "2m", "3m", "5m", "10m", "15m", "30m", "1h",
] as const;
export type SupportedTimeframe = typeof SUPPORTED_TIMEFRAMES[number];

export const TIMEFRAME_SECONDS: Record<SupportedTimeframe, number> = {
  "30s": 30, "1m": 60, "2m": 120, "3m": 180, "5m": 300,
  "10m": 600, "15m": 900, "30m": 1800, "1h": 3600,
};

export interface CandleDto {
  time: number; // unix seconds, candle open time
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketStatusDto {
  isOpen: boolean;
  istTime: string; // HH:mm:ss
  session: "asian" | "london" | "new_york" | "overlap" | "off_session";
  sessionLabel: string;
  volatilityExpectation: "Low" | "Moderate" | "High" | "Very High";
}
