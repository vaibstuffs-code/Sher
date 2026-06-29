"use client";

import { SUPPORTED_PAIRS, SUPPORTED_TIMEFRAMES, SupportedPair, SupportedTimeframe, TIMEFRAME_LABELS } from "@/types/market.types";

interface SelectorBarProps {
  pair: SupportedPair;
  timeframe: SupportedTimeframe;
  onPairChange: (pair: SupportedPair) => void;
  onTimeframeChange: (tf: SupportedTimeframe) => void;
  lastPrice?: number;
}

export function SelectorBar({ pair, timeframe, onPairChange, onTimeframeChange, lastPrice }: SelectorBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-1 py-3">
      <select
        value={pair}
        onChange={(e) => onPairChange(e.target.value as SupportedPair)}
        className="rounded-lg border border-base-border bg-base-panel px-3 py-1.5 font-mono text-sm text-text-primary focus:border-accent-indigo"
      >
        {SUPPORTED_PAIRS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {lastPrice !== undefined && (
        <span className="font-mono text-base font-semibold text-accent-cyan">
          {lastPrice.toFixed(pair.includes("JPY") ? 3 : 5)}
        </span>
      )}

      <div className="ml-2 flex gap-1 rounded-lg border border-base-border bg-base-panel p-1">
        {SUPPORTED_TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            title={TIMEFRAME_LABELS[tf]}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              tf === timeframe ? "bg-accent-indigo text-white" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
    </div>
  );
}
