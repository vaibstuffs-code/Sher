/**
 * signal.service.ts
 *
 * Combines indicator outputs and price-action analysis into a single
 * weighted "confidence" score and a BUY/SELL/WAIT decision.
 *
 * IMPORTANT — what "confidence" means here:
 * This is a measure of how strongly the enabled indicators AGREE with each
 * other on direction, weighted by each indicator's configured importance.
 * It is NOT a statistically validated probability of the next candle's
 * outcome, and it should never be presented to an end user as one. No
 * combination of technical indicators can observe the future; they only
 * describe current/past price behavior. See SmartFilters below for the
 * cases where this engine should suppress a signal entirely rather than
 * imply confidence it doesn't have.
 */

import {
  adx, atr, bollingerBands, cci, ema, macd, momentum, moneyFlowIndex, obv,
  parabolicSar, rsi, stochasticRsi, superTrend, vwap, williamsR, awesomeOscillator,
  rateOfChange, ichimoku,
} from "./indicators.service";
import {
  Candle, classifyStructure, detectBreakout, detectSupportResistance,
  findSwingPoints, detectCandlePattern, detectFairValueGaps, detectLiquidityZones,
} from "./priceAction.service";

export type SignalType = "BUY" | "SELL" | "WAIT";

export interface IndicatorWeight {
  key: string;
  weight: number; // relative weight, normalized at aggregation time
  enabled: boolean;
}

export const DEFAULT_WEIGHTS: IndicatorWeight[] = [
  { key: "ema_stack", weight: 1.2, enabled: true },
  { key: "adx_di", weight: 1.4, enabled: true },
  { key: "rsi", weight: 1.0, enabled: true },
  { key: "macd", weight: 1.1, enabled: true },
  { key: "stoch_rsi", weight: 0.8, enabled: true },
  { key: "supertrend", weight: 1.2, enabled: true },
  { key: "psar", weight: 0.9, enabled: true },
  { key: "vwap", weight: 0.9, enabled: true },
  { key: "cci", weight: 0.7, enabled: true },
  { key: "williams_r", weight: 0.6, enabled: true },
  { key: "mfi", weight: 0.7, enabled: true },
  { key: "obv_trend", weight: 0.8, enabled: true },
  { key: "awesome_osc", weight: 0.6, enabled: true },
  { key: "momentum", weight: 0.6, enabled: true },
  { key: "roc", weight: 0.5, enabled: true },
  { key: "volume", weight: 1.3, enabled: true },
  { key: "candle_pattern", weight: 1.0, enabled: true },
  { key: "market_structure", weight: 1.1, enabled: true },
  { key: "ichimoku", weight: 0.8, enabled: false },
  { key: "bollinger", weight: 0.7, enabled: false },
];

export interface IndicatorVote {
  key: string;
  vote: -1 | 0 | 1; // -1 bearish, 0 neutral/no-opinion, 1 bullish
  weight: number;
  reason: string;
}

export interface SignalResult {
  signal: SignalType;
  /** Centered 0-100 score: 50 = neutral, >50 = bullish lean, <50 = bearish lean. */
  confidence: number;
  /** 0-100, direction-agnostic strength of agreement — this is what should be shown as "confidence %" in the UI. */
  convictionPct: number;
  trendDirection: "bullish" | "bearish" | "neutral";
  marketType: "Trending" | "Transitioning" | "Ranging";
  votes: IndicatorVote[];
  suppressedReason: string | null; // set when a smart filter blocked a signal
  riskLevel: "Low" | "Moderate" | "Elevated";
  volatility: "Low" | "Normal" | "High" | "Extreme";
  metrics: {
    adx: number; plusDI: number; minusDI: number;
    rsi: number | null; atr: number | null; volRatio: number;
  };
}

export interface SmartFilterConfig {
  minConfidence: number; // below this, force WAIT regardless of direction
  minAdxForTrend: number; // below this ADX, market is considered sideways
  minVolRatio: number; // below this recent/avg volume ratio, treat as low-volume
}

export const DEFAULT_SMART_FILTERS: SmartFilterConfig = {
  minConfidence: 62,
  minAdxForTrend: 18,
  minVolRatio: 0.55,
};

function last<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i];
  return null;
}

function trendVote(value: number | null, bullThreshold: number, bearThreshold: number): -1 | 0 | 1 {
  if (value === null) return 0;
  if (value > bullThreshold) return 1;
  if (value < bearThreshold) return -1;
  return 0;
}

/**
 * Computes the full signal for a single pair/timeframe given its candle
 * history. Candles must be oldest-first and have at least 60 bars for
 * stable indicator warmup (ADX/Ichimoku in particular need runway).
 */
export function computeSignal(
  candles: Candle[],
  weights: IndicatorWeight[] = DEFAULT_WEIGHTS,
  filters: SmartFilterConfig = DEFAULT_SMART_FILTERS
): SignalResult | null {
  if (candles.length < 60) return null;

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);
  const i = closes.length - 1;

  const weightOf = (key: string): number => {
    const w = weights.find((x) => x.key === key);
    return w && w.enabled ? w.weight : 0;
  };

  const votes: IndicatorVote[] = [];

  // --- Trend strength & direction (ADX/DI) ---
  const adxRes = adx(highs, lows, closes, 14);
  const adxVal = (last(adxRes.adx) as number) ?? 0;
  const plusDI = (last(adxRes.plusDI) as number) ?? 0;
  const minusDI = (last(adxRes.minusDI) as number) ?? 0;
  const adxWeight = weightOf("adx_di");
  if (adxWeight > 0) {
    votes.push({
      key: "adx_di",
      vote: plusDI > minusDI ? 1 : -1,
      weight: adxWeight,
      reason: `ADX ${adxVal.toFixed(1)} — +DI ${plusDI.toFixed(1)} vs -DI ${minusDI.toFixed(1)}`,
    });
  }

  // --- EMA stack ---
  const ema9 = last(ema(closes, 9));
  const ema20 = last(ema(closes, 20));
  const ema50 = last(ema(closes, 50));
  const emaWeight = weightOf("ema_stack");
  if (emaWeight > 0 && ema9 !== null && ema20 !== null && ema50 !== null) {
    const bullish = ema9 > ema20 && ema20 > ema50;
    const bearish = ema9 < ema20 && ema20 < ema50;
    votes.push({
      key: "ema_stack", weight: emaWeight, vote: bullish ? 1 : bearish ? -1 : 0,
      reason: bullish ? "EMA 9>20>50 bullish stack" : bearish ? "EMA 9<20<50 bearish stack" : "EMA stack mixed",
    });
  }

  // --- RSI ---
  const rsiVal = last(rsi(closes, 14));
  const rsiWeight = weightOf("rsi");
  if (rsiWeight > 0) {
    votes.push({
      key: "rsi", weight: rsiWeight, vote: trendVote(rsiVal, 55, 45),
      reason: `RSI ${rsiVal?.toFixed(1) ?? "—"}`,
    });
  }

  // --- MACD ---
  const macdRes = macd(closes);
  const histLast = last(macdRes.histogram);
  const histPrev = macdRes.histogram[i - 1];
  const macdWeight = weightOf("macd");
  if (macdWeight > 0 && histLast !== null && histPrev !== null) {
    const expanding = Math.abs(histLast) > Math.abs(histPrev);
    votes.push({
      key: "macd", weight: macdWeight,
      vote: histLast > 0 && expanding ? 1 : histLast < 0 && expanding ? -1 : 0,
      reason: `MACD histogram ${histLast > 0 ? "positive" : "negative"}, ${expanding ? "expanding" : "contracting"}`,
    });
  }

  // --- Stochastic RSI ---
  const stochVal = last(stochasticRsi(closes, 14, 3));
  const stochWeight = weightOf("stoch_rsi");
  if (stochWeight > 0) {
    votes.push({ key: "stoch_rsi", weight: stochWeight, vote: trendVote(stochVal, 60, 40), reason: `StochRSI ${stochVal?.toFixed(1) ?? "—"}` });
  }

  // --- SuperTrend ---
  const stRes = superTrend(highs, lows, closes, 10, 3);
  const stWeight = weightOf("supertrend");
  if (stWeight > 0) {
    const dir = stRes.direction[stRes.direction.length - 1];
    votes.push({ key: "supertrend", weight: stWeight, vote: dir === 1 ? 1 : -1, reason: `SuperTrend ${dir === 1 ? "bullish (support below price)" : "bearish (resistance above price)"}` });
  }

  // --- Parabolic SAR ---
  const sarVal = last(parabolicSar(highs, lows));
  const psarWeight = weightOf("psar");
  if (psarWeight > 0 && sarVal !== null) {
    votes.push({ key: "psar", weight: psarWeight, vote: sarVal < closes[i] ? 1 : -1, reason: `PSAR ${sarVal < closes[i] ? "below price (bullish)" : "above price (bearish)"}` });
  }

  // --- VWAP ---
  const vwapVal = last(vwap(highs, lows, closes, volumes));
  const vwapWeight = weightOf("vwap");
  if (vwapWeight > 0 && vwapVal !== null) {
    votes.push({ key: "vwap", weight: vwapWeight, vote: closes[i] > vwapVal ? 1 : -1, reason: `Price ${closes[i] > vwapVal ? "above" : "below"} VWAP` });
  }

  // --- CCI ---
  const cciVal = last(cci(highs, lows, closes, 20));
  const cciWeight = weightOf("cci");
  if (cciWeight > 0) {
    votes.push({ key: "cci", weight: cciWeight, vote: trendVote(cciVal, 50, -50), reason: `CCI ${cciVal?.toFixed(1) ?? "—"}` });
  }

  // --- Williams %R ---
  const wrVal = last(williamsR(highs, lows, closes, 14));
  const wrWeight = weightOf("williams_r");
  if (wrWeight > 0 && wrVal !== null) {
    votes.push({ key: "williams_r", weight: wrWeight, vote: wrVal > -40 ? 1 : wrVal < -60 ? -1 : 0, reason: `Williams %R ${wrVal.toFixed(1)}` });
  }

  // --- Money Flow Index ---
  const mfiVal = last(moneyFlowIndex(highs, lows, closes, volumes, 14));
  const mfiWeight = weightOf("mfi");
  if (mfiWeight > 0) {
    votes.push({ key: "mfi", weight: mfiWeight, vote: trendVote(mfiVal, 55, 45), reason: `MFI ${mfiVal?.toFixed(1) ?? "—"}` });
  }

  // --- OBV trend (slope over last 10 bars) ---
  const obvSeries = obv(closes, volumes);
  const obvWeight = weightOf("obv_trend");
  if (obvWeight > 0 && obvSeries.length > 10) {
    const obvSlope = obvSeries[obvSeries.length - 1] - obvSeries[obvSeries.length - 10];
    votes.push({ key: "obv_trend", weight: obvWeight, vote: obvSlope > 0 ? 1 : obvSlope < 0 ? -1 : 0, reason: `OBV ${obvSlope > 0 ? "rising" : "falling"} over last 10 bars` });
  }

  // --- Awesome Oscillator ---
  const aoVal = last(awesomeOscillator(highs, lows));
  const aoWeight = weightOf("awesome_osc");
  if (aoWeight > 0 && aoVal !== null) {
    votes.push({ key: "awesome_osc", weight: aoWeight, vote: aoVal > 0 ? 1 : -1, reason: `Awesome Oscillator ${aoVal > 0 ? "positive" : "negative"}` });
  }

  // --- Momentum & ROC ---
  const momVal = last(momentum(closes, 10));
  const momWeight = weightOf("momentum");
  if (momWeight > 0 && momVal !== null) {
    votes.push({ key: "momentum", weight: momWeight, vote: momVal > 0 ? 1 : -1, reason: `Momentum(10) ${momVal > 0 ? "positive" : "negative"}` });
  }
  const rocVal = last(rateOfChange(closes, 10));
  const rocWeight = weightOf("roc");
  if (rocWeight > 0 && rocVal !== null) {
    votes.push({ key: "roc", weight: rocWeight, vote: rocVal > 0 ? 1 : -1, reason: `ROC(10) ${rocVal.toFixed(3)}%` });
  }

  // --- Volume confirmation ---
  const recentVol = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const avgVol = volumes.slice(-30).reduce((s, v) => s + v, 0) / 30;
  const volRatio = avgVol ? recentVol / avgVol : 1;
  const volWeight = weightOf("volume");
  const dominantDirSoFar = votes.reduce((s, v) => s + v.vote * v.weight, 0) >= 0 ? 1 : -1;
  if (volWeight > 0) {
    const rising = volRatio > 1.1;
    votes.push({
      key: "volume", weight: rising ? volWeight : volWeight * 0.3,
      vote: rising ? (dominantDirSoFar as 1 | -1) : 0,
      reason: `Volume ${volRatio.toFixed(2)}x avg ${rising ? "(confirming)" : volRatio < 0.9 ? "(weak conviction)" : "(neutral)"}`,
    });
  }

  // --- Candlestick pattern ---
  const pattern = detectCandlePattern(candles, i);
  const patternWeight = weightOf("candle_pattern");
  const bullishPatterns = new Set(["hammer", "bullish_engulfing", "morning_star", "bullish_harami", "three_white_soldiers"]);
  const bearishPatterns = new Set(["shooting_star", "bearish_engulfing", "evening_star", "bearish_harami", "three_black_crows"]);
  if (patternWeight > 0 && pattern !== "none") {
    votes.push({
      key: "candle_pattern", weight: patternWeight,
      vote: bullishPatterns.has(pattern) ? 1 : bearishPatterns.has(pattern) ? -1 : 0,
      reason: `Candlestick pattern: ${pattern.replace(/_/g, " ")}`,
    });
  }

  // --- Market structure ---
  const swings = findSwingPoints(highs, lows, 3);
  const structure = classifyStructure(swings);
  const structureWeight = weightOf("market_structure");
  if (structureWeight > 0 && structure.trend !== "neutral") {
    votes.push({
      key: "market_structure", weight: structureWeight,
      vote: structure.trend === "bullish" ? 1 : -1,
      reason: `Market structure: ${structure.label}`,
    });
  }

  // --- Ichimoku (optional, off by default per DEFAULT_WEIGHTS) ---
  const ichiWeight = weightOf("ichimoku");
  if (ichiWeight > 0) {
    const ichi = ichimoku(highs, lows);
    const conv = last(ichi.conversion), base = last(ichi.base);
    if (conv !== null && base !== null) {
      votes.push({ key: "ichimoku", weight: ichiWeight, vote: conv > base ? 1 : -1, reason: `Ichimoku Tenkan ${conv > base ? "above" : "below"} Kijun` });
    }
  }

  // --- Bollinger (optional) ---
  const bbWeight = weightOf("bollinger");
  if (bbWeight > 0) {
    const bb = bollingerBands(closes, 20, 2);
    const mid = last(bb.mid);
    if (mid !== null) {
      votes.push({ key: "bollinger", weight: bbWeight, vote: closes[i] > mid ? 1 : -1, reason: `Price ${closes[i] > mid ? "above" : "below"} Bollinger midline` });
    }
  }

  // --- Aggregate ---
  const totalWeight = votes.reduce((s, v) => s + v.weight, 0);
  const weightedScore = totalWeight ? votes.reduce((s, v) => s + v.vote * v.weight, 0) / totalWeight : 0;
  const confidence = Math.round(Math.min(97, Math.max(3, 50 + weightedScore * 47)));
  const convictionPct = Math.round(Math.abs(weightedScore) * 100);

  const isTrending = adxVal > filters.minAdxForTrend;
  const marketType: SignalResult["marketType"] = adxVal > 25 ? "Trending" : adxVal > filters.minAdxForTrend ? "Transitioning" : "Ranging";
  const trendDirection: SignalResult["trendDirection"] = plusDI > minusDI ? "bullish" : plusDI < minusDI ? "bearish" : "neutral";

  const atrVal = last(atr(highs, lows, closes, 14));
  const atrSeries = atr(highs, lows, closes, 14).slice(-30).filter((v): v is number => v !== null);
  const atrAvg = atrSeries.length ? atrSeries.reduce((s, v) => s + v, 0) / atrSeries.length : null;
  const volRatioToAvg = atrAvg && atrVal ? atrVal / atrAvg : 1;
  const volatility: SignalResult["volatility"] = volRatioToAvg > 1.6 ? "Extreme" : volRatioToAvg > 1.25 ? "High" : volRatioToAvg < 0.75 ? "Low" : "Normal";
  const riskLevel: SignalResult["riskLevel"] = volatility === "Extreme" || volatility === "High" ? "Elevated" : isTrending ? "Moderate" : "Low";

  // --- Smart filters: decide whether to suppress the signal entirely ---
  // `confidence` is centered at 50 (neutral); a strong SELL can legitimately
  // read as a LOW confidence number (e.g. 10) while representing high
  // conviction in the bearish direction. `convictionPct` is the
  // direction-agnostic strength (0 = no agreement, 100 = unanimous) and is
  // what the minConfidence threshold should actually gate on — we convert
  // the configured centered-scale threshold (e.g. 62) into the equivalent
  // conviction-scale minimum (e.g. 24) once, here.
  const minConvictionPct = Math.max(0, (filters.minConfidence - 50) * 2);
  let suppressedReason: string | null = null;
  if (!isTrending && marketType === "Ranging") suppressedReason = "Market is sideways (ADX below trend threshold)";
  else if (volRatio < filters.minVolRatio) suppressedReason = "Volume too low for reliable confirmation";
  else if (convictionPct < minConvictionPct) suppressedReason = "Indicator agreement below confidence threshold";

  const signal: SignalType = suppressedReason ? "WAIT" : weightedScore > 0 ? "BUY" : weightedScore < 0 ? "SELL" : "WAIT";

  return {
    signal, confidence, convictionPct, trendDirection, marketType, votes, suppressedReason,
    riskLevel, volatility,
    metrics: { adx: adxVal, plusDI, minusDI, rsi: rsiVal, atr: atrVal, volRatio },
  };
}

/**
 * Multi-timeframe confirmation: runs computeSignal across several candle
 * sets (one per timeframe) and reports whether a majority agree on
 * direction. Does NOT artificially inflate any single timeframe's
 * confidence — it reports agreement as a separate, transparent number.
 */
export interface MultiTimeframeResult {
  timeframe: string;
  result: SignalResult | null;
}

export interface MultiTimeframeSummary {
  perTimeframe: MultiTimeframeResult[];
  agreementPct: number; // % of timeframes whose signal matches the majority direction
  majorityDirection: SignalType;
}

export function summarizeMultiTimeframe(results: MultiTimeframeResult[]): MultiTimeframeSummary {
  const valid = results.filter((r) => r.result !== null && r.result.signal !== "WAIT");
  const buyCount = valid.filter((r) => r.result!.signal === "BUY").length;
  const sellCount = valid.filter((r) => r.result!.signal === "SELL").length;
  const majorityDirection: SignalType = buyCount > sellCount ? "BUY" : sellCount > buyCount ? "SELL" : "WAIT";
  const agreementCount = majorityDirection === "BUY" ? buyCount : majorityDirection === "SELL" ? sellCount : 0;
  const agreementPct = valid.length ? Math.round((agreementCount / valid.length) * 100) : 0;
  return { perTimeframe: results, agreementPct, majorityDirection };
}

// Re-exported for callers that need raw S/R/breakout/liquidity context alongside the signal.
export function getPriceActionContext(candles: Candle[]) {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const sr = detectSupportResistance(highs, lows, closes);
  const breakout = detectBreakout(closes, highs, lows, sr);
  const fvg = detectFairValueGaps(candles);
  const liquidityZones = detectLiquidityZones(highs, lows, closes);
  return { sr, breakout, fvg, liquidityZones };
}
