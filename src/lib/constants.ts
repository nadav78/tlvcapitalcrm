export const CURRENCIES = [
  'USD', 'EUR', 'ILS', 'GBP',
  'SGD', 'JPY', 'INR', 'AUD',
  'SEK', 'NOK', 'DKK',
  'BRL', 'ARS', 'MXN', 'COP',
  'RSD', 'RON',
] as const

export type Currency = typeof CURRENCIES[number]

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  cold_outreach: 'Cold Outreach',
  partner: 'Partner',
  inbound: 'Inbound',
  diplomatic: 'Diplomatic',
  marketing: 'Marketing',
}

export const BUDGET_STATUS_LABELS: Record<string, string> = {
  not_yet_secured: 'Not Yet Secured',
  secured: 'Secured',
}

export const MNDA_STATUS_LABELS: Record<string, string> = {
  not_required: 'Not Required',
  pending: 'Pending',
  sent: 'Sent',
  signed: 'Signed',
}

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  demo: 'Demo / Product Presentation',
  site_visit: 'Site Visit',
  internal_review: 'Internal Review',
}

export const ORG_TYPE_LABELS: Record<string, string> = {
  ministry_of_defense: 'Ministry of Defense',
  defense_agency: 'Defense Agency',
  intelligence: 'Intelligence',
  police_hls: 'Police / HLS',
  government: 'Government',
  private: 'Private',
  other: 'Other',
}

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  former: 'Former',
}
