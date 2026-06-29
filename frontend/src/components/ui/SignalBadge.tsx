import clsx from "clsx";
import { SignalType } from "@/types/market.types";

export function SignalBadge({ signal, size = "md" }: { signal: SignalType; size?: "sm" | "md" | "lg" }) {
  const styles: Record<SignalType, string> = {
    BUY: "bg-accent-cyan/10 border-accent-cyan/40 text-accent-cyan",
    SELL: "bg-accent-coral/10 border-accent-coral/40 text-accent-coral",
    WAIT: "bg-accent-amber/10 border-accent-amber/40 text-accent-amber",
  };
  const sizes = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-3 py-1",
    lg: "text-sm px-4 py-1.5",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border font-display font-bold uppercase tracking-wider",
        styles[signal],
        sizes[size]
      )}
    >
      {signal}
    </span>
  );
}
