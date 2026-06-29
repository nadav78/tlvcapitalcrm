-- users: one row per CRM user, id matches auth.users.id.
-- user_sectors: maps sector_managers to their assigned sectors (many-to-many).

CREATE TABLE users (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text UNIQUE NOT NULL,
  full_name    text NOT NULL,
  role         user_role NOT NULL,
  region_id    uuid REFERENCES regions(id),
  sector_scope sector_scope NOT NULL DEFAULT 'all',
  is_active    bool NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- Every RSM must have a region; admins and sector_managers do not.
  CONSTRAINT rsm_requires_region CHECK (role != 'rsm' OR region_id IS NOT NULL)
);

CREATE TABLE user_sectors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id  uuid NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, sector_id)
);
