import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!serviceKey) return NextResponse.json({ error: "Service key not configured" }, { status: 500 });
  if (!anthropicKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });

  // Auth
  const cookieHeader = request.headers.get("cookie") ?? "";
  const authClient = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return cookieHeader.split(";").map((c) => { const [name, ...rest] = c.trim().split("="); return { name, value: rest.join("=") }; }); }, setAll() {} },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch 30 days of data
  const d30 = new Date(); d30.setDate(d30.getDate() - 30);
  const d7 = new Date(); d7.setDate(d7.getDate() - 7);
  const d30str = d30.toISOString().split("T")[0];
  const d7str = d7.toISOString().split("T")[0];

  const [metricsRes, checkInsRes, geneticsRes, correlationsRes, weatherRes] = await Promise.all([
    supabase.from("daily_metrics").select("date, recovery_score, hrv_rmssd, resting_hr, sleep_score, total_sleep_min, deep_sleep_min, rem_sleep_min, strain_score, spo2_pct, skin_temp_c, weight_kg, body_fat_pct, muscle_mass_kg, bp_systolic, bp_diastolic").eq("user_id", user.id).gte("date", d30str).order("date", { ascending: true }),
    supabase.from("check_ins").select("*").eq("user_id", user.id).gte("date", d7str).order("date", { ascending: true }),
    supabase.from("genetic_profile").select("gene, genotype, trait, interpretation").eq("user_id", user.id),
    supabase.from("correlations").select("variable_a, variable_b, r_value, p_value, confidence_tier").eq("user_id", user.id).in("confidence_tier", ["high", "medium"]).order("created_at", { ascending: false }).limit(15),
    supabase.from("weather_daily").select("date, temp_max_c, aqi_us, pm25, uv_index").eq("user_id", user.id).gte("date", d7str).order("date", { ascending: true }),
  ]);

  const metrics = metricsRes.data ?? [];
  const metrics7d = metrics.filter((m: any) => m.date >= d7str);
  const checkIns = checkInsRes.data ?? [];
  const genetics = geneticsRes.data ?? [];
  const correlations = correlationsRes.data ?? [];
  const weather = weatherRes.data ?? [];

  // Build the prompt
  const prompt = buildBriefPrompt(metrics, metrics7d, checkIns, genetics, correlations, weather);

  // Call Claude API
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: `You are a health data analyst for a personal health intelligence platform. You analyze wearable data, habits, body composition, genetics, and environmental data to produce weekly health briefs.

RULES:
- Never diagnose medical conditions. You provide observations and correlations only.
- Frame genetic context as "research suggests" — never deterministic.
- Use confidence tiers: High (>90d data, strong signal), Medium (60-90d), Low (<60d or weak).
- Be specific with numbers and dates.
- Keep the brief concise — 3-5 key observations, each 1-2 sentences.
- End with 1-2 actionable suggestions.
- Tone: clinical but warm, like a knowledgeable friend who also happens to be a data scientist.`,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Weekly Brief] Claude API error:", err);
      return NextResponse.json({ error: "Claude API error" }, { status: 500 });
    }

    const data = await response.json();
    const briefText = data.content?.[0]?.text ?? "Unable to generate brief.";

    // Store as a recommendation
    await supabase.from("recommendations").insert({
      user_id: user.id,
      title: "Weekly Health Brief",
      body: briefText,
      confidence_tier: "medium",
      source_type: "ai_brief",
      source_variables: ["weekly_brief"],
      category: "weekly_brief",
      is_dismissed: false,
      is_acted_on: false,
      generated_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, brief: briefText });
  } catch (err) {
    console.error("[Weekly Brief] Error:", err);
    return NextResponse.json({ error: "Failed to generate brief" }, { status: 500 });
  }
}

function buildBriefPrompt(
  metrics30d: any[],
  metrics7d: any[],
  checkIns: any[],
  genetics: any[],
  correlations: any[],
  weather: any[]
): string {
  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x !== null);
    return v.length === 0 ? "N/A" : (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1);
  };

  let prompt = `Generate a weekly health brief based on this data.\n\n`;

  // 7-day summary
  prompt += `## 7-Day Summary (last 7 days)\n`;
  prompt += `Recovery: avg ${avg(metrics7d.map((m: any) => m.recovery_score))}%\n`;
  prompt += `HRV: avg ${avg(metrics7d.map((m: any) => m.hrv_rmssd))} ms\n`;
  prompt += `Resting HR: avg ${avg(metrics7d.map((m: any) => m.resting_hr))} bpm\n`;
  prompt += `Sleep: avg ${avg(metrics7d.map((m: any) => m.total_sleep_min ? m.total_sleep_min / 60 : null))} hrs\n`;
  prompt += `Deep Sleep: avg ${avg(metrics7d.map((m: any) => m.deep_sleep_min))} min\n`;
  prompt += `Strain: avg ${avg(metrics7d.map((m: any) => m.strain_score))}\n\n`;

  // 30-day comparison
  prompt += `## 30-Day Baseline\n`;
  prompt += `Recovery: avg ${avg(metrics30d.map((m: any) => m.recovery_score))}%\n`;
  prompt += `HRV: avg ${avg(metrics30d.map((m: any) => m.hrv_rmssd))} ms\n`;
  prompt += `Resting HR: avg ${avg(metrics30d.map((m: any) => m.resting_hr))} bpm\n`;
  prompt += `Sleep: avg ${avg(metrics30d.map((m: any) => m.total_sleep_min ? m.total_sleep_min / 60 : null))} hrs\n\n`;

  // Body comp
  const latestWeight = metrics7d.filter((m: any) => m.weight_kg).pop();
  if (latestWeight) {
    prompt += `## Body Composition (latest)\n`;
    prompt += `Weight: ${latestWeight.weight_kg} kg\n`;
    if (latestWeight.body_fat_pct) prompt += `Body Fat: ${latestWeight.body_fat_pct}%\n`;
    if (latestWeight.muscle_mass_kg) prompt += `Muscle Mass: ${latestWeight.muscle_mass_kg} kg\n`;
    prompt += `\n`;
  }

  // BP
  const latestBP = metrics7d.filter((m: any) => m.bp_systolic).pop();
  if (latestBP) {
    prompt += `## Blood Pressure (latest)\n${latestBP.bp_systolic}/${latestBP.bp_diastolic} mmHg\n\n`;
  }

  // Check-ins
  if (checkIns.length > 0) {
    prompt += `## Habits This Week\n`;
    const coffeeAvg = avg(checkIns.map((c: any) => c.coffee_cups));
    const alcoholDays = checkIns.filter((c: any) => (c.alcohol_drinks ?? 0) > 0).length;
    const foamDays = checkIns.filter((c: any) => c.foam_rolling).length;
    prompt += `Coffee: avg ${coffeeAvg} cups/day\n`;
    prompt += `Alcohol: ${alcoholDays} days with drinks\n`;
    prompt += `Foam rolling: ${foamDays}/${checkIns.length} days\n\n`;
  }

  // Genetics
  if (genetics.length > 0) {
    prompt += `## Genetic Profile\n`;
    for (const g of genetics) {
      prompt += `${g.gene} (${g.genotype}): ${g.interpretation}\n`;
    }
    prompt += `\n`;
  }

  // Correlations
  if (correlations.length > 0) {
    prompt += `## Known Correlations (from correlation engine)\n`;
    for (const c of correlations) {
      prompt += `${c.variable_a} → ${c.variable_b}: r=${c.r_value.toFixed(3)} (${c.confidence_tier})\n`;
    }
    prompt += `\n`;
  }

  // Weather
  if (weather.length > 0) {
    const avgAqi = avg(weather.map((w: any) => w.aqi_us));
    const avgPm = avg(weather.map((w: any) => w.pm25));
    prompt += `## Environmental (Los Angeles)\nAvg AQI: ${avgAqi}, Avg PM2.5: ${avgPm}\n\n`;
  }

  prompt += `Based on all of the above, write a concise weekly health brief with 3-5 key observations and 1-2 actionable suggestions. Reference specific numbers. Factor in the genetic profile when relevant.`;

  return prompt;
}
