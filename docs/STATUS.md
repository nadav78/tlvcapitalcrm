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

---

## Not Started (suggested order)

Dependencies flow top to bottom — each item can be started once the one above it is complete.

### Foundation (do these first, every feature depends on them)

- **Supabase client helpers** — `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/auth.ts` (session helpers + role utilities)
- **Shared layout + auth shell** — `app/(auth)/login/page.tsx`, `app/(app)/layout.tsx` (sidebar, bottom tab bar for mobile, role-aware nav), middleware (`middleware.ts`) enforcing route-level RBAC
- **Shared components** — `components/shared/DataTable.tsx` (generic TanStack Table wrapper), `components/shared/PageHeader.tsx`, `components/shared/InlineTextareaCell.tsx`, `components/shared/InlineStageCell.tsx`
- **Constants** — `lib/constants.ts` (CURRENCIES list, enum display name mappings including `demo` → "Demo / Product Presentation")

### Opportunities (core RSM workflow — implement this feature completely before moving on)

- **Schemas + tests** — `features/opportunities/schemas.ts` (`opportunityRegisterSchema`, `opportunitySchema`, `opportunityProductSchema`), `features/opportunities/schemas.test.ts`
- **Server Actions + tests** — `features/opportunities/actions.ts` (`createOpportunity`, `updateOpportunity`, `updateOpportunityStage`, `closeOpportunity`, `reassignOpportunity`), `features/opportunities/actions.test.ts`
- **API + hooks** — `features/opportunities/api.ts`, `features/opportunities/hooks.ts`
- **Column definitions** — `features/opportunities/columns.tsx` (factory function `getOpportunityColumns(role)`, inline-editable stage and next_step cells)
- **Product Picker component** — `features/opportunities/components/ProductPicker.tsx` (line-item editor with catalog combobox, free-text fallback, manufacturer contact collapsible section)
- **Close Deal modal** — `features/opportunities/components/CloseDealModal.tsx` (contract fields, client dedup preview, contact linking preview)
- **List page** — `app/(app)/opportunities/page.tsx` (pipeline table, filters: search / stage / at-risk / sector, default excludes Won+Lost, "Show closed" toggle)
- **New opportunity page** — `app/(app)/opportunities/new/page.tsx` (registration form using `opportunityRegisterSchema`)
- **Detail page** — `app/(app)/opportunities/[id]/page.tsx` (sticky header with inline stage + at-risk, Next Step inline textarea, Prospect Details, Products, Activities feed, Contract section)

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
- `closeOpportunity` is the most complex action: atomic Client dedup + Contract creation + Contact linking. Implement last within the Opportunities actions session and test it separately.
- Recharts charts on Admin Dashboard are code-split (`dynamic(() => import(...), { ssr: false })`).
