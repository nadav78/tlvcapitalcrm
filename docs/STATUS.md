# TLV Capital CRM — Implementation Status

## In Progress

Nothing currently in progress.

---

## Completed

- **Database migrations** — all tables, enums, constraints, triggers (`supabase/migrations/`)
- **RLS policies** — row-level security for all tables, all roles (`supabase/migrations/0009_rls.sql`, `0010_grants.sql`, `0011_contract_update_guard.sql`, `0012_bug_fixes.sql`)
- **Seed data** — lookup tables populated (sectors, pipeline stages, advisors, regions) (`supabase/seed.sql`)
- **RLS integration tests** — full test suite verifying policies per role (`supabase/tests/rls.test.ts`)
- **Project tooling** — Next.js 15, Supabase client, shadcn/ui, TanStack Query/Table, React Hook Form, Zod, Vitest configured
- **Foundation: Supabase clients** — `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server + service role; supports `SUPABASE_TEST_TOKEN` for action tests)
- **Foundation: Auth helpers** — `lib/auth.ts` (`getUserProfile`, `requireAuth`, `UserProfile` type)
- **Foundation: Constants** — `lib/constants.ts` (CURRENCIES, all enum display-name maps)
- **Foundation: Middleware** — `middleware.ts` (auth redirect + admin-only `/settings` guard; all redirects propagate rotated Supabase session cookies via `redirectWithSession` helper)
- **Foundation: App shell** — `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(app)/layout.tsx` (sidebar + mobile tab bar), `app/(app)/dashboard/page.tsx` (placeholder)
- **Foundation: Shared components** — `components/shared/DataTable.tsx` (generic TanStack Table wrapper), `components/shared/PageHeader.tsx`, `components/shared/InlineTextareaCell.tsx`, `components/shared/InlineStageCell.tsx`, `components/shared/Sidebar.tsx`, `components/shared/QueryProvider.tsx`
- **Opportunities: types** — `features/opportunities/types.ts`
- **Opportunities: schemas + tests** — `features/opportunities/schemas.ts` (`opportunityRegisterSchema`, `opportunitySchema`, `opportunityProductSchema`, `closeDealSchema`); `features/opportunities/schemas.test.ts` (38 tests, all passing)
- **Opportunities: actions + tests** — `features/opportunities/actions.ts` (`createOpportunity`, `updateOpportunity`, `updateOpportunityStage`, `updateOpportunityField`, `closeOpportunity`, `reassignOpportunity`); `features/opportunities/actions.test.ts` (14 tests, all passing); code-reviewed and patched: sector_manager explicit guard, `closeOpportunity` idempotency check on contract insert, `updateOpportunityField` discriminated union type
- **Opportunities: API + hooks** — `features/opportunities/api.ts` (`getOpportunities`, `getOpportunityById`, `getOpportunityProducts`, `getPipelineStages`, `getStaleOpportunities`); `features/opportunities/hooks.ts` (full query + mutation hooks with cache invalidation; redundant invalidation in `useCloseOpportunity` removed)
- **Opportunities: column definitions** — `features/opportunities/columns.tsx` (`getOpportunityColumns(role, onWonSelected)` factory)
- **date-fns** — installed as production dependency (used in column definitions for relative timestamps)

---

## Not Started (suggested order)

Dependencies flow top to bottom — each item can be started once the one above it is complete.

### Opportunities UI (continue from data layer above)

- **Product Picker component** — `features/opportunities/components/ProductPicker.tsx` (line-item editor with catalog combobox, free-text fallback, manufacturer contact collapsible section)
- **Close Deal modal** — `features/opportunities/components/CloseDealModal.tsx` (contract fields, client dedup preview, contact linking preview; needs shadcn Dialog, Form components)
- **List page** — `app/(app)/opportunities/page.tsx` (pipeline table, filters: search / stage / at-risk / sector, default excludes Won+Lost, "Show closed" toggle)
- **New opportunity page** — `app/(app)/opportunities/new/page.tsx` (registration form using `opportunityRegisterSchema`)
- **Detail page** — `app/(app)/opportunities/[id]/page.tsx` (sticky header with inline stage + at-risk, Next Step inline textarea, Prospect Details, Products, Activities feed, Contract section)

**Required shadcn components to add before building opportunity pages:**
`npx shadcn@latest add input textarea label badge dialog select command` (and any others discovered)

### Clients

- **Schemas + tests** — `features/clients/schemas.ts`, `features/clients/schemas.test.ts`
- **Server Actions + tests** — `features/clients/actions.ts` (`updateClient`), `features/clients/actions.test.ts`
- **API + hooks** — `features/clients/api.ts`, `features/clients/hooks.ts`
- **Column definitions** — `features/clients/columns.tsx`
- **List page** — `app/(app)/clients/page.tsx`
- **Detail page** — `app/(app)/clients/[id]/page.tsx` (Contacts section, Deals section, Activities feed, inline Notes)

### Contacts

- **Schemas + tests** — `features/contacts/schemas.ts`, `features/contacts/schemas.test.ts`
- **Server Actions + tests** — `features/contacts/actions.ts` (`createContact`, `updateContact`), `features/contacts/actions.test.ts`
- **API + hooks** — `features/contacts/api.ts`, `features/contacts/hooks.ts`
- **Column definitions** — `features/contacts/columns.tsx` (last_activity_at in red if > 30 days)
- **List page** — `app/(app)/contacts/page.tsx` (slide-over detail, not a separate page)

### Activities

- **Schemas + tests** — `features/activities/schemas.ts`, `features/activities/schemas.test.ts`
- **Server Actions + tests** — `features/activities/actions.ts` (`createActivity`, `updateActivity`), `features/activities/actions.test.ts`
- **API + hooks** — `features/activities/api.ts`, `features/activities/hooks.ts`
- **Log Activity modal** — `features/activities/components/LogActivityModal.tsx` (reused from opportunity detail + client detail)
- **List page** — `app/(app)/activities/page.tsx`

### Products (catalog)

- **API + hooks** — `features/products/api.ts`, `features/products/hooks.ts` (read-only for RSM/Sector Manager)
- **Schemas + tests** — `features/products/schemas.ts`, `features/products/schemas.test.ts` (Admin write path)
- **Server Actions + tests** — `features/products/actions.ts` (`createProduct`, `updateProduct`), `features/products/actions.test.ts`
- **Column definitions** — `features/products/columns.tsx`
- **List page** — `app/(app)/products/page.tsx` (Add Product + Edit visible to Admin only)
- **Manufacturers** — `features/manufacturers/` (same layer structure, Admin-managed)

### Admin Settings (Admin-only, middleware enforced)

- **Users management** — `features/users/` (list, invite, role assignment, region assignment, sector scope + assignments for Sector Managers), `app/(app)/settings/users/`
- **Lookup table management** — `app/(app)/settings/` pages for pipeline stages (including is_won/is_lost read-only display), sectors, advisors, regions

### Dashboards

- **RSM Dashboard** — `app/(app)/dashboard/page.tsx` (pipeline by stage cards, stale deals, at-risk deals, inactive contacts)
- **Admin Dashboard** — same route, different render based on role (KPI cards, pipeline-over-time charts with Recharts, at-risk table, recent activity feed)

### Data Migration

- **Import script** — `scripts/migrate.ts` (reads source spreadsheets/CSVs, maps to schema, inserts via service role client)

---

## Notes

- The TDD rule applies to Schemas, Server Actions, and RLS only — not components or pages.
- Foundation items (Supabase helpers, layout, middleware, shared components) have no tests — implement directly.
- `closeOpportunity` is the most complex action: atomic Client dedup + Contract creation + Contact linking. ✅ Implemented and tested.
- Recharts charts on Admin Dashboard are code-split (`dynamic(() => import(...), { ssr: false })`).
- **Action test pattern:** action tests use `vi.mock('@/lib/supabase/server')` to inject a real `@supabase/supabase-js` client authenticated via `signInWithPassword`. This is NOT mocking Supabase — it's bypassing the Next.js cookie session plumbing while still using the real DB with RLS enforced.
- **Zod v4 note:** UUIDs in test fixtures must be valid RFC-4122 format (version bits enforced). Nil UUID variants like `00000000-0000-0000-0000-000000000001` are rejected. Use properly-formatted v4 UUIDs.
- **date-fns** installed as a production dependency.
- **PR #1** — `feat/foundation-and-opportunities` open at https://github.com/nadav78/tlvcapitalcrm/pull/1. Covers all Foundation + Opportunities data layer items above. 71/71 tests pass.
