-- Migration 004: Enhanced dexa_scans for BodySpec API integration
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS bodyspec_result_id TEXT;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS scanner_model TEXT;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS patient_age_years NUMERIC(4,1);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS patient_height_cm NUMERIC(5,1);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS patient_weight_kg NUMERIC(5,1);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS total_body_fat_pct NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS total_lean_mass_kg NUMERIC(6,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS total_fat_mass_kg NUMERIC(6,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS total_bone_mass_kg NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS total_mass_kg NUMERIC(6,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS android_gynoid_ratio NUMERIC(4,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS android_fat_pct NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS gynoid_fat_pct NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS trunk_fat_pct NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS trunk_lean_kg NUMERIC(6,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS trunk_fat_kg NUMERIC(6,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS left_arm_lean_kg NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS right_arm_lean_kg NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS left_leg_lean_kg NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS right_leg_lean_kg NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS left_arm_fat_pct NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS right_arm_fat_pct NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS left_leg_fat_pct NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS right_leg_fat_pct NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS visceral_adipose_kg NUMERIC(5,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS visceral_adipose_cm3 NUMERIC(7,2);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS bmd_total NUMERIC(5,3);
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS bmd_t_percentile INTEGER;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS bmd_z_percentile INTEGER;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS percentile_body_fat INTEGER;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS percentile_lmi INTEGER;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS percentile_limb_lmi INTEGER;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS percentile_bmd INTEGER;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS percentile_vat INTEGER;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS percentile_gender TEXT;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS percentile_age_min INTEGER;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS percentile_age_max INTEGER;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS percentile_dataset_size INTEGER;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS rmr_avg_kcal INTEGER;
ALTER TABLE dexa_scans ADD COLUMN IF NOT EXISTS rmr_estimates JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dexa_bodyspec_rid
ON dexa_scans (bodyspec_result_id) WHERE bodyspec_result_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dexa_user_date
ON dexa_scans (user_id, scan_date DESC);
