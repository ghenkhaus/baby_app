import type { RegistryData, RegistryItem } from "../types";

export function exportToJson(data: RegistryData): void {
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
}

function isValidItem(item: unknown): item is RegistryItem {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.category === "string" &&
    (obj.status === "Decided" || obj.status === "Researching" || obj.status === "Purchased" || obj.status === "Received" || obj.status === "Already Have / Purchased" || obj.status === "Not Needed" || obj.status === "" || obj.status === "Final Choice" || obj.status === "Still Researching") &&
    (obj.priority === "Necessary" || obj.priority === "Nice to Have" || obj.priority === "" || obj.priority === "Unprioritized") &&
    typeof obj.price === "number" &&
    typeof obj.link === "string" &&
    (typeof obj.imageUrl === "string" || obj.imageUrl === undefined) &&
    (typeof obj.productName === "string" || obj.productName === undefined) &&
    typeof obj.notes === "string" &&
    (typeof obj.registry === "string" || obj.registry === undefined)
  );
}

export function importFromJson(file: File): Promise<RegistryData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.version !== 1) {
          throw new Error("Unsupported file version");
        }
        if (!Array.isArray(parsed.categories)) {
          throw new Error("Invalid categories format");
        }
        if (!Array.isArray(parsed.items)) {
          throw new Error("Invalid items format");
        }
        const validItems = parsed.items.filter(isValidItem);
        resolve({
          version: 1,
          categories: parsed.categories.filter(
            (c: unknown) => typeof c === "string"
          ),
          items: validItems,
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Failed to parse file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
