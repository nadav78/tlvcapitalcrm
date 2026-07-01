# Fable UX Review — Infra Preflight Assessment

Preflight only. No evidence pack created. See `docs/ARCHITECTURE.md`'s "Scripted
Browser Verification" section and PR #9 for the infra this report assesses.

## 1. Verdict

**Existing infra is almost enough.**

The login/role/seed foundation from PR #9 is solid and directly reusable. What's
missing is narrow but real: no console/network capture, no screenshot helper, no
Playwright config, and — separately from infra — most of the app's pages don't
exist yet, which caps how much UX there is to evidence regardless of tooling.

## 2. What already works

- **App launch**: `npm run dev` + `supabase start` is enough to get a working
  local instance. `.env.local` is present and configured.
- **Persistent, idempotent test accounts** (`scripts/seed-manual-test-users.mjs`):
  one Admin, two RSMs in different regions (Baltics, Nordics), one Sector
  Manager — all password `Test1234!`. Good role coverage for exactly the
  Admin/RSM/Sector Manager split the product requires.
- **Login helper** (`scripts/playwright-helpers.mjs`): `login(page, email)`
  drives the real login form and waits for the `/dashboard` redirect. Reusable
  as-is for any future script.
- **Known Base UI `<Select>` gotchas already documented and solved**:
  `openOption(page)` scopes `[role="option"]` to `:visible` (Base UI keeps
  closed Selects' options mounted-but-hidden), and there's a documented
  full-page-screenshot-closes-popup interaction to design around. This will
  save real time — a future capture script would otherwise rediscover both.
- **Chromium launch on minimal containers is solved**: `libasound.so.2`
  workaround via `scripts/setup-browser-verification.sh`, no root needed.
- **Established convention for throwaway driver scripts**: write inside the
  repo (`scripts/.tmp-*.mjs`, gitignored) so Node's ESM resolver can find
  `node_modules/playwright`. This convention transfers directly to a future
  capture script.
- **Precedent that scripted Playwright passes catch real, non-visual bugs**:
  PR #9's session used exactly this kind of ad hoc script to catch a console
  warning and a leaked sentinel string that manual click-through likely would
  have missed — the same category of evidence a Fable review would want.

## 3. What is missing or risky

- **No `playwright.config.ts`.** Every existing invocation is script-driven
  (`node scripts/foo.mjs`), not `npx playwright test`. There's no configured
  baseURL, no trace/video-on-failure, no reporter. Fine for a one-off
  assertion script; not set up to produce structured, comparable output across
  a multi-page walkthrough.
- **No console-message or page-error capture anywhere in the codebase.**
  `playwright-helpers.mjs` has no `page.on('console', ...)` or
  `page.on('pageerror', ...)` wiring. The task explicitly requires "recording
  console warnings/errors" — this has to be added, not reused.
- **No network-failure detection.** No `page.on('requestfailed', ...)` or
  `page.on('response', ...)` status-check anywhere. Same gap as above —
  needed but absent.
- **No screenshot helper.** Screenshots were taken ad hoc during PR #9 (the
  ARCHITECTURE.md gotcha about full-page screenshots closing Select popups
  implies this happened) but no reusable, gitignored output-path convention
  exists for saving them systematically.
- **No structured output format.** Nothing writes a per-flow markdown/JSON
  summary; PR #9's script was throwaway and deleted per the documented
  convention. An evidence pack needs *persistent* per-flow artifacts, which is
  the opposite of the "write once, delete" pattern the current helpers assume.
- **Infra is explicitly scoped as "ad hoc, not per-feature" and "throwaway."**
  `docs/ARCHITECTURE.md` and `playwright-helpers.mjs`'s own header say these
  scripts are meant to be written per-feature and deleted afterward — the
  opposite intent of a durable, repeatable evidence-collection script. Reusing
  the pattern as-is would mean re-deriving capture logic each future review.
- **Local Supabase is currently stopped.** `supabase status` shows core DB/API
  services down (only edge-runtime/pooler/imgproxy reported, and those are
  stopped too) — `supabase start` is a precondition, not automatic.
- **Most of the app doesn't exist yet — this is a scope gap, not a tooling
  gap.** Per `docs/STATUS.md`, only `login`, a placeholder `dashboard`, the
  Opportunities list, and Opportunities "new" page are built. There is no
  Opportunity detail page, no Clients/Contacts/Activities/Products/Settings
  pages. A "does the UI feel obvious, fluid, fast, worth using daily" review
  right now can only honestly evaluate: login, sidebar/nav shell, the
  Opportunities list (with filters, inline stage/next-step editing, Close Deal
  modal), and the New Opportunity form. That's a real but partial slice of the
  eventual product.

## 4. Recommended approach for the future evidence-pack task

Create **one small, temporary Playwright UX-capture script**, built on top of
the existing helpers rather than replacing them. Concretely:
- Reuse `login()` and `openOption()` from `playwright-helpers.mjs` as-is.
- Add (in the new temporary script, not in the shared helper — unless you
  expect a second future review to reuse it, in which case promote it) three
  small pieces: a console/pageerror listener, a response-status listener for
  failed/4xx/5xx requests, and a screenshot-per-step helper that writes into a
  gitignored output directory.
- Do **not** rely on manual clicking/screenshots alone — the task explicitly
  wants repeatable evidence, and manual passes aren't reproducible across
  future reviews or role permutations.
- Do **not** avoid browser automation in favor of static docs — the product
  requirements (obvious/fluid/fast/daily-use) are inherently about interaction,
  not something static docs can evidence.
- Treat this as in scope for the future task, not this one: this preflight
  deliberately stops short of writing that script.

## 5. Allowed temporary infra recommendation

Smallest safe addition, all temporary/gitignored, no new dependencies:

- One driver script at `scripts/.tmp-fable-capture.mjs` (already covered by the
  existing `/scripts/.tmp-*.mjs` gitignore pattern) that:
  1. Imports `login`/`openOption`/`BASE_URL` from `playwright-helpers.mjs`.
  2. Attaches `page.on('console')`, `page.on('pageerror')`, and
     `page.on('requestfailed')` (plus a response listener for non-2xx/3xx
     status) once per page, logging to a structured array.
  3. Walks the currently-live flows only (login → dashboard → Opportunities
     list → filters/inline-edit → New Opportunity form → submit) per role that
     has access to each.
  4. Screenshots each step to a gitignored directory, e.g.
     `docs/fable-ui-review/.captures/` (viewport-only around any open Select,
     per the documented gotcha).
  5. Writes one JSON or markdown file per flow summarizing: steps taken,
     console/network issues found, screenshot paths.
- No new npm dependency — Playwright is already a devDependency.
- No `playwright.config.ts` needed for this — a config is overhead for a
  single throwaway script; add one only if this graduates into a recurring
  suite.
- Delete the driver script when the evidence pack is done, same as the
  existing convention — but the *output* (screenshots + summaries under
  `docs/fable-ui-review/`) is the deliverable and should persist.

## 6. Exact next prompt adjustment

Add to the future UX evidence-pack prompt: *"The existing Playwright infra
(`scripts/playwright-helpers.mjs`, `scripts/seed-manual-test-users.mjs`) covers
login and role accounts but has no console/network capture, no screenshot
helper, and is designed to be thrown away per feature — write one temporary
capture script (e.g. `scripts/.tmp-fable-capture.mjs`, already gitignored)
that layers console/pageerror/requestfailed listeners and a screenshot helper
on top of the existing `login()`/`openOption()` helpers, and only evidence the
flows that currently exist: login, the app shell/nav, the Opportunities list
(filters, inline stage/next-step edit, Close Deal modal), and the New
Opportunity form. Do not evidence Clients, Contacts, Activities, Products, or
Settings — they aren't built yet. Confirm `supabase start` is running before
beginning."*
