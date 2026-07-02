import { useMemo, useState } from "react";
import type { Person } from "../types";
import { effectiveContributionAmount } from "../types";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

interface PeopleViewProps {
  people: Person[];
  onOpenPerson: (id: string) => void;
}

type SortField = "name" | "items" | "total";
type SortDirection = "asc" | "desc";

export function PeopleView({ people, onOpenPerson }: PeopleViewProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Members per card (so we can render "shared with…" chips)
  const cardMembers = useMemo(() => {
    const m = new Map<string, Person[]>();
    for (const p of people) {
      const list = m.get(p.thankYouCardId) ?? [];
      list.push(p);
      m.set(p.thankYouCardId, list);
    }
    return m;
  }, [people]);

  const rows = useMemo(() => {
    return people.map((p) => {
      const total = p.contributions.reduce(
        (sum, c) => sum + (effectiveContributionAmount(c) ?? 0),
        0
      );
      const otherMembers = (cardMembers.get(p.thankYouCardId) ?? []).filter(
        (m) => m.id !== p.id
      );
      return {
        person: p,
        itemCount: p.contributions.length,
        total,
        otherMembers,
      };
    });
  }, [people, cardMembers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.person.name.toLowerCase().includes(q) ||
        r.person.email.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.person.name.localeCompare(b.person.name);
          break;
        case "items":
          cmp = a.itemCount - b.itemCount;
          break;
        case "total":
          cmp = a.total - b.total;
          break;
      }
      // Tie-break on name so the order is stable
      if (cmp === 0) cmp = a.person.name.localeCompare(b.person.name);
      return cmp * dir;
    });
  }, [filtered, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  if (people.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/70 p-10 text-center shadow-sm shadow-slate-900/[0.03]">
        <p className="text-base font-semibold text-slate-800">No people yet</p>
        <p className="text-sm text-slate-500 mt-1">
          Use the "Add Person" or "Bulk Add" buttons to start tracking invitees and gift-givers.
        </p>
      </div>
    );
  }

  return (
    <div>
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
            placeholder="Search people…"
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
                    label="Name"
                    field="name"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className="text-left pl-4 pr-2 py-2.5"
                  />
                  <SortHeader
                    label="Items"
                    field="items"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className="text-right px-2 py-2.5 w-20"
                  />
                  <SortHeader
                    label="Total"
                    field="total"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className="text-right px-2 py-2.5 w-28"
                  />
                  <th className="text-left px-2 py-2.5">Linked</th>
                  <th className="w-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(({ person, itemCount, total, otherMembers }) => (
                  <tr
                    key={person.id}
                    onClick={() => onOpenPerson(person.id)}
                    className="cursor-pointer hover:bg-indigo-50/40 transition-colors group"
                  >
                    <td className="pl-4 pr-2 py-2.5 min-w-0">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 truncate">
                          {person.name}
                        </span>
                        {person.email && (
                          <span className="text-xs text-slate-400 truncate">
                            {person.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {itemCount}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {total > 0 ? formatPrice(total) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5 min-w-0">
                      {otherMembers.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {otherMembers.slice(0, 3).map((m) => (
                            <span
                              key={m.id}
                              className="text-[11px] font-medium text-fuchsia-700 bg-fuchsia-50 rounded-full px-1.5 py-0.5 ring-1 ring-inset ring-fuchsia-200/70"
                            >
                              {m.name}
                            </span>
                          ))}
                          {otherMembers.length > 3 && (
                            <span className="text-[11px] text-fuchsia-700">
                              +{otherMembers.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="pr-3 pl-1 py-2.5 text-slate-300 group-hover:text-slate-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
