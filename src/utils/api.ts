import type { RegistryItem, RegistryData, AuditLogEntry, Person, ThankYouCard, ThankYouCardStatus, AppSettings } from "../types";

const BASE = "/api";

// Derive a short device name for audit logging.
const deviceName = (() => {
  try {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return "iPhone";
    if (/iPad/.test(ua)) return "iPad";
    if (/Android/.test(ua)) return "Android";
    if (/Mac/.test(ua)) return "Mac";
    if (/Windows/.test(ua)) return "Windows";
    if (/Linux/.test(ua)) return "Linux";
    return "Browser";
  } catch { return ""; }
})();

// Per-tab unique ID used to suppress SSE echoes of our own writes.
// We can't rely on the UA-derived device name alone — two spouses on Macs
// would collide. sessionStorage scope = this tab only, which is what we want:
// a second tab in the same browser is treated as a separate viewer that
// SHOULD see live updates from the first tab.
const tabId = (() => {
  try {
    const KEY = "baby-registry.tabId";
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id =
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
          : Math.random().toString(36).slice(2, 14));
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 14);
  }
})();

// Exported so the SSE consumer can identify itself / find its own echoes.
export function getDeviceName(): string {
  return deviceName;
}

export function getTabId(): string {
  return tabId;
}

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(deviceName ? { "X-Device-Name": deviceName } : {}),
    "X-Tab-Id": tabId,
  };
  const res = await fetch(`${BASE}${url}`, {
    headers,
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getItems: () => request<RegistryItem[]>("/items"),
  addItem: (item: Omit<RegistryItem, "id" | "createdAt" | "updatedAt" | "contributors"> & { contributors?: { personId: string; amount: number | null }[] }) =>
    request<RegistryItem>("/items", { method: "POST", body: JSON.stringify(item) }),
  updateItem: (id: string, updates: Partial<Omit<RegistryItem, "contributors">> & { contributors?: { personId: string; amount: number | null }[] }) =>
    request<RegistryItem>(`/items/${id}`, { method: "PUT", body: JSON.stringify(updates) }),
  deleteItem: (id: string) =>
    request<{ ok: boolean }>(`/items/${id}`, { method: "DELETE" }),

  getCategories: () => request<string[]>("/categories"),
  addCategory: (name: string) =>
    request<{ name: string }>("/categories", { method: "POST", body: JSON.stringify({ name }) }),
  removeCategory: (name: string) =>
    request<{ ok: boolean }>(`/categories/${encodeURIComponent(name)}`, { method: "DELETE" }),

  importData: (data: { categories: string[]; items: RegistryItem[] }) =>
    request<{ categories: string[]; items: RegistryItem[] }>("/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  exportData: () => request<RegistryData>("/export"),

  scrapeLink: (url: string) =>
    request<{ name: string; price: number; imageUrl: string }>("/scrape-link", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  getAuditLog: (limit = 50, offset = 0) =>
    request<AuditLogEntry[]>(`/audit-log?limit=${limit}&offset=${offset}`),
  getItemHistory: (itemId: string) =>
    request<AuditLogEntry[]>(`/items/${itemId}/history`),

  // People
  getPeople: () => request<Person[]>("/people"),
  getPerson: (id: string) => request<Person>(`/people/${id}`),
  createPerson: (data: { name: string; email?: string; notes?: string; thankYouCardId?: string }) =>
    request<Person>("/people", { method: "POST", body: JSON.stringify(data) }),
  updatePerson: (id: string, updates: Partial<{ name: string; email: string; notes: string; thankYouCardId: string }>) =>
    request<Person>(`/people/${id}`, { method: "PUT", body: JSON.stringify(updates) }),
  deletePerson: (id: string) =>
    request<{ ok: boolean }>(`/people/${id}`, { method: "DELETE" }),
  bulkAddPeople: (names: string[]) =>
    request<{ created: number; skipped: string[]; createdIds: string[] }>("/people/bulk", {
      method: "POST",
      body: JSON.stringify({ names }),
    }),
  sharePersonCard: (id: string, otherPersonId: string) =>
    request<Person>(`/people/${id}/share-card`, {
      method: "POST",
      body: JSON.stringify({ otherPersonId }),
    }),
  unlinkPersonCard: (id: string) =>
    request<Person>(`/people/${id}/unlink-card`, { method: "POST" }),
  mergePerson: (sourceId: string, targetId: string) =>
    request<{ ok: boolean; target: Person }>(`/people/${sourceId}/merge`, {
      method: "POST",
      body: JSON.stringify({ targetId }),
    }),

  // Thank-you cards
  getThankYouCards: () => request<ThankYouCard[]>("/thank-you-cards"),
  updateThankYouCard: (id: string, updates: Partial<{ label: string; mailingName: string; address: string; note: string; hint: string; status: ThankYouCardStatus; addressVerified: boolean }>) =>
    request<ThankYouCard>(`/thank-you-cards/${id}`, { method: "PUT", body: JSON.stringify(updates) }),

  // App settings
  getSettings: () => request<AppSettings>("/settings"),
  updateSettings: (updates: Partial<AppSettings>) =>
    request<AppSettings>("/settings", { method: "PUT", body: JSON.stringify(updates) }),
};
