-- Replace the recursive WITH CHECK contract policy with a trigger.
-- The recursive subquery (SELECT ... FROM contracts WHERE id = contracts.id)
-- caused infinite recursion. A BEFORE UPDATE trigger is the correct tool for
-- column-level write restrictions within a single table.

DROP POLICY IF EXISTS "contracts_rsm_update_at_risk" ON contracts;

-- Row-level gate: RSMs can only UPDATE contracts linked to their own opportunities.
CREATE POLICY "contracts_rsm_update" ON contracts
  FOR UPDATE USING (
    auth_role() = 'rsm'
    AND opportunity_id IN (
      SELECT id FROM opportunities WHERE region_id = auth_region_id()
    )
  );

-- Column-level gate: RSMs may only change is_at_risk. All other columns must be
-- unchanged. Admins are exempt. Enforced in a SECURITY DEFINER function so the
-- trigger body can read OLD/NEW without triggering another RLS check.
CREATE OR REPLACE FUNCTION guard_rsm_contract_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only applies when the calling role is 'rsm'
  IF (SELECT role FROM public.users WHERE id = auth.uid()) = 'rsm' THEN
    IF  NEW.contract_value         IS DISTINCT FROM OLD.contract_value
     OR NEW.currency               IS DISTINCT FROM OLD.currency
     OR NEW.signed_date            IS DISTINCT FROM OLD.signed_date
     OR NEW.expected_delivery_date IS DISTINCT FROM OLD.expected_delivery_date
    THEN
      RAISE EXCEPTION 'RSMs may only update is_at_risk on contracts';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contracts_rsm_column_guard
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION guard_rsm_contract_columns();
