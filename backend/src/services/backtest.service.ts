/**
 * backtest.service.ts
 *
 * Measures the signal engine's actual historical hit rate — not a vibe
 * check. The critical correctness requirement here is NO LOOKAHEAD: at
 * each simulated point in time, computeSignal() only ever sees candles up
 * to and including that point, exactly like the live engine. The "outcome"
 * for that signal is then checked against candles that come strictly
 * AFTER the evaluation window, never before or during.
 *
 * If this constraint is violated even slightly, the reported hit rate
 * becomes meaningless (inflated), so every code path here is built to make
 * that mistake structurally hard to make by accident.
 */

import { Candle } from "./priceAction.service";
import { computeSignal, DEFAULT_WEIGHTS, DEFAULT_SMART_FILTERS, SignalResult, IndicatorWeight, SmartFilterConfig } from "./signal.service";

export interface BacktestTrade {
  index: number; // index into the candle array at which the signal was generated
  signal: "BUY" | "SELL"; // WAIT signals are not trades and are excluded
  convictionPct: number;
  entryPrice: number;
  exitPrice: number;
  outcome: "WIN" | "LOSS" | "BREAKEVEN";
  pctMove: number; // signed price change from entry to exit
}

export interface BacktestResult {
  totalCandles: number;
  totalSignalsGenerated: number; // includes WAIT
  totalTrades: number; // BUY/SELL only
  wins: number;
  losses: number;
  breakevens: number;
  winRatePct: number;
  averageWinPct: number;
  averageLossPct: number;
  byConvictionBucket: Record<string, { trades: number; winRatePct: number }>;
  trades: BacktestTrade[];
  warnings: string[];
}

export interface BacktestConfig {
  holdCandles: number;
  warmupCandles: number;
  weights?: IndicatorWeight[];
  filters?: SmartFilterConfig;
}

export function runBacktest(candles: Candle[], config: BacktestConfig): BacktestResult {
  const warnings: string[] = [];
  const weights = config.weights ?? DEFAULT_WEIGHTS;
  const filters = config.filters ?? DEFAULT_SMART_FILTERS;
  const minRequired = Math.max(config.warmupCandles, 60);

  if (candles.length < minRequired + config.holdCandles + 1) {
    warnings.push(
      `Not enough candles for a meaningful backtest: need at least ${minRequired + config.holdCandles + 1}, got ${candles.length}.`
    );
  }

  const trades: BacktestTrade[] = [];
  let totalSignalsGenerated = 0;

  const lastEligibleIndex = candles.length - 1 - config.holdCandles;
  for (let i = minRequired - 1; i <= lastEligibleIndex; i++) {
    const visibleCandles = candles.slice(0, i + 1);
    const result: SignalResult | null = computeSignal(visibleCandles, weights, filters);
    if (!result) continue;
    totalSignalsGenerated++;
    if (result.signal === "WAIT") continue;

    const entryPrice = candles[i].close;
    const exitIndex = i + config.holdCandles;
    const exitPrice = candles[exitIndex].close;
    const pctMove = ((exitPrice - entryPrice) / entryPrice) * 100;

    let outcome: BacktestTrade["outcome"];
    if (pctMove === 0) outcome = "BREAKEVEN";
    else if (result.signal === "BUY") outcome = pctMove > 0 ? "WIN" : "LOSS";
    else outcome = pctMove < 0 ? "WIN" : "LOSS";

    trades.push({
      index: i,
      signal: result.signal,
      convictionPct: result.convictionPct,
      entryPrice,
      exitPrice,
      outcome,
      pctMove,
    });
  }

  const wins = trades.filter((t) => t.outcome === "WIN");
  const losses = trades.filter((t) => t.outcome === "LOSS");
  const breakevens = trades.filter((t) => t.outcome === "BREAKEVEN");
  const decided = wins.length + losses.length;
  const winRatePct = decided ? Math.round((wins.length / decided) * 1000) / 10 : 0;

  const averageWinPct = wins.length
    ? Math.round((wins.reduce((s, t) => s + Math.abs(t.pctMove), 0) / wins.length) * 1000) / 1000
    : 0;
  const averageLossPct = losses.length
    ? Math.round((losses.reduce((s, t) => s + Math.abs(t.pctMove), 0) / losses.length) * 1000) / 1000
    : 0;

  const buckets: [string, (t: BacktestTrade) => boolean][] = [
    ["50-60%", (t) => t.convictionPct >= 50 && t.convictionPct < 60],
    ["60-70%", (t) => t.convictionPct >= 60 && t.convictionPct < 70],
    ["70-80%", (t) => t.convictionPct >= 70 && t.convictionPct < 80],
    ["80-90%", (t) => t.convictionPct >= 80 && t.convictionPct < 90],
    ["90-100%", (t) => t.convictionPct >= 90],
  ];
  const byConvictionBucket: BacktestResult["byConvictionBucket"] = {};
  for (const [label, pred] of buckets) {
    const bucketTrades = trades.filter(pred);
    const bucketDecided = bucketTrades.filter((t) => t.outcome !== "BREAKEVEN");
    const bucketWins = bucketTrades.filter((t) => t.outcome === "WIN");
    byConvictionBucket[label] = {
      trades: bucketTrades.length,
      winRatePct: bucketDecided.length ? Math.round((bucketWins.length / bucketDecided.length) * 1000) / 10 : 0,
    };
  }

  if (trades.length > 0 && trades.length < 30) {
    warnings.push(`Only ${trades.length} trades were generated — treat this win rate as low-confidence until you run a longer history.`);
  }
  if (totalSignalsGenerated > 0 && trades.length / totalSignalsGenerated < 0.05) {
    warnings.push("Smart filters suppressed the vast majority of candles to WAIT — that's expected behavior, not a bug, but it means few trades exist to evaluate.");
  }

  return {
    totalCandles: candles.length,
    totalSignalsGenerated,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    winRatePct,
    averageWinPct,
    averageLossPct,
    byConvictionBucket,
    trades,
    warnings,
  };
}
