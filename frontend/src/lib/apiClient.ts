import axios from "axios";
import { Candle, JournalEntry, MarketStatus, SignalResult, SupportedPair, SupportedTimeframe, WatchlistItem } from "@/types/market.types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
});

export interface ApiErrorBody {
  error: string;
  statusCode: number;
}

export async function fetchCandles(pair: SupportedPair, timeframe: SupportedTimeframe, count = 220): Promise<Candle[]> {
  const { data } = await apiClient.get<Candle[]>("/candles", { params: { pair, timeframe, count } });
  return data;
}

export async function fetchSignal(pair: SupportedPair, timeframe: SupportedTimeframe): Promise<SignalResult> {
  const { data } = await apiClient.get<SignalResult>("/signal", { params: { pair, timeframe } });
  return data;
}

export async function fetchMarketStatus(): Promise<MarketStatus> {
  const { data } = await apiClient.get<MarketStatus>("/market-status");
  return data;
}

export async function fetchMultiTimeframe(pair: SupportedPair, timeframes: SupportedTimeframe[]) {
  const { data } = await apiClient.get("/signal/multi-timeframe", {
    params: { pair, timeframes: timeframes.join(",") },
  });
  return data;
}

export interface ScannerResult {
  pair: string;
  result: SignalResult | null;
  error: string | null;
}

export async function fetchScanner(timeframe: SupportedTimeframe) {
  const { data } = await apiClient.get<ScannerResult[]>("/scanner", { params: { timeframe } });
  return data;
}

export interface BacktestTrade {
  index: number;
  signal: "BUY" | "SELL";
  convictionPct: number;
  entryPrice: number;
  exitPrice: number;
  outcome: "WIN" | "LOSS" | "BREAKEVEN";
  pctMove: number;
}

export interface BacktestResult {
  totalCandles: number;
  totalSignalsGenerated: number;
  totalTrades: number;
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

export async function fetchBacktest(pair: SupportedPair, timeframe: SupportedTimeframe, holdCandles = 5) {
  const { data } = await apiClient.get<BacktestResult>("/backtest", { params: { pair, timeframe, holdCandles } });
  return data;
}

// ---- Journal ----

export async function fetchJournalEntries(params?: { pair?: string; from?: string; to?: string }) {
  const { data } = await apiClient.get<JournalEntry[]>("/journal", { params });
  return data;
}

export interface CreateJournalEntryPayload {
  date: string;
  pair: string;
  marketMode: "LIVE" | "OTC";
  direction: SignalResult["signal"];
  entryPrice?: number;
  exitPrice?: number;
  stake?: number;
  result?: "WIN" | "LOSS" | "BREAKEVEN" | "PENDING";
  profit?: number;
  confidence?: number;
  notes?: string;
  emotion?: string;
  mistakes?: string;
}

export async function createJournalEntry(payload: CreateJournalEntryPayload) {
  const { data } = await apiClient.post<JournalEntry>("/journal", payload);
  return data;
}

export async function deleteJournalEntry(id: string) {
  await apiClient.delete(`/journal/${id}`);
}

export interface JournalStats {
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  pending: number;
  winRatePct: number;
  totalProfit: number;
  averageWin: number;
  averageLoss: number;
  riskRewardRatio: number | null;
  profitFactor: number | null;
  longestWinStreak: number;
  longestLossStreak: number;
  maxDrawdown: number;
  averageConfidence: number | null;
  byPair: Record<string, { trades: number; winRatePct: number; profit: number }>;
  byHourOfDay: Record<number, { trades: number; winRatePct: number }>;
  bestPair: string | null;
  worstPair: string | null;
  bestHour: number | null;
  worstHour: number | null;
}

export async function fetchJournalStats() {
  const { data } = await apiClient.get<JournalStats>("/journal/stats");
  return data;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  skippedRows: { row: number; reason: string }[];
}

export async function importJournalCsv(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ImportResult>("/journal/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ---- Watchlist ----

export async function fetchWatchlist() {
  const { data } = await apiClient.get<WatchlistItem[]>("/watchlist");
  return data;
}

export async function addToWatchlist(pair: SupportedPair, marketMode: "LIVE" | "OTC" = "LIVE") {
  const { data } = await apiClient.post<WatchlistItem>("/watchlist", { pair, marketMode });
  return data;
}

export async function removeFromWatchlist(pair: string, marketMode: "LIVE" | "OTC" = "LIVE") {
  await apiClient.delete(`/watchlist/${encodeURIComponent(pair)}`, { params: { marketMode } });
}

export async function toggleWatchlistFavorite(pair: string, marketMode: "LIVE" | "OTC" = "LIVE") {
  const { data } = await apiClient.patch<WatchlistItem>(`/watchlist/${encodeURIComponent(pair)}/favorite`, { marketMode });
  return data;
}
