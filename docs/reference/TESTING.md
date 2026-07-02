# Testing Strategy & Scripted Browser Verification

Moved out of `docs/ARCHITECTURE.md` (which is `@`-imported into every session via CLAUDE.md) to keep the auto-loaded context small. The TDD workflow rules themselves live in CLAUDE.md ("TDD Workflow") — this file holds the rationale, the never-mock-Supabase policy, and the full Scripted Browser Verification setup (including the Base UI Select gotchas referenced from component code).

---

This project uses test-driven development for the layers where it produces reliable, meaningful tests. Not every layer is worth TDD — applying it uniformly creates tests that are expensive to write, expensive to maintain, and don't catch real bugs.

### The three layers where TDD is applied

**Zod schemas**
A Zod schema is a pure function: input goes in, a validation result comes out. No database, no HTTP, no side effects. Writing the test first is natural — you describe what valid and invalid input looks like before writing any schema code. If a field's rules change later, the test tells you immediately what broke. This is the fastest TDD loop in the codebase.

**Server Actions**
Server Actions contain the thickest business logic: they validate input, call the database, and return structured results. They have clear inputs (form values) and clear outputs (success or a specific error). Writing the test first forces you to define exactly what success looks like before writing a single line of implementation. These tests call the action directly with real data and assert both the return value and the resulting database state.

**RLS policies**
RLS policies are the access control layer of the entire application. A bug here — an RSM seeing another region's data — is a serious data breach, not just a UI glitch. TDD is not optional here; it is the primary proof that the policy does what you intended. The test queries the database as a specific role and asserts which rows come back (and which are blocked). There is no other reliable way to verify this.

### Why Supabase is never mocked

All integration tests run against a real local Supabase instance (`supabase start`). Mocking Supabase would let tests pass while RLS policies, column names, or query logic contain bugs. A mock only proves that the mock was written correctly — not that the real database behaves as expected. This is especially true for RLS: a mocked Supabase client has no concept of row-level security. Only a real Postgres instance with real policies can prove they work.

### Where TDD is not applied

**React components** — Component behavior is visual and interactive. The meaningful question is not "does this render?" but "does clicking this button call the mutation?" Those tests are written after the component exists, focused on user behavior, not implementation. Writing them before the component exists adds friction without meaningful benefit.

**End-to-end flows** — Playwright tests for critical paths (login → create opportunity → mark Won → verify client record) are written once a flow exists and works, then maintained to catch regressions. Writing them before the UI exists is impractical.

### Tool

Vitest is used for all unit and integration tests. It is faster than Jest, works natively with the ESM module system used throughout this project, and has the same API as Jest — no learning curve if you know Jest.

Tests live alongside the code they test:

```
features/opportunities/schemas.test.ts   ← Zod schema tests
features/opportunities/actions.test.ts   ← Server Action integration tests
supabase/tests/rls.test.ts               ← RLS policy tests, one per table
```

### Scripted Browser Verification (ad hoc, not per-feature)

Most UI changes are verified by clicking through the feature in the browser
by hand — that's the right default. It's fast, and the person testing knows
what "correct" looks like for this domain better than a script would. This
is not a replacement for that, and it is not something to reach for on every
UI change — a straightforward slide-over or a single-role page is faster and
just as reliable to click through manually.

Reach for a scripted Playwright pass instead of (or in addition to) manual
clicking when a change has:

- **Multiple role-gated branches** — a form or page that behaves differently
  for Admin vs. RSM vs. Sector Manager, or a route with a redirect guard.
  Manually testing 3 logins × N branches is easy to under-cover; a script
  exercises every branch every time it's run.
- **Non-visual failure modes** — a React console warning (e.g. a controlled/
  uncontrolled input switch) or a swallowed network error doesn't show up
  just from looking at the screen; catching it requires checking the
  console, which a quick manual pass often skips.

**One-time setup (per machine):**

- `playwright` is a devDependency; browsers must be cached locally:
  `npx playwright install chromium`.
- Some minimal container base images are missing `libasound.so.2`, which
  Chromium's headless binary dynamically links even for headless-only runs.
  `scripts/setup-browser-verification.sh` downloads and extracts it locally
  (no root required) and prints the `LD_LIBRARY_PATH` export needed —
  `source` it (not just execute) before running any Playwright script:
  `source <(scripts/setup-browser-verification.sh)`.
- Local Supabase must be running (`supabase start`). Persistent test
  accounts already exist for this — `node scripts/seed-manual-test-users.mjs`
  is idempotent and safe to re-run; it will not recreate accounts that
  already exist. See that file for the current account list (one Admin, two
  RSMs in different regions, one Sector Manager — all password `Test1234!`).
- `scripts/playwright-helpers.mjs` exports `login(page, email)` and the base
  URL — import it from a throwaway per-feature driver script rather than
  re-deriving the login flow each time. Write that driver script somewhere
  inside the repo (e.g. `scripts/.tmp-verify.mjs`, gitignored) — Node's ESM
  resolver needs the importing file to be inside the repo tree to find
  `node_modules/playwright`. Delete the driver script once you're done; it's
  throwaway per feature, not a persistent artifact.
- The same file also exports diagnostic-capture helpers for passes that need
  to prove *absence* of a problem, not just walk a happy path:
  `attachDiagnostics(page)` wires `console` (warnings/errors only),
  `pageerror`, `requestfailed`, and non-2xx `response` listeners and returns
  an accumulator object (`{ consoleMessages, pageErrors, failedRequests }`)
  a driver script can inspect or dump at the end of a flow.
  `screenshotStep(page, outDir, stepName)` saves a numbered, viewport-only
  PNG (never `fullPage: true` — see the Select popup gotcha below) into
  `outDir`, creating it if needed. `writeFlowReport(outDir, flowName, report)`
  writes a JSON summary so the evidence persists after the throwaway driver
  script that produced it is deleted — call this if the verification pass
  needs to leave a record behind (e.g. a future UX/product review), not for
  an ordinary one-off bug-hunting pass where the terminal output is enough.

**Base UI Select gotchas** (`components/ui/select.tsx` wraps
`@base-ui/react/select`, not Radix — worth knowing since Base UI's behavior
differs from the Radix conventions most examples assume):

- A full-page screenshot (`{ fullPage: true }`) while a Select popup is open
  closes it — the popup is anchored via floating-ui and reacts to the
  scroll/reflow a full-page capture triggers. Use viewport-only screenshots
  around open popups.
- `[role="option"]` matches items belonging to *every* Select on the page,
  not just the currently open one — Base UI appears to keep closed Selects'
  items mounted-but-hidden in the DOM to pre-register their labels for
  display. Scope option locators with `:visible`
  (`page.locator('[role="option"]:visible')`), or use
  `openOption(page)` from `playwright-helpers.mjs`.
- A controlled Select's `value` prop must not be `undefined` on the first
  render if it will hold a real value later — going from `undefined` to a
  string trips React's "switching from uncontrolled to controlled" warning.
  Default nullable fields to `null`, not `undefined`, and coerce at the JSX
  call site (`value={field.value ?? null}`) rather than relying on React
  Hook Form's `defaultValues` alone.
