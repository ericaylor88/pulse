"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
 Card,
 CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
 TrendingUp,
 TrendingDown,
 Info,
 Zap,
 ChevronDown,
 ChevronUp,
 BarChart3,
 RefreshCw,
 AlertTriangle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────

interface Correlation {
 id: string;
 variable_a: string;
 variable_b: string;
 lag_days: number;
 r_value: number;
 p_value: number;
 n_observations: number;
 effect_size: string;
 confidence_tier: string;
 method: string;
 created_at: string;
}

interface Anomaly {
 date: string;
 anomaly_score: number;
 deviations: Record<string, number>;
}

interface ComputeResult {
 ok: boolean;
 correlations: number;
 high_confidence?: number;
 medium_confidence?: number;
 top_5?: { pair: string; r: number; tier: string }[];
 message?: string;
 error?: string;
}

interface AnomalyResult {
 ok: boolean;
 anomalies_found: number;
 anomalies: Anomaly[];
 error?: string;
}

// ─── Metric display config ───────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
 recovery_score: "Recovery",
 hrv_rmssd_ms: "HRV",
 resting_hr_bpm: "Resting HR",
 sleep_efficiency: "Sleep Efficiency",
 sleep_total_min: "Total Sleep",
 sleep_deep_min: "Deep Sleep",
 sleep_rem_min: "REM Sleep",
 sleep_light_min: "Light Sleep",
 respiratory_rate: "Respiratory Rate",
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
 high: { color: "text-pulse-emerald", bgColor: "", label: "High Confidence" },
 medium: { color: "text-pulse-amber", bgColor: "", label: "Medium Confidence" },
 low: { color: "text-pulse-text-secondary", bgColor: " border-[var(--pulse-border-default)]", label: "Low Confidence" },
};

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
 <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>{corr.lag_days}-day lag</p>
 )}
 </div>
 <div className="text-right shrink-0">
 <p style={{ fontFamily: "var(--font-data)" }} className={cn("text-xl font-bold tabular-nums", tier.color)}>
 r = {corr.r_value.toFixed(3)}
 </p>
 <Badge variant="outline" className={cn("text-[10px]", tier.color)}>
 {tier.label}
 </Badge>
 </div>
 </div>

 <div className="flex items-center gap-2 text-xs" style={{ color: "var(--pulse-text-secondary)" }}>
 {isPositive ? (
 <TrendingUp className="h-3.5 w-3.5 text-pulse-emerald" />
 ) : (
 <TrendingDown className="h-3.5 w-3.5 text-pulse-coral" />
 )}
 <span>{directionText}</span>
 </div>

 <div className="flex flex-wrap gap-2 text-[10px]">
 <Badge variant="secondary">{strengthLabel} ({corr.effect_size})</Badge>
 <Badge variant="secondary">p = {corr.p_value < 0.001 ? "<0.001" : corr.p_value.toFixed(3)}</Badge>
 <Badge variant="secondary">n = {corr.n_observations} days</Badge>
 <Badge variant="secondary">{corr.method}</Badge>
 </div>
 </CardContent>
 </Card>
 );
}

// ─── Anomaly Card ────────────────────────────────────────────────────────

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
 const deviationEntries = Object.entries(anomaly.deviations).sort(
 (a, b) => Math.abs(b[1]) - Math.abs(a[1])
 );

 return (
 <Card className="" style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-4 space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <AlertTriangle className="h-4 w-4 text-pulse-amber" />
 <p className="text-sm font-medium">{anomaly.date}</p>
 </div>
 <Badge variant="outline" className="text-[10px] text-pulse-amber">
 Score: {anomaly.anomaly_score.toFixed(3)}
 </Badge>
 </div>
 {deviationEntries.length > 0 && (
 <div className="flex flex-wrap gap-1.5">
 {deviationEntries.map(([metric, z]) => (
 <Badge
 key={metric}
 variant="secondary"
 className={cn("text-[10px]", z > 0 ? "text-pulse-coral" : "text-pulse-blue")}
 >
 {metricLabel(metric)}: {z > 0 ? "+" : ""}{z.toFixed(1)}σ
 </Badge>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function CorrelationsPage() {
 const [correlations, setCorrelations] = useState<Correlation[]>([]);
 const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
 const [loading, setLoading] = useState(true);
 const [computing, setComputing] = useState(false);
 const [detecting, setDetecting] = useState(false);
 const [computeResult, setComputeResult] = useState<ComputeResult | null>(null);
 const [anomalyResult, setAnomalyResult] = useState<AnomalyResult | null>(null);
 const [filterTier, setFilterTier] = useState<string | null>(null);
 const [sortBy, setSortBy] = useState<"r_value" | "p_value" | "n">("r_value");
 const [showAnomalies, setShowAnomalies] = useState(false);

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

 // ─── Run Correlation Engine ──────────────────────────────────────────

 const handleComputeCorrelations = async () => {
 setComputing(true);
 setComputeResult(null);
 try {
 const res = await fetch("/api/correlations/compute", { method: "POST" });
 const data: ComputeResult = await res.json();

 if (!res.ok) {
 setComputeResult({ ok: false, correlations: 0, error: data.error ?? `Server error ${res.status}` });
 } else {
 setComputeResult(data);
 if (data.ok && data.correlations > 0) await loadCorrelations();
 }
 } catch {
 setComputeResult({ ok: false, correlations: 0, error: "Network error — could not reach the server." });
 }
 setComputing(false);
 };

 // ─── Run Anomaly Detection ───────────────────────────────────────────

 const handleDetectAnomalies = async () => {
 setDetecting(true);
 setAnomalyResult(null);
 try {
 const res = await fetch("/api/anomalies/detect", { method: "POST" });
 const data: AnomalyResult = await res.json();

 if (!res.ok) {
 setAnomalyResult({ ok: false, anomalies_found: 0, anomalies: [], error: data.error ?? `Server error ${res.status}` });
 } else {
 setAnomalyResult(data);
 setAnomalies(data.anomalies ?? []);
 if (data.anomalies_found > 0) setShowAnomalies(true);
 }
 } catch {
 setAnomalyResult({ ok: false, anomalies_found: 0, anomalies: [], error: "Network error — could not reach the server." });
 }
 setDetecting(false);
 };

 // Filter and sort
 const filtered = correlations
 .filter((c) => !filterTier || c.confidence_tier === filterTier)
 .sort((a, b) => {
 if (sortBy === "r_value") return Math.abs(b.r_value) - Math.abs(a.r_value);
 if (sortBy === "p_value") return a.p_value - b.p_value;
 return b.n_observations - a.n_observations;
 });

 // Stats
 const highCount = correlations.filter((c) => c.confidence_tier === "high").length;
 const medCount = correlations.filter((c) => c.confidence_tier === "medium").length;
 const strongestPositive = correlations.reduce((best, c) =>
 c.r_value > (best?.r_value ?? -Infinity) ? c : best, null as Correlation | null);
 const strongestNegative = correlations.reduce((best, c) =>
 c.r_value < (best?.r_value ?? Infinity) ? c : best, null as Correlation | null);

 return (
 <div className="flex flex-1 flex-col gap-6 p-4 pt-0 pb-8 lg:p-6 lg:pt-0">
 {/* Header + Action Buttons */}
 <motion.div
       initial={{ opacity: 0, y: 8 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.2 }}
       className="flex items-start justify-between gap-4">
 <div>
 <h2 className="text-[30px] font-bold" style={{ color: "var(--pulse-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>Correlations</h2>
 <p className="text-sm" style={{ color: "var(--pulse-text-secondary)" }}>
 Discover what actually affects your recovery, sleep, and health
 </p>
 </div>
 <div className="flex gap-2 shrink-0">
 <Button variant="outline" size="sm" onClick={handleDetectAnomalies} disabled={detecting || computing}>
 {detecting ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-1.5" />}
 {detecting ? "Detecting..." : "Detect Anomalies"}
 </Button>
 <Button size="sm" onClick={handleComputeCorrelations} disabled={computing || detecting}>
 {computing ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <Zap className="h-4 w-4 mr-1.5" />}
 {computing ? "Computing..." : "Run Correlation Engine"}
 </Button>
 </div>
 </motion.div>

 {/* Compute result feedback */}
 {computeResult && (
 <Card className={cn("border", computeResult.ok && !computeResult.error ? " " : " ")}>
 <CardContent className="p-3">
 {computeResult.error ? (
 <p className="text-sm text-pulse-coral">{computeResult.error}</p>
 ) : computeResult.message ? (
 <p className="text-sm" style={{ color: "var(--pulse-text-secondary)" }}>{computeResult.message}</p>
 ) : (
 <div className="space-y-2">
 <p className="text-sm text-pulse-emerald font-medium">
 Found {computeResult.correlations} correlations — {computeResult.high_confidence} high confidence, {computeResult.medium_confidence} medium
 </p>
 {computeResult.top_5 && computeResult.top_5.length > 0 && (
 <div className="flex flex-wrap gap-2">
 {computeResult.top_5.map((t, i) => (
 <Badge key={i} variant="secondary" className="text-[10px]">
 {t.pair} (r={t.r.toFixed(3)})
 </Badge>
 ))}
 </div>
 )}
 </div>
 )}
 </CardContent>
 </Card>
 )}

 {/* Anomaly result feedback */}
 {anomalyResult && (
 <Card className={cn("border", anomalyResult.error ? " " : anomalyResult.anomalies_found > 0 ? " " : " ")}>
 <CardContent className="p-3">
 {anomalyResult.error ? (
 <p className="text-sm text-pulse-coral">{anomalyResult.error}</p>
 ) : anomalyResult.anomalies_found === 0 ? (
 <p className="text-sm text-pulse-emerald">No anomalies detected in the last 90 days — your metrics are consistent.</p>
 ) : (
 <button onClick={() => setShowAnomalies(!showAnomalies)} className="flex items-center gap-2 text-sm text-pulse-amber font-medium w-full">
 <AlertTriangle className="h-4 w-4" />
 {anomalyResult.anomalies_found} anomalous day{anomalyResult.anomalies_found > 1 ? "s" : ""} detected
 {showAnomalies ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
 </button>
 )}
 </CardContent>
 </Card>
 )}

 {/* Anomaly cards (expandable) */}
 {showAnomalies && anomalies.length > 0 && (
 <div className="grid gap-2 sm:grid-cols-2">
 {anomalies.map((a) => (
 <AnomalyCard key={a.date} anomaly={a} />
 ))}
 </div>
 )}

 {loading ? (
 <div className="flex flex-1 items-center justify-center">
 <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: "var(--pulse-text-tertiary)", borderTopColor: "transparent" }} />
 </div>
 ) : correlations.length === 0 ? (
 <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
 <BarChart3 className="h-12 w-12 text-pulse-text-secondary/30" />
 <div>
 <p className="text-sm font-medium">No correlations computed yet</p>
 <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--pulse-text-secondary)" }}>
 Click <strong>Run Correlation Engine</strong> above to analyze your health data.
 The engine needs at least 60 days of data to find statistically significant patterns.
 </p>
 </div>
 <div className="grid grid-cols-3 gap-4 mt-2 text-center">
 <div>
 <p className="text-lg font-bold tabular-nums text-pulse-emerald">90+</p>
 <p className="text-[10px]" style={{ color: "var(--pulse-text-tertiary)" }}>days for High confidence</p>
 </div>
 <div>
 <p className="text-lg font-bold tabular-nums text-pulse-amber">60–90</p>
 <p className="text-[10px]" style={{ color: "var(--pulse-text-tertiary)" }}>days for Medium</p>
 </div>
 <div>
 <p className="text-lg font-bold tabular-nums text-pulse-text-secondary">{"<60"}</p>
 <p className="text-[10px]" style={{ color: "var(--pulse-text-tertiary)" }}>days = Low</p>
 </div>
 </div>
 <Button onClick={handleComputeCorrelations} disabled={computing} className="mt-2">
 {computing ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <Zap className="h-4 w-4 mr-1.5" />}
 {computing ? "Computing..." : "Run Correlation Engine"}
 </Button>
 </CardContent>
 </Card>
 ) : (
 <>
 {/* Summary row */}
 <div className="grid grid-cols-4 gap-2">
 <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-3 text-center">
 <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: "var(--font-data)" }}>{correlations.length}</p>
 <p className="text-[10px]" style={{ color: "var(--pulse-text-tertiary)" }}>Pairs Tested</p>
 </CardContent>
 </Card>
 <Card className="" style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-3 text-center">
 <p className="text-2xl font-bold tabular-nums text-pulse-emerald" style={{ fontFamily: "var(--font-data)" }}>{highCount}</p>
 <p className="text-[10px]" style={{ color: "var(--pulse-text-tertiary)" }}>High Confidence</p>
 </CardContent>
 </Card>
 <Card className="" style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-3 text-center">
 <p className="text-2xl font-bold tabular-nums text-pulse-amber" style={{ fontFamily: "var(--font-data)" }}>{medCount}</p>
 <p className="text-[10px]" style={{ color: "var(--pulse-text-tertiary)" }}>Medium</p>
 </CardContent>
 </Card>
 <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-3 text-center">
 <p className="text-2xl font-bold tabular-nums">{correlations.length - highCount - medCount}</p>
 <p className="text-[10px]" style={{ color: "var(--pulse-text-tertiary)" }}>Low</p>
 </CardContent>
 </Card>
 </div>

 {/* Top findings */}
 {(strongestPositive || strongestNegative) && (
 <div className="grid gap-2 sm:grid-cols-2">
 {strongestPositive && (
 <Card className="" style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-4">
 <div className="flex items-center gap-2 mb-1">
 <TrendingUp className="h-4 w-4 text-pulse-emerald" />
 <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>Strongest Positive</p>
 </div>
 <p className="text-sm font-medium">
 {metricLabel(strongestPositive.variable_a)} → {metricLabel(strongestPositive.variable_b)}
 </p>
 <p className="text-lg font-bold text-pulse-emerald tabular-nums">
 r = {strongestPositive.r_value.toFixed(3)}
 </p>
 </CardContent>
 </Card>
 )}
 {strongestNegative && (
 <Card className="" style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-4">
 <div className="flex items-center gap-2 mb-1">
 <TrendingDown className="h-4 w-4 text-pulse-coral" />
 <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>Strongest Negative</p>
 </div>
 <p className="text-sm font-medium">
 {metricLabel(strongestNegative.variable_a)} → {metricLabel(strongestNegative.variable_b)}
 </p>
 <p className="text-lg font-bold text-pulse-coral tabular-nums">
 r = {strongestNegative.r_value.toFixed(3)}
 </p>
 </CardContent>
 </Card>
 )}
 </div>
 )}

 {/* Filter and sort controls */}
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>Filter:</span>
 {[null, "high", "medium", "low"].map((tier) => (
 <button
 key={tier ?? "all"}
 onClick={() => setFilterTier(tier)}
 className={cn(
 "rounded-full border px-3 py-1 text-xs font-medium transition-all",
 filterTier === tier
 ? " text-pulse-text-primary"
 : "border-[var(--pulse-border-default)] text-pulse-text-secondary hover:text-pulse-text-primary"
 )}
 >
 {tier ? TIER_CONFIG[tier].label : "All"}
 </button>
 ))}
 <span className="text-xs ml-2" style={{ color: "var(--pulse-text-secondary)" }}>Sort:</span>
 {([["r_value", "|r|"], ["p_value", "p-value"], ["n", "Sample"]] as const).map(([key, label]) => (
 <button
 key={key}
 onClick={() => setSortBy(key)}
 className={cn(
 "rounded-full border px-3 py-1 text-xs font-medium transition-all",
 sortBy === key
 ? " text-pulse-text-primary"
 : "border-[var(--pulse-border-default)] text-pulse-text-secondary hover:text-pulse-text-primary"
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
 <Card className="border-dashed" style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-4 flex gap-3">
 <Info className="h-4 w-4 text-pulse-text-secondary shrink-0 mt-0.5" />
 <div className="text-xs space-y-1" style={{ color: "var(--pulse-text-secondary)" }}>
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
