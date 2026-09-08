-- Financial baseline controls and technician recharge notifications.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE notifications ALTER COLUMN created_by DROP NOT NULL;

DROP POLICY IF EXISTS "notifications_select_admin" ON notifications;
CREATE POLICY "notifications_select_admin" ON notifications FOR SELECT TO authenticated
USING (public.current_user_is_admin() OR recipient_id = auth.uid());

CREATE OR REPLACE FUNCTION reset_admin_financial_baseline(p_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF NOT public.current_user_is_admin() OR p_type NOT IN ('earnings', 'invoices') THEN
    RAISE EXCEPTION 'admin authorization required';
  END IF;
  IF p_type = 'earnings' THEN
    UPDATE admin_financial_resets SET profits_reset_at = v_now, updated_at = v_now, updated_by = auth.uid() WHERE id = 1;
  ELSE
    UPDATE admin_financial_resets SET invoices_reset_at = v_now, updated_at = v_now, updated_by = auth.uid() WHERE id = 1;
  END IF;
  RETURN jsonb_build_object('success', true, 'reset_at', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION reject_recharge(p_request_id uuid, p_admin_id uuid, p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request recharge_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_admin_id OR NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'admin authorization required';
  END IF;
  SELECT * INTO v_request FROM recharge_requests WHERE id = p_request_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed'); END IF;
  UPDATE recharge_requests SET status = 'rejected', admin_notes = left(trim(coalesce(p_reason, '')), 1000), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() WHERE id = p_request_id;
  INSERT INTO notifications (title, body, target_type, recipient_id, created_by)
  VALUES ('تحديث طلب التعبئة', 'تم رفض طلب التعبئة' || CASE WHEN trim(coalesce(p_reason, '')) = '' THEN '' ELSE ': ' || trim(p_reason) END, 'technicians', v_request.technician_id, auth.uid());
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION approve_recharge(p_request_id uuid, p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request recharge_requests%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_before numeric;
  v_after numeric;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_admin_id OR NOT public.current_user_is_admin() THEN RAISE EXCEPTION 'admin authorization required'; END IF;
  SELECT * INTO v_request FROM recharge_requests WHERE id = p_request_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed'); END IF;
  SELECT * INTO v_wallet FROM wallets WHERE technician_id = v_request.technician_id FOR UPDATE;
  IF NOT FOUND THEN INSERT INTO wallets (technician_id) VALUES (v_request.technician_id) RETURNING * INTO v_wallet; END IF;
  v_before := v_wallet.balance;
  v_after := v_before + v_request.voucher_value;
  UPDATE wallets SET balance = v_after, updated_at = now() WHERE id = v_wallet.id;
  INSERT INTO financial_ledger (wallet_id, technician_id, type, amount, balance_before, balance_after, description)
  VALUES (v_wallet.id, v_request.technician_id, 'recharge', v_request.voucher_value, v_before, v_after, 'اعتماد طلب تعبئة');
  UPDATE recharge_requests SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() WHERE id = p_request_id;
  INSERT INTO notifications (title, body, target_type, recipient_id, created_by)
  VALUES ('تم اعتماد التعبئة', 'تمت إضافة ' || v_request.voucher_value || ' د.ل إلى محفظتك', 'technicians', v_request.technician_id, auth.uid());
  RETURN jsonb_build_object('success', true, 'new_balance', v_after);
END;
$$;

GRANT EXECUTE ON FUNCTION reset_admin_financial_baseline(text) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_recharge(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_recharge(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "offers_select_authenticated" ON offers;
CREATE POLICY "offers_select_authenticated" ON offers FOR SELECT TO authenticated
USING (
  public.current_user_is_admin() OR
  (active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()))
);
