-- Enable realtime feeds required by wallet and chat screens.

DO $$
DECLARE
  _tbl_name text;
BEGIN
  FOREACH _tbl_name IN ARRAY ARRAY['recharge_requests', 'wallets', 'chat_messages', 'orders', 'notifications'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND information_schema.tables.table_name = _tbl_name
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND pg_publication_tables.tablename = _tbl_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', _tbl_name);
    END IF;
  END LOOP;
END $$;

-- Wallet balances and ledger entries are server-owned financial data.
REVOKE INSERT, UPDATE, DELETE ON wallets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON financial_ledger FROM authenticated;

CREATE OR REPLACE FUNCTION initialize_technician_wallet()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_bonus numeric := 20;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician'
  ) THEN
    RAISE EXCEPTION 'technician authorization required';
  END IF;
  SELECT * INTO v_wallet FROM wallets WHERE technician_id = auth.uid() FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'balance', v_wallet.balance, 'created', false);
  END IF;
  INSERT INTO wallets (technician_id, balance, total_earnings, total_commission)
  VALUES (auth.uid(), v_bonus, 0, 0) RETURNING * INTO v_wallet;
  INSERT INTO financial_ledger (wallet_id, technician_id, type, amount, balance_before, balance_after, description)
  VALUES (v_wallet.id, auth.uid(), 'signup_bonus', v_bonus, 0, v_bonus, 'مكافأة التسجيل');
  UPDATE profiles SET promo_signup_bonus_used = true WHERE id = auth.uid();
  RETURN jsonb_build_object('success', true, 'balance', v_bonus, 'created', true);
END;
$$;

GRANT EXECUTE ON FUNCTION initialize_technician_wallet() TO authenticated;
