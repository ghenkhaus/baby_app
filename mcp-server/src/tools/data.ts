import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { client } from "../client.js";

export function registerDataTools(server: McpServer) {
  server.tool(
    "export_data",
    "Export all baby registry data (categories and items) as JSON",
    {},
    async () => {
      try {
        const data = await client.exportData();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );
}
