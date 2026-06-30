# CLAUDE.md — TLV Capital CRM

This file is read by Claude Code at the start of every session. It defines how to work in this codebase. Follow every rule here without exception — they exist because the previous version of this CRM violated them and failed as a result.

@docs/PRODUCT.md
@docs/SCHEMA.md
@docs/ARCHITECTURE.md

## What This Project Is

An internal CRM for TLV Capital, a defense export company. Three user roles: Admin (full access across all regions and sectors), RSM (own region only), Sector Manager (own sector's product catalog + read-only pipeline). Built with Next.js 15 App Router, Supabase (PostgreSQL + RLS), shadcn/ui, TanStack Table, and TanStack Query.

- Business requirements → `docs/PRODUCT.md`
- Database schema → `docs/SCHEMA.md`
- Stack decisions and patterns → `docs/ARCHITECTURE.md`

## Non-Negotiable Rules

### 1. One route tree. Never two.

All roles share the same `app/` directory. Role-based visibility is handled by middleware checks and component-level guards — never by duplicating pages into separate folders. There is no `app/admin/` tree running parallel to `app/dashboard/`. There is one tree with one set of pages.

### 2. Components never import Supabase directly.

The data flow is always:

```
Component → TanStack Query hook → Server Action → Supabase
```

Components import from `features/*/hooks.ts`. They never import from `@supabase/supabase-js` or `lib/supabase/`. If you find yourself writing `createClient()` inside a component, stop.

### 3. Never use `router.refresh()` after a mutation.

All mutations go through TanStack Query's `useMutation`. On success, call `queryClient.invalidateQueries()` with the relevant query key. `router.refresh()` causes a full page reload, bypasses the cache, and makes every action feel slow.

### 4. Never hand-roll a table.

Every data table in the app uses TanStack Table. Column definitions live in `features/*/columns.tsx`. There are no `<table>` elements built manually from scratch.

### 5. Never duplicate logic per role.

If you find yourself writing the same component twice — once for admin and once for RSM — you are doing it wrong. Use props, role checks, or column factory functions to handle differences within a single component.

## Folder Structure

```
src/
├── app/                          # Next.js App Router — routing only, minimal logic
│   ├── (auth)/                   # Unauthenticated routes (login)
│   └── (app)/                    # All authenticated routes — single tree for all roles
│       ├── dashboard/
│       ├── opportunities/
│       │   ├── page.tsx          # List view
│       │   ├── [id]/page.tsx     # Detail view
│       │   └── new/page.tsx      # Create form
│       ├── clients/
│       ├── contacts/
│       ├── activities/
│       ├── products/
│       └── settings/             # Admin-only, enforced by middleware
├── features/                     # All business logic lives here
│   ├── opportunities/
│   │   ├── api.ts                # Raw Supabase queries (read-only functions)
│   │   ├── actions.ts            # Server Actions (mutations: create, update, delete)
│   │   ├── hooks.ts              # TanStack Query hooks wrapping api.ts
│   │   ├── columns.tsx           # TanStack Table column definitions
│   │   ├── schemas.ts            # Zod schemas for forms and server-side validation
│   │   ├── types.ts              # TypeScript types derived from the schema
│   │   └── components/           # UI components specific to this feature
│   ├── clients/
│   ├── contacts/
│   ├── activities/
│   ├── products/
│   └── users/
├── components/
│   ├── ui/                       # shadcn/ui components — copy-pasted, not modified
│   └── shared/                   # Shared components used across multiple features
│       ├── DataTable.tsx         # Generic TanStack Table wrapper
│       ├── PageHeader.tsx
│       └── ...
└── lib/
    ├── supabase/
    │   ├── client.ts             # Browser Supabase client (use in Client Components)
    │   └── server.ts             # Server Supabase client (use in Server Actions + Server Components)
    ├── auth.ts                   # Session helpers and role utilities
    └── utils.ts                  # cn() and other shared utilities
```

## Patterns

### Reading data (queries)

```typescript
// features/opportunities/api.ts
export async function getOpportunities() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('opportunities').select('...')
  if (error) throw error
  return data
}

// features/opportunities/hooks.ts
export function useOpportunities() {
  return useQuery({
    queryKey: ['opportunities'],
    queryFn: getOpportunities,
  })
}

// In a component
const { data, isLoading } = useOpportunities()
```

### Writing data (mutations)

```typescript
// features/opportunities/actions.ts
'use server'
export async function createOpportunity(input: OpportunityFormValues) {
  const parsed = opportunitySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten() }
  const supabase = await createClient()
  const { error } = await supabase.from('opportunities').insert(parsed.data)
  if (error) return { error: error.message }
  return { success: true }
}

// features/opportunities/hooks.ts
export function useCreateOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createOpportunity,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
  })
}
```

### Role-based column visibility

When a table shows different columns per role, use a factory — never an if/else inside the component:

```typescript
// features/opportunities/columns.tsx
export function getOpportunityColumns(role: UserRole): ColumnDef<Opportunity>[] {
  const base: ColumnDef<Opportunity>[] = [
    { accessorKey: 'prospect_company_name', header: 'Company' },
    { accessorKey: 'stage', header: 'Stage' },
    { accessorKey: 'estimated_value', header: 'Value' },
  ]
  if (role === 'admin') {
    return [...base, { accessorKey: 'rsm.full_name', header: 'RSM' }]
  }
  return base
}
```

### Forms

Every form uses React Hook Form with a Zod schema. The schema lives in `features/*/schemas.ts` and is shared between the form and the Server Action.

```typescript
// features/opportunities/schemas.ts
export const opportunitySchema = z.object({
  prospect_company_name: z.string().min(1),
  region_id: z.string().uuid(),
  stage_id: z.string().uuid(),    // FK → pipeline_stages (lookup table, not enum)
  sector_id: z.string().uuid(),   // FK → sectors (lookup table, not enum)
  advisor_id: z.string().uuid().nullable(),
  // ...
})
export type OpportunityFormValues = z.infer<typeof opportunitySchema>
```

## TDD Workflow

This project follows test-driven development for the layers where it genuinely works. When asked to implement a feature, follow this sequence without exception:

1. **Write tests first. Stop. Do not write implementation.**
   Present the tests and wait. Do not proceed to implementation until explicitly told to.

2. **Implementation comes only after tests are confirmed failing.**
   If tests pass before any implementation exists, they are testing nothing. Fix the tests first.

3. **Write only enough implementation to pass the tests.**
   No extra features, no speculative code. If it is not tested, it is not built yet.

### Where to apply TDD

TDD applies to three specific layers. Do not apply it elsewhere.

**Zod schemas** (`features/*/schemas.ts`)
Write a test asserting what valid input accepts and what invalid input rejects. Then write the schema. These are pure functions with no side effects — the fastest and cleanest TDD in the codebase.

**Server Actions** (`features/*/actions.ts`)
Write tests that call the action with valid and invalid input and assert the return value and resulting database state. Then implement the action.

**RLS policies** (`supabase/migrations/`)
Write tests that query the database as a specific role and assert which rows are returned or blocked. Then write the policy. These run against a real local Supabase instance — never mocked.

### Never mock Supabase

Integration tests always use a real local Supabase instance (`supabase start`). Never mock `@supabase/supabase-js`. A mock that passes only proves the mock was written correctly. Only a real database proves the RLS policy actually works.

### Test file locations

```
features/opportunities/
  ├── schemas.test.ts     # Zod schema unit tests
  ├── actions.test.ts     # Server Action integration tests
supabase/tests/
  └── rls.test.ts         # RLS policy tests, one per table
```

### Commands

```bash
npm test                  # Run all tests
npm test -- --watch       # Watch mode during development
```

---

## Domain Language

Use the exact terms from `docs/PRODUCT.md`. Never substitute synonyms.

| Use this | Never this |
|---|---|
| Client | Account, Customer, End User |
| Opportunity | Lead, Prospect, Inquiry |
| Deal | Closed opportunity, Contract (when referring to the opportunity) |
| Activity | Event, Note, Interaction |
| Manufacturer | Vendor, Supplier, Partner (Partner is acceptable in UI copy only) |
| RSM | Account Manager, Sales Rep |
| Sector | Division, Department, Category |
| Requirement Type | Category (when referring to the type-of-requirement field on an Opportunity) |

## User Roles

```typescript
type UserRole = 'admin' | 'rsm' | 'sector_manager'
```

Access is enforced at two layers — both must be present:

1. **Middleware** (`middleware.ts`) — blocks unauthorized routes before the page renders
2. **Supabase RLS** — blocks unauthorized data at the database level, regardless of what the application sends

Never rely on only one layer.

## Session Workflow

`docs/STATUS.md` tracks what is complete, what is in progress, and what has not been started yet. It is not auto-loaded — read it only when you need it.

**At the start of a session:**
- If the user gives a specific task ("implement opportunities schemas"), start immediately — no need to read STATUS.md.
- If the user gives an open-ended prompt ("continue", "pick up where we left off", "what should we do next"), read `docs/STATUS.md` first, then propose a scope for the session based on what is next and what can realistically be completed end-to-end.

**At the end of a session (before creating the PR):**
Update `docs/STATUS.md`:
- Move completed items from "Not Started" → "Completed"
- If work was interrupted mid-feature, write an "In Progress" entry with: which files were touched, what state they are in, and the exact next action needed. Be specific enough that a fresh session can resume without re-reading the code.
- If nothing was left incomplete, clear the "In Progress" section.

## Branching and PRs

Never commit directly to main. Before writing any code, check the current branch. If on main, create a branch first — without asking.

Branch naming:
- `feat/short-description` — new features or pages
- `db/short-description` — migrations, RLS changes, triggers
- `fix/short-description` — bug fixes

At the end of any implementation session:
1. Update `docs/STATUS.md` (see Session Workflow above)
2. Run `/code-review high` and fix any CONFIRMED findings
3. Create a PR with `gh pr create`
4. Merge with `gh pr merge --squash` once clean

Skip the PR only for docs-only changes (CLAUDE.md, README, docs/).

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build  
npm run lint         # Lint
supabase start       # Start local Supabase instance
supabase db push     # Apply pending migrations to local DB
npm run migrate      # Run data migration from source spreadsheets
```
