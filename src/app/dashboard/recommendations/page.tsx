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
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
 Lightbulb,
 Check,
 X,
 Brain,
 Dna,
 BarChart3,
 AlertTriangle,
 Clock,
 Sparkles,
 RefreshCw,
} from "lucide-react";

// ─── Types (matching actual Supabase schema) ─────────────────────────────

interface Recommendation {
 id: string;
 title: string;
 body: string;
 confidence_tier: string;
 source_type: string | null;
 source_variables: string[] | null;
 category: string;
 is_dismissed: boolean;
 is_acted_on: boolean;
 created_at: string;
 generated_at: string;
}

// ─── Config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
 high: { color: "text-pulse-emerald", bg: " ", label: "High Confidence", icon: "✦" },
 medium: { color: "text-pulse-amber", bg: " ", label: "Medium", icon: "◆" },
 low: { color: "text-pulse-text-secondary", bg: "border-[var(--pulse-border-default)] ", label: "Low", icon: "○" },
};

const SOURCE_CONFIG: Record<string, { icon: typeof Brain; label: string }> = {
 correlation: { icon: BarChart3, label: "Correlation" },
 rule: { icon: AlertTriangle, label: "Rule-based" },
 genetic: { icon: Dna, label: "Genetic context" },
 ai_brief: { icon: Brain, label: "AI Brief" },
 anomaly: { icon: AlertTriangle, label: "Anomaly" },
};

// ─── Recommendation Card ─────────────────────────────────────────────────

function RecommendationCard({
 rec,
 onDismiss,
 onActedOn,
}: {
 rec: Recommendation;
 onDismiss: (id: string) => void;
 onActedOn: (id: string) => void;
}) {
 const tier = TIER_CONFIG[rec.confidence_tier] ?? TIER_CONFIG.low;
 const source = SOURCE_CONFIG[rec.source_type ?? "rule"] ?? SOURCE_CONFIG.rule;
 const SourceIcon = source.icon;

 const age = Math.floor(
 (Date.now() - new Date(rec.created_at).getTime()) / (1000 * 60 * 60 * 24)
 );
 const ageLabel = age === 0 ? "Today" : age === 1 ? "Yesterday" : `${age}d ago`;

 return (
 <Card className={cn("border transition-all", tier.bg, rec.is_dismissed && "opacity-50")}>
 <CardContent className="p-4 space-y-3">
 <div className="flex items-start gap-3">
 <span className={cn("text-lg mt-0.5", tier.color)}>{tier.icon}</span>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium mb-1">{rec.title}</p>
 <p className="text-sm leading-relaxed" style={{ color: "var(--pulse-text-secondary)" }}>{rec.body}</p>
 </div>
 </div>

 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 flex-wrap">
 <Badge variant="outline" className={cn("text-[10px]", tier.color)}>
 {tier.label}
 </Badge>
 <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
 <SourceIcon className="h-2.5 w-2.5" />
 {source.label}
 </Badge>
 <span className="text-[10px] flex items-center gap-0.5" style={{ color: "var(--pulse-text-tertiary)" }}>
 <Clock className="h-2.5 w-2.5" />
 {ageLabel}
 </span>
 </div>

 {!rec.is_dismissed && (
 <div className="flex items-center gap-1 shrink-0">
 <Button
 variant="ghost"
 size="sm"
 className="h-7 px-2 text-xs text-pulse-emerald hover:text-pulse-emerald"
 onClick={() => onActedOn(rec.id)}
 >
 {rec.is_acted_on ? (
 <Check className="h-3.5 w-3.5" />
 ) : (
 "Noted"
 )}
 </Button>
 <Button
 variant="ghost"
 size="sm"
 className="h-7 px-2 text-xs hover:text-pulse-coral" style={{ color: "var(--pulse-text-secondary)" }}
 onClick={() => onDismiss(rec.id)}
 >
 <X className="h-3.5 w-3.5" />
 </Button>
 </div>
 )}
 </div>

 {rec.source_variables && rec.source_variables.length > 0 && (
 <div className="flex flex-wrap gap-1">
 {rec.source_variables.map((v) => (
 <span
 key={v}
 className="rounded-full px-2 py-0.5 text-[10px]" style={{ color: "var(--pulse-text-tertiary)", background: "var(--pulse-bg-surface-raised)" }}
 >
 {v.replace(/_/g, " ")}
 </span>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function RecommendationsPage() {
 const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
 const [loading, setLoading] = useState(true);
 const [showDismissed, setShowDismissed] = useState(false);
 const [generating, setGenerating] = useState(false);

 const supabase = createClient();

 const loadRecommendations = useCallback(async () => {
 setLoading(true);
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) { setLoading(false); return; }

 const { data } = await supabase
 .from("recommendations")
 .select("*")
 .eq("user_id", user.id)
 .order("created_at", { ascending: false });

 if (data) setRecommendations(data as Recommendation[]);
 setLoading(false);
 }, [supabase]);

 useEffect(() => { loadRecommendations(); }, [loadRecommendations]);

 const handleDismiss = async (id: string) => {
 await supabase.from("recommendations").update({ is_dismissed: true }).eq("id", id);
 setRecommendations((prev) =>
 prev.map((r) => (r.id === id ? { ...r, is_dismissed: true } : r))
 );
 };

 const handleActedOn = async (id: string) => {
 await supabase.from("recommendations").update({ is_acted_on: true }).eq("id", id);
 setRecommendations((prev) =>
 prev.map((r) => (r.id === id ? { ...r, is_acted_on: true } : r))
 );
 };

 const handleGenerateAlerts = async () => {
 setGenerating(true);
 try {
 const res = await fetch("/api/insights/generate-alerts", { method: "POST" });
 const json = await res.json();
 console.log("[Alerts]", json);
 if (res.ok) await loadRecommendations();
 } catch (err) {
 console.error("Failed to generate alerts:", err);
 }
 setGenerating(false);
 };

 const active = recommendations.filter((r) => !r.is_dismissed);
 const dismissed = recommendations.filter((r) => r.is_dismissed);

 return (
 <div className="flex flex-1 flex-col gap-6 p-4 pt-0 pb-8 lg:p-6 lg:pt-0">
 <motion.div
       initial={{ opacity: 0, y: 8 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.2 }}
       className="flex items-center justify-between">
 <div>
 <h2 className="text-[30px] font-bold" style={{ color: "var(--pulse-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>Recommendations</h2>
 <p className="text-sm" style={{ color: "var(--pulse-text-secondary)" }}>
 AI-generated insights with confidence tiers
 </p>
 </div>
 <Button
 onClick={handleGenerateAlerts}
 disabled={generating}
 size="sm"
 variant="outline"
 >
 {generating ? (
 <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
 ) : (
 <Sparkles className="mr-1 h-4 w-4" />
 )}
 Generate
 </Button>
 </motion.div>

 {loading ? (
 <div className="flex flex-1 items-center justify-center">
 <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: "var(--pulse-text-tertiary)", borderTopColor: "transparent" }} />
 </div>
 ) : active.length === 0 && dismissed.length === 0 ? (
 <Card style={{ background: "var(--pulse-bg-surface)", borderColor: "var(--pulse-border-subtle)" }}>
 <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
 <Lightbulb className="h-12 w-12 text-pulse-text-secondary/30" />
 <div>
 <p className="text-sm font-medium">No recommendations yet</p>
 <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--pulse-text-secondary)" }}>
 Recommendations are generated from correlation analysis, rule-based
 alerts using your genetic profile, and weekly AI health briefs.
 Click Generate to run the rule-based engine now.
 </p>
 </div>
 <Button onClick={handleGenerateAlerts} disabled={generating} size="sm">
 {generating ? (
 <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
 ) : (
 <Sparkles className="mr-1 h-4 w-4" />
 )}
 Generate Alerts
 </Button>
 </CardContent>
 </Card>
 ) : (
 <>
 {active.length > 0 && (
 <div className="space-y-2">
 {active.map((rec) => (
 <RecommendationCard
 key={rec.id}
 rec={rec}
 onDismiss={handleDismiss}
 onActedOn={handleActedOn}
 />
 ))}
 </div>
 )}

 {dismissed.length > 0 && (
 <div className="space-y-2">
 <button
 onClick={() => setShowDismissed(!showDismissed)}
 className="text-xs hover:text-pulse-text-primary transition-colors" style={{ color: "var(--pulse-text-secondary)" }}
 >
 {showDismissed ? "Hide" : "Show"} {dismissed.length} dismissed
 </button>
 {showDismissed &&
 dismissed.map((rec) => (
 <RecommendationCard
 key={rec.id}
 rec={rec}
 onDismiss={handleDismiss}
 onActedOn={handleActedOn}
 />
 ))}
 </div>
 )}
 </>
 )}
 </div>
 );
}
