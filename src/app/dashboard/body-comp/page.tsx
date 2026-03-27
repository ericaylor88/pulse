"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Scale,
  TrendingDown,
  TrendingUp,
  Minus,
  Dumbbell,
  Percent,
  ScanLine,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────

interface BodyCompRow {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
}

interface DexaScan {
  id: string;
  scan_date: string;
  total_body_fat_pct: number | null;
  total_lean_mass_kg: number | null;
  total_fat_mass_kg: number | null;
  total_bone_mass_kg: number | null;
  visceral_adipose_g: number | null;
  android_gynoid_ratio: number | null;
  trunk_fat_pct: number | null;
  left_arm_lean_kg: number | null;
  right_arm_lean_kg: number | null;
  left_leg_lean_kg: number | null;
  right_leg_lean_kg: number | null;
  t_score_spine: number | null;
  t_score_hip: number | null;
  notes: string | null;
}

// ─── Design Tokens ──────────────────────────────────────────────────────

const CHART_COLORS = {
  weight: "#60A5FA",  // accent-blue
  bodyFat: "#F87171", // accent-coral
  muscle: "#34D399",  // accent-emerald
};

// ─── Constants ───────────────────────────────────────────────────────────

const DATE_RANGES = [
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
  { label: "6mo", days: 180 },
  { label: "1yr", days: 365 },
  { label: "All", days: 730 },
];

const STAGGER_DELAY = 0.06;

// ─── Helpers ─────────────────────────────────────────────────────────────

function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

function gToLbs(g: number): number {
  return Math.round((g / 1000) * 2.20462 * 10) / 10;
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function computeChange(
  values: (number | null)[]
): { first: number; last: number; change: number; pctChange: number } | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return null;
  const first = valid[0];
  const last = valid[valid.length - 1];
  const change = last - first;
  const pctChange = first !== 0 ? (change / first) * 100 : 0;
  return { first, last, change, pctChange };
}

function computeStats(values: (number | null)[]): {
  avg: number;
  min: number;
  max: number;
  latest: number;
  count: number;
} | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return {
    avg: valid.reduce((a, b) => a + b, 0) / valid.length,
    min: Math.min(...valid),
    max: Math.max(...valid),
    latest: valid[valid.length - 1],
    count: valid.length,
  };
}

// ─── Trend Icon ──────────────────────────────────────────────────────────

function TrendIndicator({
  change,
  invertColor = false,
}: {
  change: number;
  invertColor?: boolean;
}) {
  const isUp = change > 0;
  const isDown = change < 0;
  const isFlat = Math.abs(change) < 0.1;

  // For body fat: down is good (green). For muscle: up is good (green).
  const isGood = invertColor ? isDown : isUp;
  const isBad = invertColor ? isUp : isDown;

  if (isFlat) {
    return (
      <div className="flex items-center gap-1" style={{ color: "var(--pulse-text-tertiary)" }}>
        <Minus className="h-3 w-3" />
        <span className="text-xs">Stable</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1"
      style={{
        color: isGood
          ? "var(--pulse-emerald)"
          : isBad
            ? "var(--pulse-coral)"
            : "var(--pulse-text-tertiary)",
      }}
    >
      {isUp ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      <span className="text-xs font-medium" style={{ fontFamily: "var(--font-data)" }}>
        {isUp ? "+" : ""}
        {Math.round(change * 10) / 10}
      </span>
    </div>
  );
}

// ─── Metric Summary Card ─────────────────────────────────────────────────

function MetricSummaryCard({
  icon: Icon,
  label,
  latestValue,
  unit,
  change,
  invertColor = false,
  color,
  sparkData,
  index = 0,
}: {
  icon: React.ElementType;
  label: string;
  latestValue: string;
  unit: string;
  change: number | null;
  invertColor?: boolean;
  color: string;
  sparkData: { date: string; value: number | null }[];
  index?: number;
}) {
  const filtered = sparkData.filter((d) => d.value !== null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * STAGGER_DELAY, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md p-1.5" style={{ background: "var(--pulse-bg-surface-raised)" }}>
              <Icon className="h-4 w-4" style={{ color: "var(--pulse-text-secondary)" }} />
            </div>
            <span className="text-xs font-medium" style={{ color: "var(--pulse-text-secondary)", letterSpacing: "0.02em" }}>
              {label}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)", letterSpacing: "-0.015em" }}>
                {latestValue}
              </span>
              <span className="ml-1 text-sm" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-tertiary)" }}>
                {unit}
              </span>
            </div>
            {change !== null && (
              <TrendIndicator change={change} invertColor={invertColor} />
            )}
          </div>
          {filtered.length > 1 && (
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={45}>
                <AreaChart data={filtered}>
                  <defs>
                    <linearGradient
                      id={`bodycomp-grad-${color.replace("#", "")}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#bodycomp-grad-${color.replace("#", "")})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Custom Chart Tooltip ────────────────────────────────────────────────

function BodyCompTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
    name: string;
  }>;
  label?: string;
}) {
  if (!active || !payload || !label) return null;

  const labels: Record<string, { label: string; unit: string }> = {
    weight: { label: "Weight", unit: "lbs" },
    bodyFat: { label: "Body Fat", unit: "%" },
    muscle: { label: "Muscle", unit: "lbs" },
  };

  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{
        background: "var(--pulse-bg-surface-overlay)",
        border: "1px solid var(--pulse-border-subtle)",
        boxShadow: "var(--pulse-glass-shadow)",
        backdropFilter: "blur(16px) saturate(1.2)",
      }}
    >
      <p
        className="mb-1 text-xs font-medium"
        style={{ color: "var(--pulse-text-tertiary)", fontFamily: "var(--font-data)" }}
      >
        {formatDateShort(label)}
      </p>
      {payload.map((entry) => {
        if (entry.value === null || entry.value === undefined) return null;
        const meta = labels[entry.dataKey] || {
          label: entry.dataKey,
          unit: "",
        };
        return (
          <p
            key={entry.dataKey}
            className="text-xs"
            style={{ color: entry.color, fontFamily: "var(--font-data)" }}
          >
            {meta.label}: {Math.round(entry.value * 10) / 10} {meta.unit}
          </p>
        );
      })}
    </div>
  );
}

// ─── DEXA Scan Card ──────────────────────────────────────────────────────

function DexaScanCard({
  scan,
  previousScan,
  index = 0,
}: {
  scan: DexaScan;
  previousScan?: DexaScan;
  index?: number;
}) {
  const fatPctChange =
    previousScan?.total_body_fat_pct && scan.total_body_fat_pct
      ? scan.total_body_fat_pct - previousScan.total_body_fat_pct
      : null;
  const leanChange =
    previousScan?.total_lean_mass_kg && scan.total_lean_mass_kg
      ? scan.total_lean_mass_kg - previousScan.total_lean_mass_kg
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * STAGGER_DELAY, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScanLine className="h-4 w-4" style={{ color: "var(--pulse-text-secondary)" }} />
              <CardTitle className="text-sm font-medium" style={{ color: "var(--pulse-text-primary)" }}>
                {formatDateLong(scan.scan_date)}
              </CardTitle>
            </div>
            {previousScan && (
              <Badge
                variant="outline"
                className="text-xs"
                style={{ borderColor: "var(--pulse-border-subtle)", color: "var(--pulse-text-secondary)" }}
              >
                vs {formatDateShort(previousScan.scan_date)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {scan.total_body_fat_pct !== null && (
              <div>
                <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>Body Fat</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                    {scan.total_body_fat_pct.toFixed(1)}%
                  </span>
                  {fatPctChange !== null && (
                    <TrendIndicator change={fatPctChange} invertColor />
                  )}
                </div>
              </div>
            )}
            {scan.total_lean_mass_kg !== null && (
              <div>
                <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>Lean Mass</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                    {kgToLbs(scan.total_lean_mass_kg)} lbs
                  </span>
                  {leanChange !== null && (
                    <TrendIndicator change={kgToLbs(leanChange)} />
                  )}
                </div>
              </div>
            )}
            {scan.total_fat_mass_kg !== null && (
              <div>
                <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>Fat Mass</p>
                <span className="text-lg font-bold" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                  {kgToLbs(scan.total_fat_mass_kg)} lbs
                </span>
              </div>
            )}
            {scan.total_bone_mass_kg !== null && (
              <div>
                <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>Bone Mass</p>
                <span className="text-lg font-bold" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                  {kgToLbs(scan.total_bone_mass_kg)} lbs
                </span>
              </div>
            )}
            {scan.visceral_adipose_g !== null && (
              <div>
                <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>VAT</p>
                <span className="text-lg font-bold" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                  {gToLbs(scan.visceral_adipose_g)} lbs
                </span>
              </div>
            )}
            {scan.android_gynoid_ratio !== null && (
              <div>
                <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>A/G Ratio</p>
                <span className="text-lg font-bold" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                  {scan.android_gynoid_ratio.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Regional lean breakdown */}
          {(scan.left_arm_lean_kg ||
            scan.right_arm_lean_kg ||
            scan.left_leg_lean_kg ||
            scan.right_leg_lean_kg) && (
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--pulse-border-subtle)" }}>
              <p className="mb-2 text-xs font-medium uppercase" style={{ color: "var(--pulse-text-tertiary)", letterSpacing: "0.05em" }}>
                Regional Lean Mass
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                {scan.left_arm_lean_kg !== null && (
                  <div>
                    <p className="text-[11px]" style={{ color: "var(--pulse-text-tertiary)" }}>Left Arm</p>
                    <span className="text-sm font-medium" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                      {kgToLbs(scan.left_arm_lean_kg)} lbs
                    </span>
                  </div>
                )}
                {scan.right_arm_lean_kg !== null && (
                  <div>
                    <p className="text-[11px]" style={{ color: "var(--pulse-text-tertiary)" }}>Right Arm</p>
                    <span className="text-sm font-medium" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                      {kgToLbs(scan.right_arm_lean_kg)} lbs
                    </span>
                  </div>
                )}
                {scan.left_leg_lean_kg !== null && (
                  <div>
                    <p className="text-[11px]" style={{ color: "var(--pulse-text-tertiary)" }}>Left Leg</p>
                    <span className="text-sm font-medium" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                      {kgToLbs(scan.left_leg_lean_kg)} lbs
                    </span>
                  </div>
                )}
                {scan.right_leg_lean_kg !== null && (
                  <div>
                    <p className="text-[11px]" style={{ color: "var(--pulse-text-tertiary)" }}>Right Leg</p>
                    <span className="text-sm font-medium" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                      {kgToLbs(scan.right_leg_lean_kg)} lbs
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* T-Scores */}
          {(scan.t_score_spine !== null || scan.t_score_hip !== null) && (
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--pulse-border-subtle)" }}>
              <p className="mb-2 text-xs font-medium uppercase" style={{ color: "var(--pulse-text-tertiary)", letterSpacing: "0.05em" }}>
                Bone Density T-Scores
              </p>
              <div className="flex gap-6">
                {scan.t_score_spine !== null && (
                  <div>
                    <p className="text-[11px]" style={{ color: "var(--pulse-text-tertiary)" }}>Spine</p>
                    <span
                      className="text-sm font-medium"
                      style={{
                        fontFamily: "var(--font-data)",
                        color: scan.t_score_spine >= -1
                          ? "var(--pulse-emerald)"
                          : scan.t_score_spine >= -2.5
                            ? "var(--pulse-amber)"
                            : "var(--pulse-coral)",
                      }}
                    >
                      {scan.t_score_spine > 0 ? "+" : ""}
                      {scan.t_score_spine.toFixed(1)}
                    </span>
                  </div>
                )}
                {scan.t_score_hip !== null && (
                  <div>
                    <p className="text-[11px]" style={{ color: "var(--pulse-text-tertiary)" }}>Hip</p>
                    <span
                      className="text-sm font-medium"
                      style={{
                        fontFamily: "var(--font-data)",
                        color: scan.t_score_hip >= -1
                          ? "var(--pulse-emerald)"
                          : scan.t_score_hip >= -2.5
                            ? "var(--pulse-amber)"
                            : "var(--pulse-coral)",
                      }}
                    >
                      {scan.t_score_hip > 0 ? "+" : ""}
                      {scan.t_score_hip.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {scan.notes && (
            <div className="mt-3 flex items-start gap-2 rounded-md p-2" style={{ background: "var(--pulse-bg-surface-raised)" }}>
              <Info className="mt-0.5 h-3 w-3 shrink-0" style={{ color: "var(--pulse-text-tertiary)" }} />
              <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>{scan.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function BodyCompPage() {
  const [bodyData, setBodyData] = useState<BodyCompRow[]>([]);
  const [dexaScans, setDexaScans] = useState<DexaScan[]>([]);
  const [rangeDays, setRangeDays] = useState(90);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const startDate = daysAgoStr(rangeDays);
    const end = todayStr();

    // Fetch body comp data from daily_metrics
    const { data: metricsData } = await supabase
      .from("daily_metrics")
      .select("date, weight_kg, body_fat_pct, muscle_mass_kg")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", end)
      .order("date", { ascending: true });

    // Fetch all DEXA scans
    const { data: dexaData } = await supabase
      .from("dexa_scans")
      .select("*")
      .eq("user_id", user.id)
      .order("scan_date", { ascending: false });

    setBodyData((metricsData as BodyCompRow[]) ?? []);
    setDexaScans((dexaData as DexaScan[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter to rows that have at least one body comp measurement
  const validData = bodyData.filter(
    (d) =>
      d.weight_kg !== null ||
      d.body_fat_pct !== null ||
      d.muscle_mass_kg !== null
  );

  // Chart data (convert kg to lbs)
  const chartData = validData.map((d) => ({
    date: d.date,
    weight: d.weight_kg !== null ? kgToLbs(d.weight_kg) : null,
    bodyFat: d.body_fat_pct,
    muscle: d.muscle_mass_kg !== null ? kgToLbs(d.muscle_mass_kg) : null,
  }));

  // Stats
  const weightStats = computeStats(
    validData.map((d) => (d.weight_kg !== null ? kgToLbs(d.weight_kg) : null))
  );
  const fatStats = computeStats(validData.map((d) => d.body_fat_pct));
  const muscleStats = computeStats(
    validData.map((d) =>
      d.muscle_mass_kg !== null ? kgToLbs(d.muscle_mass_kg) : null
    )
  );

  // Changes
  const weightChange = computeChange(
    validData.map((d) => (d.weight_kg !== null ? kgToLbs(d.weight_kg) : null))
  );
  const fatChange = computeChange(validData.map((d) => d.body_fat_pct));
  const muscleChange = computeChange(
    validData.map((d) =>
      d.muscle_mass_kg !== null ? kgToLbs(d.muscle_mass_kg) : null
    )
  );

  // Sparkline data
  const weightSpark = validData.map((d) => ({
    date: d.date,
    value: d.weight_kg !== null ? kgToLbs(d.weight_kg) : null,
  }));
  const fatSpark = validData.map((d) => ({
    date: d.date,
    value: d.body_fat_pct,
  }));
  const muscleSpark = validData.map((d) => ({
    date: d.date,
    value: d.muscle_mass_kg !== null ? kgToLbs(d.muscle_mass_kg) : null,
  }));

  // Average weight for reference line
  const avgWeight = weightStats?.avg ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Header */}
      <motion.div
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h2
            className="text-3xl font-bold"
            style={{ color: "var(--pulse-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}
          >
            Body Composition
          </h2>
          <p className="text-sm" style={{ color: "var(--pulse-text-secondary)" }}>
            Weight, body fat, and muscle mass trends from Withings + DEXA scans
          </p>
        </div>
        <div
          className="flex items-center gap-1 rounded-lg p-1"
          style={{ background: "var(--pulse-bg-surface)", border: "1px solid var(--pulse-border-subtle)" }}
        >
          {DATE_RANGES.map((r) => (
            <Button
              key={r.label}
              variant={rangeDays === r.days ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              style={{
                background: rangeDays === r.days ? "var(--pulse-brand)" : "transparent",
                color: rangeDays === r.days ? "#fff" : "var(--pulse-text-secondary)",
                fontFamily: "var(--font-data)",
              }}
              onClick={() => setRangeDays(r.days)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <div
          className="flex flex-1 items-center justify-center rounded-lg p-8"
          style={{ border: "1px dashed var(--pulse-border-subtle)" }}
        >
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--pulse-text-tertiary)", borderTopColor: "transparent" }}
          />
        </div>
      ) : validData.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center rounded-lg p-12"
          style={{ border: "1px dashed var(--pulse-border-subtle)" }}
        >
          <div className="text-center">
            <Scale className="mx-auto h-10 w-10" style={{ color: "var(--pulse-text-tertiary)", opacity: 0.5 }} />
            <p className="mt-3 text-lg font-medium" style={{ color: "var(--pulse-text-primary)" }}>
              No body composition data
            </p>
            <p className="text-sm" style={{ color: "var(--pulse-text-secondary)" }}>
              Connect your Withings Body Comp scale to start tracking
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Summary Cards ──────────────────────────────── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {weightStats && (
              <MetricSummaryCard
                icon={Scale}
                label="Weight"
                latestValue={weightStats.latest.toFixed(1)}
                unit="lbs"
                change={weightChange?.change ?? null}
                color={CHART_COLORS.weight}
                sparkData={weightSpark}
                index={0}
              />
            )}
            {fatStats && (
              <MetricSummaryCard
                icon={Percent}
                label="Body Fat"
                latestValue={fatStats.latest.toFixed(1)}
                unit="%"
                change={fatChange?.change ?? null}
                invertColor
                color={CHART_COLORS.bodyFat}
                sparkData={fatSpark}
                index={1}
              />
            )}
            {muscleStats && (
              <MetricSummaryCard
                icon={Dumbbell}
                label="Muscle Mass"
                latestValue={muscleStats.latest.toFixed(1)}
                unit="lbs"
                change={muscleChange?.change ?? null}
                color={CHART_COLORS.muscle}
                sparkData={muscleSpark}
                index={2}
              />
            )}
          </div>

          {/* ── Weight Trend Chart ─────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3 * STAGGER_DELAY, duration: 0.35 }}
          >
            <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium" style={{ color: "var(--pulse-text-primary)" }}>
                  Weight Trend
                </CardTitle>
                <CardDescription className="text-xs" style={{ color: "var(--pulse-text-tertiary)" }}>
                  {weightStats
                    ? `${weightStats.min.toFixed(1)} \u2013 ${weightStats.max.toFixed(1)} lbs range over ${weightStats.count} measurements`
                    : "No weight data"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {chartData.filter((d) => d.weight !== null).length > 1 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--pulse-border-subtle)"
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "var(--pulse-text-tertiary)", fontFamily: "var(--font-data)" }}
                        tickFormatter={formatDateShort}
                        interval="preserveStartEnd"
                        minTickGap={50}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--pulse-text-tertiary)", fontFamily: "var(--font-data)" }}
                        width={50}
                        domain={["dataMin - 2", "dataMax + 2"]}
                        tickFormatter={(v: number) => `${v}`}
                      />
                      {avgWeight > 0 && (
                        <ReferenceLine
                          y={avgWeight}
                          stroke="var(--pulse-text-tertiary)"
                          strokeDasharray="3 3"
                          opacity={0.4}
                          label={{
                            value: `Avg ${avgWeight.toFixed(1)}`,
                            position: "right",
                            fontSize: 10,
                            fill: "var(--pulse-text-tertiary)",
                          }}
                        />
                      )}
                      <RechartsTooltip content={<BodyCompTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke={CHART_COLORS.weight}
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: CHART_COLORS.weight, strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        connectNulls
                        name="Weight"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[250px] items-center justify-center text-sm" style={{ color: "var(--pulse-text-tertiary)" }}>
                    Not enough data points to chart
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Body Fat + Muscle Overlay Chart ────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 4 * STAGGER_DELAY, duration: 0.35 }}
          >
            <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium" style={{ color: "var(--pulse-text-primary)" }}>
                  Body Fat % &amp; Muscle Mass
                </CardTitle>
                <CardDescription>
                  <span className="inline-flex items-center gap-3 text-xs" style={{ color: "var(--pulse-text-tertiary)" }}>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS.bodyFat }} />
                      Body Fat %
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS.muscle }} />
                      Muscle Mass (lbs)
                    </span>
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {chartData.filter(
                  (d) => d.bodyFat !== null || d.muscle !== null
                ).length > 1 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--pulse-border-subtle)"
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "var(--pulse-text-tertiary)", fontFamily: "var(--font-data)" }}
                        tickFormatter={formatDateShort}
                        interval="preserveStartEnd"
                        minTickGap={50}
                      />
                      <YAxis
                        yAxisId="fat"
                        tick={{ fontSize: 11, fill: "var(--pulse-text-tertiary)", fontFamily: "var(--font-data)" }}
                        width={40}
                        domain={["auto", "auto"]}
                        label={{
                          value: "BF%",
                          angle: -90,
                          position: "insideLeft",
                          fontSize: 10,
                          fill: "var(--pulse-text-tertiary)",
                        }}
                      />
                      <YAxis
                        yAxisId="muscle"
                        orientation="right"
                        tick={{ fontSize: 11, fill: "var(--pulse-text-tertiary)", fontFamily: "var(--font-data)" }}
                        width={45}
                        domain={["auto", "auto"]}
                        label={{
                          value: "lbs",
                          angle: 90,
                          position: "insideRight",
                          fontSize: 10,
                          fill: "var(--pulse-text-tertiary)",
                        }}
                      />
                      <RechartsTooltip content={<BodyCompTooltip />} />
                      <Line
                        yAxisId="fat"
                        type="monotone"
                        dataKey="bodyFat"
                        stroke={CHART_COLORS.bodyFat}
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: CHART_COLORS.bodyFat, strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        connectNulls
                        name="Body Fat"
                      />
                      <Line
                        yAxisId="muscle"
                        type="monotone"
                        dataKey="muscle"
                        stroke={CHART_COLORS.muscle}
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: CHART_COLORS.muscle, strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        connectNulls
                        name="Muscle"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[250px] items-center justify-center text-sm" style={{ color: "var(--pulse-text-tertiary)" }}>
                    Not enough data points to chart
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Stats Table ────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 5 * STAGGER_DELAY, duration: 0.35 }}
          >
            <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium" style={{ color: "var(--pulse-text-primary)" }}>
                  Period Summary
                </CardTitle>
                <CardDescription className="text-xs" style={{ color: "var(--pulse-text-tertiary)" }}>
                  Statistics over the selected {rangeDays < 365 ? `${rangeDays}-day` : rangeDays === 365 ? "1-year" : "all-time"} range
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs" style={{ borderBottom: "1px solid var(--pulse-border-subtle)" }}>
                        <th className="pb-2 pr-4 font-medium" style={{ color: "var(--pulse-text-tertiary)", letterSpacing: "0.03em" }}>Metric</th>
                        <th className="pb-2 pr-4 font-medium text-right" style={{ color: "var(--pulse-text-tertiary)" }}>Latest</th>
                        <th className="pb-2 pr-4 font-medium text-right" style={{ color: "var(--pulse-text-tertiary)" }}>Avg</th>
                        <th className="pb-2 pr-4 font-medium text-right" style={{ color: "var(--pulse-text-tertiary)" }}>Min</th>
                        <th className="pb-2 pr-4 font-medium text-right" style={{ color: "var(--pulse-text-tertiary)" }}>Max</th>
                        <th className="pb-2 font-medium text-right" style={{ color: "var(--pulse-text-tertiary)" }}>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weightStats && (
                        <tr style={{ borderBottom: "1px solid var(--pulse-border-subtle)" }}>
                          <td className="py-2 pr-4 font-medium" style={{ color: "var(--pulse-text-primary)" }}>Weight</td>
                          <td className="py-2 pr-4 text-right" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                            {weightStats.latest.toFixed(1)} lbs
                          </td>
                          <td className="py-2 pr-4 text-right" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-secondary)" }}>
                            {weightStats.avg.toFixed(1)}
                          </td>
                          <td className="py-2 pr-4 text-right" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-secondary)" }}>
                            {weightStats.min.toFixed(1)}
                          </td>
                          <td className="py-2 pr-4 text-right" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-secondary)" }}>
                            {weightStats.max.toFixed(1)}
                          </td>
                          <td className="py-2 text-right">
                            {weightChange && (
                              <span
                                className="text-xs"
                                style={{
                                  fontFamily: "var(--font-data)",
                                  color: weightChange.change > 0
                                    ? "var(--pulse-coral)"
                                    : weightChange.change < 0
                                      ? "var(--pulse-emerald)"
                                      : "var(--pulse-text-tertiary)",
                                }}
                              >
                                {weightChange.change > 0 ? "+" : ""}
                                {weightChange.change.toFixed(1)} lbs
                              </span>
                            )}
                          </td>
                        </tr>
                      )}
                      {fatStats && (
                        <tr style={{ borderBottom: "1px solid var(--pulse-border-subtle)" }}>
                          <td className="py-2 pr-4 font-medium" style={{ color: "var(--pulse-text-primary)" }}>Body Fat</td>
                          <td className="py-2 pr-4 text-right" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                            {fatStats.latest.toFixed(1)}%
                          </td>
                          <td className="py-2 pr-4 text-right" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-secondary)" }}>
                            {fatStats.avg.toFixed(1)}%
                          </td>
                          <td className="py-2 pr-4 text-right" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-secondary)" }}>
                            {fatStats.min.toFixed(1)}%
                          </td>
                          <td className="py-2 pr-4 text-right" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-secondary)" }}>
                            {fatStats.max.toFixed(1)}%
                          </td>
                          <td className="py-2 text-right">
                            {fatChange && (
                              <span
                                className="text-xs"
                                style={{
                                  fontFamily: "var(--font-data)",
                                  color: fatChange.change > 0
                                    ? "var(--pulse-coral)"
                                    : fatChange.change < 0
                                      ? "var(--pulse-emerald)"
                                      : "var(--pulse-text-tertiary)",
                                }}
                              >
                                {fatChange.change > 0 ? "+" : ""}
                                {fatChange.change.toFixed(1)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      )}
                      {muscleStats && (
                        <tr>
                          <td className="py-2 pr-4 font-medium" style={{ color: "var(--pulse-text-primary)" }}>Muscle Mass</td>
                          <td className="py-2 pr-4 text-right" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-primary)" }}>
                            {muscleStats.latest.toFixed(1)} lbs
                          </td>
                          <td className="py-2 pr-4 text-right" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-secondary)" }}>
                            {muscleStats.avg.toFixed(1)}
                          </td>
                          <td className="py-2 pr-4 text-right" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-secondary)" }}>
                            {muscleStats.min.toFixed(1)}
                          </td>
                          <td className="py-2 pr-4 text-right" style={{ fontFamily: "var(--font-data)", color: "var(--pulse-text-secondary)" }}>
                            {muscleStats.max.toFixed(1)}
                          </td>
                          <td className="py-2 text-right">
                            {muscleChange && (
                              <span
                                className="text-xs"
                                style={{
                                  fontFamily: "var(--font-data)",
                                  color: muscleChange.change > 0
                                    ? "var(--pulse-emerald)"
                                    : muscleChange.change < 0
                                      ? "var(--pulse-coral)"
                                      : "var(--pulse-text-tertiary)",
                                }}
                              >
                                {muscleChange.change > 0 ? "+" : ""}
                                {muscleChange.change.toFixed(1)} lbs
                              </span>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── DEXA Scans Section ─────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 6 * STAGGER_DELAY, duration: 0.35 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--pulse-text-primary)" }}>
                  DEXA Scans
                </h3>
                <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>
                  Full-body composition analysis from BodySpec
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-xs"
                style={{ borderColor: "var(--pulse-border-subtle)", color: "var(--pulse-text-secondary)", fontFamily: "var(--font-data)" }}
              >
                {dexaScans.length} scan{dexaScans.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            {dexaScans.length === 0 ? (
              <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <ScanLine className="h-8 w-8" style={{ color: "var(--pulse-text-tertiary)", opacity: 0.5 }} />
                  <p className="mt-3 text-sm font-medium" style={{ color: "var(--pulse-text-primary)" }}>No DEXA scans yet</p>
                  <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>
                    DEXA scans from BodySpec will appear here when imported
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {dexaScans.map((scan, i) => (
                  <DexaScanCard
                    key={scan.id}
                    scan={scan}
                    previousScan={
                      i < dexaScans.length - 1 ? dexaScans[i + 1] : undefined
                    }
                    index={i}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
