import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { exchangeCodeForTokens } from "@/lib/withings/client";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const settingsUrl = new URL("/dashboard/settings", request.nextUrl.origin);

  if (error) {
    console.error(`[Withings Callback] OAuth error: ${error}`);
    settingsUrl.searchParams.set("withings", "error");
    settingsUrl.searchParams.set("message", error);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("withings", "error");
    settingsUrl.searchParams.set("message", "missing_params");
    return NextResponse.redirect(settingsUrl);
  }

  let userId: string;
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8")
    );
    userId = decoded.user_id;
  } catch {
    settingsUrl.searchParams.set("withings", "error");
    settingsUrl.searchParams.set("message", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/withings/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("devices")
      .upsert(
        {
          user_id: userId,
          provider: "withings",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          withings_user_id: tokens.userid,
          is_active: true,
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      console.error(`[Withings Callback] Device upsert error:`, upsertError);
      settingsUrl.searchParams.set("withings", "error");
      settingsUrl.searchParams.set("message", "db_error");
      return NextResponse.redirect(settingsUrl);
    }

    console.log(`[Withings Callback] Device connected for user ${userId}`);

    // Trigger initial 90-day backfill in background
    const syncUrl = new URL("/api/withings/sync", request.nextUrl.origin);
    fetch(syncUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ user_id: userId }),
    }).catch((e) => {
      console.error(`[Withings Callback] Background sync trigger failed:`, e);
    });

    settingsUrl.searchParams.set("withings", "connected");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error(`[Withings Callback] Token exchange failed:`, err);
    settingsUrl.searchParams.set("withings", "error");
    settingsUrl.searchParams.set(
      "message",
      err instanceof Error ? err.message : "token_exchange_failed"
    );
    return NextResponse.redirect(settingsUrl);
  }
}
