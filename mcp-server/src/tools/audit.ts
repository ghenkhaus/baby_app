import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

export function registerAuditTools(server: McpServer) {
  server.tool(
    "get_audit_log",
    "Get recent audit log entries showing all changes to the baby registry (newest first)",
    {
      limit: z.number().int().min(1).max(200).optional().default(50).describe("Number of entries to return (max 200)"),
      offset: z.number().int().min(0).optional().default(0).describe("Number of entries to skip (for pagination)"),
    },
    async (params) => {
      try {
        const entries = await client.getAuditLog(params.limit, params.offset);
        return { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_item_history",
    "Get the full change history for a specific baby registry item",
    {
      itemId: z.string().describe("The item ID (UUID) to get history for"),
    },
    async (params) => {
      try {
        const entries = await client.getItemHistory(params.itemId);
        return { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );
}
