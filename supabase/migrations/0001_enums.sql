-- All enum types used across the schema.
-- Enums are used only for values structural to the system that never change at runtime.
-- Business-managed values (stages, sectors, advisors, regions) are lookup tables instead.

CREATE TYPE user_role AS ENUM ('admin', 'rsm', 'sector_manager');
CREATE TYPE lead_source AS ENUM ('cold_outreach', 'partner', 'inbound', 'diplomatic', 'marketing');
CREATE TYPE budget_status AS ENUM ('not_yet_secured', 'secured');
CREATE TYPE mnda_status AS ENUM ('not_required', 'pending', 'sent', 'signed');
CREATE TYPE activity_type AS ENUM ('call', 'email', 'meeting', 'demo', 'site_visit', 'internal_review');
CREATE TYPE org_type AS ENUM (
  'ministry_of_defense',
  'defense_agency',
  'intelligence',
  'police_hls',
  'government',
  'private',
  'other'
);
CREATE TYPE client_status AS ENUM ('active', 'inactive', 'former');
CREATE TYPE sector_scope AS ENUM ('all', 'own_sectors_only');
