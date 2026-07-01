-- Adds an explicit default-stage flag to pipeline_stages, mirroring is_won/is_lost.
-- Without this, "which stage does a new Opportunity start in" would have to be
-- matched by name ('New'), which breaks silently if an Admin renames that stage
-- (PRODUCT.md §4.6 explicitly allows renaming stages through the UI).

ALTER TABLE pipeline_stages ADD COLUMN is_default bool NOT NULL DEFAULT false;

-- Exactly one stage may carry is_default = true at any time, same pattern as
-- the existing is_won/is_lost partial unique indexes.
CREATE UNIQUE INDEX pipeline_stages_one_default ON pipeline_stages (is_default) WHERE is_default = true;

UPDATE pipeline_stages SET is_default = true WHERE name = 'New';
