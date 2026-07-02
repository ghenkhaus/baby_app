import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  RegistryItem,
  Filters,
  ItemStatus,
  ItemPriority,
  SortField,
  SortDirection,
  PriceBucket,
  StatusStage,
  ChangeEvent,
  Person,
  ThankYouCard,
  ThankYouCardStatus,
  AppSettings,
} from "../types";
import { getStatusStage } from "../types";
import { api, getDeviceName, getTabId } from "../utils/api";
import { importFromJson } from "../utils/storage";
import { parseFiltersFromUrl, syncUrlWithFilters } from "../utils/filterUrl";

const initialFilters: Filters = {
  stage: [],
  status: [],
  priority: [],
  category: [],
  registry: [],
  registrationStatus: [],
  contributor: [],
  link: "All",
  price: { min: null, max: null },
  search: "",
};

export function useRegistry() {
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [thankYouCards, setThankYouCards] = useState<ThankYouCard[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ postableProjectUrl: "" });
  const [filters, setFiltersState] = useState<Filters>(() =>
    typeof window === "undefined"
      ? initialFilters
      : parseFiltersFromUrl(window.location.search, initialFilters)
  );
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [viewMode, setViewMode] = useState<"grouped" | "flat" | "table">("grouped");

  useEffect(() => {
    Promise.all([api.getItems(), api.getCategories(), api.getPeople(), api.getThankYouCards(), api.getSettings()])
      .then(([itemsData, catsData, peopleData, cardsData, settingsData]) => {
        setItems(itemsData);
        setCategories(catsData);
        setPeople(peopleData);
        setThankYouCards(cardsData);
        setSettings(settingsData);
      })
      .catch((e) => console.error("Failed to load data:", e))
      .finally(() => setLoading(false));
  }, []);

  // Realtime sync — subscribe to server-pushed change events so other devices'
  // edits show up live. We suppress events whose actor matches our own device
  // (we've already applied our own writes optimistically). On (re)connect we
  // refetch the whole list to catch up on anything we missed.
  useEffect(() => {
    const deviceName = getDeviceName();
    const myTabId = getTabId();
    const url = `/api/updates${deviceName ? `?device=${encodeURIComponent(deviceName)}` : ""}`;
    const es = new EventSource(url);

    const refetch = () => {
      Promise.all([api.getItems(), api.getCategories(), api.getPeople(), api.getThankYouCards(), api.getSettings()])
        .then(([is, cs, ps, tcs, st]) => {
          setItems(is);
          setCategories(cs);
          setPeople(ps);
          setThankYouCards(tcs);
          setSettings(st);
        })
        .catch(() => {
          /* network blip — EventSource will keep retrying */
        });
    };

    es.onopen = () => {
      // Catch up after (re)connection — we may have missed events.
      refetch();
    };

    es.onmessage = (e) => {
      let ev: ChangeEvent;
      try {
        ev = JSON.parse(e.data) as ChangeEvent;
      } catch {
        return;
      }
      // Suppress echoes of our own writes via the per-tab source id, but only
      // for event kinds where the frontend already applied an optimistic
      // update (item / category). Person and card events also fire as
      // side-effects of item-contributor changes — those are NOT applied
      // optimistically, so we must accept them even from our own tab.
      const optimisticKinds = new Set([
        "item-upsert",
        "item-delete",
        "category-upsert",
        "category-delete",
        "settings-upsert",
        "import-replaced",
      ]);
      if (
        ev.source &&
        ev.source === myTabId &&
        optimisticKinds.has(ev.kind)
      ) {
        return;
      }

      switch (ev.kind) {
        case "item-upsert":
          setItems((prev) => {
            const idx = prev.findIndex((i) => i.id === ev.item.id);
            return idx === -1
              ? [...prev, ev.item]
              : prev.map((i, n) => (n === idx ? ev.item : i));
          });
          break;
        case "item-delete":
          setItems((prev) => prev.filter((i) => i.id !== ev.id));
          break;
        case "category-upsert":
          setCategories((prev) => (prev.includes(ev.name) ? prev : [...prev, ev.name]));
          break;
        case "category-delete":
          setCategories((prev) => prev.filter((c) => c !== ev.name));
          break;
        case "person-upsert":
          setPeople((prev) => {
            const idx = prev.findIndex((p) => p.id === ev.person.id);
            return idx === -1
              ? [...prev, ev.person]
              : prev.map((p, n) => (n === idx ? ev.person : p));
          });
          break;
        case "person-delete":
          setPeople((prev) => prev.filter((p) => p.id !== ev.id));
          break;
        case "card-upsert":
          setThankYouCards((prev) => {
            const idx = prev.findIndex((c) => c.id === ev.card.id);
            return idx === -1
              ? [...prev, ev.card]
              : prev.map((c, n) => (n === idx ? ev.card : c));
          });
          // The card's `note`/`mailingName`/`address` may have changed — refresh
          // the embedded card on any person who points at it so their UI updates.
          setPeople((prev) =>
            prev.map((p) =>
              p.thankYouCardId === ev.card.id ? { ...p, thankYouCard: ev.card } : p
            )
          );
          break;
        case "card-delete":
          setThankYouCards((prev) => prev.filter((c) => c.id !== ev.id));
          break;
        case "settings-upsert":
          setSettings(ev.settings);
          break;
        case "import-replaced":
          // Bulk replace — easiest to refetch everything.
          refetch();
          break;
      }
    };

    return () => {
      es.close();
    };
  }, []);

  useEffect(() => {
    syncUrlWithFilters(filters);
  }, [filters]);

  const addItem = useCallback(
    async (
      item: Omit<RegistryItem, "id" | "createdAt" | "updatedAt" | "contributors"> & {
        contributors?: { personId: string; amount: number | null }[];
      }
    ) => {
      const newItem = await api.addItem(item);
      setItems((prev) => [...prev, newItem]);
    },
    []
  );

  const updateItem = useCallback(
    async (
      id: string,
      updates: Partial<Omit<RegistryItem, "contributors">> & {
        contributors?: { personId: string; amount: number | null }[];
      }
    ) => {
      const updated = await api.updateItem(id, updates);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    },
    []
  );

  const deleteItem = useCallback(async (id: string) => {
    await api.deleteItem(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const setFilters = useCallback((update: Partial<Filters>) => {
    setFiltersState((prev) => ({ ...prev, ...update }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
  }, []);

  const addCategory = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await api.addCategory(trimmed);
    setCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  const removeCategory = useCallback(
    async (name: string) => {
      const hasItems = items.some((item) => item.category === name);
      if (hasItems) return false;
      try {
        await api.removeCategory(name);
        setCategories((prev) => prev.filter((c) => c !== name));
        return true;
      } catch {
        return false;
      }
    },
    [items]
  );

  const handleExport = useCallback(async () => {
    const data = await api.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `baby-registry-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(async (file: File) => {
    const parsed = await importFromJson(file);
    const result = await api.importData({
      categories: parsed.categories,
      items: parsed.items,
    });
    setCategories(result.categories);
    setItems(result.items);
  }, []);

  // --- People & thank-you cards ---

  const addPerson = useCallback(async (data: { name: string; email?: string; notes?: string; thankYouCardId?: string }) => {
    const person = await api.createPerson(data);
    setPeople((prev) => [...prev, person]);
    if (person.thankYouCard) {
      setThankYouCards((prev) => {
        const idx = prev.findIndex((c) => c.id === person.thankYouCard!.id);
        return idx === -1
          ? [...prev, person.thankYouCard!]
          : prev.map((c, n) => (n === idx ? person.thankYouCard! : c));
      });
    }
    return person;
  }, []);

  const updatePerson = useCallback(async (id: string, updates: Partial<{ name: string; email: string; notes: string; thankYouCardId: string }>) => {
    const person = await api.updatePerson(id, updates);
    setPeople((prev) => prev.map((p) => (p.id === id ? person : p)));
    if (person.thankYouCard) {
      const card = person.thankYouCard;
      setThankYouCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
    }
    return person;
  }, []);

  const removePerson = useCallback(async (id: string) => {
    await api.deletePerson(id);
    setPeople((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const bulkAddPeople = useCallback(async (names: string[]) => {
    const result = await api.bulkAddPeople(names);
    if (result.created > 0) {
      const fresh = await api.getPeople();
      setPeople(fresh);
      const cards = await api.getThankYouCards();
      setThankYouCards(cards);
    }
    return result;
  }, []);

  const updateThankYouCard = useCallback(async (id: string, updates: Partial<{ label: string; mailingName: string; address: string; note: string; hint: string; status: ThankYouCardStatus }>) => {
    const card = await api.updateThankYouCard(id, updates);
    setThankYouCards((prev) => prev.map((c) => (c.id === id ? card : c)));
    setPeople((prev) => prev.map((p) => (p.thankYouCardId === id ? { ...p, thankYouCard: card } : p)));
    return card;
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const s = await api.updateSettings(updates);
    setSettings(s);
    return s;
  }, []);

  const sharePersonCard = useCallback(async (id: string, otherPersonId: string) => {
    const person = await api.sharePersonCard(id, otherPersonId);
    // Easiest: refetch people + cards so all the cross-references are fresh.
    const [freshPeople, freshCards] = await Promise.all([api.getPeople(), api.getThankYouCards()]);
    setPeople(freshPeople);
    setThankYouCards(freshCards);
    return person;
  }, []);

  const unlinkPersonCard = useCallback(async (id: string) => {
    const person = await api.unlinkPersonCard(id);
    const [freshPeople, freshCards] = await Promise.all([api.getPeople(), api.getThankYouCards()]);
    setPeople(freshPeople);
    setThankYouCards(freshCards);
    return person;
  }, []);

  const mergePerson = useCallback(async (sourceId: string, targetId: string) => {
    const result = await api.mergePerson(sourceId, targetId);
    // The server broadcasts the cascade (person-delete, person-upsert, item-upsert)
    // but force a full refresh so contributions and items are guaranteed fresh
    // even if any single SSE event was missed.
    const [freshPeople, freshItems, freshCards] = await Promise.all([
      api.getPeople(),
      api.getItems(),
      api.getThankYouCards(),
    ]);
    setPeople(freshPeople);
    setItems(freshItems);
    setThankYouCards(freshCards);
    return result.target;
  }, []);

  const filteredItems = useMemo(() => {
    const query = filters.search.toLowerCase();
    return items.filter((item) => {
      if (filters.stage.length > 0 && !filters.stage.includes(getStatusStage(item.status)))
        return false;
      if (filters.status.length > 0 && !filters.status.includes(item.status))
        return false;
      if (filters.priority.length > 0 && !filters.priority.includes(item.priority))
        return false;
      if (filters.category.length > 0 && !filters.category.includes(item.category))
        return false;
      if (filters.registry.length > 0 && !filters.registry.includes(item.registry))
        return false;
      if (filters.registrationStatus.length > 0 && !filters.registrationStatus.includes(item.registrationStatus))
        return false;
      if (filters.contributor.length > 0) {
        const ids = new Set(item.contributors.map((c) => c.personId));
        if (!filters.contributor.some((id) => ids.has(id))) return false;
      }
      if (filters.link === "Has Link" && !item.link) return false;
      if (filters.link === "No Link" && item.link) return false;
      if (filters.price.min !== null && item.price < filters.price.min) return false;
      if (filters.price.max !== null && item.price > filters.price.max) return false;
      if (query && !item.name.toLowerCase().includes(query) && !item.notes.toLowerCase().includes(query))
        return false;
      return true;
    });
  }, [items, filters]);

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];
    const dir = sortDirection === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "price":
          cmp = a.price - b.price;
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "priority":
          cmp = a.priority.localeCompare(b.priority);
          break;
        case "registry":
          cmp = a.registry.localeCompare(b.registry);
          break;
        case "registrationStatus":
          cmp = a.registrationStatus.localeCompare(b.registrationStatus);
          break;
        case "createdAt":
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
      }
      return cmp * dir;
    });
    return sorted;
  }, [filteredItems, sortField, sortDirection]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, RegistryItem[]> = {};
    for (const item of sortedItems) {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    }
    return groups;
  }, [sortedItems]);

  const totalPrice = useMemo(() => {
    return Math.round(filteredItems.reduce((sum, item) => sum + item.price, 0) * 100) / 100;
  }, [filteredItems]);

  const { priceByCategory, categoryCounts } = useMemo(() => {
    const prices: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const item of filteredItems) {
      prices[item.category] = Math.round(((prices[item.category] || 0) + item.price) * 100) / 100;
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return { priceByCategory: prices, categoryCounts: counts };
  }, [filteredItems]);

  const registryAggregates = useMemo(() => {
    const aggregates: Record<string, { count: number; totalPrice: number }> = {};
    for (const item of filteredItems) {
      const key = item.registry || "(none)";
      if (!aggregates[key]) aggregates[key] = { count: 0, totalPrice: 0 };
      aggregates[key].count++;
      aggregates[key].totalPrice =
        Math.round((aggregates[key].totalPrice + item.price) * 100) / 100;
    }
    return aggregates;
  }, [filteredItems]);

  const priceHistogram = useMemo<PriceBucket[]>(() => {
    const priced = filteredItems.filter((i) => i.price > 0);
    const noPriceCount = filteredItems.length - priced.length;

    if (priced.length === 0) {
      return noPriceCount > 0
        ? [{ label: "No price", min: 0, max: 0, count: noPriceCount }]
        : [];
    }

    const max = Math.max(...priced.map((i) => i.price));
    let binWidth: number;
    if (max <= 200) binWidth = 25;
    else if (max <= 500) binWidth = 50;
    else if (max <= 1000) binWidth = 100;
    else binWidth = 250;

    const binCount = Math.ceil(max / binWidth);
    const buckets: PriceBucket[] = Array.from({ length: binCount }, (_, i) => {
      const min = i * binWidth;
      const upper = min + binWidth;
      return {
        label: `$${min}–$${upper}`,
        min,
        max: upper,
        count: 0,
      };
    });

    for (const item of priced) {
      const idx = Math.min(Math.floor(item.price / binWidth), binCount - 1);
      buckets[idx].count++;
    }

    if (noPriceCount > 0) {
      buckets.unshift({ label: "No price", min: 0, max: 0, count: noPriceCount });
    }

    return buckets;
  }, [filteredItems]);

  const statusCounts = useMemo(() => {
    const counts: Record<ItemStatus, number> = {
      "": 0,
      "Researching": 0,
      "Decided": 0,
      "Purchased": 0,
      "Received": 0,
      "Not Needed": 0,
    };
    for (const item of filteredItems) {
      counts[item.status]++;
    }
    return counts;
  }, [filteredItems]);

  const thankYouProgress = useMemo(() => {
    let sent = 0;
    for (const card of thankYouCards) {
      if (card.status === "Sent") sent++;
    }
    return { sent, total: thankYouCards.length };
  }, [thankYouCards]);

  const globalProgress = useMemo(() => {
    if (items.length === 0) return { percentage: 0, resolved: 0, total: 0 };
    let resolved = 0;
    for (const item of items) {
      if (
        item.status === "Decided" ||
        item.status === "Purchased" ||
        item.status === "Received" ||
        item.status === "Not Needed"
      ) {
        resolved++;
      }
    }
    return {
      percentage: Math.round((resolved / items.length) * 100),
      resolved,
      total: items.length,
    };
  }, [items]);

  const priceBounds = useMemo(() => {
    if (items.length === 0) return { min: 0, max: 0 };
    let max = 0;
    for (const item of items) {
      if (item.price > max) max = item.price;
    }
    return { min: 0, max: Math.ceil(max) };
  }, [items]);

  const registries = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.registry) set.add(item.registry);
    }
    return Array.from(set).sort();
  }, [items]);

  const categoryProgress = useMemo(() => {
    const stats: Record<string, { total: number; resolved: number; percentage: number }> = {};
    const RESOLVED_STATUSES: ItemStatus[] = ["Decided", "Not Needed", "Purchased", "Received"];

    for (const item of filteredItems) {
      if (!stats[item.category]) {
        stats[item.category] = { total: 0, resolved: 0, percentage: 0 };
      }
      stats[item.category].total++;
      if (RESOLVED_STATUSES.includes(item.status)) {
        stats[item.category].resolved++;
      }
    }

    for (const cat in stats) {
      const s = stats[cat];
      s.percentage = s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0;
    }

    return stats;
  }, [filteredItems]);

  const priorityCounts = useMemo(() => {
    const counts: Record<ItemPriority, number> = {
      Necessary: 0,
      "Nice to Have": 0,
      "": 0,
    };
    for (const item of filteredItems) {
      counts[item.priority]++;
    }
    return counts;
  }, [filteredItems]);

  // Faceted counts per attribute — for each dimension, count items matching
  // every OTHER active filter (and the text search) but ignoring its own
  // dimension. Standard faceted-search pattern (Amazon / Linear / Notion):
  // the sidebar always shows what would happen if you also picked a value,
  // without hiding options that would expand the result set.
  const attributeCounts = useMemo(() => {
    const query = filters.search.toLowerCase();
    const matchesSearch = (item: typeof items[number]) => {
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.notes.toLowerCase().includes(query)
      );
    };
    const matchesStage = (item: typeof items[number]) =>
      filters.stage.length === 0 ||
      filters.stage.includes(getStatusStage(item.status));
    const matchesStatus = (item: typeof items[number]) =>
      filters.status.length === 0 || filters.status.includes(item.status);
    const matchesPriority = (item: typeof items[number]) =>
      filters.priority.length === 0 || filters.priority.includes(item.priority);
    const matchesCategory = (item: typeof items[number]) =>
      filters.category.length === 0 || filters.category.includes(item.category);
    const matchesRegistry = (item: typeof items[number]) =>
      filters.registry.length === 0 || filters.registry.includes(item.registry);
    const matchesRegistrationStatus = (item: typeof items[number]) =>
      filters.registrationStatus.length === 0 ||
      filters.registrationStatus.includes(item.registrationStatus);
    const matchesContributor = (item: typeof items[number]) => {
      if (filters.contributor.length === 0) return true;
      const ids = new Set(item.contributors.map((c) => c.personId));
      return filters.contributor.some((id) => ids.has(id));
    };
    const matchesLink = (item: typeof items[number]) => {
      if (filters.link === "All") return true;
      if (filters.link === "Has Link") return !!item.link;
      return !item.link;
    };
    const matchesPrice = (item: typeof items[number]) => {
      if (filters.price.min !== null && item.price < filters.price.min) return false;
      if (filters.price.max !== null && item.price > filters.price.max) return false;
      return true;
    };

    const stage: Record<StatusStage, number> = {
      "Action Required": 0,
      Done: 0,
    };
    const status: Record<string, number> = {
      "": 0,
      Researching: 0,
      Decided: 0,
      Purchased: 0,
      Received: 0,
      "Not Needed": 0,
    };
    const priority: Record<string, number> = {
      "": 0,
      Necessary: 0,
      "Nice to Have": 0,
    };
    const category: Record<string, number> = {};
    const registry: Record<string, number> = {};
    const registrationStatus: Record<string, number> = {
      "": 0,
      "Needs Registration": 0,
      Registered: 0,
      "N/A": 0,
    };
    const contributor: Record<string, number> = {};
    let hasLink = 0;
    let noLink = 0;
    let totalLink = 0;

    for (const item of items) {
      if (!matchesSearch(item)) continue;

      // Stage section: ignore stage filter, apply all others.
      if (
        matchesStatus(item) &&
        matchesPriority(item) &&
        matchesCategory(item) &&
        matchesRegistry(item) &&
        matchesRegistrationStatus(item) &&
        matchesContributor(item) &&
        matchesLink(item) &&
        matchesPrice(item)
      ) {
        const s = getStatusStage(item.status);
        stage[s] = (stage[s] ?? 0) + 1;
      }

      // Status section: ignore status filter, apply all others.
      if (
        matchesStage(item) &&
        matchesPriority(item) &&
        matchesCategory(item) &&
        matchesRegistry(item) &&
        matchesRegistrationStatus(item) &&
        matchesContributor(item) &&
        matchesLink(item) &&
        matchesPrice(item)
      ) {
        status[item.status] = (status[item.status] ?? 0) + 1;
      }

      // Priority section: ignore priority filter.
      if (
        matchesStage(item) &&
        matchesStatus(item) &&
        matchesCategory(item) &&
        matchesRegistry(item) &&
        matchesRegistrationStatus(item) &&
        matchesContributor(item) &&
        matchesLink(item) &&
        matchesPrice(item)
      ) {
        priority[item.priority] = (priority[item.priority] ?? 0) + 1;
      }

      // Category section: ignore category filter.
      if (
        matchesStage(item) &&
        matchesStatus(item) &&
        matchesPriority(item) &&
        matchesRegistry(item) &&
        matchesRegistrationStatus(item) &&
        matchesContributor(item) &&
        matchesLink(item) &&
        matchesPrice(item)
      ) {
        category[item.category] = (category[item.category] ?? 0) + 1;
      }

      // Registry section: ignore registry filter.
      if (
        matchesStage(item) &&
        matchesStatus(item) &&
        matchesPriority(item) &&
        matchesCategory(item) &&
        matchesRegistrationStatus(item) &&
        matchesContributor(item) &&
        matchesLink(item) &&
        matchesPrice(item)
      ) {
        registry[item.registry] = (registry[item.registry] ?? 0) + 1;
      }

      // Registration status section: ignore registrationStatus filter.
      if (
        matchesStage(item) &&
        matchesStatus(item) &&
        matchesPriority(item) &&
        matchesCategory(item) &&
        matchesRegistry(item) &&
        matchesContributor(item) &&
        matchesLink(item) &&
        matchesPrice(item)
      ) {
        registrationStatus[item.registrationStatus] =
          (registrationStatus[item.registrationStatus] ?? 0) + 1;
      }

      // Contributor section: ignore contributor filter.
      if (
        matchesStage(item) &&
        matchesStatus(item) &&
        matchesPriority(item) &&
        matchesCategory(item) &&
        matchesRegistry(item) &&
        matchesRegistrationStatus(item) &&
        matchesLink(item) &&
        matchesPrice(item)
      ) {
        for (const c of item.contributors) {
          contributor[c.personId] = (contributor[c.personId] ?? 0) + 1;
        }
      }

      // Link section: ignore link filter.
      if (
        matchesStage(item) &&
        matchesStatus(item) &&
        matchesPriority(item) &&
        matchesCategory(item) &&
        matchesRegistry(item) &&
        matchesRegistrationStatus(item) &&
        matchesContributor(item) &&
        matchesPrice(item)
      ) {
        if (item.link) hasLink++;
        else noLink++;
        totalLink++;
      }
    }

    return { stage, status, priority, category, registry, registrationStatus, contributor, hasLink, noLink, total: totalLink };
  }, [items, filters]);

  return {
    items,
    categories,
    people,
    thankYouCards,
    settings,
    thankYouProgress,
    filters,
    filteredItems,
    sortedItems,
    groupedItems,
    totalPrice,
    priceByCategory,
    categoryCounts,
    categoryProgress,
    registries,
    registryAggregates,
    priceBounds,
    priceHistogram,
    globalProgress,
    statusCounts,
    priorityCounts,
    attributeCounts,
    loading,
    viewMode,
    sortField,
    sortDirection,
    setViewMode,
    setSortField,
    setSortDirection,
    addItem,
    updateItem,
    deleteItem,
    setFilters,
    resetFilters,
    addCategory,
    removeCategory,
    addPerson,
    updatePerson,
    removePerson,
    bulkAddPeople,
    updateThankYouCard,
    updateSettings,
    sharePersonCard,
    unlinkPersonCard,
    mergePerson,
    exportData: handleExport,
    importData: handleImport,
  };
}
