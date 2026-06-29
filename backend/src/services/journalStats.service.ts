/**
 * journalStats.service.ts
 *
 * Pure statistics computation over a list of journal entries. Kept
 * framework-free (no Prisma types) so it's trivially unit-testable —
 * callers pass in plain objects shaped like JournalEntryStatsInput.
 */

export interface JournalEntryStatsInput {
  date: string; // ISO date
  pair: string;
  marketMode: "LIVE" | "OTC";
  result: "WIN" | "LOSS" | "BREAKEVEN" | "PENDING";
  profit: number | null;
  confidence: number | null;
}

export interface JournalStats {
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  pending: number;
  winRatePct: number; // wins / (wins+losses), excludes breakeven & pending
  totalProfit: number;
  averageWin: number;
  averageLoss: number; // positive number representing average loss magnitude
  riskRewardRatio: number | null; // averageWin / averageLoss
  profitFactor: number | null; // grossProfit / grossLoss
  longestWinStreak: number;
  longestLossStreak: number;
  maxDrawdown: number; // largest peak-to-trough decline in cumulative profit
  averageConfidence: number | null;
  byPair: Record<string, { trades: number; winRatePct: number; profit: number }>;
  byHourOfDay: Record<number, { trades: number; winRatePct: number }>;
  bestPair: string | null;
  worstPair: string | null;
  bestHour: number | null;
  worstHour: number | null;
}

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

export function computeJournalStats(entries: JournalEntryStatsInput[]): JournalStats {
  const settled = entries.filter((e) => e.result !== "PENDING");
  const wins = settled.filter((e) => e.result === "WIN");
  const losses = settled.filter((e) => e.result === "LOSS");
  const breakevens = settled.filter((e) => e.result === "BREAKEVEN");
  const pending = entries.filter((e) => e.result === "PENDING");

  const decidedCount = wins.length + losses.length;
  const winRatePct = decidedCount ? Math.round(safeDiv(wins.length, decidedCount) * 1000) / 10 : 0;

  const totalProfit = settled.reduce((s, e) => s + (e.profit ?? 0), 0);
  const grossProfit = wins.reduce((s, e) => s + Math.max(0, e.profit ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, e) => s + Math.min(0, e.profit ?? 0), 0));

  const averageWin = wins.length ? grossProfit / wins.length : 0;
  const averageLoss = losses.length ? grossLoss / losses.length : 0;
  const riskRewardRatio = averageLoss > 0 ? Math.round((averageWin / averageLoss) * 100) / 100 : null;
  const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : null;

  // Streaks & drawdown require chronological order.
  const chrono = [...settled].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let longestWinStreak = 0, longestLossStreak = 0;
  let currentWinStreak = 0, currentLossStreak = 0;
  let runningProfit = 0, peak = 0, maxDrawdown = 0;

  for (const e of chrono) {
    if (e.result === "WIN") {
      currentWinStreak += 1;
      currentLossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
    } else if (e.result === "LOSS") {
      currentLossStreak += 1;
      currentWinStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
    } else {
      currentWinStreak = 0;
      currentLossStreak = 0;
    }

    runningProfit += e.profit ?? 0;
    peak = Math.max(peak, runningProfit);
    const drawdown = peak - runningProfit;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  const confidences = entries.map((e) => e.confidence).filter((c): c is number => c !== null);
  const averageConfidence = confidences.length
    ? Math.round((confidences.reduce((s, c) => s + c, 0) / confidences.length) * 10) / 10
    : null;

  // Per-pair breakdown
  const byPair: JournalStats["byPair"] = {};
  for (const pair of new Set(settled.map((e) => e.pair))) {
    const pairEntries = settled.filter((e) => e.pair === pair);
    const pairWins = pairEntries.filter((e) => e.result === "WIN").length;
    const pairLosses = pairEntries.filter((e) => e.result === "LOSS").length;
    const pairDecided = pairWins + pairLosses;
    byPair[pair] = {
      trades: pairEntries.length,
      winRatePct: pairDecided ? Math.round(safeDiv(pairWins, pairDecided) * 1000) / 10 : 0,
      profit: Math.round(pairEntries.reduce((s, e) => s + (e.profit ?? 0), 0) * 100) / 100,
    };
  }

  // Per-hour-of-day breakdown (hour extracted from the entry's date, assumed
  // already in the timezone the caller wants to analyze — typically IST).
  const byHourOfDay: JournalStats["byHourOfDay"] = {};
  for (let h = 0; h < 24; h++) {
    const hourEntries = settled.filter((e) => new Date(e.date).getHours() === h);
    if (hourEntries.length === 0) continue;
    const hourWins = hourEntries.filter((e) => e.result === "WIN").length;
    const hourLosses = hourEntries.filter((e) => e.result === "LOSS").length;
    const hourDecided = hourWins + hourLosses;
    byHourOfDay[h] = {
      trades: hourEntries.length,
      winRatePct: hourDecided ? Math.round(safeDiv(hourWins, hourDecided) * 1000) / 10 : 0,
    };
  }

  const pairEntriesList = Object.entries(byPair).filter(([, v]) => v.trades >= 3); // require minimum sample
  const bestPair = pairEntriesList.length
    ? pairEntriesList.reduce((best, cur) => (cur[1].winRatePct > best[1].winRatePct ? cur : best))[0]
    : null;
  const worstPair = pairEntriesList.length
    ? pairEntriesList.reduce((worst, cur) => (cur[1].winRatePct < worst[1].winRatePct ? cur : worst))[0]
    : null;

  const hourEntriesList = Object.entries(byHourOfDay).filter(([, v]) => v.trades >= 3);
  const bestHour = hourEntriesList.length
    ? Number(hourEntriesList.reduce((best, cur) => (cur[1].winRatePct > best[1].winRatePct ? cur : best))[0])
    : null;
  const worstHour = hourEntriesList.length
    ? Number(hourEntriesList.reduce((worst, cur) => (cur[1].winRatePct < worst[1].winRatePct ? cur : worst))[0])
    : null;

  return {
    totalTrades: entries.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    pending: pending.length,
    winRatePct,
    totalProfit: Math.round(totalProfit * 100) / 100,
    averageWin: Math.round(averageWin * 100) / 100,
    averageLoss: Math.round(averageLoss * 100) / 100,
    riskRewardRatio,
    profitFactor,
    longestWinStreak,
    longestLossStreak,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    averageConfidence,
    byPair,
    byHourOfDay,
    bestPair,
    worstPair,
    bestHour,
    worstHour,
  };
}
