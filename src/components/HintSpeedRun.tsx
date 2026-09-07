import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Person, ThankYouCard } from "../types";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

interface SpeedRunRow {
  card: ThankYouCard;
  members: Person[];
  recipient: string;
  total: number;
}

interface HintSpeedRunProps {
  rows: SpeedRunRow[];
  onUpdateCard: (id: string, updates: Partial<{ hint: string }>) => Promise<ThankYouCard>;
  onClose: () => void;
  onToast: (message: string, type: "success" | "error") => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

export function HintSpeedRun({ rows, onUpdateCard, onClose, onToast }: HintSpeedRunProps) {
  const [skipHinted, setSkipHinted] = useState(true);
  // The queue is frozen per skip-toggle setting so saving a hint doesn't
  // reshuffle indices mid-run; card data itself stays fresh via rowsById.
  const [queueIds, setQueueIds] = useState<string[]>(() =>
    rows.filter((r) => r.card.hint.trim() === "").map((r) => r.card.id)
  );
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.card.id, r])), [rows]);
  const queue = useMemo(
    () => queueIds.map((id) => rowsById.get(id)).filter((r): r is SpeedRunRow => r !== undefined),
    [queueIds, rowsById]
  );
  const current = queue[index];

  // Draft is seeded from the current card and reset when the current card
  // changes, during render rather than in an effect (avoids a cascading
  // render). See "resetting state when a prop changes" in the React docs.
  const [draft, setDraft] = useState(current?.card.hint ?? "");
  const [draftForId, setDraftForId] = useState(current?.card.id);
  if (current?.card.id !== draftForId) {
    setDraftForId(current?.card.id);
    setDraft(current?.card.hint ?? "");
  }

  useEffect(() => {
    // Focus the textarea after it re-renders for the new card.
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [current?.card.id]);

  const toggleSkip = (skip: boolean) => {
    setSkipHinted(skip);
    setQueueIds(rows.filter((r) => (skip ? r.card.hint.trim() === "" : true)).map((r) => r.card.id));
    setIndex(0);
    setDone(false);
  };

  // Saves the draft if it changed. Returns false when the save failed (stay put).
  const saveIfDirty = useCallback(async () => {
    if (!current || draft === current.card.hint) return true;
    setSaving(true);
    try {
      await onUpdateCard(current.card.id, { hint: draft });
      setSavedCount((n) => n + 1);
      return true;
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to save hint", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }, [current, draft, onUpdateCard, onToast]);

  const goNext = useCallback(async () => {
    if (saving) return;
    if (!(await saveIfDirty())) return;
    if (index >= queue.length - 1) setDone(true);
    else setIndex(index + 1);
  }, [saving, saveIfDirty, index, queue.length]);

  const goPrev = useCallback(async () => {
    if (saving || index === 0) return;
    if (!(await saveIfDirty())) return;
    setIndex(index - 1);
  }, [saving, saveIfDirty, index]);

  const handleClose = useCallback(async () => {
    if (saving) return;
    await saveIfDirty();
    onClose();
  }, [saving, saveIfDirty, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (done && e.key === "Enter") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleClose, goNext, goPrev, done, onClose]);

  // Deduped gift list for the current card (couples on one card may
  // co-contribute the same item) — mirrors ThankYouCardModal's summary.
  const gifts = useMemo(() => {
    if (!current) return [];
    const byItem = new Map<string, { itemName: string; givers: string[] }>();
    for (const m of current.members) {
      for (const c of m.contributions) {
        const existing = byItem.get(c.itemId);
        if (existing) existing.givers.push(m.name);
        else byItem.set(c.itemId, { itemName: c.itemName, givers: [m.name] });
      }
    }
    return Array.from(byItem.values());
  }, [current]);

  const legend = (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
      <span><Kbd>Enter</Kbd> save & next</span>
      <span><Kbd>Shift+Enter</Kbd> newline</span>
      <span><Kbd>{modKey}+←</Kbd> <Kbd>{modKey}+→</Kbd> navigate</span>
      <span><Kbd>Esc</Kbd> save & close</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white w-full h-full sm:h-auto sm:max-w-xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span>
            <h2 className="text-sm font-semibold text-slate-800">Personal touches</h2>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={skipHinted}
                onChange={(e) => toggleSkip(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/40"
              />
              Skip cards that have one
            </label>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Save & close (Esc)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-300"
            style={{ width: queue.length === 0 ? "100%" : `${((done ? queue.length : index) / queue.length) * 100}%` }}
          />
        </div>

        {queue.length === 0 || done ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <span className="text-3xl">🎉</span>
            <p className="text-base font-semibold text-slate-800">
              {queue.length === 0 ? "All caught up" : "All done"}
            </p>
            <p className="text-sm text-slate-500">
              {queue.length === 0
                ? "Every card already has a personal touch."
                : savedCount > 0
                  ? `${savedCount} personal ${savedCount === 1 ? "touch" : "touches"} added — Claude will weave them into the notes.`
                  : "You made it through the whole stack."}
            </p>
            {queue.length === 0 && skipHinted && (
              <button
                type="button"
                onClick={() => toggleSkip(false)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Review all cards instead
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-xl hover:from-indigo-500 hover:to-indigo-700 transition-all"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 px-5 py-4 overflow-y-auto">
            {/* Recipient */}
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg font-semibold text-slate-900 truncate">{current.recipient}</p>
                <p className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                  {index + 1} / {queue.length}
                </p>
              </div>
              {current.members.length > 1 && (
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {current.members.map((m) => (
                    <span
                      key={m.id}
                      className="text-[11px] font-medium text-fuchsia-700 bg-fuchsia-50 rounded-full px-1.5 py-0.5 ring-1 ring-inset ring-fuchsia-200/70"
                    >
                      {m.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Gifts reminder */}
            <div className="p-3 bg-slate-50/80 rounded-xl ring-1 ring-inset ring-slate-200/60">
              {gifts.length === 0 ? (
                <p className="text-xs text-slate-400">No gifts recorded for this card.</p>
              ) : (
                <ul className="space-y-1">
                  {gifts.map((g) => (
                    <li key={g.itemName} className="text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{g.itemName}</span>
                      {current.members.length > 1 && <span className="text-slate-400"> — {g.givers.join(" & ")}</span>}
                    </li>
                  ))}
                  {current.total > 0 && (
                    <li className="text-[11px] text-slate-400 pt-0.5">{formatPrice(current.total)} total</li>
                  )}
                </ul>
              )}
            </div>

            {/* Hint input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Personal touch
              </label>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    goNext();
                  }
                }}
                rows={3}
                placeholder="How you know them, shower moments, inside jokes — Claude uses this when drafting"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors resize-none"
              />
            </div>

            {/* Nav buttons + legend */}
            <div className="mt-auto space-y-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={index === 0 || saving}
                  className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={saving}
                  className="flex-1 sm:flex-none px-5 py-2 text-sm font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-xl hover:from-indigo-500 hover:to-indigo-700 transition-all disabled:opacity-50"
                >
                  {saving ? "Saving…" : draft === current.card.hint ? "Skip →" : "Save & next"}
                </button>
              </div>
              {legend}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="px-1 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 rounded border border-slate-200">
      {children}
    </kbd>
  );
}
