-- opportunities: the core pipeline record.
-- Prospect details live here until Won, at which point client_id is set.
-- region_id is denormalized for RLS — must be kept in sync with rsm.region_id on reassignment.

CREATE TABLE opportunities (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership and classification
  rsm_id                    uuid NOT NULL REFERENCES users(id),
  region_id                 uuid NOT NULL REFERENCES regions(id),
  stage_id                  uuid NOT NULL REFERENCES pipeline_stages(id),
  sector_id                 uuid NOT NULL REFERENCES sectors(id),
  advisor_id                uuid REFERENCES advisors(id),

  -- Required at registration
  requirement_type          text NOT NULL,
  description               text NOT NULL,
  prospect_company_name     text NOT NULL,
  country                   text NOT NULL,
  lead_source               lead_source NOT NULL,
  registration_date         date NOT NULL,

  -- Prospect contact (optional at registration)
  prospect_organization_type org_type,
  prospect_contact_name     text,
  prospect_contact_email    text,
  prospect_contact_phone    text,
  prospect_website          text,

  -- Deal details (filled in over time)
  estimated_value           numeric,
  currency                  text CHECK (currency ~ '^[A-Z]{3}$'),
  budget_status             budget_status,
  probability_pct           int CHECK (probability_pct BETWEEN 0 AND 100),
  expected_close_date       date,
  next_step                 text,
  special_license_required  bool NOT NULL DEFAULT false,
  is_at_risk                bool NOT NULL DEFAULT false,

  -- Set on Win
  client_id                 uuid REFERENCES clients(id),

  -- Denormalized for stale-deal dashboard query (maintained by trigger)
  last_activity_at          timestamptz,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
