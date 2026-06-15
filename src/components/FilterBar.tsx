import type { Filters } from "../types";

interface FilterBarProps {
  filters: Filters;
  onFilterChange: (update: Partial<Filters>) => void;
  onOpenSidebar: () => void;
}

export function FilterBar({ filters, onFilterChange, onOpenSidebar }: FilterBarProps) {
  const activeFilterCount = [
    filters.status.length > 0,
    filters.priority.length > 0,
    filters.category.length > 0,
    filters.registry.length > 0,
    filters.link !== "All",
  ].filter(Boolean).length;

  return (
    <div className="mb-2 sm:mb-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0 group">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Search items..."
            className="w-full pl-10 pr-3 py-2 sm:py-2 text-sm border border-slate-200 rounded-xl bg-white/80 backdrop-blur text-slate-800 placeholder:text-slate-400 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Mobile-only Filters button — opens sidebar drawer */}
        <button
          onClick={onOpenSidebar}
          className="lg:hidden flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white/80 backdrop-blur border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-white transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-gradient-to-b from-indigo-500 to-indigo-600 text-white text-[11px] font-semibold rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
