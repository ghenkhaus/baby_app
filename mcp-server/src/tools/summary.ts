import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { client } from "../client.js";

export function registerSummaryTool(server: McpServer) {
  server.tool(
    "get_registry_summary",
    "Get computed statistics about the baby registry: total items, total price, breakdowns by status, priority, category, and registry, plus thank-you note progress (cards by lifecycle status)",
    {},
    async () => {
      try {
        const [items, categories, cards] = await Promise.all([
          client.getItems(),
          client.getCategories(),
          client.getThankYouCards(),
        ]);

        const totalPrice = items.reduce((sum, i) => sum + i.price, 0);

        // Group by status
        const byStatus: Record<string, { count: number; totalPrice: number }> = {};
        for (const item of items) {
          const key = item.status || "(no status)";
          if (!byStatus[key]) byStatus[key] = { count: 0, totalPrice: 0 };
          byStatus[key].count++;
          byStatus[key].totalPrice += item.price;
        }

        // Group by priority
        const byPriority: Record<string, { count: number; totalPrice: number }> = {};
        for (const item of items) {
          const key = item.priority || "(no priority)";
          if (!byPriority[key]) byPriority[key] = { count: 0, totalPrice: 0 };
          byPriority[key].count++;
          byPriority[key].totalPrice += item.price;
        }

        // Group by category
        const byCategory: Record<string, { count: number; totalPrice: number }> = {};
        for (const item of items) {
          if (!byCategory[item.category]) byCategory[item.category] = { count: 0, totalPrice: 0 };
          byCategory[item.category].count++;
          byCategory[item.category].totalPrice += item.price;
        }

        // Group by registry
        const byRegistry: Record<string, { count: number; totalPrice: number }> = {};
        for (const item of items) {
          const key = item.registry || "(no registry)";
          if (!byRegistry[key]) byRegistry[key] = { count: 0, totalPrice: 0 };
          byRegistry[key].count++;
          byRegistry[key].totalPrice += item.price;
        }

        const itemsWithLink = items.filter((i) => i.link !== "").length;

        // Thank-you note progress
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
          byStatus,
          byPriority,
          byCategory,
          byRegistry,
          thankYous: {
            totalCards: cards.length,
            sent: cards.filter((c) => c.status === "Sent").length,
            byStatus: cardsByStatus,
          },
        };

        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );
}
