"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { JournalEntry } from "@/types/market.types";

interface EquityCurveChartProps {
  entries: JournalEntry[];
}

export function EquityCurveChart({ entries }: EquityCurveChartProps) {
  const settled = entries
    .filter((e) => e.result !== "PENDING")
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = 0;
  const data = settled.map((e, i) => {
    running += e.profit ?? 0;
    return { index: i + 1, equity: Math.round(running * 100) / 100, date: e.date };
  });

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-text-tertiary">
        No settled trades yet — your equity curve will plot here once you log results.
      </div>
    );
  }

  const isPositive = data[data.length - 1].equity >= 0;
  const lineColor = isPositive ? "#3DD9E8" : "#FF5C7A";

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="index" tick={{ fill: "#5C6478", fontSize: 10 }} axisLine={{ stroke: "#222937" }} tickLine={false} />
        <YAxis tick={{ fill: "#5C6478", fontSize: 10 }} axisLine={{ stroke: "#222937" }} tickLine={false} width={48} />
        <Tooltip
          contentStyle={{ background: "#161B26", border: "1px solid #222937", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#8E96A8" }}
          formatter={(value: number) => [`$${value.toFixed(2)}`, "Cumulative P&L"]}
        />
        <Area type="monotone" dataKey="equity" stroke={lineColor} fill="url(#equityFill)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
