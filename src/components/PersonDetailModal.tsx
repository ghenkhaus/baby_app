import { useEffect, useMemo, useState } from "react";
import type { Person } from "../types";
import { effectiveContributionAmount } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

interface PersonDetailModalProps {
  person: Person;
  people: Person[];
  onClose: () => void;
  onEdit: (person: Person) => void;
  onDelete: (id: string) => void;
  onShareCard: (personId: string, otherPersonId: string) => Promise<unknown>;
  onUnlinkCard: (personId: string) => Promise<unknown>;
  onMergePerson: (sourceId: string, targetId: string) => Promise<unknown>;
  onOpenItem: (itemId: string) => void;
  onOpenPerson: (id: string) => void;
  onOpenCard?: (cardId: string) => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

export function PersonDetailModal({
  person,
  people,
  onClose,
  onEdit,
  onDelete,
  onShareCard,
  onUnlinkCard,
  onMergePerson,
  onOpenItem,
  onOpenPerson,
  onOpenCard,
}: PersonDetailModalProps) {
  const card = person.thankYouCard;
  const cardId = card?.id;
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [mergeCandidate, setMergeCandidate] = useState<Person | null>(null);
  const [merging, setMerging] = useState(false);
  // Candidate whose own note would be discarded by linking — held for confirmation.
  const [shareConfirm, setShareConfirm] = useState<Person | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const members = useMemo(() => {
    if (!cardId) return [] as Person[];
    return people.filter((p) => p.thankYouCardId === cardId);
  }, [people, cardId]);

  const otherMembers = members.filter((m) => m.id !== person.id);
  const isShared = members.length > 1;
  const shareCandidates = people.filter(
    (p) => p.id !== person.id && p.thankYouCardId !== person.thankYouCardId
  );

  const totalContributed = person.contributions.reduce(
    (sum, c) => sum + (effectiveContributionAmount(c) ?? 0),
    0
  );

  // Gifts recorded against other members of this person's household (shared
  // card) that aren't already on this person. Contributions stay attributed to
  // the individual, so a linked partner's view shows none of their own — this
  // count powers a hint pointing at the shared card where the household's gifts
  // actually live.
  const householdGiftCount = useMemo(() => {
    const own = new Set(person.contributions.map((c) => c.itemId));
    const others = new Set<string>();
    for (const m of otherMembers) {
      for (const c of m.contributions) {
        if (!own.has(c.itemId)) others.add(c.itemId);
      }
    }
    return others.size;
  }, [otherMembers, person.contributions]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm sm:p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto animate-[slideInUp_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="p-5 sm:p-7">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {person.name}
              </h2>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onEdit(person)}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                title="Edit person"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(person.id)}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                title="Delete person"
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

          {/* Email */}
          {person.email && (
            <div className="mb-4">
              <p className="text-sm text-slate-600">
                <a href={`mailto:${person.email}`} className="text-indigo-600 hover:underline">
                  {person.email}
                </a>
              </p>
            </div>
          )}

          {/* Personal notes */}
          {person.notes && (
            <div className="mb-5 p-3 bg-slate-50/60 rounded-2xl ring-1 ring-inset ring-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Personal notes
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{person.notes}</p>
            </div>
          )}

          {/* Linked people section */}
          {card && (
            <div className="mb-5 p-4 sm:p-5 bg-gradient-to-br from-pink-50/60 via-fuchsia-50/40 to-violet-50/50 ring-1 ring-inset ring-pink-200/60 rounded-2xl">
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <div className="flex items-baseline gap-2 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Linked people
                  </h3>
                  {onOpenCard && (
                    <button
                      type="button"
                      onClick={() => onOpenCard(card.id)}
                      className="text-[11px] font-medium text-fuchsia-700 hover:text-fuchsia-800 hover:underline transition-colors"
                      title="Open this card in the Thank Yous tab"
                    >
                      Open in Thank Yous →
                    </button>
                  )}
                </div>
                {isShared && (
                  <span className="text-[11px] font-medium text-fuchsia-700 bg-white/70 px-2 py-0.5 rounded-full ring-1 ring-inset ring-fuchsia-200/70">
                    Linked to {otherMembers.length}{" "}
                    {otherMembers.length === 1 ? "other" : "others"}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {otherMembers.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {otherMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onOpenPerson(m.id)}
                        className="text-xs font-medium text-slate-700 bg-white/80 hover:bg-white border border-slate-200 rounded-full px-2 py-0.5 transition-colors"
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Not linked to anyone else.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {isShared && (
                    <button
                      type="button"
                      onClick={() => onUnlinkCard(person.id)}
                      className="text-xs font-medium text-slate-700 bg-white/70 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1 transition-colors"
                    >
                      Unlink
                    </button>
                  )}
                  {shareCandidates.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowSharePicker((s) => !s)}
                        className="text-xs font-medium text-fuchsia-700 bg-white/70 hover:bg-white border border-fuchsia-200 rounded-lg px-2.5 py-1 transition-colors"
                      >
                        Link to another person…
                      </button>
                      {showSharePicker && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowSharePicker(false)}
                          />
                          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-900/10 py-1 min-w-[200px] max-h-64 overflow-y-auto">
                            {shareCandidates.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setShowSharePicker(false);
                                  // Linking keeps this card and discards the
                                  // other person's card. Warn first if that
                                  // card has a note worth losing.
                                  if (p.thankYouCard?.note.trim()) {
                                    setShareConfirm(p);
                                  } else {
                                    onShareCard(person.id, p.id);
                                  }
                                }}
                                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Contributions */}
          <div className="mb-4">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Items they contributed to
              </h3>
              {totalContributed > 0 && (
                <span className="text-xs text-slate-500 tabular-nums">
                  {formatPrice(totalContributed)} tracked
                </span>
              )}
            </div>
            {person.contributions.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                No contributions yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {person.contributions.map((c) => {
                  const eff = effectiveContributionAmount(c);
                  const implied = c.amount === null && eff !== null;
                  return (
                    <li key={c.itemId}>
                      <button
                        type="button"
                        onClick={() => onOpenItem(c.itemId)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-left transition-colors"
                      >
                        <span className="text-sm text-slate-800 truncate">
                          {c.itemName}
                        </span>
                        {eff !== null && eff > 0 && (
                          <span
                            className={`text-xs tabular-nums shrink-0 ${
                              implied ? "text-slate-400 italic" : "text-slate-500"
                            }`}
                            title={implied ? "Implied — sole contributor on this item" : undefined}
                          >
                            {formatPrice(eff)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {householdGiftCount > 0 && (
              <button
                type="button"
                onClick={() => card && onOpenCard?.(card.id)}
                disabled={!card || !onOpenCard}
                className="mt-2 w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-left text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:cursor-default"
              >
                <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l3.586-3.586z" />
                </svg>
                <span>
                  {householdGiftCount}{person.contributions.length > 0 ? " more" : ""} household gift{householdGiftCount === 1 ? "" : "s"} tracked on the shared card
                  {card && onOpenCard ? " →" : ""}
                </span>
              </button>
            )}
          </div>

          {/* Merge action — danger zone */}
          <div className="pt-3 mt-4 border-t border-slate-100">
            {showMergePicker ? (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Merge {person.name} into…
                </p>
                <p className="text-xs text-slate-500 mb-2">
                  Pick the person to keep. {person.name} will be deleted and
                  their contributions moved over.
                </p>
                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
                  {people
                    .filter((p) => p.id !== person.id)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setShowMergePicker(false);
                          setMergeCandidate(p);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 transition-colors"
                      >
                        {p.name}
                        {p.email && (
                          <span className="text-xs text-slate-400 ml-2">
                            {p.email}
                          </span>
                        )}
                      </button>
                    ))}
                  {people.length <= 1 && (
                    <p className="px-3 py-3 text-xs text-slate-400 italic text-center">
                      No other people to merge into.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowMergePicker(false)}
                  className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowMergePicker(true)}
                disabled={people.length <= 1}
                className="text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-rose-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={people.length <= 1 ? "Need another person to merge into" : `Merge ${person.name} into another person`}
              >
                Merge into another person…
              </button>
            )}
          </div>
        </div>
      </div>

      {mergeCandidate && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
          onClick={(e) => {
            e.stopPropagation();
            if (!merging) setMergeCandidate(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 p-6 max-w-md w-full animate-[scaleIn_160ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="shrink-0 w-10 h-10 rounded-full bg-rose-50 ring-1 ring-inset ring-rose-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
                  Merge {person.name} into {mergeCandidate.name}?
                </h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  <strong>{person.name}</strong> will be deleted.
                  {person.contributions.length > 0 && (
                    <>
                      {" "}Their {person.contributions.length}{" "}
                      contribution{person.contributions.length === 1 ? "" : "s"}{" "}
                      will move to <strong>{mergeCandidate.name}</strong>.
                    </>
                  )}{" "}
                  If both are on the same item, the amounts will be combined.
                  This can't be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 mt-6">
              <button
                onClick={() => setMergeCandidate(null)}
                disabled={merging}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setMerging(true);
                  try {
                    await onMergePerson(person.id, mergeCandidate.id);
                    setMergeCandidate(null);
                    onClose();
                  } catch (e) {
                    // Leave the dialog open if it failed
                    console.error("Merge failed:", e);
                  } finally {
                    setMerging(false);
                  }
                }}
                disabled={merging}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-b from-rose-500 to-rose-600 rounded-xl hover:from-rose-500 hover:to-rose-700 transition-all shadow-sm shadow-rose-600/25 ring-1 ring-inset ring-white/10 disabled:opacity-60"
              >
                {merging ? "Merging…" : "Merge"}
              </button>
            </div>
          </div>
        </div>
      )}

      {shareConfirm && (
        <ConfirmDialog
          title={`Discard ${shareConfirm.name}'s note?`}
          message={`${shareConfirm.name} already has a thank-you note started. Linking them onto this card will keep this card's note and permanently discard theirs. This can't be undone.`}
          confirmLabel="Link & discard"
          onConfirm={() => {
            const target = shareConfirm;
            setShareConfirm(null);
            onShareCard(person.id, target.id);
          }}
          onCancel={() => setShareConfirm(null)}
        />
      )}
    </div>
  );
}
