import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const maxDuration = 30;

interface DailyMetric { date: string; recovery_score: number | null; hrv_rmssd: number | null; resting_hr: number | null; sleep_score: number | null; total_sleep_min: number | null; deep_sleep_min: number | null; strain_score: number | null; spo2_pct: number | null; skin_temp_c: number | null; bp_systolic: number | null; bp_diastolic: number | null; [key: string]: unknown; }
interface CheckIn { date: string; coffee_cups: number | null; coffee_last_time: string | null; alcohol_drinks: number | null; foam_rolling: boolean; compression: boolean; tea_before_bed: boolean; video_games: boolean; }
interface GeneticSNP { rsid: string; gene: string; genotype: string; trait: string; interpretation: string; }
interface RuleContext { metrics7d: DailyMetric[]; metrics30d: DailyMetric[]; checkIns7d: CheckIn[]; genetics: GeneticSNP[]; }
interface RuleResult { text: string; confidence_tier: "high" | "medium" | "low"; source_type: "rule" | "genetic"; source_variables: string[]; }
interface Rule { id: string; evaluate: (ctx: RuleContext) => RuleResult | null; }

function avg(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  return v.length === 0 ? null : v.reduce((a, b) => a + b, 0) / v.length;
}

function geno(genetics: GeneticSNP[], rsid: string): string | null {
  return genetics.find((g) => g.rsid === rsid)?.genotype ?? null;
}

const RULES: Rule[] = [
  {
    id: "caffeine_cutoff",
    evaluate: (ctx) => {
      const cyp1a2 = geno(ctx.genetics, "rs762551");
      if (!cyp1a2) return null;
      const isSlow = cyp1a2 === "AC" || cyp1a2 === "CC";
      const coffeeDays = ctx.checkIns7d.filter((c) => (c.coffee_cups ?? 0) > 0);
      if (coffeeDays.length < 3) return null;
      const cutoffHour = isSlow ? 12 : 14;
      const lateDays = coffeeDays.filter((c) => {
        if (!c.coffee_last_time) return false;
        return parseInt(c.coffee_last_time.split(":")[0]) >= cutoffHour;
      });
      if (lateDays.length === 0) return null;
      const cutoffLabel = isSlow ? "noon" : "2 PM";
      const type = isSlow ? "slow" : "fast";
      return { text: `Based on your CYP1A2 genotype (${cyp1a2}), you're a ${type} caffeine metabolizer. Research suggests a cutoff of ${cutoffLabel} for optimal sleep. You've had late coffee on ${lateDays.length} of the last 7 days.`, confidence_tier: "medium", source_type: "genetic", source_variables: ["coffee_cups", "coffee_last_time", "CYP1A2"] };
    },
  },
  {
    id: "mthfr_methylation",
    evaluate: (ctx) => {
      const m = geno(ctx.genetics, "rs1801133");
      if (!m || m === "CC") return null;
      const variant = m === "TT" ? "homozygous (TT)" : "heterozygous (CT)";
      const reduction = m === "TT" ? "~70%" : "~30%";
      return { text: `Your MTHFR genotype is ${variant}, which research suggests reduces methylation efficiency by ${reduction}. Consider methylfolate (L-5-MTHF) instead of folic acid, and monitor homocysteine levels in your blood panels.`, confidence_tier: "medium", source_type: "genetic", source_variables: ["MTHFR"] };
    },
  },
  {
    id: "vdr_vitamin_d",
    evaluate: (ctx) => {
      const v = geno(ctx.genetics, "rs1544410");
      if (!v || v === "CC") return null;
      return { text: `Your VDR genotype (${v}) suggests reduced vitamin D receptor efficiency. Research indicates you may need higher vitamin D supplementation (4,000-5,000 IU/day) to maintain optimal levels. Track via blood panels — aim for 50-80 ng/mL.`, confidence_tier: "medium", source_type: "genetic", source_variables: ["VDR"] };
    },
  },
  {
    id: "comt_recovery",
    evaluate: (ctx) => {
      const c = geno(ctx.genetics, "rs4680");
      if (!c || c !== "AA") return null;
      return { text: `Your COMT genotype (Met/Met) means slower dopamine clearance — you may be more stress-sensitive but also more focused. Research suggests magnesium and L-theanine can help manage stress. Prioritize recovery on high-strain days.`, confidence_tier: "low", source_type: "genetic", source_variables: ["COMT", "strain_score"] };
    },
  },
  {
    id: "hrv_declining",
    evaluate: (ctx) => {
      const hrv7 = ctx.metrics7d.map((m) => m.hrv_rmssd).filter((v): v is number => v !== null);
      if (hrv7.length < 5) return null;
      const a30 = avg(ctx.metrics30d.map((m) => m.hrv_rmssd));
      const a7 = avg(hrv7);
      if (a30 === null || a7 === null) return null;
      const drop = ((a30 - a7) / a30) * 100;
      if (drop < 10) return null;
      return { text: `Your 7-day HRV average (${a7.toFixed(0)} ms) is ${drop.toFixed(0)}% below your 30-day baseline (${a30.toFixed(0)} ms). This may indicate accumulated stress or incomplete recovery. Consider reducing training load and prioritizing sleep.`, confidence_tier: drop >= 20 ? "high" : "medium", source_type: "rule", source_variables: ["hrv_rmssd"] };
    },
  },
  {
    id: "rhr_elevated",
    evaluate: (ctx) => {
      const rhr7 = ctx.metrics7d.map((m) => m.resting_hr).filter((v): v is number => v !== null);
      if (rhr7.length < 5) return null;
      const a30 = avg(ctx.metrics30d.map((m) => m.resting_hr));
      const a7 = avg(rhr7);
      if (a30 === null || a7 === null) return null;
      const inc = a7 - a30;
      if (inc < 3) return null;
      return { text: `Your resting heart rate has been elevated by ${inc.toFixed(1)} bpm over the last 7 days (${a7.toFixed(0)} vs ${a30.toFixed(0)} baseline). Elevated RHR can indicate stress, illness onset, or overtraining.`, confidence_tier: inc >= 5 ? "high" : "medium", source_type: "rule", source_variables: ["resting_hr"] };
    },
  },
  {
    id: "sleep_debt",
    evaluate: (ctx) => {
      const mins = ctx.metrics7d.map((m) => m.total_sleep_min).filter((v): v is number => v !== null);
      if (mins.length < 5) return null;
      const a = avg(mins);
      if (a === null) return null;
      const hrs = a / 60;
      if (hrs >= 7) return null;
      const deficit = (7 - hrs) * 7;
      return { text: `You're averaging ${hrs.toFixed(1)} hours of sleep — ${deficit.toFixed(1)} hours of sleep debt per week. Recovery scores are strongly correlated with total sleep. Aim for 7-8 hours consistently.`, confidence_tier: hrs < 6 ? "high" : "medium", source_type: "rule", source_variables: ["total_sleep_min", "recovery_score"] };
    },
  },
  {
    id: "bp_elevated",
    evaluate: (ctx) => {
      const sys = ctx.metrics7d.map((m) => m.bp_systolic).filter((v): v is number => v !== null);
      if (sys.length < 3) return null;
      const a = avg(sys);
      if (a === null || a < 130) return null;
      return { text: `Your average systolic blood pressure this week is ${a.toFixed(0)} mmHg, which is in the elevated range. Consider monitoring more frequently and discussing with your healthcare provider.`, confidence_tier: a >= 140 ? "high" : "medium", source_type: "rule", source_variables: ["bp_systolic", "bp_diastolic"] };
    },
  },
  {
    id: "recovery_low",
    evaluate: (ctx) => {
      const recs = ctx.metrics7d.map((m) => m.recovery_score).filter((v): v is number => v !== null);
      if (recs.length < 5) return null;
      const lowDays = recs.filter((r) => r < 33).length;
      if (lowDays < 3) return null;
      return { text: `You've had ${lowDays} red recovery days in the last week. Consider prioritizing rest, reducing training intensity, and checking for illness symptoms.`, confidence_tier: lowDays >= 5 ? "high" : "medium", source_type: "rule", source_variables: ["recovery_score"] };
    },
  },
];

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: "Service key not configured" }, { status: 500 });

  const supabase = createClient(supabaseUrl, serviceKey);
  const cookieHeader = request.headers.get("cookie") ?? "";
  const authClient = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return cookieHeader.split(";").map((c) => { const [name, ...rest] = c.trim().split("="); return { name, value: rest.join("=") }; }); }, setAll() {} },
  });

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const d30 = new Date(); d30.setDate(d30.getDate() - 30);
  const d7 = new Date(); d7.setDate(d7.getDate() - 7);

  const [metricsRes, checkInsRes, geneticsRes] = await Promise.all([
    supabase.from("daily_metrics").select("*").eq("user_id", user.id).gte("date", d30.toISOString().split("T")[0]).order("date", { ascending: true }),
    supabase.from("check_ins").select("*").eq("user_id", user.id).gte("date", d7.toISOString().split("T")[0]).order("date", { ascending: true }),
    supabase.from("genetic_profile").select("*").eq("user_id", user.id),
  ]);

  const metrics30d = (metricsRes.data ?? []) as DailyMetric[];
  const d7str = d7.toISOString().split("T")[0];
  const ctx: RuleContext = {
    metrics7d: metrics30d.filter((m) => m.date >= d7str),
    metrics30d,
    checkIns7d: (checkInsRes.data ?? []) as CheckIn[],
    genetics: (geneticsRes.data ?? []) as GeneticSNP[],
  };

  const results: RuleResult[] = [];
  for (const rule of RULES) {
    try { const r = rule.evaluate(ctx); if (r) results.push(r); } catch (e) { console.error(`[Alerts] ${rule.id}:`, e); }
  }

  const today = new Date().toISOString().split("T")[0];
  let inserted = 0;
  for (const r of results) {
    const { data: existing } = await supabase.from("recommendations").select("id").eq("user_id", user.id).gte("created_at", today + "T00:00:00").ilike("text", r.text.substring(0, 50) + "%").limit(1);
    if (existing && existing.length > 0) continue;
    await supabase.from("recommendations").insert({ user_id: user.id, text: r.text, confidence_tier: r.confidence_tier, source_type: r.source_type, source_variables: r.source_variables, dismissed: false, acted_on: false });
    inserted++;
  }

  return NextResponse.json({ ok: true, rules_evaluated: RULES.length, alerts_generated: results.length, alerts_inserted: inserted });
}
