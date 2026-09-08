-- Final interactive permissions and atomic dispute resolution.

GRANT UPDATE (technician_status) ON profiles TO authenticated;
GRANT SELECT ON offers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON offers TO authenticated;
GRANT SELECT ON services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON services TO authenticated;
GRANT SELECT ON notifications TO authenticated;
GRANT INSERT ON notifications TO authenticated;

CREATE OR REPLACE FUNCTION resolve_dispute(
  p_dispute_id uuid,
  p_resolution text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dispute disputes%ROWTYPE;
  v_invoice invoices%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_before numeric;
BEGIN
  IF NOT public.current_user_is_admin() OR p_resolution NOT IN ('resolved_customer', 'resolved_technician') THEN
    RAISE EXCEPTION 'admin authorization required';
  END IF;
  SELECT * INTO v_dispute FROM disputes WHERE id = p_dispute_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Dispute not found or already resolved'); END IF;
  SELECT * INTO v_invoice FROM invoices WHERE id = v_dispute.invoice_id FOR UPDATE;

  IF p_resolution = 'resolved_customer' AND v_invoice.commission_amount > 0 THEN
    IF EXISTS (SELECT 1 FROM financial_ledger WHERE invoice_id = v_invoice.id AND type = 'admin_credit') THEN
      NULL;
    ELSE
      SELECT * INTO v_wallet FROM wallets WHERE technician_id = v_invoice.technician_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'technician wallet not found'; END IF;
      v_before := v_wallet.balance;
      UPDATE wallets SET balance = v_before + v_invoice.commission_amount, updated_at = now() WHERE id = v_wallet.id;
      INSERT INTO financial_ledger (wallet_id, technician_id, order_id, invoice_id, type, amount, balance_before, balance_after, description)
      VALUES (v_wallet.id, v_invoice.technician_id, v_dispute.order_id, v_invoice.id, 'admin_credit', v_invoice.commission_amount,
        v_before, v_before + v_invoice.commission_amount, 'استرداد عمولة بسبب النزاع');
    END IF;
  END IF;

  UPDATE disputes SET status = p_resolution, resolved_at = now() WHERE id = p_dispute_id;
  UPDATE invoices SET locked = false, status = CASE WHEN p_resolution = 'resolved_technician' THEN 'paid' ELSE 'cancelled' END,
    paid_at = CASE WHEN p_resolution = 'resolved_technician' THEN now() ELSE NULL END WHERE id = v_dispute.invoice_id;
  UPDATE orders SET status = CASE WHEN p_resolution = 'resolved_technician' THEN 'completed' ELSE 'cancelled' END,
    completed_at = CASE WHEN p_resolution = 'resolved_technician' THEN now() ELSE NULL END WHERE id = v_dispute.order_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_dispute(uuid, text) TO authenticated;
