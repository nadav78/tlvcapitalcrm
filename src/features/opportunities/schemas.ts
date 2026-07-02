import { z } from 'zod'
import { CURRENCIES } from '@/lib/constants'

// ── Enum value arrays (kept as const for type safety) ────────────────────────

const LEAD_SOURCES = ['cold_outreach', 'partner', 'inbound', 'diplomatic', 'marketing'] as const

const ORG_TYPES = [
  'ministry_of_defense',
  'defense_agency',
  'intelligence',
  'police_hls',
  'government',
  'private',
  'other',
] as const

const BUDGET_STATUSES = ['not_yet_secured', 'secured'] as const

const MNDA_STATUSES = ['not_required', 'pending', 'sent', 'signed'] as const

// ── opportunityRegisterSchema ────────────────────────────────────────────────
// Fields required when a new opportunity enters the pipeline (§4.1 of PRODUCT.md).
// All non-optional fields have NOT NULL constraints in the database.

// Error messages here are shown directly to RSMs under form fields (React
// Hook Form renders `errors.<field>.message`) — they must read as plain
// instructions, never as Zod's defaults, which leak schema internals like
// `expected one of "cold_outreach"|"partner"|…` into the UI.
export const opportunityRegisterSchema = z.object({
  rsm_id: z.string('Select an RSM').uuid('Select an RSM'),
  region_id: z.string('Select a region').uuid('Select a region'),
  country: z.string('Enter the country').min(1, 'Enter the country'),
  stage_id: z.string().uuid(),
  requirement_type: z.string('Enter the requirement type').min(1, 'Enter the requirement type'),
  sector_id: z.string('Select a sector').uuid('Select a sector'),
  description: z.string('Enter a brief description').min(1, 'Enter a brief description'),
  prospect_company_name: z
    .string('Enter the prospect company name')
    .min(1, 'Enter the prospect company name'),
  lead_source: z.enum(LEAD_SOURCES, 'Select a lead source'),
  registration_date: z.string('Enter the registration date').date('Enter a valid date'),
  // Optional at registration — filled when available
  prospect_organization_type: z.enum(ORG_TYPES).nullable().optional(),
  prospect_contact_name: z.string().optional(),
  prospect_website: z
    .union([z.string().url('Enter a valid website address (https://…)'), z.literal('')])
    .optional(),
  prospect_contact_email: z
    .union([z.string().email('Enter a valid email address'), z.literal('')])
    .optional(),
  prospect_contact_phone: z.string().optional(),
  advisor_id: z.string().uuid().nullable().optional(),
})

export type OpportunityRegisterValues = z.infer<typeof opportunityRegisterSchema>

// ── opportunitySchema ────────────────────────────────────────────────────────
// Extends the register schema with all fields filled in over time.
// Used for the full edit form.

export const opportunitySchema = opportunityRegisterSchema.extend({
  estimated_value: z.number().positive().nullable().optional(),
  currency: z.enum(CURRENCIES).nullable().optional(),
  budget_status: z.enum(BUDGET_STATUSES).nullable().optional(),
  probability_pct: z.number().int().min(0).max(100).nullable().optional(),
  expected_close_date: z
    .union([z.string().date(), z.literal('')])
    .nullable()
    .optional(),
  next_step: z.string().optional(),
  special_license_required: z.boolean().default(false),
  is_at_risk: z.boolean().default(false),
})

// z.input gives the pre-parse shape where .default() fields are optional.
// z.infer (output) would make special_license_required / is_at_risk required,
// forcing every caller to explicitly pass false instead of letting the schema default.
export type OpportunityValues = z.input<typeof opportunitySchema>

// ── opportunityProductSchema ─────────────────────────────────────────────────
// One product line on an opportunity. Either product_id (catalog) or
// product_name_freetext must be present — but not both null/empty.

export const opportunityProductSchema = z
  .object({
    product_id: z.string().uuid().nullable().optional(),
    product_name_freetext: z.string().nullable().optional(),
    quantity: z.number().int().positive().default(1),
    partner_contact_name: z.string().optional(),
    partner_contact_email: z
      .union([z.string().email(), z.literal('')])
      .optional(),
    partner_contact_phone: z.string().optional(),
    partner_mnda_status: z.enum(MNDA_STATUSES).nullable().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (d) =>
      (d.product_id != null && d.product_id !== '') ||
      (d.product_name_freetext?.trim() ?? '') !== '',
    { message: 'Select a catalog product or enter a product name' },
  )

export type OpportunityProductValues = z.infer<typeof opportunityProductSchema>

// ── closeDealSchema ──────────────────────────────────────────────────────────
// Fields collected in the Close Deal modal before marking an opportunity Won.

// Same rule as opportunityRegisterSchema: these messages render inline in the
// Close Deal modal — keep them human.
export const closeDealSchema = z.object({
  contract_value: z.number('Enter the contract value').positive('Enter the contract value'),
  currency: z.enum(CURRENCIES, 'Select a currency'),
  signed_date: z.string('Enter the signed date').date('Enter the signed date'),
  expected_delivery_date: z
    .string('Enter the expected delivery date')
    .date('Enter the expected delivery date'),
})

export type CloseDealValues = z.infer<typeof closeDealSchema>
