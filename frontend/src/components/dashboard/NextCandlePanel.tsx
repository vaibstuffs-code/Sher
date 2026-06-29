"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { toIST, formatISTClock, secondsToNextCandle } from "@/lib/istTime";
import { SignalResult, SupportedTimeframe, TIMEFRAME_SECONDS } from "@/types/market.types";

interface NextCandlePanelProps {
  signal: SignalResult | null;
  timeframe: SupportedTimeframe;
}

export function NextCandlePanel({ signal, timeframe }: NextCandlePanelProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const ist = toIST(now);
  const tfSeconds = TIMEFRAME_SECONDS[timeframe];
  const secondsLeft = secondsToNextCandle(ist, tfSeconds);

  const closeDate = new Date(now.getTime() + secondsLeft * 1000);
  const closeIst = toIST(closeDate);
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;

  return (
    <Panel eyebrow="Next candle" title={`Closes at ${formatISTClock(closeIst).slice(0, 5)} IST`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-2xl font-bold text-accent-cyan">
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
          <div className="mt-0.5 text-[11px] text-text-tertiary">until this candle closes</div>
        </div>
        {signal ? (
          <div className="text-right">
            <SignalBadge signal={signal.signal} size="lg" />
            <div className="mt-1 font-mono text-xs text-text-secondary">{signal.convictionPct}% conviction</div>
          </div>
        ) : (
          <div className="text-xs text-text-tertiary">loading…</div>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-text-tertiary">
        This is the live signal right now, for the candle currently forming — it updates continuously and isn&apos;t
        a locked-in prediction of how this specific candle will close. Indicators describe current conditions; they
        can&apos;t see the future, and the signal can flip before the candle closes if conditions change.
      </p>
    </Panel>
  );
}
