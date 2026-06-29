"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { importJournalCsv, ImportResult } from "@/lib/apiClient";
import { Panel } from "@/components/ui/Panel";
import { Upload } from "lucide-react";

export function CsvImportPanel() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: importJournalCsv,
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["journal-stats"] });
    },
  });

  const handleFile = (file: File) => {
    setResult(null);
    mutation.mutate(file);
  };

  return (
    <Panel eyebrow="Journal" title="Import trade history">
      <p className="mb-3 text-xs text-text-secondary">
        Upload a CSV with columns: <code className="text-accent-cyan">date, pair, direction, result</code> required;
        <code className="text-accent-cyan"> entryPrice, exitPrice, stake, profit, confidence, notes</code> optional.
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-base-border bg-base-raised/40 px-6 py-8 text-center transition-colors hover:border-accent-indigo"
      >
        <Upload size={22} className="text-text-tertiary" />
        <span className="text-sm text-text-secondary">
          {mutation.isPending ? "Importing…" : "Drop a CSV here, or click to browse"}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {result && (
        <div className="mt-4 rounded-lg border border-base-border bg-base-raised/60 p-3 text-sm">
          <div className="text-accent-cyan">{result.inserted} trades imported</div>
          {result.skipped > 0 && (
            <div className="mt-1 text-accent-amber">
              {result.skipped} row{result.skipped === 1 ? "" : "s"} skipped
              {result.skippedRows.length > 0 && (
                <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-4 text-xs text-text-tertiary">
                  {result.skippedRows.map((r, i) => (
                    <li key={i}>Row {r.row}: {r.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {mutation.isError && (
        <div className="mt-3 text-xs text-accent-coral">Import failed. Check the file format and try again.</div>
      )}
    </Panel>
  );
}
