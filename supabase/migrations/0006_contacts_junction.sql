-- contacts: people at client organizations.
-- client_id is nullable to support pre-Win (prospect-phase) contacts.
-- opportunity_id is set for pre-Win contacts; client_id is set on Win by closeOpportunity.
--
-- opportunity_products: join table linking products (or free-text names) to an opportunity.
-- Partner contact details live per line because each manufacturer has its own contact.

CREATE TABLE contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  opportunity_id  uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  full_name       text NOT NULL,
  title           text,
  email           text,
  phone           text,
  is_primary      bool NOT NULL DEFAULT false,
  notes           text,
  -- Denormalized for inactive-contact dashboard query (maintained by trigger)
  last_activity_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Every contact must be anchored to at least a client or an opportunity.
  CONSTRAINT contact_has_anchor CHECK (client_id IS NOT NULL OR opportunity_id IS NOT NULL)
);

-- Only one contact per client can be primary.
CREATE UNIQUE INDEX contacts_one_primary_per_client
  ON contacts (client_id)
  WHERE is_primary = true AND client_id IS NOT NULL;

CREATE TABLE opportunity_products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id        uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  product_id            uuid REFERENCES products(id),
  product_name_freetext text,
  quantity              int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  partner_contact_name  text,
  partner_contact_email text,
  partner_contact_phone text,
  partner_mnda_status   mnda_status,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Each line must reference a catalog product or provide a free-text name.
  CONSTRAINT product_line_has_identity CHECK (product_id IS NOT NULL OR product_name_freetext IS NOT NULL)
);
