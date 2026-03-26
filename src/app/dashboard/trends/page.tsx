"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const METRICS: MetricDef[] = [
  // Recovery & vitals
  { key: "recovery_score", label: "Recovery Score", shortLabel: "Recovery", unit: "%", color: "#10b981", group: "Recovery", table: "daily_metrics" },
  { key: "hrv_rmssd_ms", label: "HRV (RMSSD)", shortLabel: "HRV", unit: "ms", color: "#6366f1", group: "Recovery", table: "daily_metrics" },
  { key: "resting_hr_bpm", label: "Resting Heart Rate", shortLabel: "RHR", unit: "bpm", color: "#ef4444", group: "Recovery", table: "daily_metrics" },
  { key: "spo2_pct", label: "SpO₂", shortLabel: "SpO₂", unit: "%", color: "#3b82f6", group: "Recovery", table: "daily_metrics" },
  { key: "skin_temp_c", label: "Skin Temperature", shortLabel: "Skin Temp", unit: "°F", color: "#f59e0b", group: "Recovery", format: cToF, table: "daily_metrics" },
  { key: "respiratory_rate", label: "Respiratory Rate", shortLabel: "Resp Rate", unit: "rpm", color: "#8b5cf6", group: "Recovery", table: "daily_metrics" },

  // Sleep
  { key: "sleep_total_min", label: "Total Sleep", shortLabel: "Sleep", unit: "hrs", color: "#6366f1", group: "Sleep", format: minToHr, table: "daily_metrics" },
  { key: "sleep_rem_min", label: "REM Sleep", shortLabel: "REM", unit: "hrs", color: "#a78bfa", group: "Sleep", format: minToHr, table: "daily_metrics" },
  { key: "sleep_deep_min", label: "Deep Sleep", shortLabel: "Deep", unit: "hrs", color: "#4338ca", group: "Sleep", format: minToHr, table: "daily_metrics" },
  { key: "sleep_efficiency", label: "Sleep Efficiency", shortLabel: "Efficiency", unit: "%", color: "#2dd4bf", group: "Sleep", table: "daily_metrics" },

  // Strain
  { key: "strain_score", label: "Strain Score", shortLabel: "Strain", unit: "", color: "#f97316", group: "Strain", table: "daily_metrics" },
  { key: "calories_total", label: "Total Calories", shortLabel: "Cals", unit: "kcal", color: "#ef4444", group: "Strain", table: "daily_metrics" },

  // Body
  { key: "weight_kg", label: "Weight", shortLabel: "Weight", unit: "lbs", color: "#0ea5e9", group: "Body", format: kgToLbs, table: "daily_metrics" },
  { key: "body_fat_pct", label: "Body Fat", shortLabel: "BF%", unit: "%", color: "#f43f5e", group: "Body", table: "daily_metrics" },
  { key: "muscle_mass_kg", label: "Muscle Mass", shortLabel: "Muscle", unit: "lbs", color: "#22c55e", group: "Body", format: kgToLbs, table: "daily_metrics" },

  // Blood pressure
  { key: "bp_systolic", label: "Systolic BP", shortLabel: "Systolic", unit: "mmHg", color: "#ef4444", group: "Blood Pressure", table: "daily_metrics" },
  { key: "bp_diastolic", label: "Diastolic BP", shortLabel: "Diastolic", unit: "mmHg", color: "#3b82f6", group: "Blood Pressure", table: "daily_metrics" },

  // Weather
  { key: "temp_max_c", label: "Temperature (High)", shortLabel: "Temp High", unit: "°F", color: "#f59e0b", group: "Weather", format: cToF, table: "weather_daily" },
  { key: "humidity_pct", label: "Humidity", shortLabel: "Humidity", unit: "%", color: "#06b6d4", group: "Weather", table: "weather_daily" },
  { key: "aqi_us", label: "AQI (US)", shortLabel: "AQI", unit: "", color: "#a3a3a3", group: "Weather", table: "weather_daily" },
  { key: "uv_index", label: "UV Index", shortLabel: "UV", unit: "", color: "#eab308", group: "Weather", table: "weather_daily" },
  { key: "pm25", label: "PM2.5", shortLabel: "PM2.5", unit: "μg/m³", color: "#78716c", group: "Weather", table: "weather_daily" },
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

// ─── Custom Tooltip ──────────────────────────────────────────────────────

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
    <div className="rounded-lg border bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm">
      <p className="mb-1 text-xs font-medium text-muted-foreground">
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
            className="text-xs"
            style={{ color: entry.color }}
          >
            {metric.shortLabel}: {displayVal}
            {metric.unit ? ` ${metric.unit}` : ""}
          </p>
        );
      })}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

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
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Trends</h2>
          <p className="text-muted-foreground text-sm">
            Interactive time-series explorer across all metrics
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {DATE_RANGES.map((r) => (
            <Button
              key={r.label}
              variant={rangeDays === r.days ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setRangeDays(r.days)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Metric selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Select Metrics to Compare
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {METRIC_GROUPS.map((group) => (
              <div key={group}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                  {group}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {METRICS.filter((m) => m.group === group).map((metric) => {
                    const isSelected = selectedKeys.includes(metric.key);
                    return (
                      <button
                        key={metric.key}
                        onClick={() => toggleMetric(metric.key)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition-all border",
                          isSelected
                            ? "text-white shadow-sm"
                            : "bg-transparent text-muted-foreground hover:text-foreground hover:border-foreground/30"
                        )}
                        style={
                          isSelected
                            ? {
                                backgroundColor: metric.color,
                                borderColor: metric.color,
                              }
                            : undefined
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

      {/* Stats row */}
      {metricStats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {metricStats.map(({ metric, stats }) =>
            stats ? (
              <Card key={metric.key} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: metric.color }}
                    />
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {metric.shortLabel}
                    </p>
                  </div>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {Math.round(stats.avg * 10) / 10}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {metric.unit}
                    </span>
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(stats.min * 10) / 10}–
                      {Math.round(stats.max * 10) / 10}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        stats.trend > 0
                          ? "text-emerald-500 border-emerald-500/30"
                          : stats.trend < 0
                          ? "text-red-400 border-red-400/30"
                          : "text-muted-foreground"
                      )}
                    >
                      {stats.trend > 0 ? "↑" : stats.trend < 0 ? "↓" : "→"}
                      {Math.abs(Math.round(stats.trend))}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ) : null
          )}
        </div>
      )}

      {/* Chart */}
      <Card className="flex-1">
        <CardContent className="p-4">
          {loading ? (
            <div className="flex h-[400px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : selectedMetrics.length === 0 ? (
            <div className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">
              Select one or more metrics above to chart
            </div>
          ) : mergedData.length === 0 ? (
            <div className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">
              No data for the selected range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={mergedData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="date"
                  tick={{
                    fontSize: 11,
                    fill: "var(--color-muted-foreground)",
                  }}
                  tickFormatter={formatDateShort}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                {selectedMetrics.map((metric, i) => (
                  <YAxis
                    key={metric.key}
                    yAxisId={metric.key}
                    hide={i > 0}
                    tick={{
                      fontSize: 11,
                      fill: "var(--color-muted-foreground)",
                    }}
                    width={45}
                    domain={["auto", "auto"]}
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
                  wrapperStyle={{ fontSize: 12 }}
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
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
