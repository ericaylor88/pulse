-- Migration: Weather + AQI columns for Open-Meteo integration
-- Run in Supabase SQL Editor before deploying

-- ═══════════════════════════════════════════════════════════════════
-- 1. Ensure weather_daily has all columns for Open-Meteo data
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS temp_max_c NUMERIC(4,1);

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS temp_min_c NUMERIC(4,1);

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS apparent_temp_max_c NUMERIC(4,1);

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS apparent_temp_min_c NUMERIC(4,1);

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS humidity_pct INTEGER;

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS pressure_hpa NUMERIC(6,1);

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS wind_speed_kmh NUMERIC(5,1);

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS wind_direction_deg INTEGER;

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS wind_gusts_kmh NUMERIC(5,1);

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS uv_index NUMERIC(3,1);

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS precipitation_mm NUMERIC(5,1);

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS pm25 NUMERIC(6,1);

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS pm10 NUMERIC(6,1);

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS ozone_ugm3 NUMERIC(6,1);

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS aqi_us INTEGER;

ALTER TABLE weather_daily
ADD COLUMN IF NOT EXISTS wildfire_pm10 NUMERIC(6,1);

-- ═══════════════════════════════════════════════════════════════════
-- 2. Ensure unique constraint for upsert
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'weather_daily_user_id_date_key'
  ) THEN
    ALTER TABLE weather_daily
    ADD CONSTRAINT weather_daily_user_id_date_key UNIQUE (user_id, date);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Ensure RLS is enabled
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE weather_daily ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own weather data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'weather_daily' AND policyname = 'Users can read own weather_daily'
  ) THEN
    CREATE POLICY "Users can read own weather_daily"
      ON weather_daily
      FOR SELECT
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Allow service_role to write weather data (sync runs as service_role)
-- This is handled automatically since service_role bypasses RLS

-- ═══════════════════════════════════════════════════════════════════
-- 4. Index for efficient lookups
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_weather_daily_user_date
  ON weather_daily (user_id, date DESC);
