import type { Filters, LinkFilter, StatusStage } from "../types";

// Array-shaped filter keys. Encoded as comma-separated values in the URL.
// Empty-string entries (e.g. status="" → "No Status") survive the round-trip
// because URLSearchParams preserves empty segments between commas.
const ARRAY_KEYS = [
  "stage",
  "status",
  "priority",
  "category",
  "registry",
  "registrationStatus",
  "contributor",
] as const;

const VALID_LINK: LinkFilter[] = ["All", "Has Link", "No Link"];
const VALID_STAGE: StatusStage[] = ["Action Required", "Done"];

/**
 * Parse the current URL search string into a Filters object, falling back to
 * `defaults` for any param that's missing or invalid. Unknown stage values are
 * silently dropped (so a stale URL doesn't break the app).
 */
export function parseFiltersFromUrl(
  search: string,
  defaults: Filters
): Filters {
  const params = new URLSearchParams(search);
  const next: Filters = {
    ...defaults,
    price: { ...defaults.price },
  };

  for (const key of ARRAY_KEYS) {
    const raw = params.get(key);
    if (raw === null) continue;
    const values = raw.split(",");
    if (key === "stage") {
      next.stage = values.filter((v): v is StatusStage =>
        VALID_STAGE.includes(v as StatusStage)
      );
    } else {
      (next[key] as string[]) = values;
    }
  }

  const link = params.get("link");
  if (link !== null && VALID_LINK.includes(link as LinkFilter)) {
    next.link = link as LinkFilter;
  }

  const priceMin = params.get("priceMin");
  const priceMax = params.get("priceMax");
  if (priceMin !== null) {
    const n = Number(priceMin);
    next.price.min = Number.isFinite(n) ? n : null;
  }
  if (priceMax !== null) {
    const n = Number(priceMax);
    next.price.max = Number.isFinite(n) ? n : null;
  }

  const q = params.get("q");
  if (q !== null) next.search = q;

  return next;
}

/**
 * Serialize filters into URLSearchParams. Default values are omitted to keep
 * URLs short. Order is deterministic so identical filters always produce the
 * same URL (good for sharing).
 */
export function filtersToUrlParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();

  for (const key of ARRAY_KEYS) {
    const arr = filters[key] as string[];
    if (arr.length > 0) params.set(key, arr.join(","));
  }

  if (filters.link !== "All") params.set("link", filters.link);
  if (filters.price.min !== null)
    params.set("priceMin", String(filters.price.min));
  if (filters.price.max !== null)
    params.set("priceMax", String(filters.price.max));
  if (filters.search) params.set("q", filters.search);

  return params;
}

/**
 * Sync the current URL to reflect the given filters. Uses replaceState so we
 * don't pollute browser history with a new entry on every keystroke.
 */
export function syncUrlWithFilters(filters: Filters): void {
  const params = filtersToUrlParams(filters);
  const queryString = params.toString();
  const newUrl = queryString
    ? `${window.location.pathname}?${queryString}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`;
  if (newUrl !== window.location.pathname + window.location.search + window.location.hash) {
    window.history.replaceState(null, "", newUrl);
  }
}
