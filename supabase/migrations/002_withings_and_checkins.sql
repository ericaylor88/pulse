-- Migration: Withings support + check-in schema
-- Run in Supabase SQL Editor before deploying

-- ═══════════════════════════════════════════════════════════════════
-- 1. Add Withings-specific column to devices table
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE devices
ADD COLUMN IF NOT EXISTS withings_user_id TEXT;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Ensure daily_metrics has body comp + BP columns
--    (WHOOP sync created the table, these are Withings-specific)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE daily_metrics
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2);

ALTER TABLE daily_metrics
ADD COLUMN IF NOT EXISTS body_fat_pct NUMERIC(4,1);

ALTER TABLE daily_metrics
ADD COLUMN IF NOT EXISTS fat_mass_kg NUMERIC(5,2);

ALTER TABLE daily_metrics
ADD COLUMN IF NOT EXISTS muscle_mass_kg NUMERIC(5,2);

ALTER TABLE daily_metrics
ADD COLUMN IF NOT EXISTS bone_mass_kg NUMERIC(4,2);

ALTER TABLE daily_metrics
ADD COLUMN IF NOT EXISTS visceral_fat_index INTEGER;

ALTER TABLE daily_metrics
ADD COLUMN IF NOT EXISTS bp_systolic INTEGER;

ALTER TABLE daily_metrics
ADD COLUMN IF NOT EXISTS bp_diastolic INTEGER;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Ensure check_ins table has all habit columns
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS foam_rolling BOOLEAN DEFAULT FALSE;

ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS compression BOOLEAN DEFAULT FALSE;

ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS tea_before_bed BOOLEAN DEFAULT FALSE;

ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS video_games BOOLEAN DEFAULT FALSE;

ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS sex BOOLEAN DEFAULT FALSE;

ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS coffee_cups INTEGER DEFAULT 0;

ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS coffee_last_time TIME;

ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS alcohol_drinks INTEGER DEFAULT 0;

ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS alcohol_last_time TIME;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Ensure unique constraint for check_ins upsert
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_ins_user_id_date_key'
  ) THEN
    ALTER TABLE check_ins
    ADD CONSTRAINT check_ins_user_id_date_key UNIQUE (user_id, date);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. Ensure RLS on check_ins
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'check_ins' AND policyname = 'Users can manage own check_ins'
  ) THEN
    CREATE POLICY "Users can manage own check_ins"
      ON check_ins
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
