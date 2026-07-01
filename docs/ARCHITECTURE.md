# TLV Capital CRM — Architecture

This document records the technical decisions made for this project, the reasoning behind each one, and the tradeoffs accepted. When a significant decision needs to change, update this document first.

---

## Stack

### Next.js 16 (App Router)

**Chosen over:** Vite + React (SPA)

**Why:** A CRM has dozens of nested routes with shared layouts (sidebar, auth guard, role-specific navigation). Next.js App Router handles this with file-based routing and nested layouts — no manual wiring. Server Components mean data-heavy pages ship with initial HTML populated, so the RSM sees their pipeline immediately rather than a blank screen waiting for JavaScript to hydrate. Middleware runs before any route renders, making RBAC enforcement reliable and central.

**Tradeoff accepted:** The Server/Client component boundary is a real cognitive overhead. You will hit confusing errors when a Server Component tries to use browser APIs, or a Client Component imports a server-only module. The rule: anything with `useState`, `useEffect`, event handlers, or TanStack Query hooks gets `'use client'`. Everything else is a Server Component by default.

**Tradeoff accepted:** Next.js is most naturally deployed on Vercel. Self-hosting is possible but adds ops complexity.

---

### Supabase (PostgreSQL + Auth + Storage + RLS)

**Chosen over:** Custom Node.js/Express backend

**Why:** The hardest access control problem in this CRM — RSMs can only see their own region's data — is solved at the database layer with Row Level Security. An RSM with a valid JWT literally cannot query another region's rows, no matter what the application sends. This is stronger than application-layer access control, which can have bugs. Supabase also provides auth, file storage for documents, and a REST API with no additional setup.

**Tradeoff accepted:** Supabase is a managed service. An outage at Supabase is your outage. Pricing scales with usage (free tier is sufficient at current scale; paid tiers are reasonable).

**Tradeoff accepted:** Complex business logic (e.g., "when a deal is Won, create a Client record and a Contract record atomically") is awkward to express in RLS + database functions alone. This logic lives in Server Actions on the Next.js layer, which call Supabase using the service role key. The database enforces read access; the application enforces write logic.

**Why not a custom backend:** At this scale and complexity, a custom backend adds significant time (auth, sessions, ORM, API design, deployment) with no benefit. If the business logic eventually outgrows what Server Actions can handle cleanly, a Node.js service can be added alongside Supabase — the database doesn't change.

---

### shadcn/ui + Tailwind CSS

**Chosen over:** Material UI, Ant Design, Chakra UI

**Why:** shadcn/ui is not a component library — it is source code you copy into your project and own. There is no npm package to update; the components live in `components/ui/` and can be modified freely. All components are built on Radix UI primitives, which handle accessibility (keyboard navigation, screen reader support, ARIA) correctly by default. Tailwind CSS co-locates styles with components — no separate stylesheet to maintain.

**Tradeoff accepted:** When the upstream shadcn component is updated, you have to manually re-copy the component. There is no `npm update`. This is intentional — it means the components are stable and don't change unexpectedly.

**Tradeoff accepted:** More upfront setup than dropping in Ant Design and getting 50 pre-built components. The payoff is full control over markup and styling with no fighting against the library.

**Why not Ant Design:** Heavy bundle, very opinionated aesthetic that is hard to override, and the table/form components lock you into their patterns. Any customization beyond the standard use cases requires overriding internal CSS.

---

### TanStack Table v8

**Chosen over:** AG Grid, hand-rolled tables

**Why:** TanStack Table is headless — it provides the logic (sorting, filtering, pagination, row selection, column pinning) but you own the markup. This means tables look exactly like the rest of the UI, not like an embedded third-party widget. It handles all the complexity of stateful tables without dictating appearance.

**Tradeoff accepted:** More boilerplate to set up than AG Grid's batteries-included approach. The column definitions and table markup are more verbose. This cost is paid once per entity and then the pattern is consistent across the entire app.

**Why not AG Grid:** The Community edition is free but limited. The Enterprise edition (which has the features worth having — server-side row model, advanced grouping, Excel export) requires a commercial license. At the current data scale (hundreds of rows, not tens of thousands), TanStack Table is sufficient.

---

### TanStack Query v5

**Chosen over:** `useEffect` + `useState` for data fetching, `router.refresh()`

**Why:** TanStack Query is a server state manager. It handles caching, background refetching, loading and error states, and cache invalidation after mutations — all the things that are tedious and error-prone to implement manually. When an RSM updates a deal stage, TanStack Query invalidates the relevant cache key and the pipeline view updates immediately without a page reload.

**The previous CRM used `router.refresh()` after every mutation.** This caused a full page reload on every save, which felt slow and reset scroll position. TanStack Query replaces this entirely.

**Tradeoff accepted:** A small learning curve around query keys, stale times, and invalidation. The mental model (server state is separate from client state) is correct and pays off immediately.

---

### React Hook Form + Zod

**Why React Hook Form:** CRM forms have many fields. React Hook Form uses uncontrolled inputs — the form does not re-render on every keystroke, which makes forms with 15+ fields feel fast. It also handles validation, dirty state, and submission state with minimal boilerplate.

**Why Zod:** Zod schemas are TypeScript-first and can be shared between the form (client-side validation) and the Server Action (server-side validation). One schema definition, validated in both places. The inferred TypeScript type from a Zod schema (`z.infer<typeof schema>`) is used as the form's value type, keeping everything in sync.

---

### Zustand

**Why:** Minimal client state outside of server data — sidebar open/closed, active modal, selected rows for bulk actions. Zustand handles this with a very small API and no boilerplate. There is no Redux, no Context with useReducer, no complex state management. TanStack Query owns server state; Zustand owns the small amount of pure UI state.

---

### Recharts

**Why:** The Admin dashboard requires a time-series view of pipeline progression (PRODUCT.md §7). Recharts is a React-native charting library built on D3 that uses standard React components and SVG — charts are composed the same way as any other React component and work naturally with Tailwind and shadcn's design tokens. Line, area, bar, and composed chart types cover all current dashboard requirements.

**Chosen over:** Chart.js (imperative canvas-based API, no native React model), Victory (heavier API surface for the same output), Nivo (more opinionated theming that conflicts with shadcn).

**Tradeoff accepted:** Recharts adds ~100 KB gzipped to the client bundle. Chart components are code-split with `dynamic(() => import(...), { ssr: false })` so the cost is deferred and only paid when an Admin views the dashboard.

---

### Pipeline Export (CSV)

RSMs can export their own pipeline data as a spreadsheet (PRODUCT.md §6). This is handled entirely client-side — no server roundtrip, no additional library. A utility in `lib/utils.ts` serialises the data already present in the TanStack Query cache into a CSV string, then triggers a browser download via `Blob + URL.createObjectURL`. The export reflects exactly what the RSM sees on screen, including any active filters and sort order.

**No library added.** At the data volumes involved (hundreds of rows) client-side serialisation is instant. If formatted `.xlsx` output is required in the future, add `xlsx` at that point.

---

### Currency Fields

All monetary fields that include a currency use ISO 4217 three-letter codes (e.g. `USD`, `EUR`, `ILS`). Currency is rendered as a **select field** in every form — never free text. The allowed list is defined once in a shared constants file:

```typescript
// lib/constants.ts
export const CURRENCIES = [
  'USD', 'EUR', 'ILS', 'GBP',       // primary
  'SGD', 'JPY', 'INR', 'AUD',       // Asia / Pacific
  'SEK', 'NOK', 'DKK',              // Nordics / Baltics
  'BRL', 'ARS', 'MXN', 'COP',      // LATAM
  'RSD', 'RON',                      // Balkan
] as const
export type Currency = typeof CURRENCIES[number]
```

Both the opportunity Zod schema and the contract Zod schema import `CURRENCIES` from this file. The database adds `CHECK (currency ~ '^[A-Z]{3}$')` as a safety net. Products do not have a currency field — margin is stored as a percentage, which is currency-agnostic.

**Why not free text:** `"USD"` and `"usd"` are different strings. Silent inconsistencies in currency values break the Admin dashboard's pipeline value rollups — incorrectly grouped totals show up as wrong numbers, not as errors. A select field eliminates this at the source.

**Why not a DB enum:** The list may expand as TLV enters new regions. Changing a `const` array requires one file edit and a deploy. Changing a PostgreSQL enum requires a migration.

---

### Progressive Web App (next-pwa)

RSMs use the CRM on mobile devices in the field. The app is configured as a PWA using `next-pwa`, which generates a service worker and manifest from the Next.js build. This gives RSMs an installable app experience on their phones (home screen icon, full-screen launch) with no separate codebase.

**Chosen over:** React Native (a separate mobile app would split the codebase and double maintenance overhead for a team of one).

**Tradeoff accepted:** PWA offline support is limited. The app requires a network connection to query Supabase. Offline-first caching for the pipeline view is out of scope for the first version — the PWA benefit is installability and mobile UX, not offline access.

---

### Vercel (Hosting)

**Why:** Vercel built Next.js. Deployment is zero-config — push to `main` and the app deploys. Preview deployments are created automatically for every branch, which means a new screen can be shared with the VP for review before it goes live. The global CDN means fast load times on mobile for RSMs working internationally. The free tier covers this project's scale comfortably.

---

## Design Principles

### Single Responsibility

Each layer owns exactly one concern:

- **React component** → renders UI, handles user interaction
- **TanStack Query hook** → owns data fetching, caching, and loading/error state
- **Server Action** → owns a single mutation (create, update, or delete) and its side effects
- **Zod schema** → owns validation rules
- **`api.ts`** → owns the raw Supabase query for a feature

When a bug is found or a feature changes, exactly one file is the correct place to make the change.

### Open/Closed for Entities

Adding a new entity to the CRM (a new table, new pages, new forms) means adding a new feature folder. It does not require modifying the shared `DataTable` component, the auth middleware, or any existing feature. The generic components are open for use and closed for modification.

### Dependency Inversion

Components depend on hooks, not on Supabase. Hooks depend on `api.ts` functions. `api.ts` depends on the Supabase client. If the data layer ever changes, only `api.ts` changes — components are untouched. This also makes components independently testable.

### Interface Segregation

TypeScript types are scoped to their context. A form's type (`OpportunityFormValues`) contains only the fields the form edits — not the full database record with computed fields, foreign keys, and admin-only columns. A component that renders a client name doesn't receive the full `Client` type.

### Render Purity (React Compiler)

React Compiler is enabled (via `eslint-plugin-react-hooks`'s `react-hooks/purity` rule, which runs as an `error`, not a warning). It flags impure functions — `Date.now()`, `Math.random()`, `crypto.randomUUID()`, etc. — called directly in a component's render body, because a compiler-memoized component could otherwise return stale or inconsistent output across calls with the same props.

The fix is never to suppress the rule — capture the impure value once via a lazy `useState` initializer instead:

```typescript
// Wrong — Date.now() called directly during render
function LastActivityCell({ value }: { value: string | null }) {
  const daysAgo = (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)
  // ...
}

// Right — captured once, satisfies react-hooks/purity
function LastActivityCell({ value }: { value: string | null }) {
  const [now] = useState(() => Date.now())
  const daysAgo = (now - new Date(value).getTime()) / (1000 * 60 * 60 * 24)
  // ...
}
```

This pattern already applies in `features/opportunities/columns.tsx`'s `LastActivityCell`. It will come up again anywhere a "days ago" / "N minutes ago" style cell gets added — the Contacts list's `last_activity_at` column (ARCHITECTURE.md's "Contacts Page" section) and any future dashboard "stale" indicators are the most likely next occurrences. Since a component like this only re-renders when its data actually refetches (not on a timer), capturing `now` once at mount doesn't change the effective freshness of the label — it's not a behavior tradeoff, just satisfying the purity rule.

`npm run lint` treating this as an `error` (not a `warning`) means an unaddressed instance fails CI-equivalent local checks even though `npx tsc --noEmit`, `npm test`, and `npm run build` all stay green regardless — the Next.js build does not run this ESLint rule as a gate. Don't rely on `build` passing as proof `lint` is clean; run both.

---

## Data Flow

### Reading data

```
Server Component (page.tsx)
  → calls api.ts directly (initial load, no client-side JS needed)
  → passes data as props to child components

Client Component
  → calls TanStack Query hook (useOpportunities)
  → hook calls api.ts function
  → api.ts calls Supabase with the user's JWT
  → Supabase applies RLS and returns only permitted rows
  → data flows back up to the component
```

**Rule:** Server Components call `api.ts` directly and pass data down as props. Client Components use TanStack Query hooks. Do not mix both patterns for the same data on the same page — a Server Component should not fetch data and then also let a child Client Component re-fetch the same data through a hook. Pick one path per data dependency.

### Activity Dates and Timezones

RSMs operate internationally across multiple timezones. `activity_date` is stored as `timestamptz`. The browser sends an ISO 8601 datetime string with the user's local UTC offset; PostgreSQL normalises to UTC on write. Display uses the browser's local timezone via `Intl.DateTimeFormat` — no timezone preference needs to be stored per user. Each RSM automatically sees times in their own local timezone without any configuration.

### Stale Deal Detection

`opportunities.last_activity_at` is a denormalized timestamp maintained by a Postgres trigger. The trigger fires `AFTER INSERT OR UPDATE OR DELETE` on `activities` for rows where `opportunity_id IS NOT NULL`:

- **On INSERT/UPDATE:** set `last_activity_at = NEW.activity_date` if it is greater than the current value (or if the current value is null)
- **On DELETE:** recalculate `last_activity_at = (SELECT MAX(activity_date) FROM activities WHERE opportunity_id = OLD.opportunity_id)`

This allows the RSM dashboard's stale-deal query to be a simple filter, not an aggregation:

```sql
SELECT * FROM opportunities
WHERE (last_activity_at < NOW() - INTERVAL '30 days' OR last_activity_at IS NULL)
  AND stage_id NOT IN (SELECT id FROM pipeline_stages WHERE is_won OR is_lost)
```

Won and Lost opportunities are excluded — stale detection only applies to open deals.

### Inactive Contact Detection

`contacts.last_activity_at` is a denormalized timestamp maintained by an analogous Postgres trigger. The trigger fires `AFTER INSERT OR UPDATE OR DELETE` on `activities` for rows where `contact_id IS NOT NULL`:

- **On INSERT/UPDATE:** set `last_activity_at = NEW.activity_date` if it is greater than the current value (or if the current value is null)
- **On DELETE:** recalculate `last_activity_at = (SELECT MAX(activity_date) FROM activities WHERE contact_id = OLD.contact_id)`

The RSM dashboard's inactive-contact query:

```sql
SELECT * FROM contacts
WHERE (last_activity_at < NOW() - INTERVAL '30 days' OR last_activity_at IS NULL)
  AND client_id IN (SELECT id FROM clients WHERE region_id = <rsm_region_id>)
```

Only contacts belonging to the RSM's clients are surfaced. Contacts in the prospect phase (`client_id IS NULL`) are excluded — pre-Win contacts are not yet "inactive" in any meaningful sense.

---

### Writing data

```
User submits a form
  → React Hook Form validates with Zod schema
  → calls useMutation hook
  → hook calls Server Action
  → Server Action validates again with Zod (never trust client input)
  → Server Action calls Supabase with server client
  → Supabase applies RLS
  → Server Action returns success or error
  → on success: TanStack Query invalidates cache
  → UI re-renders with fresh data (no page reload)
```

**Exception — Server Actions that cross RLS boundaries:** Some mutations need to write records that the calling user cannot write under normal RLS. The `closeOpportunity` action is the primary example: creating a Client record and a Contract record requires inserting rows that an RSM's JWT-scoped client cannot touch. These actions use the **service role client** (`createServiceClient()` from `lib/supabase/server.ts`), which bypasses RLS entirely. The Server Action itself is responsible for all authorization checks before calling the service client — it is not safe to use the service client without first verifying the user's role and ownership.

---

## Design Patterns

### Repository Pattern

Each feature folder contains an `api.ts` file that owns all raw Supabase queries for that domain. Components and hooks never write `supabase.from(...)` directly — they call a named function from `api.ts`.

```
features/opportunities/api.ts  ← getOpportunities(), getOpportunityById()
features/clients/api.ts        ← getClients(), getClientById()
```

**Why it matters:** When you need to change a query — add a join, fix an RLS filter, add a column — there is exactly one place to look per entity. Without this, the same Supabase query gets copy-pasted into multiple files and diverges.

---

### Custom Hook as Service Layer

TanStack Query hooks in `features/*/hooks.ts` wrap the `api.ts` functions and add caching, loading state, error state, and cache invalidation. This is the service layer.

```typescript
// The component calls the hook — it knows nothing about Supabase or TanStack Query internals
const { data: opportunities, isLoading } = useOpportunities()
const { mutate: createOpportunity } = useCreateOpportunity()
```

**Why it matters:** Components are completely decoupled from the data source. If Supabase is ever replaced, or a query needs to be mocked for testing, only the hook changes — not the component. This is the pattern that replaces the previous CRM's `router.refresh()` calls.

---

### Compound Components for Tables

TanStack Table is configured through column definition arrays, not inline JSX. Each feature defines its columns in `features/*/columns.tsx`, and a single generic `DataTable` component renders any of them.

```typescript
// features/opportunities/columns.tsx
export const opportunityColumns: ColumnDef<Opportunity>[] = [
  { accessorKey: 'prospect_company_name', header: 'Company' },
  { accessorKey: 'stage', header: 'Stage', cell: StageCell },
  { accessorKey: 'estimated_value', header: 'Value', cell: ValueCell },
]

// In the page
<DataTable columns={opportunityColumns} data={opportunities} />
```

**Why it matters:** Adding a new table to the app means writing column definitions. The table rendering logic, sorting, filtering, and pagination are written once in `DataTable` and never touched again. The previous CRM re-implemented table logic from scratch per page.

---

### Factory Pattern for Role-Based Columns

When different roles see different columns in the same table, a factory function returns the right column set. The `DataTable` component itself has no knowledge of roles.

```typescript
export function getOpportunityColumns(role: UserRole): ColumnDef<Opportunity>[] {
  const base = [/* columns all roles see */]
  if (role === 'admin') return [...base, rsmColumn, regionColumn, actionsColumn]
  if (role === 'rsm') return [...base, actionsColumn]
  return base  // sector_manager: read-only, no action column
}
```

**Why it matters:** Role-specific rendering stays out of the component. Auditing what each role can see is a matter of reading one function, not searching through component conditionals.

---

### Observer Pattern via TanStack Query Cache

TanStack Query's cache acts as an observable store. When a mutation succeeds and invalidates a query key, every component subscribed to that key re-renders with fresh data — without any manual wiring between the mutation and the UI.

```typescript
onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opportunities'] })
// All components using useOpportunities() automatically update
```

**Why it matters:** This replaces the event bus / prop drilling patterns that are common in React apps without a cache layer. It also replaces `router.refresh()`, which caused full page reloads.

---

### Progressive Opportunity Registration

The opportunity creation form and the opportunity edit form are **two distinct forms with two distinct Zod schemas**. Never collapse them into a single 25-field form.

**`opportunityRegisterSchema`** — used for the "New Opportunity" form. Contains only the fields required at registration (as listed in PRODUCT.md §4.1). All fields are required. This is the form the RSM fills in when a new opportunity enters the pipeline.

**`opportunitySchema`** — extends `opportunityRegisterSchema` with the optional fields filled in over time (estimated value, currency, probability, expected close date, partner details, MNDA status, etc.). Used for the full edit form.

```typescript
// features/opportunities/schemas.ts
export const opportunityRegisterSchema = z.object({
  // Required at registration
  rsm_id: z.string().uuid(),
  region_id: z.string().uuid(),
  country: z.string().min(1),
  stage_id: z.string().uuid(),
  requirement_type: z.string().min(1),
  sector_id: z.string().uuid(),
  description: z.string().min(1),
  prospect_company_name: z.string().min(1),
  lead_source: z.enum([...leadSources]),
  registration_date: z.string().date(),
  // Optional at registration — filled in when available
  prospect_organization_type: z.enum([...orgTypes]).nullable(),
  prospect_contact_name: z.string().optional().or(z.literal('')),
  prospect_website: z.string().url().optional().or(z.literal('')),
  prospect_contact_email: z.string().email().optional().or(z.literal('')),
  prospect_contact_phone: z.string().optional(),
  advisor_id: z.string().uuid().nullable(),
})

export const opportunitySchema = opportunityRegisterSchema.extend({
  estimated_value: z.number().positive().nullable(),
  currency: z.enum(CURRENCIES).nullable(),
  budget_status: z.enum(['not_yet_secured', 'secured']).nullable(),
  probability_pct: z.number().int().min(0).max(100).nullable(),
  expected_close_date: z.string().date().nullable(),
  next_step: z.string().optional(),
  special_license_required: z.boolean().default(false),
  is_at_risk: z.boolean().default(false),
  // Note: partner contact fields (partner_contact_name, partner_mnda_status, etc.)
  // live on opportunity_products rows, not here.
})
```

The database has `NOT NULL` constraints only on the fields in `opportunityRegisterSchema`. All other columns are nullable at the database level.

---

### Product Picker Component (`features/opportunities/components/ProductPicker.tsx`)

The `opportunity_products` join table allows multiple products per opportunity, each of which is either a catalog product (FK to `products`) or a free-text name. Partner contact details live per line — not on the opportunity — because each manufacturer has its own contact and its own MNDA status. The UI is a line-item editor, not a simple `<select>`:

- Each line has a **combobox** (searchable by product name, manufacturer name, SKU, or category) that queries the `products` table
- If the RSM can't find the product in the catalog, a **"Not in catalog"** toggle switches the line to a free-text input for `product_name_freetext`
- An **"Add product"** button appends a new blank line
- Each line has a **quantity** field (default 1, must be > 0) and an optional **notes** field
- Each line has a collapsible **"Manufacturer contact"** section: contact name, email, phone, and MNDA status. Collapsed by default to keep the common case (product selection only) uncluttered
- Individual lines can be removed

The component manages its own array state and calls the parent form's `setValue` for the `opportunity_products` array field. Zod validation per line:

```typescript
z.object({
  product_id: z.string().uuid().nullable(),
  product_name_freetext: z.string().nullable(),
  quantity: z.number().int().positive().default(1),
  partner_contact_name: z.string().optional(),
  partner_contact_email: z.string().email().optional().or(z.literal('')),
  partner_contact_phone: z.string().optional(),
  partner_mnda_status: z.enum(['not_required', 'pending', 'sent', 'signed']).nullable(),
  notes: z.string().optional(),
}).refine(
  d => d.product_id !== null || (d.product_name_freetext?.trim() ?? '') !== '',
  { message: 'Select a catalog product or enter a product name' }
)
```

---

### "Close Deal" Modal Pattern

Marking an opportunity Won is not a simple stage change — it triggers a "Close Deal" modal. The modal collects four fields before anything is written to the database:

- **Contract value** — pre-filled from `estimated_value` if set
- **Currency** — pre-filled from the opportunity's currency
- **Signed date** — required
- **Expected delivery date** — required

On submit, a single Server Action (`closeOpportunity`) executes atomically:

1. Checks if a Client with the same `prospect_company_name` already exists in the same `region_id` (case-insensitive: use `ILIKE` or `lower()`)
2. Creates a new Client from the opportunity's prospect fields — copying `prospect_organization_type` to `client.organization_type` and `prospect_website` to `client.website` — if no match, or uses the existing Client's `id`. Note: if an existing Client is found, its `website` is not overwritten.
3. Creates a Contract record
4. If `prospect_contact_name` is set, creates a Contact from `prospect_contact_name`, `prospect_contact_email`, and `prospect_contact_phone` — unless a contact with the same email already exists at the matched Client (case-insensitive). If a match is found, it is linked rather than duplicated. If `prospect_contact_name` is blank, this step is skipped.
5. Sets `client_id` on any pre-Win contacts where `opportunity_id` matches this opportunity, linking them to the new Client.
6. Updates the opportunity: sets `stage_id` to the Won stage, sets `client_id`

The modal reflects what will happen before the RSM confirms:
- If an existing Client is found: "Linking to existing client: [name]"
- If pre-Win contacts exist: "Linking [N] contact(s) to [client name]"
- If a new contact will be created from prospect fields: "Creating contact: [name]"

**Why pre-fill from estimated values:** The RSM has usually already discussed the contract value during negotiation. Pre-filling from `estimated_value` means closing a deal typically requires only two inputs (dates). Reducing keystrokes at the moment of a win is the highest-leverage UX improvement possible.

**Note:** The Won stage is identified by `pipeline_stages.is_won = true` — never by matching the stage name. If an Admin renames "Won" to something else, `closeOpportunity` must still work.

---

### Inline Editing for High-Frequency Fields

Two fields are updated frequently enough that opening a full edit form creates unacceptable friction: **`next_step`** and **stage**.

**`next_step`:** Clicking the Next Step cell in the pipeline table opens an inline textarea. Blurring the field or pressing Cmd/Ctrl+Enter submits via `useUpdateOpportunity`. This is a hard UX requirement — if Next Step requires a full form open, RSMs will not keep it current, defeating its purpose.

**Stage:** Clicking the Stage badge opens a popover with the stage list. Selecting a stage calls `useUpdateOpportunityStage`. Selecting the Won stage opens the Close Deal modal instead of immediately updating.

Column definition pattern for an inline-editable cell:

```typescript
{
  accessorKey: 'next_step',
  header: 'Next Step',
  cell: ({ row }) => (
    <InlineTextareaCell
      opportunityId={row.original.id}
      field="next_step"
      value={row.original.next_step}
    />
  ),
}
```

`InlineTextareaCell` and `InlineStageCell` live in `components/shared/`.

---

### Admin Contract Editing

After a deal closes, Admins can edit contract terms (value, currency, signed date, expected delivery date). RSMs cannot — they can only toggle `is_at_risk`. Sector Managers are read-only.

The contract edit form is accessible from the opportunity detail view (Admin only). It reuses the same Zod contract fields from the Close Deal modal, minus the pre-fill logic. The route or placement (dedicated page vs. modal) is an implementation choice.

**What RSMs can do post-close:** Toggle `is_at_risk` on the contract and on the re-opened opportunity. Nothing else.

---

### Re-staging from Won or Lost

Both Won and Lost opportunities can have their stage changed by an RSM or Admin. The stage picker handles both.

**Re-staging from Won:**

When a user moves a Won opportunity to an earlier stage, the following are **not** undone:
- The Client record created at Win remains
- The Contract record remains
- `opportunity.client_id` remains set to the linked Client

The stage change is the only thing that updates. The UI must show a confirmation before the change is made:

> "Reopening this opportunity will return it to [Stage]. The existing Client record and Contract will not be removed — they remain linked. Contract terms can only be edited by an Admin."

**Re-staging from Lost:**

When a user moves a Lost opportunity to an earlier stage, no special records need to be touched (no Client or Contract was created). Show a simpler confirmation:

> "Returning this opportunity to [Stage]. All existing data is preserved."

In both cases the confirmation fires whenever the user selects a stage while the current stage has `is_won = true` or `is_lost = true`.

---

### RSM Reassignment Cascade

When an Admin reassigns an opportunity to a different RSM, the `reassignOpportunity` Server Action must update both `rsm_id` **and** `region_id` in a single write:

```typescript
// The action fetches the new RSM's region_id from users, then:
await supabase
  .from('opportunities')
  .update({ rsm_id: newRsmId, region_id: newRsm.region_id })
  .eq('id', opportunityId)
```

**Why this is critical:** `region_id` on `opportunities` is the column RLS uses to filter RSM access. If `rsm_id` is updated but `region_id` is not, the old RSM loses visibility (their region no longer matches) and the new RSM also cannot see the record (same reason). The opportunity effectively disappears from both views. The two fields must always be updated together — never `rsm_id` alone.

**Required UI:** The reassignment UI must show a confirmation dialog before writing any change. The dialog names both RSMs and their regions and states the access consequence:

> "Reassigning from [Old RSM Name] ([Old Region]) to [New RSM Name] ([New Region]). This opportunity will move to the [New Region] region. [Old RSM Name] will no longer have access to this record."

Do not auto-save on RSM dropdown change. Require an explicit confirm click.

---

### Confirmation Dialogs

Every confirmation dialog in the app — re-staging away from Won/Lost, RSM reassignment, or any future "confirm before a consequential change" prompt — is built with shadcn's `AlertDialog` (`components/ui/alert-dialog.tsx`), not a hand-rolled `fixed inset-0` overlay div. `InlineStageCell`'s re-stage confirmation is the reference implementation:

```typescript
<AlertDialog open={!!pendingStage} onOpenChange={(open) => { if (!open) setPendingStage(null) }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{/* ... */}</AlertDialogTitle>
      <AlertDialogDescription>{/* ... */}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
      <AlertDialogAction disabled={isPending} onClick={confirm}>Confirm</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Why not a hand-rolled overlay:** the project adopted shadcn specifically because its primitives (Radix, or Base UI depending on the `components.json` style in use) handle focus trapping, Escape-to-close, and ARIA roles correctly by default (see the shadcn/ui entry under Stack). A hand-rolled `<div className="fixed inset-0">` has none of that, and duplicating the overlay/positioning markup per dialog means fixing an accessibility gap requires finding and patching every hand-rolled instance instead of one shared component.

**Always disable Cancel/Confirm while the mutation is in flight** (`disabled={isPending}`) — otherwise a fast double-click can fire the mutation twice before the dialog unmounts.

---

### Safe Redirect Targets

Any Server Action or route handler that redirects to a target read from user input (a `?next=` query param, a stored "return to" path, etc.) must validate it with `safeRedirectPath` from `lib/redirect.ts`:

```typescript
import { safeRedirectPath } from '@/lib/redirect'

redirect(safeRedirectPath(input.next) ?? '/dashboard')
```

**Why not a regex prefix check:** an earlier version of this guard used `/^\/(?!\/|\\)/.test(next)` to reject a leading `//` or `/\`. That blocklist is incomplete — control characters (tab, CR, LF) are stripped by URL parsers wherever they occur in the string (per the WHATWG URL spec), not just at the edges, so a payload like `/\t/evil.com` passes the regex and still collapses to `//evil.com` once a browser parses the redirect. `safeRedirectPath` instead resolves the value against a placeholder origin and rejects it unless the origin is unchanged — the same technique OWASP recommends for open-redirect prevention — which is robust to any character-stripping quirk a URL parser applies, not just the two sequences a regex happens to enumerate.

---

### What Is Deliberately Not Used

| Pattern | Why not |
|---|---|
| Higher-Order Components (HOCs) | React hooks replaced HOCs. Not used anywhere. |
| Class-based Repositories | `api.ts` files (plain functions) are sufficient at this scale. Class instances add complexity with no benefit. |
| Event Sourcing / CQRS | Overkill. Standard mutations with cache invalidation handle the CRM's write patterns correctly. |
| Redux / Context for server state | TanStack Query owns server state. Only UI state (sidebar, modals) goes in Zustand. |
| Feature flags | Not needed. When something changes, the code changes. |
| Kanban board view | The pipeline is a table with inline stage editing (see Inline Editing pattern). Drag-and-drop Kanban adds significant implementation complexity for the current scale (4 RSMs, manageable pipeline volume). Revisit for v2 if RSMs request it after launch. |

---

## UX Patterns

### Navigation Structure

#### Desktop: Left Sidebar

A persistent left sidebar (~240px) is visible on all authenticated pages. This is the universal CRM navigation pattern (Salesforce, HubSpot, Pipedrive) because a sidebar keeps the user oriented across the app without consuming vertical space.

Items, in order:
1. Dashboard
2. Opportunities
3. Clients
4. Contacts
5. Activities
6. Products
7. *(separator)*
8. Settings — **Admin only.** Hidden entirely from RSM and Sector Manager (not greyed out, just absent — a greyed-out item invites clicking and then confusion).

All other items are visible to all roles. Permissions within each page are enforced by RLS and component-level guards — the nav itself does not change per role beyond the Settings item.

Active item is highlighted. Each item shows an icon and a label. The sidebar does not collapse to icon-only — at the scale of this app (7 nav items) a full-width sidebar is not wasteful and icon-only sidebars require users to memorise icon meanings.

#### Mobile: Bottom Tab Bar

On mobile the sidebar is replaced by a bottom tab bar — the standard navigation pattern for iOS/Android and PWAs. The sidebar is still accessible by tapping a menu icon (top-left), which opens it as a slide-over sheet for less-frequent destinations (Products, Settings).

Bottom bar tabs (4 items — more than 5 becomes cramped and hard to tap):
1. **Dashboard** — daily check-in
2. **Opportunities** — primary RSM workflow
3. **Contacts** — the lookup RSMs do most on mobile, immediately before a call
4. **Activities** — the action RSMs do most on mobile, immediately after a call

Clients are navigable from the Opportunities and Contacts pages. Products and Settings are desktop tasks.

---

### Form Presentation

One consistent rule across the entire app:

| Situation | Pattern | Why |
|---|---|---|
| Creating a new Opportunity | **Full page** | 10+ fields across logical groups; rare enough that losing navigation context is acceptable |
| Editing an Opportunity, Client, or Contact | **Slide-over panel** (opens from the right) | The underlying detail page stays visible — the user never loses context of what they are editing |
| Focused action: Log Activity, Close Deal, confirm destructive action | **Modal** | 2–6 fields; enforces completion before returning to the page |
| High-frequency field: stage, next step, at-risk toggle | **Inline** | Opening a form for these fields would mean RSMs stop using them |

Never use a full page for an edit form. Never use a modal for a form with more than ~6 fields. The slide-over is the middle ground — it feels lighter than a page navigation but has enough space for a real form.

---

### Feedback Pattern

**Success:** Toast notification, bottom-right corner, 3-second auto-dismiss. Text is short and specific: "Opportunity updated." not "Your changes have been saved successfully."

**Error:** Inline, below the relevant field or at the top of the form. Never a toast for errors — toasts disappear before the user can read and act on them. If a Server Action returns an error, the form stays open and the error renders inline.

**Loading states:**
- Button: disabled + spinner while the mutation is in flight. The button label does not change — the spinner is sufficient.
- Initial page load: skeleton loaders (grey shapes matching the approximate layout) rather than a centred spinner. A skeleton tells the user what structure is coming; a spinner tells them nothing.

**No optimistic updates for multi-record mutations.** Closing a deal, reassigning an opportunity, and deleting a client/contact each write more than one record or trigger complex side effects (Client + Contract creation, contact linking, region reassignment). The UI confirms success from the server before updating for these — the loading state is fast enough (local Supabase → Vercel round-trip) that the cost of waiting is lower than the cost of a failed optimistic update that needs to unwind cleanly.

This is not a blanket rule against optimistic updates everywhere. Single-field mutations — a stage change, the `next_step` textarea, an `is_at_risk` toggle — are cheap to roll back (revert one field) and are exactly the fields the "Inline Editing for High-Frequency Fields" pattern below requires to feel instant. An optimistic update is a reasonable, deliberate choice for those; it just isn't the default and isn't used for anything that touches more than one record.

---

### Table Defaults (all entity list pages)

- **Default sort:** `updated_at DESC` — the most recently touched record appears first. RSMs return to the CRM mid-day and want to continue where they left off.
- **Row click:** navigates to the detail page. Inline expand is not used — detail pages contain too much information to show inline.
- **Pagination:** client-side, 25 rows per page. At current data volumes (dozens to low hundreds of records), client-side pagination is instant and avoids server-round-trip complexity.
- **Empty state:** helpful message + primary CTA. For Opportunities: *"No opportunities yet."* with a "New Opportunity" button. Never show an empty table with no explanation.

---

### Opportunity List (Pipeline)

Columns shown to all roles:

| Column | Notes |
|---|---|
| Company | `prospect_company_name` — clickable link to detail |
| Country | |
| Stage | Inline-editable badge (`InlineStageCell`) |
| Value | `estimated_value` + `currency`, formatted. Blank if not yet set. |
| Next Step | Inline-editable text (`InlineTextareaCell`), truncated to one line |
| Last Activity | Relative time ("3 days ago"). Rendered in red if > 30 days old and the stage is not Won or Lost. |

Admin-only additional columns (appended to the right):

| Column | Notes |
|---|---|
| RSM | Assigned RSM's full name |
| Region | |

**Filters** (rendered above the table, always visible — not hidden in a dropdown):
- **Search** — searches `prospect_company_name` and `country`, client-side, instant
- **Stage** — multi-select from active pipeline stages
- **At-risk** — toggle (show only flagged records)
- **Sector** — multi-select (Admin and Sector Manager only — RSMs are scoped to one sector via their opportunities)

**Default view:** no filters active, Won and Lost excluded. A "Show closed" toggle adds them to the results. RSMs rarely need to see closed deals while working their active pipeline.

---

### Opportunity Detail Page

This is the most-used page in the app. Layout: sticky header + single scrollable body. No tabs, no sidebar panel.

**Sticky header** (always visible, never scrolls away):
```
Meridian Defense Group                    [Proposal Sent ▾]  [⚠ At Risk]
LATAM · Defense Export · Colombia
```
- Company name: large, primary text
- Stage badge: inline editable (opens stage popover)
- At-risk toggle: directly in the header — one click, no form
- Region · Sector · Country: small secondary line

**Scrollable body sections** (in this order):

**1. Next Step**
Large inline-editable textarea, directly below the header. This is the RSM's working memory for the deal — what needs to happen next. It gets the most prominent position in the body because it is the field updated most often.

**2. Prospect Details**
Compact read display — not a field-by-field form readout. Shows organisation type, country, website (as a link), contact name/email/phone, lead source, advisor, registration date, probability %, expected close date, budget status. An Edit button opens a slide-over with the full edit form.

Before Win: `prospect_contact_name` renders as a mailto link if email is set.
After Win: prospect contact renders as a link to the now-created Contact record.

**3. Products**
Read mode: collapsed rows, each showing manufacturer name + product name + quantity. Clicking a row expands it to show manufacturer contact details and MNDA status. An Edit button opens the slide-over with the ProductPicker editor.

**4. Activities**
"Log Activity" button pinned to the top of this section. Below it: a chronological feed, newest first. Each item shows: type icon + subject + relative date + logged-by name. Clicking an item expands to show full notes.

**5. Contract** *(only visible when `is_won = true`)*
Contract value, currency, signed date, expected delivery date, at-risk toggle. Admin-only Edit button. RSMs see this section read-only and can only toggle at-risk.

---

### Dashboard Layouts

#### Admin Dashboard

**Row 1 — KPI cards (4 across):**
1. Total open pipeline value (sum of `estimated_value` across non-Won, non-Lost opportunities)
2. Open opportunity count
3. Won this quarter (count + total contract value)
4. At-risk count (open at-risk opportunities + at-risk contracts combined)

**Row 2 — Pipeline over time (full width, two charts side by side):**

Left chart — **Pipeline value by stage:** stacked area chart (Recharts) showing total estimated value of open opportunities, broken down by stage, by month, for the past 12 months. Each stage is a coloured band. Answers "how much is the pipeline worth, and where is value concentrated?"

Right chart — **Opportunity count by stage:** same stacked area format, Y-axis is deal count instead of value. Answers "how active is the team, and where are deals accumulating?" Useful for spotting bottlenecks (many deals stuck in Negotiation) independent of their monetary weight.

Both charts share the same stage colour scheme and X-axis (month). Code-split with `dynamic(() => import(...), { ssr: false })` — not loaded until an Admin views the dashboard.

**Row 3 — two columns:**
- Left: At-risk deals (table: company name, stage, RSM, days since last activity)
- Right: Deals by stage (horizontal bar chart: deal count per stage, ordered by `display_order`)

**Row 4 — Recent activity feed (full width):**
The 20 most recent activities logged across all RSMs. Each row: activity type icon, opportunity/client name, logged by, relative timestamp.

#### RSM Dashboard

**Row 1 — Pipeline by stage (cards, one per active non-terminal stage):**
Each card shows: stage name, deal count, total estimated value. Clicking a card navigates to the Opportunities list pre-filtered to that stage.

**Row 2 — two columns:**
- Left: Stale deals (no activity in 30+ days, open opportunities only — `last_activity_at < NOW() - INTERVAL '30 days'`)
- Right: At-risk deals (manually flagged open opportunities)

**Row 3 — Inactive contacts (full width):**
Table: contact name, client name, last activity date. Clicking a row navigates to the contact.

---

### Activity Logging

"Log Activity" appears in two places: pinned to the top of the Activities section on the opportunity detail page, and pinned to the top of the Activities section on the client detail page. Both open the same modal with `opportunity_id` or `client_id` pre-filled.

**Activity modal fields (in order):**
1. Type — segmented control or radio group: Call / Email / Meeting / Demo / Product Presentation / Site Visit / Internal Review
2. Date — date+time picker, defaults to now
3. Contact — optional select from contacts linked to this opportunity or client
4. Subject — short text
5. Notes — textarea

On submit: mutation fires, success toast appears, the new activity appears at the top of the feed without a page reload (TanStack Query cache invalidation).

---

### Client Detail Page

**Sticky header:** client name (large), status badge (active / inactive / former), region, organisation type, website as a link.

**Body sections:**

1. **Contacts** — list of contacts at this client, primary contact first. Each row: name, title, email, phone. "Add Contact" opens a slide-over. Edit and (Admin only) delete controls per row.
2. **Deals** — list of all won opportunities linked to this client. Columns: product(s), contract value, signed date, at-risk flag. Clicking navigates to the opportunity detail.
3. **Activities** — same timeline as on the opportunity detail page, scoped to this client.
4. **Notes** — the `notes` free-text field on the client record. Inline editable (click to edit, blur to save).

---

### Product Catalog Page

Table view (not a card grid — there are no product images in the schema, so a grid would just be labelled boxes).

**Columns:** Product name, Manufacturer, Category, Sector, Margin %, Active status.

**Filters:** Manufacturer (select), Sector (select), search by name / SKU / category.

"Add Product" button and row-level Edit visible to Admins only. Non-admin users see the table with no write controls — absent, not disabled.

---

### Contacts Page (standalone list)

RSMs see only contacts for clients in their region. Admins and Sector Managers see all.

**Columns:** Name, Title, Client, Email, Phone, Last Activity (relative, red if > 30 days).

**Default sort:** `last_activity_at DESC`.

**Row click:** opens a slide-over with the contact record (name, title, email, phone, is_primary toggle, notes, activity feed). Contact detail is simple enough that a full page is unnecessary.

---

## Access Control

Access control is enforced at two independent layers. Both must be present.

### Layer 1 — Middleware (route-level)

`middleware.ts` runs before every request. It reads the user's session and role. If the role does not have access to the requested route, the middleware redirects before any page code executes. This prevents unauthorized users from seeing admin pages even for a moment.

### Layer 2 — Supabase RLS (data-level)

Every table has RLS policies that use the user's JWT to filter rows. An RSM querying the `opportunities` table only receives rows where `region_id` matches their own `region_id`. This is enforced by PostgreSQL — it cannot be bypassed by application code, even if the application sends a malicious query.

**Both layers are required.** Middleware without RLS means a determined user could call the API directly and get unauthorized data. RLS without middleware means unauthorized pages briefly render before redirecting.

### Sector Manager Scope in the Admin UI

The `users.sector_scope` setting and the user's `user_sectors` assignments are managed together on the user detail/edit form in Admin settings (`/settings/users/[id]`), visible only when the user's role is `sector_manager`. The two controls appear side by side:

- **Assigned sectors** — checklist of active sectors (writes to `user_sectors`)
- **Pipeline visibility** — radio: "All opportunities" / "Only assigned sectors" (writes `sector_scope`)

They are shown together because they are meaningless in isolation: `own_sectors_only` scope with no sector assignments shows nothing; sector assignments with `all` scope have no filtering effect. Displaying them together makes the relationship obvious to the Admin.

---

## Folder Conventions

- **Feature folders** are organized by domain entity (`opportunities`, `clients`, `products`), not by file type (`components`, `hooks`, `utils`).
- **`app/` contains only routing.** Business logic does not live in `page.tsx` files — it lives in `features/`.
- **`components/ui/`** contains shadcn components. These are your components — you own the source and can modify them freely. This is the point of shadcn. What you should not do is re-run `shadcn add` on a component you have already customized, as it will overwrite your changes. If you want to pull in an upstream shadcn update, do it manually by comparing the diff.
- **`components/shared/`** contains components used by more than one feature. If a component is only used by one feature, it lives in `features/*/components/`.
- **Server Actions** (`actions.ts`) handle all writes. They always validate input with Zod before touching the database.
- **`api.ts`** files handle all reads. They are plain async functions, not hooks.

---

## Testing Strategy

This project uses test-driven development for the layers where it produces reliable, meaningful tests. Not every layer is worth TDD — applying it uniformly creates tests that are expensive to write, expensive to maintain, and don't catch real bugs.

### The three layers where TDD is applied

**Zod schemas**
A Zod schema is a pure function: input goes in, a validation result comes out. No database, no HTTP, no side effects. Writing the test first is natural — you describe what valid and invalid input looks like before writing any schema code. If a field's rules change later, the test tells you immediately what broke. This is the fastest TDD loop in the codebase.

**Server Actions**
Server Actions contain the thickest business logic: they validate input, call the database, and return structured results. They have clear inputs (form values) and clear outputs (success or a specific error). Writing the test first forces you to define exactly what success looks like before writing a single line of implementation. These tests call the action directly with real data and assert both the return value and the resulting database state.

**RLS policies**
RLS policies are the access control layer of the entire application. A bug here — an RSM seeing another region's data — is a serious data breach, not just a UI glitch. TDD is not optional here; it is the primary proof that the policy does what you intended. The test queries the database as a specific role and asserts which rows come back (and which are blocked). There is no other reliable way to verify this.

### Why Supabase is never mocked

All integration tests run against a real local Supabase instance (`supabase start`). Mocking Supabase would let tests pass while RLS policies, column names, or query logic contain bugs. A mock only proves that the mock was written correctly — not that the real database behaves as expected. This is especially true for RLS: a mocked Supabase client has no concept of row-level security. Only a real Postgres instance with real policies can prove they work.

### Where TDD is not applied

**React components** — Component behavior is visual and interactive. The meaningful question is not "does this render?" but "does clicking this button call the mutation?" Those tests are written after the component exists, focused on user behavior, not implementation. Writing them before the component exists adds friction without meaningful benefit.

**End-to-end flows** — Playwright tests for critical paths (login → create opportunity → mark Won → verify client record) are written once a flow exists and works, then maintained to catch regressions. Writing them before the UI exists is impractical.

### Tool

Vitest is used for all unit and integration tests. It is faster than Jest, works natively with the ESM module system used throughout this project, and has the same API as Jest — no learning curve if you know Jest.

Tests live alongside the code they test:

```
features/opportunities/schemas.test.ts   ← Zod schema tests
features/opportunities/actions.test.ts   ← Server Action integration tests
supabase/tests/rls.test.ts               ← RLS policy tests, one per table
```

### Scripted Browser Verification (ad hoc, not per-feature)

Most UI changes are verified by clicking through the feature in the browser
by hand — that's the right default. It's fast, and the person testing knows
what "correct" looks like for this domain better than a script would. This
is not a replacement for that, and it is not something to reach for on every
UI change — a straightforward slide-over or a single-role page is faster and
just as reliable to click through manually.

Reach for a scripted Playwright pass instead of (or in addition to) manual
clicking when a change has:

- **Multiple role-gated branches** — a form or page that behaves differently
  for Admin vs. RSM vs. Sector Manager, or a route with a redirect guard.
  Manually testing 3 logins × N branches is easy to under-cover; a script
  exercises every branch every time it's run.
- **Non-visual failure modes** — a React console warning (e.g. a controlled/
  uncontrolled input switch) or a swallowed network error doesn't show up
  just from looking at the screen; catching it requires checking the
  console, which a quick manual pass often skips.

**One-time setup (per machine):**

- `playwright` is a devDependency; browsers must be cached locally:
  `npx playwright install chromium`.
- Some minimal container base images are missing `libasound.so.2`, which
  Chromium's headless binary dynamically links even for headless-only runs.
  `scripts/setup-browser-verification.sh` downloads and extracts it locally
  (no root required) and prints the `LD_LIBRARY_PATH` export needed —
  `source` it (not just execute) before running any Playwright script:
  `source <(scripts/setup-browser-verification.sh)`.
- Local Supabase must be running (`supabase start`). Persistent test
  accounts already exist for this — `node scripts/seed-manual-test-users.mjs`
  is idempotent and safe to re-run; it will not recreate accounts that
  already exist. See that file for the current account list (one Admin, two
  RSMs in different regions, one Sector Manager — all password `Test1234!`).
- `scripts/playwright-helpers.mjs` exports `login(page, email)` and the base
  URL — import it from a throwaway per-feature driver script rather than
  re-deriving the login flow each time. Write that driver script somewhere
  inside the repo (e.g. `scripts/.tmp-verify.mjs`, gitignored) — Node's ESM
  resolver needs the importing file to be inside the repo tree to find
  `node_modules/playwright`. Delete the driver script once you're done; it's
  throwaway per feature, not a persistent artifact.

**Base UI Select gotchas** (`components/ui/select.tsx` wraps
`@base-ui/react/select`, not Radix — worth knowing since Base UI's behavior
differs from the Radix conventions most examples assume):

- A full-page screenshot (`{ fullPage: true }`) while a Select popup is open
  closes it — the popup is anchored via floating-ui and reacts to the
  scroll/reflow a full-page capture triggers. Use viewport-only screenshots
  around open popups.
- `[role="option"]` matches items belonging to *every* Select on the page,
  not just the currently open one — Base UI appears to keep closed Selects'
  items mounted-but-hidden in the DOM to pre-register their labels for
  display. Scope option locators with `:visible`
  (`page.locator('[role="option"]:visible')`), or use
  `openOption(page)` from `playwright-helpers.mjs`.
- A controlled Select's `value` prop must not be `undefined` on the first
  render if it will hold a real value later — going from `undefined` to a
  string trips React's "switching from uncontrolled to controlled" warning.
  Default nullable fields to `null`, not `undefined`, and coerce at the JSX
  call site (`value={field.value ?? null}`) rather than relying on React
  Hook Form's `defaultValues` alone.

---

## Flexibility Tradeoffs

The schema uses lookup tables (`sectors`, `pipeline_stages`, `advisors`, `regions`) instead of hardcoded enums for values the business needs to change at runtime. This was a deliberate choice given TLV Capital is early-stage and things change often. The costs accepted:

- **RLS complexity.** Sector-based access control requires subqueries (`WHERE sector_id IN (SELECT sector_id FROM user_sectors ...)`), not simple value comparisons. Harder to debug when access isn't behaving as expected.
- **Seeding required.** Lookup tables must be populated before the app works. Migrations alone are not enough — a `seed.sql` must run on every fresh environment, and every integration test that touches opportunities needs this data set up first.
- **`is_won` is load-bearing and must be protected in the Admin UI.** If an Admin accidentally clears the `is_won` flag, future deals will stop creating Client and Contract records — silently. The stage management UI must render `is_won` and `is_lost` as **read-only display fields**, not editable checkboxes. Changing which stage carries `is_won = true` requires a separate, explicit Admin action with a confirmation: "This will change which stage triggers Client and Contract creation. Existing Won deals are not affected." The application must also enforce that exactly one stage has `is_won = true` at any time — either via a DB constraint or enforced in the Server Action before writing.
- **Duplicate client detection is fragile.** Matching by name alone can't catch different spellings of the same organisation. Accepted as a known limitation at this scale.
- **Cross-region reassignment loses history.** `region_id` on opportunities reflects current state only. If historical pipeline reporting by region ever becomes important, add an audit log on that field.
- **Reopening a Won opportunity does not undo the Win.** When a Won opportunity's stage is changed back to an earlier stage, the Client record and Contract record created at Win are not deleted. The `client_id` on the opportunity remains set. "Reopening" means the RSM continues working the deal — it does not mean the client relationship is invalidated.
- **Reassigning a Won opportunity can create a region mismatch.** If an Admin reassigns a Won opportunity to an RSM in a different region, `opportunity.region_id` updates to the new region but `client.region_id` does not change. The new RSM can see the opportunity (their region matches) but their RLS on the `clients` table filters by `region_id` — they may not be able to see the linked Client. This edge case is accepted: Won opportunities are rarely reassigned, and the workaround is for an Admin to also update the client's region if needed.

---

## What Was Deliberately Not Used

| Tool | Why not |
|---|---|
| Redux / Zustand for server state | TanStack Query owns server state. Zustand is only for UI state. |
| Class-based Repository pattern | Feature-scoped `api.ts` files are sufficient at this scale. |
| Separate mobile app (React Native) | A well-built PWA (Next.js with `next-pwa`) provides sufficient mobile experience from one codebase. |
| Refine.dev | Reduces boilerplate but adds a framework abstraction layer that constrains custom workflows. The defense export domain has too many non-standard flows. |
| HTMX / server-driven UI | React is decided. Mentioned for completeness. |
| Retool / Odoo | Generic tools cannot handle the domain-specific requirements (export licenses, RSM regional scoping, sector management). |
