import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import db from "./db.js";
import { scrapeProductLink } from "./scrape.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file if present (for environments that don't use --env-file)
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx);
      const val = trimmed.slice(eqIdx + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// --- Audit logging helpers ---

import type { Request, Response } from "express";

function getActor(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : null) || req.ip || "unknown";
  const device = req.headers["x-device-name"];
  return device ? `${device} (${ip})` : String(ip);
}

// Per-tab unique id from the client (sessionStorage-backed). Used as the
// `source` field on broadcast events so the originating tab can suppress
// its own echo. Falls back to empty string when missing (older clients).
function getSource(req: Request): string {
  const v = req.headers["x-tab-id"];
  return typeof v === "string" ? v : "";
}

const insertAudit = db.prepare(
  `INSERT INTO audit_log (entity_type, entity_id, action, field_name, old_value, new_value, actor, changed_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

// Field mapping: camelCase request body key → snake_case DB column for comparison
const ITEM_FIELDS: Record<string, string> = {
  name: "name", category: "category", status: "status", priority: "priority",
  price: "price", link: "link", notes: "notes", registry: "registry",
  imageUrl: "image_url", productName: "product_name",
  registrationStatus: "registration_status",
};

const PEOPLE_FIELDS: Record<string, string> = {
  name: "name", email: "email", notes: "notes",
  thankYouCardId: "thank_you_card_id",
};

const CARD_FIELDS: Record<string, string> = {
  label: "label", mailingName: "mailing_name", address: "address", note: "note",
  hint: "hint", status: "status", sentAt: "sent_at",
};

const VALID_CARD_STATUSES = new Set(["", "Drafted", "Ready to Send", "Sent"]);

// --- Realtime broadcast (SSE) ---
// All mutation handlers call `broadcast(...)` after their DB transaction
// commits. Connected clients (via GET /api/updates) get the event pushed.
// The shape mirrors `ChangeEvent` in src/types/index.ts — keep them in sync.

type ChangeEvent =
  | { kind: "item-upsert"; item: ReturnType<typeof loadItem>; actor: string; source: string }
  | { kind: "item-delete"; id: string; actor: string; source: string }
  | { kind: "category-upsert"; name: string; actor: string; source: string }
  | { kind: "category-delete"; name: string; actor: string; source: string }
  | { kind: "person-upsert"; person: ReturnType<typeof loadPerson>; actor: string; source: string }
  | { kind: "person-delete"; id: string; actor: string; source: string }
  | { kind: "card-upsert"; card: ReturnType<typeof loadCard>; actor: string; source: string }
  | { kind: "card-delete"; id: string; actor: string; source: string }
  | { kind: "settings-upsert"; settings: ReturnType<typeof loadSettings>; actor: string; source: string }
  | { kind: "import-replaced"; actor: string; source: string };

interface SseClient {
  res: Response;
  deviceName: string;
}

const sseClients = new Set<SseClient>();

function broadcast(event: ChangeEvent) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(payload);
    } catch {
      // Connection dead — will be removed by its own 'close' handler.
    }
  }
}

// --- Categories ---

app.get("/api/categories", (_req, res) => {
  const rows = db.prepare("SELECT name FROM categories ORDER BY rowid").all() as { name: string }[];
  res.json(rows.map((r) => r.name));
});

app.post("/api/categories", (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Category name required" });
  }
  const trimmed = name.trim();
  try {
    const actor = getActor(req);
    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)").run(trimmed);
      insertAudit.run("category", trimmed, "CREATE", null, null, trimmed, actor, now);
    });
    tx();
    broadcast({ kind: "category-upsert", name: trimmed, actor, source: getSource(req) });
    res.json({ name: trimmed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/categories/:name", (req, res) => {
  const { name } = req.params;
  const hasItems = db.prepare("SELECT 1 FROM items WHERE category = ? LIMIT 1").get(name);
  if (hasItems) {
    return res.status(409).json({ error: "Category has items" });
  }
  const actor = getActor(req);
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM categories WHERE name = ?").run(name);
    insertAudit.run("category", name, "DELETE", null, name, null, actor, now);
  });
  tx();
  broadcast({ kind: "category-delete", name, actor, source: getSource(req) });
  res.json({ ok: true });
});

// --- Items ---

interface ItemRow {
  id: string;
  name: string;
  category: string;
  status: string;
  priority: string;
  price: number;
  link: string;
  notes: string;
  registry: string;
  image_url: string;
  product_name: string;
  registration_status: string;
  created_at: string;
  updated_at: string;
}

interface ContributorRow {
  item_id: string;
  person_id: string;
  amount: number | null;
  person_name: string;
}

function getContributorsForItems(itemIds: string[]): Map<string, { personId: string; personName: string; amount: number | null }[]> {
  const out = new Map<string, { personId: string; personName: string; amount: number | null }[]>();
  if (itemIds.length === 0) return out;
  const placeholders = itemIds.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT ic.item_id, ic.person_id, ic.amount, p.name AS person_name
     FROM item_contributors ic
     JOIN people p ON p.id = ic.person_id
     WHERE ic.item_id IN (${placeholders})
     ORDER BY p.name`
  ).all(...itemIds) as ContributorRow[];
  for (const r of rows) {
    if (!out.has(r.item_id)) out.set(r.item_id, []);
    out.get(r.item_id)!.push({ personId: r.person_id, personName: r.person_name, amount: r.amount });
  }
  return out;
}

function rowToItem(row: ItemRow, contributors: { personId: string; personName: string; amount: number | null }[] = []) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    status: row.status,
    priority: row.priority,
    price: row.price,
    link: row.link,
    notes: row.notes,
    registry: row.registry,
    imageUrl: row.image_url,
    productName: row.product_name,
    registrationStatus: row.registration_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contributors,
  };
}

function loadItem(id: string) {
  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as ItemRow | undefined;
  if (!row) return null;
  const contribs = getContributorsForItems([id]).get(id) ?? [];
  return rowToItem(row, contribs);
}

function loadItems() {
  const rows = db.prepare("SELECT * FROM items ORDER BY created_at").all() as ItemRow[];
  const contribs = getContributorsForItems(rows.map((r) => r.id));
  return rows.map((r) => rowToItem(r, contribs.get(r.id) ?? []));
}

// Determine whether an item with the given price and contributor list is
// fully paid for. Used to auto-mark items as "Purchased" only when the money
// adds up to the price — never when it's partial.
// Rules:
//   - price <= 0: indeterminate, return false (don't auto-transition)
//   - 0 contributors: false
//   - exactly 1 contributor with no explicit amount: assumed sole, full coverage
//   - otherwise: sum of explicit amounts (null counts as 0) must reach price
function isFullyPurchased(
  itemPrice: number,
  contributors: { amount: number | null }[]
): boolean {
  if (itemPrice <= 0) return false;
  if (contributors.length === 0) return false;
  if (contributors.length === 1 && contributors[0].amount === null) return true;
  const total = contributors.reduce((sum, c) => sum + (c.amount ?? 0), 0);
  return total >= itemPrice;
}

// Apply a contributors array to an item inside an existing transaction.
// Diffs against current rows, inserts/deletes as needed, and writes one audit
// entry per added/removed person.
const insertContrib = db.prepare(
  `INSERT INTO item_contributors (item_id, person_id, amount, created_at) VALUES (?, ?, ?, ?)`
);
const updateContribAmount = db.prepare(
  `UPDATE item_contributors SET amount = ? WHERE item_id = ? AND person_id = ?`
);
const deleteContrib = db.prepare(
  `DELETE FROM item_contributors WHERE item_id = ? AND person_id = ?`
);

function applyContributors(
  itemId: string,
  contributors: { personId: string; amount?: number | null }[],
  actor: string,
  now: string,
) {
  // Validate person IDs up-front
  const personIds = contributors.map((c) => c.personId);
  const seen = new Set<string>();
  for (const id of personIds) {
    if (seen.has(id)) throw new Error(`Duplicate contributor: ${id}`);
    seen.add(id);
  }
  const personNames = new Map<string, string>();
  if (personIds.length > 0) {
    const placeholders = personIds.map(() => "?").join(",");
    const rows = db.prepare(`SELECT id, name FROM people WHERE id IN (${placeholders})`).all(...personIds) as { id: string; name: string }[];
    for (const r of rows) personNames.set(r.id, r.name);
    for (const id of personIds) {
      if (!personNames.has(id)) throw new Error(`Person not found: ${id}`);
    }
  }

  const existingRows = db.prepare(
    `SELECT person_id, amount FROM item_contributors WHERE item_id = ?`
  ).all(itemId) as { person_id: string; amount: number | null }[];
  const existing = new Map(existingRows.map((r) => [r.person_id, r.amount]));
  const next = new Map(contributors.map((c) => [c.personId, c.amount ?? null]));

  // Removals
  for (const [pid, _amt] of existing) {
    if (!next.has(pid)) {
      deleteContrib.run(itemId, pid);
      // Look up person name even if they were just removed
      const row = db.prepare("SELECT name FROM people WHERE id = ?").get(pid) as { name: string } | undefined;
      insertAudit.run("item", itemId, "UPDATE", "contributor", row?.name ?? pid, null, actor, now);
    }
  }
  // Adds + amount changes
  for (const [pid, amt] of next) {
    if (!existing.has(pid)) {
      insertContrib.run(itemId, pid, amt, now);
      insertAudit.run("item", itemId, "UPDATE", "contributor", null, personNames.get(pid) ?? pid, actor, now);
    } else if (existing.get(pid) !== amt) {
      updateContribAmount.run(amt, itemId, pid);
      const name = personNames.get(pid) ?? pid;
      const oldStr = existing.get(pid) === null ? `${name}` : `${name} ($${existing.get(pid)})`;
      const newStr = amt === null ? `${name}` : `${name} ($${amt})`;
      insertAudit.run("item", itemId, "UPDATE", "contributor_amount", oldStr, newStr, actor, now);
    }
  }
}

app.get("/api/items", (_req, res) => {
  res.json(loadItems());
});

app.get("/api/items/:id", (req, res) => {
  const item = loadItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

app.post("/api/items", (req, res) => {
  const { name, category, status, priority, price, link, notes, registry, imageUrl, productName, registrationStatus, contributors } = req.body;
  const now = new Date().toISOString();
  const id = uuidv4();
  const actor = getActor(req);
  // Auto-mark as "Purchased" when an item is created with contributors whose
  // amounts fully cover the price, and the caller didn't explicitly set a
  // status. Partial coverage does NOT auto-transition.
  const explicitStatus = req.body.status !== undefined;
  const wouldBeFullyPurchased =
    !explicitStatus &&
    Array.isArray(contributors) &&
    isFullyPurchased(price ?? 0, contributors);
  const effectiveStatus = wouldBeFullyPurchased ? "Purchased" : (status ?? "");
  try {
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO items (id, name, category, status, priority, price, link, notes, registry, image_url, product_name, registration_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, name, category, effectiveStatus, priority, price ?? 0, link ?? "", notes ?? "", registry ?? "", imageUrl ?? "", productName ?? "", registrationStatus ?? "", now, now);
      insertAudit.run("item", id, "CREATE", null, null, name, actor, now);
      if (Array.isArray(contributors)) {
        applyContributors(id, contributors, actor, now);
      }
    });
    tx();
    const item = loadItem(id)!;
    broadcast({ kind: "item-upsert", item, actor, source: getSource(req) });
    // Rebroadcast each new contributor so the People tab stays live —
    // their contributions list now includes this item.
    if (Array.isArray(contributors)) {
      for (const c of contributors) {
        const person = loadPerson(c.personId);
        if (person) broadcast({ kind: "person-upsert", person, actor, source: getSource(req) });
      }
    }
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/items/:id", (req, res) => {
  const { id } = req.params;
  const existing = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as ItemRow | undefined;
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { name, category, status, priority, price, link, notes, registry, imageUrl, productName, registrationStatus, contributors } = req.body;
  const now = new Date().toISOString();
  const actor = getActor(req);

  // Build the new values, falling back to existing
  const newVals: Record<string, unknown> = {
    name: name ?? existing.name,
    category: category ?? existing.category,
    status: status ?? existing.status,
    priority: priority ?? existing.priority,
    price: price ?? existing.price,
    link: link ?? existing.link,
    notes: notes ?? existing.notes,
    registry: registry ?? existing.registry,
    imageUrl: imageUrl ?? existing.image_url,
    productName: productName ?? existing.product_name,
    registrationStatus: registrationStatus ?? existing.registration_status,
  };

  // Auto-mark Purchased when an update flips the item from "not fully covered"
  // to "fully covered" — and only if:
  //   - the caller hasn't explicitly set a status in this same PUT
  //   - the item is still in a "haven't bought it yet" state ("", Researching,
  //     Decided). We don't downgrade from Received or override a deliberate
  //     "Not Needed".
  const PROMOTABLE_FROM = new Set(["", "Researching", "Decided"]);
  if (req.body.status === undefined && PROMOTABLE_FROM.has(existing.status)) {
    const existingContribs = db
      .prepare("SELECT amount FROM item_contributors WHERE item_id = ?")
      .all(id) as { amount: number | null }[];
    const nextContribs = Array.isArray(contributors)
      ? (contributors as { amount: number | null }[])
      : existingContribs;
    const wasFull = isFullyPurchased(existing.price, existingContribs);
    const willBeFull = isFullyPurchased(newVals.price as number, nextContribs);
    if (!wasFull && willBeFull) {
      newVals.status = "Purchased";
    }
  }

  // Snapshot every person currently or about-to-be on this item so we can
  // rebroadcast all of them — their `contributions` list will have shifted
  // even if they themselves stayed on the item (e.g. another contributor's
  // amount changed, or the item's price changed, or contributorCount changed).
  const affectedPersonIds = new Set<string>();
  if (Array.isArray(contributors)) {
    const existingContribIds = (db
      .prepare("SELECT person_id FROM item_contributors WHERE item_id = ?")
      .all(id) as { person_id: string }[]).map((r) => r.person_id);
    for (const pid of existingContribIds) affectedPersonIds.add(pid);
    for (const c of contributors) affectedPersonIds.add(c.personId);
  }

  try {
    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE items SET name=?, category=?, status=?, priority=?, price=?, link=?, notes=?, registry=?, image_url=?, product_name=?, registration_status=?, updated_at=? WHERE id=?`
      ).run(
        newVals.name, newVals.category, newVals.status, newVals.priority,
        newVals.price, newVals.link, newVals.notes, newVals.registry,
        newVals.imageUrl, newVals.productName, newVals.registrationStatus, now, id
      );

      // Log each changed field
      for (const [camelKey, dbCol] of Object.entries(ITEM_FIELDS)) {
        const oldVal = String((existing as Record<string, unknown>)[dbCol] ?? "");
        const newVal = String(newVals[camelKey] ?? "");
        if (oldVal !== newVal) {
          insertAudit.run("item", id, "UPDATE", camelKey, oldVal, newVal, actor, now);
        }
      }

      if (Array.isArray(contributors)) {
        applyContributors(id, contributors, actor, now);
      }
    });
    tx();
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }

  const item = loadItem(id)!;
  broadcast({ kind: "item-upsert", item, actor, source: getSource(req) });
  // Rebroadcast everyone whose contributions list was touched by this update.
  for (const pid of affectedPersonIds) {
    const person = loadPerson(pid);
    if (person) broadcast({ kind: "person-upsert", person, actor, source: getSource(req) });
  }
  res.json(item);
});

app.delete("/api/items/:id", (req, res) => {
  const { id } = req.params;
  const existing = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as ItemRow | undefined;
  const actor = getActor(req);
  const now = new Date().toISOString();
  // Snapshot contributors before deletion so we can refresh their People tab
  // entries — cascade delete will drop their item_contributors rows.
  const affectedPersonIds = (db
    .prepare("SELECT person_id FROM item_contributors WHERE item_id = ?")
    .all(id) as { person_id: string }[]).map((r) => r.person_id);
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM items WHERE id = ?").run(id);
    insertAudit.run("item", id, "DELETE", null, existing?.name ?? id, null, actor, now);
  });
  tx();
  broadcast({ kind: "item-delete", id, actor, source: getSource(req) });
  for (const pid of affectedPersonIds) {
    const person = loadPerson(pid);
    if (person) broadcast({ kind: "person-upsert", person, actor, source: getSource(req) });
  }
  res.json({ ok: true });
});

// --- Thank-you cards & people ---

interface CardRow {
  id: string;
  label: string;
  mailing_name: string;
  address: string;
  note: string;
  hint: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PersonRow {
  id: string;
  name: string;
  email: string;
  notes: string;
  thank_you_card_id: string;
  created_at: string;
  updated_at: string;
}

function rowToCard(row: CardRow, memberIds: string[] = []) {
  return {
    id: row.id,
    label: row.label,
    mailingName: row.mailing_name,
    address: row.address,
    note: row.note,
    hint: row.hint,
    status: row.status,
    sentAt: row.sent_at,
    memberIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function loadCard(id: string) {
  const row = db.prepare("SELECT * FROM thank_you_cards WHERE id = ?").get(id) as CardRow | undefined;
  if (!row) return null;
  const members = db.prepare("SELECT id FROM people WHERE thank_you_card_id = ? ORDER BY name").all(id) as { id: string }[];
  return rowToCard(row, members.map((m) => m.id));
}

function loadCards() {
  const rows = db.prepare("SELECT * FROM thank_you_cards ORDER BY created_at").all() as CardRow[];
  const members = db.prepare("SELECT id, thank_you_card_id FROM people ORDER BY name").all() as { id: string; thank_you_card_id: string }[];
  const byCard = new Map<string, string[]>();
  for (const m of members) {
    if (!byCard.has(m.thank_you_card_id)) byCard.set(m.thank_you_card_id, []);
    byCard.get(m.thank_you_card_id)!.push(m.id);
  }
  return rows.map((r) => rowToCard(r, byCard.get(r.id) ?? []));
}

function rowToPerson(
  row: PersonRow,
  card: ReturnType<typeof rowToCard> | null,
  contributions: {
    itemId: string;
    itemName: string;
    amount: number | null;
    itemPrice: number;
    contributorCount: number;
  }[] = []
) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    notes: row.notes,
    thankYouCardId: row.thank_you_card_id,
    thankYouCard: card,
    contributions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getContributionsForPeople(personIds: string[]): Map<string, {
  itemId: string;
  itemName: string;
  amount: number | null;
  itemPrice: number;
  contributorCount: number;
}[]> {
  const out = new Map<string, {
    itemId: string;
    itemName: string;
    amount: number | null;
    itemPrice: number;
    contributorCount: number;
  }[]>();
  if (personIds.length === 0) return out;
  const placeholders = personIds.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT
       ic.person_id,
       ic.item_id,
       ic.amount,
       i.name AS item_name,
       i.price AS item_price,
       (SELECT COUNT(*) FROM item_contributors WHERE item_id = ic.item_id) AS contributor_count
     FROM item_contributors ic
     JOIN items i ON i.id = ic.item_id
     WHERE ic.person_id IN (${placeholders})
     ORDER BY i.name`
  ).all(...personIds) as {
    person_id: string;
    item_id: string;
    item_name: string;
    amount: number | null;
    item_price: number;
    contributor_count: number;
  }[];
  for (const r of rows) {
    if (!out.has(r.person_id)) out.set(r.person_id, []);
    out.get(r.person_id)!.push({
      itemId: r.item_id,
      itemName: r.item_name,
      amount: r.amount,
      itemPrice: r.item_price,
      contributorCount: r.contributor_count,
    });
  }
  return out;
}

function loadPerson(id: string) {
  const row = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as PersonRow | undefined;
  if (!row) return null;
  const card = loadCard(row.thank_you_card_id);
  const contribs = getContributionsForPeople([id]).get(id) ?? [];
  return rowToPerson(row, card, contribs);
}

function loadPeople() {
  const rows = db.prepare("SELECT * FROM people ORDER BY name").all() as PersonRow[];
  if (rows.length === 0) return [];
  const cardIds = [...new Set(rows.map((r) => r.thank_you_card_id))];
  const cardPlaceholders = cardIds.map(() => "?").join(",");
  const cardRows = db.prepare(`SELECT * FROM thank_you_cards WHERE id IN (${cardPlaceholders})`).all(...cardIds) as CardRow[];
  const memberRows = db.prepare(`SELECT id, thank_you_card_id FROM people WHERE thank_you_card_id IN (${cardPlaceholders}) ORDER BY name`).all(...cardIds) as { id: string; thank_you_card_id: string }[];
  const membersByCard = new Map<string, string[]>();
  for (const m of memberRows) {
    if (!membersByCard.has(m.thank_you_card_id)) membersByCard.set(m.thank_you_card_id, []);
    membersByCard.get(m.thank_you_card_id)!.push(m.id);
  }
  const cardById = new Map(cardRows.map((c) => [c.id, rowToCard(c, membersByCard.get(c.id) ?? [])]));
  const contribs = getContributionsForPeople(rows.map((r) => r.id));
  return rows.map((r) => rowToPerson(r, cardById.get(r.thank_you_card_id) ?? null, contribs.get(r.id) ?? []));
}

function createCard(now: string, init?: Partial<{ label: string; mailingName: string; address: string; note: string }>): string {
  const cardId = uuidv4();
  db.prepare(
    `INSERT INTO thank_you_cards (id, label, mailing_name, address, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(cardId, init?.label ?? "", init?.mailingName ?? "", init?.address ?? "", init?.note ?? "", now, now);
  return cardId;
}

function deleteCardIfEmpty(cardId: string, actor: string, now: string) {
  const stillUsed = db.prepare("SELECT 1 FROM people WHERE thank_you_card_id = ? LIMIT 1").get(cardId);
  if (!stillUsed) {
    db.prepare("DELETE FROM thank_you_cards WHERE id = ?").run(cardId);
    insertAudit.run("thank_you_card", cardId, "DELETE", null, "card", null, actor, now);
    broadcast({ kind: "card-delete", id: cardId, actor, source: "" });
  }
}

// People

app.get("/api/people", (_req, res) => {
  res.json(loadPeople());
});

app.get("/api/people/:id", (req, res) => {
  const person = loadPerson(req.params.id);
  if (!person) return res.status(404).json({ error: "Not found" });
  res.json(person);
});

app.post("/api/people", (req, res) => {
  const { name, email, notes, thankYouCardId } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  const trimmed = name.trim();
  const now = new Date().toISOString();
  const id = uuidv4();
  const actor = getActor(req);
  let createdCardId: string | null = null;
  try {
    const tx = db.transaction(() => {
      let cardId = thankYouCardId;
      if (!cardId) {
        cardId = createCard(now);
        createdCardId = cardId;
        insertAudit.run("thank_you_card", cardId, "CREATE", null, null, trimmed, actor, now);
      } else {
        const exists = db.prepare("SELECT 1 FROM thank_you_cards WHERE id = ?").get(cardId);
        if (!exists) throw new Error("thank_you_card not found");
      }
      db.prepare(
        `INSERT INTO people (id, name, email, notes, thank_you_card_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, trimmed, email ?? "", notes ?? "", cardId, now, now);
      insertAudit.run("person", id, "CREATE", null, null, trimmed, actor, now);
    });
    tx();
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
  const person = loadPerson(id)!;
  if (createdCardId) {
    const card = loadCard(createdCardId);
    if (card) broadcast({ kind: "card-upsert", card, actor, source: getSource(req) });
  }
  broadcast({ kind: "person-upsert", person, actor, source: getSource(req) });
  res.json(person);
});

app.post("/api/people/bulk", (req, res) => {
  const { names } = req.body;
  if (!Array.isArray(names)) return res.status(400).json({ error: "names array required" });
  const now = new Date().toISOString();
  const actor = getActor(req);
  const created: string[] = [];
  const skipped: string[] = [];

  // Dedupe case-insensitively against existing names AND within the batch.
  const existingRows = db.prepare("SELECT name FROM people").all() as { name: string }[];
  const existingLower = new Set(existingRows.map((r) => r.name.toLowerCase()));
  const seenInBatch = new Set<string>();

  try {
    const tx = db.transaction(() => {
      for (const raw of names) {
        if (typeof raw !== "string") continue;
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        if (existingLower.has(lower) || seenInBatch.has(lower)) {
          skipped.push(trimmed);
          continue;
        }
        seenInBatch.add(lower);
        const id = uuidv4();
        const cardId = createCard(now);
        insertAudit.run("thank_you_card", cardId, "CREATE", null, null, trimmed, actor, now);
        db.prepare(
          `INSERT INTO people (id, name, email, notes, thank_you_card_id, created_at, updated_at)
           VALUES (?, ?, '', '', ?, ?, ?)`
        ).run(id, trimmed, cardId, now, now);
        insertAudit.run("person", id, "CREATE", null, null, trimmed, actor, now);
        created.push(id);
      }
    });
    tx();
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }

  for (const id of created) {
    const person = loadPerson(id);
    if (person) broadcast({ kind: "person-upsert", person, actor, source: getSource(req) });
    if (person?.thankYouCard) {
      broadcast({ kind: "card-upsert", card: person.thankYouCard, actor, source: getSource(req) });
    }
  }
  res.json({ created: created.length, skipped, createdIds: created });
});

app.put("/api/people/:id", (req, res) => {
  const { id } = req.params;
  const existing = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as PersonRow | undefined;
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { name, email, notes, thankYouCardId } = req.body;
  const now = new Date().toISOString();
  const actor = getActor(req);

  const newVals: Record<string, unknown> = {
    name: name ?? existing.name,
    email: email ?? existing.email,
    notes: notes ?? existing.notes,
    thankYouCardId: thankYouCardId ?? existing.thank_you_card_id,
  };

  if (typeof newVals.name === "string" && !newVals.name.trim()) {
    return res.status(400).json({ error: "Name cannot be empty" });
  }

  const oldCardId = existing.thank_you_card_id;
  const newCardId = String(newVals.thankYouCardId);
  let releasedCard: string | null = null;

  try {
    const tx = db.transaction(() => {
      if (newCardId !== oldCardId) {
        const exists = db.prepare("SELECT 1 FROM thank_you_cards WHERE id = ?").get(newCardId);
        if (!exists) throw new Error("thank_you_card not found");
      }
      db.prepare(
        `UPDATE people SET name=?, email=?, notes=?, thank_you_card_id=?, updated_at=? WHERE id=?`
      ).run(newVals.name, newVals.email, newVals.notes, newCardId, now, id);

      for (const [camelKey, dbCol] of Object.entries(PEOPLE_FIELDS)) {
        const oldVal = String((existing as Record<string, unknown>)[dbCol] ?? "");
        const newVal = String(newVals[camelKey] ?? "");
        if (oldVal !== newVal) {
          insertAudit.run("person", id, "UPDATE", camelKey, oldVal, newVal, actor, now);
        }
      }

      if (newCardId !== oldCardId) {
        releasedCard = oldCardId;
      }
    });
    tx();
    if (releasedCard) {
      deleteCardIfEmpty(releasedCard, actor, now);
    }
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }

  const person = loadPerson(id)!;
  broadcast({ kind: "person-upsert", person, actor, source: getSource(req) });
  if (person.thankYouCard) {
    broadcast({ kind: "card-upsert", card: person.thankYouCard, actor, source: getSource(req) });
  }
  res.json(person);
});

app.delete("/api/people/:id", (req, res) => {
  const { id } = req.params;
  const existing = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as PersonRow | undefined;
  if (!existing) return res.status(404).json({ error: "Not found" });
  const actor = getActor(req);
  const now = new Date().toISOString();
  const cardId = existing.thank_you_card_id;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM people WHERE id = ?").run(id);
    insertAudit.run("person", id, "DELETE", null, existing.name, null, actor, now);
  });
  tx();
  deleteCardIfEmpty(cardId, actor, now);
  broadcast({ kind: "person-delete", id, actor, source: getSource(req) });
  // Refresh card (in case it still exists with one fewer member)
  const card = loadCard(cardId);
  if (card) broadcast({ kind: "card-upsert", card, actor, source: getSource(req) });
  res.json({ ok: true });
});

// Thank-you cards

app.get("/api/thank-you-cards", (_req, res) => {
  res.json(loadCards());
});

app.put("/api/thank-you-cards/:id", (req, res) => {
  const { id } = req.params;
  const existing = db.prepare("SELECT * FROM thank_you_cards WHERE id = ?").get(id) as CardRow | undefined;
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { label, mailingName, address, note, hint, status } = req.body;
  if (status !== undefined && (typeof status !== "string" || !VALID_CARD_STATUSES.has(status))) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const now = new Date().toISOString();
  const actor = getActor(req);

  const newVals: Record<string, unknown> = {
    label: label ?? existing.label,
    mailingName: mailingName ?? existing.mailing_name,
    address: address ?? existing.address,
    note: note ?? existing.note,
    hint: hint ?? existing.hint,
    status: status ?? existing.status,
    sentAt: existing.sent_at,
  };

  // Auto-bump "" → "Drafted" when the note transitions empty → non-empty and
  // the caller didn't set status in this same request (mirrors the item
  // auto-"Purchased" transition above).
  if (
    status === undefined &&
    existing.status === "" &&
    existing.note.trim() === "" &&
    String(newVals.note).trim() !== ""
  ) {
    newVals.status = "Drafted";
  }

  // sent_at is server-managed: stamped on entering "Sent", cleared on leaving.
  if (newVals.status === "Sent" && existing.status !== "Sent") {
    newVals.sentAt = now;
  } else if (newVals.status !== "Sent" && existing.status === "Sent") {
    newVals.sentAt = null;
  }

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE thank_you_cards SET label=?, mailing_name=?, address=?, note=?, hint=?, status=?, sent_at=?, updated_at=? WHERE id=?`
    ).run(newVals.label, newVals.mailingName, newVals.address, newVals.note, newVals.hint, newVals.status, newVals.sentAt, now, id);

    for (const [camelKey, dbCol] of Object.entries(CARD_FIELDS)) {
      const oldVal = String((existing as Record<string, unknown>)[dbCol] ?? "");
      const newVal = String(newVals[camelKey] ?? "");
      if (oldVal !== newVal) {
        insertAudit.run("thank_you_card", id, "UPDATE", camelKey, oldVal, newVal, actor, now);
      }
    }
  });
  tx();

  const card = loadCard(id)!;
  broadcast({ kind: "card-upsert", card, actor, source: getSource(req) });
  res.json(card);
});

// --- App settings (key-value) ---

function loadSettings() {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("postable_project_url") as { value: string } | undefined;
  return { postableProjectUrl: row?.value ?? "" };
}

app.get("/api/settings", (_req, res) => {
  res.json(loadSettings());
});

app.put("/api/settings", (req, res) => {
  const { postableProjectUrl } = req.body;
  if (postableProjectUrl === undefined) return res.json(loadSettings());
  if (typeof postableProjectUrl !== "string") {
    return res.status(400).json({ error: "postableProjectUrl must be a string" });
  }
  const trimmed = postableProjectUrl.trim();
  if (trimmed !== "") {
    try {
      new URL(trimmed);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }
  }
  const actor = getActor(req);
  const now = new Date().toISOString();
  const old = loadSettings().postableProjectUrl;
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
    ).run("postable_project_url", trimmed, now);
    if (old !== trimmed) {
      insertAudit.run("settings", "postable_project_url", "UPDATE", "postableProjectUrl", old, trimmed, actor, now);
    }
  });
  tx();

  const settings = loadSettings();
  broadcast({ kind: "settings-upsert", settings, actor, source: getSource(req) });
  res.json(settings);
});

// Share / unlink

app.post("/api/people/:id/share-card", (req, res) => {
  const { id } = req.params;
  const { otherPersonId } = req.body;
  if (!otherPersonId) return res.status(400).json({ error: "otherPersonId required" });
  if (otherPersonId === id) return res.status(400).json({ error: "Cannot share with self" });
  const me = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as PersonRow | undefined;
  const other = db.prepare("SELECT * FROM people WHERE id = ?").get(otherPersonId) as PersonRow | undefined;
  if (!me || !other) return res.status(404).json({ error: "Person not found" });

  const actor = getActor(req);
  const now = new Date().toISOString();
  const keepCardId = me.thank_you_card_id;
  const mergedCardId = other.thank_you_card_id;
  if (keepCardId === mergedCardId) {
    return res.json(loadPerson(id));
  }

  // Merge the two card groups rather than moving just this one person. If the
  // other person already shares a card with others, every member moves onto
  // this person's card so linking never tears an existing group apart. The card
  // being viewed (me's) is preserved along with its note/address; the other
  // card is deleted once it's empty.
  const movedIds = (
    db.prepare("SELECT id FROM people WHERE thank_you_card_id = ?").all(mergedCardId) as { id: string }[]
  ).map((r) => r.id);

  const tx = db.transaction(() => {
    for (const pid of movedIds) {
      db.prepare("UPDATE people SET thank_you_card_id = ?, updated_at = ? WHERE id = ?").run(keepCardId, now, pid);
      insertAudit.run("person", pid, "UPDATE", "thankYouCardId", mergedCardId, keepCardId, actor, now);
    }
  });
  tx();
  deleteCardIfEmpty(mergedCardId, actor, now);

  const source = getSource(req);
  const card = loadCard(keepCardId);
  if (card) broadcast({ kind: "card-upsert", card, actor, source });
  for (const pid of movedIds) {
    const moved = loadPerson(pid);
    if (moved) broadcast({ kind: "person-upsert", person: moved, actor, source });
  }
  res.json(loadPerson(id));
});

app.post("/api/people/:id/merge", (req, res) => {
  const { id } = req.params; // source — will be deleted
  const { targetId } = req.body;
  if (!targetId || typeof targetId !== "string") {
    return res.status(400).json({ error: "targetId required" });
  }
  if (targetId === id) {
    return res.status(400).json({ error: "Cannot merge a person with themselves" });
  }
  const source = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as PersonRow | undefined;
  const target = db.prepare("SELECT * FROM people WHERE id = ?").get(targetId) as PersonRow | undefined;
  if (!source || !target) return res.status(404).json({ error: "Person not found" });

  const actor = getActor(req);
  const now = new Date().toISOString();
  const sourceCardId = source.thank_you_card_id;
  const affectedItemIds = new Set<string>();

  const tx = db.transaction(() => {
    const sourceContribs = db.prepare(
      "SELECT item_id, amount FROM item_contributors WHERE person_id = ?"
    ).all(id) as { item_id: string; amount: number | null }[];

    for (const sc of sourceContribs) {
      affectedItemIds.add(sc.item_id);
      const targetRow = db.prepare(
        "SELECT amount FROM item_contributors WHERE item_id = ? AND person_id = ?"
      ).get(sc.item_id, targetId) as { amount: number | null } | undefined;

      if (targetRow) {
        // Both source and target are already on this item — combine amounts.
        // null + value = value; value + value = sum; null + null = null.
        let merged: number | null;
        if (sc.amount !== null && targetRow.amount !== null) {
          merged = sc.amount + targetRow.amount;
        } else if (sc.amount !== null) {
          merged = sc.amount;
        } else if (targetRow.amount !== null) {
          merged = targetRow.amount;
        } else {
          merged = null;
        }
        db.prepare(
          "UPDATE item_contributors SET amount = ? WHERE item_id = ? AND person_id = ?"
        ).run(merged, sc.item_id, targetId);
        db.prepare(
          "DELETE FROM item_contributors WHERE item_id = ? AND person_id = ?"
        ).run(sc.item_id, id);
        insertAudit.run(
          "item",
          sc.item_id,
          "UPDATE",
          "contributor",
          source.name,
          null,
          actor,
          now
        );
        if (merged !== targetRow.amount) {
          insertAudit.run(
            "item",
            sc.item_id,
            "UPDATE",
            "contributor_amount",
            `${target.name} (${targetRow.amount === null ? "—" : `$${targetRow.amount}`})`,
            `${target.name} (${merged === null ? "—" : `$${merged}`})`,
            actor,
            now
          );
        }
      } else {
        // Re-point the contribution from source to target.
        db.prepare(
          "UPDATE item_contributors SET person_id = ? WHERE item_id = ? AND person_id = ?"
        ).run(targetId, sc.item_id, id);
        insertAudit.run(
          "item",
          sc.item_id,
          "UPDATE",
          "contributor",
          source.name,
          target.name,
          actor,
          now
        );
      }
    }

    db.prepare("DELETE FROM people WHERE id = ?").run(id);
    insertAudit.run(
      "person",
      id,
      "DELETE",
      null,
      source.name,
      `merged into ${target.name}`,
      actor,
      now
    );
  });
  tx();

  // Source's thank-you card might now be member-less; clean it up.
  deleteCardIfEmpty(sourceCardId, actor, now);

  // Broadcast the cascade of changes.
  broadcast({ kind: "person-delete", id, actor, source: getSource(req) });
  const targetPerson = loadPerson(targetId);
  if (targetPerson) {
    broadcast({ kind: "person-upsert", person: targetPerson, actor, source: getSource(req) });
  }
  for (const itemId of affectedItemIds) {
    const item = loadItem(itemId);
    if (item) {
      broadcast({ kind: "item-upsert", item, actor, source: getSource(req) });
    }
  }
  // The source's card (or the card that was shared with source) may still exist
  // with one fewer member — refresh it for any other members on it.
  const sourceCard = loadCard(sourceCardId);
  if (sourceCard) {
    broadcast({ kind: "card-upsert", card: sourceCard, actor, source: getSource(req) });
  }

  res.json({ ok: true, target: targetPerson });
});

app.post("/api/people/:id/unlink-card", (req, res) => {
  const { id } = req.params;
  const me = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as PersonRow | undefined;
  if (!me) return res.status(404).json({ error: "Not found" });

  // No-op if they're already on a solo card
  const memberCount = db.prepare("SELECT COUNT(*) AS n FROM people WHERE thank_you_card_id = ?").get(me.thank_you_card_id) as { n: number };
  if (memberCount.n <= 1) {
    return res.json(loadPerson(id));
  }

  const actor = getActor(req);
  const now = new Date().toISOString();
  const oldCardId = me.thank_you_card_id;
  let newCardId = "";

  const tx = db.transaction(() => {
    newCardId = createCard(now);
    insertAudit.run("thank_you_card", newCardId, "CREATE", null, null, me.name, actor, now);
    db.prepare("UPDATE people SET thank_you_card_id = ?, updated_at = ? WHERE id = ?").run(newCardId, now, id);
    insertAudit.run("person", id, "UPDATE", "thankYouCardId", oldCardId, newCardId, actor, now);
  });
  tx();

  const person = loadPerson(id)!;
  const newCard = loadCard(newCardId);
  const oldCard = loadCard(oldCardId);
  broadcast({ kind: "person-upsert", person, actor, source: getSource(req) });
  if (newCard) broadcast({ kind: "card-upsert", card: newCard, actor, source: getSource(req) });
  if (oldCard) broadcast({ kind: "card-upsert", card: oldCard, actor, source: getSource(req) });
  res.json(person);
});

// --- Bulk import (replaces all data) ---

app.post("/api/import", (req, res) => {
  const { categories, items } = req.body;
  if (!Array.isArray(categories) || !Array.isArray(items)) {
    return res.status(400).json({ error: "Invalid data format" });
  }
  const actor = getActor(req);
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM items").run();
    db.prepare("DELETE FROM categories").run();
    const insertCat = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
    for (const cat of categories) {
      insertCat.run(cat);
    }
    const insertItem = db.prepare(
      `INSERT INTO items (id, name, category, status, priority, price, link, notes, registry, image_url, product_name, registration_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of items) {
      // Ensure category exists
      insertCat.run(item.category);
      // Normalize old status/priority names during import
      const status = item.status === "Still Researching" ? "Researching"
        : item.status === "Final Choice" ? "Decided"
        : item.status === "Already Have / Purchased" ? "Purchased"
        : (item.status ?? "");
      const priority = item.priority === "Unprioritized" ? "" : (item.priority ?? "");
      insertItem.run(
        item.id,
        item.name,
        item.category,
        status,
        priority,
        item.price ?? 0,
        item.link ?? "",
        item.notes ?? "",
        item.registry ?? "",
        item.imageUrl ?? "",
        item.productName ?? "",
        item.registrationStatus ?? "",
        item.createdAt ?? new Date().toISOString(),
        item.updatedAt ?? new Date().toISOString()
      );
    }
    const now = new Date().toISOString();
    insertAudit.run("import", null, "IMPORT", null, null, `${items.length} items, ${categories.length} categories`, actor, now);
  });
  try {
    tx();
    const cats = (db.prepare("SELECT name FROM categories ORDER BY rowid").all() as { name: string }[]).map((r) => r.name);
    broadcast({ kind: "import-replaced", actor, source: getSource(req) });
    res.json({ categories: cats, items: loadItems() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Export (returns all data as JSON) ---

app.get("/api/export", (_req, res) => {
  const cats = (db.prepare("SELECT name FROM categories ORDER BY rowid").all() as { name: string }[]).map((r) => r.name);
  res.json({ version: 1, categories: cats, items: loadItems() });
});

// --- Audit log ---

interface AuditRow {
  id: number;
  entity_type: string;
  entity_id: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  actor: string;
  changed_at: string;
}

function auditRowToEntry(row: AuditRow, entityName?: string | null) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityName: entityName ?? null,
    action: row.action,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    actor: row.actor,
    changedAt: row.changed_at,
  };
}

app.get("/api/audit-log", (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit)) || 50, 200);
  const offset = parseInt(String(req.query.offset)) || 0;

  const rows = db.prepare(
    `SELECT * FROM audit_log ORDER BY changed_at DESC, id DESC LIMIT ? OFFSET ?`
  ).all(limit, offset) as AuditRow[];

  // Resolve entity names for items and people (categories use entity_id itself).
  const itemIds = [...new Set(rows.filter(r => r.entity_type === "item" && r.entity_id).map(r => r.entity_id!))];
  const personIds = [...new Set(rows.filter(r => r.entity_type === "person" && r.entity_id).map(r => r.entity_id!))];
  const itemNames = new Map<string, string>();
  const personNames = new Map<string, string>();
  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => "?").join(",");
    const nameRows = db.prepare(`SELECT id, name FROM items WHERE id IN (${placeholders})`).all(...itemIds) as { id: string; name: string }[];
    for (const r of nameRows) itemNames.set(r.id, r.name);
  }
  if (personIds.length > 0) {
    const placeholders = personIds.map(() => "?").join(",");
    const nameRows = db.prepare(`SELECT id, name FROM people WHERE id IN (${placeholders})`).all(...personIds) as { id: string; name: string }[];
    for (const r of nameRows) personNames.set(r.id, r.name);
  }

  res.json(rows.map(r => {
    let entityName: string | null = null;
    if (r.entity_type === "item" && r.entity_id) {
      entityName = itemNames.get(r.entity_id) ?? null;
      if (!entityName) entityName = r.action === "DELETE" ? r.old_value : r.action === "CREATE" ? r.new_value : null;
    } else if (r.entity_type === "person" && r.entity_id) {
      entityName = personNames.get(r.entity_id) ?? null;
      if (!entityName) entityName = r.action === "DELETE" ? r.old_value : r.action === "CREATE" ? r.new_value : null;
    } else if (r.entity_type === "category") {
      entityName = r.entity_id;
    } else if (r.entity_type === "thank_you_card") {
      entityName = "Thank-you card";
    } else if (r.entity_type === "settings") {
      entityName = "Settings";
    }
    return auditRowToEntry(r, entityName);
  }));
});

// --- Realtime updates (SSE) ---

app.get("/api/updates", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Belt-and-suspenders for nginx — also recommend adding `proxy_buffering off`
  // at the location level for /api/updates.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send a comment immediately so the client's `onopen` fires.
  res.write(": connected\n\n");

  const deviceName = String(req.query.device ?? "");
  const client: SseClient = { res, deviceName };
  sseClients.add(client);

  // Heartbeat every 25s — keeps proxies and iOS Safari from killing the
  // connection during long idle periods.
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      /* ignore — close handler will clean up */
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(client);
  });
});

app.get("/api/items/:id/history", (req, res) => {
  const { id } = req.params;
  const rows = db.prepare(
    `SELECT * FROM audit_log WHERE entity_type = 'item' AND entity_id = ? ORDER BY changed_at DESC, id DESC`
  ).all(id) as AuditRow[];
  res.json(rows.map(r => auditRowToEntry(r)));
});

// --- Scrape product link ---

app.post("/api/scrape-link", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL is required" });
  }
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }
  try {
    const result = await scrapeProductLink(url);
    res.json(result);
  } catch {
    res.status(502).json({ error: "Failed to fetch product details" });
  }
});

// Serve built frontend in production
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = parseInt(process.env.PORT || "3001", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
