# UI Improvement Plan

Working plan for the deferred items from the 2026-07 craft review (`docs/fable-ui-review/08-craft-review.md`). The quick wins were already fixed in PR #10; this file is everything that was deliberately **not** done in that pass, specced so a fresh session can execute without re-deriving context.

## How to use this file (session protocol)

**At the start of a session working from this plan:**
1. Read `docs/UI-STANDARDS.md` (short) — every item below must land at that bar.
2. Check the Session log at the bottom and `docs/STATUS.md` for anything In Progress or merged since this file was written; check `gh pr list --state open` for overlap.
3. **Scope before starting:** pick only what can be completed *end-to-end at full quality* in this session — built, verified in the browser at desktop + 375px per UI-STANDARDS §14, gates run (`npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`), PR opened. A finished item at the standard beats two items at 80%. If an item turns out bigger than specced, stop, note what was learned in the Session log, and either descope to a coherent sub-slice or pick a smaller item — do not ship a compromised version to claim completion.
4. Items marked **[bundle]** are cheaper done alongside the feature work named in STATUS.md's Not Started order than standalone — prefer that pairing when the feature session comes up.

**At the end of the session:**
- Update the Session log below: what shipped (PR link), what's In Progress (files touched, exact state, next action), what was re-scoped and why.
- Update `docs/STATUS.md` per its Session Workflow if feature-level status changed.
- Re-rank the remaining items if the work changed their cost or value.

## Taste calibration (from the review's opinion items — small, do opportunistically)

These are judgment calls, not defects. They're listed first because they calibrate what "considered" means in this codebase — apply the same taste to new work. Each is small enough to ride along with any list-page session:

- **Relative timestamps are wordy.** `formatDistanceToNow` renders "about 1 month ago", which wraps to two lines in the Last Activity column. Strip the `about ` prefix (or move to a compact "34d ago" formatter in `lib/utils.ts` if more cells need it). `features/opportunities/columns.tsx` → `LastActivityCell`.
- **Row hover is nearly invisible.** `DataTable.tsx` uses `hover:bg-muted/50` (~1.5% gray on this palette). Bump to `hover:bg-muted`. One class.
- **Company names wrap to 2–3 lines at 1440px,** making row heights uneven. A `max-w` + `truncate` + `title` tooltip on the Company cell would tighten vertical rhythm — but weigh against the at-risk badge now sharing that cell. Defensible either way; decide once when doing item 1 or 2 below.

## Ranked plan items

### 1. Mobile opportunities list layout — highest impact
At 375px the table is 889px wide in a 325px viewport: Value / Next Step / Last Activity hide behind an unhinted horizontal scroll and ~5 rows fit per screen (evidence: `.captures/mobile-375/32-list-top.png`, `craft-review-capture.json → checks.mobileTableScrollWidth`). PRODUCT.md's premise is RSMs in the field on phones.
**Change:** a `md:hidden` card list rendered from the same `useOpportunities` data in `features/opportunities/components/OpportunityListView.tsx`; wrap the existing `DataTable` in `hidden md:block`. Card contents: company + at-risk badge, stage badge (`stageBadgeClasses`), value (right-aligned), relative last-activity. Keep the filters row as-is (it already wraps). No data-layer change. Card tap = same navigation as row click; inline editing can stay desktop-only for v1 of the card (note it in the PR if so).
**Quality bar:** verify at 375px with seeded data; no horizontal scroll anywhere; card list and table stay consistent (one data source, no duplicated column logic beyond the card markup).

### 2. Keyboard-accessible row navigation in `components/shared/DataTable.tsx`
Rows are `<tr onClick>` only — inline cells are tab-reachable but the row itself never is, so keyboard users can't open the detail page. **[bundle]** with the Opportunity detail page (STATUS.md Not Started) so there is somewhere to navigate to.
**Change:** on clickable rows: `tabIndex={0}`, Enter/Space triggering `onRowClick`, visible focus style (`focus-visible:bg-muted` or an inset ring). Fix once here; every future entity list inherits it. Mind the existing `stopPropagation` contract with `InlineStageCell`/`InlineTextareaCell`.

### 3. Result count + active-filter feedback on list pages
Filtering gives no "N of M" anywhere; with ≤1 page even pagination disappears (evidence: At Risk filter → 5 rows, no count).
**Change:** a muted count line between the filter row and the table in `OpportunityListView` (e.g. "36 opportunities · filtered from 41" — only show the suffix when filters are active). Design once, reuse on Clients/Contacts lists later.

### 4. Popup motion
Popovers, dialogs, selects appear/disappear in a single frame — "abrupt" rather than "snappy".
**Change:** wire Base UI transition attributes (`data-starting-style` / `data-ending-style`) with 100–150ms fade + slight scale in `components/ui/popover.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `select.tsx`. `tw-animate-css` is already imported. One deliberate pass across all four primitives so they feel like one system — not a drive-by on one file. These are shadcn-owned files: keep changes minimal and consistent with upstream idiom.

### 5. Table-shaped skeleton
`OpportunityListView`'s loading state is six generic 40px bars; the real table is a bordered container with a header row and ~53px rows, so first paint visibly snaps (evidence: `.captures/admin-desktop/02-list-skeleton-loading.png`).
**Change:** `components/shared/TableSkeleton.tsx` — header bar + ~10 row bars inside the same `rounded-lg border` container the table uses. **[bundle]** with the next list page (Clients) and use it in both.

### 6. Login page uses shared primitives
`app/(auth)/login/page.tsx` hand-rolls its two inputs with slightly different metrics than `components/ui/input.tsx` — the only form in the app not on the shared primitive. Dependency-following refactor, no logic change; qualifies as low-risk merge under CLAUDE.md.

### 7. Next-step edit affordance for filled cells
`InlineTextareaCell`'s filled state is plain muted text — nothing at rest says "click to edit" (the empty state's "Add next step…" is fine). A small pencil icon on hover/focus is the obvious idiom. **[bundle]** with item 1 (the card layout changes truncation widths anyway).

### 8. Stage color tokens — lowest urgency
`stageBadgeClasses` hardcodes `blue/green/red-50` palette values that bypass the oklch token system and won't adapt if dark mode ever ships; all non-terminal stages are the same blue regardless of pipeline position. Only worth doing if/when dark mode or stage-progression color is actually wanted: define stage colors as CSS variables in `globals.css` and consume them in the helper.

## Session log

| Date | Session | Done | In progress / notes |
|---|---|---|---|
| 2026-07-02 | Craft review (Fable) | Review written (`08-craft-review.md`); 9 quick wins fixed in PR #10; this plan created | PR #10 open awaiting fresh-session review. Items 1–8 above not started. |
