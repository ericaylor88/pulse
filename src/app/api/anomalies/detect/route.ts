import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const railwayUrl = process.env.RAILWAY_URL;
  if (!railwayUrl) {
    return NextResponse.json(
      { error: "RAILWAY_URL not configured. Deploy FastAPI service to Railway first." },
      { status: 500 }
    );
  }

  // Authenticate user via Supabase cookies
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

  // Parse optional overrides
  let lookbackDays = 90;
  let contamination = 0.05;
  try {
    const body = await request.json();
    if (body.lookback_days) lookbackDays = body.lookback_days;
    if (body.contamination) contamination = body.contamination;
  } catch {
    // No body or invalid JSON — use defaults
  }

  // Call Railway FastAPI service
  try {
    const res = await fetch(`${railwayUrl}/anomalies/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        lookback_days: lookbackDays,
        contamination,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[Anomalies] Railway error:", res.status, errorText);
      return NextResponse.json(
        { error: `Anomaly engine returned ${res.status}`, detail: errorText },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[Anomalies] Failed to reach Railway:", err);
    return NextResponse.json(
      { error: "Failed to reach anomaly detection engine. Is Railway service running?" },
      { status: 502 }
    );
  }
}
