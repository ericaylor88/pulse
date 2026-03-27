"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HABITS, type HabitConfig } from "@/lib/check-in-config";
import { Button } from "@/components/ui/button";
import {
 Card,
 CardContent,
 CardHeader,
 CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
 Check,
 ChevronLeft,
 ChevronRight,
 Minus,
 Plus,
 Save,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────

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

function generateTimeOptions(): string[] {
 const options: string[] = [];
 for (let h = 0; h < 24; h++) {
 for (const m of ["00", "30"]) {
 options.push(`${h.toString().padStart(2, "0")}:${m}`);
 }
 }
 return options;
}

function formatTimeDisplay(time: string): string {
 const [h, m] = time.split(":");
 const hour = parseInt(h);
 const ampm = hour >= 12 ? "PM" : "AM";
 const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
 return `${h12}:${m} ${ampm}`;
}

const TIME_OPTIONS = generateTimeOptions();

// ─── Toggle Card ──────────────────────────────────────────────────────────

function ToggleCard({
 habit,
 active,
 onToggle,
}: {
 habit: HabitConfig & { type: "toggle" };
 active: boolean;
 onToggle: () => void;
}) {
 return (
 <button
 onClick={onToggle}
 className={cn(
 "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all duration-200",
 "hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
 active
 ? "border-[var(--pulse-emerald)] bg-[var(--pulse-emerald-muted)]"
 : "border-[var(--pulse-border-default)] bg-transparent hover:border-[var(--pulse-text-tertiary)]"
 )}
 >
 {active && (
 <div className="absolute top-2 right-2">
 <Check className="h-4 w-4" style={{ color: "var(--pulse-emerald)" }} />
 </div>
 )}
 <span className="text-2xl">{habit.emoji}</span>
 <span
 className={cn(
 "text-sm font-medium",
 active ? "text-[var(--pulse-text-primary)]" : "text-[var(--pulse-text-secondary)]"
 )}
 >
 {habit.label}
 </span>
 </button>
 );
}

// ─── Quantity Card ────────────────────────────────────────────────────────

function QuantityCard({
 habit,
 value,
 timeValue,
 onValueChange,
 onTimeChange,
}: {
 habit: HabitConfig & { type: "quantity" };
 value: number;
 timeValue: string | null;
 onValueChange: (val: number) => void;
 onTimeChange?: (val: string | null) => void;
}) {
 return (
 <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <span className="text-2xl">{habit.emoji}</span>
 <div>
 <p className="font-medium text-sm">{habit.label}</p>
 <p className="text-xs" style={{ color: "var(--pulse-text-secondary)" }}>
 {value} {habit.unit}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <Button
 variant="outline"
 size="icon"
 className="h-8 w-8"
 onClick={() =>
 onValueChange(Math.max(habit.min, value - habit.step))
 }
 disabled={value <= habit.min}
 >
 <Minus className="h-3.5 w-3.5" />
 </Button>
 <Input
 type="number"
 min={habit.min}
 max={habit.max}
 step={habit.step}
 value={value}
 onChange={(e) => {
 const v = Number(e.target.value);
 if (!isNaN(v) && v >= habit.min && v <= habit.max) {
 onValueChange(v);
 }
 }}
 className="h-8 w-14 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
 />
 <Button
 variant="outline"
 size="icon"
 className="h-8 w-8"
 onClick={() =>
 onValueChange(Math.min(habit.max, value + habit.step))
 }
 disabled={value >= habit.max}
 >
 <Plus className="h-3.5 w-3.5" />
 </Button>
 </div>
 </div>

 {habit.timeField && value > 0 && (
 <div className="mt-3 flex items-center gap-3 border-t pt-3">
 <Label className="text-xs whitespace-nowrap" style={{ color: "var(--pulse-text-secondary)" }}>
 {habit.timeField.label}
 </Label>
 <Select
 value={timeValue || ""}
 onValueChange={(v) => onTimeChange?.(v || null)}
 >
 <SelectTrigger className="h-8 text-xs">
 <SelectValue placeholder="Select time" />
 </SelectTrigger>
 <SelectContent>
 {TIME_OPTIONS.map((t) => (
 <SelectItem key={t} value={t} className="text-xs">
 {formatTimeDisplay(t)}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 </CardContent>
 </Card>
 );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function CheckInPage() {
 const [date, setDate] = useState(() => new Date());
 const [formState, setFormState] = useState<Record<string, unknown>>({});
 const [saving, setSaving] = useState(false);
 const [saved, setSaved] = useState(false);
 const [loading, setLoading] = useState(true);

 const supabase = createClient();
 const dateStr = formatDate(date);

 const loadCheckIn = useCallback(async () => {
 setLoading(true);
 setSaved(false);

 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) {
 setLoading(false);
 return;
 }

 const { data: existing } = await supabase
 .from("check_ins")
 .select("*")
 .eq("user_id", user.id)
 .eq("date", dateStr)
 .single();

 const state: Record<string, unknown> = {};
 for (const habit of HABITS) {
 if (habit.type === "toggle") {
 state[habit.dbColumn] = existing?.[habit.dbColumn] ?? false;
 } else {
 state[habit.dbColumn] = existing?.[habit.dbColumn] ?? 0;
 if (habit.timeField) {
 state[habit.timeField.dbColumn] =
 existing?.[habit.timeField.dbColumn] ?? null;
 }
 }
 }
 setFormState(state);
 setLoading(false);
 }, [supabase, dateStr]);

 useEffect(() => {
 loadCheckIn();
 }, [loadCheckIn]);

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

 const updateField = (column: string, value: unknown) => {
 setFormState((prev) => ({ ...prev, [column]: value }));
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

 const { error } = await supabase.from("check_ins").upsert(
 { user_id: user.id, date: dateStr, ...formState },
 { onConflict: "user_id,date" }
 );

 if (error) {
 console.error("Failed to save check-in:", error);
 } else {
 setSaved(true);
 }
 setSaving(false);
 };

 const toggleHabits = HABITS.filter(
 (h) => h.type === "toggle"
 ) as (HabitConfig & { type: "toggle" })[];

 const quantityHabits = HABITS.filter(
 (h) => h.type === "quantity"
 ) as (HabitConfig & { type: "quantity" })[];

 return (
 <div className="flex flex-1 flex-col gap-6 p-4 pt-0 lg:p-6 lg:pt-0">
 {/* ── Header + date nav ──────────────────────────────────── */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-[30px] font-bold" style={{ color: "var(--pulse-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>Daily Check-in</h2>
 <p className="text-sm" style={{ color: "var(--pulse-text-secondary)" }}>
 Log habits, supplements, and notes
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
 <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--pulse-text-tertiary)] border-t-transparent" />
 </div>
 ) : (
 <div className="mx-auto w-full max-w-lg space-y-6 pb-20">
 {/* ── Toggle grid ──────────────────────────────────── */}
 <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardHeader className="pb-3">
 <CardTitle className="text-sm font-medium text-pulse-text-secondary">
 Activities
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-3 gap-3">
 {toggleHabits.map((habit) => (
 <ToggleCard
 key={habit.id}
 habit={habit}
 active={!!formState[habit.dbColumn]}
 onToggle={() =>
 updateField(habit.dbColumn, !formState[habit.dbColumn])
 }
 />
 ))}
 </div>
 </CardContent>
 </Card>

 {/* ── Quantity inputs ───────────────────────────────── */}
 <div className="space-y-3">
 <p className="text-sm font-medium text-pulse-text-secondary px-1">
 Intake
 </p>
 {quantityHabits.map((habit) => (
 <QuantityCard
 key={habit.id}
 habit={habit}
 value={(formState[habit.dbColumn] as number) ?? 0}
 timeValue={
 habit.timeField
 ? ((formState[habit.timeField.dbColumn] as string) ?? null)
 : null
 }
 onValueChange={(val) => updateField(habit.dbColumn, val)}
 onTimeChange={
 habit.timeField
 ? (val) => updateField(habit.timeField!.dbColumn, val)
 : undefined
 }
 />
 ))}
 </div>

 {/* ── Save button ──────────────────────────────────── */}
 <div className="fixed bottom-0 left-0 right-0 z-50 p-4 backdrop-blur-sm"
             style={{ background: "var(--pulse-glass-bg)", borderTop: "1px solid var(--pulse-border-subtle)" }}>
 <div className="mx-auto max-w-lg">
 <Button
 onClick={handleSave}
 disabled={saving}
 className={cn(
 "w-full transition-all",
 saved ? "bg-pulse-emerald hover:bg-pulse-emerald text-white" : ""
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
 Save Check-in
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
