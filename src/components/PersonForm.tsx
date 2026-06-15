import { useEffect, useState } from "react";
import type { Person } from "../types";

interface PersonFormProps {
  person?: Person;
  people: Person[];
  onSave: (data: {
    name: string;
    email: string;
    notes: string;
    shareCardWithPersonId?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export function PersonForm({ person, people, onSave, onCancel }: PersonFormProps) {
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [notes, setNotes] = useState(person?.notes ?? "");
  const [shareWith, setShareWith] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: trimmed,
        email: email.trim(),
        notes: notes.trim(),
        shareCardWithPersonId: shareWith || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 text-slate-800 placeholder:text-slate-400 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors";
  const labelClass =
    "block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm sm:p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto animate-[slideInUp_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="p-5 sm:p-7">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 sm:mb-5 tracking-tight">
            {person ? "Edit Person" : "Add Person"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                className={inputClass}
                placeholder="e.g., Aunt Carol"
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="optional"
              />
            </div>
            <div>
              <label className={labelClass}>Personal notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
                rows={3}
                placeholder="Anything to remember about this person…"
              />
            </div>
            {!person && people.length > 0 && (
              <div>
                <label className={labelClass}>
                  Share thank-you card with…{" "}
                  <span className="text-slate-400 normal-case font-normal">
                    (optional)
                  </span>
                </label>
                <select
                  value={shareWith}
                  onChange={(e) => setShareWith(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Give them their own card —</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.thankYouCard?.label ? ` (${p.thankYouCard.label})` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Pick someone if this person shares a household (e.g. a
                  spouse). They'll edit the same thank-you note and address.
                </p>
              </div>
            )}
            {error && (
              <p className="text-xs text-rose-600 px-1">{error}</p>
            )}
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-xl hover:from-indigo-500 hover:to-indigo-700 transition-all shadow-sm shadow-indigo-600/25 ring-1 ring-inset ring-white/10 active:scale-[0.98] disabled:opacity-60"
              >
                {person ? "Save Changes" : "Add Person"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
