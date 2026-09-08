-- Safe public technician data for discovery, calling, and live tracking.

CREATE OR REPLACE VIEW public.technician_public_profiles AS
SELECT
  id,
  full_name,
  phone,
  role,
  location_lat,
  location_lng,
  location_address,
  verification_status,
  technician_status,
  specialty,
  commission_rate,
  commission_exempt,
  commission_exempt_until,
  promo_discount_used,
  promo_signup_bonus_used,
  account_status,
  created_at,
  ''::text AS id_photo_url,
  '[]'::jsonb AS work_photos
FROM public.profiles
WHERE role = 'technician' AND verification_status = 'approved' AND account_status = 'active';

GRANT SELECT ON public.technician_public_profiles TO authenticated;
