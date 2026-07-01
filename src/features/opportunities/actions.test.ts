/**
 * Server Action integration tests.
 * Runs against a real local Supabase instance (supabase start).
 * lib/supabase/server is mocked to return a real @supabase/supabase-js client
 * authenticated as a specific test user — so RLS still applies and the real
 * database is used. Only the Next.js cookie-based session plumbing is bypassed.
 */

import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

// ws satisfies Node's WebSocket API but its constructor signature diverges from
// Supabase's WebSocketLikeConstructor — cast required for Node test environments.
const clientOptions = { realtime: { transport: ws as unknown as typeof WebSocket } }
const serviceClient = createSupabaseClient(SUPABASE_URL, SERVICE_KEY, clientOptions)

// ── Active client slot — swapped per role in each test block ─────────────────
let activeClient: SupabaseClient = serviceClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => activeClient,
  createServiceClient: () => createSupabaseClient(SUPABASE_URL, SERVICE_KEY, clientOptions),
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PASS = 'Test1234!'
let regionAId: string
let regionBId: string
let sectorId: string
let stageId: string
let wonStageId: string
let advisorId: string
let rsmAUserId: string
let rsmBUserId: string
let adminUserId: string
let rsmAClient: SupabaseClient
let rsmBClient: SupabaseClient
let adminClient: SupabaseClient

async function createAuthUser(email: string): Promise<string> {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password: PASS,
    email_confirm: true,
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  return data.user.id
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createSupabaseClient(SUPABASE_URL, ANON_KEY, clientOptions)
  const { error } = await client.auth.signInWithPassword({ email, password: PASS })
  if (error) throw new Error(`signIn ${email}: ${error.message}`)
  return client
}

beforeAll(async () => {
  // Regions
  const { data: regions } = await serviceClient
    .from('regions')
    .insert([{ name: 'Actions_Test_A' }, { name: 'Actions_Test_B' }])
    .select('id, name')
  regionAId = regions!.find((r) => r.name === 'Actions_Test_A')!.id
  regionBId = regions!.find((r) => r.name === 'Actions_Test_B')!.id

  // Sector
  const { data: sectors } = await serviceClient
    .from('sectors')
    .insert([{ name: 'Actions_Test_Sector' }])
    .select('id')
  sectorId = sectors![0].id

  // Advisor
  const { data: advisors } = await serviceClient
    .from('advisors')
    .insert([{ name: 'Actions_Test_Advisor' }])
    .select('id')
  advisorId = advisors![0].id

  // Stages — get the real ones from seed data
  const { data: stages } = await serviceClient
    .from('pipeline_stages')
    .select('id, is_won, is_lost')
    .eq('is_active', true)
  stageId = stages!.find((s) => !s.is_won && !s.is_lost)!.id
  wonStageId = stages!.find((s) => s.is_won)!.id

  // Auth users
  rsmAUserId  = await createAuthUser('actions-rsm-a@test.local')
  rsmBUserId  = await createAuthUser('actions-rsm-b@test.local')
  adminUserId = await createAuthUser('actions-admin@test.local')

  // public.users rows
  await serviceClient.from('users').insert([
    { id: rsmAUserId,  email: 'actions-rsm-a@test.local',  full_name: 'RSM A', role: 'rsm',   region_id: regionAId },
    { id: rsmBUserId,  email: 'actions-rsm-b@test.local',  full_name: 'RSM B', role: 'rsm',   region_id: regionBId },
    { id: adminUserId, email: 'actions-admin@test.local',   full_name: 'Admin', role: 'admin', region_id: null },
  ])

  // Authenticated clients
  rsmAClient  = await signInAs('actions-rsm-a@test.local')
  rsmBClient  = await signInAs('actions-rsm-b@test.local')
  adminClient = await signInAs('actions-admin@test.local')
})

afterAll(async () => {
  // Delete test data (cascade handles related rows)
  await serviceClient.from('contracts').delete().in('opportunity_id',
    (await serviceClient.from('opportunities').select('id').eq('region_id', regionAId)).data?.map(o => o.id) ?? []
  )
  await serviceClient.from('opportunities').delete().eq('region_id', regionAId)
  await serviceClient.from('opportunities').delete().eq('region_id', regionBId)
  await serviceClient.from('clients').delete().eq('region_id', regionAId)
  await serviceClient.from('clients').delete().eq('region_id', regionBId)
  await serviceClient.from('users').delete().in('id', [rsmAUserId, rsmBUserId, adminUserId])
  await serviceClient.auth.admin.deleteUser(rsmAUserId)
  await serviceClient.auth.admin.deleteUser(rsmBUserId)
  await serviceClient.auth.admin.deleteUser(adminUserId)
  await serviceClient.from('regions').delete().in('name', ['Actions_Test_A', 'Actions_Test_B'])
  await serviceClient.from('sectors').delete().eq('name', 'Actions_Test_Sector')
  await serviceClient.from('advisors').delete().eq('name', 'Actions_Test_Advisor')
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseOpportunity() {
  return {
    rsm_id: rsmAUserId,
    region_id: regionAId,
    country: 'Israel',
    stage_id: stageId,
    requirement_type: 'C-UAS',
    sector_id: sectorId,
    description: 'Counter-drone border protection',
    prospect_company_name: `TestCo-${Date.now()}`,
    lead_source: 'partner' as const,
    registration_date: '2026-01-15',
  }
}

// ── createOpportunity ────────────────────────────────────────────────────────

describe('createOpportunity', () => {
  it('RSM creates opportunity in their own region → success + row in DB', async () => {
    activeClient = rsmAClient
    const { createOpportunity } = await import('./actions')
    const input = baseOpportunity()

    const result = await createOpportunity(input)

    expect(result.success).toBe(true)
    expect(result.id).toBeDefined()

    const { data } = await serviceClient
      .from('opportunities')
      .select('id, prospect_company_name, rsm_id, region_id')
      .eq('id', result.id!)
      .single()

    expect(data?.prospect_company_name).toBe(input.prospect_company_name)
    expect(data?.rsm_id).toBe(rsmAUserId)
    expect(data?.region_id).toBe(regionAId)
  })

  it('RSM cannot create opportunity in another region → error', async () => {
    activeClient = rsmAClient
    const { createOpportunity } = await import('./actions')

    const result = await createOpportunity({
      ...baseOpportunity(),
      region_id: regionBId, // different region
    })

    expect(result.error).toBeDefined()
    expect(result.success).toBeUndefined()
  })

  it('invalid input (missing prospect_company_name) → validation error', async () => {
    activeClient = rsmAClient
    const { createOpportunity } = await import('./actions')

    const result = await createOpportunity({
      ...baseOpportunity(),
      prospect_company_name: '',
    })

    expect(result.error).toBeDefined()
    expect(result.success).toBeUndefined()
  })

  it('Admin can create opportunity on behalf of RSM A', async () => {
    activeClient = adminClient
    const { createOpportunity } = await import('./actions')
    const input = baseOpportunity()

    const result = await createOpportunity(input)

    expect(result.success).toBe(true)
    expect(result.id).toBeDefined()
  })

  it('Admin submitting a region_id that does not match the chosen RSM → error', async () => {
    activeClient = adminClient
    const { createOpportunity } = await import('./actions')

    const result = await createOpportunity({
      ...baseOpportunity(),
      rsm_id: rsmAUserId,
      region_id: regionBId, // RSM A is in region A, not B
    })

    expect(result.error).toBeDefined()
    expect(result.success).toBeUndefined()
  })

  it('Admin submitting an rsm_id that is not an RSM → error', async () => {
    activeClient = adminClient
    const { createOpportunity } = await import('./actions')

    const result = await createOpportunity({
      ...baseOpportunity(),
      rsm_id: adminUserId, // not an rsm-role user
      region_id: regionAId,
    })

    expect(result.error).toBeDefined()
    expect(result.success).toBeUndefined()
  })
})

// ── updateOpportunity ────────────────────────────────────────────────────────

describe('updateOpportunity', () => {
  let opportunityId: string

  beforeAll(async () => {
    activeClient = rsmAClient
    const { createOpportunity } = await import('./actions')
    const result = await createOpportunity(baseOpportunity())
    opportunityId = result.id!
  })

  it('RSM updates their own opportunity → success + DB updated', async () => {
    activeClient = rsmAClient
    const { updateOpportunity } = await import('./actions')

    const result = await updateOpportunity(opportunityId, {
      ...baseOpportunity(),
      next_step: 'Send revised proposal',
      estimated_value: 1500000,
      currency: 'USD',
      probability_pct: 70,
    })

    expect(result.success).toBe(true)

    const { data } = await serviceClient
      .from('opportunities')
      .select('next_step, estimated_value, currency, probability_pct')
      .eq('id', opportunityId)
      .single()

    expect(data?.next_step).toBe('Send revised proposal')
    expect(data?.estimated_value).toBe(1500000)
    expect(data?.currency).toBe('USD')
    expect(data?.probability_pct).toBe(70)
  })

  it('RSM B cannot update RSM A opportunity → error (RLS blocks it)', async () => {
    activeClient = rsmBClient
    const { updateOpportunity } = await import('./actions')

    const result = await updateOpportunity(opportunityId, {
      ...baseOpportunity(),
      next_step: 'Hijacked',
    })

    expect(result.error).toBeDefined()
  })
})

// ── updateOpportunityStage ───────────────────────────────────────────────────

describe('updateOpportunityStage', () => {
  let opportunityId: string

  beforeAll(async () => {
    activeClient = rsmAClient
    const { createOpportunity } = await import('./actions')
    const result = await createOpportunity(baseOpportunity())
    opportunityId = result.id!
  })

  it('updates stage to a non-Won stage → success', async () => {
    activeClient = rsmAClient
    const { updateOpportunityStage } = await import('./actions')

    // Get "Qualified" stage
    const { data: qualified } = await serviceClient
      .from('pipeline_stages')
      .select('id')
      .eq('name', 'Qualified')
      .single()

    const result = await updateOpportunityStage(opportunityId, qualified!.id)

    expect(result.success).toBe(true)

    const { data } = await serviceClient
      .from('opportunities')
      .select('stage_id')
      .eq('id', opportunityId)
      .single()

    expect(data?.stage_id).toBe(qualified!.id)
  })

  it('trying to set Won stage directly → error (must use closeOpportunity)', async () => {
    activeClient = rsmAClient
    const { updateOpportunityStage } = await import('./actions')

    const result = await updateOpportunityStage(opportunityId, wonStageId)

    expect(result.error).toBeDefined()
  })
})

// ── closeOpportunity ─────────────────────────────────────────────────────────

describe('closeOpportunity', () => {
  const closeDealInput = {
    contract_value: 2500000,
    currency: 'USD' as const,
    signed_date: '2026-06-30',
    expected_delivery_date: '2027-03-31',
  }

  it('closes opportunity → creates Client and Contract, sets stage to Won', async () => {
    activeClient = rsmAClient
    const { createOpportunity, closeOpportunity } = await import('./actions')

    const companyName = `CloseTest-${Date.now()}`
    const { id: oppId } = await createOpportunity({
      ...baseOpportunity(),
      prospect_company_name: companyName,
    })

    const result = await closeOpportunity(oppId!, closeDealInput)

    expect(result.success).toBe(true)
    expect(result.clientId).toBeDefined()

    // Opportunity stage should now be Won
    const { data: opp } = await serviceClient
      .from('opportunities')
      .select('stage_id, client_id')
      .eq('id', oppId!)
      .single()

    expect(opp?.stage_id).toBe(wonStageId)
    expect(opp?.client_id).toBe(result.clientId)

    // Client record should exist
    const { data: client } = await serviceClient
      .from('clients')
      .select('name, region_id')
      .eq('id', result.clientId!)
      .single()

    expect(client?.name).toBe(companyName)
    expect(client?.region_id).toBe(regionAId)

    // Contract should exist
    const { data: contracts } = await serviceClient
      .from('contracts')
      .select('contract_value, currency')
      .eq('opportunity_id', oppId!)

    expect(contracts).toHaveLength(1)
    expect(contracts![0].contract_value).toBe(2500000)
    expect(contracts![0].currency).toBe('USD')
  })

  it('closing against same company name links to existing client (no duplicate)', async () => {
    activeClient = rsmAClient
    const { createOpportunity, closeOpportunity } = await import('./actions')

    // First close — creates the client
    const companyName = `DedupTest-${Date.now()}`
    const { id: opp1Id } = await createOpportunity({
      ...baseOpportunity(),
      prospect_company_name: companyName,
    })
    const result1 = await closeOpportunity(opp1Id!, closeDealInput)
    expect(result1.success).toBe(true)
    const firstClientId = result1.clientId

    // Second opportunity — same company name, same region
    const { id: opp2Id } = await createOpportunity({
      ...baseOpportunity(),
      rsm_id: rsmAUserId,
      region_id: regionAId,
      prospect_company_name: companyName, // same name
    })
    const result2 = await closeOpportunity(opp2Id!, { ...closeDealInput, contract_value: 1000000 })
    expect(result2.success).toBe(true)

    // Should have linked to the SAME client, not created a new one
    expect(result2.clientId).toBe(firstClientId)

    // Only one client should exist with that name in the region
    const { data: clients } = await serviceClient
      .from('clients')
      .select('id')
      .eq('region_id', regionAId)
      .ilike('name', companyName)

    expect(clients).toHaveLength(1)
  })

  it('RSM B cannot close RSM A opportunity → error', async () => {
    activeClient = rsmAClient
    const { createOpportunity } = await import('./actions')
    const { id: oppId } = await createOpportunity(baseOpportunity())

    activeClient = rsmBClient
    const { closeOpportunity } = await import('./actions')
    const result = await closeOpportunity(oppId!, closeDealInput)

    expect(result.error).toBeDefined()
  })

  it('invalid contract input → validation error, no DB changes', async () => {
    activeClient = rsmAClient
    const { createOpportunity, closeOpportunity } = await import('./actions')
    const { id: oppId } = await createOpportunity(baseOpportunity())

    const result = await closeOpportunity(oppId!, {
      ...closeDealInput,
      contract_value: 0, // invalid
    })

    expect(result.error).toBeDefined()

    // Opportunity should still be in original stage
    const { data: opp } = await serviceClient
      .from('opportunities')
      .select('stage_id')
      .eq('id', oppId!)
      .single()

    expect(opp?.stage_id).toBe(stageId)
  })
})

// ── updateOpportunityField ────────────────────────────────────────────────────

describe('updateOpportunityField', () => {
  let opportunityId: string

  beforeAll(async () => {
    activeClient = rsmAClient
    const { createOpportunity } = await import('./actions')
    const result = await createOpportunity(baseOpportunity())
    opportunityId = result.id!
  })

  it('updates next_step field → success', async () => {
    activeClient = rsmAClient
    const { updateOpportunityField } = await import('./actions')

    const result = await updateOpportunityField({
      opportunityId,
      field: 'next_step',
      value: 'Follow up with procurement team',
    })

    expect(result.success).toBe(true)

    const { data } = await serviceClient
      .from('opportunities')
      .select('next_step')
      .eq('id', opportunityId)
      .single()

    expect(data?.next_step).toBe('Follow up with procurement team')
  })

  it('RSM B cannot update RSM A field → error', async () => {
    activeClient = rsmBClient
    const { updateOpportunityField } = await import('./actions')

    const result = await updateOpportunityField({
      opportunityId,
      field: 'next_step',
      value: 'Hijacked',
    })

    expect(result.error).toBeDefined()
  })
})
