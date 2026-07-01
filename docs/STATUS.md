# TLV Capital CRM — Implementation Status

## In Progress

Nothing currently in progress.

---

## Completed

- **Database migrations** — all tables, enums, constraints, triggers (`supabase/migrations/`)
- **RLS policies** — row-level security for all tables, all roles (`supabase/migrations/0009_rls.sql`, `0010_grants.sql`, `0011_contract_update_guard.sql`, `0012_bug_fixes.sql`, `0013_auth_role_active_check.sql` — `auth_role()` now excludes deactivated (`is_active = false`) users, closing a gap where a deactivated user's JWT still passed every RLS policy — `0014_guard_rsm_contract_columns_auth_role.sql` — the contract column-guard trigger now checks `auth_role()` instead of a raw role subquery, so it stays consistent with the `is_active` gate)
- **Seed data** — lookup tables populated (sectors, pipeline stages, advisors, regions) (`supabase/seed.sql`)
- **RLS integration tests** — full test suite verifying policies per role (`supabase/tests/rls.test.ts`)
- **Project tooling** — Next.js 15, Supabase client, shadcn/ui, TanStack Query/Table, React Hook Form, Zod, Vitest configured
- **Foundation: Supabase clients** — `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server + service role; supports `SUPABASE_TEST_TOKEN` for action tests)
- **Foundation: Auth helpers** — `lib/auth.ts` (`getUserProfile`, `requireAuth`, `UserProfile` type)
- **Foundation: Constants** — `lib/constants.ts` (CURRENCIES, all enum display-name maps)
- **Foundation: Middleware** — `middleware.ts` (auth redirect + admin-only `/settings` guard, now also checking `is_active` so a deactivated admin can't reach the settings shell on a still-valid session; all redirects propagate rotated Supabase session cookies via `redirectWithSession` helper; unauthenticated redirects now preserve the originally requested path as `?next=`, consumed by `signIn` in `features/auth/actions.ts` and read via `useSearchParams` in `app/(auth)/login/page.tsx`; `signIn` validates `next` with `safeRedirectPath`)
- **Foundation: Redirect validation** — `lib/redirect.ts` (`safeRedirectPath` + `redirect.test.ts`, 7 tests) — resolves a user-supplied redirect target against a placeholder origin and requires the origin to be unchanged, rather than a regex prefix check, since a regex allowlisting "starts with a single /" is bypassable via control characters (tab/CR/LF) that URL parsers strip wherever they occur. See CLAUDE.md rule 7 and ARCHITECTURE.md's "Safe Redirect Targets" pattern.
- **Foundation: App shell** — `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(app)/layout.tsx` (sidebar + mobile tab bar), `app/(app)/dashboard/page.tsx` (placeholder)
- **Foundation: Shared components** — `components/shared/DataTable.tsx` (generic TanStack Table wrapper), `components/shared/PageHeader.tsx`, `components/shared/InlineTextareaCell.tsx`, `components/shared/InlineStageCell.tsx` (stage picker built with shadcn `Popover`; shows a confirmation dialog built with shadcn `AlertDialog` when re-staging away from a Won/Lost opportunity, per `docs/ARCHITECTURE.md`, with Cancel/Confirm disabled while the mutation is in flight — no hand-rolled overlay markup remains in this component), `components/shared/Sidebar.tsx`, `components/shared/QueryProvider.tsx`
- **shadcn components installed** — `button`, `alert-dialog`, `popover`
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
- **PR #1** — `feat/foundation-and-opportunities`, merged at https://github.com/nadav78/tlvcapitalcrm/pull/1. Covers all Foundation + Opportunities data layer items above. 71/71 tests pass.
- **PR #2** (`feat/foundation`) was closed without merging. It was branched from the same commit as `feat/foundation-and-opportunities` (before PR #1 merged) and independently re-implemented the same foundation layer — two parallel sessions doing overlapping work that was never reconciled, so PR #2 was purely conflicting with no new feature coverage over PR #1. Its review found 6 real issues; 3 were specific to code only PR #2 had (already fixed on that branch, discarded with the close). The 3 that also applied to `main`'s implementation were ported directly: the `is_active` RLS gap (`0013_auth_role_active_check.sql`), the `?next` redirect preservation, and the Won/Lost re-staging confirmation dialog (see entries above).
- **PR #3** (`fix/deactivated-users-and-restage-confirm`) merged the port above, then a follow-up review pass found and fixed: an open-redirect bypass in the `next`-param regex (control-character stripping), the `/settings` middleware guard not checking `is_active`, missing `disabled` on the re-stage dialog's buttons, and `guard_rsm_contract_columns()` not routing through `auth_role()` (`0014_guard_rsm_contract_columns_auth_role.sql`).
- **PR #4** (`fix/redirect-helper-and-dialog-conventions`) extracted the redirect check to `lib/redirect.ts`, replaced the hand-rolled confirmation overlay in `InlineStageCell` with shadcn `AlertDialog`, and codified both as CLAUDE.md rules 6–7 so future reviews can catch violations by name instead of inference.
- **CLAUDE.md rules 8–10 added** — no optimistic updates, `is_won`/`is_lost` read-only in admin UI, and the Form Presentation table — promoted from ARCHITECTURE.md rationale prose to explicit rules for the same reason as 6–7: a rule that only exists as "why we chose X" can't be cited as a violation. Also replaced `InlineStageCell`'s remaining hand-rolled stage-picker dropdown (the popover, not the confirmation dialog) with shadcn `Popover` — it was the same hand-rolled-overlay pattern rule 6 targets, left over in the same file because the original PR #3 fix only touched the confirmation modal.
- **PR #6** (`feat/optimistic-inline-mutations`) added optimistic updates to `useUpdateOpportunityStage` and `useUpdateOpportunityField` in `features/opportunities/hooks.ts`, per the single-field carve-out in CLAUDE.md rule 8. Both hooks now patch the matching row inside every cached `opportunityKeys.lists()` array in `onMutate` (the pipeline table reads from the list query, not a detail query), and roll back in `onError` **and** in `onSuccess` when the resolved value is `{ error }` — Server Actions here return business-rule failures as data rather than throwing, so a rejected mutation resolves `onSuccess`, not `onError`, and needs the same rollback. `onSettled` still invalidates both the detail and list query keys so server state always wins once the request finishes. This fixes the visible flash-to-stale-text in `InlineTextareaCell` (`save()` closes the editor immediately, previously showing the old `value` prop until refetch completed).
  - **Review pass found and fixed a rollback race.** The initial version snapshotted and restored the *entire* cached list array per mutation. Since `InlineStageCell` and `InlineTextareaCell` are independent mutations with independent `isPending` flags, a stage-change and a next_step edit on the same row could be in flight at once — a stale whole-array rollback from one could stomp the other's already-applied optimistic patch. Fixed by making rollback field-scoped: `findOpportunityInLists` captures only the prior value of the field each mutation itself changes (`stage_id`/`stage` or `next_step`/`is_at_risk`), and rollback re-applies just that field on top of whatever the cache currently holds, rather than replacing the whole row/array with a pre-mutation snapshot.
  - **Detail-query patching intentionally left out for now.** `useOpportunity` (the single-detail query) is not patched — the Opportunity Detail Page (`app/(app)/opportunities/[id]/page.tsx`) hasn't been built yet, and `InlineTextareaCell`/`InlineStageCell` are currently only rendered from `features/opportunities/columns.tsx`, which reads from the list query. When the detail page is built and reuses these same inline cells against `useOpportunity` data, add the equivalent `onMutate` patch against `opportunityKeys.detail(id)` at that point — the rollback/onSettled scaffolding here already generalizes to it.
  - **No `is_at_risk` toggle UI exists yet** (confirmed via search — no `.tsx` references it). `useUpdateOpportunityField`'s `is_at_risk` branch is already wired for the optimistic pattern (it's the same discriminated-union mutation as `next_step`), so when that toggle component is built, it gets the optimistic behavior for free — no new hook work needed.
