"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { useScanner } from "@/hooks/useMarketData";
import { SupportedTimeframe } from "@/types/market.types";
import { Info } from "lucide-react";

interface StrongSetupsPanelProps {
  timeframe: SupportedTimeframe;
  onSelectPair: (pair: string) => void;
}

export function StrongSetupsPanel({ timeframe, onSelectPair }: StrongSetupsPanelProps) {
  const [threshold, setThreshold] = useState(85);
  const { data: scanner, isLoading } = useScanner(timeframe);

  const strongSetups = (scanner ?? [])
    .filter((s): s is typeof s & { result: NonNullable<typeof s.result> } =>
      s.result !== null && s.result.marketType === "Trending" && s.result.convictionPct >= threshold
    )
    .sort((a, b) => b.result.convictionPct - a.result.convictionPct);

  return (
    <Panel
      eyebrow="Scanner"
      title="Strong setups"
      right={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-tertiary">min conviction</span>
          <input
            type="range" min={50} max={97} value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-20 accent-accent-indigo"
          />
          <span className="w-9 font-mono text-xs text-accent-cyan">{threshold}%</span>
        </div>
      }
    >
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-accent-indigo/25 bg-accent-indigo/5 p-2.5 text-[11px] leading-relaxed text-text-secondary">
        <Info size={13} className="mt-0.5 flex-shrink-0 text-accent-indigo" />
        <span>
          <span className="text-text-primary">Conviction</span>, not accuracy — how strongly indicators currently
          agree, not a measured win rate. For real accuracy by pair, see the Journal&apos;s Analytics tab once you&apos;ve logged trades.
        </span>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-text-tertiary">Scanning pairs…</div>
      ) : strongSetups.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-tertiary">
          No pairs are both trending and above {threshold}% conviction right now.
        </div>
      ) : (
        <div className="space-y-1">
          {strongSetups.map(({ pair, result }) => (
            <button
              key={pair}
              onClick={() => onSelectPair(pair)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-white/[0.03]"
            >
              <span className="w-20 font-mono font-medium">{pair}</span>
              <SignalBadge signal={result.signal} size="sm" />
              <span className="font-mono text-xs text-accent-cyan">{result.convictionPct}%</span>
              <span className="text-xs text-text-tertiary">ADX {result.metrics.adx.toFixed(1)}</span>
              <span className="ml-auto text-xs text-text-tertiary">
                {result.trendDirection === "bullish" ? "▲ bullish" : "▼ bearish"}
              </span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
