"use client";

import { SignalResult, SupportedPair } from "@/types/market.types";
import { Panel, StatRow } from "@/components/ui/Panel";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { ConfidenceGauge } from "@/components/dashboard/ConfidenceGauge";
import { TriangleAlert } from "lucide-react";

interface SignalPanelProps {
  pair: SupportedPair;
  result: SignalResult | null;
  isLoading: boolean;
}

export function SignalPanel({ pair, result, isLoading }: SignalPanelProps) {
  if (isLoading || !result) {
    return (
      <Panel eyebrow="AI Signal" title={pair}>
        <div className="flex h-48 items-center justify-center text-sm text-text-tertiary">
          Loading analysis…
        </div>
      </Panel>
    );
  }

  return (
    <Panel eyebrow="AI Signal" title={pair}>
      <div className="flex flex-col items-center">
        <ConfidenceGauge convictionPct={result.convictionPct} signal={result.signal} />
        <div className="mt-2">
          <SignalBadge signal={result.signal} size="lg" />
        </div>
      </div>

      {result.suppressedReason && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/5 p-2.5 text-xs text-accent-amber">
          <TriangleAlert size={14} className="mt-0.5 flex-shrink-0" />
          <span>Signal held to WAIT: {result.suppressedReason}</span>
        </div>
      )}

      <div className="mt-4 space-y-0.5">
        <StatRow
          label="Trend"
          value={result.trendDirection === "bullish" ? "Bullish ▲" : result.trendDirection === "bearish" ? "Bearish ▼" : "Neutral"}
          valueClassName={result.trendDirection === "bullish" ? "text-accent-cyan" : result.trendDirection === "bearish" ? "text-accent-coral" : undefined}
        />
        <StatRow label="Market type" value={result.marketType} />
        <StatRow label="Risk level" value={result.riskLevel} valueClassName={result.riskLevel === "Elevated" ? "text-accent-coral" : undefined} />
        <StatRow label="Volatility" value={result.volatility} />
        <StatRow label="ADX" value={result.metrics.adx.toFixed(1)} />
        <StatRow label="RSI" value={result.metrics.rsi?.toFixed(1) ?? "—"} />
      </div>
    </Panel>
  );
}
