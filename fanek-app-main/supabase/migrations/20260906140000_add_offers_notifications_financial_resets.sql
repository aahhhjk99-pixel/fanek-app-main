-- Admin broadcasts, targeted offers, and durable financial archive markers.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token text;
GRANT UPDATE (push_token, location_lat, location_lng) ON profiles TO authenticated;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('all', 'customers', 'technicians')),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_admin" ON notifications;
CREATE POLICY "notifications_select_admin" ON notifications FOR SELECT TO authenticated
  USING (public.current_user_is_admin());
DROP POLICY IF EXISTS "notifications_insert_admin" ON notifications;
CREATE POLICY "notifications_insert_admin" ON notifications FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin() AND created_by = auth.uid());
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  target_type text NOT NULL CHECK (target_type IN ('customers', 'technicians')),
  discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "offers_select_authenticated" ON offers;
CREATE POLICY "offers_select_authenticated" ON offers FOR SELECT TO authenticated
  USING (active = true AND (ends_at IS NULL OR ends_at > now()) OR public.current_user_is_admin());
DROP POLICY IF EXISTS "offers_insert_admin" ON offers;
CREATE POLICY "offers_insert_admin" ON offers FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin() AND created_by = auth.uid());
DROP POLICY IF EXISTS "offers_update_admin" ON offers;
CREATE POLICY "offers_update_admin" ON offers FOR UPDATE TO authenticated
  USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());
DROP POLICY IF EXISTS "offers_delete_admin" ON offers;
CREATE POLICY "offers_delete_admin" ON offers FOR DELETE TO authenticated
  USING (public.current_user_is_admin());
CREATE INDEX IF NOT EXISTS idx_offers_target_active ON offers(target_type, active, starts_at);

CREATE TABLE IF NOT EXISTS admin_financial_resets (
  id integer PRIMARY KEY CHECK (id = 1),
  profits_reset_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  invoices_reset_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);
INSERT INTO admin_financial_resets (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE admin_financial_resets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_resets_admin" ON admin_financial_resets;
CREATE POLICY "financial_resets_admin" ON admin_financial_resets FOR ALL TO authenticated
  USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
