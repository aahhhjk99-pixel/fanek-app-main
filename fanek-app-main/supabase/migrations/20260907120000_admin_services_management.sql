-- Admin-managed service catalog.

ALTER TABLE services ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "services_insert_admin" ON services;
CREATE POLICY "services_insert_admin" ON services FOR INSERT TO authenticated
WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "services_update_admin" ON services;
CREATE POLICY "services_update_admin" ON services FOR UPDATE TO authenticated
USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "services_delete_admin" ON services;
CREATE POLICY "services_delete_admin" ON services FOR DELETE TO authenticated
USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "services_select_all" ON services;
CREATE POLICY "services_select_all" ON services FOR SELECT TO anon, authenticated
USING (active = true OR public.current_user_is_admin());

CREATE INDEX IF NOT EXISTS idx_services_active_category ON services(active, category);
