import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const jsonPath = process.argv[2] || path.join(__dirname, "..", "..", "baby-registry-starter.json");

if (!fs.existsSync(jsonPath)) {
  console.error(`File not found: ${jsonPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

const tx = db.transaction(() => {
  db.prepare("DELETE FROM items").run();
  db.prepare("DELETE FROM categories").run();

  const insertCat = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
  for (const cat of data.categories) {
    insertCat.run(cat);
  }

  const insertItem = db.prepare(
    `INSERT INTO items (id, name, category, status, priority, price, link, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const item of data.items) {
    insertCat.run(item.category); // ensure category exists
    insertItem.run(
      item.id,
      item.name,
      item.category,
      item.status,
      item.priority,
      item.price ?? 0,
      item.link ?? "",
      item.notes ?? "",
      item.createdAt ?? new Date().toISOString(),
      item.updatedAt ?? new Date().toISOString()
    );
  }
});

tx();
console.log(`Seeded ${data.categories.length} categories and ${data.items.length} items.`);
