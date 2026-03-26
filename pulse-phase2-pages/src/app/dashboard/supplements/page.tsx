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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Save,
  Trash2,
  Pill,
  X,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────

interface Supplement {
  id?: number;
  name: string;
  dose_mg: number | null;
  dose_unit: string;
  timing: string;
  taken: boolean;
}

// ─── Preset supplements (quick-add) ──────────────────────────────────────

const PRESETS: { name: string; dose_mg: number; dose_unit: string; timing: string; emoji: string }[] = [
  { name: "Omega-3 Fish Oil", dose_mg: 2000, dose_unit: "mg", timing: "morning", emoji: "🐟" },
  { name: "Magnesium Glycinate", dose_mg: 400, dose_unit: "mg", timing: "bedtime", emoji: "🧲" },
  { name: "Ashwagandha", dose_mg: 600, dose_unit: "mg", timing: "evening", emoji: "🌿" },
  { name: "L-Theanine", dose_mg: 200, dose_unit: "mg", timing: "bedtime", emoji: "🍵" },
  { name: "Vitamin D3", dose_mg: 5000, dose_unit: "IU", timing: "morning", emoji: "☀️" },
  { name: "Creatine Monohydrate", dose_mg: 5, dose_unit: "g", timing: "morning", emoji: "💪" },
  { name: "Melatonin", dose_mg: 0.5, dose_unit: "mg", timing: "bedtime", emoji: "🌙" },
  { name: "Zinc", dose_mg: 30, dose_unit: "mg", timing: "evening", emoji: "⚡" },
  { name: "B-Complex", dose_mg: 1, dose_unit: "capsule", timing: "morning", emoji: "🅱️" },
  { name: "Turmeric / Curcumin", dose_mg: 1000, dose_unit: "mg", timing: "with_meal", emoji: "🟡" },
];

const TIMING_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "bedtime", label: "Bedtime" },
  { value: "with_meal", label: "With Meal" },
];

const UNIT_OPTIONS = ["mg", "mcg", "g", "IU", "ml", "capsule"];

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (formatDate(date) === formatDate(today)) return "Today";
  if (formatDate(date) === formatDate(yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timingLabel(timing: string): string {
  return TIMING_OPTIONS.find((t) => t.value === timing)?.label ?? timing;
}

function timingEmoji(timing: string): string {
  switch (timing) {
    case "morning": return "🌅";
    case "afternoon": return "☀️";
    case "evening": return "🌆";
    case "bedtime": return "🌙";
    case "with_meal": return "🍽️";
    default: return "💊";
  }
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function SupplementsPage() {
  const [date, setDate] = useState(() => new Date());
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // New supplement form state
  const [newName, setNewName] = useState("");
  const [newDose, setNewDose] = useState<string>("");
  const [newUnit, setNewUnit] = useState("mg");
  const [newTiming, setNewTiming] = useState("morning");

  const supabase = createClient();
  const dateStr = formatDate(date);

  const loadSupplements = useCallback(async () => {
    setLoading(true);
    setSaved(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("supplements")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", dateStr)
      .order("timing", { ascending: true });

    setSupplements(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        dose_mg: row.dose_mg,
        dose_unit: row.dose_unit ?? "mg",
        timing: row.timing ?? "morning",
        taken: row.taken ?? true,
      }))
    );
    setLoading(false);
  }, [supabase, dateStr]);

  useEffect(() => {
    loadSupplements();
  }, [loadSupplements]);

  const goToPreviousDay = () => {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    setDate(prev);
  };

  const goToNextDay = () => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    if (next <= new Date()) setDate(next);
  };

  const isToday = formatDate(date) === formatDate(new Date());

  const addPreset = (preset: typeof PRESETS[number]) => {
    // Check if already added for this day
    const exists = supplements.some(
      (s) => s.name.toLowerCase() === preset.name.toLowerCase()
    );
    if (exists) return;

    setSupplements((prev) => [
      ...prev,
      {
        name: preset.name,
        dose_mg: preset.dose_mg,
        dose_unit: preset.dose_unit,
        timing: preset.timing,
        taken: true,
      },
    ]);
    setSaved(false);
  };

  const addCustom = () => {
    if (!newName.trim()) return;
    setSupplements((prev) => [
      ...prev,
      {
        name: newName.trim(),
        dose_mg: newDose ? parseFloat(newDose) : null,
        dose_unit: newUnit,
        timing: newTiming,
        taken: true,
      },
    ]);
    setNewName("");
    setNewDose("");
    setNewUnit("mg");
    setNewTiming("morning");
    setShowAddForm(false);
    setSaved(false);
  };

  const toggleTaken = (index: number) => {
    setSupplements((prev) =>
      prev.map((s, i) => (i === index ? { ...s, taken: !s.taken } : s))
    );
    setSaved(false);
  };

  const removeSupplement = (index: number) => {
    setSupplements((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
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

    // Delete existing entries for this date, then insert fresh
    await supabase
      .from("supplements")
      .delete()
      .eq("user_id", user.id)
      .eq("date", dateStr);

    if (supplements.length > 0) {
      const rows = supplements.map((s) => ({
        user_id: user.id,
        date: dateStr,
        name: s.name,
        dose_mg: s.dose_mg,
        dose_unit: s.dose_unit,
        timing: s.timing,
        taken: s.taken,
      }));

      const { error } = await supabase.from("supplements").insert(rows);
      if (error) {
        console.error("Failed to save supplements:", error);
      } else {
        setSaved(true);
      }
    } else {
      setSaved(true);
    }

    setSaving(false);
  };

  // Copy previous day's supplements
  const copyPreviousDay = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);

    const { data } = await supabase
      .from("supplements")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", formatDate(prevDate));

    if (data && data.length > 0) {
      setSupplements(
        data.map((row) => ({
          name: row.name,
          dose_mg: row.dose_mg,
          dose_unit: row.dose_unit ?? "mg",
          timing: row.timing ?? "morning",
          taken: true, // Reset taken status
        }))
      );
      setSaved(false);
    }
  };

  // Group by timing for display
  const grouped = TIMING_OPTIONS.map((t) => ({
    ...t,
    items: supplements
      .map((s, i) => ({ ...s, index: i }))
      .filter((s) => s.timing === t.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Header + date nav */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Supplements</h2>
          <p className="text-muted-foreground text-sm">
            Track daily supplement intake, doses, and timing
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="min-w-[100px] text-center text-sm font-medium">
            {formatDisplayDate(date)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextDay}
            disabled={isToday}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-lg space-y-4 pb-20">
          {/* Supplement list grouped by timing */}
          {grouped.length > 0 ? (
            grouped.map((group) => (
              <Card key={group.value}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span>{timingEmoji(group.value)}</span>
                    {group.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.items.map((supp) => (
                    <div
                      key={supp.index}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 transition-all",
                        supp.taken
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-border opacity-60"
                      )}
                    >
                      <button
                        onClick={() => toggleTaken(supp.index)}
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                          supp.taken
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {supp.taken && <Check className="h-3.5 w-3.5" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            !supp.taken && "line-through"
                          )}
                        >
                          {supp.name}
                        </p>
                        {supp.dose_mg !== null && (
                          <p className="text-xs text-muted-foreground">
                            {supp.dose_mg} {supp.dose_unit}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => removeSupplement(supp.index)}
                        className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <Pill className="h-8 w-8 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    No supplements logged
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Add supplements below or copy from yesterday
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyPreviousDay}
                  className="mt-1"
                >
                  Copy from yesterday
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick-add presets */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Quick Add
                </CardTitle>
                {supplements.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={copyPreviousDay}
                  >
                    Copy yesterday
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => {
                  const alreadyAdded = supplements.some(
                    (s) =>
                      s.name.toLowerCase() === preset.name.toLowerCase()
                  );
                  return (
                    <button
                      key={preset.name}
                      onClick={() => addPreset(preset)}
                      disabled={alreadyAdded}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                        alreadyAdded
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : "border-border hover:border-foreground/30 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {preset.emoji} {preset.name}
                      {alreadyAdded && " ✓"}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Custom add form */}
          {showAddForm ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Add Custom Supplement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    placeholder="e.g. CoQ10, Probiotics..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Dose</Label>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={newDose}
                      onChange={(e) => setNewDose(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unit</Label>
                    <Select value={newUnit} onValueChange={setNewUnit}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_OPTIONS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Timing</Label>
                  <Select value={newTiming} onValueChange={setNewTiming}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMING_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {timingEmoji(t.value)} {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={addCustom}
                    disabled={!newName.trim()}
                    size="sm"
                    className="flex-1"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Custom Supplement
            </Button>
          )}

          {/* Save button */}
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 p-4 backdrop-blur-sm">
            <div className="mx-auto max-w-lg">
              <Button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "w-full transition-all",
                  saved ? "bg-emerald-600 hover:bg-emerald-600" : ""
                )}
                size="lg"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </span>
                ) : saved ? (
                  <span className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Saved
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Save Supplements
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
