/**
 * Withings API Client
 *
 * Handles authenticated requests to the Withings Public Health Data API.
 * Automatically refreshes expired access tokens using the stored refresh token.
 * Withings rotates refresh tokens on every use — the new one must be saved.
 *
 * Key differences from WHOOP:
 * - All token operations require HMAC SHA-256 signed nonces
 * - Measurement values are encoded as: actual = value × 10^unit
 * - Access tokens expire after 3 hours (vs 1 hour for WHOOP)
 * - Uses form-encoded POST bodies, not JSON
 */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const WITHINGS_API = "https://wbsapi.withings.net";
const WITHINGS_AUTH_URL =
  "https://account.withings.com/oauth2_user/authorize2";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WithingsTokens {
  userid: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

interface WithingsDevice {
  id: number;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
}

interface MeasureGroup {
  grpid: number;
  attrib: number;
  date: number;
  created: number;
  modified: number;
  category: number;
  deviceid: string;
  measures: Array<{
    value: number;
    type: number;
    unit: number;
    algo: number;
    fm: number;
  }>;
}

/**
 * Withings measurement type IDs → daily_metrics column names.
 *
 * Body Comp (Withings Body Comp scale):
 *   1=weight, 6=fat%, 8=fat mass, 76=muscle mass, 88=bone mass, 170=visceral fat
 *
 * Blood Pressure (Withings BPM Connect):
 *   9=diastolic, 10=systolic, 11=heart rate (pulse during BP reading)
 */
export const MEASURE_TYPE_MAP: Record<number, string> = {
  1: "weight_kg",
  6: "body_fat_pct",
  8: "fat_mass_kg",
  76: "muscle_mass_kg",
  88: "bone_mass_kg",
  170: "visceral_fat_index",
  9: "bp_diastolic",
  10: "bp_systolic",
  11: "resting_hr_bpm",
};

const MEASURE_TYPES = Object.keys(MEASURE_TYPE_MAP).join(",");

// ─── HMAC Signature ─────────────────────────────────────────────────────────

/**
 * Generate HMAC SHA-256 signature for Withings API requests.
 * Only signs: action, client_id, and either timestamp (for nonce) or nonce (for API calls).
 * Values are sorted by key name alphabetically, then joined with commas.
 */
function sign(
  params: Record<string, string>,
  clientSecret: string
): string {
  const signableKeys = ["action", "client_id", "nonce", "timestamp"];
  const filtered: Record<string, string> = {};

  for (const key of signableKeys) {
    if (params[key]) {
      filtered[key] = params[key];
    }
  }

  const sorted = Object.keys(filtered)
    .sort()
    .map((k) => filtered[k])
    .join(",");

  return crypto
    .createHmac("sha256", clientSecret)
    .update(sorted)
    .digest("hex");
}

/**
 * Get a fresh nonce from Withings (required before every signed request).
 * Nonces are single-use — each API call needs a fresh one.
 */
async function getNonce(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const params: Record<string, string> = {
    action: "getnonce",
    client_id: clientId,
    timestamp,
  };
  params.signature = sign(params, clientSecret);

  const res = await fetch(`${WITHINGS_API}/v2/signature`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

  const data = await res.json();
  if (data.status !== 0) {
    throw new Error(
      `Withings getnonce failed: status=${data.status} error=${data.error}`
    );
  }

  return data.body.nonce;
}

// ─── OAuth ──────────────────────────────────────────────────────────────────

/**
 * Build the Withings authorization URL for the OAuth redirect.
 */
export function getAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "user.info,user.metrics,user.activity",
    redirect_uri: redirectUri,
    state,
  });
  return `${WITHINGS_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Must be called within 30 seconds of receiving the code.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<WithingsTokens> {
  const clientId = process.env.WITHINGS_CLIENT_ID!;
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET!;
  const nonce = await getNonce(clientId, clientSecret);

  const params: Record<string, string> = {
    action: "requesttoken",
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    nonce,
  };
  params.signature = sign(params, clientSecret);

  const res = await fetch(`${WITHINGS_API}/v2/oauth2`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

  const data = await res.json();
  if (data.status !== 0) {
    throw new Error(
      `Withings token exchange failed: status=${data.status} error=${data.error}`
    );
  }

  return {
    userid: data.body.userid,
    access_token: data.body.access_token,
    refresh_token: data.body.refresh_token,
    expires_in: data.body.expires_in,
    scope: data.body.scope,
  };
}

// ─── Token Management ───────────────────────────────────────────────────────

async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.WITHINGS_CLIENT_ID!;
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET!;
  const nonce = await getNonce(clientId, clientSecret);

  const params: Record<string, string> = {
    action: "requesttoken",
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    nonce,
  };
  params.signature = sign(params, clientSecret);

  const res = await fetch(`${WITHINGS_API}/v2/oauth2`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

  const data = await res.json();
  if (data.status !== 0) {
    throw new Error(
      `Withings token refresh failed: status=${data.status} error=${data.error}`
    );
  }

  return {
    access_token: data.body.access_token,
    refresh_token: data.body.refresh_token,
    expires_in: data.body.expires_in,
  };
}

/**
 * Get a valid access token, refreshing if expired.
 * Mirrors getValidAccessToken from WHOOP client.
 */
export async function getValidAccessToken(
  device: WithingsDevice
): Promise<string> {
  const expiresAt = device.token_expires_at
    ? new Date(device.token_expires_at)
    : new Date(0);

  // Refresh if within 5 minutes of expiry
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    console.log(`[Withings] Refreshing token for user ${device.user_id}`);

    const tokens = await refreshAccessToken(device.refresh_token);
    const newExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    // MUST save the new refresh_token — Withings rotates on every refresh
    const { error } = await supabaseAdmin
      .from("devices")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: newExpiresAt,
      })
      .eq("id", device.id);

    if (error) {
      throw new Error(`Failed to save refreshed tokens: ${error.message}`);
    }

    return tokens.access_token;
  }

  return device.access_token;
}

// ─── Data Fetching ──────────────────────────────────────────────────────────

/**
 * Decode a Withings measure value.
 * Withings encodes: actual_value = value × 10^unit
 * e.g., weight 75.23 kg → { value: 7523, unit: -2 }
 */
function decodeMeasure(value: number, unit: number): number {
  return value * Math.pow(10, unit);
}

/**
 * Fetch body measurements from Withings for a date range.
 * Returns measures grouped by calendar date with decoded values.
 */
export async function fetchMeasures(
  accessToken: string,
  startDate: string, // ISO timestamp
  endDate: string
): Promise<
  Record<string, Record<string, number>> // date → { field: value }
> {
  const params = new URLSearchParams({
    action: "getmeas",
    meastypes: MEASURE_TYPES,
    category: "1", // real measures only
    startdate: Math.floor(new Date(startDate).getTime() / 1000).toString(),
    enddate: Math.floor(new Date(endDate).getTime() / 1000).toString(),
  });

  const res = await fetch(`${WITHINGS_API}/measure`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = await res.json();
  if (data.status !== 0) {
    throw new Error(
      `Withings getmeas failed: status=${data.status} error=${data.error}`
    );
  }

  const byDate: Record<string, Record<string, number>> = {};

  for (const grp of (data.body.measuregrps as MeasureGroup[]) ?? []) {
    // Only process device-measured data (attrib 0 or 1)
    if (grp.attrib > 1) continue;

    const dateStr = new Date(grp.date * 1000).toISOString().split("T")[0];
    if (!byDate[dateStr]) byDate[dateStr] = {};

    for (const m of grp.measures) {
      const field = MEASURE_TYPE_MAP[m.type];
      if (!field) continue;
      // Take latest reading per day (groups are in reverse chronological order)
      byDate[dateStr][field] = decodeMeasure(m.value, m.unit);
    }
  }

  return byDate;
}

// ─── Device Lookup ──────────────────────────────────────────────────────────

export async function getActiveWithingsDevices(): Promise<WithingsDevice[]> {
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, user_id, access_token, refresh_token, token_expires_at")
    .eq("provider", "withings")
    .eq("is_active", true);

  if (error)
    throw new Error(`Failed to fetch Withings devices: ${error.message}`);
  return data ?? [];
}

export async function getUserWithingsDevice(
  userId: string
): Promise<WithingsDevice | null> {
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, user_id, access_token, refresh_token, token_expires_at")
    .eq("provider", "withings")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch Withings device: ${error.message}`);
  }
  return data;
}
