// Idempotent — safe to re-run. Creates persistent local-Supabase accounts for
// manual and scripted browser verification (see docs/ARCHITECTURE.md's
// "Scripted Browser Verification" section). Not used by the automated test
// suite (features/*/actions.test.ts creates and tears down its own
// short-lived users) — these are meant to stay around across sessions.
//
// Usage: node scripts/seed-manual-test-users.mjs
// Requires: supabase start

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
// Fixed local-only demo service role key baked into every `supabase start`
// instance — same key already hardcoded in features/opportunities/actions.test.ts.
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const client = createClient(SUPABASE_URL, SERVICE_KEY, { realtime: { transport: ws } })

export const MANUAL_TEST_PASSWORD = 'Test1234!'

export const MANUAL_TEST_USERS = [
  { email: 'manual-admin@test.local', full_name: 'Manual Admin', role: 'admin', region: null },
  { email: 'manual-rsm@test.local', full_name: 'Manual RSM', role: 'rsm', region: 'Baltics' },
  { email: 'manual-rsm2@test.local', full_name: 'Manual RSM Two', role: 'rsm', region: 'Nordics' },
  { email: 'manual-sm@test.local', full_name: 'Manual Sector Manager', role: 'sector_manager', region: null },
]

async function ensureUser({ email, full_name, role, region }) {
  const { data: existing } = await client.from('users').select('id').eq('email', email).maybeSingle()
  if (existing) {
    console.log(`${email} already exists (${existing.id})`)
    return existing.id
  }

  const { data, error } = await client.auth.admin.createUser({
    email,
    password: MANUAL_TEST_PASSWORD,
    email_confirm: true,
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  const id = data.user.id

  let region_id = null
  if (region) {
    const { data: regionRow, error: regionError } = await client
      .from('regions')
      .select('id')
      .eq('name', region)
      .single()
    if (regionError) throw new Error(`region lookup "${region}": ${regionError.message}`)
    region_id = regionRow.id
  }

  const { error: insertError } = await client.from('users').insert({ id, email, full_name, role, region_id })
  if (insertError) throw new Error(`insert users row for ${email}: ${insertError.message}`)

  console.log(`created ${email} (${id})`)
  return id
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const user of MANUAL_TEST_USERS) {
    await ensureUser(user)
  }
  console.log('done')
}
