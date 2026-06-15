import type { ThankYouCardStatus } from "../types";

export const THANK_YOU_STATUSES: ThankYouCardStatus[] = ["", "Drafted", "Ready to Send", "Sent"];

interface StatusMeta {
  label: string;
  /** Workflow order, used for sorting. */
  rank: number;
  /** Small status dot. */
  dot: string;
  /** Inline dot+label text color. */
  text: string;
  /** Rounded pill (filter buttons, badges). */
  pill: string;
  /** Pill style when selected/active. */
  pillActive: string;
}

export const STATUS_META: Record<ThankYouCardStatus, StatusMeta> = {
  "": {
    label: "Not Started",
    rank: 0,
    dot: "bg-slate-300",
    text: "text-slate-400",
    pill: "bg-slate-100/80 text-slate-600 ring-slate-200/70",
    pillActive: "bg-slate-600 text-white ring-slate-600",
  },
  "Drafted": {
    label: "Drafted",
    rank: 1,
    dot: "bg-amber-400",
    text: "text-amber-700",
    pill: "bg-amber-50 text-amber-700 ring-amber-200/70",
    pillActive: "bg-amber-500 text-white ring-amber-500",
  },
  "Ready to Send": {
    label: "Ready to Send",
    rank: 2,
    dot: "bg-sky-500",
    text: "text-sky-700",
    pill: "bg-sky-50 text-sky-700 ring-sky-200/70",
    pillActive: "bg-sky-500 text-white ring-sky-500",
  },
  "Sent": {
    label: "Sent",
    rank: 3,
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    pillActive: "bg-emerald-500 text-white ring-emerald-500",
  },
};

export function formatSentDate(sentAt: string | null): string {
  if (!sentAt) return "";
  const d = new Date(sentAt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
