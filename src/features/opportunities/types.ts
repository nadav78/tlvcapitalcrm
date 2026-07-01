import type { Currency } from '@/lib/constants'

export type LeadSource = 'cold_outreach' | 'partner' | 'inbound' | 'diplomatic' | 'marketing'
export type BudgetStatus = 'not_yet_secured' | 'secured'
export type MndaStatus = 'not_required' | 'pending' | 'sent' | 'signed'
export type OrgType =
  | 'ministry_of_defense'
  | 'defense_agency'
  | 'intelligence'
  | 'police_hls'
  | 'government'
  | 'private'
  | 'other'

export interface Opportunity {
  id: string
  rsm_id: string
  region_id: string
  stage_id: string
  requirement_type: string
  sector_id: string
  description: string
  prospect_company_name: string
  prospect_organization_type: OrgType | null
  country: string
  prospect_website: string | null
  prospect_contact_name: string | null
  prospect_contact_email: string | null
  prospect_contact_phone: string | null
  lead_source: LeadSource
  advisor_id: string | null
  registration_date: string
  estimated_value: number | null
  currency: Currency | null
  budget_status: BudgetStatus | null
  probability_pct: number | null
  expected_close_date: string | null
  special_license_required: boolean
  next_step: string | null
  is_at_risk: boolean
  last_activity_at: string | null
  client_id: string | null
  created_at: string
  updated_at: string
  // Joined data from select()
  stage?: { id: string; name: string; is_won: boolean; is_lost: boolean; display_order: number }
  rsm?: { full_name: string }
  sector?: { name: string }
  region?: { name: string }
  advisor?: { name: string }
}

export interface OpportunityProduct {
  id: string
  opportunity_id: string
  product_id: string | null
  product_name_freetext: string | null
  quantity: number
  partner_contact_name: string | null
  partner_contact_email: string | null
  partner_contact_phone: string | null
  partner_mnda_status: MndaStatus | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  product?: { name: string; manufacturer?: { name: string } }
}

export interface PipelineStage {
  id: string
  name: string
  display_order: number
  is_won: boolean
  is_lost: boolean
  is_active: boolean
}

export interface Sector {
  id: string
  name: string
}

export interface CloseDealInput {
  contract_value: number
  currency: Currency
  signed_date: string
  expected_delivery_date: string
}

export interface CloseDealPreview {
  existingClient: { id: string; name: string } | null
  willCreateContact: boolean
  preWinContacts: { id: string; full_name: string }[]
}
