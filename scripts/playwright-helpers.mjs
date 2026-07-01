// Shared helpers for ad hoc Playwright verification scripts. See
// docs/ARCHITECTURE.md's "Scripted Browser Verification" section for when to
// reach for a scripted pass vs. clicking through the app by hand, and
// scripts/seed-manual-test-users.mjs for the accounts referenced below.
//
// These scripts are throwaway per feature — write one, import this module
// for the boilerplate, delete the script when done. This file itself is the
// only part meant to be reused across sessions.
//
// Place the throwaway script somewhere inside this repo (e.g.
// scripts/.tmp-verify.mjs) rather than /tmp or another external scratch
// directory — Node's ESM resolver walks up from the *importing file's* own
// path to find node_modules, so a script outside the repo tree can't resolve
// `playwright` (or this helper) even with the dependency installed correctly.

export const BASE_URL = process.env.APP_URL ?? 'http://localhost:3000'
export const MANUAL_TEST_PASSWORD = 'Test1234!'

export async function login(page, email) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('#email', email)
  await page.fill('#password', MANUAL_TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
}

// Base UI (components/ui/select.tsx uses @base-ui/react/select, not Radix)
// keeps closed Selects' items mounted-but-hidden in the DOM to pre-register
// their labels, so a bare `[role="option"]` locator can match an item that
// belongs to a different, still-closed Select on the same page. Scope to
// :visible so it only ever matches the currently open dropdown.
export function openOption(page) {
  return page.locator('[role="option"]:visible')
}
