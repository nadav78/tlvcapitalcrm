import { createClient } from '@/lib/supabase/client'
import { escapeIlikePattern } from '@/lib/utils'
import type {
  Opportunity,
  OpportunityProduct,
  PipelineStage,
  Sector,
  Advisor,
  RsmUser,
  CloseDealPreview,
} from './types'

// Select fragment shared across list and detail queries
const OPPORTUNITY_SELECT = `
  id, rsm_id, region_id, stage_id, requirement_type, sector_id, description,
  prospect_company_name, prospect_organization_type, country, prospect_website,
  prospect_contact_name, prospect_contact_email, prospect_contact_phone,
  lead_source, advisor_id, registration_date, estimated_value, currency,
  budget_status, probability_pct, expected_close_date, special_license_required,
  next_step, is_at_risk, last_activity_at, client_id, created_at, updated_at,
  stage:pipeline_stages(id, name, is_won, is_lost, display_order),
  rsm:users!rsm_id(full_name),
  sector:sectors(name),
  region:regions(name),
  advisor:advisors(name)
`.trim()

export async function getOpportunities(options?: {
  includeWonLost?: boolean
  stageIds?: string[]
  atRiskOnly?: boolean
  sectorIds?: string[]
}): Promise<Opportunity[]> {
  const supabase = createClient()

  let query = supabase
    .from('opportunities')
    .select(OPPORTUNITY_SELECT)
    .order('updated_at', { ascending: false })

  if (!options?.includeWonLost && !options?.stageIds?.length) {
    // Exclude Won and Lost by default. Skip when stageIds is provided — the
    // caller has already specified exactly which stages they want, and adding
    // a NOT IN on top creates an impossible AND (e.g. stageIds:[wonId] → 0 rows).
    const { data: terminalStages, error: stagesError } = await supabase
      .from('pipeline_stages')
      .select('id')
      .or('is_won.eq.true,is_lost.eq.true')
    if (stagesError) throw stagesError
    const terminalIds = terminalStages?.map((s) => s.id) ?? []
    if (terminalIds.length > 0) {
      query = query.not('stage_id', 'in', `(${terminalIds.join(',')})`)
    }
  }

  if (options?.stageIds?.length) {
    query = query.in('stage_id', options.stageIds)
  }

  if (options?.atRiskOnly) {
    query = query.eq('is_at_risk', true)
  }

  if (options?.sectorIds?.length) {
    query = query.in('sector_id', options.sectorIds)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Opportunity[]
}

export async function getOpportunityById(id: string): Promise<Opportunity | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('opportunities')
    .select(OPPORTUNITY_SELECT)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as unknown as Opportunity | null
}

export async function getOpportunityProducts(opportunityId: string): Promise<OpportunityProduct[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('opportunity_products')
    .select(
      `id, opportunity_id, product_id, product_name_freetext, quantity,
       partner_contact_name, partner_contact_email, partner_contact_phone,
       partner_mnda_status, notes, created_at, updated_at,
       product:products(name, manufacturer:manufacturers(name))`,
    )
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as OpportunityProduct[]
}

export async function getPipelineStages(): Promise<PipelineStage[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('id, name, display_order, is_won, is_lost, is_default, is_active')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as PipelineStage[]
}

export async function getSectors(): Promise<Sector[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('sectors')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as Sector[]
}

export async function getAdvisors(): Promise<Advisor[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('advisors')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as Advisor[]
}

// Admin-only lookup for the "New Opportunity" RSM picker. RLS on `users`
// restricts reads to the caller's own row unless they're an Admin, so this
// is only meaningful (and only called) when the caller is an Admin.
export async function getRsmUsers(): Promise<RsmUser[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, region_id')
    .eq('role', 'rsm')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error) throw error
  return (data ?? []) as RsmUser[]
}

// Read-only mirror of the dedup checks closeOpportunity performs server-side —
// lets the Close Deal modal preview what will happen before the RSM confirms.
// RLS already permits reading clients/contacts in the caller's own region, so
// this uses the regular browser client, not the service role. This is
// best-effort UX only; closeOpportunity remains the authoritative source of
// truth re-validated at submit time.
export async function getCloseDealPreview(
  opportunity: Pick<
    Opportunity,
    'id' | 'region_id' | 'prospect_company_name' | 'prospect_contact_name' | 'prospect_contact_email'
  >,
): Promise<CloseDealPreview> {
  const supabase = createClient()

  // Client lookup and pre-Win contacts are independent of each other — run
  // them concurrently instead of sequentially.
  const [clientResult, preWinResult] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name')
      .eq('region_id', opportunity.region_id)
      .ilike('name', escapeIlikePattern(opportunity.prospect_company_name))
      .limit(1),
    supabase
      .from('contacts')
      .select('id, full_name')
      .eq('opportunity_id', opportunity.id)
      .is('client_id', null),
  ])
  if (clientResult.error) throw clientResult.error
  if (preWinResult.error) throw preWinResult.error

  const existingClient = clientResult.data?.[0] ?? null

  let willCreateContact = false
  if (opportunity.prospect_contact_name) {
    if (existingClient && opportunity.prospect_contact_email) {
      const { data: existingContact, error: contactError } = await supabase
        .from('contacts')
        .select('id')
        .eq('client_id', existingClient.id)
        .ilike('email', escapeIlikePattern(opportunity.prospect_contact_email))
        .maybeSingle()
      if (contactError) throw contactError
      willCreateContact = !existingContact
    } else {
      willCreateContact = true
    }
  }

  return {
    existingClient,
    willCreateContact,
    preWinContacts: preWinResult.data ?? [],
  }
}

export async function getStaleOpportunities(daysSinceActivity = 30): Promise<Opportunity[]> {
  const supabase = createClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysSinceActivity)

  const { data: terminalStages, error: stagesError } = await supabase
    .from('pipeline_stages')
    .select('id')
    .or('is_won.eq.true,is_lost.eq.true')
  if (stagesError) throw stagesError
  const terminalIds = terminalStages?.map((s) => s.id) ?? []

  let query = supabase
    .from('opportunities')
    .select(OPPORTUNITY_SELECT)
    .or(`last_activity_at.is.null,last_activity_at.lt.${cutoff.toISOString()}`)
    .order('last_activity_at', { ascending: true })

  if (terminalIds.length > 0) {
    query = query.not('stage_id', 'in', `(${terminalIds.join(',')})`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Opportunity[]
}
