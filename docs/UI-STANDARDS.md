# UI Craft Standards

Read this before building or modifying any UI. It is deliberately short — every rule here traces to a concrete defect found in the 2026-07 craft review (`docs/fable-ui-review/08-craft-review.md`) and fixed in PR #10. The bar is: **the app must read as a considered internal tool, not a generic scaffold.** These rules keep new surfaces from re-introducing the roughness that was already paid for once.

Feedback patterns (spinners, toasts, inline errors, skeletons, optimistic-update rules) are defined in `docs/reference/PAGE-SPECS.md`'s "Feedback Pattern" section and CLAUDE.md rule 8 — this file doesn't repeat them.

## Tokens and type

1. **Design tokens must resolve.** Anything added to `@theme inline` in `globals.css` references a variable that is actually defined at runtime (next/font variables like `--font-geist-sans`, or a `:root` value). The app shipped for weeks rendering in Times New Roman because `--font-sans` pointed at itself. When touching tokens, verify in the browser: `getComputedStyle(document.body).fontFamily` (or the relevant property) — never trust the build passing.
2. **Use tokens, not raw palette values,** for anything themable (`text-destructive`, not `text-red-600`). Known accepted exception: `stageBadgeClasses` in `components/shared/InlineStageCell.tsx` hardcodes blue/green/red-50 — don't spread that pattern; if a new component needs status colors, take them from the same helper or a token.

## Layout and density

3. **Every routed page wraps its content in `p-6`.** The New Opportunity page shipped with a clipped heading and an edge-flush form because it skipped this. Check the wrapper before checking anything else on a new page.
4. **375px is a first-class viewport.** RSMs work from phones (PRODUCT.md). Form grids are `grid-cols-1 sm:grid-cols-2` — never bare `grid-cols-2`. Before calling a screen done, look at it at 375px: nothing flush against edges, no input narrower than its placeholder, no content reachable only by an unhinted horizontal scroll.
5. **Numeric/money columns are right-aligned** — cell *and* header (`header: () => <div className="text-right">…</div>` in the column def) — with `tabular-nums`. Left-aligned money can't be compared down a column.
6. **Badges and pills never wrap** (`whitespace-nowrap`). A two-line pill is a blob and makes row heights uneven.

## Information and affordance

7. **A flag worth storing is worth showing in the row.** `is_at_risk` was invisible in the list until you toggled a filter. Any status flag surfaced on a dashboard or filter must also be visible on the record's row/card itself (see the destructive "At risk" `Badge` in `features/opportunities/columns.tsx`).
8. **Read-only means not clickable, not less scannable.** When a role gets a read-only variant of a cell, keep the visual encoding (color, badge shape) and remove only the interactivity — see the Sector Manager stage cell.
9. **Selection lists mark the current selection** with a leading check in a fixed-width slot (see the stage popover in `InlineStageCell`), not just bolder text.
10. **Toggle controls sit at the same height as their neighbors and show an unmistakable pressed state.** `ToggleFilterChip` is the reference: `Button size="sm"`, `aria-pressed`, leading `<Check />` when active. Don't hand-roll a new toggle idiom per page.

## Copy

11. **Validation messages are written for a salesperson, never Zod defaults.** Every field a form renders gets an explicit message in `features/*/schemas.ts` ("Enter the country", "Select a lead source"). Zod's defaults leak schema internals (`expected one of "cold_outreach"|…`) into the UI. Messages are copy-only — schema tests assert accept/reject, not message text, so this never breaks tests.
12. **UI copy is short and specific** (existing rule — "Opportunity updated.", not "Your changes have been saved successfully.") and uses the Domain Language table in CLAUDE.md.

## Base UI specifics

13. **Controlled `Select` values are never `undefined`** — default nullable fields to `null` and coerce at the JSX call site (`value={field.value ?? null}`). This is documented in `docs/reference/TESTING.md`'s Base UI Select gotchas and was still missed once (CloseDealModal); check every new `Controller`-wrapped Select against it.

## Verifying UI work

14. For anything beyond a trivial change, do a quick capture pass with `scripts/playwright-helpers.mjs` (see `docs/reference/TESTING.md` "Scripted Browser Verification"): desktop + 375px screenshots, `attachDiagnostics` for console warnings, and — if realistic data volume matters — seed with `scripts/seed-demo-opportunities.mjs` (idempotent, 41 rows). Judge the screenshot like a stranger would: what's clickable, what's cramped, what wraps.
