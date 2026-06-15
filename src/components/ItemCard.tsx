import { useState } from "react";
import type { RegistryItem } from "../types";
import { Markdown } from "./Markdown";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

interface ItemCardProps {
  item: RegistryItem;
  registries: string[];
  onEdit: (item: RegistryItem) => void;
  onDelete: (id: string) => void;
  onQuickRegistryChange?: (id: string, registry: string) => void;
}

export function ItemCard({ item, registries, onEdit, onDelete, onQuickRegistryChange }: ItemCardProps) {
  const [showRegistryPicker, setShowRegistryPicker] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const hasLongNotes = item.notes && item.notes.length > 100;

  return (
    <div
      onClick={() => onEdit(item)}
      className="group bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 p-3.5 sm:p-4 shadow-sm shadow-slate-900/[0.03] hover:shadow-lg hover:shadow-slate-900/[0.06] hover:border-slate-300/80 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer active:scale-[0.995]"
    >
      <div className="flex items-start justify-between gap-2.5">
        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-xl bg-slate-50 ring-1 ring-slate-100 shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate text-sm sm:text-base tracking-tight">{item.name}</h3>
          {item.productName && (
            <p className="text-xs text-slate-400 truncate">{item.productName}</p>
          )}
          {item.price > 0 && (
            <p className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 tabular-nums tracking-tight">
              {formatPrice(item.price)}
            </p>
          )}
        </div>
        <div className="flex gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
          {/* Registry quick-toggle */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRegistryPicker(!showRegistryPicker);
              }}
              className={`p-1.5 rounded-lg transition-all ${
                item.registry
                  ? "text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                  : "text-slate-300 hover:text-teal-600 hover:bg-teal-50"
              }`}
              title={item.registry ? `On ${item.registry}` : "Add to a registry"}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill={item.registry ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            {showRegistryPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowRegistryPicker(false); }} />
                <div className="absolute right-0 top-full mt-2 z-20 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 py-1.5 min-w-[180px] origin-top-right animate-[scaleIn_120ms_ease-out]">
                  {item.registry && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickRegistryChange?.(item.id, "");
                        setShowRegistryPicker(false);
                      }}
                      className="w-full text-left px-3 py-2 mx-1 rounded-lg text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Remove from registry
                    </button>
                  )}
                  {registries.map((reg) => (
                    <button
                      key={reg}
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickRegistryChange?.(item.id, reg);
                        setShowRegistryPicker(false);
                      }}
                      className={`w-full text-left px-3 py-2 mx-1 rounded-lg text-sm hover:bg-slate-50 flex items-center gap-2 transition-colors ${
                        item.registry === reg ? "text-teal-700 font-medium bg-teal-50" : "text-slate-700"
                      }`}
                    >
                      {item.registry === reg && (
                        <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {item.registry !== reg && <span className="w-4" />}
                      {reg}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mt-2.5 sm:mt-3">
        {item.status && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${
              item.status === "Decided"
                ? "bg-green-50 text-green-700 ring-green-200/70"
                : item.status === "Purchased"
                  ? "bg-purple-50 text-purple-700 ring-purple-200/70"
                  : item.status === "Received"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
                    : item.status === "Not Needed"
                      ? "bg-slate-50 text-slate-500 ring-slate-200/70"
                      : "bg-amber-50 text-amber-700 ring-amber-200/70"
            }`}
          >
            {item.status}
          </span>
        )}
        {item.priority && (
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${
              item.priority === "Necessary" ? "text-rose-600" : "text-blue-600"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                item.priority === "Necessary" ? "bg-rose-500 ring-2 ring-rose-100" : "bg-blue-500 ring-2 ring-blue-100"
              }`}
            />
            {item.priority}
          </span>
        )}
        {item.registrationStatus && (
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${
              item.registrationStatus === "Registered"
                ? "text-green-600"
                : item.registrationStatus === "Needs Registration"
                  ? "text-orange-600"
                  : "text-slate-500"
            }`}
            title="Manufacturer registration status"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                item.registrationStatus === "Registered"
                  ? "bg-green-500 ring-2 ring-green-100"
                  : item.registrationStatus === "Needs Registration"
                    ? "bg-orange-500 ring-2 ring-orange-100"
                    : "bg-slate-400 ring-2 ring-slate-100"
              }`}
            />
            {item.registrationStatus === "N/A"
              ? "Reg. N/A"
              : item.registrationStatus === "Registered"
                ? "Registered"
                : "Needs Reg."}
          </span>
        )}
        {item.registry && (
          <span className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-md text-[11px] font-medium bg-white text-teal-700 ring-1 ring-inset ring-teal-300/70 shadow-sm">
            <svg className="w-3 h-3 -ml-0.5" fill="currentColor" stroke="none" viewBox="0 0 24 24">
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            {item.registry}
          </span>
        )}
        {item.contributors.length > 0 && (
          <span
            className="inline-flex items-center gap-1 pl-1.5 pr-1.5 py-0.5 rounded-full text-[11px] font-medium bg-fuchsia-50 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200/70"
            title={item.contributors.map((c) => c.personName).join(", ")}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
            {item.contributors.length === 1
              ? item.contributors[0].personName
              : `${item.contributors.length} contributors`}
          </span>
        )}
      </div>

      {item.link && (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 hover:underline mt-2.5 sm:mt-3 truncate max-w-full"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span className="truncate">{item.link}</span>
        </a>
      )}

      {item.notes && (
        <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
          <Markdown
            content={item.notes}
            className="text-xs sm:text-sm text-slate-500"
            truncate={!notesExpanded}
          />
          {hasLongNotes && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNotesExpanded(!notesExpanded);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 mt-1 font-medium"
            >
              {notesExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
