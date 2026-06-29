import { SignalResult } from "@/types/market.types";
import { Panel } from "@/components/ui/Panel";
import clsx from "clsx";

export function ReasoningPanel({ result }: { result: SignalResult | null }) {
  if (!result) return null;

  return (
    <Panel eyebrow="Reasoning" title="Why this signal">
      <div className="flex flex-col gap-2">
        {result.votes.map((vote) => (
          <div key={vote.key} className="flex items-start gap-2 text-sm">
            <span
              className={clsx(
                "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                vote.vote === 1 && "bg-accent-cyan/15 text-accent-cyan",
                vote.vote === -1 && "bg-accent-coral/15 text-accent-coral",
                vote.vote === 0 && "bg-white/[0.06] text-text-tertiary"
              )}
            >
              {vote.vote === 1 ? "↑" : vote.vote === -1 ? "↓" : "–"}
            </span>
            <span className="text-text-secondary">{vote.reason}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
