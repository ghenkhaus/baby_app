import { useEffect, useMemo, useState } from "react";
import type { RegistryItem, AuditLogEntry, ItemStatus, Person } from "../types";
import { Markdown } from "./Markdown";
import { api } from "../utils/api";

const STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: "", label: "No Status" },
  { value: "Researching", label: "Researching" },
  { value: "Decided", label: "Decided" },
  { value: "Purchased", label: "Purchased" },
  { value: "Received", label: "Received" },
  { value: "Not Needed", label: "Not Needed" },
];

const STATUS_PILL_CLASS: Record<ItemStatus, string> = {
  "": "bg-slate-50 text-slate-500 ring-slate-200/70",
  Researching: "bg-amber-50 text-amber-700 ring-amber-200/70",
  Decided: "bg-green-50 text-green-700 ring-green-200/70",
  Purchased: "bg-purple-50 text-purple-700 ring-purple-200/70",
  Received: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  "Not Needed": "bg-slate-50 text-slate-500 ring-slate-200/70",
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

interface ItemDetailModalProps {
  item: RegistryItem;
  people: Person[];
  onClose: () => void;
  onEdit: (item: RegistryItem) => void;
  onDelete: (id: string) => void;
  onOpenPerson?: (id: string) => void;
  onUpdateContributors: (
    itemId: string,
    contributors: { personId: string; amount: number | null }[]
  ) => Promise<void>;
  onUpdateStatus: (itemId: string, status: ItemStatus) => Promise<void>;
  onAddPerson: (data: { name: string }) => Promise<Person>;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name", category: "Category", status: "Status", priority: "Priority",
  price: "Price", link: "Link", notes: "Notes", registry: "Registry",
  imageUrl: "Image", productName: "Product Name",
  registrationStatus: "Mfg Registration",
  contributor: "Contributor", contributor_amount: "Contribution amount",
  thankYouCardId: "Thank-you card", thankYouCard: "Thank-you card",
};

export function ItemDetailModal({
  item,
  people,
  onClose,
  onEdit,
  onDelete,
  onOpenPerson,
  onUpdateContributors,
  onUpdateStatus,
  onAddPerson,
}: ItemDetailModalProps) {
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [creatingPerson, setCreatingPerson] = useState(false);
  // Local draft of amount inputs so typing doesn't fight the server round-trip
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});

  const contribIds = useMemo(
    () => new Set(item.contributors.map((c) => c.personId)),
    [item.contributors]
  );
  const trimmedSearch = pickerSearch.trim();
  const availablePeople = useMemo(
    () => people.filter((p) => !contribIds.has(p.id)),
    [people, contribIds]
  );
  const filteredPeople = useMemo(() => {
    const q = trimmedSearch.toLowerCase();
    if (!q) return availablePeople;
    return availablePeople.filter((p) => p.name.toLowerCase().includes(q));
  }, [availablePeople, trimmedSearch]);
  const hasExactMatch = useMemo(
    () =>
      trimmedSearch !== "" &&
      people.some((p) => p.name.toLowerCase() === trimmedSearch.toLowerCase()),
    [people, trimmedSearch]
  );

  const apiContributors = (next: typeof item.contributors) =>
    next.map((c) => ({ personId: c.personId, amount: c.amount }));

  const handleAddContributor = async (personId: string, personName: string) => {
    if (contribIds.has(personId)) return;
    const next = [...item.contributors, { personId, personName, amount: null }];
    await onUpdateContributors(item.id, apiContributors(next));
  };

  const handleRemoveContributor = async (personId: string) => {
    const next = item.contributors.filter((c) => c.personId !== personId);
    await onUpdateContributors(item.id, apiContributors(next));
  };

  const commitAmount = async (personId: string, raw: string) => {
    const trimmed = raw.trim();
    let amount: number | null = null;
    if (trimmed) {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) return;
      amount = n;
    }
    const existing = item.contributors.find((c) => c.personId === personId);
    if (!existing || existing.amount === amount) return;
    const next = item.contributors.map((c) =>
      c.personId === personId ? { ...c, amount } : c
    );
    await onUpdateContributors(item.id, apiContributors(next));
  };

  const handleCreateAndAdd = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || creatingPerson) return;
    setCreatingPerson(true);
    try {
      const newPerson = await onAddPerson({ name: trimmed });
      await handleAddContributor(newPerson.id, newPerson.name);
      setPickerSearch("");
    } finally {
      setCreatingPerson(false);
    }
  };

  useEffect(() => {
    api.getItemHistory(item.id).then(setHistory).catch(() => {});
  }, [item.id]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm sm:p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto animate-[slideInUp_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        <div className="p-5 sm:p-7">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {item.name}
              </h2>
              {item.productName && (
                <p className="text-sm text-slate-500 mt-0.5">{item.productName}</p>
              )}
              <p className="text-xs text-slate-400 mt-1 inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {item.category}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onEdit(item)}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                title="Edit"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                title="Delete"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Product image */}
          {item.imageUrl && (
            <div className="mb-5 flex justify-center">
              <img
                src={item.imageUrl}
                alt={item.name}
                loading="lazy"
                className="max-h-48 sm:max-h-64 object-contain rounded-2xl bg-slate-50 ring-1 ring-slate-100 p-3"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}

          {/* Price */}
          {item.price > 0 && (
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4 tracking-tight tabular-nums">
              {formatPrice(item.price)}
            </p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 mb-5">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStatusPicker((s) => !s)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ring-1 ring-inset transition-colors hover:brightness-95 ${
                  STATUS_PILL_CLASS[item.status]
                }`}
                title="Change status"
              >
                {item.status || "No Status"}
                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showStatusPicker && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowStatusPicker(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 z-20 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 py-1.5 min-w-[180px] origin-top-left animate-[scaleIn_120ms_ease-out]">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={async () => {
                          setShowStatusPicker(false);
                          if (opt.value !== item.status) {
                            await onUpdateStatus(item.id, opt.value);
                          }
                        }}
                        className={`w-full text-left px-3 py-1.5 mx-1 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                          item.status === opt.value
                            ? "bg-indigo-50 text-indigo-700 font-medium"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {item.status === opt.value ? (
                          <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="w-4" />
                        )}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {item.priority ? (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${
                  item.priority === "Necessary" ? "text-rose-600" : "text-blue-600"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    item.priority === "Necessary" ? "bg-rose-500 ring-2 ring-rose-100" : "bg-blue-500 ring-2 ring-blue-100"
                  }`}
                />
                {item.priority}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-300 ring-2 ring-slate-100" />
                No Priority
              </span>
            )}
            {item.registry && (
              <span className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md text-sm font-medium bg-white text-teal-700 ring-1 ring-inset ring-teal-300/70 shadow-sm">
                <svg className="w-3.5 h-3.5" fill="currentColor" stroke="none" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {item.registry}
              </span>
            )}
            {item.registrationStatus ? (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${
                  item.registrationStatus === "Registered"
                    ? "text-green-600"
                    : item.registrationStatus === "Needs Registration"
                      ? "text-orange-600"
                      : "text-slate-500"
                }`}
                title="Manufacturer registration"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    item.registrationStatus === "Registered"
                      ? "bg-green-500 ring-2 ring-green-100"
                      : item.registrationStatus === "Needs Registration"
                        ? "bg-orange-500 ring-2 ring-orange-100"
                        : "bg-slate-400 ring-2 ring-slate-100"
                  }`}
                />
                Mfg Reg: {item.registrationStatus}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-300 ring-2 ring-slate-100" />
                No Mfg Reg
              </span>
            )}
          </div>

          {/* Link */}
          {item.link && (
            <div className="mb-5">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Link</h3>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                title={item.link}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 hover:underline max-w-full"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="truncate min-w-0">{item.link}</span>
              </a>
            </div>
          )}

          {/* Contributors */}
          <div className="mb-5">
            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Contributors
            </h3>
            {item.contributors.length === 0 && !showPicker && (
              <p className="text-sm text-slate-400 italic mb-2">
                No contributors yet.
              </p>
            )}
            {item.contributors.length > 0 && (
              <ul className="space-y-1 mb-2">
                {item.contributors.map((c) => {
                  const draft = amountDraft[c.personId];
                  const value =
                    draft !== undefined
                      ? draft
                      : c.amount === null
                        ? ""
                        : String(c.amount);
                  return (
                    <li
                      key={c.personId}
                      className="flex items-center gap-2 px-2 py-1 rounded-lg bg-fuchsia-50/60 ring-1 ring-inset ring-fuchsia-200/60"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 shrink-0" />
                      <button
                        type="button"
                        onClick={() => onOpenPerson?.(c.personId)}
                        className="text-sm font-medium text-fuchsia-700 hover:text-fuchsia-900 truncate flex-1 text-left"
                      >
                        {c.personName}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-fuchsia-500">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={value}
                          onChange={(e) =>
                            setAmountDraft((prev) => ({
                              ...prev,
                              [c.personId]: e.target.value,
                            }))
                          }
                          onBlur={async (e) => {
                            await commitAmount(c.personId, e.target.value);
                            setAmountDraft((prev) => {
                              const { [c.personId]: _drop, ...rest } = prev;
                              return rest;
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder="—"
                          className="w-16 px-1.5 py-0.5 text-xs tabular-nums bg-white border border-fuchsia-200 rounded-md focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-300 outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveContributor(c.personId)}
                        className="p-1 text-fuchsia-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors shrink-0"
                        title="Remove contributor"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {showPicker ? (
              <div className="border border-slate-200 rounded-xl bg-white/80 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-200 bg-slate-50/60">
                  <svg
                    className="w-3.5 h-3.5 text-slate-400 ml-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    autoFocus
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search or add a new person…"
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        trimmedSearch &&
                        !hasExactMatch &&
                        !creatingPerson
                      ) {
                        e.preventDefault();
                        handleCreateAndAdd(trimmedSearch);
                      } else if (e.key === "Escape") {
                        setShowPicker(false);
                        setPickerSearch("");
                      }
                    }}
                    className="flex-1 px-1.5 py-0.5 text-xs bg-transparent placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowPicker(false);
                      setPickerSearch("");
                    }}
                    className="p-0.5 text-slate-400 hover:text-slate-700 rounded"
                    title="Close"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <ul className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                  {trimmedSearch && !hasExactMatch && (
                    <li className="px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => handleCreateAndAdd(trimmedSearch)}
                        disabled={creatingPerson}
                        className="w-full flex items-center gap-2 text-left text-sm text-indigo-700 hover:text-indigo-800 disabled:opacity-60"
                      >
                        <span className="flex items-center justify-center w-4 h-4 rounded bg-indigo-100 text-indigo-600 shrink-0">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
                          </svg>
                        </span>
                        <span className="truncate">
                          {creatingPerson ? "Adding…" : (
                            <>Add new person <span className="font-semibold">"{trimmedSearch}"</span></>
                          )}
                        </span>
                      </button>
                    </li>
                  )}
                  {filteredPeople.map((p) => (
                    <li key={p.id} className="px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => handleAddContributor(p.id, p.name)}
                        className="w-full flex items-center gap-2 text-left text-sm text-slate-800 hover:text-slate-900"
                      >
                        <span className="flex items-center justify-center w-4 h-4 rounded bg-slate-100 text-slate-500 shrink-0">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
                          </svg>
                        </span>
                        <span className="truncate">{p.name}</span>
                      </button>
                    </li>
                  ))}
                  {filteredPeople.length === 0 && !trimmedSearch && (
                    <li className="px-2.5 py-3 text-xs text-slate-400 italic text-center">
                      {availablePeople.length === 0
                        ? "Everyone's already on this item — type a name to add someone new."
                        : "No people yet. Type a name above to add one."}
                    </li>
                  )}
                  {filteredPeople.length === 0 && trimmedSearch && hasExactMatch && (
                    <li className="px-2.5 py-2 text-xs text-slate-400 italic">
                      That person is already on this item.
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 ring-1 ring-inset ring-fuchsia-200/70 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
                </svg>
                Add contributor
              </button>
            )}
          </div>

          {/* Notes */}
          {item.notes ? (
            <div className="mb-4">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
              <div className="bg-slate-50/60 rounded-2xl p-3.5 sm:p-4 ring-1 ring-inset ring-slate-100">
                <Markdown content={item.notes} className="text-sm text-slate-700" />
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-sm text-slate-400 italic">No notes yet</p>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${showAllHistory ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
                Change History ({history.length})
              </button>
              {showAllHistory && <div className="space-y-1.5 mt-2">
                {history.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 text-xs">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded-md font-medium ring-1 ring-inset ${
                      entry.action === "CREATE" ? "bg-green-50 text-green-700 ring-green-200/70"
                      : entry.action === "DELETE" ? "bg-rose-50 text-rose-700 ring-rose-200/70"
                      : "bg-blue-50 text-blue-700 ring-blue-200/70"
                    }`}>
                      {entry.action}
                    </span>
                    <div className="flex-1 min-w-0 text-slate-500">
                      {entry.action === "UPDATE" && entry.fieldName ? (
                        <>
                          <span className="font-medium text-slate-700">{FIELD_LABELS[entry.fieldName] ?? entry.fieldName}</span>
                          {": "}
                          <span className="text-rose-400 line-through">{(entry.oldValue?.length ?? 0) > 40 ? entry.oldValue!.slice(0, 37) + "..." : entry.oldValue || "(empty)"}</span>
                          {" → "}
                          <span className="text-green-600">{(entry.newValue?.length ?? 0) > 40 ? entry.newValue!.slice(0, 37) + "..." : entry.newValue || "(empty)"}</span>
                        </>
                      ) : entry.action === "CREATE" ? (
                        <span>Item created</span>
                      ) : (
                        <span>Item deleted</span>
                      )}
                    </div>
                    <span className="shrink-0 text-slate-400">
                      {new Date(entry.changedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>}
            </div>
          )}

          {/* Metadata */}
          <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
            <span>Added {new Date(item.createdAt).toLocaleDateString()}</span>
            {item.updatedAt !== item.createdAt && (
              <span>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
            )}
          </div>

          {/* Bottom edit button for mobile */}
          <div className="mt-5 sm:hidden">
            <button
              onClick={() => onEdit(item)}
              className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-xl hover:from-indigo-500 hover:to-indigo-700 transition-all shadow-sm shadow-indigo-600/25 ring-1 ring-inset ring-white/10"
            >
              Edit Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
