import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";

const SCOPES = [
  "offline",
  "read:recovery",
  "read:sleep",
  "read:workout",
  "read:cycles",
  "read:profile",
  "read:body_measurement",
].join(" ");

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/auth/login", request.nextUrl.origin)
    );
  }

  const redirectUri = `${request.nextUrl.origin}/api/whoop/callback`;

  const state = Buffer.from(
    JSON.stringify({ user_id: user.id })
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
  });

  return NextResponse.redirect(`${WHOOP_AUTH_URL}?${params.toString()}`);
}
