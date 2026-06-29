export const SUPPORTED_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF", "NZD/USD", "USD/CAD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/CAD", "AUD/CHF", "AUD/JPY",
  "EUR/CAD", "EUR/CHF", "GBP/CAD", "GBP/CHF", "NZD/JPY",
] as const;
export type SupportedPair = typeof SUPPORTED_PAIRS[number];

// "30s" is intentionally excluded from this list: no licensed forex data
// provider publishes real sub-1-minute FX candles, so it isn't offered as
// a selectable timeframe in the UI rather than silently substituting
// 1-minute data under a misleading label. See backend marketData.service.ts.
export const SUPPORTED_TIMEFRAMES = [
  "1m", "2m", "3m", "5m", "10m", "15m", "30m", "1h",
] as const;
export type SupportedTimeframe = typeof SUPPORTED_TIMEFRAMES[number];

export const TIMEFRAME_LABELS: Record<SupportedTimeframe, string> = {
  "1m": "1 Minute", "2m": "2 Minutes", "3m": "3 Minutes", "5m": "5 Minutes",
  "10m": "10 Minutes", "15m": "15 Minutes", "30m": "30 Minutes", "1h": "1 Hour",
};

export const TIMEFRAME_SECONDS: Record<SupportedTimeframe, number> = {
  "1m": 60, "2m": 120, "3m": 180, "5m": 300,
  "10m": 600, "15m": 900, "30m": 1800, "1h": 3600,
};

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SignalType = "BUY" | "SELL" | "WAIT";

export interface IndicatorVote {
  key: string;
  vote: -1 | 0 | 1;
  weight: number;
  reason: string;
}

export interface SignalResult {
  signal: SignalType;
  confidence: number;
  convictionPct: number;
  trendDirection: "bullish" | "bearish" | "neutral";
  marketType: "Trending" | "Transitioning" | "Ranging";
  votes: IndicatorVote[];
  suppressedReason: string | null;
  riskLevel: "Low" | "Moderate" | "Elevated";
  volatility: "Low" | "Normal" | "High" | "Extreme";
  metrics: {
    adx: number; plusDI: number; minusDI: number;
    rsi: number | null; atr: number | null; volRatio: number;
  };
}

export interface MarketStatus {
  isOpen: boolean;
  istTime: string;
  session: "asian" | "london" | "new_york" | "overlap" | "off_session";
  sessionLabel: string;
  volatilityExpectation: "Low" | "Moderate" | "High" | "Very High";
}

export interface JournalEntry {
  id: string;
  date: string;
  pair: string;
  direction: SignalType;
  entryPrice: number | null;
  exitPrice: number | null;
  stake: number | null;
  result: "WIN" | "LOSS" | "BREAKEVEN" | "PENDING";
  profit: number | null;
  confidence: number | null;
  notes: string | null;
  emotion: string | null;
  mistakes: string | null;
}

export interface WatchlistItem {
  id: string;
  pair: string;
  marketMode: "LIVE" | "OTC";
  isFavorite: boolean;
  addedAt: string;
}
