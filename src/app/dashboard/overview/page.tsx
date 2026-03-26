"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function getRecoveryColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 67) return "text-emerald-500";
  if (score >= 34) return "text-amber-500";
  return "text-red-400";
}

function getRecoveryBg(score: number | null): string {
  if (score === null) return "bg-muted/50";
  if (score >= 67) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 34) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-400/10 border-red-400/20";
}

function getRecoveryLabel(score: number | null): string {
  if (score === null) return "No data";
  if (score >= 67) return "Green";
  if (score >= 34) return "Yellow";
  return "Red";
}

function formatMinutes(min: number | null): string {
  if (min === null) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

function getAqiLabel(aqi: number | null): { label: string; color: string } {
  if (aqi === null) return { label: "—", color: "text-muted-foreground" };
  if (aqi <= 50) return { label: "Good", color: "text-emerald-500" };
  if (aqi <= 100) return { label: "Moderate", color: "text-amber-500" };
  if (aqi <= 150) return { label: "USG", color: "text-orange-500" };
  return { label: "Unhealthy", color: "text-red-500" };
}

function getUvLabel(uv: number | null): { label: string; color: string } {
  if (uv === null) return { label: "—", color: "text-muted-foreground" };
  if (uv <= 2) return { label: "Low", color: "text-emerald-500" };
  if (uv <= 5) return { label: "Moderate", color: "text-amber-500" };
  if (uv <= 7) return { label: "High", color: "text-orange-500" };
  return { label: "Very High", color: "text-red-500" };
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

// ─── Sparkline component ─────────────────────────────────────────────────

function Sparkline({
  data,
  dataKey,
  color = "var(--color-primary)",
  height = 40,
}: {
  data: { date: string; value: number | null }[];
  dataKey?: string;
  color?: string;
  height?: number;
}) {
  const filtered = data.filter((d) => d.value !== null);
  if (filtered.length < 2) return <div className="h-10" />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={filtered}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${color})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Sleep bar chart ─────────────────────────────────────────────────────

function SleepStagesChart({
  data,
}: {
  data: DailyMetrics[];
}) {
  const chartData = data.map((d) => ({
    day: dayLabel(d.date),
    deep: d.sleep_deep_min ? Math.round(d.sleep_deep_min / 60 * 10) / 10 : 0,
    rem: d.sleep_rem_min ? Math.round(d.sleep_rem_min / 60 * 10) / 10 : 0,
    light: d.sleep_light_min ? Math.round(d.sleep_light_min / 60 * 10) / 10 : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData} barCategoryGap="20%">
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <RechartsTooltip
          contentStyle={{
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [
            `${value}h`,
            name.charAt(0).toUpperCase() + name.slice(1),
          ]}
        />
        <Bar dataKey="deep" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
        <Bar dataKey="rem" stackId="a" fill="#06b6d4" radius={[0, 0, 0, 0]} />
        <Bar dataKey="light" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  subtext,
  sparkData,
  sparkColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  subtext?: string;
  sparkData?: { date: string; value: number | null }[];
  sparkColor?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-muted p-1.5">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
          </div>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-bold tabular-nums">{value}</span>
          {unit && (
            <span className="ml-1 text-sm text-muted-foreground">{unit}</span>
          )}
        </div>
        {subtext && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>
        )}
        {sparkData && sparkData.length > 1 && (
          <div className="mt-2">
            <Sparkline data={sparkData} color={sparkColor} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

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

      // Fetch last 7 days of metrics
      const { data: metricsData } = await supabase
        .from("daily_metrics")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", date7ago)
        .lte("date", dateToday)
        .order("date", { ascending: true });

      if (metricsData && metricsData.length > 0) {
        setHistory(metricsData);
        // Today's data = most recent row (might be yesterday if today hasn't synced yet)
        const todayRow = metricsData.find((r) => r.date === dateToday);
        setToday(todayRow || metricsData[metricsData.length - 1]);
      }

      // Fetch today's weather
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

  // Build sparkline datasets
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
    value: d.sleep_total_min ? Math.round(d.sleep_total_min / 60 * 10) / 10 : null,
  }));
  const strainSpark = history.map((d) => ({
    date: d.date,
    value: d.strain_score,
  }));

  // Latest body comp (find most recent non-null weight)
  const latestBodyComp = [...history]
    .reverse()
    .find((d) => d.weight_kg !== null);
  const latestBP = [...history]
    .reverse()
    .find((d) => d.bp_systolic !== null);

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
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Daily Briefing</h2>
          <p className="text-muted-foreground text-sm">{displayDate}</p>
        </div>
        {isStale && !loading && (
          <Badge variant="outline" className="text-amber-500 border-amber-500/30">
            Showing latest available
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      ) : !today ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-12">
          <div className="text-center">
            <Activity className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-lg font-medium">No data yet</p>
            <p className="text-sm text-muted-foreground">
              Connect your WHOOP or Withings to see your daily briefing
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Recovery hero ────────────────────────────────── */}
          <Card className={getRecoveryBg(today.recovery_score)}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Recovery
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className={`text-5xl font-bold tabular-nums ${getRecoveryColor(today.recovery_score)}`}
                    >
                      {today.recovery_score !== null
                        ? `${Math.round(today.recovery_score)}%`
                        : "—"}
                    </span>
                    <Badge
                      variant="outline"
                      className={getRecoveryColor(today.recovery_score)}
                    >
                      {getRecoveryLabel(today.recovery_score)}
                    </Badge>
                  </div>
                </div>
                <div className="w-32">
                  <Sparkline
                    data={recoverySpark}
                    color={
                      today.recovery_score !== null && today.recovery_score >= 67
                        ? "#10b981"
                        : today.recovery_score !== null && today.recovery_score >= 34
                          ? "#f59e0b"
                          : "#f87171"
                    }
                    height={50}
                  />
                  <p className="text-center text-[10px] text-muted-foreground">
                    7-day trend
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Key metrics grid ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={Heart}
              label="HRV"
              value={
                today.hrv_rmssd_ms !== null
                  ? `${Math.round(today.hrv_rmssd_ms)}`
                  : "—"
              }
              unit="ms"
              sparkData={hrvSpark}
              sparkColor="#06b6d4"
            />
            <StatCard
              icon={Activity}
              label="Resting HR"
              value={
                today.resting_hr_bpm !== null
                  ? `${Math.round(today.resting_hr_bpm)}`
                  : "—"
              }
              unit="bpm"
              sparkData={rhrSpark}
              sparkColor="#f43f5e"
            />
            <StatCard
              icon={Moon}
              label="Sleep"
              value={formatMinutes(today.sleep_total_min)}
              subtext={
                today.sleep_efficiency !== null
                  ? `${Math.round(today.sleep_efficiency)}% efficiency`
                  : undefined
              }
              sparkData={sleepSpark}
              sparkColor="#8b5cf6"
            />
            <StatCard
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
              sparkColor="#f97316"
            />
          </div>

          {/* ── Sleep stages ─────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Sleep Stages — 7 Day
              </CardTitle>
              <CardDescription>
                <span className="inline-flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#6366f1]" />
                    Deep
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#06b6d4]" />
                    REM
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#94a3b8]" />
                    Light
                  </span>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-3">
              <SleepStagesChart data={history} />
            </CardContent>
          </Card>

          {/* ── Body comp + BP + Weather row ──────────────────── */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* Body composition */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    Body Composition
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {latestBodyComp ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Weight
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {kgToLbs(latestBodyComp.weight_kg!)} lbs
                      </span>
                    </div>
                    {latestBodyComp.body_fat_pct !== null && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Body Fat
                        </span>
                        <span className="text-sm font-medium tabular-nums">
                          {latestBodyComp.body_fat_pct}%
                        </span>
                      </div>
                    )}
                    {latestBodyComp.muscle_mass_kg !== null && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Muscle Mass
                        </span>
                        <span className="text-sm font-medium tabular-nums">
                          {kgToLbs(latestBodyComp.muscle_mass_kg!)} lbs
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No recent measurements
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Blood pressure */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    Blood Pressure
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {latestBP ? (
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold tabular-nums">
                        {latestBP.bp_systolic}
                      </span>
                      <span className="text-lg text-muted-foreground">/</span>
                      <span className="text-2xl font-bold tabular-nums">
                        {latestBP.bp_diastolic}
                      </span>
                      <span className="ml-1 text-sm text-muted-foreground">
                        mmHg
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">
                    No recent readings
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Weather + AQI */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    Los Angeles
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {weather ? (
                  <div className="space-y-2">
                    {weather.temp_max_c !== null && weather.temp_min_c !== null && (
                      <div className="flex items-center gap-2">
                        <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm tabular-nums">
                          {cToF(weather.temp_min_c)}° – {cToF(weather.temp_max_c)}°F
                        </span>
                      </div>
                    )}
                    {weather.uv_index !== null && (
                      <div className="flex items-center gap-2">
                        <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">
                          UV {weather.uv_index.toFixed(1)}
                        </span>
                        <span
                          className={`text-xs ${getUvLabel(weather.uv_index).color}`}
                        >
                          {getUvLabel(weather.uv_index).label}
                        </span>
                      </div>
                    )}
                    {weather.aqi_us !== null && (
                      <div className="flex items-center gap-2">
                        <Wind className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">AQI {weather.aqi_us}</span>
                        <span
                          className={`text-xs ${getAqiLabel(weather.aqi_us).color}`}
                        >
                          {getAqiLabel(weather.aqi_us).label}
                        </span>
                      </div>
                    )}
                    {weather.pm25 !== null && (
                      <div className="flex items-center gap-2">
                        <CloudRain className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm tabular-nums">
                          PM2.5: {weather.pm25.toFixed(1)} µg/m³
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Weather data syncing...
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── SpO2 + Skin temp + Respiratory rate ───────────── */}
          {(today.spo2_pct !== null ||
            today.skin_temp_c !== null ||
            today.respiratory_rate !== null) && (
            <div className="grid grid-cols-3 gap-3">
              {today.spo2_pct !== null && (
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">SpO2</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">
                      {today.spo2_pct.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              )}
              {today.skin_temp_c !== null && (
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Skin Temp</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">
                      {cToF(today.skin_temp_c)}°F
                    </p>
                  </CardContent>
                </Card>
              )}
              {today.respiratory_rate !== null && (
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      Respiratory Rate
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums">
                      {today.respiratory_rate.toFixed(1)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        rpm
                      </span>
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
