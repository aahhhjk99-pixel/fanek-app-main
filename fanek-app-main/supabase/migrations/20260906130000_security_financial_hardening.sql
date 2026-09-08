-- Security and financial hardening for production release.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason text DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by text DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS promo_discount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Client updates are limited to non-privileged profile fields. Admin mutations must use
-- a server-side function with an explicit role check.
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, phone, location_address, avatar_url) ON profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO authenticated USING (
  auth.uid() = id OR
  public.current_user_is_admin() OR
  (id_photo_url = '' AND (work_photos IS NULL OR work_photos = '[]'::jsonb))
);

-- Prevent direct client changes to financial/order state. The RPCs below own those transitions.
REVOKE UPDATE ON invoices FROM authenticated;
GRANT UPDATE (status, locked, paid_at) ON invoices TO authenticated;

DROP POLICY IF EXISTS "invoices_update_participants" ON invoices;
CREATE POLICY "invoices_update_participants" ON invoices FOR UPDATE TO authenticated
USING (auth.uid() = customer_id OR auth.uid() = technician_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (auth.uid() = customer_id OR auth.uid() = technician_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

REVOKE UPDATE ON orders FROM authenticated;
GRANT UPDATE (status, technician_id, accepted_at, completed_at, cancellation_reason, cancelled_by,
  location_lat, location_lng, location_address, description) ON orders TO authenticated;

DROP POLICY IF EXISTS "orders_update_participants" ON orders;
CREATE POLICY "orders_update_participants" ON orders FOR UPDATE TO authenticated
USING (auth.uid() = customer_id OR auth.uid() = technician_id OR
  (status = 'new' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (auth.uid() = customer_id OR auth.uid() = technician_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "disputes_update_admin" ON disputes;
CREATE POLICY "disputes_update_admin" ON disputes FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION approve_recharge(p_request_id uuid, p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request recharge_requests%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_before numeric;
  v_after numeric;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_admin_id OR NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin authorization required';
  END IF;

  SELECT * INTO v_request FROM recharge_requests
  WHERE id = p_request_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE technician_id = v_request.technician_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO wallets (technician_id) VALUES (v_request.technician_id) RETURNING * INTO v_wallet;
  END IF;

  v_before := v_wallet.balance;
  v_after := v_before + v_request.voucher_value;
  UPDATE wallets SET balance = v_after, updated_at = now() WHERE id = v_wallet.id;
  INSERT INTO financial_ledger (wallet_id, technician_id, type, amount, balance_before, balance_after, description)
  VALUES (v_wallet.id, v_request.technician_id, 'recharge', v_request.voucher_value,
    v_before, v_after, 'شحن محفظة');
  UPDATE recharge_requests SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;
  RETURN jsonb_build_object('success', true, 'new_balance', v_after);
END;
$$;

CREATE OR REPLACE FUNCTION issue_invoice(p_order_id uuid, p_labor_cost numeric, p_parts_cost numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_tech profiles%ROWTYPE;
  v_customer profiles%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_subtotal numeric;
  v_discount numeric := 0;
  v_total numeric;
  v_rate numeric;
  v_commission numeric;
  v_before numeric;
  v_invoice invoices%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_labor_cost < 0 OR p_parts_cost < 0 THEN
    RAISE EXCEPTION 'invalid request';
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.technician_id <> auth.uid() THEN RAISE EXCEPTION 'technician authorization required'; END IF;
  IF v_order.status NOT IN ('work_done', 'in_progress') THEN RAISE EXCEPTION 'order is not ready for invoice'; END IF;
  SELECT * INTO v_tech FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_customer FROM profiles WHERE id = v_order.customer_id FOR UPDATE;
  v_subtotal := p_labor_cost + p_parts_cost;
  IF NOT v_customer.promo_discount_used THEN
    v_discount := LEAST(10, v_subtotal);
    UPDATE profiles SET promo_discount_used = true WHERE id = v_customer.id;
  END IF;
  v_total := v_subtotal - v_discount;
  v_rate := CASE WHEN v_tech.commission_exempt AND (v_tech.commission_exempt_until IS NULL OR v_tech.commission_exempt_until > now())
    THEN 0 ELSE COALESCE(v_tech.commission_rate, 10) END;
  v_commission := round(v_total * v_rate / 100, 2);
  SELECT * INTO v_wallet FROM wallets WHERE technician_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN INSERT INTO wallets (technician_id) VALUES (auth.uid()) RETURNING * INTO v_wallet; END IF;
  v_before := v_wallet.balance;
  IF v_before < v_commission THEN RAISE EXCEPTION 'insufficient wallet balance'; END IF;
  UPDATE wallets SET balance = v_before - v_commission, total_commission = total_commission + v_commission, updated_at = now()
    WHERE id = v_wallet.id;
  INSERT INTO invoices (order_id, technician_id, customer_id, labor_cost, parts_cost, total, commission_amount, promo_discount, status)
    VALUES (p_order_id, auth.uid(), v_order.customer_id, p_labor_cost, p_parts_cost, v_total, v_commission, v_discount, 'issued')
    RETURNING * INTO v_invoice;
  INSERT INTO financial_ledger (wallet_id, technician_id, order_id, invoice_id, type, amount, balance_before, balance_after, description)
    VALUES (v_wallet.id, auth.uid(), p_order_id, v_invoice.id, 'commission', -v_commission, v_before, v_before - v_commission, 'عمولة المنصة');
  UPDATE orders SET status = 'invoice_issued' WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice.id, 'total', v_total, 'commission', v_commission, 'discount', v_discount);
END;
$$;

CREATE OR REPLACE FUNCTION confirm_payment(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() <> v_invoice.customer_id THEN RAISE EXCEPTION 'customer authorization required'; END IF;
  IF v_invoice.status <> 'issued' OR v_invoice.locked THEN RAISE EXCEPTION 'invoice is not payable'; END IF;
  UPDATE invoices SET status = 'paid', locked = true, paid_at = now() WHERE id = p_invoice_id;
  UPDATE orders SET status = 'completed', completed_at = now() WHERE id = v_invoice.order_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION cancel_order(p_order_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_invoice invoices%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_before numeric;
BEGIN
  IF auth.uid() IS NULL OR length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'cancellation reason is required';
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT (auth.uid() = v_order.customer_id OR auth.uid() = v_order.technician_id
    OR public.current_user_is_admin()) THEN
    RAISE EXCEPTION 'order authorization required';
  END IF;
  IF v_order.status IN ('completed', 'cancelled') THEN RAISE EXCEPTION 'order cannot be cancelled'; END IF;

  SELECT * INTO v_invoice FROM invoices WHERE order_id = p_order_id
    AND status IN ('issued', 'paid') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND v_invoice.commission_amount > 0 THEN
    SELECT * INTO v_wallet FROM wallets WHERE technician_id = v_invoice.technician_id FOR UPDATE;
    IF FOUND THEN
      v_before := v_wallet.balance;
      UPDATE wallets SET balance = v_before + v_invoice.commission_amount, updated_at = now()
        WHERE id = v_wallet.id;
      INSERT INTO financial_ledger (wallet_id, technician_id, order_id, invoice_id, type, amount,
        balance_before, balance_after, description)
        VALUES (v_wallet.id, v_invoice.technician_id, p_order_id, v_invoice.id, 'admin_credit',
          v_invoice.commission_amount, v_before, v_before + v_invoice.commission_amount, 'استرداد عمولة بسبب إلغاء الطلب');
      UPDATE invoices SET status = 'cancelled', locked = true WHERE id = v_invoice.id;
    END IF;
  END IF;
  UPDATE orders SET status = 'cancelled', cancellation_reason = trim(p_reason),
    cancelled_by = CASE WHEN public.current_user_is_admin() THEN 'admin' ELSE 'user' END
    WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_profile(
  p_profile_id uuid,
  p_role text DEFAULT NULL,
  p_commission_rate numeric DEFAULT NULL,
  p_verification_status text DEFAULT NULL,
  p_account_status text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN RAISE EXCEPTION 'admin authorization required'; END IF;
  IF p_role IS NOT NULL AND p_role NOT IN ('customer', 'technician', 'admin') THEN RAISE EXCEPTION 'invalid role'; END IF;
  IF p_commission_rate IS NOT NULL AND (p_commission_rate < 0 OR p_commission_rate > 100) THEN RAISE EXCEPTION 'invalid commission rate'; END IF;
  IF p_verification_status IS NOT NULL AND p_verification_status NOT IN ('pending', 'approved', 'rejected') THEN RAISE EXCEPTION 'invalid verification status'; END IF;
  IF p_account_status IS NOT NULL AND p_account_status NOT IN ('active', 'banned') THEN RAISE EXCEPTION 'invalid account status'; END IF;
  UPDATE profiles SET role = COALESCE(p_role, role), commission_rate = COALESCE(p_commission_rate, commission_rate),
    verification_status = COALESCE(p_verification_status, verification_status),
    account_status = COALESCE(p_account_status, account_status)
    WHERE id = p_profile_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION approve_recharge(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION issue_invoice(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_order(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_profile(uuid, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
