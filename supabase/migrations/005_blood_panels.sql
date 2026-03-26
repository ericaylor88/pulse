-- Migration: Blood panel enhancements
-- Ensures blood_panels table has all needed columns for biomarker tracking
-- Run in Supabase SQL Editor before deploying

-- ═══════════════════════════════════════════════════════════════════
-- 1. Ensure blood_panels has all columns
-- ═══════════════════════════════════════════════════════════════════

-- Panel-level metadata
ALTER TABLE blood_panels
ADD COLUMN IF NOT EXISTS panel_date DATE;

ALTER TABLE blood_panels
ADD COLUMN IF NOT EXISTS lab_name TEXT;

ALTER TABLE blood_panels
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Biomarker columns (each biomarker is its own column for easy querying)
ALTER TABLE blood_panels
ADD COLUMN IF NOT EXISTS biomarker TEXT NOT NULL DEFAULT '';

ALTER TABLE blood_panels
ADD COLUMN IF NOT EXISTS value NUMERIC(10,3);

ALTER TABLE blood_panels
ADD COLUMN IF NOT EXISTS unit TEXT;

ALTER TABLE blood_panels
ADD COLUMN IF NOT EXISTS ref_range_min NUMERIC(10,3);

ALTER TABLE blood_panels
ADD COLUMN IF NOT EXISTS ref_range_max NUMERIC(10,3);

ALTER TABLE blood_panels
ADD COLUMN IF NOT EXISTS optimal_min NUMERIC(10,3);

ALTER TABLE blood_panels
ADD COLUMN IF NOT EXISTS optimal_max NUMERIC(10,3);

-- ═══════════════════════════════════════════════════════════════════
-- 2. Unique constraint for upsert (one value per biomarker per panel date)
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'blood_panels_user_date_biomarker_key'
  ) THEN
    ALTER TABLE blood_panels
    ADD CONSTRAINT blood_panels_user_date_biomarker_key
    UNIQUE (user_id, panel_date, biomarker);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. RLS
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE blood_panels ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blood_panels' AND policyname = 'Users can manage own blood_panels'
  ) THEN
    CREATE POLICY "Users can manage own blood_panels"
      ON blood_panels
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Indexes
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_blood_panels_user_date
  ON blood_panels (user_id, panel_date DESC);

CREATE INDEX IF NOT EXISTS idx_blood_panels_biomarker
  ON blood_panels (user_id, biomarker, panel_date DESC);
