"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MarketStatusBar } from "@/components/dashboard/MarketStatusBar";
import { Panel } from "@/components/ui/Panel";
import { StatCard } from "@/components/ui/StatCard";
import { EquityCurveChart } from "@/components/journal/EquityCurveChart";
import { JournalTable } from "@/components/journal/JournalTable";
import { NewTradeForm } from "@/components/journal/NewTradeForm";
import { CsvImportPanel } from "@/components/journal/CsvImportPanel";
import { useJournalEntries, useJournalStats } from "@/hooks/useMarketData";

export default function JournalPage() {
  const [tab, setTab] = useState<"history" | "new" | "import" | "analytics">("history");
  const { data: entries, isLoading: entriesLoading } = useJournalEntries();
  const { data: stats } = useJournalStats();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <MarketStatusBar />

        <main className="flex-1 px-5 py-5">
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Total P&L" value={`${(stats?.totalProfit ?? 0) >= 0 ? "+" : ""}$${(stats?.totalProfit ?? 0).toFixed(2)}`} accent={(stats?.totalProfit ?? 0) >= 0 ? "cyan" : "coral"} />
            <StatCard label="Win rate" value={`${stats?.winRatePct ?? 0}%`} accent={(stats?.winRatePct ?? 0) >= 50 ? "cyan" : "coral"} sublabel={`${stats?.wins ?? 0}W / ${stats?.losses ?? 0}L`} />
            <StatCard label="Profit factor" value={stats?.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"} />
            <StatCard label="Max drawdown" value={`$${(stats?.maxDrawdown ?? 0).toFixed(2)}`} accent="amber" />
            <StatCard label="Avg. confidence" value={stats?.averageConfidence != null ? `${stats.averageConfidence}%` : "—"} />
          </div>

          <div className="mb-5 flex gap-1 rounded-lg border border-base-border bg-base-panel p-1 w-fit">
            {([["history", "Trade history"], ["new", "New trade"], ["import", "Import CSV"], ["analytics", "Analytics"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  tab === key ? "bg-accent-indigo text-white" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "history" && (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <Panel eyebrow="Log" title="All trades">
                {entriesLoading ? (
                  <div className="py-10 text-center text-sm text-text-tertiary">Loading…</div>
                ) : (
                  <JournalTable entries={entries ?? []} />
                )}
              </Panel>
              <Panel eyebrow="Performance" title="Equity curve">
                <EquityCurveChart entries={entries ?? []} />
              </Panel>
            </div>
          )}

          {tab === "new" && (
            <div className="max-w-xl">
              <NewTradeForm />
            </div>
          )}

          {tab === "import" && (
            <div className="max-w-xl">
              <CsvImportPanel />
            </div>
          )}

          {tab === "analytics" && stats && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel eyebrow="Risk" title="Win/loss profile">
                <div className="space-y-1">
                  <Row label="Average win" value={`$${stats.averageWin.toFixed(2)}`} />
                  <Row label="Average loss" value={`$${stats.averageLoss.toFixed(2)}`} />
                  <Row label="Risk:reward ratio" value={stats.riskRewardRatio != null ? stats.riskRewardRatio.toFixed(2) : "—"} />
                  <Row label="Longest win streak" value={String(stats.longestWinStreak)} />
                  <Row label="Longest loss streak" value={String(stats.longestLossStreak)} />
                </div>
              </Panel>
              <Panel eyebrow="Breakdown" title="Best / worst">
                <div className="space-y-1">
                  <Row label="Best pair" value={stats.bestPair ?? "Not enough data"} />
                  <Row label="Worst pair" value={stats.worstPair ?? "Not enough data"} />
                  <Row label="Best hour (IST)" value={stats.bestHour != null ? `${stats.bestHour}:00` : "Not enough data"} />
                  <Row label="Worst hour (IST)" value={stats.worstHour != null ? `${stats.worstHour}:00` : "Not enough data"} />
                </div>
              </Panel>
              <Panel eyebrow="Pairs" title="Win rate by pair" className="lg:col-span-2">
                <div className="space-y-2">
                  {Object.entries(stats.byPair).map(([pair, s]) => (
                    <div key={pair} className="flex items-center gap-3 text-sm">
                      <span className="w-20 font-mono">{pair}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full bg-accent-cyan"
                          style={{ width: `${s.winRatePct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-mono text-xs text-text-secondary">{s.winRatePct}%</span>
                      <span className="w-16 text-right text-xs text-text-tertiary">{s.trades} trades</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-1.5 text-sm last:border-0">
      <span className="text-text-secondary">{label}</span>
      <span className="font-mono font-medium text-text-primary">{value}</span>
    </div>
  );
}
