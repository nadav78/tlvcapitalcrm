-- Row Level Security policies.
-- Every table has RLS enabled. Policies use auth.uid() and a helper function
-- that reads the calling user's role and region from the public.users table.

-- ─── Helper: get current user's role ────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_region_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT region_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_sector_scope()
RETURNS sector_scope LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT sector_scope FROM public.users WHERE id = auth.uid()
$$;

-- Returns true if the current user is assigned to the given sector
CREATE OR REPLACE FUNCTION auth_has_sector(p_sector_id uuid)
RETURNS bool LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_sectors
    WHERE user_id = auth.uid() AND sector_id = p_sector_id
  )
$$;

-- ─── Enable RLS on all tables ────────────────────────────────────────────────

ALTER TABLE regions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sectors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts         ENABLE ROW LEVEL SECURITY;

-- ─── Lookup tables (regions, sectors, pipeline_stages, advisors, manufacturers) ─

-- All authenticated users can read. Admins only can write.

CREATE POLICY "lookup_read_all"   ON regions         FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "lookup_write_admin" ON regions        FOR ALL    USING (auth_role() = 'admin');

CREATE POLICY "lookup_read_all"    ON sectors        FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "lookup_write_admin" ON sectors        FOR ALL    USING (auth_role() = 'admin');

CREATE POLICY "lookup_read_all"    ON pipeline_stages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "lookup_write_admin" ON pipeline_stages FOR ALL    USING (auth_role() = 'admin');

CREATE POLICY "lookup_read_all"    ON advisors       FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "lookup_write_admin" ON advisors       FOR ALL    USING (auth_role() = 'admin');

CREATE POLICY "lookup_read_all"    ON manufacturers  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "lookup_write_admin" ON manufacturers  FOR ALL    USING (auth_role() = 'admin');

-- ─── users ───────────────────────────────────────────────────────────────────

-- A user can read their own row. Admins can read and write all rows.
CREATE POLICY "users_read_own"     ON users FOR SELECT USING (id = auth.uid() OR auth_role() = 'admin');
CREATE POLICY "users_write_admin"  ON users FOR ALL    USING (auth_role() = 'admin');

-- ─── user_sectors ────────────────────────────────────────────────────────────

CREATE POLICY "user_sectors_read_all"   ON user_sectors FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "user_sectors_write_admin" ON user_sectors FOR ALL   USING (auth_role() = 'admin');

-- ─── products ────────────────────────────────────────────────────────────────

CREATE POLICY "products_read_all"    ON products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "products_write_admin" ON products FOR ALL    USING (auth_role() = 'admin');

-- ─── clients ─────────────────────────────────────────────────────────────────

-- Admin: full access.
-- RSM: read + create/edit own region. Cannot delete.
-- Sector Manager: read-only, all clients.

CREATE POLICY "clients_admin" ON clients
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY "clients_rsm_read" ON clients
  FOR SELECT USING (
    auth_role() = 'rsm' AND region_id = auth_region_id()
  );

CREATE POLICY "clients_rsm_insert" ON clients
  FOR INSERT WITH CHECK (
    auth_role() = 'rsm' AND region_id = auth_region_id()
  );

CREATE POLICY "clients_rsm_update" ON clients
  FOR UPDATE USING (
    auth_role() = 'rsm' AND region_id = auth_region_id()
  );

CREATE POLICY "clients_sector_manager_read" ON clients
  FOR SELECT USING (auth_role() = 'sector_manager');

-- ─── opportunities ───────────────────────────────────────────────────────────

-- Admin: full access.
-- RSM: read + write own region only.
-- Sector Manager: read-only. If sector_scope = own_sectors_only, filtered to assigned sectors.

CREATE POLICY "opportunities_admin" ON opportunities
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY "opportunities_rsm_read" ON opportunities
  FOR SELECT USING (
    auth_role() = 'rsm' AND region_id = auth_region_id()
  );

CREATE POLICY "opportunities_rsm_insert" ON opportunities
  FOR INSERT WITH CHECK (
    auth_role() = 'rsm' AND region_id = auth_region_id()
  );

CREATE POLICY "opportunities_rsm_update" ON opportunities
  FOR UPDATE USING (
    auth_role() = 'rsm' AND region_id = auth_region_id()
  );

CREATE POLICY "opportunities_sector_manager_read" ON opportunities
  FOR SELECT USING (
    auth_role() = 'sector_manager'
    AND (
      auth_sector_scope() = 'all'
      OR auth_has_sector(sector_id)
    )
  );

-- ─── contacts ────────────────────────────────────────────────────────────────

-- Admin: full access.
-- RSM: read + create/edit contacts for own region clients or own opportunities. No delete.
-- Sector Manager: read all, create/edit.

CREATE POLICY "contacts_admin" ON contacts
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY "contacts_rsm_read" ON contacts
  FOR SELECT USING (
    auth_role() = 'rsm'
    AND (
      -- Contact linked to a client in RSM's region
      client_id IN (SELECT id FROM clients WHERE region_id = auth_region_id())
      OR
      -- Pre-Win contact linked to RSM's own opportunity
      opportunity_id IN (SELECT id FROM opportunities WHERE region_id = auth_region_id())
    )
  );

CREATE POLICY "contacts_rsm_insert" ON contacts
  FOR INSERT WITH CHECK (
    auth_role() = 'rsm'
    AND (
      client_id IN (SELECT id FROM clients WHERE region_id = auth_region_id())
      OR opportunity_id IN (SELECT id FROM opportunities WHERE region_id = auth_region_id())
    )
  );

CREATE POLICY "contacts_rsm_update" ON contacts
  FOR UPDATE USING (
    auth_role() = 'rsm'
    AND (
      client_id IN (SELECT id FROM clients WHERE region_id = auth_region_id())
      OR opportunity_id IN (SELECT id FROM opportunities WHERE region_id = auth_region_id())
    )
  );

CREATE POLICY "contacts_sector_manager_read" ON contacts
  FOR SELECT USING (auth_role() = 'sector_manager');

CREATE POLICY "contacts_sector_manager_write" ON contacts
  FOR INSERT WITH CHECK (auth_role() = 'sector_manager');

CREATE POLICY "contacts_sector_manager_update" ON contacts
  FOR UPDATE USING (auth_role() = 'sector_manager');

-- ─── opportunity_products ────────────────────────────────────────────────────

-- Readable if the parent opportunity is readable.
-- RSMs can write for their own opportunities. Admins can write all.

CREATE POLICY "opp_products_read" ON opportunity_products
  FOR SELECT USING (
    opportunity_id IN (SELECT id FROM opportunities)
  );

CREATE POLICY "opp_products_rsm_write" ON opportunity_products
  FOR ALL USING (
    auth_role() IN ('admin', 'rsm')
    AND opportunity_id IN (
      SELECT id FROM opportunities WHERE region_id = auth_region_id() OR auth_role() = 'admin'
    )
  );

-- ─── activities ──────────────────────────────────────────────────────────────

-- Admin: full access.
-- RSM: read + create/edit for own region opportunities or own region clients.
-- Sector Manager: read all (if scope=all) or scoped to sector.
--   Client-level activities (no opportunity) always visible to sector_managers.

CREATE POLICY "activities_admin" ON activities
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY "activities_rsm_read" ON activities
  FOR SELECT USING (
    auth_role() = 'rsm'
    AND (
      opportunity_id IN (SELECT id FROM opportunities WHERE region_id = auth_region_id())
      OR client_id    IN (SELECT id FROM clients       WHERE region_id = auth_region_id())
    )
  );

CREATE POLICY "activities_rsm_insert" ON activities
  FOR INSERT WITH CHECK (
    auth_role() = 'rsm'
    AND (
      opportunity_id IN (SELECT id FROM opportunities WHERE region_id = auth_region_id())
      OR client_id    IN (SELECT id FROM clients       WHERE region_id = auth_region_id())
    )
  );

CREATE POLICY "activities_rsm_update" ON activities
  FOR UPDATE USING (
    auth_role() = 'rsm'
    AND user_id = auth.uid()
    AND (
      opportunity_id IN (SELECT id FROM opportunities WHERE region_id = auth_region_id())
      OR client_id    IN (SELECT id FROM clients       WHERE region_id = auth_region_id())
    )
  );

CREATE POLICY "activities_sector_manager_read" ON activities
  FOR SELECT USING (
    auth_role() = 'sector_manager'
    AND (
      -- Client-level activities always visible (clients have no sector)
      opportunity_id IS NULL
      OR auth_sector_scope() = 'all'
      OR opportunity_id IN (
        SELECT id FROM opportunities WHERE auth_has_sector(sector_id)
      )
    )
  );

CREATE POLICY "activities_sector_manager_write" ON activities
  FOR INSERT WITH CHECK (auth_role() = 'sector_manager');

CREATE POLICY "activities_sector_manager_update" ON activities
  FOR UPDATE USING (
    auth_role() = 'sector_manager' AND user_id = auth.uid()
  );

-- ─── contracts ───────────────────────────────────────────────────────────────

-- Admin: full read/write.
-- RSM: read own contracts + update only is_at_risk.
-- Sector Manager: read-only (scoped by sector_scope).

CREATE POLICY "contracts_admin" ON contracts
  FOR ALL USING (auth_role() = 'admin');

CREATE POLICY "contracts_rsm_read" ON contracts
  FOR SELECT USING (
    auth_role() = 'rsm'
    AND opportunity_id IN (SELECT id FROM opportunities WHERE region_id = auth_region_id())
  );

-- RSMs can only update is_at_risk. Enforced here by restricting what can change.
-- The application layer also enforces this; the DB is the safety net.
CREATE POLICY "contracts_rsm_update_at_risk" ON contracts
  FOR UPDATE USING (
    auth_role() = 'rsm'
    AND opportunity_id IN (SELECT id FROM opportunities WHERE region_id = auth_region_id())
  )
  WITH CHECK (
    -- Only is_at_risk may differ from the current row
    contract_value         = (SELECT contract_value         FROM contracts WHERE id = contracts.id)
    AND currency           = (SELECT currency               FROM contracts WHERE id = contracts.id)
    AND signed_date        = (SELECT signed_date            FROM contracts WHERE id = contracts.id)
    AND expected_delivery_date = (SELECT expected_delivery_date FROM contracts WHERE id = contracts.id)
  );

CREATE POLICY "contracts_sector_manager_read" ON contracts
  FOR SELECT USING (
    auth_role() = 'sector_manager'
    AND (
      auth_sector_scope() = 'all'
      OR opportunity_id IN (
        SELECT id FROM opportunities WHERE auth_has_sector(sector_id)
      )
    )
  );
