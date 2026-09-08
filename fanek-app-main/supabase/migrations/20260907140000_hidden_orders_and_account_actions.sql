-- Per-user hiding of completed orders and secure account actions.

CREATE TABLE IF NOT EXISTS hidden_orders (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, order_id)
);

ALTER TABLE hidden_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hidden_orders_select_own" ON hidden_orders;
CREATE POLICY "hidden_orders_select_own" ON hidden_orders FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.current_user_is_admin());
DROP POLICY IF EXISTS "hidden_orders_insert_own" ON hidden_orders;
CREATE POLICY "hidden_orders_insert_own" ON hidden_orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "hidden_orders_delete_own" ON hidden_orders;
CREATE POLICY "hidden_orders_delete_own" ON hidden_orders FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.current_user_is_admin());

CREATE INDEX IF NOT EXISTS idx_hidden_orders_user ON hidden_orders(user_id);
