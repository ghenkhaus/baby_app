import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { client } from "../client.js";

export function registerResources(server: McpServer) {
  server.resource(
    "registry-items",
    "registry://items",
    { description: "All baby registry items as JSON", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "registry://items",
        mimeType: "application/json",
        text: JSON.stringify(await client.getItems(), null, 2),
      }],
    })
  );

  server.resource(
    "registry-categories",
    "registry://categories",
    { description: "All item categories", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "registry://categories",
        mimeType: "application/json",
        text: JSON.stringify(await client.getCategories(), null, 2),
      }],
    })
  );

  server.resource(
    "registry-summary",
    "registry://summary",
    { description: "Computed registry statistics (totals, breakdowns by status/category/priority/registry, thank-you note progress)", mimeType: "application/json" },
    async () => {
      const [items, categories, cards] = await Promise.all([
        client.getItems(),
        client.getCategories(),
        client.getThankYouCards(),
      ]);

      const totalPrice = items.reduce((sum, i) => sum + i.price, 0);
      const itemsWithLink = items.filter((i) => i.link !== "").length;

      const groupBy = (key: "status" | "priority" | "category" | "registry") => {
        const result: Record<string, { count: number; totalPrice: number }> = {};
        for (const item of items) {
          const k = item[key] || `(no ${key})`;
          if (!result[k]) result[k] = { count: 0, totalPrice: 0 };
          result[k].count++;
          result[k].totalPrice += item.price;
        }
        return result;
      };

      const cardsByStatus: Record<string, number> = {};
      for (const card of cards) {
        const key = card.status || "(not started)";
        cardsByStatus[key] = (cardsByStatus[key] ?? 0) + 1;
      }

      const summary = {
        totalItems: items.length,
        totalPrice: Math.round(totalPrice * 100) / 100,
        totalCategories: categories.length,
        itemsWithLink,
        itemsWithoutLink: items.length - itemsWithLink,
        byStatus: groupBy("status"),
        byPriority: groupBy("priority"),
        byCategory: groupBy("category"),
        byRegistry: groupBy("registry"),
        thankYous: {
          totalCards: cards.length,
          sent: cards.filter((c) => c.status === "Sent").length,
          byStatus: cardsByStatus,
        },
      };

      return {
        contents: [{
          uri: "registry://summary",
          mimeType: "application/json",
          text: JSON.stringify(summary, null, 2),
        }],
      };
    }
  );

  server.resource(
    "registry-audit-log",
    "registry://audit-log",
    { description: "Last 50 audit log entries (newest first)", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "registry://audit-log",
        mimeType: "application/json",
        text: JSON.stringify(await client.getAuditLog(50, 0), null, 2),
      }],
    })
  );

  server.resource(
    "registry-people",
    "registry://people",
    { description: "All people (gift contributors / invitees) with their thank-you card details and contributions", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "registry://people",
        mimeType: "application/json",
        text: JSON.stringify(await client.getPeople(), null, 2),
      }],
    })
  );

  server.resource(
    "registry-thank-you-cards",
    "registry://thank-you-cards",
    { description: "All thank-you cards with member lists, mailing names, addresses, notes, and lifecycle status", mimeType: "application/json" },
    async () => ({
      contents: [{
        uri: "registry://thank-you-cards",
        mimeType: "application/json",
        text: JSON.stringify(await client.getThankYouCards(), null, 2),
      }],
    })
  );
}
