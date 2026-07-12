export type ItemStatus = "" | "Researching" | "Decided" | "Purchased" | "Received" | "Not Needed";
export type ItemPriority = "Necessary" | "Nice to Have" | "";
export type RegistrationStatus = "" | "Needs Registration" | "Registered" | "N/A";

export type StatusStage = "Action Required" | "Done";

export const STATUS_STAGE_MAP: Record<StatusStage, ItemStatus[]> = {
  "Action Required": ["", "Researching"],
  Done: ["Decided", "Purchased", "Received", "Not Needed"],
};

export function getStatusStage(status: ItemStatus): StatusStage {
  if (status === "Decided" || status === "Purchased" || status === "Received" || status === "Not Needed") return "Done";
  return "Action Required";
}

export type SortField = "name" | "price" | "category" | "status" | "priority" | "registry" | "registrationStatus" | "createdAt";
export type SortDirection = "asc" | "desc";

export interface Contribution {
  personId: string;
  personName: string;
  amount: number | null;
}

export interface RegistryItem {
  id: string;
  name: string;
  category: string;
  status: ItemStatus;
  priority: ItemPriority;
  price: number;
  link: string;
  imageUrl: string;
  productName: string;
  notes: string;
  registry: string;
  registrationStatus: RegistrationStatus;
  createdAt: string;
  updatedAt: string;
  contributors: Contribution[];
}

export type ThankYouCardStatus = "" | "Drafted" | "Ready to Send" | "Sent";

export interface ThankYouCard {
  id: string;
  label: string;
  mailingName: string;
  address: string;
  note: string;
  /** Personalization hints for Claude to weave into the drafted note ("Personal touches" in the UI). */
  hint: string;
  status: ThankYouCardStatus;
  /** Server-managed: stamped when status enters "Sent", cleared when it leaves. */
  sentAt: string | null;
  /** Whether the mailing address has been double-checked/confirmed. */
  addressVerified: boolean;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  /** Shared Postable.com project URL — the card design used for all thank-yous. */
  postableProjectUrl: string;
}

export interface PersonContribution {
  itemId: string;
  itemName: string;
  amount: number | null;
  /** Item's full price, for computing implied amounts. */
  itemPrice: number;
  /** Total contributors on this item — when 1 and amount is null, the sole contributor is assumed to have covered the full price. */
  contributorCount: number;
}

/**
 * Effective dollar amount for a contribution, applying the rule:
 * "if there's exactly one contributor and no explicit amount, assume the full item price."
 * Returns null when neither an amount nor a sole-contributor implication applies.
 */
export function effectiveContributionAmount(c: PersonContribution): number | null {
  if (c.amount !== null) return c.amount;
  if (c.contributorCount === 1) return c.itemPrice;
  return null;
}

export interface Person {
  id: string;
  name: string;
  email: string;
  notes: string;
  thankYouCardId: string;
  thankYouCard: ThankYouCard | null;
  contributions: PersonContribution[];
  createdAt: string;
  updatedAt: string;
}

export interface RegistryData {
  version: 1;
  categories: string[];
  items: RegistryItem[];
}

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "IMPORT";
export type AuditEntityType = "item" | "category" | "import" | "person" | "thank_you_card" | "settings";

export interface AuditLogEntry {
  id: number;
  entityType: AuditEntityType;
  entityId: string | null;
  entityName: string | null;
  action: AuditAction;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  actor: string;
  changedAt: string;
}

export type LinkFilter = "All" | "Has Link" | "No Link";

export interface PriceRange {
  min: number | null;
  max: number | null;
}

export interface Filters {
  stage: StatusStage[];
  status: string[];
  priority: string[];
  category: string[];
  registry: string[];
  registrationStatus: string[];
  contributor: string[];
  link: LinkFilter;
  price: PriceRange;
  search: string;
}

export interface PriceBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

// Realtime change events broadcast from the server over SSE.
// Discriminated by `kind` so the client can pattern-match safely.
// `source` is the originating tab's unique id (X-Tab-Id header) — clients
// use it to suppress echoes of their own writes.
export type ChangeEvent =
  | { kind: "item-upsert"; item: RegistryItem; actor: string; source: string }
  | { kind: "item-delete"; id: string; actor: string; source: string }
  | { kind: "category-upsert"; name: string; actor: string; source: string }
  | { kind: "category-delete"; name: string; actor: string; source: string }
  | { kind: "person-upsert"; person: Person; actor: string; source: string }
  | { kind: "person-delete"; id: string; actor: string; source: string }
  | { kind: "card-upsert"; card: ThankYouCard; actor: string; source: string }
  | { kind: "card-delete"; id: string; actor: string; source: string }
  | { kind: "settings-upsert"; settings: AppSettings; actor: string; source: string }
  | { kind: "import-replaced"; actor: string; source: string };
