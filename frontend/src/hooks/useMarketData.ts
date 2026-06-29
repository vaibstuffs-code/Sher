"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCandles, fetchSignal, fetchMarketStatus, fetchJournalEntries, fetchJournalStats, fetchScanner } from "@/lib/apiClient";
import { SupportedPair, SupportedTimeframe } from "@/types/market.types";

export function useCandles(pair: SupportedPair, timeframe: SupportedTimeframe) {
  return useQuery({
    queryKey: ["candles", pair, timeframe],
    queryFn: () => fetchCandles(pair, timeframe),
    refetchInterval: 15000,
  });
}

export function useSignal(pair: SupportedPair, timeframe: SupportedTimeframe) {
  return useQuery({
    queryKey: ["signal", pair, timeframe],
    queryFn: () => fetchSignal(pair, timeframe),
    refetchInterval: 15000,
  });
}

export function useMarketStatus() {
  return useQuery({
    queryKey: ["market-status"],
    queryFn: fetchMarketStatus,
    refetchInterval: 5000,
  });
}

export function useJournalEntries(params?: { pair?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ["journal-entries", params],
    queryFn: () => fetchJournalEntries(params),
  });
}

export function useJournalStats() {
  return useQuery({
    queryKey: ["journal-stats"],
    queryFn: fetchJournalStats,
  });
}

export function useScanner(timeframe: SupportedTimeframe) {
  return useQuery({
    queryKey: ["scanner", timeframe],
    queryFn: () => fetchScanner(timeframe),
    refetchInterval: 30000, // heavier batch call across all pairs — refresh less often than a single-pair signal
  });
}
