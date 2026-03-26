"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Info,
  Zap,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Cell,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────

interface Correlation {
  id: string;
  variable_a: string;
  variable_b: string;
  lag_days: number;
  r_value: number;
  p_value: number;
  n: number;
  effect_size: string;
  confidence_tier: string;
  method: string;
  created_at: string;
}

// ─── Metric display config ───────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  recovery_score: "Recovery",
  hrv_rmssd: "HRV",
  resting_hr: "Resting HR",
  sleep_score: "Sleep Score",
  total_sleep_min: "Total Sleep",
  deep_sleep_min: "Deep Sleep",
  rem_sleep_min: "REM Sleep",
  strain_score: "Strain",
  calories_total: "Calories",
  spo2_pct: "SpO2",
  skin_temp_c: "Skin Temp",
  weight_kg: "Weight",
  body_fat_pct: "Body Fat %",
  muscle_mass_kg: "Muscle Mass",
  bp_systolic: "Systolic BP",
  bp_diastolic: "Diastolic BP",
  foam_rolling: "Foam Rolling",
  compression: "Compression",
  tea_before_bed: "Tea Before Bed",
  video_games: "Video Games",
  sex: "Sex",
  coffee_cups: "Coffee (cups)",
  coffee_last_time: "Coffee (last time)",
  alcohol_drinks: "Alcohol (drinks)",
  alcohol_last_time: "Alcohol (last time)",
  temp_max_c: "Temp (max)",
  humidity_pct: "Humidity",
  pressure_hpa: "Pressure",
  uv_index: "UV Index",
  aqi_us: "AQI",
  pm25: "PM2.5",
};

function metricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key.replace(/_/g, " ");
}

// ─── Confidence tier config ──────────────────────────────────────────────

const TIER_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  high: { color: "text-emerald-500", bgColor: "bg-emerald-500/10 border-emerald-500/30", label: "High Confidence" },
  medium: { color: "text-amber-500", bgColor: "bg-amber-500/10 border-amber-500/30", label: "Medium Confidence" },
  low: { color: "text-muted-foreground", bgColor: "bg-muted/30 border-border", label: "Low Confidence" },
};

// ─── Heatmap Cell ────────────────────────────────────────────────────────

function HeatmapCell({
  r,
  isSelected,
  onClick,
}: {
  r: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const absR = Math.abs(r);
  const isPositive = r >= 0;

  let bg: string;
  if (absR >= 0.4) bg = isPositive ? "bg-emerald-500" : "bg-red-400";
  else if (absR >= 0.25) bg = isPositive ? "bg-emerald-500/60" : "bg-red-400/60";
  else if (absR >= 0.15) bg = isPositive ? "bg-emerald-500/30" : "bg-red-400/30";
  else bg = "bg-muted/30";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-10 h-10 rounded-md text-[10px] font-mono font-medium transition-all flex items-center justify-center",
        bg,
        isSelected ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : "",
        absR >= 0.25 ? "text-white" : "text-muted-foreground"
      )}
      title={`r = ${r.toFixed(3)}`}
    >
      {r.toFixed(2)}
    </button>
  );
}

// ─── Correlation Detail Card ─────────────────────────────────────────────

function CorrelationDetail({ corr }: { corr: Correlation }) {
  const tier = TIER_CONFIG[corr.confidence_tier] ?? TIER_CONFIG.low;
  const isPositive = corr.r_value >= 0;
  const absR = Math.abs(corr.r_value);

  let strengthLabel = "Weak";
  if (absR >= 0.5) strengthLabel = "Strong";
  else if (absR >= 0.3) strengthLabel = "Moderate";

  const directionText = isPositive
    ? `Higher ${metricLabel(corr.variable_a)} is associated with higher ${metricLabel(corr.variable_b)}`
    : `Higher ${metricLabel(corr.variable_a)} is associated with lower ${metricLabel(corr.variable_b)}`;

  return (
    <Card className={cn("border", tier.bgColor)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">
              {metricLabel(corr.variable_a)} → {metricLabel(corr.variable_b)}
            </p>
            {corr.lag_days > 0 && (
              <p className="text-xs text-muted-foreground">
                {corr.lag_days}-day lag
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={cn("text-xl font-bold tabular-nums", tier.color)}>
              r = {corr.r_value.toFixed(3)}
            </p>
            <Badge variant="outline" className={cn("text-[10px]", tier.color)}>
              {tier.label}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          )}
          <span>{directionText}</span>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px]">
          <Badge variant="secondary">{strengthLabel} ({corr.effect_size})</Badge>
          <Badge variant="secondary">p = {corr.p_value < 0.001 ? "<0.001" : corr.p_value.toFixed(3)}</Badge>
          <Badge variant="secondary">n = {corr.n} days</Badge>
          <Badge variant="secondary">{corr.method}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function CorrelationsPage() {
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCorr, setSelectedCorr] = useState<Correlation | null>(null);
  const [filterTier, setFilterTier] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"r_value" | "p_value" | "n">("r_value");

  const supabase = createClient();

  const loadCorrelations = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("correlations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setCorrelations(data as Correlation[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadCorrelations(); }, [loadCorrelations]);

  // Filter and sort
  const filtered = correlations
    .filter((c) => !filterTier || c.confidence_tier === filterTier)
    .sort((a, b) => {
      if (sortBy === "r_value") return Math.abs(b.r_value) - Math.abs(a.r_value);
      if (sortBy === "p_value") return a.p_value - b.p_value;
      return b.n - a.n;
    });

  // Build unique variables for heatmap
  const variables = [...new Set(correlations.flatMap((c) => [c.variable_a, c.variable_b]))];
  const corrMap = new Map<string, Correlation>();
  for (const c of correlations) {
    corrMap.set(`${c.variable_a}__${c.variable_b}`, c);
    corrMap.set(`${c.variable_b}__${c.variable_a}`, c);
  }

  // Stats
  const highCount = correlations.filter((c) => c.confidence_tier === "high").length;
  const medCount = correlations.filter((c) => c.confidence_tier === "medium").length;
  const strongestPositive = correlations.reduce((best, c) =>
    c.r_value > (best?.r_value ?? -Infinity) ? c : best, null as Correlation | null);
  const strongestNegative = correlations.reduce((best, c) =>
    c.r_value < (best?.r_value ?? Infinity) ? c : best, null as Correlation | null);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 pb-8">
      <div>
        <h2 className="text-lg font-semibold">Correlations</h2>
        <p className="text-sm text-muted-foreground">
          Discover what actually affects your recovery, sleep, and health
        </p>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        </div>
      ) : correlations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium">No correlations computed yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                The correlation engine needs at least 60 days of data to find
                statistically significant patterns. Keep logging your habits and
                the engine will run automatically.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-2 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums text-emerald-500">90+</p>
                <p className="text-[10px] text-muted-foreground">days for High confidence</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-amber-500">60–90</p>
                <p className="text-[10px] text-muted-foreground">days for Medium</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-muted-foreground">{"<60"}</p>
                <p className="text-[10px] text-muted-foreground">days = Low</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-4 gap-2">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{correlations.length}</p>
                <p className="text-[10px] text-muted-foreground">Pairs Tested</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-emerald-500">{highCount}</p>
                <p className="text-[10px] text-muted-foreground">High Confidence</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-amber-500">{medCount}</p>
                <p className="text-[10px] text-muted-foreground">Medium</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">
                  {correlations.length - highCount - medCount}
                </p>
                <p className="text-[10px] text-muted-foreground">Low</p>
              </CardContent>
            </Card>
          </div>

          {/* Top findings */}
          {(strongestPositive || strongestNegative) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {strongestPositive && (
                <Card className="border-emerald-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <p className="text-xs text-muted-foreground">Strongest Positive</p>
                    </div>
                    <p className="text-sm font-medium">
                      {metricLabel(strongestPositive.variable_a)} → {metricLabel(strongestPositive.variable_b)}
                    </p>
                    <p className="text-lg font-bold text-emerald-500 tabular-nums">
                      r = {strongestPositive.r_value.toFixed(3)}
                    </p>
                  </CardContent>
                </Card>
              )}
              {strongestNegative && (
                <Card className="border-red-400/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="h-4 w-4 text-red-400" />
                      <p className="text-xs text-muted-foreground">Strongest Negative</p>
                    </div>
                    <p className="text-sm font-medium">
                      {metricLabel(strongestNegative.variable_a)} → {metricLabel(strongestNegative.variable_b)}
                    </p>
                    <p className="text-lg font-bold text-red-400 tabular-nums">
                      r = {strongestNegative.r_value.toFixed(3)}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Filter and sort controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Filter:</span>
            {[null, "high", "medium", "low"].map((tier) => (
              <button
                key={tier ?? "all"}
                onClick={() => setFilterTier(tier)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  filterTier === tier
                    ? "border-foreground/30 bg-foreground/5 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {tier ? TIER_CONFIG[tier].label : "All"}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">Sort:</span>
            {([["r_value", "|r|"], ["p_value", "p-value"], ["n", "Sample"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  sortBy === key
                    ? "border-foreground/30 bg-foreground/5 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Correlation list */}
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((corr) => (
              <CorrelationDetail key={corr.id} corr={corr} />
            ))}
          </div>

          {/* Disclaimer */}
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-4 flex gap-3">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>Correlation ≠ causation.</strong> These are statistical
                  associations based on your personal data. They suggest patterns
                  worth investigating, not proven cause-and-effect relationships.
                </p>
                <p>
                  Confidence tiers are based on sample size (n), effect size (|r|),
                  and statistical significance (p-value) with Holm correction for
                  multiple comparisons.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
