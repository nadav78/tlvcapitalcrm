# Feature Implementation Patterns

Moved out of `docs/ARCHITECTURE.md` (which is `@`-imported into every session via CLAUDE.md) to keep the auto-loaded context small. **Read this before implementing or modifying the feature it specifies** — these are binding specs, not suggestions. Update this file first when a pattern changes, same as ARCHITECTURE.md.

Contents: Repository Pattern · Custom Hook as Service Layer · Compound Components for Tables · Factory Pattern for Role-Based Columns · Observer Pattern via TanStack Query Cache · Progressive Opportunity Registration (two Zod schemas) · Product Picker · "Close Deal" Modal · Inline Editing for High-Frequency Fields · Admin Contract Editing · Re-staging from Won or Lost · RSM Reassignment Cascade · Confirmation Dialogs · Safe Redirect Targets · What Is Deliberately Not Used

---

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

**Why not a hand-rolled overlay:** the project adopted shadcn specifically because its primitives (Radix, or Base UI depending on the `components.json` style in use) handle focus trapping, Escape-to-close, and ARIA roles correctly by default (see the shadcn/ui entry under Stack in `docs/ARCHITECTURE.md`). A hand-rolled `<div className="fixed inset-0">` has none of that, and duplicating the overlay/positioning markup per dialog means fixing an accessibility gap requires finding and patching every hand-rolled instance instead of one shared component.

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
