-- Repair legacy screens that were calling missing database objects.

CREATE TABLE IF NOT EXISTS technician_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE technician_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "certificates_select_owner_admin" ON technician_certificates;
CREATE POLICY "certificates_select_owner_admin" ON technician_certificates FOR SELECT TO authenticated
USING (technician_id = auth.uid() OR public.current_user_is_admin());
DROP POLICY IF EXISTS "certificates_insert_owner" ON technician_certificates;
CREATE POLICY "certificates_insert_owner" ON technician_certificates FOR INSERT TO authenticated
WITH CHECK (technician_id = auth.uid());
DROP POLICY IF EXISTS "certificates_delete_owner_admin" ON technician_certificates;
CREATE POLICY "certificates_delete_owner_admin" ON technician_certificates FOR DELETE TO authenticated
USING (technician_id = auth.uid() OR public.current_user_is_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "certificates_storage_insert_owner" ON storage.objects;
CREATE POLICY "certificates_storage_insert_owner" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "certificates_storage_delete_owner_admin" ON storage.objects;
CREATE POLICY "certificates_storage_delete_owner_admin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'certificates' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.current_user_is_admin()));
DROP POLICY IF EXISTS "certificates_storage_read" ON storage.objects;
CREATE POLICY "certificates_storage_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'certificates' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.current_user_is_admin()));

CREATE OR REPLACE FUNCTION refund_tech_commission(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_before numeric;
BEGIN
  IF NOT public.current_user_is_admin() THEN RAISE EXCEPTION 'admin authorization required'; END IF;
  SELECT * INTO v_invoice FROM invoices WHERE order_id = p_order_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_invoice.commission_amount <= 0 THEN RETURN jsonb_build_object('success', true, 'refunded', false); END IF;
  IF EXISTS (SELECT 1 FROM financial_ledger WHERE invoice_id = v_invoice.id AND type = 'admin_credit') THEN
    RETURN jsonb_build_object('success', true, 'refunded', false);
  END IF;
  SELECT * INTO v_wallet FROM wallets WHERE technician_id = v_invoice.technician_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'technician wallet not found'; END IF;
  v_before := v_wallet.balance;
  UPDATE wallets SET balance = v_before + v_invoice.commission_amount, updated_at = now() WHERE id = v_wallet.id;
  INSERT INTO financial_ledger (wallet_id, technician_id, order_id, invoice_id, type, amount, balance_before, balance_after, description)
  VALUES (v_wallet.id, v_invoice.technician_id, p_order_id, v_invoice.id, 'admin_credit', v_invoice.commission_amount,
    v_before, v_before + v_invoice.commission_amount, 'استرداد عمولة بسبب النزاع');
  RETURN jsonb_build_object('success', true, 'refunded', true);
END;
$$;
GRANT EXECUTE ON FUNCTION refund_tech_commission(uuid) TO authenticated;
