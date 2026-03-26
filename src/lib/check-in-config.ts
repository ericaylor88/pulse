/**
 * Daily Check-in Configuration
 *
 * Defines all tracked habits and their input types.
 * Single source of truth for the check-in UI.
 * Maps directly to columns in the `check_ins` table.
 */

export interface ToggleHabit {
  type: "toggle";
  id: string;
  label: string;
  emoji: string;
  description?: string;
  dbColumn: string;
}

export interface QuantityHabit {
  type: "quantity";
  id: string;
  label: string;
  emoji: string;
  description?: string;
  dbColumn: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  timeField?: {
    label: string;
    dbColumn: string;
  };
}

export type HabitConfig = ToggleHabit | QuantityHabit;

export const HABITS: HabitConfig[] = [
  // ── Toggles ─────────────────────────────────────────────────
  {
    type: "toggle",
    id: "foam_rolling",
    label: "Foam Rolling",
    emoji: "🧘",
    description: "Any foam rolling or myofascial release",
    dbColumn: "foam_rolling",
  },
  {
    type: "toggle",
    id: "compression",
    label: "Compression",
    emoji: "🦵",
    description: "JetBoots or pneumatic compression",
    dbColumn: "compression",
  },
  {
    type: "toggle",
    id: "tea_before_bed",
    label: "Tea Before Bed",
    emoji: "🍵",
    description: "Any tea within 2 hours of sleep",
    dbColumn: "tea_before_bed",
  },
  {
    type: "toggle",
    id: "video_games",
    label: "Video Games",
    emoji: "🎮",
    description: "Gaming before bed",
    dbColumn: "video_games",
  },
  {
    type: "toggle",
    id: "sex",
    label: "Sex",
    emoji: "❤️‍🔥",
    dbColumn: "sex",
  },

  // ── Quantities ──────────────────────────────────────────────
  {
    type: "quantity",
    id: "coffee",
    label: "Coffee",
    emoji: "☕",
    description: "Total cups consumed today",
    dbColumn: "coffee_cups",
    unit: "cups",
    min: 0,
    max: 10,
    step: 1,
    timeField: {
      label: "Last cup at",
      dbColumn: "coffee_last_time",
    },
  },
  {
    type: "quantity",
    id: "alcohol",
    label: "Alcohol",
    emoji: "🍷",
    description: "Standard drinks consumed",
    dbColumn: "alcohol_drinks",
    unit: "drinks",
    min: 0,
    max: 15,
    step: 1,
    timeField: {
      label: "Last drink at",
      dbColumn: "alcohol_last_time",
    },
  },
];
