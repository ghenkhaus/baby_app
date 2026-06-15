import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

export function registerCategoryTools(server: McpServer) {
  server.tool(
    "list_categories",
    "List all item categories in the baby registry",
    {},
    async () => {
      try {
        const categories = await client.getCategories();
        return { content: [{ type: "text", text: JSON.stringify(categories, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_category",
    "Create a new item category",
    {
      name: z.string().describe("Category name"),
    },
    async (params) => {
      try {
        const result = await client.createCategory(params.name);
        return { content: [{ type: "text", text: `Category "${result.name}" created.` }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_category",
    "Delete an empty category (fails if the category still has items assigned to it)",
    {
      name: z.string().describe("Category name to delete"),
    },
    async (params) => {
      try {
        await client.deleteCategory(params.name);
        return { content: [{ type: "text", text: `Category "${params.name}" deleted.` }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );
}
