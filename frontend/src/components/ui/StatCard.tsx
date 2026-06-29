import clsx from "clsx";

interface StatCardProps {
  label: string;
  value: string;
  accent?: "cyan" | "coral" | "amber" | "neutral";
  sublabel?: string;
}

export function StatCard({ label, value, accent = "neutral", sublabel }: StatCardProps) {
  const colors: Record<string, string> = {
    cyan: "text-accent-cyan",
    coral: "text-accent-coral",
    amber: "text-accent-amber",
    neutral: "text-text-primary",
  };

  return (
    <div className="rounded-xl border border-base-border bg-base-panel/70 p-4">
      <div className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</div>
      <div className={clsx("mt-1 font-mono text-2xl font-bold", colors[accent])}>{value}</div>
      {sublabel && <div className="mt-0.5 text-[11px] text-text-secondary">{sublabel}</div>}
    </div>
  );
}
