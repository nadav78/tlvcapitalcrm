-- Deactivated users (is_active = false) must lose all RLS-granted access, not just
-- app-layer access. auth_role() is checked first by every RLS policy, so gating it
-- on is_active blocks a deactivated user's JWT everywhere in a single change.

CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.users WHERE id = auth.uid() AND is_active = true
$$;
