"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MarketStatusBar } from "@/components/dashboard/MarketStatusBar";
import { Panel } from "@/components/ui/Panel";
import clsx from "clsx";

const INDICATOR_LABELS: Record<string, string> = {
  ema_stack: "EMA Stack (9/20/50)",
  adx_di: "ADX / Directional Index",
  rsi: "RSI",
  macd: "MACD",
  stoch_rsi: "Stochastic RSI",
  supertrend: "SuperTrend",
  psar: "Parabolic SAR",
  vwap: "VWAP",
  cci: "CCI",
  williams_r: "Williams %R",
  mfi: "Money Flow Index",
  obv_trend: "OBV Trend",
  awesome_osc: "Awesome Oscillator",
  momentum: "Momentum",
  roc: "Rate of Change",
  volume: "Volume confirmation",
  candle_pattern: "Candlestick patterns",
  market_structure: "Market structure (HH/HL/LH/LL)",
  ichimoku: "Ichimoku Cloud",
  bollinger: "Bollinger Bands",
};

const DEFAULT_ENABLED: Record<string, boolean> = {
  ema_stack: true, adx_di: true, rsi: true, macd: true, stoch_rsi: true,
  supertrend: true, psar: true, vwap: true, cci: true, williams_r: true,
  mfi: true, obv_trend: true, awesome_osc: true, momentum: true, roc: true,
  volume: true, candle_pattern: true, market_structure: true,
  ichimoku: false, bollinger: false,
};

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={clsx("relative h-5 w-9 rounded-full transition-colors", enabled ? "bg-accent-indigo" : "bg-white/10")}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
          enabled ? "left-[18px]" : "left-0.5"
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [enabled, setEnabled] = useState(DEFAULT_ENABLED);
  const [theme, setTheme] = useState<"indigo" | "neon" | "mono">("indigo");
  const [confidenceThreshold, setConfidenceThreshold] = useState(62);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <MarketStatusBar />
        <main className="flex-1 px-5 py-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel eyebrow="Configuration" title="Enabled indicators">
              <p className="mb-3 text-xs text-text-secondary">
                Indicators contribute a weighted vote to the confidence score. Disabling one removes its vote
                entirely rather than ignoring it silently.
              </p>
              <div className="space-y-1.5">
                {Object.entries(INDICATOR_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="text-sm text-text-secondary">{label}</span>
                    <Toggle
                      enabled={enabled[key]}
                      onToggle={() => setEnabled((e) => ({ ...e, [key]: !e[key] }))}
                    />
                  </div>
                ))}
              </div>
            </Panel>

            <div className="flex flex-col gap-4">
              <Panel eyebrow="Smart Filters" title="Signal thresholds">
                <label className="text-xs text-text-secondary">
                  Minimum conviction to show BUY/SELL (otherwise WAIT)
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="range" min={0} max={100} value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                      className="flex-1 accent-accent-indigo"
                    />
                    <span className="w-10 font-mono text-sm text-accent-cyan">{confidenceThreshold}%</span>
                  </div>
                </label>
                <p className="mt-3 text-[11px] leading-relaxed text-text-tertiary">
                  This mirrors the backend&apos;s smart filter — signals below this conviction are held to WAIT, and
                  sideways markets or thin volume suppress signals regardless of this setting.
                </p>
              </Panel>

              <Panel eyebrow="Appearance" title="Theme">
                <div className="flex gap-2">
                  {(["indigo", "neon", "mono"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={clsx(
                        "rounded-lg border px-4 py-2 text-sm capitalize transition-colors",
                        theme === t ? "border-accent-indigo bg-accent-indigo/15 text-accent-cyan" : "border-base-border text-text-secondary"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-text-tertiary">
                  Theme switching changes accent colors throughout the dashboard. (Wire this to a ThemeProvider / CSS variables to persist across sessions.)
                </p>
              </Panel>

              <Panel eyebrow="Data source" title="Market data">
                <p className="text-xs text-text-secondary">
                  Sher uses <span className="text-accent-cyan">Twelve Data</span> for all real forex candles. There is
                  no OTC mode — no licensed provider publishes OTC quotes, so this dashboard only analyzes data it can
                  actually verify.
                </p>
              </Panel>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
