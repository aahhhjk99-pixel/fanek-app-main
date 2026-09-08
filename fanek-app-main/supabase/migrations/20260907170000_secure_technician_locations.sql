-- Realtime-safe technician coordinates without exposing private profile documents.

CREATE TABLE IF NOT EXISTS technician_locations (
  technician_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE technician_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "technician_locations_select_authenticated" ON technician_locations;
CREATE POLICY "technician_locations_select_authenticated" ON technician_locations FOR SELECT TO authenticated
USING (true);
DROP POLICY IF EXISTS "technician_locations_insert_own" ON technician_locations;
CREATE POLICY "technician_locations_insert_own" ON technician_locations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = technician_id);
DROP POLICY IF EXISTS "technician_locations_update_own" ON technician_locations;
CREATE POLICY "technician_locations_update_own" ON technician_locations FOR UPDATE TO authenticated
USING (auth.uid() = technician_id) WITH CHECK (auth.uid() = technician_id);

CREATE OR REPLACE FUNCTION sync_technician_location()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'technician' AND NEW.location_lat IS NOT NULL AND NEW.location_lng IS NOT NULL THEN
    INSERT INTO technician_locations (technician_id, latitude, longitude, updated_at)
    VALUES (NEW.id, NEW.location_lat, NEW.location_lng, now())
    ON CONFLICT (technician_id) DO UPDATE SET latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude, updated_at = EXCLUDED.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_technician_location ON profiles;
CREATE TRIGGER trg_sync_technician_location
AFTER INSERT OR UPDATE OF location_lat, location_lng ON profiles
FOR EACH ROW EXECUTE FUNCTION sync_technician_location();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'technician_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.technician_locations;
  END IF;
END $$;
