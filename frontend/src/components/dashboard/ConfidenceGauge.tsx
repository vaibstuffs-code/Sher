"use client";

import { motion } from "framer-motion";

interface ConfidenceGaugeProps {
  convictionPct: number; // 0-100, direction-agnostic strength
  signal: "BUY" | "SELL" | "WAIT";
  size?: number;
}

export function ConfidenceGauge({ convictionPct, signal, size = 160 }: ConfidenceGaugeProps) {
  const stroke = 10;
  const r = size / 2 - stroke;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - convictionPct / 100);

  const color = signal === "BUY" ? "#3DD9E8" : signal === "SELL" ? "#FF5C7A" : "#FFC857";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-text-primary">{convictionPct}%</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-wider text-text-tertiary">conviction</span>
      </div>
    </div>
  );
}
