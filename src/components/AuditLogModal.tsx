import { useState, useEffect, useCallback } from "react";
import type { AuditLogEntry } from "../types";
import { api } from "../utils/api";

interface AuditLogModalProps {
  onClose: () => void;
}

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-green-50 text-green-700 ring-green-200/70",
  UPDATE: "bg-blue-50 text-blue-700 ring-blue-200/70",
  DELETE: "bg-rose-50 text-rose-700 ring-rose-200/70",
  IMPORT: "bg-purple-50 text-purple-700 ring-purple-200/70",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  category: "Category",
  status: "Status",
  priority: "Priority",
  price: "Price",
  link: "Link",
  notes: "Notes",
  registry: "Registry",
  imageUrl: "Image",
  productName: "Product Name",
  email: "Email",
  contributor: "Contributor",
  contributor_amount: "Contribution amount",
  thankYouCardId: "Thank-you card",
  label: "Card label",
  mailingName: "Mailing name",
  address: "Address",
  note: "Note",
  sentAt: "Sent date",
  postableProjectUrl: "Postable project URL",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function groupByTimestamp(entries: AuditLogEntry[]): AuditLogEntry[][] {
  const groups: AuditLogEntry[][] = [];
  let current: AuditLogEntry[] = [];
  for (const entry of entries) {
    if (current.length > 0 && (current[0].changedAt !== entry.changedAt || current[0].entityId !== entry.entityId || current[0].action !== entry.action)) {
      groups.push(current);
      current = [];
    }
    current.push(entry);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function EntryGroup({ entries }: { entries: AuditLogEntry[] }) {
  const first = entries[0];
  const actionStyle = ACTION_STYLES[first.action] || "bg-slate-50 text-slate-700 ring-slate-200/70";

  const entityLabel = first.entityType === "import"
    ? "Bulk Import"
    : first.entityType === "category"
      ? `Category: ${first.entityId ?? ""}`
      : first.entityType === "person"
        ? `Person: ${first.entityName ?? first.entityId?.slice(0, 8) ?? ""}`
        : first.entityType === "thank_you_card"
          ? "Thank-you card"
          : first.entityType === "settings"
            ? "Settings"
            : first.entityName ?? first.entityId?.slice(0, 8) ?? "Unknown";

  return (
    <div className="flex gap-3 py-3">
      <div className="shrink-0 pt-0.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ring-inset ${actionStyle}`}>
          {first.action}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-sm text-slate-900 truncate">{entityLabel}</span>
          <span className="text-xs text-slate-400">{formatDate(first.changedAt)}</span>
        </div>
        {first.action === "UPDATE" && entries.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {entries.map((e) => (
              <div key={e.id} className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">{FIELD_LABELS[e.fieldName ?? ""] ?? e.fieldName}</span>
                {": "}
                <span className="text-rose-400 line-through">{truncateValue(e.oldValue)}</span>
                {" → "}
                <span className="text-green-600">{truncateValue(e.newValue)}</span>
              </div>
            ))}
          </div>
        )}
        {first.action === "IMPORT" && first.newValue && (
          <p className="text-xs text-slate-500 mt-0.5">{first.newValue}</p>
        )}
        <p className="text-xs text-slate-400 mt-0.5">{first.actor || "unknown"}</p>
      </div>
    </div>
  );
}

function truncateValue(val: string | null): string {
  if (!val) return "(empty)";
  return val.length > 60 ? val.slice(0, 57) + "..." : val;
}

export function AuditLogModal({ onClose }: AuditLogModalProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const loadMore = useCallback(async (offset: number) => {
    try {
      const batch = await api.getAuditLog(50, offset);
      if (offset === 0) {
        setEntries(batch);
      } else {
        setEntries((prev) => [...prev, ...batch]);
      }
      setHasMore(batch.length === 50);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMore(0);
  }, [loadMore]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const groups = groupByTimestamp(entries);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm sm:p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 w-full sm:max-w-2xl max-h-[90vh] flex flex-col animate-[slideInUp_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Audit Log</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 sm:p-6">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Loading...</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No changes recorded yet</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {groups.map((group) => (
                <EntryGroup key={group[0].id} entries={group} />
              ))}
            </div>
          )}

          {hasMore && !loading && (
            <div className="text-center pt-4">
              <button
                onClick={() => loadMore(entries.length)}
                className="px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 rounded-xl hover:bg-indigo-100 ring-1 ring-inset ring-indigo-200/70 transition-colors"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
