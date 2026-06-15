import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const toggle = (value: string) => {
    let next: string[];
    if (selected.includes(value)) {
      next = selected.filter((v) => v !== value);
    } else {
      next = [...selected, value];
    }
    // If every option is selected, reset to empty (= "All")
    if (next.length === options.length) {
      next = [];
    }
    onChange(next);
  };

  const displayText =
    selected.length === 0
      ? label
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? label
        : `${selected.length} selected`;

  const isActive = selected.length > 0;

  return (
    <div ref={wrapperRef} className="relative inline-block w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto px-3 py-2 sm:py-1.5 text-sm border rounded-xl text-left flex items-center justify-between gap-2 cursor-pointer transition-all ${
          isActive
            ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-500/10"
            : "border-slate-200 bg-white/80 backdrop-blur text-slate-700 hover:border-slate-300"
        } focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500`}
      >
        <span className="truncate flex items-center gap-1.5">
          {isActive && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-full shadow-sm">
              {selected.length}
            </span>
          )}
          {displayText}
        </span>
        <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""} ${isActive ? "text-indigo-500" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-40 mt-2 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 py-1.5 min-w-[220px] max-h-64 overflow-y-auto left-0 origin-top-left animate-[scaleIn_120ms_ease-out]">
          {isActive && (
            <button
              type="button"
              onClick={() => { onChange([]); }}
              className="w-full px-3 py-1.5 mb-1 text-xs text-indigo-600 hover:bg-indigo-50 text-left font-medium cursor-pointer rounded-lg mx-1"
            >
              Clear filter
            </button>
          )}
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 px-3 py-2 mx-1 hover:bg-slate-50 rounded-lg cursor-pointer text-sm text-slate-700 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="accent-indigo-600 cursor-pointer w-4 h-4"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
