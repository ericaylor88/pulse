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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
 Plus,
 Save,
 Check,
 ChevronDown,
 ChevronUp,
 TestTubes,
 TrendingDown,
 TrendingUp,
 Minus,
 CalendarDays,
 Trash2,
 Info,
 X,
} from "lucide-react";
import {
 ResponsiveContainer,
 LineChart,
 Line,
 XAxis,
 YAxis,
 Tooltip as RechartsTooltip,
 ReferenceLine,
 ReferenceArea,
} from "recharts";
import {
 BIOMARKERS,
 CATEGORY_LABELS,
 CATEGORY_EMOJIS,
 CATEGORY_ORDER,
 getBiomarkerByKey,
 getBiomarkersByCategory,
 getBiomarkerZone,
 ZONE_COLORS,
 ZONE_BG_COLORS,
 ZONE_LABELS,
 type BiomarkerConfig,
 type BiomarkerCategory,
 type BiomarkerZone,
} from "@/lib/blood-panel-config";

// ─── Types ───────────────────────────────────────────────────────────────

interface PanelEntry {
 biomarker: string;
 value: number;
 panel_date: string;
 lab_name?: string;
}

interface StoredPanel {
 id: string;
 biomarker: string;
 value: number;
 unit: string;
 panel_date: string;
 lab_name: string | null;
 optimal_min: number | null;
 optimal_max: number | null;
 ref_range_min: number | null;
 ref_range_max: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatDate(date: string): string {
 return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
 month: "short",
 day: "numeric",
 year: "numeric",
 });
}

function formatShortDate(date: string): string {
 return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
 month: "short",
 year: "2-digit",
 });
}

// ─── Range Bar Component ─────────────────────────────────────────────────

function RangeBar({
 config,
 value,
}: {
 config: BiomarkerConfig;
 value: number;
}) {
 const spread = config.labMax - config.labMin;
 const barMin = config.labMin - spread * 0.25;
 const barMax = config.labMax + spread * 0.25;
 const barRange = barMax - barMin;

 const clampedValue = Math.max(barMin, Math.min(barMax, value));
 const valuePos = ((clampedValue - barMin) / barRange) * 100;
 const optimalLeft = ((config.optimalMin - barMin) / barRange) * 100;
 const optimalRight = ((config.optimalMax - barMin) / barRange) * 100;
 const labLeft = ((config.labMin - barMin) / barRange) * 100;
 const labRight = ((config.labMax - barMin) / barRange) * 100;

 const zone = getBiomarkerZone(config, value);
 const markerColor =
 zone === "optimal"
 ? "bg-[var(--pulse-emerald)]"
 : zone === "caution_low" || zone === "caution_high"
 ? "bg-amber-500"
 : "bg-red-400";

 return (
 <div className="relative h-3 w-full rounded-full overflow-hidden">
 <div
 className="absolute top-0 h-full bg-[var(--pulse-bg-surface-raised)]/40 rounded-full"
 style={{
 left: `${Math.max(0, labLeft)}%`,
 width: `${Math.min(100, labRight) - Math.max(0, labLeft)}%`,
 }}
 />
 <div
 className="absolute top-0 h-full bg-[var(--pulse-emerald)]/20 rounded-full"
 style={{
 left: `${Math.max(0, optimalLeft)}%`,
 width: `${Math.min(100, optimalRight) - Math.max(0, optimalLeft)}%`,
 }}
 />
 <div
 className={cn("absolute top-0 h-full w-1.5 rounded-full", markerColor)}
 style={{ left: `${Math.max(0, Math.min(98, valuePos))}%` }}
 />
 </div>
 );
}

// ─── Biomarker Card ──────────────────────────────────────────────────────

function BiomarkerCard({
 config,
 entries,
}: {
 config: BiomarkerConfig;
 entries: StoredPanel[];
}) {
 const [showTrend, setShowTrend] = useState(false);
 const latest = entries[0];
 if (!latest) return null;

 const zone = getBiomarkerZone(config, latest.value);
 const previous = entries.length > 1 ? entries[1] : null;
 const delta = previous ? latest.value - previous.value : null;

 const chartData = [...entries]
 .reverse()
 .map((e) => ({
 date: formatShortDate(e.panel_date),
 value: e.value,
 }));

 return (
 <Card className={cn("border transition-all", ZONE_BG_COLORS[zone])}>
 <CardContent className="p-4 space-y-3">
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2">
 <p className="text-sm font-medium truncate">{config.name}</p>
 {config.lowerIsBetter && (
 <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
 Lower is better
 </Badge>
 )}
 </div>
 <p className="text-xs mt-0.5" style={{ color: "var(--pulse-text-secondary)" }}>
 {config.unit} · Optimal: {config.optimalMin}–{config.optimalMax}
 </p>
 </div>
 <div className="text-right shrink-0">
 <p className={cn("text-2xl font-bold tabular-nums", ZONE_COLORS[zone])}>
 {latest.value.toFixed(config.decimals)}
 </p>
 <Badge
 variant="outline"
 className={cn("text-[10px] px-1.5 py-0", ZONE_COLORS[zone])}
 >
 {ZONE_LABELS[zone]}
 </Badge>
 </div>
 </div>

 <RangeBar config={config} value={latest.value} />

 <div className="flex justify-between text-[10px] -mt-1" style={{ color: "var(--pulse-text-tertiary)" }}>
 <span>{config.labMin}</span>
 <span className="text-pulse-emerald/70">
 {config.optimalMin}–{config.optimalMax}
 </span>
 <span>{config.labMax}</span>
 </div>

 {delta !== null && (
 <div className="flex items-center gap-1 text-xs" style={{ color: "var(--pulse-text-secondary)" }}>
 {delta > 0 ? (
 <TrendingUp className="h-3 w-3" />
 ) : delta < 0 ? (
 <TrendingDown className="h-3 w-3" />
 ) : (
 <Minus className="h-3 w-3" />
 )}
 <span>
 {delta > 0 ? "+" : ""}
 {delta.toFixed(config.decimals)} from {formatDate(previous!.panel_date)}
 </span>
 </div>
 )}

 {entries.length > 1 && (
 <>
 <button
 onClick={() => setShowTrend(!showTrend)}
 className="flex items-center gap-1 text-xs hover:text-pulse-text-primary transition-colors" style={{ color: "var(--pulse-text-secondary)" }}
 >
 {showTrend ? (
 <ChevronUp className="h-3 w-3" />
 ) : (
 <ChevronDown className="h-3 w-3" />
 )}
 {showTrend ? "Hide" : "Show"} history ({entries.length} panels)
 </button>

 {showTrend && (
 <div className="h-24">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={chartData}>
 <ReferenceArea
 y1={config.optimalMin}
 y2={config.optimalMax}
 fill="#10b981"
 fillOpacity={0.08}
 />
 <ReferenceLine
 y={config.optimalMin}
 stroke="#10b981"
 strokeDasharray="3 3"
 strokeOpacity={0.3}
 />
 <ReferenceLine
 y={config.optimalMax}
 stroke="#10b981"
 strokeDasharray="3 3"
 strokeOpacity={0.3}
 />
 <XAxis
 dataKey="date"
 tick={{ fontSize: 10 }}
 stroke="hsl(var(--muted-foreground))"
 strokeOpacity={0.3}
 />
 <YAxis
 domain={["auto", "auto"]}
 tick={{ fontSize: 10 }}
 stroke="hsl(var(--muted-foreground))"
 strokeOpacity={0.3}
 width={35}
 />
 <RechartsTooltip
 contentStyle={{
 background: "hsl(var(--card))",
 border: "1px solid hsl(var(--border))",
 borderRadius: "8px",
 fontSize: "12px",
 }}
 />
 <Line
 type="monotone"
 dataKey="value"
 stroke="hsl(var(--foreground))"
 strokeWidth={2}
 dot={{ r: 3, fill: "hsl(var(--foreground))" }}
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 )}
 </>
 )}
 </CardContent>
 </Card>
 );
}

// ─── Panel Entry Form ────────────────────────────────────────────────────

function PanelEntryForm({
 onSave,
 onCancel,
}: {
 onSave: (entries: PanelEntry[]) => Promise<void>;
 onCancel: () => void;
}) {
 const [panelDate, setPanelDate] = useState(
 new Date().toISOString().split("T")[0]
 );
 const [labName, setLabName] = useState("");
 const [values, setValues] = useState<Record<string, string>>({});
 const [saving, setSaving] = useState(false);
 const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
 new Set(["lipids", "metabolic", "inflammation"])
 );

 const toggleCategory = (cat: string) => {
 setExpandedCategories((prev) => {
 const next = new Set(prev);
 if (next.has(cat)) next.delete(cat);
 else next.add(cat);
 return next;
 });
 };

 const handleSave = async () => {
 setSaving(true);
 const entries: PanelEntry[] = Object.entries(values)
 .filter(([, v]) => v.trim() !== "")
 .map(([biomarker, v]) => ({
 biomarker,
 value: parseFloat(v),
 panel_date: panelDate,
 lab_name: labName || undefined,
 }));

 if (entries.length === 0) {
 setSaving(false);
 return;
 }

 await onSave(entries);
 setSaving(false);
 };

 const filledCount = Object.values(values).filter((v) => v.trim() !== "").length;

 return (
 <div className="space-y-4">
 <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <CalendarDays className="h-4 w-4" />
 Panel Info
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label className="text-xs">Date</Label>
 <Input
 type="date"
 value={panelDate}
 onChange={(e) => setPanelDate(e.target.value)}
 className="mt-1"
 />
 </div>
 <div>
 <Label className="text-xs">Lab Name (optional)</Label>
 <Input
 placeholder="e.g. Quest, Labcorp"
 value={labName}
 onChange={(e) => setLabName(e.target.value)}
 className="mt-1"
 />
 </div>
 </div>
 </CardContent>
 </Card>

 {CATEGORY_ORDER.map((cat) => {
 const biomarkers = getBiomarkersByCategory(cat);
 const isExpanded = expandedCategories.has(cat);
 const catFilledCount = biomarkers.filter(
 (b) => values[b.key]?.trim()
 ).length;

 return (
 <Card key={cat}>
 <CardHeader className="pb-0">
 <button
 className="flex items-center justify-between w-full text-left"
 onClick={() => toggleCategory(cat)}
 >
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <span>{CATEGORY_EMOJIS[cat]}</span>
 {CATEGORY_LABELS[cat]}
 {catFilledCount > 0 && (
 <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
 {catFilledCount}/{biomarkers.length}
 </Badge>
 )}
 </CardTitle>
 {isExpanded ? (
 <ChevronUp className="h-4 w-4 text-pulse-text-secondary" />
 ) : (
 <ChevronDown className="h-4 w-4 text-pulse-text-secondary" />
 )}
 </button>
 </CardHeader>
 {isExpanded && (
 <CardContent className="pt-3 space-y-3">
 {biomarkers.map((bio) => (
 <div key={bio.key} className="grid grid-cols-[1fr_auto] gap-2 items-end">
 <div>
 <Label className="text-xs flex items-center gap-1">
 {bio.shortName}
 <span className="text-pulse-text-secondary font-normal">
 ({bio.unit})
 </span>
 </Label>
 <Input
 type="number"
 step={bio.decimals > 0 ? Math.pow(10, -bio.decimals) : 1}
 placeholder={`${bio.optimalMin}–${bio.optimalMax} optimal`}
 value={values[bio.key] ?? ""}
 onChange={(e) =>
 setValues((prev) => ({
 ...prev,
 [bio.key]: e.target.value,
 }))
 }
 className="mt-1"
 />
 </div>
 <div className="pb-0.5">
 {values[bio.key]?.trim() && !isNaN(parseFloat(values[bio.key])) && (
 <Badge
 variant="outline"
 className={cn(
 "text-[10px] px-1.5",
 ZONE_COLORS[
 getBiomarkerZone(bio, parseFloat(values[bio.key]))
 ]
 )}
 >
 {
 ZONE_LABELS[
 getBiomarkerZone(bio, parseFloat(values[bio.key]))
 ]
 }
 </Badge>
 )}
 </div>
 </div>
 ))}
 </CardContent>
 )}
 </Card>
 );
 })}

 <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-[var(--pulse-bg-surface-overlay)] p-4 backdrop-blur-sm">
 <div className="mx-auto max-w-lg flex gap-2">
 <Button variant="outline" onClick={onCancel} className="flex-1">
 Cancel
 </Button>
 <Button
 onClick={handleSave}
 disabled={saving || filledCount === 0}
 className="flex-1"
 >
 {saving ? (
 <span className="flex items-center gap-2">
 <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
 Saving...
 </span>
 ) : (
 <span className="flex items-center gap-2">
 <Save className="h-4 w-4" />
 Save {filledCount} biomarker{filledCount !== 1 ? "s" : ""}
 </span>
 )}
 </Button>
 </div>
 </div>
 </div>
 );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function BloodWorkPage() {
 const [panels, setPanels] = useState<StoredPanel[]>([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [panelDates, setPanelDates] = useState<string[]>([]);
 const [selectedDate, setSelectedDate] = useState<string | null>(null);

 const supabase = createClient();

 const loadPanels = useCallback(async () => {
 setLoading(true);
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) {
 setLoading(false);
 return;
 }

 const { data } = await supabase
 .from("blood_panels")
 .select("*")
 .eq("user_id", user.id)
 .order("panel_date", { ascending: false });

 if (data) {
 setPanels(data as StoredPanel[]);
 const dates = [...new Set(data.map((d: any) => d.panel_date))].sort(
 (a, b) => (b as string).localeCompare(a as string)
 );
 setPanelDates(dates as string[]);
 if (!selectedDate && dates.length > 0) {
 setSelectedDate(dates[0] as string);
 }
 }
 setLoading(false);
 }, [supabase, selectedDate]);

 useEffect(() => {
 loadPanels();
 }, [loadPanels]);

 const handleSavePanel = async (entries: PanelEntry[]) => {
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) return;

 for (const entry of entries) {
 const config = getBiomarkerByKey(entry.biomarker);
 if (!config) continue;

 await supabase.from("blood_panels").upsert(
 {
 user_id: user.id,
 panel_date: entry.panel_date,
 biomarker: entry.biomarker,
 value: entry.value,
 unit: config.unit,
 lab_name: entry.lab_name ?? null,
 optimal_min: config.optimalMin,
 optimal_max: config.optimalMax,
 ref_range_min: config.labMin,
 ref_range_max: config.labMax,
 },
 { onConflict: "user_id,panel_date,biomarker" }
 );
 }

 setShowForm(false);
 setSelectedDate(entries[0]?.panel_date ?? null);
 await loadPanels();
 };

 const handleDeletePanel = async (date: string) => {
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) return;

 await supabase
 .from("blood_panels")
 .delete()
 .eq("user_id", user.id)
 .eq("panel_date", date);

 setSelectedDate(null);
 await loadPanels();
 };

 // Group panels by biomarker for the selected date view
 const selectedPanels = selectedDate
 ? panels.filter((p) => p.panel_date === selectedDate)
 : [];

 // For each biomarker that has data, get all historical entries
 const biomarkerHistory: Record<string, StoredPanel[]> = {};
 for (const p of panels) {
 if (!biomarkerHistory[p.biomarker]) biomarkerHistory[p.biomarker] = [];
 biomarkerHistory[p.biomarker].push(p);
 }

 // Group selected date panels by category
 const categorizedPanels: Record<string, StoredPanel[]> = {};
 for (const p of selectedPanels) {
 const config = getBiomarkerByKey(p.biomarker);
 if (!config) continue;
 const cat = config.category;
 if (!categorizedPanels[cat]) categorizedPanels[cat] = [];
 categorizedPanels[cat].push(p);
 }

 // Summary stats
 const totalBiomarkers = selectedPanels.length;
 const optimalCount = selectedPanels.filter((p) => {
 const c = getBiomarkerByKey(p.biomarker);
 return c && getBiomarkerZone(c, p.value) === "optimal";
 }).length;
 const cautionCount = selectedPanels.filter((p) => {
 const c = getBiomarkerByKey(p.biomarker);
 if (!c) return false;
 const z = getBiomarkerZone(c, p.value);
 return z === "caution_low" || z === "caution_high";
 }).length;
 const flaggedCount = selectedPanels.filter((p) => {
 const c = getBiomarkerByKey(p.biomarker);
 if (!c) return false;
 const z = getBiomarkerZone(c, p.value);
 return z === "low" || z === "high";
 }).length;

 if (showForm) {
 return (
 <div className="flex flex-1 flex-col gap-6 p-4 pt-0 lg:p-6 lg:pt-0">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-[30px] font-bold" style={{ color: "var(--pulse-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>Add Blood Panel</h2>
 <p className="text-sm" style={{ color: "var(--pulse-text-secondary)" }}>
 Enter your lab results — only fill in what you have
 </p>
 </div>
 </div>
 <PanelEntryForm
 onSave={handleSavePanel}
 onCancel={() => setShowForm(false)}
 />
 <div className="h-20" />
 </div>
 );
 }

 return (
 <div className="flex flex-1 flex-col gap-6 p-4 pt-0 pb-8 lg:p-6 lg:pt-0">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-[30px] font-bold" style={{ color: "var(--pulse-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>Blood Work</h2>
 <p className="text-sm" style={{ color: "var(--pulse-text-secondary)" }}>
 Biomarker tracking with optimal ranges
 </p>
 </div>
 <Button onClick={() => setShowForm(true)} size="sm">
 <Plus className="mr-1 h-4 w-4" />
 Add Panel
 </Button>
 </div>

 {loading ? (
 <div className="flex flex-1 items-center justify-center">
 <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: "var(--pulse-text-tertiary)", borderTopColor: "transparent" }} />
 </div>
 ) : panels.length === 0 ? (
 <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
 <TestTubes className="h-12 w-12 text-pulse-text-secondary/30" />
 <div>
 <p className="text-sm font-medium">No blood panels yet</p>
 <p className="text-xs mt-1" style={{ color: "var(--pulse-text-secondary)" }}>
 Add your lab results to track biomarkers against optimal ranges
 </p>
 </div>
 <Button onClick={() => setShowForm(true)} size="sm">
 <Plus className="mr-1 h-4 w-4" />
 Add Your First Panel
 </Button>
 </CardContent>
 </Card>
 ) : (
 <>
 <div className="flex gap-2 overflow-x-auto pb-1">
 {panelDates.map((date) => (
 <button
 key={date}
 onClick={() => setSelectedDate(date)}
 className={cn(
 "shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
 selectedDate === date
 ? " text-pulse-text-primary"
 : "border-[var(--pulse-border-default)] text-pulse-text-secondary hover:text-pulse-text-primary"
 )}
 >
 {formatDate(date)}
 </button>
 ))}
 </div>

 {selectedDate && totalBiomarkers > 0 && (
 <div className="grid grid-cols-4 gap-2">
 <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-3 text-center">
 <p className="text-2xl font-bold tabular-nums">{totalBiomarkers}</p>
 <p className="text-[10px]" style={{ color: "var(--pulse-text-tertiary)" }}>Tested</p>
 </CardContent>
 </Card>
 <Card className="" style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-3 text-center">
 <p className="text-2xl font-bold tabular-nums text-pulse-emerald">
 {optimalCount}
 </p>
 <p className="text-[10px]" style={{ color: "var(--pulse-text-tertiary)" }}>Optimal</p>
 </CardContent>
 </Card>
 <Card className="" style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-3 text-center">
 <p className="text-2xl font-bold tabular-nums text-pulse-amber">
 {cautionCount}
 </p>
 <p className="text-[10px]" style={{ color: "var(--pulse-text-tertiary)" }}>Caution</p>
 </CardContent>
 </Card>
 <Card className="" style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-3 text-center">
 <p className="text-2xl font-bold tabular-nums text-pulse-coral">
 {flaggedCount}
 </p>
 <p className="text-[10px]" style={{ color: "var(--pulse-text-tertiary)" }}>Flagged</p>
 </CardContent>
 </Card>
 </div>
 )}

 {selectedDate &&
 CATEGORY_ORDER.filter((cat) => categorizedPanels[cat]?.length).map(
 (cat) => (
 <div key={cat} className="space-y-2">
 <h3 className="text-sm font-medium text-pulse-text-secondary flex items-center gap-1.5 px-1">
 <span>{CATEGORY_EMOJIS[cat]}</span>
 {CATEGORY_LABELS[cat]}
 </h3>
 <div className="grid gap-2 sm:grid-cols-2">
 {categorizedPanels[cat].map((panel) => {
 const config = getBiomarkerByKey(panel.biomarker);
 if (!config) return null;
 return (
 <BiomarkerCard
 key={panel.biomarker}
 config={config}
 entries={biomarkerHistory[panel.biomarker] ?? []}
 />
 );
 })}
 </div>
 </div>
 )
 )}

 {selectedDate && (
 <div className="flex justify-center pt-4">
 <Button
 variant="ghost"
 size="sm"
 className="text-pulse-text-secondary hover:text-pulse-coral"
 onClick={() => {
 if (confirm(`Delete all results from ${formatDate(selectedDate)}?`)) {
 handleDeletePanel(selectedDate);
 }
 }}
 >
 <Trash2 className="mr-1 h-3.5 w-3.5" />
 Delete this panel
 </Button>
 </div>
 )}

 <Card className="border-dashed" style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-4 flex gap-3">
 <Info className="h-4 w-4 text-pulse-text-secondary shrink-0 mt-0.5" />
 <div className="text-xs space-y-1" style={{ color: "var(--pulse-text-secondary)" }}>
 <p>
 <strong>Optimal ranges</strong> reflect functional/preventive
 medicine targets, which are often tighter than standard lab
 reference ranges.
 </p>
 <p>
 This is not medical advice. Always discuss results with your
 healthcare provider.
 </p>
 </div>
 </CardContent>
 </Card>
 </>
 )}
 </div>
 );
}
