-- clients: confirmed customers — created only when an opportunity is Won.
-- products: product catalog items, each belonging to a manufacturer and sector.

CREATE TABLE clients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  country           text NOT NULL,
  region_id         uuid NOT NULL REFERENCES regions(id),
  organization_type org_type,
  status            client_status NOT NULL DEFAULT 'active',
  website           text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES manufacturers(id),
  name            text NOT NULL,
  sku             text,
  category        text,
  sector_id       uuid NOT NULL REFERENCES sectors(id),
  description     text,
  margin_pct      numeric,
  is_active       bool NOT NULL DEFAULT true,
  datasheet_url   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
