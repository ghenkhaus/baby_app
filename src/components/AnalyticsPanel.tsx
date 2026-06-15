import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Filters, PriceBucket } from "../types";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);

const HISTOGRAM_BAR_COLOR = "#8b5cf6";
const NO_PRICE_BAR_COLOR = "#cbd5e1";

const CARD_CLASS =
  "bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/70 mb-4 sm:mb-6 shadow-sm shadow-slate-900/[0.03]";

const toggleBtnClass =
  "text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded-md transition-colors uppercase tracking-wide";

const CATEGORY_COLORS = [
  "bg-gradient-to-r from-indigo-400 to-indigo-600",
  "bg-gradient-to-r from-emerald-400 to-emerald-600",
  "bg-gradient-to-r from-amber-400 to-amber-600",
  "bg-gradient-to-r from-rose-400 to-rose-600",
  "bg-gradient-to-r from-cyan-400 to-cyan-600",
  "bg-gradient-to-r from-violet-400 to-violet-600",
  "bg-gradient-to-r from-orange-400 to-orange-600",
  "bg-gradient-to-r from-teal-400 to-teal-600",
  "bg-gradient-to-r from-pink-400 to-pink-600",
  "bg-gradient-to-r from-lime-400 to-lime-600",
  "bg-gradient-to-r from-sky-400 to-sky-600",
  "bg-gradient-to-r from-fuchsia-400 to-fuchsia-600",
];

function progressBarColor(pct: number): string {
  if (pct >= 100) return "bg-gradient-to-r from-green-400 to-emerald-500";
  if (pct >= 75) return "bg-gradient-to-r from-emerald-400 to-emerald-600";
  if (pct >= 50) return "bg-gradient-to-r from-amber-400 to-amber-500";
  if (pct >= 25) return "bg-gradient-to-r from-orange-400 to-orange-500";
  return "bg-gradient-to-r from-rose-400 to-rose-500";
}

interface CategoryProgressStats {
  total: number;
  resolved: number;
  percentage: number;
}

type ViewMode = "progress" | "spending" | "distribution";

interface AnalyticsPanelProps {
  totalItems: number;
  totalPrice: number;
  priceHistogram: PriceBucket[];
  priceByCategory: Record<string, number>;
  categoryProgress: Record<string, CategoryProgressStats>;
  onFilterChange: (update: Partial<Filters>) => void;
}

export function AnalyticsPanel({
  totalItems,
  totalPrice,
  priceHistogram,
  priceByCategory,
  categoryProgress,
  onFilterChange,
}: AnalyticsPanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [view, setView] = useState<ViewMode>("progress");

  if (totalItems === 0) return null;

  const histogramData = priceHistogram.map((b) => ({
    ...b,
    fill: b.label === "No price" ? NO_PRICE_BAR_COLOR : HISTOGRAM_BAR_COLOR,
  }));

  const spendingEntries = Object.entries(priceByCategory).sort(
    ([, a], [, b]) => b - a
  );
  const progressEntries = Object.entries(categoryProgress).sort(
    ([, a], [, b]) => b.percentage - a.percentage || b.total - a.total
  );

  const summaryText = `${totalItems} ${
    totalItems === 1 ? "item" : "items"
  } · ${formatPrice(totalPrice)} total`;

  if (collapsed) {
    return (
      <div className={CARD_CLASS}>
        <div className="flex items-center gap-3 px-4 sm:px-5 py-2.5 sm:py-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Overview
            </span>
            <span className="text-xs sm:text-sm text-slate-700 tabular-nums truncate">
              {summaryText}
            </span>
          </div>
          <button
            onClick={() => setCollapsed(false)}
            className={toggleBtnClass}
            aria-expanded="false"
          >
            Expand
          </button>
        </div>
      </div>
    );
  }

  const segmentBtnClass = (active: boolean) =>
    `px-3 sm:px-3.5 py-1 text-xs sm:text-sm rounded-lg transition-all cursor-pointer ${
      active
        ? "bg-white text-slate-900 shadow-sm font-semibold ring-1 ring-slate-200/60"
        : "text-slate-500 hover:text-slate-800"
    }`;

  return (
    <div className={`relative ${CARD_CLASS} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3 sm:mb-4">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Overview
          </p>
          <p className="text-sm text-slate-600 tabular-nums">{summaryText}</p>
        </div>
        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Overview view"
            className="inline-flex bg-slate-100/80 rounded-xl p-0.5 ring-1 ring-inset ring-slate-200/50"
          >
            <button
              role="tab"
              aria-selected={view === "progress"}
              onClick={() => setView("progress")}
              className={segmentBtnClass(view === "progress")}
            >
              Progress
            </button>
            <button
              role="tab"
              aria-selected={view === "spending"}
              onClick={() => setView("spending")}
              className={segmentBtnClass(view === "spending")}
            >
              Spending
            </button>
            <button
              role="tab"
              aria-selected={view === "distribution"}
              onClick={() => setView("distribution")}
              className={segmentBtnClass(view === "distribution")}
            >
              <span className="hidden sm:inline">Price Distribution</span>
              <span className="sm:hidden">Distribution</span>
            </button>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className={toggleBtnClass}
            aria-expanded="true"
          >
            Collapse
          </button>
        </div>
      </div>

      {view === "progress" && progressEntries.length > 0 && (
        <div className="space-y-2 sm:space-y-2.5">
          {progressEntries.map(([cat, stats]) => (
            <div key={cat} className="flex items-center gap-2 sm:gap-3 group">
              <button
                onClick={() => onFilterChange({ category: [cat] })}
                className="w-20 sm:w-28 text-xs sm:text-sm text-slate-600 truncate shrink-0 text-left hover:text-indigo-600 cursor-pointer transition-colors font-medium"
                title={`Filter by ${cat}`}
              >
                {cat}
              </button>
              <div className="flex-1 h-2 sm:h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${progressBarColor(stats.percentage)} transition-all duration-700 shadow-sm`}
                  style={{ width: `${Math.max(stats.percentage, 2)}%` }}
                />
              </div>
              <div className="w-12 sm:w-14 text-[11px] sm:text-xs text-slate-400 text-right shrink-0 tabular-nums">
                {stats.resolved}/{stats.total}
              </div>
              <div className="w-12 sm:w-14 text-sm sm:text-base font-semibold text-slate-800 shrink-0 tabular-nums flex justify-end items-center">
                {stats.percentage >= 100 ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 ring-1 ring-inset ring-green-200" title="Complete">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <span>{stats.percentage}%</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "spending" && spendingEntries.length > 0 && (
        <div className="space-y-2 sm:space-y-2.5">
          {spendingEntries.map(([cat, price], i) => {
            const pct = totalPrice > 0 ? (price / totalPrice) * 100 : 0;
            return (
              <div key={cat} className="flex items-center gap-2 sm:gap-3 group">
                <button
                  onClick={() => onFilterChange({ category: [cat] })}
                  className="w-20 sm:w-28 text-xs sm:text-sm text-slate-600 truncate shrink-0 text-left hover:text-indigo-600 cursor-pointer transition-colors font-medium"
                  title={`Filter by ${cat}`}
                >
                  {cat}
                </button>
                <div className="flex-1 h-2 sm:h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} transition-all duration-700 shadow-sm`}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
                <div className="w-16 sm:w-20 text-xs sm:text-sm font-semibold text-slate-800 text-right shrink-0 tabular-nums">
                  {formatPrice(price)}
                </div>
                <div className="hidden sm:block w-10 text-xs text-slate-400 text-right shrink-0 tabular-nums">
                  {Math.round(pct)}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "distribution" && (
        <div className="h-56 sm:h-64">
          {histogramData.length === 0 ? (
            <p className="text-xs text-slate-400 h-full flex items-center justify-center">
              No items to chart.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={histogramData}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={48}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}
                  formatter={(value) => [`${Number(value)} items`, "Count"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {histogramData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
