import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizationUrl } from "@/lib/withings/client";

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

  const redirectUri = `${request.nextUrl.origin}/api/withings/callback`;

  const state = Buffer.from(
    JSON.stringify({ user_id: user.id })
  ).toString("base64url");

  const authUrl = getAuthorizationUrl(
    process.env.WITHINGS_CLIENT_ID!,
    redirectUri,
    state
  );

  return NextResponse.redirect(authUrl);
}
