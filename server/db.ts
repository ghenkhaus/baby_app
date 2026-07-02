import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "registry.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    name TEXT PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '' CHECK(status IN ('', 'Researching', 'Decided', 'Purchased', 'Received', 'Not Needed')),
    priority TEXT NOT NULL DEFAULT '' CHECK(priority IN ('Necessary', 'Nice to Have', '')),
    price REAL NOT NULL DEFAULT 0,
    link TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    registry TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL DEFAULT '',
    registration_status TEXT NOT NULL DEFAULT '' CHECK(registration_status IN ('', 'Needs Registration', 'Registered', 'N/A')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (category) REFERENCES categories(name)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    action TEXT NOT NULL CHECK(action IN ('CREATE', 'UPDATE', 'DELETE', 'IMPORT')),
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    actor TEXT NOT NULL DEFAULT '',
    changed_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON audit_log(changed_at);

  CREATE TABLE IF NOT EXISTS thank_you_cards (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL DEFAULT '',
    mailing_name TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    hint TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '' CHECK(status IN ('', 'Drafted', 'Ready to Send', 'Sent')),
    sent_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    thank_you_card_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (thank_you_card_id) REFERENCES thank_you_cards(id)
  );

  CREATE INDEX IF NOT EXISTS idx_people_card ON people(thank_you_card_id);

  CREATE TABLE IF NOT EXISTS item_contributors (
    item_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    amount REAL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (item_id, person_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_contrib_person ON item_contributors(person_id);
`);

// Migrations: ensure schema is up-to-date.
// Disable foreign keys for the whole migration block. Otherwise, ALTER TABLE
// RENAME auto-updates FK references on dependent tables (e.g. item_contributors
// would start pointing at items_old, then break when items_old gets dropped).
db.pragma("foreign_keys = OFF");
{
  // Check if registry column exists
  const cols = db.prepare("PRAGMA table_info(items)").all() as { name: string }[];
  const colNames = cols.map((c) => c.name);
  const hasRegistry = colNames.includes("registry");
  const hasRegistrationStatus = colNames.includes("registration_status");

  // Check if status/priority constraints are current by testing all valid values
  let needsConstraintMigration = false;
  const testId = '__migration_test__';
  const testCols = hasRegistry
    ? "id, name, category, status, priority, price, link, notes, registry, created_at, updated_at"
    : "id, name, category, status, priority, price, link, notes, created_at, updated_at";
  const makeTestValues = (status: string) => hasRegistry
    ? `VALUES (?, '', '', '${status}', '', 0, '', '', '', '', '')`
    : `VALUES (?, '', '', '${status}', '', 0, '', '', '', '')`;
  // Test each status value the schema should accept. Adding a new status here
  // forces the migration to rebuild the table with the updated CHECK on
  // existing DBs.
  for (const testStatus of ['Decided', 'Not Needed', 'Purchased', 'Received']) {
    try {
      db.prepare(`INSERT INTO items (${testCols}) ${makeTestValues(testStatus)}`).run(testId);
      db.prepare("DELETE FROM items WHERE id = ?").run(testId);
    } catch {
      needsConstraintMigration = true;
      break;
    }
  }

  if (needsConstraintMigration || !hasRegistry || !hasRegistrationStatus) {
    console.log("Migrating database schema...");
    const registrySelect = hasRegistry ? "registry," : "'' AS registry,";
    const hasImageUrl = colNames.includes("image_url");
    const imageUrlSelect = hasImageUrl ? "image_url," : "'' AS image_url,";
    const hasProductName = colNames.includes("product_name");
    const productNameSelect = hasProductName ? "product_name," : "'' AS product_name,";
    const registrationStatusSelect = hasRegistrationStatus ? "registration_status," : "'' AS registration_status,";
    db.exec(`
      DROP TABLE IF EXISTS items_old;
      ALTER TABLE items RENAME TO items_old;

      CREATE TABLE items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT '' CHECK(status IN ('', 'Researching', 'Decided', 'Purchased', 'Received', 'Not Needed')),
        priority TEXT NOT NULL DEFAULT '' CHECK(priority IN ('Necessary', 'Nice to Have', '')),
        price REAL NOT NULL DEFAULT 0,
        link TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        registry TEXT NOT NULL DEFAULT '',
        image_url TEXT NOT NULL DEFAULT '',
        product_name TEXT NOT NULL DEFAULT '',
        registration_status TEXT NOT NULL DEFAULT '' CHECK(registration_status IN ('', 'Needs Registration', 'Registered', 'N/A')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (category) REFERENCES categories(name)
      );

      INSERT INTO items SELECT
        id, name, category,
        CASE
          WHEN status = 'Still Researching' THEN 'Researching'
          WHEN status = 'Final Choice' THEN 'Decided'
          WHEN status = 'Already Have / Purchased' THEN 'Purchased'
          ELSE status
        END,
        CASE WHEN priority = 'Unprioritized' THEN '' ELSE priority END,
        price, link, notes,
        ${registrySelect}
        ${imageUrlSelect}
        ${productNameSelect}
        ${registrationStatusSelect}
        created_at, updated_at
      FROM items_old;

      DROP TABLE items_old;
    `);
    console.log("Migration complete.");
  }

  // Re-read columns after potential constraint migration
  const currentCols = (db.prepare("PRAGMA table_info(items)").all() as { name: string }[]).map((c) => c.name);

  if (!currentCols.includes("image_url")) {
    db.exec("ALTER TABLE items ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
    console.log("Added image_url column.");
  }

  if (!currentCols.includes("product_name")) {
    db.exec("ALTER TABLE items ADD COLUMN product_name TEXT NOT NULL DEFAULT ''");
    console.log("Added product_name column.");
  }

  if (!currentCols.includes("registration_status")) {
    db.exec("ALTER TABLE items ADD COLUMN registration_status TEXT NOT NULL DEFAULT ''");
    console.log("Added registration_status column.");
  }

  // Fix any leftover old values
  db.prepare("UPDATE items SET status = 'Researching' WHERE status = 'Still Researching'").run();
  db.prepare("UPDATE items SET status = 'Decided' WHERE status = 'Final Choice'").run();
  db.prepare("UPDATE items SET status = 'Purchased' WHERE status = 'Already Have / Purchased'").run();
  db.prepare("UPDATE items SET priority = '' WHERE priority = 'Unprioritized'").run();
}

// audit_log used to restrict entity_type to ('item','category','import'). We
// now also write 'person' and 'thank_you_card' rows — rebuild the table
// without that CHECK constraint if it's still in place. New DBs created with
// the current CREATE TABLE skip this entirely.
{
  const auditTestId = "__audit_constraint_test__";
  let needsAuditMigration = false;
  try {
    db.prepare(
      `INSERT INTO audit_log (entity_type, entity_id, action, actor, changed_at) VALUES (?, ?, ?, ?, ?)`
    ).run("person", auditTestId, "CREATE", "test", new Date().toISOString());
    db.prepare(`DELETE FROM audit_log WHERE entity_id = ?`).run(auditTestId);
  } catch {
    needsAuditMigration = true;
  }
  if (needsAuditMigration) {
    console.log("Migrating audit_log to drop entity_type CHECK constraint...");
    db.exec(`
      DROP TABLE IF EXISTS audit_log_old;
      ALTER TABLE audit_log RENAME TO audit_log_old;
      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        action TEXT NOT NULL CHECK(action IN ('CREATE', 'UPDATE', 'DELETE', 'IMPORT')),
        field_name TEXT,
        old_value TEXT,
        new_value TEXT,
        actor TEXT NOT NULL DEFAULT '',
        changed_at TEXT NOT NULL
      );
      INSERT INTO audit_log (id, entity_type, entity_id, action, field_name, old_value, new_value, actor, changed_at)
        SELECT id, entity_type, entity_id, action, field_name, old_value, new_value, actor, changed_at FROM audit_log_old;
      DROP TABLE audit_log_old;
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON audit_log(changed_at);
    `);
    console.log("audit_log migration complete.");
  }
}

// Recovery: if a prior buggy run left item_contributors with FK references
// pointing at items_old (a transient migration table that no longer exists),
// rebuild the table with correct FK references.
{
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'item_contributors'").get() as { sql: string } | undefined;
  if (tableInfo && tableInfo.sql.includes("items_old")) {
    console.log("Recovering item_contributors FK to point at items...");
    db.exec(`
      ALTER TABLE item_contributors RENAME TO item_contributors_broken;
      CREATE TABLE item_contributors (
        item_id TEXT NOT NULL,
        person_id TEXT NOT NULL,
        amount REAL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (item_id, person_id),
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
      );
      INSERT INTO item_contributors SELECT * FROM item_contributors_broken;
      DROP TABLE item_contributors_broken;
      CREATE INDEX IF NOT EXISTS idx_contrib_person ON item_contributors(person_id);
    `);
    console.log("item_contributors recovery complete.");
  }
}

// Drop the old `relationship` column on people if it's still around. SQLite
// 3.35+ supports ALTER TABLE DROP COLUMN, and better-sqlite3 ships a newer
// SQLite. Skipped on fresh DBs where the column was never created.
{
  const cols = db.prepare("PRAGMA table_info(people)").all() as { name: string }[];
  if (cols.some((c) => c.name === "relationship")) {
    console.log("Dropping people.relationship column...");
    db.exec("ALTER TABLE people DROP COLUMN relationship");
    console.log("Dropped people.relationship.");
  }
}

// Thank-you note lifecycle: status + sent_at on thank_you_cards. ALTER ADD
// COLUMN can't carry a CHECK constraint, so on pre-existing DBs the PUT
// route's validation is the only gate (same as items.registration_status).
{
  const cols = (db.prepare("PRAGMA table_info(thank_you_cards)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("status")) {
    db.exec("ALTER TABLE thank_you_cards ADD COLUMN status TEXT NOT NULL DEFAULT ''");
    // One-time backfill: a card that already has a real note is at least Drafted.
    db.prepare("UPDATE thank_you_cards SET status = 'Drafted' WHERE TRIM(note) != ''").run();
    console.log("Added thank_you_cards.status (backfilled Drafted for non-empty notes).");
  }
  if (!cols.includes("sent_at")) {
    db.exec("ALTER TABLE thank_you_cards ADD COLUMN sent_at TEXT");
    console.log("Added thank_you_cards.sent_at.");
  }
  if (!cols.includes("hint")) {
    db.exec("ALTER TABLE thank_you_cards ADD COLUMN hint TEXT NOT NULL DEFAULT ''");
    console.log("Added thank_you_cards.hint.");
  }
}

db.pragma("foreign_keys = ON");

export default db;
