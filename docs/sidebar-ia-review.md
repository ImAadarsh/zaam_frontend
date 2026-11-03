# Sidebar information architecture review

**Scope:** `zaam-panels` module sidebars (desktop + mobile), Module Hub, `nav-pages.generated.ts`  
**Constraint:** Local only — no git push / DEV / prod deploy  
**Skills applied:** `ux-designer` (IA), `designing-user-experience` (nav orientation), `ux-heuristics` (Trunk Test, consistency, recognition over recall)

## Principles used

- Group by **user mental model** (what job am I doing?), not by historical route folder.
- Prefer **moving** items over new modules; create a module only when a coherent cluster exists.
- Keep **URLs stable** unless a new hub module needs a landing path (`/channels/dashboard`).
- Soft-removed items stay out: **Bundles**, **Promotional prices**.

## Inventory (before → decision)

| Module (before) | Nav item | Path | Decision |
|-----------------|----------|------|----------|
| General | Global Dashboard | `/dashboard` | Keep |
| Identity & Access | Overview, Orgs, Users, Roles, Audit, API Keys | `/iam/*` | Keep |
| Product & Catalog | Catalog Items | `/catalog/items` | Keep |
| Product & Catalog | Classifications | `/catalog/classifications` | Keep (taxonomy belongs with products) |
| Product & Catalog | Inventory Import | `/catalog/inventory-import` | **Move → Inventory** (stock/warehouse job; URL kept) |
| Product & Catalog | Variants, Product Media | `/catalog/variants`, `/catalog/product-media` | Keep |
| Product & Catalog | Channel Mappings | `/catalog/channel-mappings` | **Move → Channels & Integrations** |
| Product & Catalog | Import Channels | `/catalog/import-channels` | **Move → Channels** |
| Product & Catalog | WordPress Channels | `/catalog/wordpress-channels` | **Move → Channels** |
| Product & Catalog | EPOS Channels | `/catalog/epos-channels` | **Move → Channels** (label: EPOS / GoodTill) |
| Product & Catalog | Price Lists | `/catalog/price-lists` | Keep (no separate Pricing module for one item; B2B has its own pricing) |
| Product & Catalog | Tax Codes | `/catalog/tax-codes` | Keep (product tax classification) |
| Product & Catalog | Compliance Documents | `/catalog/compliance-documents` | Keep |
| Product & Catalog | Bundles / Promotional prices | — | Remain soft-removed |
| Inventory | Warehouses → Cycle Counts, Suppliers, POs, ASN, GRN | `/inventory/*` | Keep (inbound purchasing stays with warehouse flow; no Purchasing module) |
| Orders & Customers | Customers, Orders, Returns | `/orders/*` | Keep |
| Orders & Customers | Channel Sync | `/orders/channel-sync` | **Move → Channels** (admin channel plumbing; URL kept; label: Order Channel Sync) |
| B2B Sale Channel | Products → Settings, Affiliates shortcut | `/b2b/*`, `/marketing/affiliates?channel=b2b` | Keep (channel-scoped ops) |
| B2B Sale Channel | Payment Dashboard | `/finance/payment-dashboard` | **Remove from B2B** (belongs in Finance; wrong ERP module) |
| Payments & Invoicing | Invoices → Budget Lines | `/finance/*` | Keep (Finance ↔ Accounting overlap deferred) |
| Finance & Accounting | Sales → Settings | `/accounting/*` | Keep |
| HR, CRM, Projects, Marketing, Social, Analytics, Fulfillment, System | (all items) | respective paths | Keep; CRM Integrations stay CRM-specific |

## After (implemented)

### New module: **Channels & Integrations** (`channels`)

| Item | Path (stable unless noted) |
|------|----------------------------|
| Overview | `/channels/dashboard` *(new hub landing)* |
| Channel Mappings | `/catalog/channel-mappings` |
| Import Channels | `/catalog/import-channels` |
| WordPress Channels | `/catalog/wordpress-channels` |
| EPOS / GoodTill | `/catalog/epos-channels` |
| Order Channel Sync | `/orders/channel-sync` |

### HR & Payroll (categorized)

Categorized into logical workflow subheaders using `<NavSubHeader />`:
- **People & Talent**: Employees, Recruitment, Onboarding, Documents
- **Time & Attendance**: Attendance, Leave
- **Payroll & Pension**: Payroll, Pension
- **Compliance & Reports**: Immigration & RTW, Reports & Compliance
- **Employee Portal**: Self-service

### CRM & Customer Service (categorized)

Categorized into logical workflow subheaders using `<NavSubHeader />`:
- **Overview**: Dashboard landing (`/crm/dashboard`)
- **Sales & Pipeline**: Accounts, Leads, Pipeline, Forecast, Activities
- **Customer Service**: Tickets, Canned Responses
- **Settings & Configuration**: Customer Tiers, Integrations, Settings

### Catalog (trimmed)

Overview, Catalog Items, Classifications, Variants, Product Media, Price Lists, Tax Codes, Compliance Documents.

### Inventory (gained)

…existing stock/warehouse/purchasing items **+ Inventory Import** (`/catalog/inventory-import`).

### B2B

Payment Dashboard cross-link removed; payments remain under Payments & Invoicing.

## Rationale (short)

1. **Channels cluster** — mappings + WordPress + EPOS/GoodTill + import + order sync are the same “connect external sales channel” job. Catalog users hunting SKUs should not wade through integration admin (Krug: don’t make me think; IA: user goals not folder structure).
2. **Inventory Import** — workbook creates stock/warehouse rows; warehouse managers look under Inventory. URL unchanged to avoid broken bookmarks.
3. **No Pricing module** — only one shared Price Lists surface; B2B Pricing is channel-specific. Proliferating a Pricing hub for one page fails the “coherent cluster” bar.
4. **No Purchasing module** — Suppliers / PO / ASN sit on the same inbound path as GRN; splitting would add a hub click without a distinct landing story.
5. **B2B ≠ Finance** — Payment Dashboard under B2B broke orientation (Trunk Test: “what section am I in?”) when the path switched to `/finance`.
6. **Finance vs Accounting** — both retain ledger-ish items; consolidating is a larger product decision and was intentionally not reshuffled here.

## Technical notes

- Desktop and mobile sidebars share one `ModuleNavSections` tree (no drift).
- Module Hub membership uses NAV group labels via `nav-module-slugs.ts` + `page-access.ts` (path root alone is wrong when URLs stay under `/catalog` or `/orders`).
- Deep links to moved pages still show the **owning** module sidebar (e.g. `/catalog/epos-channels` → Channels nav).
- Regenerated: `src/lib/nav-pages.generated.ts` via `scripts/gen-nav-pages.mjs` (now understands `<SectionHeader label="…">`).

## Files changed

- `src/components/sidebar.tsx`
- `src/data/modules.ts`
- `src/lib/nav-module-slugs.ts` *(new)*
- `src/lib/page-access.ts`
- `src/lib/nav-pages.generated.ts`
- `scripts/gen-nav-pages.mjs`
- `docs/sidebar-ia-review.md` *(this file)*
