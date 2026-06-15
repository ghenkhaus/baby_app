import { useEffect, useState } from "react";

interface BulkAddPeopleModalProps {
  onBulkAdd: (names: string[]) => Promise<{ created: number; skipped: string[] }>;
  onClose: () => void;
  onResult: (message: string, type: "success" | "error") => void;
}

export function BulkAddPeopleModal({
  onBulkAdd,
  onClose,
  onResult,
}: BulkAddPeopleModalProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const names = text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const handleSubmit = async () => {
    if (names.length === 0) return;
    setSubmitting(true);
    try {
      const result = await onBulkAdd(names);
      const skippedNote = result.skipped.length
        ? ` · ${result.skipped.length} skipped (duplicate)`
        : "";
      onResult(`Added ${result.created} ${result.created === 1 ? "person" : "people"}${skippedNote}`, "success");
      onClose();
    } catch (err) {
      onResult(err instanceof Error ? err.message : "Failed to add", "error");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm sm:p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto animate-[slideInUp_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="p-5 sm:p-7">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1 tracking-tight">
            Bulk Add People
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Paste one name per line. Duplicates of existing names will be skipped.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            autoFocus
            placeholder={"Mom\nDad\nAunt Carol\nUncle Bob\n…"}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white/80 text-slate-800 placeholder:text-slate-400 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors font-mono"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            {names.length === 0
              ? "No names yet"
              : `${names.length} name${names.length === 1 ? "" : "s"} ready`}
          </p>
          <div className="flex justify-end gap-2.5 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={names.length === 0 || submitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-xl hover:from-indigo-500 hover:to-indigo-700 transition-all shadow-sm shadow-indigo-600/25 ring-1 ring-inset ring-white/10 active:scale-[0.98] disabled:opacity-60"
            >
              {submitting
                ? "Adding…"
                : `Add ${names.length || ""} ${names.length === 1 ? "person" : "people"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
