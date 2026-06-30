"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Panel } from "@/components/ui/Panel";
import { fetchBacktest, BacktestResult } from "@/lib/apiClient";
import { SUPPORTED_PAIRS, SUPPORTED_TIMEFRAMES, SupportedPair, SupportedTimeframe } from "@/types/market.types";
import { TriangleAlert, Play } from "lucide-react";
import clsx from "clsx";

export function BacktestPanel() {
  const [pair, setPair] = useState<SupportedPair>("EUR/USD");
  const [timeframe, setTimeframe] = useState<SupportedTimeframe>("5m");
  const [holdCandles, setHoldCandles] = useState(5);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => fetchBacktest(pair, timeframe, holdCandles),
    onSuccess: (data) => setResult(data),
  });

  return (
    <Panel eyebrow="Diagnostics" title="Backtest the signal engine">
      <p className="mb-3 text-xs leading-relaxed text-text-secondary">
        Replays the signal engine candle-by-candle against real historical data — at each point it only sees
        candles up to that moment, never future ones, then checks the signal against what price actually did
        afterward. This is a measured hit rate, not a vibe check, but it&apos;s still historical performance, not a
        guarantee of future results.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-text-secondary">
          Pair
          <select value={pair} onChange={(e) => setPair(e.target.value as SupportedPair)} className="mt-1 block rounded-lg border border-base-border bg-base-raised px-3 py-1.5 text-sm text-text-primary">
            {SUPPORTED_PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-xs text-text-secondary">
          Timeframe
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as SupportedTimeframe)} className="mt-1 block rounded-lg border border-base-border bg-base-raised px-3 py-1.5 text-sm text-text-primary">
            {SUPPORTED_TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
          </select>
        </label>
        <label className="text-xs text-text-secondary">
          Hold (candles)
          <input
            type="number" min={1} max={50} value={holdCandles}
            onChange={(e) => setHoldCandles(Number(e.target.value))}
            className="mt-1 block w-20 rounded-lg border border-base-border bg-base-raised px-3 py-1.5 text-sm text-text-primary"
          />
        </label>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-accent-indigo px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Play size={14} /> {mutation.isPending ? "Running…" : "Run backtest"}
        </button>
      </div>

      {mutation.isError && (
        <div className="text-xs text-accent-coral">Backtest failed — check the pair/timeframe and try again.</div>
      )}

      {result && (
        <div>
          {result.warnings.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/5 p-2.5 text-[11px] leading-relaxed text-accent-amber">
                  <TriangleAlert size={13} className="mt-0.5 flex-shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Trades" value={String(result.totalTrades)} />
            <Stat label="Win rate" value={`${result.winRatePct}%`} accent={result.winRatePct >= 50 ? "cyan" : "coral"} />
            <Stat label="Avg win" value={`${result.averageWinPct}%`} />
            <Stat label="Avg loss" value={`${result.averageLossPct}%`} />
          </div>

          <div className="text-xs text-text-secondary">
            <div className="mb-1.5 text-[11px] uppercase tracking-wide text-text-tertiary">Win rate by conviction bucket</div>
            {Object.entries(result.byConvictionBucket).map(([bucket, s]) => (
              <div key={bucket} className="flex items-center gap-3 py-1">
                <span className="w-16 font-mono">{bucket}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full bg-accent-cyan" style={{ width: `${s.winRatePct}%` }} />
                </div>
                <span className="w-12 text-right font-mono text-xs">{s.trades > 0 ? `${s.winRatePct}%` : "—"}</span>
                <span className="w-16 text-right text-[11px] text-text-tertiary">{s.trades} trades</span>
              </div>
            ))}
            <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
              If higher-conviction buckets don&apos;t show meaningfully better win rates than lower ones, that&apos;s a
              real sign the weighting scheme isn&apos;t capturing predictive structure on this pair/timeframe — worth
              knowing rather than assuming the conviction number is meaningful by default.
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "cyan" | "coral" }) {
  return (
    <div className="rounded-lg border border-base-border bg-base-raised/50 p-3">
      <div className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</div>
      <div className={clsx("mt-0.5 font-mono text-lg font-bold", accent === "cyan" ? "text-accent-cyan" : accent === "coral" ? "text-accent-coral" : "text-text-primary")}>
        {value}
      </div>
    </div>
  );
}
