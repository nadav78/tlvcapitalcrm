'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth'
import { escapeIlikePattern } from '@/lib/utils'
import {
  opportunityRegisterSchema,
  opportunitySchema,
  closeDealSchema,
  type OpportunityRegisterValues,
  type OpportunityValues,
  type CloseDealValues,
} from './schemas'

// ── createOpportunity ────────────────────────────────────────────────────────

export async function createOpportunity(input: OpportunityRegisterValues) {
  const parsed = opportunityRegisterSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten() }

  const profile = await getUserProfile()
  if (!profile || !profile.is_active) return { error: 'Unauthorized' }
  if (profile.role === 'sector_manager') return { error: 'Sector Managers cannot create opportunities' }

  // RSM can only create in their own region
  if (profile.role === 'rsm' && parsed.data.region_id !== profile.region_id) {
    return { error: 'RSM can only create opportunities in their own region' }
  }

  const supabase = await createClient()

  // Admin can assign any RSM, but the submitted rsm_id/region_id pair is
  // client-derived — re-verify server-side that the target is an active RSM
  // and that region_id actually matches their assigned region, the same
  // check reassignOpportunity performs before writing a cross-region change.
  if (profile.role === 'admin') {
    const { data: targetRsm, error: rsmError } = await supabase
      .from('users')
      .select('id, role, region_id, is_active')
      .eq('id', parsed.data.rsm_id)
      .single()

    if (rsmError || !targetRsm) return { error: 'RSM not found' }
    if (targetRsm.role !== 'rsm' || !targetRsm.is_active) return { error: 'Target user is not an active RSM' }
    if (targetRsm.region_id !== parsed.data.region_id) return { error: 'region_id does not match the selected RSM' }
  }

  const { data, error } = await supabase
    .from('opportunities')
    .insert({
      ...parsed.data,
      // RSM must be the owner when an RSM creates; admin can specify any rsm_id
      rsm_id: profile.role === 'rsm' ? profile.id : parsed.data.rsm_id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { success: true, id: data.id }
}

// ── updateOpportunity ────────────────────────────────────────────────────────

export async function updateOpportunity(opportunityId: string, input: OpportunityValues) {
  const parsed = opportunitySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten() }

  const profile = await getUserProfile()
  if (!profile || !profile.is_active) return { error: 'Unauthorized' }
  if (profile.role === 'sector_manager') return { error: 'Sector Managers cannot edit opportunities' }

  const supabase = await createClient()

  // Verify the row exists and RLS allows access before updating
  const { data: existing, error: fetchError } = await supabase
    .from('opportunities')
    .select('id, rsm_id, region_id')
    .eq('id', opportunityId)
    .single()

  if (fetchError || !existing) return { error: 'Opportunity not found or access denied' }

  // RSM can only edit their own opportunities
  if (profile.role === 'rsm' && existing.rsm_id !== profile.id) {
    return { error: 'Access denied' }
  }

  const { error } = await supabase
    .from('opportunities')
    .update({
      ...parsed.data,
      // Prevent RSM from changing ownership/region via the edit form
      rsm_id: existing.rsm_id,
      region_id: existing.region_id,
    })
    .eq('id', opportunityId)

  if (error) return { error: error.message }
  return { success: true }
}

// ── updateOpportunityStage ───────────────────────────────────────────────────
// Does NOT handle the Won stage — that goes through closeOpportunity.

export async function updateOpportunityStage(opportunityId: string, stageId: string) {
  const profile = await getUserProfile()
  if (!profile || !profile.is_active) return { error: 'Unauthorized' }
  if (profile.role === 'sector_manager') return { error: 'Sector Managers cannot edit opportunities' }

  const supabase = await createClient()

  // Block the Won stage — RSM must use closeOpportunity
  const { data: stage, error: stageError } = await supabase
    .from('pipeline_stages')
    .select('is_won, is_lost')
    .eq('id', stageId)
    .single()

  if (stageError || !stage) return { error: 'Stage not found' }
  if (stage.is_won) return { error: 'Use closeOpportunity to mark an opportunity as Won' }

  // Verify RSM access
  const { data: existing } = await supabase
    .from('opportunities')
    .select('id, rsm_id, stage_id')
    .eq('id', opportunityId)
    .single()

  if (!existing) return { error: 'Opportunity not found or access denied' }
  if (profile.role === 'rsm' && existing.rsm_id !== profile.id) {
    return { error: 'Access denied' }
  }

  // Guard re-staging from Won/Lost — require the confirmation flow
  const { data: currentStage, error: currentStageError } = await supabase
    .from('pipeline_stages')
    .select('is_won, is_lost')
    .eq('id', existing.stage_id)
    .single()

  if (currentStageError || !currentStage) return { error: 'Current stage not found' }
  if (currentStage.is_won || currentStage.is_lost) {
    return { error: 'use_reopen_flow' }
  }

  const { error } = await supabase
    .from('opportunities')
    .update({ stage_id: stageId })
    .eq('id', opportunityId)

  if (error) return { error: error.message }
  return { success: true }
}

// ── updateOpportunityField ────────────────────────────────────────────────────
// Lightweight patch for high-frequency inline edits (next_step, is_at_risk).

export async function updateOpportunityField({
  opportunityId,
  field,
  value,
}: {
  opportunityId: string
  field: 'next_step'
  value: string
} | {
  opportunityId: string
  field: 'is_at_risk'
  value: boolean
}) {
  const profile = await getUserProfile()
  if (!profile || !profile.is_active) return { error: 'Unauthorized' }
  if (profile.role === 'sector_manager') return { error: 'Sector Managers cannot edit opportunities' }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('opportunities')
    .select('id, rsm_id')
    .eq('id', opportunityId)
    .single()

  if (!existing) return { error: 'Opportunity not found or access denied' }
  if (profile.role === 'rsm' && existing.rsm_id !== profile.id) {
    return { error: 'Access denied' }
  }

  const patch = field === 'next_step'
    ? { next_step: value as string }
    : { is_at_risk: value as boolean }

  const { error } = await supabase
    .from('opportunities')
    .update(patch)
    .eq('id', opportunityId)

  if (error) return { error: error.message }
  return { success: true }
}

// ── closeOpportunity ─────────────────────────────────────────────────────────
// The "Won" action. Atomically:
//   1. Find or create Client (case-insensitive name match in same region)
//   2. Create Contract
//   3. Optionally create Contact from prospect fields
//   4. Link pre-Win contacts (opportunity_id only → set client_id)
//   5. Update opportunity stage_id + client_id

export async function closeOpportunity(
  opportunityId: string,
  contractInput: CloseDealValues,
) {
  const parsed = closeDealSchema.safeParse(contractInput)
  if (!parsed.success) return { error: parsed.error.flatten() }

  const profile = await getUserProfile()
  if (!profile || !profile.is_active) return { error: 'Unauthorized' }
  if (profile.role === 'sector_manager') return { error: 'Sector Managers cannot close opportunities' }

  // Use service client to read the opportunity (RLS check happens via profile)
  const svc = createServiceClient()
  const { data: opp, error: oppError } = await svc
    .from('opportunities')
    .select('id, rsm_id, region_id, prospect_company_name, prospect_organization_type, country, prospect_website, prospect_contact_name, prospect_contact_email, prospect_contact_phone')
    .eq('id', opportunityId)
    .single()

  if (oppError || !opp) return { error: 'Opportunity not found' }

  // Authorization: only the owning RSM or an Admin can close
  if (profile.role === 'rsm' && opp.rsm_id !== profile.id) {
    return { error: 'Access denied' }
  }

  // Fetch the Won stage
  const { data: wonStage } = await svc
    .from('pipeline_stages')
    .select('id')
    .eq('is_won', true)
    .single()

  if (!wonStage) return { error: 'Won stage is not configured' }

  // 1. Find or create Client — case-insensitive name match in same region
  const { data: existingClients } = await svc
    .from('clients')
    .select('id')
    .eq('region_id', opp.region_id)
    .ilike('name', escapeIlikePattern(opp.prospect_company_name))
    .limit(1)

  let clientId: string

  if (existingClients && existingClients.length > 0) {
    clientId = existingClients[0].id
  } else {
    const { data: newClient, error: clientError } = await svc
      .from('clients')
      .insert({
        name: opp.prospect_company_name,
        country: opp.country,
        region_id: opp.region_id,
        organization_type: opp.prospect_organization_type ?? null,
        website: opp.prospect_website ?? null,
        status: 'active',
      })
      .select('id')
      .single()

    if (clientError || !newClient) {
      return { error: clientError?.message ?? 'Failed to create client' }
    }
    clientId = newClient.id
  }

  // 2. Create Contract — idempotency check prevents a duplicate on retry if the
  // opportunity UPDATE below fails after the contract was already inserted.
  const { data: existingContracts } = await svc
    .from('contracts')
    .select('id')
    .eq('opportunity_id', opportunityId)
    .limit(1)

  if (!existingContracts || existingContracts.length === 0) {
    const { error: contractError } = await svc.from('contracts').insert({
      opportunity_id: opportunityId,
      client_id: clientId,
      contract_value: parsed.data.contract_value,
      currency: parsed.data.currency,
      signed_date: parsed.data.signed_date,
      expected_delivery_date: parsed.data.expected_delivery_date,
    })
    if (contractError) return { error: contractError.message }
  }

  // 3. Create Contact from prospect fields (if name is provided)
  if (opp.prospect_contact_name) {
    // Avoid duplicating a contact with the same email at this client
    const { data: existingContact } = opp.prospect_contact_email
      ? await svc
          .from('contacts')
          .select('id')
          .eq('client_id', clientId)
          .ilike('email', escapeIlikePattern(opp.prospect_contact_email))
          .single()
      : { data: null }

    if (!existingContact) {
      // Only mark is_primary if the client has no primary contact yet
      // (second win for the same client would violate the partial unique index)
      const { data: existingPrimary } = await svc
        .from('contacts')
        .select('id')
        .eq('client_id', clientId)
        .eq('is_primary', true)
        .limit(1)
        .maybeSingle()

      const { error: contactError } = await svc.from('contacts').insert({
        client_id: clientId,
        opportunity_id: opportunityId,
        full_name: opp.prospect_contact_name,
        email: opp.prospect_contact_email ?? null,
        phone: opp.prospect_contact_phone ?? null,
        is_primary: !existingPrimary,
      })
      if (contactError) return { error: contactError.message }
    }
  }

  // 4. Link pre-Win contacts (those with opportunity_id set but client_id still null)
  await svc
    .from('contacts')
    .update({ client_id: clientId })
    .eq('opportunity_id', opportunityId)
    .is('client_id', null)

  // 5. Update the opportunity: set Won stage + client_id
  const { error: updateError } = await svc
    .from('opportunities')
    .update({ stage_id: wonStage.id, client_id: clientId })
    .eq('id', opportunityId)

  if (updateError) return { error: updateError.message }

  return { success: true, clientId }
}

// ── reassignOpportunity ───────────────────────────────────────────────────────
// Admin-only. Updates both rsm_id and region_id atomically (both must change
// together — region_id is what RLS uses to filter RSM access).

export async function reassignOpportunity(opportunityId: string, newRsmId: string) {
  const profile = await getUserProfile()
  if (!profile || !profile.is_active) return { error: 'Unauthorized' }
  if (profile.role !== 'admin') return { error: 'Only admins can reassign opportunities' }

  const svc = createServiceClient()

  // Get the new RSM's region
  const { data: newRsm, error: rsmError } = await svc
    .from('users')
    .select('id, region_id, role')
    .eq('id', newRsmId)
    .single()

  if (rsmError || !newRsm) return { error: 'RSM not found' }
  if (newRsm.role !== 'rsm') return { error: 'Target user is not an RSM' }
  if (!newRsm.region_id) return { error: 'Target RSM has no assigned region' }

  const { error } = await svc
    .from('opportunities')
    .update({ rsm_id: newRsmId, region_id: newRsm.region_id })
    .eq('id', opportunityId)

  if (error) return { error: error.message }
  return { success: true }
}
