import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { playCelebrationSound } from "../utils/sound";

interface ProgressInfo {
  percentage: number;
  resolved: number;
  total: number;
}

interface LayoutProps {
  children: ReactNode;
  headerActions?: ReactNode;
  progress?: ProgressInfo;
}

// Tier-based fill gradient — pink to purple all the way, deepening as
// progress climbs. 100% breaks out into celebratory gold.
function fillGradient(pct: number): string {
  if (pct >= 100)
    return "bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400";
  if (pct >= 75)
    return "bg-gradient-to-r from-pink-400 via-fuchsia-500 to-violet-500";
  if (pct >= 50)
    return "bg-gradient-to-r from-pink-300 via-fuchsia-400 to-violet-500";
  if (pct >= 25)
    return "bg-gradient-to-r from-pink-300 via-pink-400 to-fuchsia-500";
  return "bg-gradient-to-r from-pink-200 via-pink-300 to-pink-400";
}

function BabyMascot({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <ellipse cx="16" cy="30" rx="9" ry="1.6" fill="rgba(15, 23, 42, 0.18)" />
      <circle
        cx="16"
        cy="15"
        r="11.5"
        fill="#fce7f3"
        stroke="#f9a8d4"
        strokeWidth="0.75"
      />
      <path
        d="M11.5 6 C 13 4, 15 3.6, 16 4.4 C 17 3.6, 19 4, 20.5 6 C 19 5.5, 17.5 5.5, 16 5.8 C 14.5 5.5, 13 5.5, 11.5 6 Z"
        fill="#92400e"
      />
      <circle cx="13" cy="4.6" r="0.9" fill="#92400e" />
      <circle cx="19" cy="4.6" r="0.9" fill="#92400e" />
      <ellipse cx="12.5" cy="15" rx="1.3" ry="1.5" fill="#1e293b" />
      <ellipse cx="19.5" cy="15" rx="1.3" ry="1.5" fill="#1e293b" />
      <circle cx="13" cy="14.4" r="0.5" fill="white" />
      <circle cx="20" cy="14.4" r="0.5" fill="white" />
      <circle cx="9" cy="18" r="2" fill="#fbb6ce" opacity="0.75" />
      <circle cx="23" cy="18" r="2" fill="#fbb6ce" opacity="0.75" />
      <path
        d="M12.5 20.5 Q16 23.5 19.5 20.5"
        fill="none"
        stroke="#1e293b"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CribIcon({ className = "" }: { className?: string }) {
  // Cartoon crib in the same style as the baby mascot: warm wood-tone frame
  // with stroke, pink mattress, white pillow, pastel-blue blanket, spindles,
  // and rounded finials on the corners.
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      {/* soft shadow under the crib */}
      <ellipse cx="16" cy="29.5" rx="12" ry="1.3" fill="rgba(15, 23, 42, 0.14)" />

      {/* mattress (rendered first so spindles overlay it) */}
      <rect
        x="5.5"
        y="19"
        width="21"
        height="6"
        rx="1.5"
        fill="#fce7f3"
        stroke="#f9a8d4"
        strokeWidth="0.6"
      />
      {/* pillow */}
      <ellipse
        cx="10"
        cy="20.6"
        rx="3"
        ry="1.2"
        fill="#ffffff"
        stroke="#cbd5e1"
        strokeWidth="0.4"
      />
      {/* blanket */}
      <rect
        x="13.5"
        y="20.2"
        width="12"
        height="4"
        rx="0.7"
        fill="#c7d2fe"
      />
      <line
        x1="14"
        y1="22"
        x2="25"
        y2="22"
        stroke="#a5b4fc"
        strokeWidth="0.5"
        opacity="0.7"
      />

      {/* side posts */}
      <rect
        x="3"
        y="9.5"
        width="3"
        height="16"
        rx="1.2"
        fill="#d4a373"
        stroke="#8c5e3f"
        strokeWidth="0.5"
      />
      <rect
        x="26"
        y="9.5"
        width="3"
        height="16"
        rx="1.2"
        fill="#d4a373"
        stroke="#8c5e3f"
        strokeWidth="0.5"
      />
      {/* finials */}
      <circle
        cx="4.5"
        cy="9"
        r="1.7"
        fill="#d4a373"
        stroke="#8c5e3f"
        strokeWidth="0.5"
      />
      <circle
        cx="27.5"
        cy="9"
        r="1.7"
        fill="#d4a373"
        stroke="#8c5e3f"
        strokeWidth="0.5"
      />

      {/* top rail connecting the two posts */}
      <rect
        x="5"
        y="11"
        width="22"
        height="2.2"
        rx="0.7"
        fill="#d4a373"
        stroke="#8c5e3f"
        strokeWidth="0.4"
      />

      {/* spindles (vertical bars) */}
      <rect x="8"  y="13" width="1.4" height="7.5" rx="0.5" fill="#d4a373" stroke="#8c5e3f" strokeWidth="0.3" />
      <rect x="12" y="13" width="1.4" height="7.5" rx="0.5" fill="#d4a373" stroke="#8c5e3f" strokeWidth="0.3" />
      <rect x="16" y="13" width="1.4" height="7.5" rx="0.5" fill="#d4a373" stroke="#8c5e3f" strokeWidth="0.3" />
      <rect x="20" y="13" width="1.4" height="7.5" rx="0.5" fill="#d4a373" stroke="#8c5e3f" strokeWidth="0.3" />
      <rect x="24" y="13" width="1.4" height="7.5" rx="0.5" fill="#d4a373" stroke="#8c5e3f" strokeWidth="0.3" />

      {/* base under the crib */}
      <rect
        x="2.5"
        y="25"
        width="27"
        height="2.4"
        rx="0.8"
        fill="#a37545"
      />
    </svg>
  );
}

function TrophyIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7 4h10v3h2.5a1.5 1.5 0 011.5 1.5v1.5a3.5 3.5 0 01-3.5 3.5h-.4a5.5 5.5 0 01-4.1 4.4V20h3a1 1 0 010 2H7a1 1 0 010-2h3v-2.1A5.5 5.5 0 015.9 13.5H5.5A3.5 3.5 0 012 10V8.5A1.5 1.5 0 013.5 7H6V4h1zm10 5v2.5h.5a1.5 1.5 0 001.5-1.5V9h-2zM5 9v1a1.5 1.5 0 001.5 1.5H7V9H5z" />
    </svg>
  );
}

function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2z" />
    </svg>
  );
}

function ProgressBar({ progress }: { progress: ProgressInfo }) {
  const pct = Math.min(100, Math.max(0, progress.percentage));
  const isComplete = pct >= 100;
  const fill = fillGradient(pct);
  const babyTransform = `translate(-${pct}%, -50%)`;

  // Celebration state — fire when `resolved` ticks up by 1 or 2 (a real user
  // resolution, not a bulk import or first data load).
  const prevResolvedRef = useRef(progress.resolved);
  const initializedRef = useRef(false);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [celebrationDelta, setCelebrationDelta] = useState(1);
  const [hopping, setHopping] = useState(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevResolvedRef.current = progress.resolved;
      return;
    }
    const delta = progress.resolved - prevResolvedRef.current;
    prevResolvedRef.current = progress.resolved;
    if (delta > 0 && delta <= 3) {
      setCelebrationDelta(delta);
      setCelebrationKey((k) => k + 1);
      setHopping(true);
      playCelebrationSound();
      // Match the CSS .baby-hop animation duration (1200ms) plus a small buffer
      // so the hop fully plays before the class flips back to baby-bob.
      const t = setTimeout(() => setHopping(false), 1300);
      return () => clearTimeout(t);
    }
  }, [progress.resolved]);

  const bgTrack = isComplete
    ? "bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100 ring-amber-300/70"
    : "bg-gradient-to-r from-pink-50 via-purple-50 to-sky-50 ring-slate-200/70";

  // Dynamic label placement so it never collides with the baby or the crib.
  // When the baby is in the left half of the bar, the label sits on the right
  // (over the empty track). When the baby crosses past 50% the label fades
  // over to the left (now over the filled portion). Two anchored labels
  // cross-fade rather than one mid-snapping element.
  const labelOnLeft = pct >= 50;

  return (
    <div
      className="relative w-full"
      title={`${pct}% — ${progress.resolved} of ${progress.total}`}
    >
      {/* Bar */}
      <div
        className={`relative ${isComplete ? "progress-bar-complete rounded-full" : ""}`}
      >
        {/* Track */}
        <div
          className={`relative h-6 sm:h-7 rounded-full ring-1 ring-inset ${bgTrack} overflow-hidden`}
        >
          {/* Filled portion */}
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${fill} shadow-sm transition-[width] duration-1000 ease-out overflow-hidden`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          >
            {/* Floating twinkles inside the fill — adds gentle motion/sparkle */}
            {!isComplete && (
              <>
                <span className="progress-twinkle progress-twinkle-1" />
                <span className="progress-twinkle progress-twinkle-2" />
                <span className="progress-twinkle progress-twinkle-3" />
                <span className="progress-twinkle progress-twinkle-4" />
                <span className="progress-twinkle progress-twinkle-5" />
              </>
            )}
          </div>

          {/* Continuous gentle shimmer sweep (sub-100% only) */}
          {!isComplete && <div className="progress-bar-shimmer-idle" />}
          {/* Faster, brighter shimmer at 100% celebration */}
          {isComplete && <div className="progress-bar-shimmer" />}

          {/* Label — left variant (visible when pct >= 50, sits over fill) */}
          <div
            className="absolute inset-y-0 left-3 flex items-center gap-1.5 pointer-events-none transition-opacity duration-500"
            style={{ opacity: labelOnLeft ? 1 : 0 }}
            aria-hidden={!labelOnLeft}
          >
            <span
              className={`text-xs sm:text-sm font-extrabold tabular-nums tracking-tight ${
                isComplete ? "text-amber-800" : "text-white"
              } [text-shadow:_0_1px_2px_rgba(15,23,42,0.35)]`}
            >
              {pct}%
            </span>
            <span className="hidden md:inline text-[11px] text-white/85 tabular-nums [text-shadow:_0_1px_2px_rgba(15,23,42,0.4)]">
              {progress.resolved} <span className="text-white/65">of</span>{" "}
              {progress.total}
            </span>
          </div>

          {/* Label — right variant (visible when pct < 50, sits over track) */}
          <div
            className="absolute inset-y-0 right-11 sm:right-14 flex items-center gap-1.5 pointer-events-none transition-opacity duration-500"
            style={{ opacity: labelOnLeft ? 0 : 1 }}
            aria-hidden={labelOnLeft}
          >
            <span
              className={`text-xs sm:text-sm font-extrabold tabular-nums tracking-tight ${
                isComplete ? "text-amber-700" : "text-slate-800"
              }`}
            >
              {pct}%
            </span>
            <span className="hidden md:inline text-[11px] text-slate-500 tabular-nums">
              {progress.resolved} <span className="text-slate-400">of</span>{" "}
              {progress.total}
            </span>
          </div>

          {/* Crib / trophy destination at the right end */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 transition-colors duration-500 pointer-events-none ${
              isComplete ? "right-2 text-amber-600" : "right-2 text-slate-300/70"
            }`}
          >
            {isComplete ? (
              <TrophyIcon className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-sm" />
            ) : (
              <CribIcon className="w-7 h-7 sm:w-9 sm:h-9 drop-shadow-sm" />
            )}
          </div>
        </div>

        {/* Baby mascot at the leading edge of the fill */}
        <div
          className="absolute top-1/2 pointer-events-none z-10"
          style={{
            left: `${pct}%`,
            transform: babyTransform,
            transition: "left 1000ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div className={`relative ${hopping ? "baby-hop" : "baby-bob"}`}>
            <BabyMascot className="w-9 h-9 sm:w-10 sm:h-10 drop-shadow-md" />
            {isComplete && (
              <>
                <Sparkle className="progress-sparkle-1 absolute -top-2 -right-2 w-3.5 h-3.5 text-amber-400" />
                <Sparkle className="progress-sparkle-2 absolute -bottom-1 -left-2 w-3 h-3 text-amber-300" />
                <Sparkle className="progress-sparkle-3 absolute -top-1 -left-3 w-2.5 h-2.5 text-yellow-400" />
              </>
            )}
          </div>
        </div>

        {/* Celebration burst — re-mounts on each pct increase, runs once */}
        {celebrationKey > 0 && (
          <div
            key={celebrationKey}
            className="absolute top-1/2 pointer-events-none z-20"
            style={{ left: `${pct}%`, transform: `translate(-${pct}%, -50%)` }}
          >
            <div className="relative w-0 h-0">
              <div className="celebration-plus-one">+{celebrationDelta}</div>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={`celebration-particle celebration-particle-${i}`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Layout({ children, headerActions, progress }: LayoutProps) {
  const showProgress = progress && progress.total > 0;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 py-3 sm:py-4">
            {/* Title (takes available width on mobile, auto on desktop) */}
            <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm shadow-indigo-500/20 ring-1 ring-white/40 shrink-0">
                <svg className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight leading-tight">
                  Baby Registry Tracker
                </h1>
                <p className="hidden lg:block text-xs text-slate-500 leading-tight">
                  Plan, compare, and track every little thing.
                </p>
              </div>
            </div>

            {/* Progress bar — fills space between title and actions on desktop;
                on mobile it wraps to its own row below. */}
            {showProgress && (
              <div className="order-last sm:order-none basis-full sm:basis-0 sm:flex-1 sm:min-w-0 sm:max-w-3xl">
                <ProgressBar progress={progress} />
              </div>
            )}

            {/* Actions */}
            {headerActions && (
              <div className="flex items-center gap-2 shrink-0">{headerActions}</div>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-8">{children}</main>
    </div>
  );
}
