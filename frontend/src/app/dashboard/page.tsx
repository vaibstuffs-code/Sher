"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { PulseStrip } from "@/components/layout/PulseStrip";
import { MarketStatusBar } from "@/components/dashboard/MarketStatusBar";
import { SelectorBar } from "@/components/dashboard/SelectorBar";
import { SignalPanel } from "@/components/dashboard/SignalPanel";
import { NextCandlePanel } from "@/components/dashboard/NextCandlePanel";
import { ReasoningPanel } from "@/components/dashboard/ReasoningPanel";
import { StrongSetupsPanel } from "@/components/dashboard/StrongSetupsPanel";
import { PriceChart } from "@/components/charts/PriceChart";
import { Panel } from "@/components/ui/Panel";
import { useCandles, useSignal } from "@/hooks/useMarketData";
import { SupportedPair, SupportedTimeframe } from "@/types/market.types";

export default function DashboardPage() {
  const [pair, setPair] = useState<SupportedPair>("EUR/USD");
  const [timeframe, setTimeframe] = useState<SupportedTimeframe>("5m");

  const { data: candles, isLoading: candlesLoading } = useCandles(pair, timeframe);
  const { data: signal, isLoading: signalLoading } = useSignal(pair, timeframe);

  const lastPrice = candles && candles.length > 0 ? candles[candles.length - 1].close : undefined;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <MarketStatusBar />
        <PulseStrip candles={candles ?? []} direction={signal?.trendDirection ?? "neutral"} />

        <main className="flex-1 px-5 pb-6">
          <SelectorBar
            pair={pair}
            timeframe={timeframe}
            onPairChange={setPair}
            onTimeframeChange={setTimeframe}
            lastPrice={lastPrice}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
            <div className="flex flex-col gap-4">
              <SignalPanel pair={pair} result={signal ?? null} isLoading={signalLoading} />
              <NextCandlePanel signal={signal ?? null} timeframe={timeframe} />
            </div>

            <div className="flex flex-col gap-4">
              <Panel eyebrow="Chart" title={`${pair} · ${timeframe}`}>
                {candlesLoading || !candles ? (
                  <div className="flex h-[380px] items-center justify-center text-sm text-text-tertiary">
                    Loading chart…
                  </div>
                ) : (
                  <PriceChart candles={candles} />
                )}
              </Panel>

              <ReasoningPanel result={signal ?? null} />
            </div>
          </div>

          <div className="mt-4">
            <StrongSetupsPanel timeframe={timeframe} onSelectPair={(p) => setPair(p as SupportedPair)} />
          </div>
        </main>
      </div>
    </div>
  );
}
