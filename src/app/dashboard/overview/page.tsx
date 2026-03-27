"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Heart,
  Moon,
  Flame,
  Activity,
  Scale,
  Thermometer,
  Wind,
  Droplets,
  Sun,
  CloudRain,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Tooltip as RechartsTooltip,
  XAxis,
} from "recharts";
import { RadialRecoveryChart } from "@/components/pulse/radial-recovery-chart";

// ─── Types ───────────────────────────────────────────────────────────────

interface DailyMetrics {
  date: string;
  recovery_score: number | null;
  hrv_rmssd_ms: number | null;
  resting_hr_bpm: number | null;
  spo2_pct: number | null;
  skin_temp_c: number | null;
  respiratory_rate: number | null;
  sleep_total_min: number | null;
  sleep_rem_min: number | null;
  sleep_deep_min: number | null;
  sleep_light_min: number | null;
  sleep_awake_min: number | null;
  sleep_efficiency: number | null;
  strain_score: number | null;
  calories_total: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
}

interface WeatherDaily {
  date: string;
  temp_max_c: number | null;
  temp_min_c: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  wind_speed_kmh: number | null;
  uv_index: number | null;
  pm25: number | null;
  pm10: number | null;
  ozone_ugm3: number | null;
  aqi_us: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatMinutes(min: number | null): string {
  if (min === null) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

function getAqiLabel(
  aqi: number | null
): { label: string; color: string } {
  if (aqi === null)
    return { label: "—", color: "var(--pulse-text-tertiary)" };
  if (aqi <= 50)
    return { label: "Good", color: "var(--pulse-emerald)" };
  if (aqi <= 100)
    return { label: "Moderate", color: "var(--pulse-amber)" };
  if (aqi <= 150)
    return { label: "USG", color: "var(--pulse-coral)" };
  return { label: "Unhealthy", color: "var(--pulse-coral)" };
}

function getUvLabel(
  uv: number | null
): { label: string; color: string } {
  if (uv === null) return { label: "—", color: "var(--pulse-text-tertiary)" };
  if (uv <= 2) return { label: "Low", color: "var(--pulse-emerald)" };
  if (uv <= 5) return { label: "Moderate", color: "var(--pulse-amber)" };
  if (uv <= 7) return { label: "High", color: "var(--pulse-coral)" };
  return { label: "Very High", color: "var(--pulse-coral)" };
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

/** Compute 7-day trend direction */
function getTrend(
  data: { value: number | null }[]
): "up" | "down" | "flat" {
  const valid = data.filter((d) => d.value !== null).map((d) => d.value!);
  if (valid.length < 3) return "flat";
  const firstHalf = valid.slice(0, Math.floor(valid.length / 2));
  const secondHalf = valid.slice(Math.floor(valid.length / 2));
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond =
    secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const pctChange = ((avgSecond - avgFirst) / avgFirst) * 100;
  if (Math.abs(pctChange) < 3) return "flat";
  return pctChange > 0 ? "up" : "down";
}

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up")
    return <TrendingUp className="h-3 w-3" style={{ color: "var(--pulse-emerald)" }} />;
  if (trend === "down")
    return <TrendingDown className="h-3 w-3" style={{ color: "var(--pulse-coral)" }} />;
  return <Minus className="h-3 w-3" style={{ color: "var(--pulse-text-tertiary)" }} />;
}

// ─── Stagger animation variants ─────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 20,
    },
  },
};

// ─── Sparkline ──────────────────────────────────────────────────────────

function Sparkline({
  data,
  color = "var(--pulse-blue)",
  height = 40,
}: {
  data: { date: string; value: number | null }[];
  color?: string;
  height?: number;
}) {
  const filtered = data.filter((d) => d.value !== null);
  if (filtered.length < 2) return <div style={{ height }} />;

  const gradientId = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={filtered}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={true}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Sleep Stages Chart ─────────────────────────────────────────────────

function SleepStagesChart({ data }: { data: DailyMetrics[] }) {
  const chartData = data.map((d) => ({
    day: dayLabel(d.date),
    deep: d.sleep_deep_min
      ? Math.round((d.sleep_deep_min / 60) * 10) / 10
      : 0,
    rem: d.sleep_rem_min
      ? Math.round((d.sleep_rem_min / 60) * 10) / 10
      : 0,
    light: d.sleep_light_min
      ? Math.round((d.sleep_light_min / 60) * 10) / 10
      : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData} barCategoryGap="25%">
        <XAxis
          dataKey="day"
          tick={{
            fontSize: 11,
            fill: "var(--pulse-text-tertiary)",
            fontFamily: "var(--font-data)",
          }}
          axisLine={false}
          tickLine={false}
        />
        <RechartsTooltip
          contentStyle={{
            background: "var(--pulse-bg-surface-raised)",
            border: "1px solid var(--pulse-border-subtle)",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "var(--font-data)",
            color: "var(--pulse-text-primary)",
          }}
          formatter={(value: number, name: string) => [
            `${value}h`,
            name.charAt(0).toUpperCase() + name.slice(1),
          ]}
        />
        <Bar
          dataKey="deep"
          stackId="a"
          fill="var(--pulse-brand)"
          radius={[0, 0, 0, 0]}
          isAnimationActive={true}
          animationDuration={600}
        />
        <Bar
          dataKey="rem"
          stackId="a"
          fill="var(--pulse-blue)"
          radius={[0, 0, 0, 0]}
          isAnimationActive={true}
          animationDuration={600}
          animationBegin={100}
        />
        <Bar
          dataKey="light"
          stackId="a"
          fill="var(--pulse-border-default)"
          radius={[3, 3, 0, 0]}
          isAnimationActive={true}
          animationDuration={600}
          animationBegin={200}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Metric Card ────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  subtext,
  sparkData,
  sparkColor,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  subtext?: string;
  sparkData?: { date: string; value: number | null }[];
  sparkColor?: string;
  trend?: "up" | "down" | "flat";
}) {
  return (
    <Card
      className="overflow-hidden transition-colors duration-200"
      style={{
        background: "var(--pulse-bg-surface)",
        borderColor: "var(--pulse-border-subtle)",
      }}
    >
      <CardContent className="p-4">
        {/* Header row: icon + label + trend */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ background: "var(--pulse-bg-surface-raised)" }}
            >
              <Icon
                className="h-3.5 w-3.5"
                style={{ color: "var(--pulse-text-tertiary)" }}
              />
            </div>
            <span
              className="text-xs font-medium tracking-wide uppercase"
              style={{ color: "var(--pulse-text-secondary)", letterSpacing: "0.02em" }}
            >
              {label}
            </span>
          </div>
          {trend && <TrendIcon trend={trend} />}
        </div>

        {/* Value */}
        <div className="mt-3 flex items-baseline gap-1">
          <span
            className="text-2xl font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-data)",
              color: "var(--pulse-text-primary)",
            }}
          >
            {value}
          </span>
          {unit && (
            <span
              className="text-xs"
              style={{
                fontFamily: "var(--font-data)",
                color: "var(--pulse-text-tertiary)",
              }}
            >
              {unit}
            </span>
          )}
        </div>
        {subtext && (
          <p
            className="mt-0.5 text-xs"
            style={{ color: "var(--pulse-text-tertiary)" }}
          >
            {subtext}
          </p>
        )}

        {/* Sparkline */}
        {sparkData && sparkData.length > 1 && (
          <div className="mt-3 -mx-1">
            <Sparkline data={sparkData} color={sparkColor} height={36} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Compact Stat ───────────────────────────────────────────────────────

function CompactStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl p-4"
      style={{
        background: "var(--pulse-bg-surface)",
        border: "1px solid var(--pulse-border-subtle)",
      }}
    >
      <span
        className="text-[11px] font-medium tracking-wide uppercase"
        style={{ color: "var(--pulse-text-tertiary)", letterSpacing: "0.03em" }}
      >
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-0.5">
        <span
          className="text-xl font-semibold"
          style={{
            fontFamily: "var(--font-data)",
            color: "var(--pulse-text-primary)",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="text-[10px]"
            style={{
              fontFamily: "var(--font-data)",
              color: "var(--pulse-text-tertiary)",
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function DailyBriefingPage() {
  const [today, setToday] = useState<DailyMetrics | null>(null);
  const [history, setHistory] = useState<DailyMetrics[]>([]);
  const [weather, setWeather] = useState<WeatherDaily | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const dateToday = todayStr();
      const date7ago = daysAgoStr(7);

      const { data: metricsData } = await supabase
        .from("daily_metrics")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", date7ago)
        .lte("date", dateToday)
        .order("date", { ascending: true });

      if (metricsData && metricsData.length > 0) {
        setHistory(metricsData);
        const todayRow = metricsData.find((r) => r.date === dateToday);
        setToday(todayRow || metricsData[metricsData.length - 1]);
      }

      const { data: weatherData } = await supabase
        .from("weather_daily")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", dateToday)
        .single();

      if (weatherData) {
        setWeather(weatherData);
      }

      setLoading(false);
    }

    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sparkline datasets ──
  const recoverySpark = history.map((d) => ({
    date: d.date,
    value: d.recovery_score,
  }));
  const hrvSpark = history.map((d) => ({
    date: d.date,
    value: d.hrv_rmssd_ms,
  }));
  const rhrSpark = history.map((d) => ({
    date: d.date,
    value: d.resting_hr_bpm,
  }));
  const sleepSpark = history.map((d) => ({
    date: d.date,
    value: d.sleep_total_min
      ? Math.round((d.sleep_total_min / 60) * 10) / 10
      : null,
  }));
  const strainSpark = history.map((d) => ({
    date: d.date,
    value: d.strain_score,
  }));

  // ── Derived data ──
  const latestBodyComp = [...history]
    .reverse()
    .find((d) => d.weight_kg !== null);
  const latestBP = [...history]
    .reverse()
    .find((d) => d.bp_systolic !== null);

  const hrvTrend = getTrend(hrvSpark);
  const rhrTrend = getTrend(rhrSpark);
  const sleepTrend = getTrend(sleepSpark);
  const strainTrend = getTrend(strainSpark);

  const displayDate = today?.date
    ? new Date(today.date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });

  const isStale = today?.date !== todayStr();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0 lg:p-6 lg:pt-0">
      {/* ── Page header ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2
            className="text-[30px] font-bold"
            style={{ color: "var(--pulse-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}
          >
            Daily Briefing
          </h2>
          <p
            className="mt-0.5 text-sm"
            style={{ color: "var(--pulse-text-secondary)" }}
          >
            {displayDate}
          </p>
        </div>
        {isStale && !loading && (
          <span
            className="rounded-full px-3 py-1 text-[11px] font-medium"
            style={{
              color: "var(--pulse-amber)",
              background: "var(--pulse-amber-muted)",
            }}
          >
            Showing latest available
          </span>
        )}
      </motion.div>

      {loading ? (
        /* ── Loading state ─────────────────────────────────── */
        <div
          className="flex flex-1 items-center justify-center rounded-xl border border-dashed p-12"
          style={{ borderColor: "var(--pulse-border-subtle)" }}
        >
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--pulse-text-tertiary)", borderTopColor: "transparent" }}
          />
        </div>
      ) : !today ? (
        /* ── Empty state ───────────────────────────────────── */
        <div
          className="flex flex-1 items-center justify-center rounded-xl border border-dashed p-16"
          style={{ borderColor: "var(--pulse-border-subtle)" }}
        >
          <div className="text-center">
            <Activity
              className="mx-auto h-12 w-12"
              style={{ color: "var(--pulse-text-tertiary)" }}
            />
            <p
              className="mt-4 text-lg font-semibold"
              style={{ color: "var(--pulse-text-primary)" }}
            >
              No data yet
            </p>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--pulse-text-secondary)" }}
            >
              Connect your WHOOP or Withings to see your daily briefing
            </p>
          </div>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* ══════════════════════════════════════════════════
              LEVEL 1: Recovery Hero + Sleep + Key Metrics
              "How am I today?"
              ══════════════════════════════════════════════════ */}
          <motion.div
            variants={cardVariants}
            className="grid grid-cols-1 gap-6 lg:grid-cols-12"
          >
            {/* ── Radial Recovery Card ─────────────────────── */}
            <Card
              className="group lg:col-span-5 overflow-hidden"
              style={{
                background: "var(--pulse-bg-surface)",
                borderColor: "var(--pulse-border-subtle)",
              }}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 lg:p-8">
                <RadialRecoveryChart
                  recoveryScore={today.recovery_score}
                  sleepScore={today.sleep_efficiency}
                  hrvPercentile={
                    today.hrv_rmssd_ms !== null
                      ? Math.min(100, Math.round((today.hrv_rmssd_ms / 150) * 100))
                      : null
                  }
                  size={220}
                />

                {/* Ring legend */}
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        background:
                          today.recovery_score !== null && today.recovery_score >= 67
                            ? "var(--pulse-emerald)"
                            : today.recovery_score !== null && today.recovery_score >= 34
                              ? "var(--pulse-amber)"
                              : "var(--pulse-coral)",
                      }}
                    />
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: "var(--pulse-text-tertiary)" }}
                    >
                      Recovery
                    </span>
                  </div>
                  {today.sleep_efficiency !== null && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: "var(--pulse-blue)" }}
                      />
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: "var(--pulse-text-tertiary)" }}
                      >
                        Sleep {Math.round(today.sleep_efficiency)}%
                      </span>
                    </div>
                  )}
                  {today.hrv_rmssd_ms !== null && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: "var(--pulse-blue)", opacity: 0.6 }}
                      />
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: "var(--pulse-text-tertiary)" }}
                      >
                        HRV
                      </span>
                    </div>
                  )}
                </div>

                {/* 7-day recovery sparkline */}
                <div className="mt-4 w-full max-w-[200px]">
                  <Sparkline
                    data={recoverySpark}
                    color={
                      today.recovery_score !== null && today.recovery_score >= 67
                        ? "var(--pulse-emerald)"
                        : today.recovery_score !== null && today.recovery_score >= 34
                          ? "var(--pulse-amber)"
                          : "var(--pulse-coral)"
                    }
                    height={32}
                  />
                  <p
                    className="mt-1 text-center text-[10px] font-medium"
                    style={{ color: "var(--pulse-text-tertiary)" }}
                  >
                    7-day recovery
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ── Sleep + Key Metrics column ───────────────── */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* Sleep card */}
              <motion.div variants={cardVariants}>
                <Card
                  style={{
                    background: "var(--pulse-bg-surface)",
                    borderColor: "var(--pulse-border-subtle)",
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-md"
                          style={{ background: "var(--pulse-bg-surface-raised)" }}
                        >
                          <Moon
                            className="h-3.5 w-3.5"
                            style={{ color: "var(--pulse-blue)" }}
                          />
                        </div>
                        <CardTitle
                          className="text-sm font-semibold"
                          style={{ color: "var(--pulse-text-primary)", letterSpacing: "-0.01em" }}
                        >
                          Sleep
                        </CardTitle>
                      </div>
                      <span
                        className="text-[11px] font-medium tracking-wide uppercase"
                        style={{ color: "var(--pulse-text-tertiary)" }}
                      >
                        7-day stages
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    {/* Sleep summary row */}
                    <div className="mb-3 flex items-baseline gap-6">
                      <div>
                        <span
                          className="text-2xl font-semibold"
                          style={{
                            fontFamily: "var(--font-data)",
                            color: "var(--pulse-text-primary)",
                          }}
                        >
                          {formatMinutes(today.sleep_total_min)}
                        </span>
                        <span
                          className="ml-1.5 text-xs"
                          style={{ color: "var(--pulse-text-tertiary)" }}
                        >
                          total
                        </span>
                      </div>
                      {today.sleep_efficiency !== null && (
                        <div>
                          <span
                            className="text-base font-medium"
                            style={{
                              fontFamily: "var(--font-data)",
                              color: "var(--pulse-text-secondary)",
                            }}
                          >
                            {Math.round(today.sleep_efficiency)}%
                          </span>
                          <span
                            className="ml-1 text-xs"
                            style={{ color: "var(--pulse-text-tertiary)" }}
                          >
                            efficiency
                          </span>
                        </div>
                      )}
                      {today.sleep_deep_min !== null && (
                        <div>
                          <span
                            className="text-base font-medium"
                            style={{
                              fontFamily: "var(--font-data)",
                              color: "var(--pulse-brand)",
                            }}
                          >
                            {formatMinutes(today.sleep_deep_min)}
                          </span>
                          <span
                            className="ml-1 text-xs"
                            style={{ color: "var(--pulse-text-tertiary)" }}
                          >
                            deep
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sleep stage chart */}
                    <SleepStagesChart data={history} />

                    {/* Legend */}
                    <div className="mt-2 flex items-center gap-4">
                      {[
                        { label: "Deep", color: "var(--pulse-brand)" },
                        { label: "REM", color: "var(--pulse-blue)" },
                        { label: "Light", color: "var(--pulse-border-default)" },
                      ].map((item) => (
                        <span
                          key={item.label}
                          className="flex items-center gap-1.5 text-[10px] font-medium"
                          style={{ color: "var(--pulse-text-tertiary)" }}
                        >
                          <span
                            className="inline-block h-2 w-2 rounded-sm"
                            style={{ background: item.color }}
                          />
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Key metrics: HRV, RHR, Strain */}
              <motion.div
                variants={containerVariants}
                className="grid grid-cols-3 gap-4"
              >
                <motion.div variants={cardVariants}>
                  <MetricCard
                    icon={Heart}
                    label="HRV"
                    value={
                      today.hrv_rmssd_ms !== null
                        ? `${Math.round(today.hrv_rmssd_ms)}`
                        : "—"
                    }
                    unit="ms"
                    sparkData={hrvSpark}
                    sparkColor="var(--pulse-blue)"
                    trend={hrvTrend}
                  />
                </motion.div>
                <motion.div variants={cardVariants}>
                  <MetricCard
                    icon={Activity}
                    label="RHR"
                    value={
                      today.resting_hr_bpm !== null
                        ? `${Math.round(today.resting_hr_bpm)}`
                        : "—"
                    }
                    unit="bpm"
                    sparkData={rhrSpark}
                    sparkColor="var(--pulse-coral)"
                    trend={rhrTrend}
                  />
                </motion.div>
                <motion.div variants={cardVariants}>
                  <MetricCard
                    icon={Flame}
                    label="Strain"
                    value={
                      today.strain_score !== null
                        ? `${today.strain_score.toFixed(1)}`
                        : "—"
                    }
                    subtext={
                      today.calories_total !== null
                        ? `${Math.round(today.calories_total)} kcal`
                        : undefined
                    }
                    sparkData={strainSpark}
                    sparkColor="var(--pulse-amber)"
                    trend={strainTrend}
                  />
                </motion.div>
              </motion.div>
            </div>
          </motion.div>

          {/* ══════════════════════════════════════════════════
              LEVEL 2: Secondary vitals
              ══════════════════════════════════════════════════ */}
          {(today.spo2_pct !== null ||
            today.skin_temp_c !== null ||
            today.respiratory_rate !== null) && (
            <motion.div
              variants={containerVariants}
              className="grid grid-cols-3 gap-4"
            >
              {today.spo2_pct !== null && (
                <motion.div variants={cardVariants}>
                  <CompactStat
                    label="SpO2"
                    value={today.spo2_pct.toFixed(1)}
                    unit="%"
                  />
                </motion.div>
              )}
              {today.skin_temp_c !== null && (
                <motion.div variants={cardVariants}>
                  <CompactStat
                    label="Skin Temp"
                    value={`${cToF(today.skin_temp_c)}`}
                    unit="°F"
                  />
                </motion.div>
              )}
              {today.respiratory_rate !== null && (
                <motion.div variants={cardVariants}>
                  <CompactStat
                    label="Resp Rate"
                    value={today.respiratory_rate.toFixed(1)}
                    unit="rpm"
                  />
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════
              LEVEL 3: Body Comp + Blood Pressure + Weather
              ══════════════════════════════════════════════════ */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            {/* Body composition */}
            <motion.div variants={cardVariants}>
              <Card
                className="h-full"
                style={{
                  background: "var(--pulse-bg-surface)",
                  borderColor: "var(--pulse-border-subtle)",
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Scale
                      className="h-4 w-4"
                      style={{ color: "var(--pulse-text-tertiary)" }}
                    />
                    <CardTitle
                      className="text-sm font-semibold"
                      style={{ color: "var(--pulse-text-primary)" }}
                    >
                      Body Composition
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {latestBodyComp ? (
                    <div className="space-y-2.5">
                      {[
                        {
                          label: "Weight",
                          value: `${kgToLbs(latestBodyComp.weight_kg!)}`,
                          unit: "lbs",
                        },
                        latestBodyComp.body_fat_pct !== null
                          ? {
                              label: "Body Fat",
                              value: `${latestBodyComp.body_fat_pct}`,
                              unit: "%",
                            }
                          : null,
                        latestBodyComp.muscle_mass_kg !== null
                          ? {
                              label: "Muscle",
                              value: `${kgToLbs(latestBodyComp.muscle_mass_kg!)}`,
                              unit: "lbs",
                            }
                          : null,
                      ]
                        .filter(Boolean)
                        .map((item) => (
                          <div
                            key={item!.label}
                            className="flex items-center justify-between"
                          >
                            <span
                              className="text-xs font-medium"
                              style={{ color: "var(--pulse-text-secondary)" }}
                            >
                              {item!.label}
                            </span>
                            <span
                              className="text-sm font-medium"
                              style={{
                                fontFamily: "var(--font-data)",
                                color: "var(--pulse-text-primary)",
                              }}
                            >
                              {item!.value}
                              <span
                                className="ml-0.5 text-[10px]"
                                style={{ color: "var(--pulse-text-tertiary)" }}
                              >
                                {item!.unit}
                              </span>
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p
                      className="text-sm"
                      style={{ color: "var(--pulse-text-tertiary)" }}
                    >
                      No recent measurements
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Blood pressure */}
            <motion.div variants={cardVariants}>
              <Card
                className="h-full"
                style={{
                  background: "var(--pulse-bg-surface)",
                  borderColor: "var(--pulse-border-subtle)",
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Droplets
                      className="h-4 w-4"
                      style={{ color: "var(--pulse-text-tertiary)" }}
                    />
                    <CardTitle
                      className="text-sm font-semibold"
                      style={{ color: "var(--pulse-text-primary)" }}
                    >
                      Blood Pressure
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {latestBP ? (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span
                          className="text-2xl font-semibold"
                          style={{
                            fontFamily: "var(--font-data)",
                            color: "var(--pulse-text-primary)",
                          }}
                        >
                          {latestBP.bp_systolic}
                        </span>
                        <span
                          className="text-lg"
                          style={{ color: "var(--pulse-text-tertiary)" }}
                        >
                          /
                        </span>
                        <span
                          className="text-2xl font-semibold"
                          style={{
                            fontFamily: "var(--font-data)",
                            color: "var(--pulse-text-primary)",
                          }}
                        >
                          {latestBP.bp_diastolic}
                        </span>
                        <span
                          className="ml-1 text-xs"
                          style={{
                            fontFamily: "var(--font-data)",
                            color: "var(--pulse-text-tertiary)",
                          }}
                        >
                          mmHg
                        </span>
                      </div>
                      <p
                        className="mt-1 text-xs"
                        style={{ color: "var(--pulse-text-tertiary)" }}
                      >
                        {latestBP.date === todayStr()
                          ? "Today"
                          : new Date(
                              latestBP.date + "T12:00:00"
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                      </p>
                    </div>
                  ) : (
                    <p
                      className="text-sm"
                      style={{ color: "var(--pulse-text-tertiary)" }}
                    >
                      No recent readings
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Weather + AQI */}
            <motion.div variants={cardVariants}>
              <Card
                className="h-full"
                style={{
                  background: "var(--pulse-bg-surface)",
                  borderColor: "var(--pulse-border-subtle)",
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Sun
                      className="h-4 w-4"
                      style={{ color: "var(--pulse-text-tertiary)" }}
                    />
                    <CardTitle
                      className="text-sm font-semibold"
                      style={{ color: "var(--pulse-text-primary)" }}
                    >
                      Los Angeles
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {weather ? (
                    <div className="space-y-2.5">
                      {weather.temp_max_c !== null &&
                        weather.temp_min_c !== null && (
                          <div className="flex items-center gap-2">
                            <Thermometer
                              className="h-3.5 w-3.5"
                              style={{ color: "var(--pulse-text-tertiary)" }}
                            />
                            <span
                              className="text-sm"
                              style={{
                                fontFamily: "var(--font-data)",
                                color: "var(--pulse-text-primary)",
                              }}
                            >
                              {cToF(weather.temp_min_c)}° –{" "}
                              {cToF(weather.temp_max_c)}°F
                            </span>
                          </div>
                        )}
                      {weather.uv_index !== null && (
                        <div className="flex items-center gap-2">
                          <Sun
                            className="h-3.5 w-3.5"
                            style={{ color: "var(--pulse-text-tertiary)" }}
                          />
                          <span
                            className="text-sm"
                            style={{
                              fontFamily: "var(--font-data)",
                              color: "var(--pulse-text-primary)",
                            }}
                          >
                            UV {weather.uv_index.toFixed(1)}
                          </span>
                          <span
                            className="text-[11px] font-medium"
                            style={{
                              color: getUvLabel(weather.uv_index).color,
                            }}
                          >
                            {getUvLabel(weather.uv_index).label}
                          </span>
                        </div>
                      )}
                      {weather.aqi_us !== null && (
                        <div className="flex items-center gap-2">
                          <Wind
                            className="h-3.5 w-3.5"
                            style={{ color: "var(--pulse-text-tertiary)" }}
                          />
                          <span
                            className="text-sm"
                            style={{
                              fontFamily: "var(--font-data)",
                              color: "var(--pulse-text-primary)",
                            }}
                          >
                            AQI {weather.aqi_us}
                          </span>
                          <span
                            className="text-[11px] font-medium"
                            style={{
                              color: getAqiLabel(weather.aqi_us).color,
                            }}
                          >
                            {getAqiLabel(weather.aqi_us).label}
                          </span>
                        </div>
                      )}
                      {weather.pm25 !== null && (
                        <div className="flex items-center gap-2">
                          <CloudRain
                            className="h-3.5 w-3.5"
                            style={{ color: "var(--pulse-text-tertiary)" }}
                          />
                          <span
                            className="text-sm"
                            style={{
                              fontFamily: "var(--font-data)",
                              color: "var(--pulse-text-primary)",
                            }}
                          >
                            PM2.5: {weather.pm25.toFixed(1)}
                          </span>
                          <span
                            className="text-[10px]"
                            style={{
                              fontFamily: "var(--font-data)",
                              color: "var(--pulse-text-tertiary)",
                            }}
                          >
                            µg/m³
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p
                      className="text-sm"
                      style={{ color: "var(--pulse-text-tertiary)" }}
                    >
                      Weather data syncing...
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
