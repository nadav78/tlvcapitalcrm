# 08 — Craft Review: Does the Built UI Feel High Quality?

**Session date:** 2026-07-02
**Scope:** the built surface only — login, app shell, Opportunities list (all three roles), inline stage/next-step editing, Close Deal modal, re-stage confirmation, New Opportunity form, 375px mobile. Dashboard content, unbuilt routes/404s, and everything in STATUS.md's Not Started list are explicitly out of scope per the session brief.
**Method:** production build (`npm run build && npm start`) against local Supabase, seeded with 41 realistic opportunities (`scripts/seed-demo-opportunities.mjs`), driven by Playwright as all three roles at 1440×900 and 375×812. Screenshots in `.captures/{admin-desktop,rsm-desktop,rsm-form,sm-desktop,mobile-375}/`; raw diagnostics and timings in `craft-review-capture*.json` / `after-capture.json`, kept outside `.captures/` since that directory is gitignored — the JSON evidence persists in the repo, the raw PNGs are local-only per the repo convention.

**Environment caveat:** every latency number below is localhost against local Supabase on a production build — a best case. Production through Vercel to hosted Supabase will be strictly worse, and that matters most for the non-optimistic mutations (Close Deal, Create Opportunity), which are the only ones where the user actually waits. Read the numbers as a floor, not a promise.

**Housekeeping note:** the three leftover "Evidence Capture Corp" placeholder rows from a prior session were supposed to be cleared before seeding; they were cleared mid-session instead, so they appear in a few `rsm-desktop` captures (background of the Close Deal shots). They don't affect any finding.

---

## Verdict

The interaction architecture is genuinely good — optimistic inline edits land in under 100ms, feedback states (spinners, disabled controls, skeletons, toasts, inline errors) are all present and correctly chosen, and the role gating is clean. But the app currently **does not read as a considered piece of work, because it literally renders in Times New Roman**. A broken font token means the entire product falls back to the browser's default serif. Everything else on this list is secondary to that. Fix the font and the same screens jump from "unstyled prototype" to "unremarkable but competent internal tool." Getting from *competent* to *considered* is the rest of this report: alignment, density, affordance, and a handful of copy-level roughnesses.

There is no bespoke design system — this is stock shadcn (`base-nova` style, `neutral` base color) with default radius, default type scale, and a grayscale palette. For an internal CRM that's a defensible choice, not a finding. What *is* a finding is where the app deviates from even the stock system (hardcoded `blue-50`/`green-50`/`red-50` stage colors that bypass tokens and will break in dark mode) or fails to use it (the login form hand-rolls its inputs instead of using `components/ui/input.tsx`).

---

## 1. The font is broken — the app renders in Times New Roman

**[Objectively broken — the single highest-leverage fix in this report]**

`src/app/globals.css:10` declares `--font-sans: var(--font-sans)` inside `@theme inline` — a self-reference. `layout.tsx` loads Geist and exposes it as `--font-geist-sans`, but nothing maps it to `--font-sans`. At runtime `var(--font-sans)` resolves to nothing, `font-family` is invalid, and the browser falls back to its default serif. Verified in the browser: `getComputedStyle(document.body).fontFamily` → `"Times New Roman"`. `--font-geist-sans` is correctly populated (`"Geist", "Geist Fallback"`) — it's loaded, paid for in bytes, and never used. (`--font-heading` on line 12 chains off the same broken variable.)

Every screenshot in `.captures/` shows it: serifs on the nav labels, the table, the dialogs, the buttons. This is why the whole app reads as an unstyled 1990s page rather than a product. One line to fix.

Evidence: `admin-desktop/03-list-40rows-page1.png` (any capture, really), `craft-review-capture.json → checks.bodyFontFamily`.

## 2. Opportunities list at 40 rows

Evidence: `admin-desktop/03-list-40rows-page1.png`, `01-retry-list-page2.png`, `16-filter-atrisk-active.png`, `18-show-closed-with-wonlost.png`, `19-search-filtered.png`.

**What works:** default sort puts fresh rows on top; Won/Lost excluded by default; pagination appears only when needed ("Page 1 of 2", Previous/Next); next-step truncates to one line with a `title` tooltip; stale "about 1 month ago" turns red exactly when it should; currency formatting via `Intl.NumberFormat` is correct across EUR/NOK/SEK/$ symbols. At 25 rows per page the table is scannable without feeling sparse.

**Objectively rough:**

- **Value column is left-aligned** (`columns.tsx` `estimated_value` cell, and `DataTable.tsx:61` left-aligns every header). Money in a pipeline table is *the* column RSMs compare down the page; left-aligned mixed-width figures ("€890,000" vs "NOK 8,900,000") can't be scanned. Right-align the cell and its header. `tabular-nums` is already there — it only pays off once the digits line up.
- **`is_at_risk` is invisible in the table.** The seed data flags 5 open deals at-risk; nothing on their rows shows it. The only way to know is toggling the At Risk filter (`16-filter-atrisk-active.png`) — which tells you the flag exists but not *which of the rows you're currently looking at* carry it. For a field PRODUCT.md surfaces on both dashboards, the list needs at least a small destructive-colored dot or tag on the Company cell.
- **Stage badges wrap to two lines** ("Awaiting License", "Proposal Sent" — `03-list-40rows-page1.png` rows 1, 3). A pill that breaks into an oval blob is the most visually noisy thing on the page, and it makes row heights uneven. `whitespace-nowrap` on the `InlineStageCell` trigger fixes it outright.
- **The admin RSM column wraps "Manual RSM Two" onto three lines** while Next Step — the column with actual content — is capped at 280px. Column width priorities are inverted for the admin view. (Partially seed-data-dependent, but real names — "Aleksander Kowalczyk" — will wrap the same way.)
- **Skeleton bars don't match the layout they precede** (`02-list-skeleton-loading.png`): six 40px-tall full-width bars stand in for a bordered table of ~53px rows with a header row. The page visibly "snaps" when real content arrives. Matching the count/height/container of the real table would make the transition feel intentional. It's better than a spinner, but it's the rough-cut version of the pattern.
- **No result count.** Filtering to At Risk shows 5 rows and nothing that says "5 of 36". With pagination hidden under one page, there's zero feedback on how much the filter removed.

**Taste / opinion:**

- `formatDistanceToNow`'s "about 1 month ago" is wordy for a table cell; it wraps to two lines in the Last Activity column. `about ` stripped (or a compact "34d ago" format) would read cleaner. 
- Row hover is `bg-muted/50` — on this palette that's ~1.5% gray, which barely registers (compare `04-hover-row.png` against `03-…png`: the difference is nearly imperceptible). Full `bg-muted` would still be subtle.
- Company names wrapping to 2–3 lines at 1440px makes rows tall; a `max-w` + truncate with tooltip would tighten vertical rhythm. Defensible either way at this data volume.

## 3. Affordance clarity — would a salesperson know what's editable?

Evidence: `admin-desktop/04–09` (hover series), `10–12` (focus series), `13-stage-popover-open.png`, `14-next-step-editing.png`, `sm-desktop/29-sm-list-readonly.png`.

- **The stage badge reads as a status label, not a control.** The only edit cue is a 10px `▾` at 60% opacity. It's *enough* once you know, and the popover appears instantly on click — but nothing invites the first click. **[taste, leaning objective]**
- **A filled next-step cell has no edit affordance at rest.** Empty cells show italic "Add next step…" (good); filled cells are plain muted text that brightens slightly on hover. A non-technical user will not discover that clicking the text edits it — and since the row itself navigates on click, the cost of guessing wrong is a 404 (until the detail page exists). **[objective]**
- **The At Risk / Show closed filter chips are 20px-tall badges next to a 32px input and 28px filter buttons** — three control heights in one row (`Input` h-8 at `w-56`, `Button size=sm` h-7, `Badge` h-5). The chips look like passive tags, not toggles; "Show closed" active state is `secondary` (light gray), which is almost indistinguishable from its inactive outline state (`18-show-closed-with-wonlost.png`). At Risk at least turns pink when active. **[objective on the height dissonance; the fix is one variant choice]**
- **The Sector Manager's read-only stage cell drops the color badge entirely** (`29-sm-list-readonly.png`) — stage becomes small gray text. Read-only shouldn't mean *less information*: the color coding is the scannable part, the popover is the interactive part. Render the same badge, minus the trigger. **[objective]**
- **The stage popover marks the current stage only by slightly bolder text** (`13-stage-popover-open.png`) — at a glance all eight options look equal. A leading check glyph is the standard idiom. Also, the Won item renders as "Won (Won)" — the `(Won)` suffix from `InlineStageCell.tsx:98` is meant to disambiguate a *renamed* Won stage; when the stage is literally named "Won" it reads as a stutter. Hide the suffix when it duplicates the name. **[objective, copy-level]**
- **Keyboard access is half-there.** Every inline control is tab-reachable in a sensible order (verified: search → filters → chips → per-row stage badge → next-step, `craft-review-capture.json → checks.adminTabStops`), Base UI selects open on Enter and close on Escape, the textarea honors Escape-to-cancel and Ctrl/Cmd+Enter-to-save. But **row navigation is click-only** — `DataTable`'s `<tr onClick>` is unreachable by keyboard, so once the detail page exists, keyboard users can edit a row's stage but never open the row. **[objective, deferred — needs real focus/key handling, not a class change]**

## 4. Feedback quality: loading, pending, success, error

Evidence: `rsm-desktop/21–25`, `rsm-form/04-retry-form-validation-errors.png`, `admin-desktop/03-retry-restage-won-confirm-dialog.png`.

**This is the strongest area.** Close Deal shows the ARCHITECTURE.md preview block ("Creating new client: …") before commit; while submitting, every input disables and the button gets a spinner without a label swap (`23-close-deal-pending.png`); success is a specific toast ("Deal closed. Estonian Maritime Administration is now a Client."); errors render inline, not as toasts. The re-stage confirmation dialog copy is genuinely good — it says exactly what will and won't happen. The inline saves are optimistic and land imperceptibly. No console warnings, no page errors anywhere in the pass (`craft-review-capture.json → diagnostics` — the only noise is nav prefetch 404s for unbuilt routes, out of scope).

**Objectively rough:**

- **Validation errors are raw Zod internals** (`04-retry-form-validation-errors.png`): "Too small: expected string to have >=1 characters" ×4 and — worst — `Invalid option: expected one of "cold_outreach"|"partner"|"inbound"|"diplomatic"|"marketing"`, enum tokens leaked verbatim to a salesperson. Known finding from the prior review; eligible for this fix pass. Human messages ("Enter the company name", "Select a lead source") are a schema-file copy change.
- **`CloseDealModal.tsx:142` violates the project's own controlled-Select convention** — `value={field.value}` with `defaultValues.currency: opportunity.currency ?? undefined`. For any opportunity without a currency set (5 of the 41 seeded rows), selecting a currency flips the Select from uncontrolled to controlled — the exact React warning ARCHITECTURE.md's Base UI gotchas section documents, and the same family as the known select-label bug. The convention (`?? null` at both sites) is applied in `OpportunityRegisterForm` but was missed here.
- **The one visible motion bug: nothing animates.** Popovers, dialogs, and the modal all appear/disappear in a single frame (tw-animate-css is imported but the Base UI popup transitions aren't wired with starting styles in `popover.tsx`/`dialog.tsx` — they pop). A 100–150ms fade/scale on popups is the difference between "snappy" and "abrupt". **[taste, but the absence is noticeable]**

## 5. New Opportunity form

Evidence: `rsm-form/26-form-initial.png`, `04-retry-form-validation-errors.png`, `mobile-375/35-new-form-top.png`.

- **The page has no padding** — `app/(app)/opportunities/new/page.tsx` wraps `PageHeader` + form in a bare `<div>`, unlike the `p-6` on every other page. On desktop the H1 sits flush against the top edge and the form flush against the sidebar border (`26-form-initial.png` — the heading is visually clipped); at 375px the entire form touches the screen edges (`35-new-form-top.png`). **[objectively broken, one class]**
- **The two-column grid doesn't collapse on mobile** — `grid-cols-2` throughout `OpportunityRegisterForm.tsx` yields ~165px-wide inputs at 375px; the Requirement Type placeholder truncates to "e.g. C-UAS, Optronic". PRODUCT.md's whole premise is RSMs in the field on phones. `grid-cols-1 sm:grid-cols-2`. **[objective]**
- **No required-field markers.** Everything above the "Prospect contact" section is required, everything below optional — the only cue is the section note. Fine for a trained user; asterisks on labels (or "optional" suffixes below) would remove the guesswork. **[taste]**
- Structure is otherwise right: logical grouping with a divider, helper text on the optional section, Cancel/submit placement, submit disabled until lookups resolve, toast + redirect on success. Tab order is clean and Selects are fully keyboard-operable (`checks.formTabStops`).

## 6. Mobile (375px)

Evidence: `mobile-375/30–36`.

- **The bottom tab bar is correct and clean** — right four tabs, active state readable, safe spacing (`31-dashboard-tabbar.png`).
- **The table is the desktop table shrunk** (`32-list-top.png`): 889px of content in a 325px viewport (`checks.mobileTableScrollWidth`), so Value / Next Step / Last Activity live off-screen behind a horizontal scroll **with no visual affordance that they exist** — the table looks complete at Company/Country/Stage. Meanwhile company names wrap to 4 lines and one screen fits ~5 rows. This is the biggest *deferred* item: mobile needs either column prioritization or a card list; both are real design work, not a class tweak.
- The mobile New Opportunity form issues are covered in §5 (edge-flush + 2-col cramp).
- Login at 375px is fine (`30-login.png`).

## 7. Perceived latency (localhost floor, production build)

| Interaction | Click → visible feedback | Mechanism | Assessment |
|---|---|---|---|
| Stage change (inline) | **89ms** | optimistic cache patch | Feels instant. |
| Next-step save | **49ms** | optimistic cache patch | Feels instant; editor closes immediately, no flash-to-stale (PR #6 fix holds). |
| At Risk filter toggle | **87ms** | client-side + `keepPreviousData` | Feels instant; no empty-state flash. |
| Close Deal submit → toast | **522ms** | server round-trip, no optimism (by rule) | Fine locally; spinner + disabled inputs carry it. On Vercel↔hosted Supabase expect 1.5–3s+ — the spinner pattern is already correct, which is what will keep it acceptable. |
| Create Opportunity submit → toast | **240ms** | server round-trip | Same story. |
| List first paint | skeleton within ~0.5s, data over throttled 400ms link | TanStack Query + skeleton rows | Skeleton works; shape mismatch noted in §2. |

The optimistic carve-out in CLAUDE.md rule 8 is doing exactly what it was designed to do: the two highest-frequency actions are the two fastest. No further latency work is warranted before there's production telemetry.

---

## Ranked: highest-leverage craft improvements

Ordered by (impact on perceived quality) ÷ (effort). ✔ = fixed in this session's fix pass (see After appendix); ▸ = deferred (see Deferred improvements).

1. ✔ **Fix the font token** — `globals.css` `--font-sans` self-reference → point at `--font-geist-sans` (and `--font-heading` with it). One line; changes the perceived quality of every screen more than everything else combined.
2. ✔ **Humanize Zod validation messages** in `features/opportunities/schemas.ts` (register + close-deal schemas) — no salesperson should ever see `expected one of "cold_outreach"|…`.
3. ✔ **Add `p-6` to `opportunities/new/page.tsx`** and collapse the form to `grid-cols-1 sm:grid-cols-2` — un-clips the desktop heading, un-crams the mobile form.
4. ✔ **Right-align the Value column** (cell + header) in `columns.tsx`/`DataTable`.
5. ✔ **`whitespace-nowrap` the stage badge** in `InlineStageCell` so pills never wrap into blobs.
6. ✔ **Show at-risk on the row** — small destructive dot + "At risk" tag on the Company cell when `is_at_risk`, all roles.
7. ✔ **Give the Sector Manager the same stage badge (non-interactive)** instead of downgrading to gray text; add current-stage check + drop the redundant "(Won)" suffix in the stage popover.
8. ✔ **Fix the controlled-Select convention miss** in `CloseDealModal` (`value={field.value ?? null}`, default `null` not `undefined`).
9. ✔ **Unify the filter row** — render `ToggleFilterChip` at the same height/idiom as the `size=sm` filter buttons, with an unmistakable active state.
10. ▸ **Mobile list layout** (card list or column priority) and ▸ **keyboard-reachable rows** — the two real design/logic items; deferred with specs in STATUS.md.

## Seed script

`scripts/seed-demo-opportunities.mjs` is **kept** — it's reusable, not throwaway: idempotent (deletes its own `[demo]`-marked rows first, including any Client/Contract records created by closing a demo deal through the UI), covers all regions/stages/currencies with realistic next-step copy, and any future dashboard/detail-page session will want exactly this data. Both `.tmp-craft-review*.mjs` driver scripts were deleted after the pass, per the helpers' contract.

---

## Deferred improvements (ranked by impact)

Not implemented this session — each has a matching entry in STATUS.md's Not Started list with file-level detail.

1. **Mobile opportunities list layout.** The desktop table at 375px hides Value/Next Step/Last Activity behind an unhinted horizontal scroll and fits ~5 rows per screen. Highest-impact option: a `md:hidden` card list (company, stage badge, value, relative activity) rendered from the same data, keeping the table `hidden md:block`. Touches `OpportunityListView` + a new card component; no data-layer change.
2. **Keyboard-accessible row navigation in `DataTable`.** Rows are `onClick` only. Needs `tabIndex={0}`, `role="link"` semantics or a real link-wrapped first cell, Enter handling, and a visible focus style. Do it once in `DataTable` and every future entity list inherits it.
3. **Result count + active-filter feedback on list pages.** "36 opportunities · filtered from 41" line above the table; cheap once designed, reusable across all future lists.
4. **Popup motion.** Wire Base UI transition data-attributes (`data-starting-style`/`data-ending-style`) in `popover.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `select.tsx` with 100–150ms fade/scale. Component-local but touches four shared primitives owned by shadcn conventions — worth one deliberate pass, not a drive-by.
5. **Skeleton fidelity.** Replace the six generic bars in `OpportunityListView` with a table-shaped skeleton (header bar + 10 rows at real row height inside the same rounded border). Consider promoting to `components/shared/TableSkeleton.tsx` when the Clients list is built.
6. **Login page should use the shared `Input`** (and the same card treatment as the rest of the app) — it currently hand-rolls input markup with a different radius (`rounded-lg` at h-auto) than `components/ui/input.tsx`. Dependency-following refactor.
7. **Next-step edit affordance** — a pencil icon on hover/focus (or persistent at low opacity) on filled cells. One-line-ish but interacts with truncation width; bundle with #1's card design for mobile.
8. **Stage color intent.** Hardcoded `blue-50/green-50/red-50` in `InlineStageCell` bypass the token system and won't adapt to dark mode; stages are also all-blue regardless of position (New looks identical to Negotiation). If dark mode or stage-progression color is ever wanted, define stage colors as tokens. Low urgency — light-mode-only today.

---

## After appendix — fix pass results

All nine ✔ items from the ranked list were fixed on branch `fix/craft-review-quick-wins`. Gate: `npx tsc --noEmit`, `npm test` (82/82), `npm run lint` (0 errors — the 4 warnings are pre-existing, in files this branch doesn't touch), `npm run build` all clean. After-captures live in `.captures/after/`; verification details in `after-capture.json`.

| # | Fix | Files | Before | After |
|---|---|---|---|---|
| 1 | Font token: `--font-sans`/`--font-heading` now point at `--font-geist-sans`; computed body font verified as `Geist, "Geist Fallback"` (was `"Times New Roman"`) | `globals.css` | any pre-fix capture, e.g. `admin-desktop/03-list-40rows-page1.png` | `after/01-admin-list-fixed.png` |
| 2 | Zod messages humanized (register + close-deal schemas); on-screen errors now read "Enter the prospect company name", "Select a lead source", etc. Messages are copy-only — all 82 tests pass unchanged (they assert accept/reject, never message text) | `features/opportunities/schemas.ts` | `rsm-form/04-retry-form-validation-errors.png` | `after/06-form-validation-messages-fixed.png` |
| 3 | `p-6` on the New Opportunity page + `grid-cols-1 sm:grid-cols-2` on all six form grids | `app/(app)/opportunities/new/page.tsx`, `OpportunityRegisterForm.tsx` | `rsm-form/26-form-initial.png`, `mobile-375/35-new-form-top.png` | `after/09-desktop-form-padded-fixed.png`, `after/08-mobile-form-fixed.png` |
| 4 | Value column right-aligned (header + cells) | `features/opportunities/columns.tsx` | `admin-desktop/03-list-40rows-page1.png` | `after/01-admin-list-fixed.png` |
| 5 | Stage badges `whitespace-nowrap` — no more two-line pills | `InlineStageCell.tsx` (`stageBadgeClasses`) | same | same |
| 6 | At-risk rows now carry a destructive "At risk" badge on the Company cell | `features/opportunities/columns.tsx` | `admin-desktop/16-filter-atrisk-active.png` (flag invisible on rows) | `after/01-admin-list-fixed.png` (Oslo Port Security row), `after/02-atrisk-chip-active-fixed.png` |
| 7 | Sector Manager stage cell renders the same colored badge (non-interactive) via exported `stageBadgeClasses`; stage popover marks the current stage with a check; "(Won)" suffix only shows when the stage name doesn't already say Won | `columns.tsx`, `InlineStageCell.tsx` | `sm-desktop/29-sm-list-readonly.png`, `admin-desktop/13-stage-popover-open.png` | `after/05-sm-list-colored-badges-fixed.png`, `after/04-stage-popover-fixed.png` |
| 8 | `CloseDealModal` currency Select now `value={field.value ?? null}` per the ARCHITECTURE.md Base UI convention; verified by closing a deal on a no-currency opportunity and selecting a currency — zero controlled/uncontrolled React warnings (`after-capture.json` → `reactWarningsAfterCurrencySelect: []`) | `CloseDealModal.tsx` | n/a (console-only) | `after/07-close-deal-currency-selected.png` |
| 9 | `ToggleFilterChip` rebuilt on `Button size=sm` — same height as the filter buttons beside it, leading ✓ when pressed, so the active state is unmistakable in both variants | `components/shared/ToggleFilterChip.tsx` | `admin-desktop/18-show-closed-with-wonlost.png` | `after/02-atrisk-chip-active-fixed.png`, `after/03-show-closed-chip-active-fixed.png` |

One knock-on worth naming: right-aligning Value and adding the at-risk badge widened the admin table slightly, so the Region column sits closer to the right edge at 1440px. This is part of the already-deferred "column width priorities" item (RSM/Region wrap while Next Step is capped), not a regression introduced by the alignment itself.
