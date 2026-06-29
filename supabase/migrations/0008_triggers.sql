-- Trigger 1: updated_at — fires on every UPDATE on every mutable table.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'regions', 'sectors', 'pipeline_stages', 'advisors', 'manufacturers',
    'users', 'clients', 'products', 'opportunities',
    'contacts', 'opportunity_products', 'activities', 'contracts'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- Trigger 2: opportunities.last_activity_at — maintained by changes to activities.
-- On INSERT/UPDATE: set if the new activity_date is greater than the current value.
-- On DELETE: recalculate from remaining activities for that opportunity.

CREATE OR REPLACE FUNCTION sync_opportunity_last_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.opportunity_id IS NOT NULL THEN
      UPDATE opportunities
      SET last_activity_at = (
        SELECT MAX(activity_date) FROM activities WHERE opportunity_id = OLD.opportunity_id
      )
      WHERE id = OLD.opportunity_id;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.opportunity_id IS NOT NULL THEN
      UPDATE opportunities
      SET last_activity_at = GREATEST(last_activity_at, NEW.activity_date)
      WHERE id = NEW.opportunity_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_activities_sync_opportunity_last_activity
AFTER INSERT OR UPDATE OR DELETE ON activities
FOR EACH ROW EXECUTE FUNCTION sync_opportunity_last_activity();

-- Trigger 3: contacts.last_activity_at — maintained by changes to activities.
-- Same pattern as above, scoped to contact_id.

CREATE OR REPLACE FUNCTION sync_contact_last_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.contact_id IS NOT NULL THEN
      UPDATE contacts
      SET last_activity_at = (
        SELECT MAX(activity_date) FROM activities WHERE contact_id = OLD.contact_id
      )
      WHERE id = OLD.contact_id;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.contact_id IS NOT NULL THEN
      UPDATE contacts
      SET last_activity_at = GREATEST(last_activity_at, NEW.activity_date)
      WHERE id = NEW.contact_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_activities_sync_contact_last_activity
AFTER INSERT OR UPDATE OR DELETE ON activities
FOR EACH ROW EXECUTE FUNCTION sync_contact_last_activity();
