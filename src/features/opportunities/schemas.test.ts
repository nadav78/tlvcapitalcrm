import { describe, it, expect } from 'vitest'
import {
  opportunityRegisterSchema,
  opportunitySchema,
  opportunityProductSchema,
  closeDealSchema,
} from './schemas'

// ── Shared valid base for opportunityRegisterSchema ──────────────────────────
// Using properly-formatted RFC 4122 v4 UUIDs (Zod v4 enforces version bits).

const validRegister = {
  rsm_id:     'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5',
  region_id:  'b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6',
  country: 'Israel',
  stage_id:   'c3d4e5f6-a7b8-4c9d-ae0f-1a2b3c4d5e6f',
  requirement_type: 'C-UAS',
  sector_id:  'd4e5f6a7-b8c9-4d0e-bf1a-2b3c4d5e6f7a',
  description: 'Counter-drone system for border protection',
  prospect_company_name: 'Meridian Defense Group',
  lead_source: 'partner' as const,
  registration_date: '2026-01-15',
}

// ── opportunityRegisterSchema ────────────────────────────────────────────────

describe('opportunityRegisterSchema', () => {
  it('accepts valid required fields', () => {
    const result = opportunityRegisterSchema.safeParse(validRegister)
    expect(result.success).toBe(true)
  })

  it('rejects missing required field: prospect_company_name', () => {
    const result = opportunityRegisterSchema.safeParse({
      ...validRegister,
      prospect_company_name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid uuid for rsm_id', () => {
    const result = opportunityRegisterSchema.safeParse({
      ...validRegister,
      rsm_id: 'not-a-valid-uuid-string',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid lead_source', () => {
    const result = opportunityRegisterSchema.safeParse({
      ...validRegister,
      lead_source: 'unknown_source',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid registration_date (wrong format)', () => {
    const result = opportunityRegisterSchema.safeParse({
      ...validRegister,
      registration_date: '15-01-2026',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all lead_source values', () => {
    const sources = ['cold_outreach', 'partner', 'inbound', 'diplomatic', 'marketing'] as const
    for (const lead_source of sources) {
      const result = opportunityRegisterSchema.safeParse({ ...validRegister, lead_source })
      expect(result.success, `lead_source=${lead_source}`).toBe(true)
    }
  })

  it('accepts valid optional: prospect_contact_email as empty string', () => {
    const result = opportunityRegisterSchema.safeParse({
      ...validRegister,
      prospect_contact_email: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email format for prospect_contact_email', () => {
    const result = opportunityRegisterSchema.safeParse({
      ...validRegister,
      prospect_contact_email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid email for prospect_contact_email', () => {
    const result = opportunityRegisterSchema.safeParse({
      ...validRegister,
      prospect_contact_email: 'jane@defense.mil',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty string for prospect_website', () => {
    const result = opportunityRegisterSchema.safeParse({
      ...validRegister,
      prospect_website: '',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null for advisor_id', () => {
    const result = opportunityRegisterSchema.safeParse({
      ...validRegister,
      advisor_id: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-uuid advisor_id', () => {
    const result = opportunityRegisterSchema.safeParse({
      ...validRegister,
      advisor_id: 'not-a-valid-uuid-string',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null prospect_organization_type', () => {
    const result = opportunityRegisterSchema.safeParse({
      ...validRegister,
      prospect_organization_type: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid prospect_organization_type', () => {
    const result = opportunityRegisterSchema.safeParse({
      ...validRegister,
      prospect_organization_type: 'unknown_type',
    })
    expect(result.success).toBe(false)
  })
})

// ── opportunitySchema (full edit form) ──────────────────────────────────────

describe('opportunitySchema', () => {
  it('accepts all register fields plus optional edit fields', () => {
    const result = opportunitySchema.safeParse({
      ...validRegister,
      estimated_value: 2500000,
      currency: 'USD',
      budget_status: 'secured',
      probability_pct: 65,
      expected_close_date: '2026-09-30',
      next_step: 'Send revised proposal by end of month',
      special_license_required: false,
      is_at_risk: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects estimated_value of 0 (must be positive)', () => {
    const result = opportunitySchema.safeParse({
      ...validRegister,
      estimated_value: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative estimated_value', () => {
    const result = opportunitySchema.safeParse({
      ...validRegister,
      estimated_value: -1000,
    })
    expect(result.success).toBe(false)
  })

  it('accepts null for estimated_value', () => {
    const result = opportunitySchema.safeParse({
      ...validRegister,
      estimated_value: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects probability_pct above 100', () => {
    const result = opportunitySchema.safeParse({
      ...validRegister,
      probability_pct: 101,
    })
    expect(result.success).toBe(false)
  })

  it('rejects probability_pct below 0', () => {
    const result = opportunitySchema.safeParse({
      ...validRegister,
      probability_pct: -1,
    })
    expect(result.success).toBe(false)
  })

  it('accepts probability_pct of 0 and 100', () => {
    for (const probability_pct of [0, 100]) {
      const result = opportunitySchema.safeParse({ ...validRegister, probability_pct })
      expect(result.success, `probability_pct=${probability_pct}`).toBe(true)
    }
  })

  it('rejects invalid currency', () => {
    const result = opportunitySchema.safeParse({
      ...validRegister,
      currency: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid currencies', () => {
    const currencies = ['USD', 'EUR', 'ILS', 'GBP', 'SGD'] as const
    for (const currency of currencies) {
      const result = opportunitySchema.safeParse({ ...validRegister, currency })
      expect(result.success, `currency=${currency}`).toBe(true)
    }
  })

  it('rejects invalid budget_status', () => {
    const result = opportunitySchema.safeParse({
      ...validRegister,
      budget_status: 'unknown',
    })
    expect(result.success).toBe(false)
  })
})

// ── opportunityProductSchema ─────────────────────────────────────────────────

describe('opportunityProductSchema', () => {
  it('accepts a catalog product line', () => {
    const result = opportunityProductSchema.safeParse({
      product_id: 'e5f6a7b8-c9d0-4e1f-af2a-3b4c5d6e7f8a',
      quantity: 2,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a free-text product line', () => {
    const result = opportunityProductSchema.safeParse({
      product_name_freetext: 'Custom radar unit',
      quantity: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects when both product_id and product_name_freetext are null/empty', () => {
    const result = opportunityProductSchema.safeParse({
      product_id: null,
      product_name_freetext: '',
      quantity: 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects quantity of 0', () => {
    const result = opportunityProductSchema.safeParse({
      product_id: 'e5f6a7b8-c9d0-4e1f-af2a-3b4c5d6e7f8a',
      quantity: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity', () => {
    const result = opportunityProductSchema.safeParse({
      product_id: 'e5f6a7b8-c9d0-4e1f-af2a-3b4c5d6e7f8a',
      quantity: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email for partner_contact_email', () => {
    const result = opportunityProductSchema.safeParse({
      product_id: 'e5f6a7b8-c9d0-4e1f-af2a-3b4c5d6e7f8a',
      quantity: 1,
      partner_contact_email: 'bad-email',
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty string for partner_contact_email', () => {
    const result = opportunityProductSchema.safeParse({
      product_id: 'e5f6a7b8-c9d0-4e1f-af2a-3b4c5d6e7f8a',
      quantity: 1,
      partner_contact_email: '',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all MNDA statuses', () => {
    const statuses = ['not_required', 'pending', 'sent', 'signed'] as const
    for (const partner_mnda_status of statuses) {
      const result = opportunityProductSchema.safeParse({
        product_id: 'e5f6a7b8-c9d0-4e1f-af2a-3b4c5d6e7f8a',
        quantity: 1,
        partner_mnda_status,
      })
      expect(result.success, `mnda_status=${partner_mnda_status}`).toBe(true)
    }
  })
})

// ── closeDealSchema ──────────────────────────────────────────────────────────

describe('closeDealSchema', () => {
  const validClose = {
    contract_value: 1500000,
    currency: 'USD' as const,
    signed_date: '2026-06-30',
    expected_delivery_date: '2027-03-31',
  }

  it('accepts valid close deal input', () => {
    const result = closeDealSchema.safeParse(validClose)
    expect(result.success).toBe(true)
  })

  it('rejects contract_value of 0', () => {
    const result = closeDealSchema.safeParse({ ...validClose, contract_value: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects missing signed_date', () => {
    const { signed_date: _, ...rest } = validClose
    const result = closeDealSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing expected_delivery_date', () => {
    const { expected_delivery_date: _, ...rest } = validClose
    const result = closeDealSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format for signed_date', () => {
    const result = closeDealSchema.safeParse({ ...validClose, signed_date: '30/06/2026' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid currency', () => {
    const result = closeDealSchema.safeParse({ ...validClose, currency: 'XYZ' })
    expect(result.success).toBe(false)
  })
})
