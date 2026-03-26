-- Migration: Phase 3 Intelligence — recommendations + correlations enhancements
-- Run in Supabase SQL Editor before deploying

-- ═══════════════════════════════════════════════════════════════════
-- 1. Ensure recommendations has all columns
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'rule';

ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS source_variables JSONB DEFAULT '[]'::jsonb;

ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS acted_on BOOLEAN DEFAULT FALSE;

ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT FALSE;

ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS confidence_tier TEXT DEFAULT 'low';

ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS text TEXT;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Ensure correlations has all columns
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE correlations
ADD COLUMN IF NOT EXISTS variable_a TEXT;

ALTER TABLE correlations
ADD COLUMN IF NOT EXISTS variable_b TEXT;

ALTER TABLE correlations
ADD COLUMN IF NOT EXISTS lag_days INTEGER DEFAULT 0;

ALTER TABLE correlations
ADD COLUMN IF NOT EXISTS r_value NUMERIC(6,4);

ALTER TABLE correlations
ADD COLUMN IF NOT EXISTS p_value NUMERIC(10,8);

ALTER TABLE correlations
ADD COLUMN IF NOT EXISTS n INTEGER;

ALTER TABLE correlations
ADD COLUMN IF NOT EXISTS effect_size TEXT;

ALTER TABLE correlations
ADD COLUMN IF NOT EXISTS confidence_tier TEXT;

ALTER TABLE correlations
ADD COLUMN IF NOT EXISTS method TEXT;

-- ═══════════════════════════════════════════════════════════════════
-- 3. RLS on recommendations
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recommendations' AND policyname = 'Users can read own recommendations'
  ) THEN
    CREATE POLICY "Users can read own recommendations"
      ON recommendations
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recommendations' AND policyname = 'Users can update own recommendations'
  ) THEN
    CREATE POLICY "Users can update own recommendations"
      ON recommendations
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. RLS on correlations
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE correlations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'correlations' AND policyname = 'Users can read own correlations'
  ) THEN
    CREATE POLICY "Users can read own correlations"
      ON correlations
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. Indexes
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_recommendations_user_created
  ON recommendations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_correlations_user_tier
  ON correlations (user_id, confidence_tier);
