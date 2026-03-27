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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  Save,
  Trash2,
  AlertTriangle,
  Thermometer,
  X,
  Calendar,
  Edit2,
  Brain,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────

interface IllnessEntry {
  id?: number;
  start_date: string;
  end_date: string | null;
  severity: number;
  symptoms: string[];
  illness_type: string;
  notes: string;
}

// ─── Constants ───────────────────────────────────────────────────────────

const ILLNESS_TYPES = [
  { value: "cold", label: "Cold", emoji: "🤧" },
  { value: "flu", label: "Flu", emoji: "🤒" },
  { value: "covid", label: "COVID", emoji: "😷" },
  { value: "allergies", label: "Allergies", emoji: "🌸" },
  { value: "food_poisoning", label: "Food Poisoning", emoji: "🤢" },
  { value: "migraine", label: "Migraine", emoji: "🤕" },
  { value: "injury", label: "Injury", emoji: "🩹" },
  { value: "other", label: "Other", emoji: "📋" },
];

const COMMON_SYMPTOMS = [
  "Sore throat",
  "Runny nose",
  "Congestion",
  "Cough",
  "Fever",
  "Headache",
  "Body aches",
  "Fatigue",
  "Nausea",
  "Chills",
  "Sneezing",
  "Loss of taste/smell",
  "Dizziness",
  "Stomach pain",
  "Diarrhea",
  "Shortness of breath",
];

const SEVERITY_LABELS = [
  { value: 1, label: "Minimal", color: "text-emerald-500", bg: "bg-emerald-500" },
  { value: 2, label: "Mild", color: "text-amber-400", bg: "bg-amber-400" },
  { value: 3, label: "Moderate", color: "text-amber-500", bg: "bg-amber-500" },
  { value: 4, label: "Severe", color: "text-orange-500", bg: "bg-orange-500" },
  { value: 5, label: "Critical", color: "text-red-500", bg: "bg-red-500" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function durationDays(start: string, end: string | null): string {
  const endDate = end ? new Date(end + "T12:00:00") : new Date();
  const startDate = new Date(start + "T12:00:00");
  const days = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function illnessTypeInfo(type: string) {
  return (
    ILLNESS_TYPES.find((t) => t.value === type) ?? {
      value: type,
      label: type,
      emoji: "📋",
    }
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function IllnessLogPage() {
  const [entries, setEntries] = useState<IllnessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [patternResult, setPatternResult] = useState<{
    ok: boolean;
    events_analyzed: number;
    baseline_days: number;
    patterns: {
      metric: string;
      label: string;
      direction: string;
      avg_z_score: number;
      avg_pct_change: number;
      events_showing_pattern: number;
      total_events: number;
      consistency: string;
      confidence_tier: string;
    }[];
    message?: string;
    error?: string;
  } | null>(null);

  // Form state
  const [formStartDate, setFormStartDate] = useState(todayStr());
  const [formEndDate, setFormEndDate] = useState("");
  const [formSeverity, setFormSeverity] = useState(3);
  const [formSymptoms, setFormSymptoms] = useState<string[]>([]);
  const [formType, setFormType] = useState("cold");
  const [formNotes, setFormNotes] = useState("");

  const supabase = createClient();

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("illness_log")
      .select("*")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false })
      .limit(50);

    setEntries(
      (data ?? []).map((row) => ({
        id: row.id,
        start_date: row.start_date,
        end_date: row.end_date,
        severity: row.severity,
        symptoms: row.symptoms ?? [],
        illness_type: row.illness_type ?? "other",
        notes: row.notes ?? "",
      }))
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const resetForm = () => {
    setFormStartDate(todayStr());
    setFormEndDate("");
    setFormSeverity(3);
    setFormSymptoms([]);
    setFormType("cold");
    setFormNotes("");
    setEditingId(null);
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (entry: IllnessEntry) => {
    setFormStartDate(entry.start_date);
    setFormEndDate(entry.end_date ?? "");
    setFormSeverity(entry.severity);
    setFormSymptoms(entry.symptoms);
    setFormType(entry.illness_type);
    setFormNotes(entry.notes);
    setEditingId(entry.id ?? null);
    setShowForm(true);
  };

  const toggleSymptom = (symptom: string) => {
    setFormSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const payload = {
      user_id: user.id,
      start_date: formStartDate,
      end_date: formEndDate || null,
      severity: formSeverity,
      symptoms: formSymptoms,
      illness_type: formType,
      notes: formNotes || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from("illness_log")
        .update(payload)
        .eq("id", editingId));
    } else {
      ({ error } = await supabase.from("illness_log").insert(payload));
    }

    if (error) {
      console.error("Failed to save illness log:", error);
    } else {
      setShowForm(false);
      resetForm();
      loadEntries();
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("illness_log").delete().eq("id", id);
    if (!error) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
  };

  // Mark current illness as resolved (set end_date to today)
  const markResolved = async (entry: IllnessEntry) => {
    if (!entry.id) return;
    const { error } = await supabase
      .from("illness_log")
      .update({ end_date: todayStr() })
      .eq("id", entry.id);
    if (!error) {
      loadEntries();
    }
  };

  // Separate active (no end_date) from resolved
  const activeEntries = entries.filter((e) => !e.end_date);

  // Analyze pre-illness patterns
  const handleAnalyzePatterns = async () => {
    setAnalyzing(true);
    setPatternResult(null);
    try {
      const res = await fetch("/api/illness-patterns/analyze", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPatternResult({ ok: false, events_analyzed: 0, baseline_days: 0, patterns: [], error: data.error ?? `Error ${res.status}` });
      } else {
        setPatternResult(data);
      }
    } catch {
      setPatternResult({ ok: false, events_analyzed: 0, baseline_days: 0, patterns: [], error: "Network error." });
    }
    setAnalyzing(false);
  };
  const resolvedEntries = entries.filter((e) => !!e.end_date);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Illness Log</h2>
          <p className="text-muted-foreground text-sm">
            Log illness events with symptoms, severity, and duration
          </p>
        </div>
        {!showForm && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleAnalyzePatterns} disabled={analyzing || entries.length === 0}>
              {analyzing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
              {analyzing ? "Analyzing..." : "Analyze Patterns"}
            </Button>
            <Button onClick={openNewForm}>
              <Plus className="mr-2 h-4 w-4" />
              Log Illness
            </Button>
          </div>
        )}
      </div>

      {/* Pattern Analysis Results */}
      {patternResult && (
        <Card className={cn("border", patternResult.error ? "border-red-400/30 bg-red-400/5" : patternResult.patterns.length > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5")}>
          <CardContent className="p-4 space-y-3">
            {patternResult.error ? (
              <p className="text-sm text-red-400">{patternResult.error}</p>
            ) : patternResult.message ? (
              <p className="text-sm text-muted-foreground">{patternResult.message}</p>
            ) : patternResult.patterns.length === 0 ? (
              <p className="text-sm text-emerald-500">
                Analyzed {patternResult.events_analyzed} illness event{patternResult.events_analyzed !== 1 ? "s" : ""} against {patternResult.baseline_days} baseline days — no consistent pre-illness patterns detected yet.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-medium text-amber-500">
                    {patternResult.patterns.length} pre-illness pattern{patternResult.patterns.length !== 1 ? "s" : ""} detected ({patternResult.events_analyzed} event{patternResult.events_analyzed !== 1 ? "s" : ""} analyzed)
                  </p>
                </div>
                <div className="space-y-2">
                  {patternResult.patterns.map((p) => {
                    const tierColor = p.confidence_tier === "high" ? "text-emerald-500" : p.confidence_tier === "medium" ? "text-amber-500" : "text-muted-foreground";
                    return (
                      <div key={p.metric} className="flex items-start gap-3 rounded-md border border-border/50 bg-background/50 p-3">
                        {p.direction === "down" ? (
                          <TrendingDown className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium">{p.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.direction === "down" ? "Drops" : "Rises"} ~{Math.abs(p.avg_pct_change)}% before illness ({p.avg_z_score > 0 ? "+" : ""}{p.avg_z_score}σ)
                          </p>
                          <div className="flex gap-1.5 flex-wrap">
                            <Badge variant="secondary" className={cn("text-[10px]", tierColor)}>
                              {p.confidence_tier} confidence
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {p.consistency} events
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Patterns saved to Recommendations. Confidence improves with more logged illness events.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-lg space-y-4">
          {/* New / Edit form */}
          {showForm && (
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {editingId ? "Edit Illness" : "Log New Illness"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Type */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Type
                  </Label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ILLNESS_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setFormType(type.value)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                          formType === type.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:border-foreground/30"
                        )}
                      >
                        {type.emoji} {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Start Date
                    </Label>
                    <Input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      max={todayStr()}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      End Date{" "}
                      <span className="text-muted-foreground/50">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      min={formStartDate}
                      max={todayStr()}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Severity */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Severity
                  </Label>
                  <div className="mt-1.5 flex gap-1.5">
                    {SEVERITY_LABELS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setFormSeverity(s.value)}
                        className={cn(
                          "flex-1 rounded-lg border py-2 text-center text-xs font-medium transition-all",
                          formSeverity === s.value
                            ? `${s.bg} text-white border-transparent`
                            : "border-border text-muted-foreground hover:border-foreground/30"
                        )}
                      >
                        {s.value}
                        <br />
                        <span className="text-[10px] opacity-80">
                          {s.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Symptoms */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Symptoms
                  </Label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {COMMON_SYMPTOMS.map((symptom) => {
                      const isSelected = formSymptoms.includes(symptom);
                      return (
                        <button
                          key={symptom}
                          onClick={() => toggleSymptom(symptom)}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-foreground/30"
                          )}
                        >
                          {symptom}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Notes{" "}
                    <span className="text-muted-foreground/50">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    placeholder="Any additional context..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={2}
                    className="mt-1 resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleSave}
                    disabled={saving || !formStartDate || formSymptoms.length === 0}
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
                        {editingId ? "Update" : "Save"}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active illnesses */}
          {activeEntries.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-amber-500 flex items-center gap-2 px-1">
                <AlertTriangle className="h-4 w-4" />
                Currently Sick
              </p>
              {activeEntries.map((entry) => {
                const typeInfo = illnessTypeInfo(entry.illness_type);
                const sevInfo = SEVERITY_LABELS[entry.severity - 1];
                return (
                  <Card
                    key={entry.id}
                    className="border-amber-500/30 bg-amber-500/5"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{typeInfo.emoji}</span>
                            <span className="font-medium">
                              {typeInfo.label}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                sevInfo.color
                              )}
                            >
                              Severity {entry.severity}/5
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Started {formatDateDisplay(entry.start_date)} · {durationDays(entry.start_date, null)} so far
                          </p>
                          {entry.symptoms.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {entry.symptoms.map((s) => (
                                <Badge
                                  key={s}
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {entry.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              {entry.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditForm(entry)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full text-xs"
                        onClick={() => markResolved(entry)}
                      >
                        Mark as Resolved (end today)
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Resolved / past illnesses */}
          {resolvedEntries.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground px-1">
                Past Illnesses
              </p>
              {resolvedEntries.map((entry) => {
                const typeInfo = illnessTypeInfo(entry.illness_type);
                const sevInfo = SEVERITY_LABELS[entry.severity - 1];
                return (
                  <Card key={entry.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{typeInfo.emoji}</span>
                            <span className="font-medium">
                              {typeInfo.label}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                sevInfo.color
                              )}
                            >
                              {entry.severity}/5
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {durationDays(entry.start_date, entry.end_date)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDateDisplay(entry.start_date)}
                            {entry.end_date &&
                              ` → ${formatDateDisplay(entry.end_date)}`}
                          </p>
                          {entry.symptoms.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {entry.symptoms.map((s) => (
                                <Badge
                                  key={s}
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {entry.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              {entry.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditForm(entry)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-400"
                            onClick={() => entry.id && handleDelete(entry.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {entries.length === 0 && !showForm && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Thermometer className="h-10 w-10 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    No illness events logged
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Logging illness events helps Pulse detect pre-illness
                    patterns in your recovery data.
                  </p>
                </div>
                <Button onClick={openNewForm} className="mt-2">
                  <Plus className="mr-2 h-4 w-4" />
                  Log Your First Illness
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
