-- Complete payment atomically at customer confirmation and secure mutual reviews.

DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;
CREATE POLICY "reviews_insert_own" ON reviews FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = reviewer_id AND
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = reviews.order_id
      AND o.status = 'completed'
      AND ((o.customer_id = auth.uid() AND o.technician_id = reviews.reviewed_id)
        OR (o.technician_id = auth.uid() AND o.customer_id = reviews.reviewed_id))
  ) AND NOT EXISTS (
    SELECT 1 FROM reviews existing
    WHERE existing.order_id = reviews.order_id AND existing.reviewer_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION issue_invoice(p_order_id uuid, p_labor_cost numeric, p_parts_cost numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_customer profiles%ROWTYPE;
  v_subtotal numeric;
  v_discount numeric := 0;
  v_total numeric;
  v_rate numeric;
  v_commission numeric;
  v_exempt boolean;
  v_exempt_until timestamptz;
  v_invoice invoices%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_labor_cost < 0 OR p_parts_cost < 0 THEN
    RAISE EXCEPTION 'invalid request';
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.technician_id <> auth.uid() THEN
    RAISE EXCEPTION 'technician authorization required';
  END IF;
  IF v_order.status NOT IN ('work_done', 'in_progress') THEN
    RAISE EXCEPTION 'order is not ready for invoice';
  END IF;
  SELECT * INTO v_customer FROM profiles WHERE id = v_order.customer_id FOR UPDATE;
  v_subtotal := p_labor_cost + p_parts_cost;
  IF NOT v_customer.promo_discount_used THEN
    v_discount := LEAST(10, v_subtotal);
    UPDATE profiles SET promo_discount_used = true WHERE id = v_customer.id;
  END IF;
  v_total := v_subtotal - v_discount;
  SELECT commission_rate, commission_exempt, commission_exempt_until
    INTO v_rate, v_exempt, v_exempt_until
    FROM profiles WHERE id = auth.uid();
  v_commission := round(v_total * CASE
    WHEN v_exempt AND (v_exempt_until IS NULL OR v_exempt_until > now()) THEN 0
    ELSE COALESCE(v_rate, 10)
  END / 100, 2);

  INSERT INTO invoices (order_id, technician_id, customer_id, labor_cost, parts_cost, total,
    commission_amount, promo_discount, status)
  VALUES (p_order_id, auth.uid(), v_order.customer_id, p_labor_cost, p_parts_cost,
    v_total, v_commission, v_discount, 'issued')
  RETURNING * INTO v_invoice;
  UPDATE orders SET status = 'invoice_issued' WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice.id,
    'total', v_total, 'commission', v_commission, 'discount', v_discount);
END;
$$;

CREATE OR REPLACE FUNCTION confirm_payment(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_before numeric;
  v_after numeric;
  v_already_deducted boolean;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() <> v_invoice.customer_id THEN
    RAISE EXCEPTION 'customer authorization required';
  END IF;
  IF v_invoice.status <> 'issued' OR v_invoice.locked THEN
    RAISE EXCEPTION 'invoice is not payable';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM financial_ledger
    WHERE invoice_id = v_invoice.id AND type = 'commission'
  ) INTO v_already_deducted;
  IF NOT v_already_deducted THEN
    SELECT * INTO v_wallet FROM wallets WHERE technician_id = v_invoice.technician_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO wallets (technician_id) VALUES (v_invoice.technician_id) RETURNING * INTO v_wallet;
    END IF;
    v_before := v_wallet.balance;
    IF v_before < v_invoice.commission_amount THEN
      RAISE EXCEPTION 'technician wallet balance is insufficient';
    END IF;
    v_after := v_before - v_invoice.commission_amount;
    UPDATE wallets SET balance = v_after, total_commission = total_commission + v_invoice.commission_amount,
      updated_at = now() WHERE id = v_wallet.id;
    INSERT INTO financial_ledger (wallet_id, technician_id, order_id, invoice_id, type, amount,
      balance_before, balance_after, description)
    VALUES (v_wallet.id, v_invoice.technician_id, v_invoice.order_id, v_invoice.id, 'commission',
      -v_invoice.commission_amount, v_before, v_after, 'عمولة المنصة عند تأكيد الدفع');
  END IF;
  UPDATE invoices SET status = 'paid', locked = true, paid_at = now() WHERE id = p_invoice_id;
  UPDATE orders SET status = 'completed', completed_at = now() WHERE id = v_invoice.order_id;
  RETURN jsonb_build_object('success', true, 'commission', v_invoice.commission_amount);
END;
$$;

CREATE OR REPLACE FUNCTION submit_review(
  p_order_id uuid,
  p_reviewed_id uuid,
  p_rating integer,
  p_comment text DEFAULT ''
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_role text;
BEGIN
  IF auth.uid() IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid review';
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'completed order required';
  END IF;
  IF auth.uid() = v_order.customer_id AND p_reviewed_id = v_order.technician_id THEN
    v_role := 'customer';
  ELSIF auth.uid() = v_order.technician_id AND p_reviewed_id = v_order.customer_id THEN
    v_role := 'technician';
  ELSE
    RAISE EXCEPTION 'reviewer is not an order participant';
  END IF;
  IF EXISTS (SELECT 1 FROM reviews WHERE order_id = p_order_id AND reviewer_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'review already submitted');
  END IF;
  INSERT INTO reviews (order_id, reviewer_id, reviewed_id, reviewer_role, rating, comment)
  VALUES (p_order_id, auth.uid(), p_reviewed_id, v_role, p_rating, left(coalesce(p_comment, ''), 2000));
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION admin_adjust_wallet(
  p_technician_id uuid,
  p_amount numeric,
  p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_before numeric;
  v_after numeric;
BEGIN
  IF NOT public.current_user_is_admin() OR p_amount = 0 OR length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'invalid wallet adjustment';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_technician_id AND role = 'technician') THEN
    RAISE EXCEPTION 'technician not found';
  END IF;
  SELECT * INTO v_wallet FROM wallets WHERE technician_id = p_technician_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO wallets (technician_id) VALUES (p_technician_id) RETURNING * INTO v_wallet;
  END IF;
  v_before := v_wallet.balance;
  v_after := v_before + p_amount;
  IF v_after < 0 THEN RAISE EXCEPTION 'wallet balance cannot be negative'; END IF;
  UPDATE wallets SET balance = v_after, updated_at = now() WHERE id = v_wallet.id;
  INSERT INTO financial_ledger (wallet_id, technician_id, type, amount, balance_before, balance_after, description)
  VALUES (v_wallet.id, p_technician_id, CASE WHEN p_amount > 0 THEN 'admin_credit' ELSE 'admin_debit' END,
    p_amount, v_before, v_after, trim(p_reason));
  RETURN jsonb_build_object('success', true, 'balance', v_after);
END;
$$;

GRANT EXECUTE ON FUNCTION issue_invoice(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_review(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_adjust_wallet(uuid, numeric, text) TO authenticated;
