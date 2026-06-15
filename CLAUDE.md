# Baby Registry Tracker

A self-hosted baby registry tracker web app for managing and organizing baby items across multiple registries.

## Tech Stack

- **Frontend**: React 19 + TypeScript, Vite 8, Tailwind CSS v4
- **Backend**: Express 5, better-sqlite3
- **Database**: SQLite (`registry.db` at project root)
- **Markdown**: `marked` + `dompurify` for rendering markdown in notes
- **Link scraping**: `cheerio` for extracting product images/names from URLs
- **MCP Server**: Model Context Protocol server (`@modelcontextprotocol/sdk`) exposes registry tools to Claude

## Project Structure

```
baby_app/
├── server/                  # Express backend
│   ├── index.ts             # REST API routes + static file serving + audit logging
│   ├── db.ts                # SQLite setup, schema, migrations (incl. audit_log table)
│   ├── scrape.ts            # Product link scraper (image, title)
│   └── seed.ts              # Seed DB from JSON: `npx tsx server/seed.ts [file.json]`
├── mcp-server/              # MCP server — exposes registry as Claude tools
│   ├── src/
│   │   ├── index.ts         # MCP server entry point (stdio transport)
│   │   ├── client.ts        # HTTP client wrapper for Express API
│   │   ├── tools/           # MCP tool definitions
│   │   │   ├── items.ts     # list/get/create/update/delete items
│   │   │   ├── categories.ts # list/create/delete categories
│   │   │   ├── scrape.ts    # scrape_product_link
│   │   │   ├── audit.ts     # get_audit_log, get_item_history
│   │   │   ├── data.ts      # export_data
│   │   │   └── summary.ts   # get_registry_summary (computed stats)
│   │   └── resources/
│   │       └── index.ts     # MCP resources (items, categories, summary, audit-log)
│   └── package.json         # @modelcontextprotocol/sdk v1.12.1
├── src/                     # React frontend
│   ├── App.tsx              # Root component, modal state management
│   ├── main.tsx             # Entry point
│   ├── types/index.ts       # All TypeScript interfaces (incl. audit types)
│   ├── hooks/
│   │   ├── useRegistry.ts   # Central business logic (CRUD, filtering, sorting, grouping)
│   │   └── useLocalStorage.ts  # (legacy, unused — was replaced by API)
│   ├── components/
│   │   ├── Layout.tsx           # Page shell / header
│   │   ├── FilterBar.tsx        # Status/priority/category/registry filters + search
│   │   ├── PriceSummary.tsx     # Spending chart with clickable status/category filters
│   │   ├── RegistryList.tsx     # View switcher (grouped/cards/table) + sort controls
│   │   ├── CategoryGroup.tsx    # Category accordion for grouped view
│   │   ├── ItemCard.tsx         # Item card with quick registry toggle
│   │   ├── ItemDetailModal.tsx  # Full item detail modal (click to view, edit button)
│   │   ├── ItemForm.tsx         # Add/edit item form modal
│   │   ├── Markdown.tsx         # Markdown renderer component (marked + dompurify)
│   │   ├── ImportExportBar.tsx  # Add item, manage categories, import/export, audit log buttons
│   │   ├── CategoryManager.tsx  # Add/remove categories modal
│   │   ├── AuditLogModal.tsx    # Audit log viewer with pagination + color-coded actions
│   │   ├── Toast.tsx            # Success/error toast notifications (auto-dismiss 4s)
│   │   ├── ConfirmDialog.tsx    # Generic confirmation dialog
│   │   └── EmptyState.tsx       # Empty state message
│   └── utils/
│       ├── api.ts           # Frontend API client (all fetch calls to /api/*, device name tracking)
│       ├── categories.ts    # Default category list
│       └── storage.ts       # JSON export/import helpers
├── .mcp.json                # MCP server registration (points to Express API)
├── .claude/
│   ├── launch.json          # Dev server configurations for Claude Code
│   └── settings.local.json  # Permission allowlist for bash/MCP/npm commands
├── registry.db              # SQLite database (DO NOT delete — contains all data)
├── deploy.sh                # Deployment script for Raspberry Pi
├── vite.config.ts           # Vite config with Tailwind plugin + dev proxy
├── package.json
└── tsconfig.app.json
```

## Development

```bash
# Install dependencies (legacy-peer-deps required for Tailwind v4 + Vite 8)
npm_config_cache=/tmp/npm-cache npm install --legacy-peer-deps

# Start the API server (port 3001)
npx tsx server/index.ts

# Start the Vite dev server (port 5173, proxies /api → localhost:3001)
npm run dev
```

Both servers must be running for development. The Vite dev server proxies all `/api` requests to the Express backend.

## Important Conventions

- **`verbatimModuleSyntax` is ON** — all type-only imports MUST use `import type { ... }`
- **npm cache**: Use `npm_config_cache=/tmp/npm-cache` prefix for npm commands (default cache has root-owned files)
- **`--legacy-peer-deps`**: Required for all `npm install` commands (Tailwind v4 peer dep conflict with Vite 8)
- Column names in SQLite use `snake_case` (`image_url`, `product_name`, `created_at`); the API returns `camelCase` (`imageUrl`, `productName`, `createdAt`). The `rowToItem()` function in `server/index.ts` handles the mapping.

## Data Model

### RegistryItem
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Auto-generated |
| name | string | Item name |
| category | string | FK to categories table |
| status | `""` \| `"Researching"` \| `"Decided"` \| `"Already Have / Purchased"` \| `"Not Needed"` | Empty string = no status |
| priority | `"Necessary"` \| `"Nice to Have"` \| `""` | Empty string = no priority |
| price | number | 0 = no price |
| link | string | Product URL |
| imageUrl | string | Product image URL (auto-scraped from link) |
| productName | string | Product name (auto-scraped from link) |
| notes | string | Supports markdown formatting |
| registry | string | Which registry the item was added to (free text, e.g. "Amazon", "Babylist") |
| registrationStatus | `""` \| `"Needs Registration"` \| `"Registered"` \| `"N/A"` | Manufacturer registration tracking (strollers, car seats, etc.). Empty = unset |
| createdAt | string (ISO 8601) | Auto-set |
| updatedAt | string (ISO 8601) | Auto-set on every update |

### Filters
Status, priority, category, registry, and manufacturer registration filters. Search queries match against item name and notes. The `useRegistry` hook computes `filteredItems`, `sortedItems`, and `groupedItems` from these filters.

## API Routes

All routes are prefixed with `/api`:

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/categories | List all categories |
| POST | /api/categories | Add a category `{ name }` |
| DELETE | /api/categories/:name | Delete empty category |
| GET | /api/items | List all items |
| POST | /api/items | Create item |
| PUT | /api/items/:id | Update item (partial updates OK) |
| DELETE | /api/items/:id | Delete item |
| POST | /api/import | Bulk replace all data `{ categories, items }` |
| GET | /api/export | Export all data as JSON |
| POST | /api/scrape-link | Scrape product image/name from URL `{ url }` |
| GET | /api/audit-log | Paginated audit log `?limit=50&offset=0` |
| GET | /api/items/:id/history | Change history for a specific item |

## Database Migrations

Migrations run automatically on server startup in `server/db.ts`. The migration system:
1. Checks for missing columns (`registry`, `image_url`, `product_name`)
2. Checks if status/priority constraints match current enum values
3. If migration needed: renames table, creates new one with correct constraints, copies data with value transformations, drops old table
4. Handles legacy value conversion: `"Still Researching"` → `"Researching"`, `"Final Choice"` → `"Decided"`, `"Unprioritized"` → `""`

### Audit Log

The `audit_log` table tracks all data changes for accountability:

| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER | Auto-increment primary key |
| action | `"CREATE"` \| `"UPDATE"` \| `"DELETE"` \| `"IMPORT"` | Type of change |
| entity_type | `"item"` \| `"category"` \| `"import"` | What was changed |
| entity_id | string | ID of the affected entity |
| entity_name | string | Human-readable name of the entity |
| field_name | string \| null | Which field changed (for updates) |
| old_value | string \| null | Previous value |
| new_value | string \| null | New value |
| actor | string | Device name + IP (e.g. `"MCP / Claude (10.0.3.1)"`) |
| timestamp | string (ISO 8601) | When the change occurred |

All API mutations automatically log to audit. The `X-Device-Name` header identifies the client (browser sends device info, MCP server sends `"MCP / Claude"`).

## Production / Deployment

The Express server serves both the API and the built frontend from `dist/`. A single process handles everything.

```bash
# Build frontend
npx vite build

# Run production server (serves API + static frontend on port 3001)
npx tsx server/index.ts
```

### Raspberry Pi Deployment

The app runs on a Raspberry Pi at `10.0.3.2` on the home network, accessible at `https://baby.henkhaus.org`.

- **nginx** reverse proxies 80/443 → localhost:3001
- **Self-signed TLS cert** at `/etc/ssl/certs/baby-registry.crt`
- **Local DNS** (UniFi) resolves `baby.henkhaus.org` → `10.0.3.2`
- **Deploy script**: `bash deploy.sh 10.0.3.2 gregoryhenkhaus`
  - Builds frontend, creates tarball (excludes node_modules + registry.db)
  - SCPs to Pi, extracts, preserves existing database
  - Installs deps, restarts server via `nohup`

nginx config is at `/etc/nginx/sites-available/baby-registry` on the Pi.

## MCP Server

The MCP server (`mcp-server/`) exposes the registry's API as tools that Claude can use directly. It connects to the Express API over HTTP and uses stdio transport for Claude communication.

### Configuration

- `.mcp.json` at project root registers the server; points to the Express API base URL (default: `http://10.0.3.2:3001`)
- The MCP server sends `X-Device-Name: "MCP / Claude"` on all requests for audit trail identification

### Tools

| Tool | Description |
|------|-------------|
| `list_items` | List items with optional filters (status, priority, category, registry, hasLink, search) |
| `get_item` | Get a single item by ID |
| `create_item` | Create a new registry item |
| `update_item` | Update an existing item (partial updates) |
| `delete_item` | Delete an item |
| `list_categories` | List all categories |
| `create_category` | Add a new category |
| `delete_category` | Delete an empty category |
| `scrape_product_link` | Scrape product image/name from a URL |
| `get_audit_log` | Get paginated audit log entries |
| `get_item_history` | Get change history for a specific item |
| `export_data` | Export all registry data as JSON |
| `get_registry_summary` | Computed statistics (totals, breakdowns by status/priority/category/registry) |

### Resources

| URI | Description |
|-----|-------------|
| `registry://items` | All items as JSON |
| `registry://categories` | All categories |
| `registry://summary` | Computed registry statistics |
| `registry://audit-log` | Last 50 audit entries |

### Key deployment notes
- The server listens on `0.0.0.0:3001` (not just localhost) so nginx can proxy to it
- The database file (`registry.db`) must be preserved during deploys — it contains all user data
- The server auto-runs migrations on startup, so schema changes deploy automatically
