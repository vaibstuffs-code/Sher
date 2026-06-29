"use client";

import { useEffect, useState } from "react";
import { Candle } from "@/types/market.types";

interface PulseStripProps {
  candles: Candle[];
  direction: "bullish" | "bearish" | "neutral";
}

/**
 * A thin ambient waveform built from recent candle closes — the page's
 * signature element. Deliberately understated (low height, low opacity)
 * so it reads as ambient instrumentation rather than a chart competing
 * with the real chart elsewhere on the page.
 */
export function PulseStrip({ candles, direction }: PulseStripProps) {
  const [path, setPath] = useState("");
  const width = 100; // viewBox units, scales via CSS width:100%
  const height = 28;

  useEffect(() => {
    if (candles.length < 2) {
      setPath("");
      return;
    }
    const closes = candles.slice(-60).map((c) => c.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const points = closes.map((c, i) => {
      const x = (i / (closes.length - 1)) * width;
      const y = height - ((c - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    setPath(`M ${points.join(" L ")}`);
  }, [candles]);

  const color = direction === "bullish" ? "#3DD9E8" : direction === "bearish" ? "#FF5C7A" : "#6E5BFF";

  return (
    <div className="relative h-7 w-full overflow-hidden border-b border-base-border bg-base-raised/60">
      {path ? (
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full opacity-70">
          <path d={path} fill="none" stroke={color} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] text-text-tertiary">
          awaiting data…
        </div>
      )}
    </div>
  );
}
