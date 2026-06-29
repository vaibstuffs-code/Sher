/**
 * priceAction.service.ts
 *
 * Candlestick pattern recognition, swing-point/market-structure detection,
 * support/resistance clustering, and breakout (incl. false-breakout)
 * detection. All pattern functions look only at the most recent 1-3 candles
 * relative to their own position in the series (no lookahead).
 */

export interface Candle {
  time: number; // unix seconds or index
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type CandlePattern =
  | "doji" | "hammer" | "shooting_star" | "bullish_engulfing" | "bearish_engulfing"
  | "morning_star" | "evening_star" | "bullish_harami" | "bearish_harami"
  | "three_white_soldiers" | "three_black_crows" | "none";

function bodySize(c: Candle): number {
  return Math.abs(c.close - c.open);
}
function range(c: Candle): number {
  return c.high - c.low || 1e-10;
}
function upperShadow(c: Candle): number {
  return c.high - Math.max(c.open, c.close);
}
function lowerShadow(c: Candle): number {
  return Math.min(c.open, c.close) - c.low;
}
function isBullish(c: Candle): boolean {
  return c.close > c.open;
}
function isBearish(c: Candle): boolean {
  return c.close < c.open;
}

/**
 * Detects the candlestick pattern ending at index `i`. Returns the
 * highest-priority pattern found, since multi-candle patterns are checked
 * before single-candle ones to avoid a strong reversal pattern being masked
 * by a coincidental doji classification on the last candle alone.
 */
export function detectCandlePattern(candles: Candle[], i: number): CandlePattern {
  if (i < 2) return "none";
  const c0 = candles[i], c1 = candles[i - 1], c2 = candles[i - 2];

  // Three white soldiers / three black crows (3-candle continuation)
  if (
    isBullish(c2) && isBullish(c1) && isBullish(c0) &&
    c1.close > c2.close && c0.close > c1.close &&
    bodySize(c2) > range(c2) * 0.5 && bodySize(c1) > range(c1) * 0.5 && bodySize(c0) > range(c0) * 0.5
  ) return "three_white_soldiers";
  if (
    isBearish(c2) && isBearish(c1) && isBearish(c0) &&
    c1.close < c2.close && c0.close < c1.close &&
    bodySize(c2) > range(c2) * 0.5 && bodySize(c1) > range(c1) * 0.5 && bodySize(c0) > range(c0) * 0.5
  ) return "three_black_crows";

  // Morning star / evening star (3-candle reversal)
  const smallMiddle = bodySize(c1) < range(c1) * 0.35;
  if (isBearish(c2) && smallMiddle && isBullish(c0) && c0.close > (c2.open + c2.close) / 2) return "morning_star";
  if (isBullish(c2) && smallMiddle && isBearish(c0) && c0.close < (c2.open + c2.close) / 2) return "evening_star";

  // Engulfing (2-candle reversal)
  if (isBearish(c1) && isBullish(c0) && c0.close > c1.open && c0.open < c1.close) return "bullish_engulfing";
  if (isBullish(c1) && isBearish(c0) && c0.close < c1.open && c0.open > c1.close) return "bearish_engulfing";

  // Harami (2-candle, inside bar reversal)
  if (isBearish(c1) && isBullish(c0) && c0.open > c1.close && c0.close < c1.open) return "bullish_harami";
  if (isBullish(c1) && isBearish(c0) && c0.open < c1.close && c0.close > c1.open) return "bearish_harami";

  // Single-candle patterns
  const body = bodySize(c0), rng = range(c0);
  if (body < rng * 0.1) return "doji";
  if (lowerShadow(c0) > body * 2 && upperShadow(c0) < body * 0.5) return "hammer";
  if (upperShadow(c0) > body * 2 && lowerShadow(c0) < body * 0.5) return "shooting_star";

  return "none";
}

export interface SwingPoint {
  index: number;
  type: "H" | "L";
  price: number;
}

/** Fractal-style swing high/low detection using a symmetric lookback window. */
export function findSwingPoints(highs: number[], lows: number[], lookback = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = lookback; i < highs.length - lookback; i++) {
    const hSlice = highs.slice(i - lookback, i + lookback + 1);
    const lSlice = lows.slice(i - lookback, i + lookback + 1);
    if (highs[i] === Math.max(...hSlice)) swings.push({ index: i, type: "H", price: highs[i] });
    if (lows[i] === Math.min(...lSlice)) swings.push({ index: i, type: "L", price: lows[i] });
  }
  return swings.sort((a, b) => a.index - b.index);
}

export type StructureLabel =
  | "Higher High + Higher Low" | "Lower High + Lower Low"
  | "Expanding range" | "Contracting range" | "Mixed structure" | "Insufficient data";

export interface MarketStructure {
  label: StructureLabel;
  trend: "bullish" | "bearish" | "neutral";
}

export function classifyStructure(swings: SwingPoint[]): MarketStructure {
  if (swings.length < 4) return { label: "Insufficient data", trend: "neutral" };
  const highs = swings.filter((s) => s.type === "H").slice(-2);
  const lows = swings.filter((s) => s.type === "L").slice(-2);
  if (highs.length < 2 || lows.length < 2) return { label: "Insufficient data", trend: "neutral" };
  const hh = highs[1].price > highs[0].price;
  const hl = lows[1].price > lows[0].price;
  const lh = highs[1].price < highs[0].price;
  const ll = lows[1].price < lows[0].price;
  if (hh && hl) return { label: "Higher High + Higher Low", trend: "bullish" };
  if (lh && ll) return { label: "Lower High + Lower Low", trend: "bearish" };
  if (hh && ll) return { label: "Expanding range", trend: "neutral" };
  if (lh && hl) return { label: "Contracting range", trend: "neutral" };
  return { label: "Mixed structure", trend: "neutral" };
}

export interface SRCluster {
  price: number;
  touches: number;
}

export interface SupportResistance {
  support: SRCluster | null;
  resistance: SRCluster | null;
  clusters: SRCluster[];
}

/** Clusters swing points within `tolerance` (fractional) of each other into S/R levels. */
export function detectSupportResistance(
  highs: number[], lows: number[], closes: number[], tolerance = 0.0008
): SupportResistance {
  const swings = findSwingPoints(highs, lows, 2);
  const clusters: SRCluster[] = [];
  for (const s of swings) {
    const existing = clusters.find((c) => Math.abs(c.price - s.price) / s.price < tolerance);
    if (existing) {
      existing.price = (existing.price + s.price) / 2;
      existing.touches += 1;
    } else {
      clusters.push({ price: s.price, touches: 1 });
    }
  }
  const lastClose = closes[closes.length - 1];
  const resistance = clusters.filter((c) => c.price > lastClose).sort((a, b) => a.price - b.price)[0] ?? null;
  const support = clusters.filter((c) => c.price < lastClose).sort((a, b) => b.price - a.price)[0] ?? null;
  return { support, resistance, clusters };
}

export type BreakoutType = "breakout-up" | "breakout-down" | "fake-breakout-up" | "fake-breakout-down" | "none";

export interface BreakoutResult {
  type: BreakoutType;
  level: number | null;
}

export function detectBreakout(
  closes: number[], highs: number[], lows: number[], sr: SupportResistance
): BreakoutResult {
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  if (!sr.resistance && !sr.support) return { type: "none", level: null };
  if (sr.resistance && prev < sr.resistance.price && last > sr.resistance.price) {
    const wickBack = highs[highs.length - 1] - last > (last - prev) * 1.5;
    return { type: wickBack ? "fake-breakout-up" : "breakout-up", level: sr.resistance.price };
  }
  if (sr.support && prev > sr.support.price && last < sr.support.price) {
    const wickBack = last - lows[lows.length - 1] > (prev - last) * 1.5;
    return { type: wickBack ? "fake-breakout-down" : "breakout-down", level: sr.support.price };
  }
  return { type: "none", level: null };
}

/**
 * Fair Value Gap: a 3-candle imprgression where candle 1's range doesn't
 * overlap candle 3's range, leaving a price "gap" the market often
 * revisits. Returns gaps found in the most recent `lookback` candles.
 */
export interface FairValueGap {
  index: number; // index of the middle candle
  direction: "bullish" | "bearish";
  top: number;
  bottom: number;
}

export function detectFairValueGaps(candles: Candle[], lookback = 30): FairValueGap[] {
  const gaps: FairValueGap[] = [];
  const start = Math.max(2, candles.length - lookback);
  for (let i = start; i < candles.length; i++) {
    const c1 = candles[i - 2], c3 = candles[i];
    if (c1.high < c3.low) {
      gaps.push({ index: i - 1, direction: "bullish", top: c3.low, bottom: c1.high });
    } else if (c1.low > c3.high) {
      gaps.push({ index: i - 1, direction: "bearish", top: c1.low, bottom: c3.high });
    }
  }
  return gaps;
}

/** Simple liquidity-zone heuristic: clusters of swing points with high touch counts near current price. */
export interface LiquidityZone {
  price: number;
  strength: number; // touch count, proxy for resting-order density
}

export function detectLiquidityZones(highs: number[], lows: number[], closes: number[]): LiquidityZone[] {
  const sr = detectSupportResistance(highs, lows, closes, 0.0012);
  return sr.clusters
    .filter((c) => c.touches >= 2)
    .map((c) => ({ price: c.price, strength: c.touches }))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5);
}

export function gapDetection(candles: Candle[]): { index: number; size: number }[] {
  const gaps: { index: number; size: number }[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].close;
    const open = candles[i].open;
    const gapSize = Math.abs(open - prevClose) / prevClose;
    if (gapSize > 0.0005) gaps.push({ index: i, size: gapSize });
  }
  return gaps;
}
