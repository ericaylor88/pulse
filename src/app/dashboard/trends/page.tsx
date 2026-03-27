"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ─── Metric Definitions ──────────────────────────────────────────────────

interface MetricDef {
  key: string;
  label: string;
  shortLabel: string;
  unit: string;
  color: string;
  group: string;
  format?: (v: number) => number;
  table: "daily_metrics" | "weather_daily";
}

const kgToLbs = (kg: number) => Math.round(kg * 2.20462 * 10) / 10;
const minToHr = (min: number) => Math.round((min / 60) * 10) / 10;
const cToF = (c: number) => Math.round((c * 9) / 5 + 32);

// Colors from the design spec categorical palette
const METRICS: MetricDef[] = [
  // Recovery & vitals
  { key: "recovery_score", label: "Recovery Score", shortLabel: "Recovery", unit: "%", color: "#34D399", group: "Recovery", table: "daily_metrics" },
  { key: "hrv_rmssd_ms", label: "HRV (RMSSD)", shortLabel: "HRV", unit: "ms", color: "#6366F1", group: "Recovery", table: "daily_metrics" },
  { key: "resting_hr_bpm", label: "Resting Heart Rate", shortLabel: "RHR", unit: "bpm", color: "#F87171", group: "Recovery", table: "daily_metrics" },
  { key: "spo2_pct", label: "SpO₂", shortLabel: "SpO₂", unit: "%", color: "#60A5FA", group: "Recovery", table: "daily_metrics" },
  { key: "skin_temp_c", label: "Skin Temperature", shortLabel: "Skin Temp", unit: "°F", color: "#FBBF24", group: "Recovery", format: cToF, table: "daily_metrics" },
  { key: "respiratory_rate", label: "Respiratory Rate", shortLabel: "Resp Rate", unit: "rpm", color: "#A78BFA", group: "Recovery", table: "daily_metrics" },

  // Sleep
  { key: "sleep_total_min", label: "Total Sleep", shortLabel: "Sleep", unit: "hrs", color: "#60A5FA", group: "Sleep", format: minToHr, table: "daily_metrics" },
  { key: "sleep_rem_min", label: "REM Sleep", shortLabel: "REM", unit: "hrs", color: "#A78BFA", group: "Sleep", format: minToHr, table: "daily_metrics" },
  { key: "sleep_deep_min", label: "Deep Sleep", shortLabel: "Deep", unit: "hrs", color: "#6366F1", group: "Sleep", format: minToHr, table: "daily_metrics" },
  { key: "sleep_efficiency", label: "Sleep Efficiency", shortLabel: "Efficiency", unit: "%", color: "#2DD4BF", group: "Sleep", table: "daily_metrics" },

  // Strain
  { key: "strain_score", label: "Strain Score", shortLabel: "Strain", unit: "", color: "#FBBF24", group: "Strain", table: "daily_metrics" },
  { key: "calories_total", label: "Total Calories", shortLabel: "Cals", unit: "kcal", color: "#FB923C", group: "Strain", table: "daily_metrics" },

  // Body
  { key: "weight_kg", label: "Weight", shortLabel: "Weight", unit: "lbs", color: "#60A5FA", group: "Body", format: kgToLbs, table: "daily_metrics" },
  { key: "body_fat_pct", label: "Body Fat", shortLabel: "BF%", unit: "%", color: "#F87171", group: "Body", table: "daily_metrics" },
  { key: "muscle_mass_kg", label: "Muscle Mass", shortLabel: "Muscle", unit: "lbs", color: "#34D399", group: "Body", format: kgToLbs, table: "daily_metrics" },

  // Blood pressure
  { key: "bp_systolic", label: "Systolic BP", shortLabel: "Systolic", unit: "mmHg", color: "#F87171", group: "Blood Pressure", table: "daily_metrics" },
  { key: "bp_diastolic", label: "Diastolic BP", shortLabel: "Diastolic", unit: "mmHg", color: "#60A5FA", group: "Blood Pressure", table: "daily_metrics" },

  // Weather
  { key: "temp_max_c", label: "Temperature (High)", shortLabel: "Temp High", unit: "°F", color: "#FBBF24", group: "Weather", format: cToF, table: "weather_daily" },
  { key: "humidity_pct", label: "Humidity", shortLabel: "Humidity", unit: "%", color: "#2DD4BF", group: "Weather", table: "weather_daily" },
  { key: "aqi_us", label: "AQI (US)", shortLabel: "AQI", unit: "", color: "#A78BFA", group: "Weather", table: "weather_daily" },
  { key: "uv_index", label: "UV Index", shortLabel: "UV", unit: "", color: "#FB923C", group: "Weather", table: "weather_daily" },
  { key: "pm25", label: "PM2.5", shortLabel: "PM2.5", unit: "μg/m³", color: "#F87171", group: "Weather", table: "weather_daily" },
];

const METRIC_GROUPS = [...new Set(METRICS.map((m) => m.group))];

const DATE_RANGES = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
  { label: "All", days: 365 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

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

function computeStats(values: (number | null)[]): {
  avg: number;
  min: number;
  max: number;
  trend: number;
} | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const first3 = valid.slice(0, Math.min(3, valid.length));
  const last3 = valid.slice(-Math.min(3, valid.length));
  const first3Avg = first3.reduce((a, b) => a + b, 0) / first3.length;
  const last3Avg = last3.reduce((a, b) => a + b, 0) / last3.length;
  const trend =
    first3Avg !== 0 ? ((last3Avg - first3Avg) / first3Avg) * 100 : 0;
  return { avg, min, max, trend };
}

// ─── Animation variants ─────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 20 },
  },
};

// ─── Custom Tooltip ─────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
  selectedMetrics,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
  selectedMetrics: MetricDef[];
}) {
  if (!active || !payload || !label) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 backdrop-blur-sm"
      style={{
        background: "var(--pulse-bg-surface-overlay)",
        border: "1px solid var(--pulse-border-subtle)",
        boxShadow: "var(--pulse-glass-shadow)",
      }}
    >
      <p
        className="mb-1.5 text-xs font-medium"
        style={{ color: "var(--pulse-text-tertiary)", fontFamily: "var(--font-data)" }}
      >
        {formatDateShort(label)}
      </p>
      {payload.map((entry) => {
        const metric = selectedMetrics.find((m) => m.key === entry.dataKey);
        if (!metric || entry.value === null || entry.value === undefined)
          return null;
        const displayVal = Math.round(entry.value * 10) / 10;
        return (
          <p
            key={entry.dataKey}
            className="text-xs font-medium"
            style={{ color: entry.color, fontFamily: "var(--font-data)" }}
          >
            {metric.shortLabel}:{" "}
            <span className="font-semibold">
              {displayVal}
              {metric.unit ? ` ${metric.unit}` : ""}
            </span>
          </p>
        );
      })}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function TrendsPage() {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([
    "recovery_score",
    "hrv_rmssd_ms",
  ]);
  const [rangeDays, setRangeDays] = useState(30);
  const [metricsData, setMetricsData] = useState<Record<string, unknown>[]>([]);
  const [weatherData, setWeatherData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const selectedMetrics = selectedKeys
    .map((k) => METRICS.find((m) => m.key === k))
    .filter((m): m is MetricDef => !!m);

  const needsMetrics = selectedMetrics.some(
    (m) => m.table === "daily_metrics"
  );
  const needsWeather = selectedMetrics.some(
    (m) => m.table === "weather_daily"
  );

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
    const promises: Promise<void>[] = [];

    if (needsMetrics) {
      const cols = selectedMetrics
        .filter((m) => m.table === "daily_metrics")
        .map((m) => m.key);
      promises.push(
        (async () => {
          const { data } = await supabase
            .from("daily_metrics")
            .select(`date,${cols.join(",")}`)
            .eq("user_id", user.id)
            .gte("date", startDate)
            .lte("date", end)
            .order("date", { ascending: true });
          setMetricsData((data as unknown as Record<string, unknown>[]) ?? []);
        })()
      );
    } else {
      setMetricsData([]);
    }

    if (needsWeather) {
      const cols = selectedMetrics
        .filter((m) => m.table === "weather_daily")
        .map((m) => m.key);
      promises.push(
        (async () => {
          const { data } = await supabase
            .from("weather_daily")
            .select(`date,${cols.join(",")}`)
            .eq("user_id", user.id)
            .gte("date", startDate)
            .lte("date", end)
            .order("date", { ascending: true });
          setWeatherData((data as unknown as Record<string, unknown>[]) ?? []);
        })()
      );
    } else {
      setWeatherData([]);
    }

    await Promise.all(promises);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays, selectedKeys.join(",")]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Merge data by date and apply format transforms
  const mergedData = (() => {
    const byDate: Record<string, Record<string, unknown>> = {};
    for (const row of metricsData) {
      const date = row.date as string;
      if (!byDate[date]) byDate[date] = { date };
      Object.assign(byDate[date], row);
    }
    for (const row of weatherData) {
      const date = row.date as string;
      if (!byDate[date]) byDate[date] = { date };
      Object.assign(byDate[date], row);
    }
    return Object.keys(byDate)
      .sort()
      .map((date) => {
        const row = { ...byDate[date] };
        for (const metric of selectedMetrics) {
          if (
            metric.format &&
            row[metric.key] !== null &&
            row[metric.key] !== undefined
          ) {
            row[metric.key] = metric.format(row[metric.key] as number);
          }
        }
        return row;
      });
  })();

  const toggleMetric = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const metricStats = selectedMetrics.map((m) => ({
    metric: m,
    stats: computeStats(
      mergedData.map((row) => (row[m.key] as number) ?? null)
    ),
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0 lg:p-6 lg:pt-0">
      {/* ── Header ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2
            className="text-[30px] font-bold"
            style={{ color: "var(--pulse-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}
          >
            Trends
          </h2>
          <p
            className="mt-0.5 text-sm"
            style={{ color: "var(--pulse-text-secondary)" }}
          >
            Interactive time-series explorer across all metrics
          </p>
        </div>

        {/* Date range pills */}
        <div
          className="flex items-center gap-1 rounded-lg p-1"
          style={{
            background: "var(--pulse-bg-surface)",
            border: "1px solid var(--pulse-border-subtle)",
          }}
        >
          {DATE_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRangeDays(r.days)}
              className="h-7 rounded-md px-3 text-xs font-medium transition-all"
              style={{
                background:
                  rangeDays === r.days
                    ? "var(--pulse-brand)"
                    : "transparent",
                color:
                  rangeDays === r.days
                    ? "#FFFFFF"
                    : "var(--pulse-text-secondary)",
                fontFamily: "var(--font-data)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Metric Selector ──────────────────────────────── */}
      <motion.div variants={cardVariants} initial="hidden" animate="show">
        <Card
          style={{
            background: "var(--pulse-bg-surface)",
            borderColor: "var(--pulse-border-subtle)",
          }}
        >
          <CardHeader className="pb-3">
            <CardTitle
              className="text-xs font-medium tracking-wide uppercase"
              style={{ color: "var(--pulse-text-tertiary)", letterSpacing: "0.03em" }}
            >
              Select metrics to compare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {METRIC_GROUPS.map((group) => (
                <div key={group}>
                  <p
                    className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--pulse-text-tertiary)", letterSpacing: "0.05em" }}
                  >
                    {group}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {METRICS.filter((m) => m.group === group).map((metric) => {
                      const isSelected = selectedKeys.includes(metric.key);
                      return (
                        <button
                          key={metric.key}
                          onClick={() => toggleMetric(metric.key)}
                          className="rounded-full px-3 py-1 text-xs font-medium transition-all border"
                          style={
                            isSelected
                              ? {
                                  backgroundColor: metric.color,
                                  borderColor: metric.color,
                                  color: "#FFFFFF",
                                }
                              : {
                                  backgroundColor: "transparent",
                                  borderColor: "var(--pulse-border-default)",
                                  color: "var(--pulse-text-secondary)",
                                }
                          }
                        >
                          {metric.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Stats Row ────────────────────────────────────── */}
      {metricStats.length > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6"
        >
          {metricStats.map(({ metric, stats }) =>
            stats ? (
              <motion.div key={metric.key} variants={cardVariants}>
                <Card
                  className="overflow-hidden h-full"
                  style={{
                    background: "var(--pulse-bg-surface)",
                    borderColor: "var(--pulse-border-subtle)",
                  }}
                >
                  <CardContent className="p-3">
                    {/* Metric label with color dot */}
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: metric.color }}
                      />
                      <p
                        className="text-xs font-medium truncate"
                        style={{ color: "var(--pulse-text-secondary)" }}
                      >
                        {metric.shortLabel}
                      </p>
                    </div>

                    {/* Average value */}
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span
                        className="text-lg font-semibold"
                        style={{
                          fontFamily: "var(--font-data)",
                          color: "var(--pulse-text-primary)",
                        }}
                      >
                        {Math.round(stats.avg * 10) / 10}
                      </span>
                      {metric.unit && (
                        <span
                          className="text-[10px]"
                          style={{
                            fontFamily: "var(--font-data)",
                            color: "var(--pulse-text-tertiary)",
                          }}
                        >
                          {metric.unit}
                        </span>
                      )}
                    </div>

                    {/* Min-max range + trend */}
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className="text-[10px]"
                        style={{
                          fontFamily: "var(--font-data)",
                          color: "var(--pulse-text-tertiary)",
                        }}
                      >
                        {Math.round(stats.min * 10) / 10}–
                        {Math.round(stats.max * 10) / 10}
                      </span>
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-medium"
                        style={{
                          color:
                            stats.trend > 3
                              ? "var(--pulse-emerald)"
                              : stats.trend < -3
                                ? "var(--pulse-coral)"
                                : "var(--pulse-text-tertiary)",
                          background:
                            stats.trend > 3
                              ? "var(--pulse-emerald-muted)"
                              : stats.trend < -3
                                ? "var(--pulse-coral-muted)"
                                : "transparent",
                        }}
                      >
                        {stats.trend > 3 ? (
                          <TrendingUp className="h-2.5 w-2.5" />
                        ) : stats.trend < -3 ? (
                          <TrendingDown className="h-2.5 w-2.5" />
                        ) : (
                          <Minus className="h-2.5 w-2.5" />
                        )}
                        {Math.abs(Math.round(stats.trend))}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : null
          )}
        </motion.div>
      )}

      {/* ── Chart ────────────────────────────────────────── */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="show"
        className="flex-1"
      >
        <Card
          className="flex-1"
          style={{
            background: "var(--pulse-bg-surface)",
            borderColor: "var(--pulse-border-subtle)",
          }}
        >
          <CardContent className="p-4 lg:p-6">
            {loading ? (
              <div
                className="flex h-[400px] items-center justify-center"
              >
                <div
                  className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
                  style={{ borderColor: "var(--pulse-text-tertiary)", borderTopColor: "transparent" }}
                />
              </div>
            ) : selectedMetrics.length === 0 ? (
              <div
                className="flex h-[400px] items-center justify-center text-sm"
                style={{ color: "var(--pulse-text-tertiary)" }}
              >
                Select one or more metrics above to chart
              </div>
            ) : mergedData.length === 0 ? (
              <div
                className="flex h-[400px] items-center justify-center text-sm"
                style={{ color: "var(--pulse-text-tertiary)" }}
              >
                No data for the selected range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={mergedData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--pulse-border-subtle)"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 11,
                      fill: "var(--pulse-text-tertiary)",
                      fontFamily: "var(--font-data)",
                    }}
                    tickFormatter={formatDateShort}
                    interval="preserveStartEnd"
                    minTickGap={40}
                    axisLine={{ stroke: "var(--pulse-border-subtle)" }}
                    tickLine={{ stroke: "var(--pulse-border-subtle)" }}
                  />
                  {selectedMetrics.map((metric, i) => (
                    <YAxis
                      key={metric.key}
                      yAxisId={metric.key}
                      hide={i > 0}
                      tick={{
                        fontSize: 11,
                        fill: "var(--pulse-text-tertiary)",
                        fontFamily: "var(--font-data)",
                      }}
                      width={45}
                      domain={["auto", "auto"]}
                      axisLine={{ stroke: "var(--pulse-border-subtle)" }}
                      tickLine={{ stroke: "var(--pulse-border-subtle)" }}
                    />
                  ))}
                  <RechartsTooltip
                    content={
                      <CustomTooltip selectedMetrics={selectedMetrics} />
                    }
                  />
                  <Legend
                    formatter={(value: string) => {
                      const m = selectedMetrics.find(
                        (met) => met.key === value
                      );
                      return m?.shortLabel || value;
                    }}
                    wrapperStyle={{
                      fontSize: 12,
                      fontFamily: "var(--font-data)",
                      color: "var(--pulse-text-secondary)",
                    }}
                  />
                  {selectedMetrics.map((metric) => (
                    <Line
                      key={metric.key}
                      yAxisId={metric.key}
                      type="monotone"
                      dataKey={metric.key}
                      stroke={metric.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{
                        r: 4,
                        strokeWidth: 2,
                        stroke: "var(--pulse-bg-surface)",
                        fill: metric.color,
                      }}
                      connectNulls
                      isAnimationActive={true}
                      animationDuration={600}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
