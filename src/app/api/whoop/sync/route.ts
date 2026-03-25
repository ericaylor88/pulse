import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserWhoopDevice } from "@/lib/whoop/client";
import { syncWhoopDevice, syncAllWhoopDevices } from "@/lib/whoop/sync";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isServiceCall =
    authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

  let body: { user_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body OK
  }

  if (!isServiceCall) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    body.user_id = user.id;
  }

  try {
    if (body.user_id) {
      const device = await getUserWhoopDevice(body.user_id);
      if (!device) {
        return NextResponse.json(
          { error: "No active WHOOP device found" },
          { status: 404 }
        );
      }
      const result = await syncWhoopDevice(device);
      return NextResponse.json({ ok: result.errors.length === 0, ...result });
    } else {
      if (!isServiceCall) {
        return NextResponse.json(
          { error: "Only service calls can sync all devices" },
          { status: 403 }
        );
      }
      const results = await syncAllWhoopDevices();
      return NextResponse.json({
        ok: results.every((r) => r.errors.length === 0),
        devices_synced: results.length,
        results,
      });
    }
  } catch (err) {
    console.error("[WHOOP Sync API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
