/**
 * HTTP client wrapping the Baby Registry Express API.
 * All requests include X-Device-Name: "MCP / Claude" for audit trail identification.
 */

const API_BASE = process.env.REGISTRY_API_URL || "http://localhost:3001";

interface Contribution {
  personId: string;
  personName: string;
  amount: number | null;
}

interface RegistryItem {
  id: string;
  name: string;
  category: string;
  status: string;
  priority: string;
  price: number;
  link: string;
  imageUrl: string;
  productName: string;
  notes: string;
  registry: string;
  registrationStatus: string;
  createdAt: string;
  updatedAt: string;
  contributors: Contribution[];
}

interface ThankYouCard {
  id: string;
  label: string;
  mailingName: string;
  address: string;
  note: string;
  /** User-written personalization hints for drafting the note ("Personal touches" in the app). */
  hint: string;
  /** "" = Not Started; lifecycle: "" → Drafted → Ready to Send → Sent */
  status: string;
  /** Server-managed: set when status enters "Sent", cleared when it leaves. */
  sentAt: string | null;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface PersonContribution {
  itemId: string;
  itemName: string;
  amount: number | null;
  itemPrice: number;
  contributorCount: number;
}

interface Person {
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

interface AuditLogEntry {
  id: number;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  actor: string;
  changedAt: string;
}

interface ScrapeResult {
  name: string;
  price: number;
  imageUrl: string;
}

interface RegistryData {
  version: number;
  categories: string[];
  items: RegistryItem[];
}

interface AppSettings {
  postableProjectUrl: string;
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Name": "MCP / Claude",
  };

  const res = await fetch(`${API_BASE}/api${path}`, {
    headers,
    ...opts,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = (body.error as string) || `API request failed: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

export const client = {
  // Items
  getItems: () => request<RegistryItem[]>("/items"),

  getItem: (id: string) => request<RegistryItem>(`/items/${encodeURIComponent(id)}`),

  createItem: (item: Record<string, unknown>) =>
    request<RegistryItem>("/items", { method: "POST", body: JSON.stringify(item) }),

  updateItem: (id: string, updates: Record<string, unknown>) =>
    request<RegistryItem>(`/items/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  deleteItem: (id: string) =>
    request<{ ok: boolean }>(`/items/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Categories
  getCategories: () => request<string[]>("/categories"),

  createCategory: (name: string) =>
    request<{ name: string }>("/categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  deleteCategory: (name: string) =>
    request<{ ok: boolean }>(`/categories/${encodeURIComponent(name)}`, { method: "DELETE" }),

  // Scraping
  scrapeLink: (url: string) =>
    request<ScrapeResult>("/scrape-link", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  // Audit
  getAuditLog: (limit = 50, offset = 0) =>
    request<AuditLogEntry[]>(`/audit-log?limit=${limit}&offset=${offset}`),

  getItemHistory: (itemId: string) =>
    request<AuditLogEntry[]>(`/items/${encodeURIComponent(itemId)}/history`),

  // Export
  exportData: () => request<RegistryData>("/export"),

  // People
  getPeople: () => request<Person[]>("/people"),
  getPerson: (id: string) => request<Person>(`/people/${encodeURIComponent(id)}`),
  createPerson: (data: Record<string, unknown>) =>
    request<Person>("/people", { method: "POST", body: JSON.stringify(data) }),
  updatePerson: (id: string, updates: Record<string, unknown>) =>
    request<Person>(`/people/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
  deletePerson: (id: string) =>
    request<{ ok: boolean }>(`/people/${encodeURIComponent(id)}`, { method: "DELETE" }),
  bulkAddPeople: (names: string[]) =>
    request<{ created: number; skipped: string[]; createdIds: string[] }>("/people/bulk", {
      method: "POST",
      body: JSON.stringify({ names }),
    }),
  sharePersonCard: (id: string, otherPersonId: string) =>
    request<Person>(`/people/${encodeURIComponent(id)}/share-card`, {
      method: "POST",
      body: JSON.stringify({ otherPersonId }),
    }),
  unlinkPersonCard: (id: string) =>
    request<Person>(`/people/${encodeURIComponent(id)}/unlink-card`, { method: "POST" }),
  mergePerson: (sourceId: string, targetId: string) =>
    request<{ ok: boolean; target: Person }>(`/people/${encodeURIComponent(sourceId)}/merge`, {
      method: "POST",
      body: JSON.stringify({ targetId }),
    }),

  // Thank-you cards
  getThankYouCards: () => request<ThankYouCard[]>("/thank-you-cards"),
  updateThankYouCard: (id: string, updates: Record<string, unknown>) =>
    request<ThankYouCard>(`/thank-you-cards/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  // App settings
  getSettings: () => request<AppSettings>("/settings"),
  updateSettings: (updates: Record<string, unknown>) =>
    request<AppSettings>("/settings", { method: "PUT", body: JSON.stringify(updates) }),
};

export type {
  RegistryItem,
  AuditLogEntry,
  ScrapeResult,
  RegistryData,
  Person,
  ThankYouCard,
  Contribution,
  PersonContribution,
  AppSettings,
};
