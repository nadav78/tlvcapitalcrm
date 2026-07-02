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

## Design Patterns → docs/reference/FEATURE-PATTERNS.md

Implementation patterns for features (Repository/hooks/tables/columns factories, Progressive Opportunity Registration, Product Picker, Close Deal modal, Inline Editing, Re-staging, RSM Reassignment Cascade, Confirmation Dialogs, Safe Redirect Targets). Moved to keep this auto-loaded file small — **read `docs/reference/FEATURE-PATTERNS.md` before implementing any of those features.**

---

## UX Patterns → docs/reference/PAGE-SPECS.md

Per-page specs (navigation, Form Presentation table, Feedback Pattern, table defaults, Opportunity list/detail, dashboards, activity logging, client detail, product catalog, contacts). Moved to keep this auto-loaded file small — **read `docs/reference/PAGE-SPECS.md` before building or changing a page**, and `docs/UI-STANDARDS.md` for the craft bar.

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

## Testing Strategy → docs/reference/TESTING.md

TDD rationale, the never-mock-Supabase policy, and the Scripted Browser Verification setup (Playwright helpers, Base UI Select gotchas). The binding TDD rules are in CLAUDE.md; **read `docs/reference/TESTING.md` when writing tests or scripting a browser pass.**

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
