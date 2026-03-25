import { NextRequest, NextResponse } from "next/server";
import { syncAllWhoopDevices } from "@/lib/whoop/sync";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await syncAllWhoopDevices();
    return NextResponse.json({
      ok: results.every((r) => r.errors.length === 0),
      devices_synced: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Cron Sync] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron sync failed" },
      { status: 500 }
    );
  }
}
