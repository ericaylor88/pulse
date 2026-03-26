import { NextRequest, NextResponse } from "next/server";
import { syncWeather } from "@/lib/weather/sync";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncWeather();
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      weather: {
        ok: result.errors.length === 0,
        ...result,
      },
    });
  } catch (err) {
    console.error("[Weather Cron] Error:", err);
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        weather: {
          ok: false,
          error: err instanceof Error ? err.message : "Weather sync failed",
        },
      },
      { status: 500 }
    );
  }
}
