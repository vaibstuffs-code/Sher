"use client";

import { useEffect, useState } from "react";
import { toIST, isMarketOpen, getSessionLabel, formatISTClock } from "@/lib/istTime";
import clsx from "clsx";

export function MarketStatusBar() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const ist = toIST(now);
  const open = isMarketOpen(ist);
  const session = getSessionLabel(ist);

  return (
    <div className="flex items-center gap-4 border-b border-base-border bg-base-raised px-5 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-text-tertiary">IST</span>
        <span className="font-mono font-medium text-text-primary">{formatISTClock(ist)}</span>
      </div>

      <div className="h-4 w-px bg-base-border" />

      <div className="flex items-center gap-1.5">
        <span
          className={clsx(
            "h-1.5 w-1.5 rounded-full",
            open ? "bg-accent-cyan shadow-glow_cyan" : "bg-accent-coral shadow-glow_coral"
          )}
        />
        <span className={clsx("font-medium", open ? "text-accent-cyan" : "text-accent-coral")}>
          {open ? "Live Market — Open" : "After-Hours — Closed"}
        </span>
      </div>

      <div className="h-4 w-px bg-base-border" />

      <span className="text-text-secondary">{session.label}</span>
      <span className="text-text-tertiary">· {session.volatility} volatility</span>
    </div>
  );
}
