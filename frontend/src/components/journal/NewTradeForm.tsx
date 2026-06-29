"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createJournalEntry } from "@/lib/apiClient";
import { Panel } from "@/components/ui/Panel";
import { SUPPORTED_PAIRS } from "@/types/market.types";

export function NewTradeForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    pair: "EUR/USD",
    direction: "BUY" as "BUY" | "SELL",
    entryPrice: "",
    exitPrice: "",
    stake: "",
    result: "PENDING" as "WIN" | "LOSS" | "BREAKEVEN" | "PENDING",
    profit: "",
    confidence: "",
    notes: "",
    emotion: "",
  });

  const mutation = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["journal-stats"] });
      setForm((f) => ({ ...f, entryPrice: "", exitPrice: "", stake: "", profit: "", notes: "" }));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      date: new Date().toISOString(),
      pair: form.pair,
      marketMode: "LIVE",
      direction: form.direction,
      entryPrice: form.entryPrice ? parseFloat(form.entryPrice) : undefined,
      exitPrice: form.exitPrice ? parseFloat(form.exitPrice) : undefined,
      stake: form.stake ? parseFloat(form.stake) : undefined,
      result: form.result,
      profit: form.profit ? parseFloat(form.profit) : undefined,
      confidence: form.confidence ? parseFloat(form.confidence) : undefined,
      notes: form.notes || undefined,
      emotion: form.emotion || undefined,
    });
  };

  return (
    <Panel eyebrow="Journal" title="Log a new trade">
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
        <label className="text-xs text-text-secondary">
          Pair
          <select
            value={form.pair}
            onChange={(e) => setForm((f) => ({ ...f, pair: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-base-border bg-base-raised px-3 py-2 text-sm text-text-primary"
          >
            {SUPPORTED_PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>

        <label className="text-xs text-text-secondary">
          Direction
          <select
            value={form.direction}
            onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as "BUY" | "SELL" }))}
            className="mt-1 w-full rounded-lg border border-base-border bg-base-raised px-3 py-2 text-sm text-text-primary"
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </label>

        <label className="text-xs text-text-secondary">
          Entry price
          <input
            type="number" step="any" value={form.entryPrice}
            onChange={(e) => setForm((f) => ({ ...f, entryPrice: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-base-border bg-base-raised px-3 py-2 font-mono text-sm text-text-primary"
            placeholder="1.08500"
          />
        </label>

        <label className="text-xs text-text-secondary">
          Exit price
          <input
            type="number" step="any" value={form.exitPrice}
            onChange={(e) => setForm((f) => ({ ...f, exitPrice: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-base-border bg-base-raised px-3 py-2 font-mono text-sm text-text-primary"
            placeholder="1.08620"
          />
        </label>

        <label className="text-xs text-text-secondary">
          Stake ($)
          <input
            type="number" step="any" value={form.stake}
            onChange={(e) => setForm((f) => ({ ...f, stake: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-base-border bg-base-raised px-3 py-2 font-mono text-sm text-text-primary"
            placeholder="10"
          />
        </label>

        <label className="text-xs text-text-secondary">
          Confidence at entry (%)
          <input
            type="number" min="0" max="100" value={form.confidence}
            onChange={(e) => setForm((f) => ({ ...f, confidence: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-base-border bg-base-raised px-3 py-2 font-mono text-sm text-text-primary"
            placeholder="72"
          />
        </label>

        <label className="text-xs text-text-secondary">
          Result
          <select
            value={form.result}
            onChange={(e) => setForm((f) => ({ ...f, result: e.target.value as typeof form.result }))}
            className="mt-1 w-full rounded-lg border border-base-border bg-base-raised px-3 py-2 text-sm text-text-primary"
          >
            <option value="PENDING">Pending</option>
            <option value="WIN">Win</option>
            <option value="LOSS">Loss</option>
            <option value="BREAKEVEN">Breakeven</option>
          </select>
        </label>

        <label className="text-xs text-text-secondary">
          Profit / loss ($)
          <input
            type="number" step="any" value={form.profit}
            onChange={(e) => setForm((f) => ({ ...f, profit: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-base-border bg-base-raised px-3 py-2 font-mono text-sm text-text-primary"
            placeholder="-10 or 8"
          />
        </label>

        <label className="col-span-2 text-xs text-text-secondary">
          Notes
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="mt-1 w-full rounded-lg border border-base-border bg-base-raised px-3 py-2 text-sm text-text-primary"
            placeholder="What was your reasoning? What would you do differently?"
          />
        </label>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="col-span-2 mt-1 rounded-lg bg-accent-indigo py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save trade"}
        </button>

        {mutation.isError && (
          <div className="col-span-2 text-xs text-accent-coral">Couldn&apos;t save the trade. Check the form and try again.</div>
        )}
      </form>
    </Panel>
  );
}
