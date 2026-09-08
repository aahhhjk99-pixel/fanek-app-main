-- Clients may create customer/technician profiles, never an admin profile.

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id AND role IN ('customer', 'technician'));

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.current_user_is_admin())
WITH CHECK (auth.uid() = id OR public.current_user_is_admin());
