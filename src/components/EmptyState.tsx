interface EmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
}

export function EmptyState({ hasFilters, onClearFilters }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200/70 shadow-sm shadow-slate-900/[0.03]">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 ring-1 ring-inset ring-white/60 mb-5 text-5xl">
        {hasFilters ? "🔍" : "🍼"}
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-1.5 tracking-tight">
        {hasFilters ? "No items match your filters" : "Your registry is empty"}
      </h2>
      <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">
        {hasFilters
          ? "Try adjusting your filters to see more items."
          : "Add your first item to get started!"}
      </p>
      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 rounded-xl hover:bg-indigo-100 ring-1 ring-inset ring-indigo-200/70 transition-colors"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
