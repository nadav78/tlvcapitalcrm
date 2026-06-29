-- Fix 1: contacts RSM policies — use client_id as authoritative region scope post-Win.
-- Pre-Win: contact has only opportunity_id set → scope by opportunity's region.
-- Post-Win: client_id is set → scope by client's region.
-- The original OR allowed RSM-B to read contacts whose opportunity moved to Region B
-- even though the client still belongs to Region A.

DROP POLICY IF EXISTS "contacts_rsm_read"   ON contacts;
DROP POLICY IF EXISTS "contacts_rsm_insert" ON contacts;
DROP POLICY IF EXISTS "contacts_rsm_update" ON contacts;

CREATE POLICY "contacts_rsm_read" ON contacts
  FOR SELECT USING (
    auth_role() = 'rsm'
    AND (
      client_id IN (SELECT id FROM clients WHERE region_id = auth_region_id())
      OR (client_id IS NULL AND opportunity_id IN (SELECT id FROM opportunities WHERE region_id = auth_region_id()))
    )
  );

CREATE POLICY "contacts_rsm_insert" ON contacts
  FOR INSERT WITH CHECK (
    auth_role() = 'rsm'
    AND (
      client_id IN (SELECT id FROM clients WHERE region_id = auth_region_id())
      OR (client_id IS NULL AND opportunity_id IN (SELECT id FROM opportunities WHERE region_id = auth_region_id()))
    )
  );

CREATE POLICY "contacts_rsm_update" ON contacts
  FOR UPDATE USING (
    auth_role() = 'rsm'
    AND (
      client_id IN (SELECT id FROM clients WHERE region_id = auth_region_id())
      OR (client_id IS NULL AND opportunity_id IN (SELECT id FROM opportunities WHERE region_id = auth_region_id()))
    )
  );

-- Fix 2: sync opportunities.region_id automatically when rsm_id changes.
-- PRODUCT.md §5: "If the new RSM is in a different region, the opportunity's region updates to match."
-- SCHEMA.md: "Updated automatically when the opportunity is reassigned to an RSM in a different region."
-- The comment existed in 0005_opportunities.sql but no trigger enforced it.

CREATE OR REPLACE FUNCTION sync_opportunity_region()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rsm_id IS DISTINCT FROM OLD.rsm_id THEN
    NEW.region_id = (SELECT region_id FROM users WHERE id = NEW.rsm_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opportunities_sync_region
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION sync_opportunity_region();

-- Fix 3: Add opportunity_id and client_id to the RSM contract column guard.
-- These FKs are set at contract creation and must be immutable — moving a contract
-- to a different opportunity corrupts financial records silently.

CREATE OR REPLACE FUNCTION guard_rsm_contract_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT role FROM public.users WHERE id = auth.uid()) = 'rsm' THEN
    IF  NEW.contract_value         IS DISTINCT FROM OLD.contract_value
     OR NEW.currency               IS DISTINCT FROM OLD.currency
     OR NEW.signed_date            IS DISTINCT FROM OLD.signed_date
     OR NEW.expected_delivery_date IS DISTINCT FROM OLD.expected_delivery_date
     OR NEW.opportunity_id         IS DISTINCT FROM OLD.opportunity_id
     OR NEW.client_id              IS DISTINCT FROM OLD.client_id
    THEN
      RAISE EXCEPTION 'RSMs may only update is_at_risk on contracts';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix 4: Correct sync_opportunity_last_activity for UPDATE operations.
-- Two bugs in the original:
--   a) On UPDATE, if opportunity_id changes from A to B, only B was updated — A was never recalculated.
--   b) GREATEST(last_activity_at, NEW.activity_date) can never decrease the value, so editing
--      an activity to an earlier date left last_activity_at permanently stale.
-- The DELETE branch already did a correct MAX recalculation — we apply the same approach to INSERT/UPDATE.

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
      SET last_activity_at = (
        SELECT MAX(activity_date) FROM activities WHERE opportunity_id = NEW.opportunity_id
      )
      WHERE id = NEW.opportunity_id;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.opportunity_id IS DISTINCT FROM NEW.opportunity_id AND OLD.opportunity_id IS NOT NULL THEN
      UPDATE opportunities
      SET last_activity_at = (
        SELECT MAX(activity_date) FROM activities WHERE opportunity_id = OLD.opportunity_id
      )
      WHERE id = OLD.opportunity_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- Fix 5: Same corrections for sync_contact_last_activity.

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
      SET last_activity_at = (
        SELECT MAX(activity_date) FROM activities WHERE contact_id = NEW.contact_id
      )
      WHERE id = NEW.contact_id;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.contact_id IS DISTINCT FROM NEW.contact_id AND OLD.contact_id IS NOT NULL THEN
      UPDATE contacts
      SET last_activity_at = (
        SELECT MAX(activity_date) FROM activities WHERE contact_id = OLD.contact_id
      )
      WHERE id = OLD.contact_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- Fix 6: Add explicit auth guard to opp_products_read.
-- The original policy had no auth.uid() check of its own — access was silently
-- delegated to whatever the opportunities subquery returned. An anon-visible
-- change upstream would cascade here undetected.

DROP POLICY IF EXISTS "opp_products_read" ON opportunity_products;

CREATE POLICY "opp_products_read" ON opportunity_products
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND opportunity_id IN (SELECT id FROM opportunities)
  );
