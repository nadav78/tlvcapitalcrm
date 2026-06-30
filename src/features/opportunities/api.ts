import { createClient } from '@/lib/supabase/client'
import type { Opportunity, OpportunityProduct, PipelineStage } from './types'

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

  if (!options?.includeWonLost) {
    // Exclude Won and Lost by default
    const { data: terminalStages } = await supabase
      .from('pipeline_stages')
      .select('id')
      .or('is_won.eq.true,is_lost.eq.true')
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
  return (data ?? []) as Opportunity[]
}

export async function getOpportunityById(id: string): Promise<Opportunity | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('opportunities')
    .select(OPPORTUNITY_SELECT)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Opportunity | null
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
  return (data ?? []) as OpportunityProduct[]
}

export async function getPipelineStages(): Promise<PipelineStage[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('id, name, display_order, is_won, is_lost, is_active')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as PipelineStage[]
}

export async function getStaleOpportunities(daysSinceActivity = 30): Promise<Opportunity[]> {
  const supabase = createClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysSinceActivity)

  const { data: terminalStages } = await supabase
    .from('pipeline_stages')
    .select('id')
    .or('is_won.eq.true,is_lost.eq.true')
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
  return (data ?? []) as Opportunity[]
}
