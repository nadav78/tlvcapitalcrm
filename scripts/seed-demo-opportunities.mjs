// Seeds ~40 realistic demo opportunities across the manual test users'
// regions (Baltics, Nordics — see scripts/seed-manual-test-users.mjs) plus a
// few other regions for Admin-view variety. Used for UX/craft review passes
// and any session that needs a realistically full pipeline table.
//
// Deletes previously-seeded demo rows first (matched by the [demo] marker in
// description), so it's safe to re-run.
//
// Usage: supabase start && node scripts/seed-manual-test-users.mjs && node scripts/seed-demo-opportunities.mjs

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { realtime: { transport: ws } })

const DEMO_MARKER = '[demo]'

async function lookup(table, nameCol = 'name') {
  const { data, error } = await db.from(table).select(`id, ${nameCol}`)
  if (error) throw new Error(`${table}: ${error.message}`)
  return Object.fromEntries(data.map((r) => [r[nameCol], r.id]))
}

const regions = await lookup('regions')
const stages = await lookup('pipeline_stages')
const sectors = await lookup('sectors')
const advisors = await lookup('advisors')

const { data: users, error: usersErr } = await db.from('users').select('id, email, role, region_id')
if (usersErr) throw new Error(usersErr.message)
const rsmBaltics = users.find((u) => u.email === 'manual-rsm@test.local')
const rsmNordics = users.find((u) => u.email === 'manual-rsm2@test.local')
if (!rsmBaltics || !rsmNordics) throw new Error('Run scripts/seed-manual-test-users.mjs first')

// Clean previously seeded demo rows. The seeder itself never creates
// Client/Contract records (Won rows are inserted directly, which is fine for
// list-view review), but an interactive session may have closed a demo deal
// through the UI — so contracts, contact links, and demo-created clients are
// cleaned up too, or the opportunity delete would fail on FK references.
const { data: oldRows } = await db.from('opportunities').select('id, client_id').like('description', `%${DEMO_MARKER}%`)
if (oldRows?.length) {
  const ids = oldRows.map((r) => r.id)
  const clientIds = [...new Set(oldRows.map((r) => r.client_id).filter(Boolean))]
  await db.from('activities').delete().in('opportunity_id', ids)
  await db.from('contracts').delete().in('opportunity_id', ids)
  await db.from('contacts').delete().in('opportunity_id', ids)
  const { error: delErr } = await db.from('opportunities').delete().in('id', ids)
  if (delErr) throw new Error(`cleanup: ${delErr.message}`)
  if (clientIds.length) {
    await db.from('contacts').delete().in('client_id', clientIds)
    await db.from('clients').delete().in('id', clientIds)
  }
  console.log(`deleted ${oldRows.length} previously seeded demo opportunities`)
}

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString()
const dateAgo = (n) => daysAgo(n).slice(0, 10)
const dateAhead = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

// (company, country, region, stage, sector, value, currency, probability,
//  budget, next step, at-risk, last activity days ago | null, lead source, org type)
const rows = [
  // ---- Baltics (manual-rsm) ----
  ['Lithuanian Ministry of National Defence', 'Lithuania', 'Baltics', 'Negotiation', 'Defense Export', 4200000, 'EUR', 70, 'secured', 'Final pricing review with procurement board — send revised BAFO by Friday', false, 2, 'diplomatic', 'ministry_of_defense'],
  ['Estonian Defence Investments Centre', 'Estonia', 'Baltics', 'Proposal Sent', 'Defense Export', 2750000, 'EUR', 50, 'secured', 'Awaiting technical evaluation committee feedback (due mid-month)', false, 5, 'partner', 'defense_agency'],
  ['Latvian State Border Guard', 'Latvia', 'Baltics', 'Qualified', 'Homeland Security', 890000, 'EUR', 40, 'not_yet_secured', 'Schedule on-site demo of perimeter surveillance suite', false, 12, 'inbound', 'police_hls'],
  ['Riga Airport Security Authority', 'Latvia', 'Baltics', 'New', 'Homeland Security', null, null, null, null, 'Qualify budget and decision timeline on intro call Tuesday', false, null, 'cold_outreach', 'government'],
  ['Tallinn Cyber Defence League', 'Estonia', 'Baltics', 'Awaiting NDA', 'Cyber', 640000, 'EUR', 30, 'not_yet_secured', 'NDA with legal since last week — chase their counsel', true, 38, 'diplomatic', 'defense_agency'],
  ['Klaipeda Port Authority', 'Lithuania', 'Baltics', 'Qualified', 'Homeland Security', 1200000, 'EUR', 45, 'not_yet_secured', 'Prepare maritime ISR concept brief with TATOOM pre-sales', false, 8, 'marketing', 'government'],
  ['Baltic Defence College', 'Estonia', 'Baltics', 'New', 'Defense Export', 150000, 'EUR', 20, null, null, false, null, 'inbound', 'government'],
  ['Lithuanian Riflemen’s Union', 'Lithuania', 'Baltics', 'Proposal Sent', 'Defense Export', 480000, 'EUR', 55, 'secured', 'Follow up on night-vision trial results from field exercise', false, 19, 'partner', 'other'],
  ['Latvian National Armed Forces HQ', 'Latvia', 'Baltics', 'Awaiting License', 'Defense Export', 6100000, 'EUR', 85, 'secured', 'Special export license application submitted — check MoD status weekly', true, 31, 'diplomatic', 'ministry_of_defense'],
  ['Vilnius Municipal Police', 'Lithuania', 'Baltics', 'Lost', 'Homeland Security', 320000, 'EUR', 0, 'not_yet_secured', null, false, 60, 'cold_outreach', 'police_hls'],
  ['Estonian Police and Border Guard Board', 'Estonia', 'Baltics', 'Won', 'Homeland Security', 1450000, 'EUR', 100, 'secured', 'Kick off delivery planning with logistics', false, 9, 'inbound', 'police_hls'],
  ['Baltic Energy Grid Operator', 'Lithuania', 'Baltics', 'Qualified', 'Cyber', 950000, 'EUR', 35, 'not_yet_secured', 'Map stakeholders after CISO change — new intro needed', true, 45, 'marketing', 'private'],
  ['Kaunas Aerospace Cluster', 'Lithuania', 'Baltics', 'New', 'Manufacturing', 275000, 'EUR', 15, null, 'Send capability deck for composite UAV airframes', false, null, 'partner', 'private'],
  ['Estonian Maritime Administration', 'Estonia', 'Baltics', 'Negotiation', 'Homeland Security', 2100000, 'EUR', 65, 'secured', 'Contract redlines round 2 — their legal wants liability cap changes', false, 3, 'diplomatic', 'government'],

  // ---- Nordics (manual-rsm2) ----
  ['Norwegian Defence Materiel Agency', 'Norway', 'Nordics', 'Proposal Sent', 'Defense Export', 8900000, 'NOK', 55, 'secured', 'Present consortium structure to NDMA panel on the 14th', false, 4, 'diplomatic', 'defense_agency'],
  ['Swedish Civil Contingencies Agency', 'Sweden', 'Nordics', 'Qualified', 'Homeland Security', 3400000, 'SEK', 40, 'not_yet_secured', 'Budget cycle opens Q3 — keep warm with quarterly briefing', false, 22, 'inbound', 'government'],
  ['Danish Emergency Management Agency', 'Denmark', 'Nordics', 'New', 'Homeland Security', null, 'DKK', null, null, 'Intro meeting set via embassy contact', false, null, 'diplomatic', 'government'],
  ['Finnish Border Guard', 'Finland', 'Nordics', 'Negotiation', 'Homeland Security', 5200000, 'EUR', 75, 'secured', 'Final BAFO due — align margin with Sterlights before submission', false, 1, 'partner', 'police_hls'],
  ['Oslo Port Security', 'Norway', 'Nordics', 'Awaiting NDA', 'Cyber', 420000, 'NOK', 25, 'not_yet_secured', 'NDA sent 3 weeks ago, no response — escalate to sponsor', true, 35, 'cold_outreach', 'government'],
  ['Swedish Defence Research Agency', 'Sweden', 'Nordics', 'Qualified', 'Cyber', 1800000, 'SEK', 45, 'secured', 'Technical workshop on optical encryption scheduled', false, 6, 'marketing', 'defense_agency'],
  ['Copenhagen Metro Security', 'Denmark', 'Nordics', 'Proposal Sent', 'Homeland Security', 980000, 'DKK', 50, 'not_yet_secured', 'Proposal under review — decision committee meets end of month', false, 15, 'inbound', 'private'],
  ['Nordic Ammunition Company', 'Norway', 'Nordics', 'New', 'Manufacturing', 720000, 'EUR', 20, null, 'Qualify co-production interest for 155mm components', false, null, 'partner', 'private'],
  ['Finnish Defence Forces Logistics Command', 'Finland', 'Nordics', 'Won', 'Defense Export', 3750000, 'EUR', 100, 'secured', null, false, 14, 'diplomatic', 'ministry_of_defense'],
  ['Icelandic Coast Guard', 'Iceland', 'Nordics', 'Qualified', 'Homeland Security', 640000, 'EUR', 30, 'not_yet_secured', 'Maritime ISR requirements doc promised by their ops chief', false, 27, 'inbound', 'government'],
  ['Stockholm Municipal CCTV Programme', 'Sweden', 'Nordics', 'Lost', 'Homeland Security', 450000, 'SEK', 0, 'not_yet_secured', null, false, 75, 'cold_outreach', 'government'],
  ['Norwegian Intelligence Service', 'Norway', 'Nordics', 'Awaiting NDA', 'Cyber', 2600000, 'NOK', 35, 'secured', 'Security clearance paperwork for our SE in progress', false, 11, 'diplomatic', 'intelligence'],
  ['Danish Naval Command', 'Denmark', 'Nordics', 'Negotiation', 'Defense Export', 7300000, 'DKK', 70, 'secured', 'Deck-mount integration study accepted — negotiate spares package', false, 2, 'partner', 'ministry_of_defense'],

  // ---- Other regions (visible to Admin only) ----
  ['Colombian Ministry of National Defense', 'Colombia', 'LATAM', 'Proposal Sent', 'Defense Export', 5600000, 'USD', 45, 'not_yet_secured', 'Await CONPES budget approval — local agent tracking', false, 18, 'partner', 'ministry_of_defense'],
  ['Brazilian Federal Police', 'Brazil', 'LATAM', 'Qualified', 'Homeland Security', 2900000, 'USD', 35, 'not_yet_secured', 'Compliance review of local content requirements', false, 25, 'inbound', 'police_hls'],
  ['Chilean Navy Procurement', 'Chile', 'LATAM', 'New', 'Defense Export', null, 'USD', null, null, null, false, null, 'diplomatic', 'ministry_of_defense'],
  ['Mexican Port Authority Veracruz', 'Mexico', 'LATAM', 'Awaiting NDA', 'Homeland Security', 1100000, 'USD', 25, 'not_yet_secured', 'NDA stuck with their legal 6 weeks — consider dropping priority', true, 48, 'cold_outreach', 'government'],
  ['Singapore Home Team Science & Tech', 'Singapore', 'Asia', 'Negotiation', 'Cyber', 4800000, 'SGD', 65, 'secured', 'POC report delivered — commercial terms discussion next week', false, 3, 'marketing', 'defense_agency'],
  ['Indian Border Security Force', 'India', 'Asia', 'Proposal Sent', 'Defense Export', 12500000, 'INR', 40, 'not_yet_secured', 'L1 evaluation ongoing — monitor via Delhi office', false, 30, 'partner', 'police_hls'],
  ['Japanese Coast Guard', 'Japan', 'Asia', 'Qualified', 'Homeland Security', 6700000, 'JPY', 30, 'secured', 'Trading house partner arranging Tokyo demo slot', false, 16, 'partner', 'government'],
  ['Philippine Department of National Defense', 'Philippines', 'Asia', 'Won', 'Defense Export', 3200000, 'USD', 100, 'secured', null, false, 21, 'diplomatic', 'ministry_of_defense'],
  ['Israel Airports Authority', 'Israel', 'Israel', 'Negotiation', 'Homeland Security', 2400000, 'ILS', 80, 'secured', 'Integration spec sign-off with their engineering this week', false, 1, 'inbound', 'government'],
  ['Israeli Prison Service', 'Israel', 'Israel', 'New', 'Homeland Security', 380000, 'ILS', 10, null, 'Waiting on tender publication', false, null, 'marketing', 'police_hls'],
  ['Serbian Ministry of Interior', 'Serbia', 'Balkan', 'Qualified', 'Homeland Security', 1600000, 'EUR', 35, 'not_yet_secured', 'EU funding eligibility check before proposal', false, 13, 'diplomatic', 'police_hls'],
  ['Romanian Special Telecommunications Service', 'Romania', 'Balkan', 'Proposal Sent', 'Cyber', 2200000, 'EUR', 55, 'secured', 'Clarification round answered — award expected in 3 weeks', false, 7, 'partner', 'intelligence'],
  ['Croatian Coast Guard', 'Croatia', 'Balkan', 'Lost', 'Defense Export', 900000, 'EUR', 0, 'secured', null, false, 90, 'diplomatic', 'government'],
  ['North Macedonian Army Modernisation Office', 'North Macedonia', 'Balkan', 'Awaiting License', 'Defense Export', 1350000, 'EUR', 75, 'secured', 'License pre-check filed — expected 4-6 weeks', false, 24, 'diplomatic', 'ministry_of_defense'],
]

const advisorNames = Object.keys(advisors)
const opportunities = rows.map((r, i) => {
  const [company, country, region, stage, sector, value, currency, probability, budget, nextStep, atRisk, lastActivityDays, leadSource, orgType] = r
  const rsm = region === 'Baltics' ? rsmBaltics : region === 'Nordics' ? rsmNordics : (i % 2 ? rsmBaltics : rsmNordics)
  return {
    rsm_id: rsm.id,
    region_id: regions[region],
    stage_id: stages[stage],
    sector_id: sectors[sector],
    requirement_type: ['C-UAS', 'Optronics', 'Maritime ISR', 'Optical Encryption', 'Perimeter Security', 'Tactical Comms'][i % 6],
    description: `${DEMO_MARKER} ${company} — ${sector} requirement, seeded for UI review`,
    prospect_company_name: company,
    prospect_organization_type: orgType,
    country,
    lead_source: leadSource,
    advisor_id: i % 3 === 0 ? advisors[advisorNames[i % advisorNames.length]] : null,
    registration_date: dateAgo(20 + ((i * 7) % 200)),
    estimated_value: value,
    currency,
    budget_status: budget,
    probability_pct: probability,
    expected_close_date: probability && probability > 30 ? dateAhead(30 + ((i * 11) % 180)) : null,
    next_step: nextStep,
    is_at_risk: atRisk,
    last_activity_at: lastActivityDays == null ? null : daysAgo(lastActivityDays),
    prospect_contact_name: i % 2 === 0 ? `Contact ${i + 1}` : null,
    prospect_contact_email: i % 2 === 0 ? `contact${i + 1}@example.org` : null,
  }
})

// Insert one at a time is slow; batch insert. last_activity_at is
// trigger-maintained in real use but writable via service role for seeding.
const { error: insertErr } = await db.from('opportunities').insert(opportunities)
if (insertErr) throw new Error(`insert: ${insertErr.message}`)
console.log(`seeded ${opportunities.length} demo opportunities`)
