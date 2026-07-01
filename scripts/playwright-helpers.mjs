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

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

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

// Wires console/pageerror/network-failure listeners onto a page and
// accumulates them into a plain object a driver script can inspect or dump
// to JSON at the end of a flow. Call once per page, before navigating.
export function attachDiagnostics(page) {
  const diagnostics = {
    consoleMessages: [],
    pageErrors: [],
    failedRequests: [],
  }

  page.on('console', (msg) => {
    const type = msg.type()
    if (type === 'warning' || type === 'error') {
      diagnostics.consoleMessages.push({ type, text: msg.text(), url: page.url() })
    }
  })

  page.on('pageerror', (err) => {
    diagnostics.pageErrors.push({ message: err.message, url: page.url() })
  })

  page.on('requestfailed', (request) => {
    diagnostics.failedRequests.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText ?? 'unknown',
    })
  })

  page.on('response', (response) => {
    if (response.status() >= 400) {
      diagnostics.failedRequests.push({
        url: response.url(),
        method: response.request().method(),
        failure: `HTTP ${response.status()}`,
      })
    }
  })

  return diagnostics
}

// Saves a numbered, viewport-only screenshot into outDir (created if
// missing) and returns the file path. Viewport-only (not fullPage) because a
// full-page capture reflows the page and closes any open Base UI Select
// popup — see the Select gotchas below.
let stepCounter = 0
export async function screenshotStep(page, outDir, stepName) {
  await mkdir(outDir, { recursive: true })
  stepCounter += 1
  const fileName = `${String(stepCounter).padStart(2, '0')}-${stepName.replace(/[^a-z0-9-]+/gi, '-')}.png`
  const filePath = join(outDir, fileName)
  await page.screenshot({ path: filePath, fullPage: false })
  return filePath
}

// Writes a per-flow JSON summary (diagnostics + screenshot paths) into
// outDir so evidence persists after the throwaway driver script that
// produced it is deleted.
export async function writeFlowReport(outDir, flowName, report) {
  await mkdir(outDir, { recursive: true })
  const filePath = join(outDir, `${flowName.replace(/[^a-z0-9-]+/gi, '-')}.json`)
  await writeFile(filePath, JSON.stringify(report, null, 2))
  return filePath
}
