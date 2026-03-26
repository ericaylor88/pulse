/**
 * Blood Panel Biomarker Configuration
 *
 * Each biomarker has:
 * - Lab reference ranges (what most labs call "normal")
 * - Optimal ranges (what functional/preventive medicine considers ideal)
 * - Category grouping for UI organization
 * - Display metadata (unit, decimals, description)
 *
 * Sources: Peter Attia / Outlive, Bryan Johnson / Blueprint,
 * functional medicine consensus, published literature.
 *
 * IMPORTANT: These are for informational display only — never diagnose.
 */

export interface BiomarkerConfig {
  key: string;
  name: string;
  shortName: string;
  unit: string;
  category: BiomarkerCategory;
  decimals: number;
  labMin: number;
  labMax: number;
  optimalMin: number;
  optimalMax: number;
  lowerIsBetter?: boolean; // e.g. ApoB, hsCRP — lower = healthier
  description: string;
  whyItMatters: string;
}

export type BiomarkerCategory =
  | "lipids"
  | "metabolic"
  | "inflammation"
  | "thyroid"
  | "vitamins"
  | "minerals"
  | "liver"
  | "kidney"
  | "hormones"
  | "blood_count";

export const CATEGORY_LABELS: Record<BiomarkerCategory, string> = {
  lipids: "Lipids & Cardiovascular",
  metabolic: "Metabolic Health",
  inflammation: "Inflammation",
  thyroid: "Thyroid",
  vitamins: "Vitamins",
  minerals: "Minerals & Iron",
  liver: "Liver Function",
  kidney: "Kidney Function",
  hormones: "Hormones",
  blood_count: "Blood Count",
};

export const CATEGORY_EMOJIS: Record<BiomarkerCategory, string> = {
  lipids: "❤️",
  metabolic: "🔬",
  inflammation: "🔥",
  thyroid: "🦋",
  vitamins: "💊",
  minerals: "⚡",
  liver: "🫁",
  kidney: "💧",
  hormones: "🧬",
  blood_count: "🩸",
};

// Priority order for categories in UI
export const CATEGORY_ORDER: BiomarkerCategory[] = [
  "lipids",
  "metabolic",
  "inflammation",
  "thyroid",
  "vitamins",
  "minerals",
  "liver",
  "kidney",
  "hormones",
  "blood_count",
];

export const BIOMARKERS: BiomarkerConfig[] = [
  // ─── Lipids & Cardiovascular ────────────────────────────────────
  {
    key: "apob",
    name: "Apolipoprotein B",
    shortName: "ApoB",
    unit: "mg/dL",
    category: "lipids",
    decimals: 0,
    labMin: 40,
    labMax: 130,
    optimalMin: 20,
    optimalMax: 80,
    lowerIsBetter: true,
    description: "Best single predictor of cardiovascular risk. Counts all atherogenic particles.",
    whyItMatters: "Each ApoB particle can enter artery walls. Lower = fewer particles = lower CVD risk.",
  },
  {
    key: "ldl_c",
    name: "LDL Cholesterol",
    shortName: "LDL-C",
    unit: "mg/dL",
    category: "lipids",
    decimals: 0,
    labMin: 0,
    labMax: 100,
    optimalMin: 0,
    optimalMax: 100,
    lowerIsBetter: true,
    description: "Low-density lipoprotein cholesterol.",
    whyItMatters: "Tracks atherogenic cholesterol. ApoB is more precise, but LDL-C is widely tested.",
  },
  {
    key: "hdl_c",
    name: "HDL Cholesterol",
    shortName: "HDL-C",
    unit: "mg/dL",
    category: "lipids",
    decimals: 0,
    labMin: 40,
    labMax: 100,
    optimalMin: 55,
    optimalMax: 100,
    description: "High-density lipoprotein — 'good' cholesterol.",
    whyItMatters: "Higher HDL is associated with better reverse cholesterol transport and lower CVD risk.",
  },
  {
    key: "triglycerides",
    name: "Triglycerides",
    shortName: "TG",
    unit: "mg/dL",
    category: "lipids",
    decimals: 0,
    labMin: 0,
    labMax: 150,
    optimalMin: 0,
    optimalMax: 100,
    lowerIsBetter: true,
    description: "Fasting triglyceride level.",
    whyItMatters: "Marker of metabolic health. Elevated TG often signals insulin resistance.",
  },
  {
    key: "lpa",
    name: "Lipoprotein(a)",
    shortName: "Lp(a)",
    unit: "nmol/L",
    category: "lipids",
    decimals: 0,
    labMin: 0,
    labMax: 75,
    optimalMin: 0,
    optimalMax: 30,
    lowerIsBetter: true,
    description: "Genetically determined cardiovascular risk marker.",
    whyItMatters: "Lp(a) is 90% genetic. If elevated, it significantly increases CVD risk. Test once.",
  },

  // ─── Metabolic Health ───────────────────────────────────────────
  {
    key: "hba1c",
    name: "Hemoglobin A1c",
    shortName: "HbA1c",
    unit: "%",
    category: "metabolic",
    decimals: 1,
    labMin: 4.0,
    labMax: 5.6,
    optimalMin: 4.5,
    optimalMax: 5.2,
    lowerIsBetter: true,
    description: "3-month average blood sugar.",
    whyItMatters: "Gold standard for glucose control. Tracks diabetes risk and metabolic health.",
  },
  {
    key: "fasting_glucose",
    name: "Fasting Glucose",
    shortName: "Glucose",
    unit: "mg/dL",
    category: "metabolic",
    decimals: 0,
    labMin: 65,
    labMax: 99,
    optimalMin: 72,
    optimalMax: 90,
    lowerIsBetter: true,
    description: "Blood sugar after 8-12 hour fast.",
    whyItMatters: "Early marker of insulin resistance when combined with fasting insulin.",
  },
  {
    key: "fasting_insulin",
    name: "Fasting Insulin",
    shortName: "Insulin",
    unit: "µIU/mL",
    category: "metabolic",
    decimals: 1,
    labMin: 2.6,
    labMax: 24.9,
    optimalMin: 2.0,
    optimalMax: 8.0,
    lowerIsBetter: true,
    description: "Insulin level after 8-12 hour fast.",
    whyItMatters: "Rises years before glucose does. Best early warning for metabolic dysfunction.",
  },
  {
    key: "uric_acid",
    name: "Uric Acid",
    shortName: "Uric Acid",
    unit: "mg/dL",
    category: "metabolic",
    decimals: 1,
    labMin: 2.4,
    labMax: 8.0,
    optimalMin: 3.0,
    optimalMax: 5.5,
    lowerIsBetter: true,
    description: "Byproduct of purine metabolism.",
    whyItMatters: "Elevated levels linked to gout, kidney stones, and metabolic syndrome.",
  },

  // ─── Inflammation ───────────────────────────────────────────────
  {
    key: "hscrp",
    name: "High-Sensitivity C-Reactive Protein",
    shortName: "hsCRP",
    unit: "mg/L",
    category: "inflammation",
    decimals: 2,
    labMin: 0,
    labMax: 3.0,
    optimalMin: 0,
    optimalMax: 1.0,
    lowerIsBetter: true,
    description: "Systemic inflammation marker.",
    whyItMatters: "Chronic low-grade inflammation drives CVD, cancer, neurodegeneration. Track it.",
  },
  {
    key: "homocysteine",
    name: "Homocysteine",
    shortName: "Homocysteine",
    unit: "µmol/L",
    category: "inflammation",
    decimals: 1,
    labMin: 0,
    labMax: 15,
    optimalMin: 5,
    optimalMax: 10,
    lowerIsBetter: true,
    description: "Amino acid linked to methylation and B-vitamin status.",
    whyItMatters: "Elevated homocysteine is an independent CVD risk factor. MTHFR status matters here.",
  },

  // ─── Thyroid ────────────────────────────────────────────────────
  {
    key: "tsh",
    name: "Thyroid Stimulating Hormone",
    shortName: "TSH",
    unit: "mIU/L",
    category: "thyroid",
    decimals: 2,
    labMin: 0.45,
    labMax: 4.5,
    optimalMin: 0.5,
    optimalMax: 2.5,
    description: "Primary thyroid function screen.",
    whyItMatters: "Controls metabolism, energy, weight, mood. Subtle dysfunction is common and underdiagnosed.",
  },
  {
    key: "free_t3",
    name: "Free T3",
    shortName: "Free T3",
    unit: "pg/mL",
    category: "thyroid",
    decimals: 1,
    labMin: 2.0,
    labMax: 4.4,
    optimalMin: 3.0,
    optimalMax: 4.0,
    description: "Active thyroid hormone.",
    whyItMatters: "T3 is the active form. Low T3 with normal TSH can explain fatigue and sluggish recovery.",
  },
  {
    key: "free_t4",
    name: "Free T4",
    shortName: "Free T4",
    unit: "ng/dL",
    category: "thyroid",
    decimals: 2,
    labMin: 0.82,
    labMax: 1.77,
    optimalMin: 1.0,
    optimalMax: 1.5,
    description: "Thyroid prohormone — converts to active T3.",
    whyItMatters: "Shows how much raw thyroid hormone your body is producing.",
  },

  // ─── Vitamins ───────────────────────────────────────────────────
  {
    key: "vitamin_d",
    name: "25-Hydroxyvitamin D",
    shortName: "Vitamin D",
    unit: "ng/mL",
    category: "vitamins",
    decimals: 0,
    labMin: 30,
    labMax: 100,
    optimalMin: 50,
    optimalMax: 80,
    description: "Storage form of vitamin D. Reflects supplementation and sun exposure.",
    whyItMatters: "Critical for immune function, bone health, mood. Most people are suboptimal.",
  },
  {
    key: "vitamin_b12",
    name: "Vitamin B12",
    shortName: "B12",
    unit: "pg/mL",
    category: "vitamins",
    decimals: 0,
    labMin: 200,
    labMax: 1100,
    optimalMin: 500,
    optimalMax: 1000,
    description: "Essential for nerve function and red blood cell formation.",
    whyItMatters: "Low B12 causes fatigue, brain fog, neuropathy. Common in plant-based diets.",
  },
  {
    key: "folate",
    name: "Folate",
    shortName: "Folate",
    unit: "ng/mL",
    category: "vitamins",
    decimals: 1,
    labMin: 2.7,
    labMax: 17.0,
    optimalMin: 10,
    optimalMax: 20,
    description: "Vitamin B9 — essential for methylation.",
    whyItMatters: "MTHFR variants affect folate metabolism. Critical for homocysteine clearance.",
  },

  // ─── Minerals & Iron ───────────────────────────────────────────
  {
    key: "ferritin",
    name: "Ferritin",
    shortName: "Ferritin",
    unit: "ng/mL",
    category: "minerals",
    decimals: 0,
    labMin: 12,
    labMax: 300,
    optimalMin: 40,
    optimalMax: 150,
    description: "Iron storage protein. Best measure of iron status.",
    whyItMatters: "Too low = fatigue, hair loss. Too high = inflammation, oxidative stress.",
  },
  {
    key: "iron",
    name: "Serum Iron",
    shortName: "Iron",
    unit: "µg/dL",
    category: "minerals",
    decimals: 0,
    labMin: 38,
    labMax: 169,
    optimalMin: 60,
    optimalMax: 120,
    description: "Circulating iron level.",
    whyItMatters: "Interpret with ferritin and TIBC for a complete iron picture.",
  },
  {
    key: "magnesium",
    name: "Magnesium, RBC",
    shortName: "RBC Mg",
    unit: "mg/dL",
    category: "minerals",
    decimals: 1,
    labMin: 4.2,
    labMax: 6.8,
    optimalMin: 5.0,
    optimalMax: 6.5,
    description: "Red blood cell magnesium — more accurate than serum Mg.",
    whyItMatters: "Involved in 300+ enzymatic reactions. Most people are deficient.",
  },

  // ─── Liver Function ────────────────────────────────────────────
  {
    key: "alt",
    name: "Alanine Aminotransferase",
    shortName: "ALT",
    unit: "U/L",
    category: "liver",
    decimals: 0,
    labMin: 7,
    labMax: 56,
    optimalMin: 7,
    optimalMax: 25,
    lowerIsBetter: true,
    description: "Liver enzyme — primary marker of liver cell damage.",
    whyItMatters: "Sensitive marker for fatty liver. Optimal range is much tighter than lab normal.",
  },
  {
    key: "ast",
    name: "Aspartate Aminotransferase",
    shortName: "AST",
    unit: "U/L",
    category: "liver",
    decimals: 0,
    labMin: 10,
    labMax: 40,
    optimalMin: 10,
    optimalMax: 25,
    lowerIsBetter: true,
    description: "Liver/muscle enzyme. Can be elevated by exercise.",
    whyItMatters: "Interpret alongside ALT. Elevated AST with normal ALT may be exercise-related.",
  },
  {
    key: "ggt",
    name: "Gamma-Glutamyl Transferase",
    shortName: "GGT",
    unit: "U/L",
    category: "liver",
    decimals: 0,
    labMin: 0,
    labMax: 65,
    optimalMin: 0,
    optimalMax: 30,
    lowerIsBetter: true,
    description: "Enzyme sensitive to alcohol and metabolic stress.",
    whyItMatters: "Elevated GGT is an independent predictor of CVD and metabolic disease.",
  },

  // ─── Kidney Function ───────────────────────────────────────────
  {
    key: "creatinine",
    name: "Creatinine",
    shortName: "Creatinine",
    unit: "mg/dL",
    category: "kidney",
    decimals: 2,
    labMin: 0.74,
    labMax: 1.35,
    optimalMin: 0.8,
    optimalMax: 1.2,
    description: "Byproduct of muscle metabolism, filtered by kidneys.",
    whyItMatters: "High creatinine can indicate kidney dysfunction. Higher in muscular individuals.",
  },
  {
    key: "egfr",
    name: "Estimated GFR",
    shortName: "eGFR",
    unit: "mL/min",
    category: "kidney",
    decimals: 0,
    labMin: 60,
    labMax: 120,
    optimalMin: 90,
    optimalMax: 120,
    description: "Estimated glomerular filtration rate — kidney function.",
    whyItMatters: "Best overall measure of kidney function. Should stay above 90.",
  },

  // ─── Hormones ───────────────────────────────────────────────────
  {
    key: "testosterone_total",
    name: "Total Testosterone",
    shortName: "Total T",
    unit: "ng/dL",
    category: "hormones",
    decimals: 0,
    labMin: 264,
    labMax: 916,
    optimalMin: 500,
    optimalMax: 900,
    description: "Total testosterone — bound + free.",
    whyItMatters: "Affects muscle, energy, libido, mood, recovery. Lab 'normal' includes suboptimal.",
  },
  {
    key: "testosterone_free",
    name: "Free Testosterone",
    shortName: "Free T",
    unit: "pg/mL",
    category: "hormones",
    decimals: 1,
    labMin: 8.7,
    labMax: 25.1,
    optimalMin: 15,
    optimalMax: 25,
    description: "Bioavailable testosterone not bound to SHBG.",
    whyItMatters: "Free T is what your body actually uses. Can be low even with normal total T.",
  },
  {
    key: "cortisol_am",
    name: "Cortisol (AM)",
    shortName: "Cortisol",
    unit: "µg/dL",
    category: "hormones",
    decimals: 1,
    labMin: 6.2,
    labMax: 19.4,
    optimalMin: 10,
    optimalMax: 18,
    description: "Morning cortisol — stress hormone.",
    whyItMatters: "Should be highest in the morning. Flat cortisol curve signals HPA axis dysfunction.",
  },

  // ─── Blood Count ───────────────────────────────────────────────
  {
    key: "wbc",
    name: "White Blood Cell Count",
    shortName: "WBC",
    unit: "K/µL",
    category: "blood_count",
    decimals: 1,
    labMin: 3.4,
    labMax: 10.8,
    optimalMin: 4.0,
    optimalMax: 7.0,
    description: "Total white blood cells.",
    whyItMatters: "Elevated WBC is an independent predictor of CVD even within 'normal' range.",
  },
  {
    key: "rbc",
    name: "Red Blood Cell Count",
    shortName: "RBC",
    unit: "M/µL",
    category: "blood_count",
    decimals: 2,
    labMin: 4.14,
    labMax: 5.80,
    optimalMin: 4.5,
    optimalMax: 5.5,
    description: "Total red blood cells.",
    whyItMatters: "Oxygen-carrying capacity. Low = anemia. High = dehydration or polycythemia.",
  },
  {
    key: "hemoglobin",
    name: "Hemoglobin",
    shortName: "Hgb",
    unit: "g/dL",
    category: "blood_count",
    decimals: 1,
    labMin: 12.6,
    labMax: 17.7,
    optimalMin: 14.0,
    optimalMax: 17.0,
    description: "Oxygen-carrying protein in red blood cells.",
    whyItMatters: "Low Hgb = fatigue, poor exercise tolerance. Key for endurance athletes.",
  },
  {
    key: "hematocrit",
    name: "Hematocrit",
    shortName: "Hct",
    unit: "%",
    category: "blood_count",
    decimals: 1,
    labMin: 37.5,
    labMax: 51.0,
    optimalMin: 42,
    optimalMax: 49,
    description: "Percentage of blood volume that is red blood cells.",
    whyItMatters: "Affected by hydration, altitude, testosterone. Track for trends.",
  },
];

// ─── Lookup helpers ─────────────────────────────────────────────

export function getBiomarkerByKey(key: string): BiomarkerConfig | undefined {
  return BIOMARKERS.find((b) => b.key === key);
}

export function getBiomarkersByCategory(
  category: BiomarkerCategory
): BiomarkerConfig[] {
  return BIOMARKERS.filter((b) => b.category === category);
}

/**
 * Determine the "zone" for a biomarker value:
 * - "optimal" — within optimal range
 * - "normal" — within lab range but outside optimal
 * - "low" — below lab min
 * - "high" — above lab max
 * - "caution_low" — below optimal but within lab range
 * - "caution_high" — above optimal but within lab range
 */
export type BiomarkerZone =
  | "optimal"
  | "caution_low"
  | "caution_high"
  | "low"
  | "high";

export function getBiomarkerZone(
  config: BiomarkerConfig,
  value: number
): BiomarkerZone {
  if (value >= config.optimalMin && value <= config.optimalMax) return "optimal";
  if (value < config.labMin) return "low";
  if (value > config.labMax) return "high";
  if (value < config.optimalMin) return "caution_low";
  return "caution_high";
}

export const ZONE_COLORS: Record<BiomarkerZone, string> = {
  optimal: "text-emerald-500",
  caution_low: "text-amber-500",
  caution_high: "text-amber-500",
  low: "text-red-400",
  high: "text-red-400",
};

export const ZONE_BG_COLORS: Record<BiomarkerZone, string> = {
  optimal: "bg-emerald-500/10 border-emerald-500/30",
  caution_low: "bg-amber-500/10 border-amber-500/30",
  caution_high: "bg-amber-500/10 border-amber-500/30",
  low: "bg-red-400/10 border-red-400/30",
  high: "bg-red-400/10 border-red-400/30",
};

export const ZONE_LABELS: Record<BiomarkerZone, string> = {
  optimal: "Optimal",
  caution_low: "Below Optimal",
  caution_high: "Above Optimal",
  low: "Low",
  high: "High",
};
