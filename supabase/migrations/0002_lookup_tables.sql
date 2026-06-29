-- Lookup tables: values managed by Admins via UI, no migration needed to add/rename.
-- Covers: regions, sectors, pipeline_stages, advisors, manufacturers.

CREATE TABLE regions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  is_active   bool NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sectors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  is_active   bool NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pipeline_stages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text UNIQUE NOT NULL,
  display_order int NOT NULL,
  is_won        bool NOT NULL DEFAULT false,
  is_lost       bool NOT NULL DEFAULT false,
  is_active     bool NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Exactly one stage may carry is_won = true and one may carry is_lost = true at any time.
CREATE UNIQUE INDEX pipeline_stages_one_won  ON pipeline_stages (is_won)  WHERE is_won  = true;
CREATE UNIQUE INDEX pipeline_stages_one_lost ON pipeline_stages (is_lost) WHERE is_lost = true;

CREATE TABLE advisors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  is_active   bool NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE manufacturers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text UNIQUE NOT NULL,
  country_of_origin text,
  website           text,
  notes             text,
  is_active         bool NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
