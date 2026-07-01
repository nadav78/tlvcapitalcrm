-- guard_rsm_contract_columns() re-derived the caller's role via a raw
-- subquery on public.users instead of calling auth_role(), so it never
-- picked up the is_active gate added in 0013_auth_role_active_check.sql.
-- The row-level RLS policy (contracts_rsm_update) already blocks a
-- deactivated RSM's UPDATE before this trigger runs, so this was not an
-- exploitable gap — but it left a second, independently-maintained copy of
-- "is this caller an active rsm" that would silently drift from auth_role()
-- on any future change. Routing through auth_role() makes it the single
-- source of truth again.

CREATE OR REPLACE FUNCTION guard_rsm_contract_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only applies when the calling role is 'rsm'
  IF auth_role() = 'rsm' THEN
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
