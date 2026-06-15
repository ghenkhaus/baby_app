import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

export function registerScrapeTool(server: McpServer) {
  server.tool(
    "scrape_product_link",
    "Scrape product name, price, and image URL from a product page URL. Supports major retailers (Amazon, Target, Walmart, Etsy, etc.)",
    {
      url: z.string().url().describe("The product page URL to scrape"),
    },
    async (params) => {
      try {
        const result = await client.scrapeLink(params.url);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error scraping link: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );
}
