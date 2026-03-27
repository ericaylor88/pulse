import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const railwayUrl = process.env.RAILWAY_URL;
  if (!railwayUrl) {
    return NextResponse.json(
      { error: "RAILWAY_URL not configured." },
      { status: 500 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieHeader = request.headers.get("cookie") ?? "";

  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieHeader.split(";").map((c) => {
          const [name, ...rest] = c.trim().split("=");
          return { name, value: rest.join("=") };
        });
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let preDays = 5;
  let baselineDays = 30;
  try {
    const body = await request.json();
    if (body.pre_illness_days) preDays = body.pre_illness_days;
    if (body.baseline_days) baselineDays = body.baseline_days;
  } catch {
    // defaults
  }

  try {
    const res = await fetch(`${railwayUrl}/illness-patterns/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        pre_illness_days: preDays,
        baseline_days: baselineDays,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[IllnessPatterns] Railway error:", res.status, errorText);
      return NextResponse.json(
        { error: `Illness pattern engine returned ${res.status}`, detail: errorText },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[IllnessPatterns] Failed to reach Railway:", err);
    return NextResponse.json(
      { error: "Failed to reach illness pattern engine." },
      { status: 502 }
    );
  }
}
