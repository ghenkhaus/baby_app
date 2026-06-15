import { useEffect } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-[slideUp_0.2s_ease-out]">
      <div
        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-xl text-sm font-medium backdrop-blur-xl ring-1 ring-inset ${
          type === "success"
            ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-emerald-600/30 ring-white/15"
            : "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-rose-600/30 ring-white/15"
        }`}
      >
        {type === "success" ? (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {message}
        <button onClick={onClose} className="ml-1 p-0.5 hover:opacity-70 transition-opacity">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
