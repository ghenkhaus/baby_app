import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerItemTools } from "./tools/items.js";
import { registerCategoryTools } from "./tools/categories.js";
import { registerScrapeTool } from "./tools/scrape.js";
import { registerAuditTools } from "./tools/audit.js";
import { registerDataTools } from "./tools/data.js";
import { registerSummaryTool } from "./tools/summary.js";
import { registerPeopleTools } from "./tools/people.js";
import { registerResources } from "./resources/index.js";

const server = new McpServer({
  name: "baby-registry",
  version: "1.0.0",
});

// Register all tools
registerItemTools(server);
registerCategoryTools(server);
registerScrapeTool(server);
registerAuditTools(server);
registerDataTools(server);
registerSummaryTool(server);
registerPeopleTools(server);

// Register resources
registerResources(server);

// Start stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

// Log to stderr (stdout is the MCP transport channel)
console.error("Baby Registry MCP server running on stdio");
