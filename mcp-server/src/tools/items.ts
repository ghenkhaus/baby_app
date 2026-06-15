import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

const STATUS_VALUES = ["", "Researching", "Decided", "Purchased", "Received", "Not Needed"] as const;
const PRIORITY_VALUES = ["", "Necessary", "Nice to Have"] as const;
const REGISTRATION_STATUS_VALUES = ["", "Needs Registration", "Registered", "N/A"] as const;

const contributorSchema = z
  .array(
    z.object({
      personId: z.string().describe("Person ID (UUID)"),
      amount: z.number().nullable().optional().describe("Optional dollar amount for this contributor"),
    })
  )
  .describe("List of contributors. Replaces the full contributor list on the item.");

export function registerItemTools(server: McpServer) {
  server.tool(
    "list_items",
    "List all baby registry items, optionally filtered by status, priority, category, registry, manufacturer registration status, link presence, or search query",
    {
      status: z.enum(STATUS_VALUES).optional().describe("Filter by item status"),
      priority: z.enum(PRIORITY_VALUES).optional().describe("Filter by priority"),
      category: z.string().optional().describe("Filter by category name"),
      registry: z.string().optional().describe("Filter by registry name (e.g. Amazon, Babylist)"),
      registrationStatus: z.enum(REGISTRATION_STATUS_VALUES).optional().describe("Filter by manufacturer registration status"),
      hasLink: z.boolean().optional().describe("true = only items with a link, false = only items without"),
      search: z.string().optional().describe("Search text (matches item name and notes, case-insensitive)"),
    },
    async (params) => {
      try {
        let items = await client.getItems();

        // Apply filters in-memory (mirrors useRegistry.ts logic)
        if (params.status !== undefined) {
          items = items.filter((i) => i.status === params.status);
        }
        if (params.priority !== undefined) {
          items = items.filter((i) => i.priority === params.priority);
        }
        if (params.category !== undefined) {
          items = items.filter((i) => i.category === params.category);
        }
        if (params.registry !== undefined) {
          items = items.filter((i) => i.registry === params.registry);
        }
        if (params.registrationStatus !== undefined) {
          items = items.filter((i) => i.registrationStatus === params.registrationStatus);
        }
        if (params.hasLink === true) {
          items = items.filter((i) => i.link !== "");
        } else if (params.hasLink === false) {
          items = items.filter((i) => i.link === "");
        }
        if (params.search) {
          const q = params.search.toLowerCase();
          items = items.filter(
            (i) => i.name.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q)
          );
        }

        return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_item",
    "Get a single baby registry item by its ID",
    {
      id: z.string().describe("The item ID (UUID)"),
    },
    async (params) => {
      try {
        const item = await client.getItem(params.id);
        return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_item",
    "Create a new baby registry item",
    {
      name: z.string().describe("Item name"),
      category: z.string().describe("Category name (must exist)"),
      status: z.enum(STATUS_VALUES).optional().default("").describe("Item status"),
      priority: z.enum(PRIORITY_VALUES).optional().default("").describe("Item priority"),
      price: z.number().optional().default(0).describe("Price (0 = no price set)"),
      link: z.string().optional().default("").describe("Product URL"),
      notes: z.string().optional().default("").describe("Notes (supports markdown)"),
      registry: z.string().optional().default("").describe("Registry name (e.g. Amazon, Babylist)"),
      imageUrl: z.string().optional().default("").describe("Product image URL"),
      productName: z.string().optional().default("").describe("Scraped product name"),
      registrationStatus: z.enum(REGISTRATION_STATUS_VALUES).optional().default("").describe("Manufacturer registration status: '' (unset), 'Needs Registration', 'Registered', or 'N/A'"),
      contributors: contributorSchema.optional(),
    },
    async (params) => {
      try {
        const item = await client.createItem(params);
        return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_item",
    "Update an existing baby registry item (partial updates supported — only include fields you want to change)",
    {
      id: z.string().describe("The item ID (UUID)"),
      name: z.string().optional().describe("Item name"),
      category: z.string().optional().describe("Category name"),
      status: z.enum(STATUS_VALUES).optional().describe("Item status"),
      priority: z.enum(PRIORITY_VALUES).optional().describe("Item priority"),
      price: z.number().optional().describe("Price"),
      link: z.string().optional().describe("Product URL"),
      notes: z.string().optional().describe("Notes (supports markdown)"),
      registry: z.string().optional().describe("Registry name"),
      imageUrl: z.string().optional().describe("Product image URL"),
      productName: z.string().optional().describe("Scraped product name"),
      registrationStatus: z.enum(REGISTRATION_STATUS_VALUES).optional().describe("Manufacturer registration status"),
      contributors: contributorSchema.optional(),
    },
    async (params) => {
      try {
        const { id, ...updates } = params;
        const item = await client.updateItem(id, updates);
        return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_item",
    "Delete a baby registry item by its ID",
    {
      id: z.string().describe("The item ID (UUID)"),
    },
    async (params) => {
      try {
        await client.deleteItem(params.id);
        return { content: [{ type: "text", text: `Item ${params.id} deleted successfully.` }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );
}
