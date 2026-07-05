import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { client } from "../client.js";

export function registerPeopleTools(server: McpServer) {
  server.tool(
    "list_people",
    "List all people (gift contributors, invitees). Each entry includes contact info, their thank-you card (with mailing name, address, and note text), and the items they've contributed to.",
    {
      search: z.string().optional().describe("Case-insensitive substring match against name, email, or card label"),
    },
    async (params) => {
      try {
        let people = await client.getPeople();
        if (params.search) {
          const q = params.search.toLowerCase();
          people = people.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.email.toLowerCase().includes(q) ||
              (p.thankYouCard?.label ?? "").toLowerCase().includes(q)
          );
        }
        return { content: [{ type: "text", text: JSON.stringify(people, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_person",
    "Get a single person by ID, including their thank-you card and contributed items.",
    { id: z.string().describe("Person ID (UUID)") },
    async (params) => {
      try {
        const person = await client.getPerson(params.id);
        return { content: [{ type: "text", text: JSON.stringify(person, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_person",
    "Create a new person. If thankYouCardId is omitted, a new solo thank-you card is auto-created for them.",
    {
      name: z.string().describe("Full name"),
      email: z.string().optional().default("").describe("Email (optional)"),
      notes: z.string().optional().default("").describe("Free-text personal notes about this person"),
      thankYouCardId: z.string().optional().describe("Existing card ID to share (use someone else's cardId to make them share a thank-you note)"),
    },
    async (params) => {
      try {
        const person = await client.createPerson(params);
        return { content: [{ type: "text", text: JSON.stringify(person, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_person",
    "Update a person's fields (partial). Pass thankYouCardId to move them to a different card.",
    {
      id: z.string().describe("Person ID (UUID)"),
      name: z.string().optional(),
      email: z.string().optional(),
      notes: z.string().optional(),
      thankYouCardId: z.string().optional(),
    },
    async (params) => {
      try {
        const { id, ...updates } = params;
        const person = await client.updatePerson(id, updates);
        return { content: [{ type: "text", text: JSON.stringify(person, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_person",
    "Delete a person. Their contributions are removed from any items; if they were the last member on their thank-you card, the card is deleted too.",
    { id: z.string().describe("Person ID (UUID)") },
    async (params) => {
      try {
        await client.deletePerson(params.id);
        return { content: [{ type: "text", text: `Person ${params.id} deleted.` }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "bulk_add_people",
    "Bulk-create people from a list of names. Each name gets its own solo thank-you card. Duplicate names (case-insensitive) are skipped.",
    { names: z.array(z.string()).describe("Names to add, one per entry") },
    async (params) => {
      try {
        const result = await client.bulkAddPeople(params.names);
        return {
          content: [
            {
              type: "text",
              text: `Added ${result.created} ${result.created === 1 ? "person" : "people"}.${
                result.skipped.length > 0
                  ? ` Skipped duplicates: ${result.skipped.join(", ")}`
                  : ""
              }`,
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list_thank_you_cards",
    "List thank-you cards with member names, the gifts those members gave, current note text, and lifecycle status — everything needed to author a personalized thank-you note. Each card's `hint` field holds the user's own personalization notes (how they know the giver, shower moments, inside jokes) — weave those details into the drafted message. Filter by status to find cards that still need notes (status: \"\") or are awaiting mailing.",
    {
      status: z
        .enum(["", "Drafted", "Ready to Send", "Sent"])
        .optional()
        .describe('Only return cards with this status. "" = Not Started (no note yet).'),
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe("Max cards to return (default 25). Output is paged to stay under the tool token cap; use offset to fetch the next page."),
      offset: z.number().int().nonnegative().optional().describe("Number of cards to skip for pagination (default 0)."),
    },
    async (params) => {
      try {
        const limit = params.limit ?? 25;
        const offset = params.offset ?? 0;
        const [cards, people] = await Promise.all([client.getThankYouCards(), client.getPeople()]);
        const peopleByCard = new Map<string, typeof people>();
        for (const p of people) {
          const list = peopleByCard.get(p.thankYouCardId) ?? [];
          list.push(p);
          peopleByCard.set(p.thankYouCardId, list);
        }
        const filtered = params.status === undefined ? cards : cards.filter((c) => c.status === params.status);
        const page = filtered.slice(offset, offset + limit);
        const enriched = page.map((card) => {
          const members = peopleByCard.get(card.id) ?? [];
          // Dedupe gifts by item — a couple sharing one card may both be
          // contributors on the same item.
          const giftsByItem = new Map<string, { itemName: string; givenBy: string[]; amount: number | null }>();
          for (const m of members) {
            for (const c of m.contributions) {
              // Effective amount rule: explicit amount, else full item price
              // when they're the sole contributor, else unknown.
              const eff = c.amount !== null ? c.amount : c.contributorCount === 1 ? c.itemPrice : null;
              const existing = giftsByItem.get(c.itemId);
              if (existing) {
                existing.givenBy.push(m.name);
                if (eff !== null) existing.amount = (existing.amount ?? 0) + eff;
              } else {
                giftsByItem.set(c.itemId, { itemName: c.itemName, givenBy: [m.name], amount: eff });
              }
            }
          }
          // Project only the fields needed to author a note. Omit
          // memberIds (redundant with `members`) and createdAt/updatedAt
          // (noise) to keep the output compact.
          return {
            id: card.id,
            label: card.label,
            mailingName: card.mailingName,
            address: card.address,
            note: card.note,
            hint: card.hint,
            status: card.status,
            sentAt: card.sentAt,
            members: members.map((m) => ({ id: m.id, name: m.name })),
            gifts: Array.from(giftsByItem.values()),
          };
        });
        // Envelope tells the caller whether more pages remain.
        const result = {
          total: filtered.length,
          offset,
          limit,
          returned: enriched.length,
          hasMore: offset + enriched.length < filtered.length,
          cards: enriched,
        };
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_thank_you_card",
    "Update a thank-you card's label, mailing name, address, note text, personalization hint, or lifecycle status. Changes apply to every person who shares the card. Writing a note while status is \"\" auto-bumps the card to \"Drafted\" (writing a hint does not).",
    {
      id: z.string().describe("Card ID (UUID)"),
      label: z.string().optional().describe('Optional shared label like "The Smiths"'),
      mailingName: z.string().optional().describe('How to address the envelope (e.g. "The Smith Family")'),
      address: z.string().optional().describe("Mailing address (multi-line)"),
      note: z
        .string()
        .optional()
        .describe(
          "Thank-you note text. Markdown is supported in-app, but the message is copied to Postable as plain text — keep formatting simple."
        ),
      hint: z
        .string()
        .optional()
        .describe(
          "Personalization hints used when drafting the note (usually written by the user in the app; Claude normally reads this rather than writes it)."
        ),
      status: z
        .enum(["", "Drafted", "Ready to Send", "Sent"])
        .optional()
        .describe(
          'Lifecycle status; "" = Not Started. Setting "Sent" stamps the sent date server-side; moving away from "Sent" clears it. Omit when only editing the note — the server auto-bumps "" → "Drafted".'
        ),
    },
    async (params) => {
      try {
        const { id, ...updates } = params;
        const card = await client.updateThankYouCard(id, updates);
        return { content: [{ type: "text", text: JSON.stringify(card, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "share_thank_you_card",
    "Move a person onto another person's thank-you card so they share the note + address. The old card is deleted if it becomes empty.",
    {
      personId: z.string().describe("Person to move"),
      otherPersonId: z.string().describe("Person whose card to join"),
    },
    async (params) => {
      try {
        const person = await client.sharePersonCard(params.personId, params.otherPersonId);
        return { content: [{ type: "text", text: JSON.stringify(person, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "unlink_thank_you_card",
    "Spin a person off their current shared card onto a fresh solo card. No-op if they're already solo.",
    { personId: z.string().describe("Person to unlink") },
    async (params) => {
      try {
        const person = await client.unlinkPersonCard(params.personId);
        return { content: [{ type: "text", text: JSON.stringify(person, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "merge_people",
    "Merge one person (source) into another (target). The source is deleted; their contributions are re-pointed to the target. If both were on the same item, the amounts are combined (sum of non-nulls). Useful for de-duplicating accidentally-created twins.",
    {
      sourceId: z.string().describe("Person ID to merge from (will be deleted)"),
      targetId: z.string().describe("Person ID to merge into (keeps existing identity, gains the source's contributions)"),
    },
    async (params) => {
      try {
        const result = await client.mergePerson(params.sourceId, params.targetId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "set_item_contributors",
    "Replace the full set of contributors for an item. Pass an array of { personId, amount? } objects — anyone not in the array is removed.",
    {
      itemId: z.string().describe("Item ID (UUID)"),
      contributors: z.array(
        z.object({
          personId: z.string(),
          amount: z.number().nullable().optional(),
        })
      ),
    },
    async (params) => {
      try {
        const item = await client.updateItem(params.itemId, { contributors: params.contributors });
        return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    }
  );
}
