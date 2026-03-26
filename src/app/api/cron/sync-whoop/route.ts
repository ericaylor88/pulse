import { NextRequest, NextResponse } from "next/server";
import { syncAllWhoopDevices } from "@/lib/whoop/sync";
import { syncAllWithingsDevices } from "@/lib/withings/sync";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // Sync WHOOP
  try {
    const whoopResults = await syncAllWhoopDevices();
    results.whoop = {
      ok: whoopResults.every((r) => r.errors.length === 0),
      devices_synced: whoopResults.length,
      results: whoopResults,
    };
  } catch (err) {
    console.error("[Cron Sync] WHOOP error:", err);
    results.whoop = {
      ok: false,
      error: err instanceof Error ? err.message : "WHOOP sync failed",
    };
  }

  // Sync Withings
  try {
    const withingsResults = await syncAllWithingsDevices();
    results.withings = {
      ok: withingsResults.every((r) => r.errors.length === 0),
      devices_synced: withingsResults.length,
      results: withingsResults,
    };
  } catch (err) {
    console.error("[Cron Sync] Withings error:", err);
    results.withings = {
      ok: false,
      error: err instanceof Error ? err.message : "Withings sync failed",
    };
  }

  console.log("[Cron Sync] Complete:", JSON.stringify(results));

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results,
  });
}
