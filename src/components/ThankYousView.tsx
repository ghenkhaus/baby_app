import { useMemo, useState } from "react";
import type { AppSettings, Person, ThankYouCard, ThankYouCardStatus } from "../types";
import { effectiveContributionAmount } from "../types";
import { THANK_YOU_STATUSES, STATUS_META, formatSentDate } from "../utils/thankYouStatus";
import { markdownToPlainText, copyText } from "../utils/markdownToPlainText";
import { HintSpeedRun } from "./HintSpeedRun";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

interface ThankYousViewProps {
  cards: ThankYouCard[];
  people: Person[];
  settings: AppSettings;
  onOpenCard: (id: string) => void;
  onUpdateCard: (
    id: string,
    updates: Partial<{ label: string; mailingName: string; address: string; note: string; hint: string; status: ThankYouCardStatus }>
  ) => Promise<ThankYouCard>;
  onUpdateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>;
  onToast: (message: string, type: "success" | "error") => void;
}

type SortField = "recipient" | "gifts" | "total" | "status" | "sent";
type SortDirection = "asc" | "desc";

interface CardRowData {
  card: ThankYouCard;
  members: Person[];
  recipient: string;
  giftCount: number;
  total: number;
  hasAddress: boolean;
}

export function ThankYousView({
  cards,
  people,
  settings,
  onOpenCard,
  onUpdateCard,
  onUpdateSettings,
  onToast,
}: ThankYousViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ThankYouCardStatus | null>(null);
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);
  const [speedRun, setSpeedRun] = useState(false);

  const rows = useMemo<CardRowData[]>(() => {
    const membersByCard = new Map<string, Person[]>();
    for (const p of people) {
      const list = membersByCard.get(p.thankYouCardId) ?? [];
      list.push(p);
      membersByCard.set(p.thankYouCardId, list);
    }
    return cards.map((card) => {
      const members = membersByCard.get(card.id) ?? [];
      // Dedupe gifts by item (couples on one card may co-contribute the same
      // item), but count each person's dollars toward the total.
      const itemIds = new Set<string>();
      let total = 0;
      for (const m of members) {
        for (const c of m.contributions) {
          itemIds.add(c.itemId);
          total += effectiveContributionAmount(c) ?? 0;
        }
      }
      return {
        card,
        members,
        recipient:
          card.label || card.mailingName || members.map((m) => m.name).join(" & ") || "(no name)",
        giftCount: itemIds.size,
        total: Math.round(total * 100) / 100,
        hasAddress: card.address.trim() !== "",
      };
    });
  }, [cards, people]);

  const statusCounts = useMemo(() => {
    const counts: Record<ThankYouCardStatus, number> = {
      "": 0,
      "Drafted": 0,
      "Ready to Send": 0,
      "Sent": 0,
    };
    for (const r of rows) counts[r.card.status]++;
    return counts;
  }, [rows]);

  const sentCount = statusCounts["Sent"];

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilter !== null) {
      out = out.filter((r) => r.card.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (r) =>
          r.recipient.toLowerCase().includes(q) ||
          r.card.mailingName.toLowerCase().includes(q) ||
          r.card.address.toLowerCase().includes(q) ||
          r.members.some((m) => m.name.toLowerCase().includes(q))
      );
    }
    return out;
  }, [rows, statusFilter, search]);

  const sorted = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "recipient":
          cmp = a.recipient.localeCompare(b.recipient);
          break;
        case "gifts":
          cmp = a.giftCount - b.giftCount;
          break;
        case "total":
          cmp = a.total - b.total;
          break;
        case "status":
          cmp = STATUS_META[a.card.status].rank - STATUS_META[b.card.status].rank;
          break;
        case "sent": {
          // Nulls last in both directions.
          const sa = a.card.sentAt;
          const sb = b.card.sentAt;
          if (sa === null && sb === null) cmp = 0;
          else if (sa === null) return 1;
          else if (sb === null) return -1;
          else cmp = sa.localeCompare(sb);
          break;
        }
      }
      if (cmp === 0) cmp = a.recipient.localeCompare(b.recipient);
      return cmp * dir;
    });
  }, [filtered, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "recipient" || field === "status" ? "asc" : "desc");
    }
  };

  const handleSaveUrl = async () => {
    if (savingUrl) return;
    setSavingUrl(true);
    try {
      await onUpdateSettings({ postableProjectUrl: urlDraft.trim() });
      setEditingUrl(false);
      onToast(urlDraft.trim() ? "Postable project link saved" : "Postable project link cleared", "success");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to save URL", "error");
    } finally {
      setSavingUrl(false);
    }
  };

  const handleCopyMessage = async (row: CardRowData) => {
    const text = markdownToPlainText(row.card.note);
    if (!text) return;
    const ok = await copyText(text);
    onToast(
      ok ? `Message for ${row.recipient} copied as plain text` : "Couldn't copy — clipboard unavailable",
      ok ? "success" : "error"
    );
  };

  const handleCopyAddress = async (row: CardRowData) => {
    const text = `${row.card.mailingName || row.recipient}\n${row.card.address}`.trim();
    if (!text) return;
    const ok = await copyText(text);
    onToast(ok ? `Address for ${row.recipient} copied` : "Couldn't copy — clipboard unavailable", ok ? "success" : "error");
  };

  const handleMarkSent = async (row: CardRowData) => {
    try {
      await onUpdateCard(row.card.id, { status: "Sent" });
      onToast(`Marked ${row.recipient} as sent`, "success");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Failed to update status", "error");
    }
  };

  if (cards.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/70 p-10 text-center shadow-sm shadow-slate-900/[0.03]">
        <p className="text-base font-semibold text-slate-800">No thank-you cards yet</p>
        <p className="text-sm text-slate-500 mt-1">
          Cards are created automatically when you add people on the People tab.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Progress + Postable project */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-semibold text-slate-800 tabular-nums">
            {sentCount} of {rows.length} sent
          </p>
          <button
            type="button"
            onClick={() => setSpeedRun(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-white/70 hover:bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 transition-colors"
            title="Step through cards and add personal touches for Claude to use when drafting"
          >
            ⚡ Personalize
          </button>
        </div>
        {editingUrl ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveUrl();
              }}
              placeholder="https://www.postable.com/…"
              autoFocus
              className="w-64 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white/80 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleSaveUrl}
              disabled={savingUrl}
              className="px-2.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-lg hover:from-indigo-500 hover:to-indigo-700 transition-all disabled:opacity-50"
            >
              {savingUrl ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditingUrl(false)}
              className="px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        ) : settings.postableProjectUrl ? (
          <div className="flex items-center gap-1">
            <a
              href={settings.postableProjectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-fuchsia-700 bg-white/70 hover:bg-white border border-fuchsia-200 rounded-lg px-2.5 py-1.5 transition-colors"
              title="Open the shared Postable project (same card design for everyone)"
            >
              Open Postable project
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <button
              type="button"
              onClick={() => {
                setUrlDraft(settings.postableProjectUrl);
                setEditingUrl(true);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Edit Postable project link"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setUrlDraft("");
              setEditingUrl(true);
            }}
            className="text-xs font-medium text-slate-600 bg-white/70 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            Set Postable project link…
          </button>
        )}
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => setStatusFilter(null)}
          className={`px-2.5 py-1 text-xs font-medium rounded-full ring-1 ring-inset transition-colors ${
            statusFilter === null
              ? "bg-slate-800 text-white ring-slate-800"
              : "bg-white/70 text-slate-600 ring-slate-200/70 hover:bg-white"
          }`}
        >
          All <span className="tabular-nums opacity-70">{rows.length}</span>
        </button>
        {THANK_YOU_STATUSES.map((s) => {
          const meta = STATUS_META[s];
          const active = statusFilter === s;
          return (
            <button
              key={s || "not-started"}
              type="button"
              onClick={() => setStatusFilter(active ? null : s)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full ring-1 ring-inset transition-colors ${
                active ? meta.pillActive : `${meta.pill} hover:brightness-95`
              }`}
            >
              {meta.label} <span className="tabular-nums opacity-70">{statusCounts[s]}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards…"
            className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 backdrop-blur text-slate-800 placeholder:text-slate-400 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500 px-2 py-6 text-center">No matches.</p>
      ) : (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 shadow-sm shadow-slate-900/[0.03] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <SortHeader
                    label="Recipient"
                    field="recipient"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className="text-left pl-4 pr-2 py-2.5"
                  />
                  <SortHeader
                    label="Gifts"
                    field="gifts"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className="text-right px-2 py-2.5 w-16"
                  />
                  <SortHeader
                    label="Total"
                    field="total"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className="text-right px-2 py-2.5 w-24"
                  />
                  <th className="text-left px-2 py-2.5 w-24">Address</th>
                  <SortHeader
                    label="Status"
                    field="status"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className="text-left px-2 py-2.5 w-36"
                  />
                  <SortHeader
                    label="Sent"
                    field="sent"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className="text-left px-2 py-2.5 w-28"
                  />
                  <th className="text-right pr-3 pl-2 py-2.5 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((row) => {
                  const { card } = row;
                  const meta = STATUS_META[card.status];
                  return (
                    <tr
                      key={card.id}
                      onClick={() => onOpenCard(card.id)}
                      className="cursor-pointer hover:bg-indigo-50/40 transition-colors group"
                    >
                      <td className="pl-4 pr-2 py-2.5 min-w-0">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-900 truncate">{row.recipient}</span>
                          {row.members.length > 1 && (
                            <div className="flex flex-wrap items-center gap-1">
                              {row.members.slice(0, 3).map((m) => (
                                <span
                                  key={m.id}
                                  className="text-[11px] font-medium text-fuchsia-700 bg-fuchsia-50 rounded-full px-1.5 py-0.5 ring-1 ring-inset ring-fuchsia-200/70"
                                >
                                  {m.name}
                                </span>
                              ))}
                              {row.members.length > 3 && (
                                <span className="text-[11px] text-fuchsia-700">
                                  +{row.members.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                        {row.giftCount > 0 ? row.giftCount : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                        {row.total > 0 ? formatPrice(row.total) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs ${
                            row.hasAddress ? "text-emerald-700" : "text-slate-400"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              row.hasAddress ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          />
                          {row.hasAddress ? "Yes" : "Missing"}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs ${meta.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {card.sentAt ? formatSentDate(card.sentAt) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="pr-3 pl-2 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyMessage(row);
                            }}
                            disabled={card.note.trim() === ""}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title="Copy message (plain text)"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyAddress(row);
                            }}
                            disabled={card.mailingName.trim() === "" && card.address.trim() === ""}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title="Copy name & address"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>
                          {(card.status === "Drafted" || card.status === "Ready to Send") && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkSent(row);
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Mark as sent"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {speedRun && (
        <HintSpeedRun
          rows={sorted}
          onUpdateCard={onUpdateCard}
          onClose={() => setSpeedRun(false)}
          onToast={onToast}
        />
      )}
    </div>
  );
}

function SortHeader({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-slate-700 transition-colors ${
          active ? "text-slate-700" : ""
        }`}
      >
        {label}
        <svg
          className={`w-3 h-3 transition-transform ${
            active ? (sortDirection === "asc" ? "rotate-180" : "") : "opacity-30"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </th>
  );
}
