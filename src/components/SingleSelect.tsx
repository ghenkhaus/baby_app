import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface SingleSelectProps {
  options: Option[];
  selected: string;
  defaultValue: string;
  onChange: (selected: string) => void;
}

export function SingleSelect({ options, selected, defaultValue, onChange }: SingleSelectProps) {
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

  const selectedOpt = options.find((o) => o.value === selected);
  const displayText = selectedOpt?.label ?? options[0]?.label ?? "";
  const isActive = selected !== defaultValue;

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
        <span className="truncate">{displayText}</span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""} ${isActive ? "text-indigo-500" : "text-slate-400"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-40 mt-2 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 py-1.5 min-w-[180px] max-h-64 overflow-y-auto left-0 origin-top-left animate-[scaleIn_120ms_ease-out]">
          {options.map((opt) => {
            const isSelected = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg text-sm transition-colors ${
                  isSelected ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {isSelected ? (
                  <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
