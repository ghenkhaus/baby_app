import { useMemo, useState, useEffect, useCallback } from "react";
import type { RegistryItem, ItemStatus, ItemPriority, RegistrationStatus, Person, Contribution } from "../types";
import { Markdown } from "./Markdown";
import { Toast } from "./Toast";
import { api } from "../utils/api";

interface ItemFormProps {
  item?: RegistryItem;
  categories: string[];
  people: Person[];
  onSave: (
    data: Omit<RegistryItem, "id" | "createdAt" | "updatedAt" | "contributors"> & {
      contributors: { personId: string; amount: number | null }[];
    }
  ) => void;
  onAddPerson: (data: { name: string }) => Promise<Person>;
  onCancel: () => void;
}

export function ItemForm({ item, categories, people, onSave, onAddPerson, onCancel }: ItemFormProps) {
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? categories[0] ?? "");
  const [status, setStatus] = useState<ItemStatus>(item?.status ?? "");
  const [priority, setPriority] = useState<ItemPriority>(item?.priority ?? "");
  const [price, setPrice] = useState(item?.price?.toString() ?? "");
  const [link, setLink] = useState(item?.link ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [registry, setRegistry] = useState(item?.registry ?? "");
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>(
    item?.registrationStatus ?? ""
  );
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [productName, setProductName] = useState(item?.productName ?? "");
  const [contributors, setContributors] = useState<Contribution[]>(
    item?.contributors ?? []
  );
  const [contributorSearch, setContributorSearch] = useState("");
  const [scraping, setScraping] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const clearToast = useCallback(() => setToast(null), []);

  const trimmedSearch = contributorSearch.trim();
  const filteredPeople = useMemo(() => {
    const q = trimmedSearch.toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q));
  }, [people, trimmedSearch]);
  const hasExactMatch = useMemo(
    () =>
      trimmedSearch !== "" &&
      people.some(
        (p) => p.name.toLowerCase() === trimmedSearch.toLowerCase()
      ),
    [people, trimmedSearch]
  );
  const [creatingPerson, setCreatingPerson] = useState(false);

  const toggleContributor = (person: Person) => {
    setContributors((prev) =>
      prev.some((c) => c.personId === person.id)
        ? prev.filter((c) => c.personId !== person.id)
        : [...prev, { personId: person.id, personName: person.name, amount: null }]
    );
  };

  const handleCreatePerson = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || creatingPerson) return;
    setCreatingPerson(true);
    try {
      const newPerson = await onAddPerson({ name: trimmed });
      setContributors((prev) =>
        prev.some((c) => c.personId === newPerson.id)
          ? prev
          : [
              ...prev,
              { personId: newPerson.id, personName: newPerson.name, amount: null },
            ]
      );
      setContributorSearch("");
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Failed to add person",
        type: "error",
      });
    } finally {
      setCreatingPerson(false);
    }
  };

  const updateContributorAmount = (personId: string, raw: string) => {
    setContributors((prev) =>
      prev.map((c) => {
        if (c.personId !== personId) return c;
        const trimmed = raw.trim();
        if (!trimmed) return { ...c, amount: null };
        const n = Number(trimmed);
        if (!Number.isFinite(n) || n < 0) return c;
        return { ...c, amount: n };
      })
    );
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (price && (isNaN(Number(price)) || Number(price) < 0)) {
      newErrors.price = "Price must be a positive number";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFetchDetails = async () => {
    if (!link.trim() || scraping) return;
    setScraping(true);
    setToast(null);
    try {
      const result = await api.scrapeLink(link.trim());
      const found: string[] = [];
      if (result.name) { setProductName(result.name); found.push("name"); }
      if (result.price > 0) { setPrice(result.price.toString()); found.push("price"); }
      if (result.imageUrl) { setImageUrl(result.imageUrl); found.push("image"); }
      if (found.length > 0) {
        setToast({ message: `Fetched ${found.join(", ")}`, type: "success" });
      } else {
        setToast({ message: "No product details found for this link", type: "error" });
      }
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Failed to fetch details", type: "error" });
    } finally {
      setScraping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      name: name.trim(),
      category,
      status,
      priority,
      price: price ? Number(price) : 0,
      link: link.trim(),
      imageUrl,
      productName,
      notes: notes.trim(),
      registry: registry.trim(),
      registrationStatus,
      contributors: contributors.map((c) => ({
        personId: c.personId,
        amount: c.amount,
      })),
    });
  };

  const inputClass =
    "w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 text-slate-800 placeholder:text-slate-400 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors";
  const labelClass = "block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm sm:p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto animate-[slideInUp_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="p-5 sm:p-7">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 sm:mb-5 tracking-tight">
            {item ? "Edit Item" : "Add Item"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="e.g., Crib, Stroller, Bottles..."
                autoFocus
              />
              {errors.name && (
                <p className="text-xs text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
                {errors.price && (
                  <p className="text-xs text-red-600 mt-1">{errors.price}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ItemStatus)}
                  className={inputClass}
                >
                  <option value="">—</option>
                  <option value="Researching">Researching</option>
                  <option value="Decided">Decided</option>
                  <option value="Purchased">Purchased</option>
                  <option value="Received">Received</option>
                  <option value="Not Needed">Not Needed</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ItemPriority)}
                  className={inputClass}
                >
                  <option value="">—</option>
                  <option value="Necessary">Necessary</option>
                  <option value="Nice to Have">Nice to Have</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Link</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className={`${inputClass} flex-1`}
                  placeholder="https://..."
                />
                {link.trim().startsWith("http") && (
                  <button
                    type="button"
                    onClick={handleFetchDetails}
                    disabled={scraping}
                    className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 hover:border-indigo-300 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {scraping ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Fetching...
                      </span>
                    ) : "Fetch details"}
                  </button>
                )}
              </div>
              {(imageUrl || productName) && (
                <div className="mt-2 flex items-center gap-3 p-2.5 bg-slate-50/80 border border-slate-200 rounded-xl">
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt="Product"
                      className="w-16 h-16 object-contain rounded-xl bg-white ring-1 ring-slate-100 shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    {productName && (
                      <p className="text-sm font-medium text-slate-700 truncate">{productName}</p>
                    )}
                    <p className="text-xs text-slate-400">Fetched from link</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setImageUrl(""); setProductName(""); }}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                    title="Clear fetched details"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Added to Registry</label>
                <input
                  type="text"
                  value={registry}
                  onChange={(e) => setRegistry(e.target.value)}
                  className={inputClass}
                  placeholder="e.g., Amazon, Babylist..."
                />
              </div>

              <div>
                <label className={labelClass}>Mfg Registration</label>
                <select
                  value={registrationStatus}
                  onChange={(e) =>
                    setRegistrationStatus(e.target.value as RegistrationStatus)
                  }
                  className={inputClass}
                >
                  <option value="">—</option>
                  <option value="Needs Registration">Needs Registration</option>
                  <option value="Registered">Registered</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Contributors
                </label>
                <span className="text-[11px] text-slate-400">
                  {contributors.length === 0
                    ? "None selected"
                    : `${contributors.length} selected`}
                </span>
              </div>
              <div className="border border-slate-200 rounded-xl bg-white/80 overflow-hidden">
                <input
                  type="text"
                  value={contributorSearch}
                  onChange={(e) => setContributorSearch(e.target.value)}
                  placeholder={
                    people.length === 0
                      ? "Type a name to add the first person…"
                      : "Search or add a new person…"
                  }
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      trimmedSearch &&
                      !hasExactMatch &&
                      !creatingPerson
                    ) {
                      e.preventDefault();
                      handleCreatePerson(trimmedSearch);
                    }
                  }}
                  className="w-full px-3 py-1.5 text-xs border-b border-slate-200 bg-slate-50/60 placeholder:text-slate-400 focus:outline-none"
                />
                <ul className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                  {trimmedSearch && !hasExactMatch && (
                    <li className="px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => handleCreatePerson(trimmedSearch)}
                        disabled={creatingPerson}
                        className="w-full flex items-center gap-2 text-left text-sm text-indigo-700 hover:text-indigo-800 disabled:opacity-60"
                      >
                        <span className="flex items-center justify-center w-4 h-4 rounded bg-indigo-100 text-indigo-600 shrink-0">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M12 5v14M5 12h14"
                            />
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
                  {filteredPeople.map((p) => {
                    const c = contributors.find((x) => x.personId === p.id);
                    const checked = !!c;
                    return (
                      <li
                        key={p.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 ${
                          checked ? "bg-indigo-50/40" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleContributor(p)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        >
                          <span
                            className={`flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0 ${
                              checked
                                ? "bg-indigo-600 border-indigo-600"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {checked && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span className="text-sm text-slate-800 truncate">
                            {p.name}
                          </span>
                        </button>
                        {checked && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[11px] text-slate-400">$</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              value={c.amount === null ? "" : c.amount}
                              onChange={(e) =>
                                updateContributorAmount(p.id, e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                              placeholder="—"
                              className="w-16 px-1.5 py-0.5 text-xs tabular-nums border border-slate-200 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none"
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {filteredPeople.length === 0 && !trimmedSearch && (
                    <li className="px-2.5 py-3 text-xs text-slate-400 italic text-center">
                      No people yet. Type a name above to add one.
                    </li>
                  )}
                  {filteredPeople.length === 0 && trimmedSearch && hasExactMatch && (
                    <li className="px-2.5 py-2 text-xs text-slate-400 italic">
                      No matches.
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Notes</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Markdown supported</span>
                  {notes && (
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className={`text-xs px-2 py-0.5 rounded-md font-medium transition-colors ${
                        showPreview
                          ? "bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {showPreview ? "Edit" : "Preview"}
                    </button>
                  )}
                </div>
              </div>
              {showPreview ? (
                <div className="w-full min-h-[5rem] px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/60">
                  <Markdown content={notes} className="text-slate-700" />
                </div>
              ) : (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                  rows={4}
                  placeholder={"Research notes, comparisons, thoughts...\n\nSupports **bold**, *italic*, - lists, @mentions, [links](url)"}
                />
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-xl hover:from-indigo-500 hover:to-indigo-700 transition-all shadow-sm shadow-indigo-600/25 ring-1 ring-inset ring-white/10 active:scale-[0.98]"
              >
                {item ? "Save Changes" : "Add Item"}
              </button>
            </div>
          </form>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
    </div>
  );
}
