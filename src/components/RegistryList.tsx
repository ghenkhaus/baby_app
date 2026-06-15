import type { RegistryItem, SortField, SortDirection } from "../types";
import { CategoryGroup } from "./CategoryGroup";
import { ItemCard } from "./ItemCard";
import { EmptyState } from "./EmptyState";
import { Markdown } from "./Markdown";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "price", label: "Price" },
  { value: "category", label: "Category" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "registry", label: "Registry" },
  { value: "registrationStatus", label: "Mfg Registration" },
  { value: "createdAt", label: "Date Added" },
];

const TABLE_COLUMNS: { field: SortField; label: string; className: string }[] = [
  { field: "name", label: "Name", className: "text-left" },
  { field: "category", label: "Category", className: "text-left hidden sm:table-cell" },
  { field: "price", label: "Price", className: "text-right" },
  { field: "status", label: "Status", className: "text-left hidden md:table-cell" },
  { field: "priority", label: "Priority", className: "text-left hidden lg:table-cell" },
  { field: "registry", label: "Registry", className: "text-left hidden md:table-cell" },
  { field: "registrationStatus", label: "Mfg Reg", className: "text-left hidden xl:table-cell" },
];

interface RegistryListProps {
  groupedItems: Record<string, RegistryItem[]>;
  sortedItems: RegistryItem[];
  categories: string[];
  registries: string[];
  hasFilters: boolean;
  viewMode: "grouped" | "flat" | "table";
  sortField: SortField;
  sortDirection: SortDirection;
  onViewModeChange: (mode: "grouped" | "flat" | "table") => void;
  onSortFieldChange: (field: SortField) => void;
  onSortDirectionChange: (dir: SortDirection) => void;
  onClearFilters: () => void;
  onEditItem: (item: RegistryItem) => void;
  onDeleteItem: (id: string) => void;
  onQuickRegistryChange: (id: string, registry: string) => void;
}

function SortArrow({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (field !== sortField) return <span className="text-slate-300 ml-1">&#8597;</span>;
  return (
    <span className="ml-1 text-indigo-600">
      {sortDirection === "asc" ? "\u25B2" : "\u25BC"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="text-slate-300 text-xs">—</span>;
  const cls =
    status === "Decided"
      ? "bg-green-50 text-green-700 ring-green-200/70"
      : status === "Purchased"
        ? "bg-purple-50 text-purple-700 ring-purple-200/70"
        : status === "Received"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
          : status === "Not Needed"
            ? "bg-slate-50 text-slate-500 ring-slate-200/70"
            : "bg-amber-50 text-amber-700 ring-amber-200/70";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (!priority) return <span className="text-slate-300 text-xs">—</span>;
  const isNec = priority === "Necessary";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${isNec ? "text-rose-600" : "text-blue-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isNec ? "bg-rose-500 ring-2 ring-rose-100" : "bg-blue-500 ring-2 ring-blue-100"}`} />
      {priority}
    </span>
  );
}

function RegistryBadge({ registry }: { registry: string }) {
  if (!registry) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-md text-[11px] font-medium bg-white text-teal-700 ring-1 ring-inset ring-teal-300/70 shadow-sm">
      <svg className="w-3 h-3 -ml-0.5" fill="currentColor" stroke="none" viewBox="0 0 24 24">
        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
      {registry}
    </span>
  );
}

function RegistrationBadge({ status }: { status: string }) {
  if (!status) return <span className="text-slate-300 text-xs">—</span>;
  const isRegistered = status === "Registered";
  const isPending = status === "Needs Registration";
  const colorCls = isRegistered
    ? "text-green-600"
    : isPending
      ? "text-orange-600"
      : "text-slate-500";
  const dotCls = isRegistered
    ? "bg-green-500 ring-2 ring-green-100"
    : isPending
      ? "bg-orange-500 ring-2 ring-orange-100"
      : "bg-slate-400 ring-2 ring-slate-100";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${colorCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
      {status}
    </span>
  );
}

export function RegistryList({
  groupedItems,
  sortedItems,
  categories,
  registries,
  hasFilters,
  viewMode,
  sortField,
  sortDirection,
  onViewModeChange,
  onSortFieldChange,
  onSortDirectionChange,
  onClearFilters,
  onEditItem,
  onDeleteItem,
  onQuickRegistryChange,
}: RegistryListProps) {
  const orderedCategories = categories.filter((cat) => groupedItems[cat]);
  const isEmpty = viewMode === "grouped" ? orderedCategories.length === 0 : sortedItems.length === 0;

  const handleColumnSort = (field: SortField) => {
    if (sortField === field) {
      onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc");
    } else {
      onSortFieldChange(field);
      onSortDirectionChange("asc");
    }
  };

  return (
    <div>
      {/* View & Sort Controls */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        {/* View toggle */}
        <div className="inline-flex rounded-xl bg-slate-100/80 ring-1 ring-inset ring-slate-200/60 p-0.5">
          <button
            onClick={() => onViewModeChange("grouped")}
            className={`px-2.5 sm:px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              viewMode === "grouped"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/60"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="hidden sm:inline">Grouped</span>
            </span>
          </button>
          <button
            onClick={() => onViewModeChange("flat")}
            className={`px-2.5 sm:px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              viewMode === "flat"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/60"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">Cards</span>
            </span>
          </button>
          <button
            onClick={() => onViewModeChange("table")}
            className={`px-2.5 sm:px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              viewMode === "table"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/60"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18M10 6v12M17 6v12" />
              </svg>
              <span className="hidden sm:inline">Table</span>
            </span>
          </button>
        </div>

        {/* Sort controls (hidden in table mode since columns are clickable) */}
        {viewMode !== "table" && (
          <>
            <span className="text-xs sm:text-sm font-medium text-slate-500">Sort:</span>
            <select
              value={sortField}
              onChange={(e) => onSortFieldChange(e.target.value as SortField)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-xl bg-white/80 backdrop-blur text-slate-700 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc")}
              className="p-1.5 border border-slate-200 rounded-xl bg-white/80 backdrop-blur hover:bg-white hover:border-slate-300 transition-all"
              title={sortDirection === "asc" ? "Ascending" : "Descending"}
            >
              <svg
                className={`w-4 h-4 text-slate-600 transition-transform ${sortDirection === "desc" ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            </button>
          </>
        )}
      </div>

      {isEmpty ? (
        <EmptyState hasFilters={hasFilters} onClearFilters={onClearFilters} />
      ) : viewMode === "grouped" ? (
        <div>
          {orderedCategories.map((category) => (
            <CategoryGroup
              key={category}
              category={category}
              items={groupedItems[category]}
              registries={registries}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
              onQuickRegistryChange={onQuickRegistryChange}
            />
          ))}
        </div>
      ) : viewMode === "table" ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/70 shadow-sm shadow-slate-900/[0.03] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/70 bg-slate-50/50">
                {TABLE_COLUMNS.map((col) => (
                  <th
                    key={col.field}
                    onClick={() => handleColumnSort(col.field)}
                    className={`px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap ${col.className}`}
                  >
                    {col.label}
                    <SortArrow field={col.field} sortField={sortField} sortDirection={sortDirection} />
                  </th>
                ))}
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onEditItem(item)}
                  className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt=""
                          loading="lazy"
                          className="w-7 h-7 object-contain rounded-lg bg-slate-50 ring-1 ring-slate-100 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <div className="font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-[300px]">
                        {item.name}
                      </div>
                    </div>
                    {item.notes && (
                      <div className="max-w-[200px] sm:max-w-[300px] mt-0.5">
                        <Markdown content={item.notes} className="text-xs text-slate-400" truncate />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <span className="text-slate-600">{item.category}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-800 whitespace-nowrap tabular-nums">
                    {item.price > 0 ? formatPrice(item.price) : "—"}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell">
                    <PriorityBadge priority={item.priority} />
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    <RegistryBadge registry={item.registry} />
                  </td>
                  <td className="px-3 py-3 hidden xl:table-cell">
                    <RegistrationBadge status={item.registrationStatus} />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {sortedItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              registries={registries}
              onEdit={onEditItem}
              onDelete={onDeleteItem}
              onQuickRegistryChange={onQuickRegistryChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
