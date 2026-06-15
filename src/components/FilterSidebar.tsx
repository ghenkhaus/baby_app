import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Filters, LinkFilter, Person, PriceRange, StatusStage } from "../types";

const STAGE_OPTIONS: { value: StatusStage; label: string; description: string }[] = [
  { value: "Action Required", label: "Action Required", description: "No Status · Researching" },
  { value: "Done", label: "Done", description: "Decided · Purchased · Not Needed" },
];

const STAGE_DOT_CLASS: Record<StatusStage, string> = {
  "Action Required": "bg-amber-500",
  Done: "bg-green-500",
};

function StageDot({ value }: { value: StatusStage }) {
  const color = STAGE_DOT_CLASS[value] ?? "bg-slate-300";
  return <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />;
}

const STATUS_OPTIONS = [
  { value: "", label: "No Status" },
  { value: "Researching", label: "Researching" },
  { value: "Decided", label: "Decided" },
  { value: "Purchased", label: "Purchased" },
  { value: "Received", label: "Received" },
  { value: "Not Needed", label: "Not Needed" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "No Priority" },
  { value: "Necessary", label: "Necessary" },
  { value: "Nice to Have", label: "Nice to Have" },
];

const REGISTRATION_STATUS_OPTIONS = [
  { value: "", label: "Not Set" },
  { value: "Needs Registration", label: "Needs Registration" },
  { value: "Registered", label: "Registered" },
  { value: "N/A", label: "N/A" },
];

const LINK_OPTIONS: { value: LinkFilter; label: string }[] = [
  { value: "All", label: "Any" },
  { value: "Has Link", label: "Has Link" },
  { value: "No Link", label: "No Link" },
];

interface AttributeCounts {
  stage: Record<StatusStage, number>;
  status: Record<string, number>;
  priority: Record<string, number>;
  category: Record<string, number>;
  registry: Record<string, number>;
  registrationStatus: Record<string, number>;
  contributor: Record<string, number>;
  hasLink: number;
  noLink: number;
  total: number;
}

interface FilterSidebarProps {
  filters: Filters;
  categories: string[];
  registries: string[];
  people: Person[];
  priceBounds: { min: number; max: number };
  attributeCounts: AttributeCounts;
  onFilterChange: (update: Partial<Filters>) => void;
  onClearFilters: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

function CheckboxRow({
  label,
  subLabel,
  checked,
  onToggle,
  leading,
  count,
}: {
  label: string;
  subLabel?: string;
  checked: boolean;
  onToggle: () => void;
  leading?: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={subLabel}
      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
        checked
          ? "bg-indigo-50/70 text-indigo-700 font-medium"
          : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0 ${
          checked ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white"
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      {leading}
      <span className="flex-1 min-w-0">
        <span className="block truncate">{label}</span>
        {subLabel && (
          <span className={`block truncate text-[10px] ${checked ? "text-indigo-500/80" : "text-slate-400"}`}>
            {subLabel}
          </span>
        )}
      </span>
      {count !== undefined && (
        <span className={`text-[11px] tabular-nums shrink-0 ${count === 0 ? "text-slate-300" : "text-slate-400"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

const STATUS_DOT_CLASS: Record<string, string> = {
  "": "bg-slate-300",
  "Researching": "bg-amber-500",
  "Decided": "bg-green-500",
  "Purchased": "bg-purple-500",
  "Received": "bg-emerald-500",
  "Not Needed": "bg-slate-400",
};

function StatusDot({ value }: { value: string }) {
  const color = STATUS_DOT_CLASS[value] ?? "bg-slate-300";
  return <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />;
}

const PRIORITY_DOT_CLASS: Record<string, string> = {
  "": "bg-slate-300",
  "Necessary": "bg-rose-500",
  "Nice to Have": "bg-blue-500",
};

function PriorityDot({ value }: { value: string }) {
  const color = PRIORITY_DOT_CLASS[value] ?? "bg-slate-300";
  return <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />;
}

const REGISTRATION_STATUS_DOT_CLASS: Record<string, string> = {
  "": "bg-slate-300",
  "Needs Registration": "bg-orange-500",
  Registered: "bg-green-500",
  "N/A": "bg-slate-400",
};

function RegistrationStatusDot({ value }: { value: string }) {
  const color = REGISTRATION_STATUS_DOT_CLASS[value] ?? "bg-slate-300";
  return <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />;
}

function RadioRow({
  label,
  checked,
  onSelect,
  count,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
        checked
          ? "bg-indigo-50/70 text-indigo-700 font-medium"
          : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex items-center justify-center w-4 h-4 rounded-full border-2 transition-colors shrink-0 ${
          checked ? "border-indigo-600" : "border-slate-300"
        }`}
      >
        {checked && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
      </span>
      <span className="truncate flex-1">{label}</span>
      {count !== undefined && (
        <span className={`text-[11px] tabular-nums shrink-0 ${count === 0 ? "text-slate-300" : "text-slate-400"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function PriceRangeFilter({
  bounds,
  value,
  onChange,
}: {
  bounds: { min: number; max: number };
  value: PriceRange;
  onChange: (next: PriceRange) => void;
}) {
  const step = useMemo(() => {
    if (bounds.max <= 100) return 5;
    if (bounds.max <= 500) return 10;
    if (bounds.max <= 2000) return 25;
    return 50;
  }, [bounds.max]);

  const min = value.min ?? bounds.min;
  const max = value.max ?? bounds.max;
  const range = bounds.max - bounds.min || 1;
  const minPct = ((min - bounds.min) / range) * 100;
  const maxPct = ((max - bounds.min) / range) * 100;
  const isActive = value.min !== null || value.max !== null;

  const update = (next: PriceRange) => {
    const atDefault =
      (next.min === null || next.min === bounds.min) &&
      (next.max === null || next.max === bounds.max);
    onChange(atDefault ? { min: null, max: null } : next);
  };

  const handleMinChange = (raw: number) => {
    const clamped = Math.max(bounds.min, Math.min(raw, max));
    update({ min: clamped, max });
  };
  const handleMaxChange = (raw: number) => {
    const clamped = Math.min(bounds.max, Math.max(raw, min));
    update({ min, max: clamped });
  };

  if (bounds.max <= bounds.min) {
    return (
      <p className="px-2 py-1.5 text-xs text-slate-400">No priced items yet.</p>
    );
  }

  return (
    <div className="px-2 pt-1.5 pb-2 space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
        <span className={`font-semibold ${isActive ? "text-indigo-700" : "text-slate-600"}`}>
          ${min}
        </span>
        <span className="text-slate-400">to</span>
        <span className={`font-semibold ${isActive ? "text-indigo-700" : "text-slate-600"}`}>
          ${max}
        </span>
      </div>

      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-slate-200 rounded-full" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 bg-indigo-500 rounded-full"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={min}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          aria-label="Minimum price"
          className="price-range-thumb absolute inset-0 w-full appearance-none bg-transparent"
        />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={max}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          aria-label="Maximum price"
          className="price-range-thumb absolute inset-0 w-full appearance-none bg-transparent"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-md px-1.5 py-1 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200">
          <span className="text-[11px] text-slate-400 mr-0.5">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={bounds.min}
            max={max}
            value={min}
            onChange={(e) => handleMinChange(Number(e.target.value))}
            aria-label="Minimum price input"
            className="w-full text-xs tabular-nums bg-transparent outline-none"
          />
        </div>
        <span className="text-xs text-slate-400">–</span>
        <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-md px-1.5 py-1 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200">
          <span className="text-[11px] text-slate-400 mr-0.5">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={bounds.max}
            value={max}
            onChange={(e) => handleMaxChange(Number(e.target.value))}
            aria-label="Maximum price input"
            className="w-full text-xs tabular-nums bg-transparent outline-none"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange({ min: null, max: null })}
        disabled={!isActive}
        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-default"
      >
        Reset
      </button>
    </div>
  );
}

function BulkToggle({
  allValues,
  selected,
  onChange,
}: {
  allValues: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const allSelected =
    allValues.length > 0 && allValues.every((v) => selected.includes(v));
  const noneSelected = selected.length === 0;
  const btnClass =
    "text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-default";
  return (
    <div className="flex items-center gap-1 px-2 pb-1 -mt-0.5">
      <button
        type="button"
        onClick={() => onChange(allValues)}
        disabled={allSelected}
        className={btnClass}
      >
        Select all
      </button>
      <span className="text-slate-300 text-[10px]">·</span>
      <button
        type="button"
        onClick={() => onChange([])}
        disabled={noneSelected}
        className={btnClass}
      >
        Clear
      </button>
    </div>
  );
}

function FilterSection({
  title,
  icon,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: ReactNode;
  count: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  return (
    <div className="pb-1">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-md hover:bg-slate-100/70 transition-colors group"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0">
            {icon}
          </span>
          <h3 className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-700 uppercase tracking-wide">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {count > 0 && (
            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 rounded-full px-1.5 py-0.5 tabular-nums">
              {count}
            </span>
          )}
          <svg
            className={`w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-all ${collapsed ? "" : "rotate-90"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
      {!collapsed && <div className="space-y-0.5 mt-1 pb-1">{children}</div>}
    </div>
  );
}

const ICON_CLASS = "w-3.5 h-3.5";
const StageIcon = (
  <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h6" />
  </svg>
);
const StatusIcon = (
  <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const PriorityIcon = (
  <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
  </svg>
);
const CategoryIcon = (
  <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);
const RegistryIcon = (
  <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);
const RegistrationStatusIcon = (
  <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m1.5-7H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2.5" />
  </svg>
);
const ContributorIcon = (
  <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6 5.87v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2m12-12a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const LinkIcon = (
  <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);
const PriceIcon = (
  <svg className={ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export function FilterSidebar({
  filters,
  categories,
  registries,
  people,
  priceBounds,
  attributeCounts,
  onFilterChange,
  onClearFilters,
  isMobileOpen,
  onCloseMobile,
}: FilterSidebarProps) {
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseMobile();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileOpen, onCloseMobile]);

  const toggleMulti = (
    key: "stage" | "status" | "priority" | "category" | "registry" | "registrationStatus" | "contributor",
    value: string
  ) => {
    const list = filters[key] as string[];
    const next = list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
    onFilterChange({ [key]: next } as Partial<Filters>);
  };

  const priceActive = filters.price.min !== null || filters.price.max !== null;
  const hasActiveFilters =
    filters.stage.length > 0 ||
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    filters.category.length > 0 ||
    filters.registry.length > 0 ||
    filters.registrationStatus.length > 0 ||
    filters.contributor.length > 0 ||
    filters.link !== "All" ||
    priceActive;

  const content = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-2 pb-2.5 mb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h2 className="text-sm font-semibold text-slate-800 tracking-tight">Filters</h2>
        </div>
        <div className="flex items-center gap-1">
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 pb-1">
        <FilterSection title="Stage" icon={StageIcon} count={filters.stage.length} defaultOpen>
          <BulkToggle
            allValues={STAGE_OPTIONS.map((o) => o.value)}
            selected={filters.stage}
            onChange={(next) => onFilterChange({ stage: next as StatusStage[] })}
          />
          {STAGE_OPTIONS.map((opt) => (
            <CheckboxRow
              key={opt.value}
              label={opt.label}
              subLabel={opt.description}
              checked={filters.stage.includes(opt.value)}
              onToggle={() => toggleMulti("stage", opt.value)}
              leading={<StageDot value={opt.value} />}
              count={attributeCounts.stage[opt.value] ?? 0}
            />
          ))}
        </FilterSection>

        <FilterSection title="Status" icon={StatusIcon} count={filters.status.length}>
          <BulkToggle
            allValues={STATUS_OPTIONS.map((o) => o.value)}
            selected={filters.status}
            onChange={(next) => onFilterChange({ status: next })}
          />
          {STATUS_OPTIONS.map((opt) => (
            <CheckboxRow
              key={opt.value}
              label={opt.label}
              checked={filters.status.includes(opt.value)}
              onToggle={() => toggleMulti("status", opt.value)}
              leading={<StatusDot value={opt.value} />}
              count={attributeCounts.status[opt.value] ?? 0}
            />
          ))}
        </FilterSection>

        <FilterSection title="Priority" icon={PriorityIcon} count={filters.priority.length}>
          <BulkToggle
            allValues={PRIORITY_OPTIONS.map((o) => o.value)}
            selected={filters.priority}
            onChange={(next) => onFilterChange({ priority: next })}
          />
          {PRIORITY_OPTIONS.map((opt) => (
            <CheckboxRow
              key={opt.value}
              label={opt.label}
              checked={filters.priority.includes(opt.value)}
              onToggle={() => toggleMulti("priority", opt.value)}
              leading={<PriorityDot value={opt.value} />}
              count={attributeCounts.priority[opt.value] ?? 0}
            />
          ))}
        </FilterSection>

        <FilterSection title="Category" icon={CategoryIcon} count={filters.category.length}>
          <BulkToggle
            allValues={[...categories].sort((a, b) => a.localeCompare(b))}
            selected={filters.category}
            onChange={(next) => onFilterChange({ category: next })}
          />
          {[...categories].sort((a, b) => a.localeCompare(b)).map((cat) => (
            <CheckboxRow
              key={cat}
              label={cat}
              checked={filters.category.includes(cat)}
              onToggle={() => toggleMulti("category", cat)}
              count={attributeCounts.category[cat] ?? 0}
            />
          ))}
        </FilterSection>

        <FilterSection title="Registry" icon={RegistryIcon} count={filters.registry.length}>
          <BulkToggle
            allValues={["", ...registries]}
            selected={filters.registry}
            onChange={(next) => onFilterChange({ registry: next })}
          />
          <CheckboxRow
            label="Not on a Registry"
            checked={filters.registry.includes("")}
            onToggle={() => toggleMulti("registry", "")}
            count={attributeCounts.registry[""] ?? 0}
          />
          {registries.map((reg) => (
            <CheckboxRow
              key={reg}
              label={reg}
              checked={filters.registry.includes(reg)}
              onToggle={() => toggleMulti("registry", reg)}
              count={attributeCounts.registry[reg] ?? 0}
            />
          ))}
        </FilterSection>

        <FilterSection
          title="Mfg Registration"
          icon={RegistrationStatusIcon}
          count={filters.registrationStatus.length}
        >
          <BulkToggle
            allValues={REGISTRATION_STATUS_OPTIONS.map((o) => o.value)}
            selected={filters.registrationStatus}
            onChange={(next) => onFilterChange({ registrationStatus: next })}
          />
          {REGISTRATION_STATUS_OPTIONS.map((opt) => (
            <CheckboxRow
              key={opt.value}
              label={opt.label}
              checked={filters.registrationStatus.includes(opt.value)}
              onToggle={() => toggleMulti("registrationStatus", opt.value)}
              leading={<RegistrationStatusDot value={opt.value} />}
              count={attributeCounts.registrationStatus[opt.value] ?? 0}
            />
          ))}
        </FilterSection>

        {people.length > 0 && (
          <FilterSection
            title="Contributor"
            icon={ContributorIcon}
            count={filters.contributor.length}
          >
            <BulkToggle
              allValues={people.map((p) => p.id)}
              selected={filters.contributor}
              onChange={(next) => onFilterChange({ contributor: next })}
            />
            {[...people]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <CheckboxRow
                  key={p.id}
                  label={p.name}
                  checked={filters.contributor.includes(p.id)}
                  onToggle={() => toggleMulti("contributor", p.id)}
                  count={attributeCounts.contributor[p.id] ?? 0}
                />
              ))}
          </FilterSection>
        )}

        <FilterSection title="Price" icon={PriceIcon} count={priceActive ? 1 : 0}>
          <PriceRangeFilter
            bounds={priceBounds}
            value={filters.price}
            onChange={(next) => onFilterChange({ price: next })}
          />
        </FilterSection>

        <FilterSection title="Link" icon={LinkIcon} count={filters.link !== "All" ? 1 : 0}>
          {LINK_OPTIONS.map((opt) => {
            const linkCount =
              opt.value === "All"
                ? attributeCounts.total
                : opt.value === "Has Link"
                  ? attributeCounts.hasLink
                  : attributeCounts.noLink;
            return (
              <RadioRow
                key={opt.value}
                label={opt.label}
                checked={filters.link === opt.value}
                onSelect={() => onFilterChange({ link: opt.value })}
                count={linkCount}
              />
            );
          })}
        </FilterSection>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 shrink-0">
        <div className="sticky top-24 bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/70 p-3 shadow-sm shadow-slate-900/[0.03] max-h-[calc(100vh-7rem)] flex flex-col">
          {content}
        </div>
      </aside>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
            onClick={onCloseMobile}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 p-4 flex flex-col animate-[slideInLeft_200ms_ease-out]">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
