import { useEffect, useMemo, useState } from "react";
import type { Person, ThankYouCard, ThankYouCardStatus } from "../types";
import { effectiveContributionAmount } from "../types";
import { Markdown } from "./Markdown";
import { THANK_YOU_STATUSES, STATUS_META, formatSentDate } from "../utils/thankYouStatus";
import { markdownToPlainText, copyText } from "../utils/markdownToPlainText";

interface ThankYouCardModalProps {
  card: ThankYouCard;
  people: Person[];
  postableProjectUrl: string;
  onClose: () => void;
  onUpdateCard: (
    id: string,
    updates: Partial<{ label: string; mailingName: string; address: string; note: string; hint: string; status: ThankYouCardStatus; addressVerified: boolean }>
  ) => Promise<ThankYouCard>;
  onOpenPerson: (id: string) => void;
  onToast: (message: string, type: "success" | "error") => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

export function ThankYouCardModal({
  card,
  people,
  postableProjectUrl,
  onClose,
  onUpdateCard,
  onOpenPerson,
  onToast,
}: ThankYouCardModalProps) {
  const [label, setLabel] = useState(card.label);
  const [mailingName, setMailingName] = useState(card.mailingName);
  const [address, setAddress] = useState(card.address);
  const [note, setNote] = useState(card.note);
  const [hint, setHint] = useState(card.hint);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingVerified, setSavingVerified] = useState(false);

  // Form state is seeded from the card props above and this modal is mounted
  // with key={card.id} by the parent, so switching cards remounts with fresh
  // state — no prop→state sync effect needed.

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const members = useMemo(
    () => people.filter((p) => p.thankYouCardId === card.id),
    [people, card.id]
  );

  const recipient =
    card.label || card.mailingName || members.map((m) => m.name).join(" & ") || "Thank-you card";

  // Union of the members' gifts, deduped by item (a couple on one card can
  // both be contributors on the same item). Dollar total still counts each
  // person's contribution.
  const gifts = useMemo(() => {
    const byItem = new Map<
      string,
      { itemId: string; itemName: string; givers: string[]; amount: number; hasAmount: boolean; implied: boolean }
    >();
    let total = 0;
    for (const m of members) {
      for (const c of m.contributions) {
        const eff = effectiveContributionAmount(c);
        if (eff !== null) total += eff;
        const existing = byItem.get(c.itemId);
        if (existing) {
          existing.givers.push(m.name);
          if (eff !== null) {
            existing.amount += eff;
            existing.hasAmount = true;
            existing.implied = existing.implied || c.amount === null;
          }
        } else {
          byItem.set(c.itemId, {
            itemId: c.itemId,
            itemName: c.itemName,
            givers: [m.name],
            amount: eff ?? 0,
            hasAmount: eff !== null,
            implied: c.amount === null && eff !== null,
          });
        }
      }
    }
    return { rows: Array.from(byItem.values()), total: Math.round(total * 100) / 100 };
  }, [members]);

  const dirty =
    label !== card.label ||
    mailingName !== card.mailingName ||
    address !== card.address ||
    note !== card.note ||
    hint !== card.hint;

  // Only send fields that actually changed — an unchanged explicit `status: ""`
  // (or any field) would block the server's auto-Drafted bump.
  const handleSave = async () => {
    if (!dirty || saving) return;
    const updates: Partial<{ label: string; mailingName: string; address: string; note: string; hint: string }> = {};
    if (label !== card.label) updates.label = label;
    if (mailingName !== card.mailingName) updates.mailingName = mailingName;
    if (address !== card.address) updates.address = address;
    if (note !== card.note) updates.note = note;
    if (hint !== card.hint) updates.hint = hint;
    setSaving(true);
    try {
      await onUpdateCard(card.id, updates);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: ThankYouCardStatus) => {
    if (status === card.status || savingStatus) return;
    setSavingStatus(true);
    try {
      await onUpdateCard(card.id, { status });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to update status", "error");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleToggleVerified = async () => {
    if (savingVerified) return;
    setSavingVerified(true);
    try {
      await onUpdateCard(card.id, { addressVerified: !card.addressVerified });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to update address status", "error");
    } finally {
      setSavingVerified(false);
    }
  };

  const handleCopyMessage = async () => {
    const text = markdownToPlainText(note);
    if (!text) return;
    const ok = await copyText(text);
    onToast(ok ? "Message copied as plain text" : "Couldn't copy — clipboard unavailable", ok ? "success" : "error");
  };

  const handleCopyAddress = async () => {
    const text = `${mailingName || recipient}\n${address}`.trim();
    if (!text) return;
    const ok = await copyText(text);
    onToast(ok ? "Name & address copied" : "Couldn't copy — clipboard unavailable", ok ? "success" : "error");
  };

  const inputClass =
    "w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 text-slate-800 placeholder:text-slate-400 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors";
  const labelClass =
    "block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm sm:p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto animate-[slideInUp_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="p-5 sm:p-7">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                {recipient}
              </h2>
              {members.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onOpenPerson(m.id)}
                      className="text-xs font-medium text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 rounded-full px-2 py-0.5 ring-1 ring-inset ring-fuchsia-200/70 transition-colors"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status */}
          <div className="flex flex-wrap items-center gap-1.5 mb-5">
            {THANK_YOU_STATUSES.map((s) => {
              const meta = STATUS_META[s];
              const active = card.status === s;
              return (
                <button
                  key={s || "not-started"}
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  disabled={savingStatus}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full ring-1 ring-inset transition-colors disabled:opacity-60 ${
                    active ? meta.pillActive : `${meta.pill} hover:brightness-95`
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
            {card.status === "Sent" && card.sentAt && (
              <span className="text-[11px] text-slate-400 ml-1">
                Sent {formatSentDate(card.sentAt)}
              </span>
            )}
          </div>

          {/* Gifts context — what to thank them for */}
          <div className="mb-5 p-4 bg-slate-50/60 rounded-2xl ring-1 ring-inset ring-slate-100">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Gifts they gave</h3>
              {gifts.total > 0 && (
                <span className="text-xs text-slate-500 tabular-nums">
                  {formatPrice(gifts.total)} tracked
                </span>
              )}
            </div>
            {gifts.rows.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No tracked gifts.</p>
            ) : (
              <ul className="space-y-1">
                {gifts.rows.map((g) => (
                  <li
                    key={g.itemId}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white/70"
                  >
                    <span className="text-sm text-slate-800 truncate">
                      {g.itemName}
                      {members.length > 1 && (
                        <span className="text-xs text-slate-400 ml-1.5">
                          {g.givers.join(", ")}
                        </span>
                      )}
                    </span>
                    {g.hasAmount && g.amount > 0 && (
                      <span
                        className={`text-xs tabular-nums shrink-0 ${
                          g.implied ? "text-slate-400 italic" : "text-slate-500"
                        }`}
                        title={g.implied ? "Includes implied amounts (sole contributor)" : undefined}
                      >
                        {formatPrice(g.amount)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Card details */}
          <div className="mb-5 p-4 sm:p-5 bg-gradient-to-br from-pink-50/60 via-fuchsia-50/40 to-violet-50/50 ring-1 ring-inset ring-pink-200/60 rounded-2xl space-y-3">
            <div>
              <label className={labelClass}>Card label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder='e.g. "The Smiths"'
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Address to</label>
                <input
                  type="text"
                  value={mailingName}
                  onChange={(e) => setMailingName(e.target.value)}
                  placeholder="e.g. The Smith Family"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Mailing address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  placeholder="Street, city, state, zip"
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleVerified}
              disabled={savingVerified}
              role="switch"
              aria-checked={card.addressVerified}
              className={`inline-flex items-center gap-2 text-xs font-medium rounded-lg px-2.5 py-1.5 ring-1 ring-inset transition-colors disabled:opacity-60 ${
                card.addressVerified
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70 hover:bg-emerald-100"
                  : "bg-white/70 text-slate-600 ring-slate-200 hover:bg-white"
              }`}
              title="Mark this mailing address as double-checked"
            >
              <span
                className={`relative inline-block w-8 h-[18px] rounded-full transition-colors ${
                  card.addressVerified ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                    card.addressVerified ? "translate-x-[14px]" : ""
                  }`}
                />
              </span>
              {card.addressVerified ? "Address verified" : "Address not verified"}
            </button>

            <div>
              <label className={labelClass}>Personal touches</label>
              <textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                rows={2}
                placeholder="How you know them, shower moments, inside jokes — Claude uses this when drafting"
                className={inputClass}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Message
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Markdown</span>
                  {note && (
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className={`text-xs px-2 py-0.5 rounded-md font-medium transition-colors ${
                        showPreview
                          ? "bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {showPreview ? "Edit" : "Preview"}
                    </button>
                  )}
                </div>
              </div>
              {showPreview ? (
                <div className="w-full min-h-[8rem] px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white/70">
                  <Markdown content={note} className="text-slate-700" />
                </div>
              ) : (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={8}
                  placeholder="Write the personalized thank-you message…"
                  className={inputClass}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  disabled={note.trim() === ""}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white/70 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Copy the message as plain text for pasting into Postable"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy message
                </button>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  disabled={mailingName.trim() === "" && address.trim() === ""}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white/70 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Copy the recipient name and mailing address"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Copy name & address
                </button>
                {postableProjectUrl && (
                  <a
                    href={postableProjectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-fuchsia-700 bg-white/70 hover:bg-white border border-fuchsia-200 rounded-lg px-2.5 py-1.5 transition-colors"
                    title="Open the shared Postable project in a new tab"
                  >
                    Open Postable
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saving}
                className="min-w-[5.5rem] text-center px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-lg hover:from-indigo-500 hover:to-indigo-700 transition-colors shadow-sm shadow-indigo-600/25 ring-1 ring-inset ring-white/10 disabled:opacity-50"
              >
                {saving ? "Saving…" : dirty ? "Save card" : "Saved"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
