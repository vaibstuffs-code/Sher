"use client";

import { JournalEntry } from "@/types/market.types";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteJournalEntry } from "@/lib/apiClient";
import { Trash2 } from "lucide-react";
import clsx from "clsx";

export function JournalTable({ entries }: { entries: JournalEntry[] }) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: deleteJournalEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["journal-stats"] });
    },
  });

  if (entries.length === 0) {
    return <div className="py-10 text-center text-sm text-text-tertiary">No trades logged yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-text-tertiary">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Pair</th>
            <th className="px-3 py-2">Direction</th>
            <th className="px-3 py-2">Confidence</th>
            <th className="px-3 py-2">Result</th>
            <th className="px-3 py-2">P&amp;L</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-white/[0.04]">
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                {new Date(e.date).toLocaleDateString()}
              </td>
              <td className="px-3 py-2 font-mono">{e.pair}</td>
              <td className="px-3 py-2"><SignalBadge signal={e.direction} size="sm" /></td>
              <td className="px-3 py-2 font-mono text-xs">{e.confidence != null ? `${e.confidence}%` : "—"}</td>
              <td
                className={clsx(
                  "px-3 py-2 text-xs font-medium",
                  e.result === "WIN" && "text-accent-cyan",
                  e.result === "LOSS" && "text-accent-coral",
                  e.result === "PENDING" && "text-accent-amber"
                )}
              >
                {e.result}
              </td>
              <td className={clsx("px-3 py-2 font-mono text-xs", (e.profit ?? 0) >= 0 ? "text-accent-cyan" : "text-accent-coral")}>
                {e.profit != null ? `${e.profit >= 0 ? "+" : ""}$${e.profit.toFixed(2)}` : "—"}
              </td>
              <td className="px-3 py-2">
                <button
                  onClick={() => deleteMutation.mutate(e.id)}
                  className="text-text-tertiary hover:text-accent-coral"
                  aria-label="Delete entry"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
