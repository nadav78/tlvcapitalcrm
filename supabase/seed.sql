-- Seed data for lookup tables.
-- Must run after migrations. Required before the app can function.
-- Re-runnable: INSERT ... ON CONFLICT DO NOTHING.

-- Regions
INSERT INTO regions (name) VALUES
  ('Baltics'),
  ('Nordics'),
  ('Balkan'),
  ('LATAM'),
  ('Israel'),
  ('Asia')
ON CONFLICT (name) DO NOTHING;

-- Sectors
INSERT INTO sectors (name) VALUES
  ('Defense Export'),
  ('Homeland Security'),
  ('Cyber'),
  ('Manufacturing')
ON CONFLICT (name) DO NOTHING;

-- Advisors
INSERT INTO advisors (name) VALUES
  ('Manor'),
  ('Doron'),
  ('Nitzan'),
  ('Ziv')
ON CONFLICT (name) DO NOTHING;

-- Pipeline stages (ordered, with terminal + default flags)
INSERT INTO pipeline_stages (name, display_order, is_won, is_lost, is_default) VALUES
  ('New',              1, false, false, true),
  ('Qualified',        2, false, false, false),
  ('Awaiting NDA',     3, false, false, false),
  ('Proposal Sent',    4, false, false, false),
  ('Negotiation',      5, false, false, false),
  ('Awaiting License', 6, false, false, false),
  ('Won',              7, true,  false, false),
  ('Lost',             8, false, true,  false)
ON CONFLICT (name) DO NOTHING;
