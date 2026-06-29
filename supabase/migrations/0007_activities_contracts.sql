-- activities: log of all interactions with clients and contacts.
-- contracts: created when an opportunity is Won.

CREATE TABLE activities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  client_id      uuid REFERENCES clients(id) ON DELETE SET NULL,
  contact_id     uuid REFERENCES contacts(id) ON DELETE SET NULL,
  user_id        uuid NOT NULL REFERENCES users(id),
  type           activity_type NOT NULL,
  subject        text NOT NULL,
  notes          text,
  activity_date  timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- Every activity must be linked to at least an opportunity or a client.
  CONSTRAINT activity_has_anchor CHECK (opportunity_id IS NOT NULL OR client_id IS NOT NULL)
);

CREATE TABLE contracts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id         uuid NOT NULL REFERENCES opportunities(id),
  client_id              uuid NOT NULL REFERENCES clients(id),
  contract_value         numeric NOT NULL,
  currency               text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  signed_date            date NOT NULL,
  expected_delivery_date date NOT NULL,
  is_at_risk             bool NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
