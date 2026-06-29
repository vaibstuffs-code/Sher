import { ReactNode } from "react";
import clsx from "clsx";

interface PanelProps {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}

export function Panel({ title, eyebrow, children, className, right }: PanelProps) {
  return (
    <div className={clsx("rounded-xl border border-base-border bg-base-panel/70 p-5 backdrop-blur-sm", className)}>
      {(title || eyebrow) && (
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            {eyebrow && <div className="mb-0.5 text-[10px] uppercase tracking-wider text-accent-indigo">{eyebrow}</div>}
            {title && <div className="font-display text-sm font-semibold text-text-primary">{title}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatRow({ label, value, valueClassName }: { label: string; value: ReactNode; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-1.5 text-sm last:border-0">
      <span className="text-text-secondary">{label}</span>
      <span className={clsx("font-mono font-medium text-text-primary", valueClassName)}>{value}</span>
    </div>
  );
}
