# TLV Capital CRM — Database Schema

This document describes every table in the database, its columns, and how tables relate to each other. The actual SQL lives in `supabase/migrations/`. This document is the human-readable reference.

All tables use UUIDs as primary keys. All tables include `created_at` (set automatically on insert). Tables with mutable records include `updated_at` (set automatically on update via a trigger).

---

## Enums

Enums are fixed value sets baked into the database. They are used only for concepts that are structural to the system and extremely unlikely to change. If a value set needs to be manageable by Admins at runtime, it is a **lookup table** instead (see below).

```
user_role:        admin | rsm | sector_manager
lead_source:      cold_outreach | partner | inbound | diplomatic | marketing
budget_status:    not_yet_secured | secured
mnda_status:      not_required | pending | sent | signed
activity_type:    call | email | meeting | demo | site_visit | internal_review
org_type:         ministry_of_defense | defense_agency | intelligence | police_hls | government | private | other
client_status:    active | inactive | former
sector_scope:     all | own_sectors_only
```

**UI display names:** Most enum values render by replacing underscores with spaces and title-casing (e.g. `cold_outreach` → "Cold Outreach", `site_visit` → "Site Visit"). The one exception: `activity_type` value `demo` renders as **"Demo / Product Presentation"** — matching the language in PRODUCT.md §4.3. Define this mapping in a shared constants file, not inline in every component.

---

## Lookup Tables

These small reference tables replace what would otherwise be hardcoded enums. Their values are managed by Admins through the UI — no database migration needed when the business adds a new sector, renames a stage, or changes the advisor team.

### `sectors`

The business domains that organise the product catalog and Sector Manager access.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text unique | e.g. Defense Export, Homeland Security, Cyber, Manufacturing |
| `is_active` | bool | Inactive sectors are hidden from new forms but preserved on historical records |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**RLS:** All authenticated users can read. Admins only can write.

---

### `pipeline_stages`

The ordered stages an opportunity moves through. Admin-managed so stages can be added or renamed without a migration. Two boolean flags mark the terminal states that trigger business logic.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text unique | e.g. New, Qualified, Awaiting NDA, Proposal Sent |
| `display_order` | int | Controls order in the UI and pipeline view |
| `is_won` | bool | True for the Won stage — triggers Client + Contract record creation |
| `is_lost` | bool | True for the Lost stage |
| `is_active` | bool | Inactive stages hidden from new forms, preserved on existing records |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Constraints:
- `CREATE UNIQUE INDEX ON pipeline_stages (is_won) WHERE is_won = true` — enforces that at most one stage has `is_won = true` at any time. If an Admin promotes a new stage to Won, the action must first clear the old stage's flag (enforced in the Server Action before calling the service client).
- `CREATE UNIQUE INDEX ON pipeline_stages (is_lost) WHERE is_lost = true` — same guarantee for the Lost stage.

**RLS:** All authenticated users can read. Admins only can write.

---

### `advisors`

Internal TLV Capital staff who can be assigned as advisor support on an opportunity. Admin-managed so no migration is needed when team members join or leave.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text unique | e.g. Manor, Doron, Nitzan, Ziv |
| `is_active` | bool | Inactive advisors hidden from new forms, preserved on historical records |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**RLS:** All authenticated users can read. Admins only can write.

---

### `regions`

Geographic regions. Each RSM is assigned to one region. Admin-managed and can be changed at any time.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text unique | e.g. Baltics, Nordics, Balkan, LATAM, Israel, Asia |
| `is_active` | bool | Default true. Inactive regions are hidden from new forms but preserved on historical records. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**RLS:** All authenticated users can read. Admins only can write.

---

## Tables

### `users`

System users. One row per person with CRM access. Managed by Admins.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Matches Supabase Auth `auth.users.id` |
| `email` | text unique | |
| `full_name` | text | |
| `role` | user_role | `admin`, `rsm`, or `sector_manager` |
| `region_id` | uuid FK → regions | Null for admin and sector_manager. Set for RSM. |
| `is_active` | bool | False = deactivated, cannot log in |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `sector_scope` | sector_scope | `all` or `own_sectors_only`. Only meaningful for `sector_manager` role. Default `all`. Controls whether this Sector Manager sees all records or only records in their assigned sectors. Changeable per user by an Admin at any time. |

Sector Manager sector assignments are stored in `user_sectors`, not here, to support multiple sector assignments per user.

Constraint: `CHECK (role != 'rsm' OR region_id IS NOT NULL)` — ensures every RSM has a region assigned. Admins and Sector Managers have `region_id = NULL` (their access does not depend on region), but the constraint does not prevent future edge cases where an admin row carries a region value.

**RLS:** A user can read their own row. Admins can read and write all rows.

---

### `user_sectors`

Maps Sector Managers to their assigned sectors. A Sector Manager can be assigned to multiple sectors. Managed by Admins and can be changed at any time.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | Should be a user with role = sector_manager |
| `sector_id` | uuid FK → sectors | |
| `created_at` | timestamptz | |

Unique constraint on (`user_id`, `sector_id`).

**RLS:** All authenticated users can read. Admins only can write.

---

### `clients`

Confirmed customers — organizations that have signed at least one contract. A Client record is created when an Opportunity is marked Won. Before that point, the customer is just text fields on the Opportunity. When an opportunity is Won, the system first checks if a Client with the same name already exists in that region — if so, it links to the existing record rather than creating a duplicate.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | Organization name |
| `country` | text | |
| `region_id` | uuid FK → regions | Determines which RSM(s) can see this client |
| `organization_type` | org_type | Nullable. ministry_of_defense, defense_agency, intelligence, police_hls, government, private, other. Copied from `opportunity.prospect_organization_type` on Win — may be null if the RSM did not fill it in. |
| `status` | client_status | active, inactive, former |
| `website` | text | |
| `notes` | text | Free text |
| `created_at` | timestamptz | Date of first won deal |
| `updated_at` | timestamptz | |

Status lifecycle: `active` is the default when a Client record is created at Win. Admins can change it to `inactive` or `former` via the client edit form. RSMs cannot change client status. No automatic status transitions occur — changes are manual Admin actions only.

**RLS:** Admins see all and can create, edit, and delete any client. RSMs can read and create/edit clients where `region_id` matches their own — they cannot delete clients. Sector Managers see all clients (read only) — clients do not have a sector, so no sector filter applies here.

---

### `contacts`

People at Client organizations.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid FK → clients | Nullable. Null while the parent opportunity is open (pre-Win). Set when the opportunity is Won and a Client record is created or linked. |
| `opportunity_id` | uuid FK → opportunities | Nullable. Set for contacts created during the opportunity phase, before a Client record exists. Allows RSMs to create named contacts for a prospect and log activities against them before Win. On Win, `closeOpportunity` sets `client_id` on all contacts where `opportunity_id` matches. |
| `full_name` | text | |
| `title` | text | Job title |
| `email` | text | |
| `phone` | text | |
| `is_primary` | bool | True = main point of contact at this client |
| `notes` | text | |
| `last_activity_at` | timestamptz | Denormalized. Set by a Postgres trigger whenever an activity linked to this contact is inserted, updated, or deleted. Powers inactive-contact detection on the RSM dashboard without a live aggregation query. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Constraints:
- `CHECK (client_id IS NOT NULL OR opportunity_id IS NOT NULL)` — every contact must be linked to at least a client or an opportunity.
- Partial unique index: `CREATE UNIQUE INDEX ON contacts (client_id) WHERE is_primary = true AND client_id IS NOT NULL` — ensures only one contact per client can be marked primary. Without this, a UI bug or concurrent write could mark two contacts as primary, making "primary contact" ambiguous everywhere it is displayed.

**RLS:** Admins see all and can write all. RSMs can read and create/edit contacts for clients in their region and for their own opportunities (where `opportunity_id` matches). Sector Managers can read all contacts and create/edit contacts. Deletion is Admin-only.

---

### `opportunities`

The core sales pipeline record. Prospect details live here until Won, at which point a Client record is created (or linked).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `rsm_id` | uuid FK → users | The RSM who owns this opportunity |
| `region_id` | uuid FK → regions | Denormalized for RLS. Updated automatically when the opportunity is reassigned to an RSM in a different region. |
| `stage_id` | uuid FK → pipeline_stages | Current pipeline stage |
| `requirement_type` | text | Free text — type of requirement (e.g. C-UAS, Optronics, Maritime ISR) |
| `sector_id` | uuid FK → sectors | Which sector this opportunity belongs to |
| `description` | text | Brief description of the client's requirement |
| `prospect_company_name` | text | Name of the prospect organization |
| `prospect_organization_type` | org_type | Nullable. Type of the prospect organization. Copies to `client.organization_type` when the opportunity is Won. |
| `country` | text | Country of the prospect organization |
| `prospect_website` | text | |
| `prospect_contact_name` | text | Primary contact at the prospect |
| `prospect_contact_email` | text | |
| `prospect_contact_phone` | text | |
| `lead_source` | lead_source | cold_outreach, partner, inbound, diplomatic, marketing |
| `advisor_id` | uuid FK → advisors | Internal advisor supporting this opportunity |
| `registration_date` | date | Date the opportunity was entered into the system |
| `estimated_value` | numeric | |
| `currency` | text | ISO 4217 three-letter code (USD, EUR, ILS, GBP, SGD, AUD). `CHECK (currency ~ '^[A-Z]{3}$')`. Rendered as a select field in the UI — not free text. |
| `budget_status` | budget_status | not_yet_secured, secured |
| `probability_pct` | int | 0–100. `CHECK (probability_pct BETWEEN 0 AND 100)` |
| `expected_close_date` | date | |
| `special_license_required` | bool | Default false. True = special export license needed. |
| `next_step` | text | Free text. RSM updates this to describe the immediate next action. |
| `is_at_risk` | bool | Default false. Manually flagged by RSM or Admin when the deal is in jeopardy. |
| `last_activity_at` | timestamptz | Denormalized. Set by a Postgres trigger whenever an activity linked to this opportunity is inserted, updated, or deleted. Powers stale-deal detection on the RSM dashboard without a live aggregation query. |
| `client_id` | uuid FK → clients | Null until Won. Set when the deal closes. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**RLS:** Admins see all. RSMs see opportunities where `region_id` matches their own. Sector Managers see all opportunities by default. If `sector_scope = 'own_sectors_only'`, filtered to opportunities where `sector_id` is in their assigned sectors (via `user_sectors`).

---

### `opportunity_products`

Links products from the catalog to an opportunity. One opportunity can include products from multiple manufacturers.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `opportunity_id` | uuid FK → opportunities | |
| `product_id` | uuid FK → products | Nullable — product may not be in the catalog yet |
| `product_name_freetext` | text | Used when `product_id` is null |
| `quantity` | int | Default 1. `CHECK (quantity > 0)` |
| `partner_contact_name` | text | Nullable. The manufacturer contact for this specific product line. Separate from the prospect contact on `opportunities`. |
| `partner_contact_email` | text | Nullable. |
| `partner_contact_phone` | text | Nullable. |
| `partner_mnda_status` | mnda_status | Nullable. Tracked per product line because different manufacturers on the same opportunity may be at different MNDA stages. |
| `notes` | text | Deal-specific notes about this product line |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Constraint: `CHECK (product_id IS NOT NULL OR product_name_freetext IS NOT NULL)` — every line must reference either a catalog product or provide a free-text name.

**Why partner contacts live here, not on `opportunities`:** An opportunity can include products from multiple manufacturers. Each manufacturer has its own contact and its own MNDA status. Storing one partner contact on the opportunity would require picking one manufacturer arbitrarily when there are several — which loses information and creates confusion with the prospect-side contacts (`prospect_contact_name` etc.).

**RLS:** A user can read `opportunity_products` rows if they can see the parent opportunity: `USING (opportunity_id IN (SELECT id FROM opportunities))`. RSMs can insert and update rows for their own opportunities; Admins can write all.

---

### `activities`

Log of all interactions with clients and contacts.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `opportunity_id` | uuid FK → opportunities | Nullable — activity may be client-level |
| `client_id` | uuid FK → clients | Nullable — populated for client-level activities |
| `contact_id` | uuid FK → contacts | Nullable — the specific person involved |
| `user_id` | uuid FK → users | Who logged this activity |
| `type` | activity_type | call, email, meeting, demo, site_visit, internal_review |
| `subject` | text | Brief subject or title |
| `notes` | text | Full notes from the interaction |
| `activity_date` | timestamptz | When the interaction occurred |
| `created_at` | timestamptz | When it was logged |
| `updated_at` | timestamptz | |

Constraint: `CHECK (opportunity_id IS NOT NULL OR client_id IS NOT NULL)` — every activity must be linked to at least an opportunity or a client.

**RLS:** Admins see all and can write all. RSMs can read and create/edit activities linked to their own opportunities or to clients in their region. Sector Managers can read all activities by default and create/edit activities. If `sector_scope = 'own_sectors_only'`, Sector Manager read access is limited to activities linked to opportunities in their assigned sectors. Activities where `opportunity_id IS NULL` (logged directly against a client, not tied to any deal) are always visible to all Sector Managers regardless of `sector_scope` — clients have no sector, so no sector filter can apply.

---

### `contracts`

Created when an opportunity is Won.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `opportunity_id` | uuid FK → opportunities | |
| `client_id` | uuid FK → clients | Denormalized for easier querying |
| `contract_value` | numeric | |
| `currency` | text | ISO 4217 three-letter code. `CHECK (currency ~ '^[A-Z]{3}$')`. Pre-filled from the opportunity's currency in the Close Deal modal. |
| `signed_date` | date | |
| `expected_delivery_date` | date | |
| `is_at_risk` | bool | Default false. Manually flagged when delivery or payment is in jeopardy. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**RLS:** Admins can read and write all contracts. RSMs can read contracts for their own opportunities and can update only the `is_at_risk` flag — they cannot edit contract terms (value, currency, dates). Sector Managers see all contracts by default (read only). If `sector_scope = own_sectors_only`, limited to contracts for opportunities in their assigned sectors.

---

### `manufacturers`

Companies whose products TLV Capital represents.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text unique | e.g. CyberRidge, TATOOM, Sterlights |
| `country_of_origin` | text | |
| `website` | text | |
| `notes` | text | |
| `is_active` | bool | False = no longer represented by TLV Capital |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**RLS:** All authenticated users can read. Admins only can write.

---

### `products`

Individual items from the product catalog. Each product belongs to one manufacturer and one sector.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `manufacturer_id` | uuid FK → manufacturers | |
| `name` | text | |
| `sku` | text | Manufacturer's part number or SKU |
| `category` | text | Free text — product category (e.g. Optical Encryption, C-UAS) |
| `sector_id` | uuid FK → sectors | Which sector this product belongs to |
| `description` | text | Full product description |
| `margin_pct` | numeric | TLV Capital's margin on this product, stored as a percentage (e.g., 15 for 15%). Visible to all authenticated users. |
| `is_active` | bool | False = no longer offered |
| `datasheet_url` | text | Link to product datasheet or collateral |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**RLS:** All authenticated users — including RSMs and Sector Managers — can read all products. Admins only can write.

---

## Relationships Diagram

```
sectors (lookup)
  └── user_sectors (sector_id)
  └── opportunities (sector_id)
  └── products (sector_id)

pipeline_stages (lookup)
  └── opportunities (stage_id)

advisors (lookup)
  └── opportunities (advisor_id)

regions
  └── users (region_id)
  └── clients (region_id)
  └── opportunities (region_id)

users
  └── user_sectors (user_id)
  └── opportunities (rsm_id)
  └── activities (user_id)

clients
  └── contacts (client_id)
  └── opportunities (client_id) ← set on Won
  └── activities (client_id)
  └── contracts (client_id)

opportunities
  └── opportunity_products (opportunity_id)
  └── activities (opportunity_id)
  └── contracts (opportunity_id)
  └── contacts (opportunity_id) ← prospect-phase contacts, client_id set on Win

manufacturers
  └── products (manufacturer_id)

products
  └── opportunity_products (product_id)
```

---

## Key Design Decisions

**Lookup tables over enums for business-managed values.** Sectors, pipeline stages, advisors, and regions are lookup tables rather than PostgreSQL enums. This means an Admin can add a new sector, rename a pipeline stage, add an advisor, or add a region through the UI without any database migration. Enums are reserved for values that are structural to the system and never change at runtime (user roles, activity types, etc.).

**Sector Managers support multiple sectors via a join table.** Rather than storing a single `sector` column on `users`, a `user_sectors` join table allows one Sector Manager to be assigned to multiple sectors. Assignments can be changed by an Admin at any time.

**Prospects are not Clients.** Before a deal is Won, the customer is just text fields on the Opportunity. A `clients` row is only created on Win, keeping the client list clean and meaningful.

**`prospect_organization_type` on opportunities copies to `client.organization_type` on Win.** The RSM knows the organization type from the start of the opportunity — not just at close. Capturing it on the opportunity means the Client record is fully populated atomically when Won, with no extra step required from the RSM at close time.

**Duplicate client check on Win.** When an opportunity is marked Won, the application checks if a Client with the same name already exists in that region using a case-insensitive comparison (`ILIKE` or `lower()`). If so, it links the opportunity to the existing Client rather than creating a duplicate. This handles the case where the same organisation wins multiple deals over time.

**`region_id` is denormalized onto `opportunities` and updates on reassignment.** Storing region directly on the opportunity makes RLS simpler and more performant. When an Admin reassigns an opportunity to an RSM in a different region, `region_id` updates to match — there is no constraint preventing cross-region reassignment.

**`pipeline_stages` uses boolean flags for terminal states.** Rather than checking `stage.name === 'won'` in application code, the Won and Lost stages are identified by `is_won` and `is_lost` boolean columns. This means the Won stage can be renamed without breaking any business logic.

**No `export_licenses` table.** Export license management is handled outside the CRM. The only CRM footprint is `special_license_required` (boolean) on `opportunities`.

**`sector_scope` makes Sector Manager data access Admin-configurable.** Rather than hardcoding the scope of what Sector Managers can see into the RLS policies, a `sector_scope` column on `users` (`all` or `own_sectors_only`) makes this a per-user setting changeable by an Admin at any time. Current default is `all` for all Sector Managers — they see the full pipeline, full product catalog, and all contracts. When the business decides to restrict a specific Sector Manager's view to their assigned sectors, an Admin flips this column. No migration and no code change required.

**`requirement_type` replaces `category` on opportunities.** The column was originally named `category`, but `products` also has a `category` column with a different meaning (product classification vs. customer requirement type). Having two unrelated `category` columns visible in the same queries and forms caused confusion. The opportunity column is named `requirement_type` to be unambiguous.

**Contacts can exist before a Client (pre-Win contacts).** `contacts.client_id` is nullable and `contacts.opportunity_id` is an additional nullable FK. This allows RSMs to create contact records during the opportunity phase — before a deal is Won and a Client row exists — and log activities against them. On Win, `closeOpportunity` sets `client_id` on any contacts linked via `opportunity_id`. The constraint `CHECK (client_id IS NOT NULL OR opportunity_id IS NOT NULL)` ensures every contact remains anchored to something. This avoids the alternative (a separate `prospect_contacts` table), which would require a merge step on Win and duplicate RLS policies.

**`last_activity_at` is denormalized on opportunities.** The RSM dashboard surfaces stale deals (no recent activity) on every load. Computing this via `MAX(activity_date)` from `activities` on every request is an aggregation join that scales poorly. A Postgres trigger on `activities` (firing on INSERT, UPDATE, DELETE) keeps `opportunities.last_activity_at` current in-place, so the stale-deal query is a simple `WHERE last_activity_at < NOW() - INTERVAL '30 days'`.
