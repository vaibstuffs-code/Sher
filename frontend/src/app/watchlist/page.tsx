"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { MarketStatusBar } from "@/components/dashboard/MarketStatusBar";
import { Panel } from "@/components/ui/Panel";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { fetchWatchlist, addToWatchlist, removeFromWatchlist, toggleWatchlistFavorite, fetchSignal } from "@/lib/apiClient";
import { SUPPORTED_PAIRS, SupportedPair } from "@/types/market.types";
import { Star, X, Plus } from "lucide-react";
import clsx from "clsx";

function WatchlistRow({ pair, marketMode, isFavorite }: { pair: string; marketMode: "LIVE" | "OTC"; isFavorite: boolean }) {
  const queryClient = useQueryClient();
  const { data: signal } = useQuery({
    queryKey: ["signal", pair, "5m"],
    queryFn: () => fetchSignal(pair as SupportedPair, "5m"),
    refetchInterval: 20000,
  });

  const removeMutation = useMutation({
    mutationFn: () => removeFromWatchlist(pair, marketMode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });
  const favoriteMutation = useMutation({
    mutationFn: () => toggleWatchlistFavorite(pair, marketMode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  return (
    <div className="flex items-center gap-3 border-b border-white/[0.04] py-2.5 text-sm last:border-0">
      <button onClick={() => favoriteMutation.mutate()} className={clsx(isFavorite ? "text-accent-amber" : "text-text-tertiary hover:text-accent-amber")}>
        <Star size={15} fill={isFavorite ? "currentColor" : "none"} />
      </button>
      <span className="w-20 font-mono font-medium">{pair}</span>
      <span className="w-28 text-xs text-text-tertiary">{marketMode}</span>
      <div className="flex-1" />
      {signal ? (
        <>
          <SignalBadge signal={signal.signal} size="sm" />
          <span className="w-12 text-right font-mono text-xs text-text-secondary">{signal.convictionPct}%</span>
        </>
      ) : (
        <span className="text-xs text-text-tertiary">loading…</span>
      )}
      <button onClick={() => removeMutation.mutate()} className="text-text-tertiary hover:text-accent-coral">
        <X size={15} />
      </button>
    </div>
  );
}

export default function WatchlistPage() {
  const queryClient = useQueryClient();
  const [pairToAdd, setPairToAdd] = useState<SupportedPair>("EUR/USD");

  const { data: items, isLoading } = useQuery({ queryKey: ["watchlist"], queryFn: fetchWatchlist });

  const addMutation = useMutation({
    mutationFn: () => addToWatchlist(pairToAdd),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <MarketStatusBar />
        <main className="flex-1 px-5 py-5">
          <div className="mb-4 flex items-center gap-3">
            <select
              value={pairToAdd}
              onChange={(e) => setPairToAdd(e.target.value as SupportedPair)}
              className="rounded-lg border border-base-border bg-base-panel px-3 py-1.5 text-sm text-text-primary"
            >
              {SUPPORTED_PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-accent-indigo px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus size={15} /> Add to watchlist
            </button>
          </div>

          <Panel eyebrow="Watchlist" title="Tracked pairs">
            {isLoading ? (
              <div className="py-10 text-center text-sm text-text-tertiary">Loading…</div>
            ) : !items || items.length === 0 ? (
              <div className="py-10 text-center text-sm text-text-tertiary">
                No pairs in your watchlist yet — add one above.
              </div>
            ) : (
              <div>
                {items.map((item) => (
                  <WatchlistRow key={item.id} pair={item.pair} marketMode={item.marketMode} isFavorite={item.isFavorite} />
                ))}
              </div>
            )}
          </Panel>
        </main>
      </div>
    </div>
  );
}
