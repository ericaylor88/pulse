/**
 * WHOOP API v2 Client
 *
 * Handles authenticated requests to the WHOOP Developer API.
 * Automatically refreshes expired access tokens using the stored refresh token.
 * WHOOP rotates refresh tokens on every use — the new one must be saved.
 */

import { createClient } from "@supabase/supabase-js";

const WHOOP_API_BASE = "https://api.prod.whoop.com/developer";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WhoopTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface WhoopDevice {
  id: number;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
}

interface PaginatedResponse<T> {
  records: T[];
  next_token: string | null;
}

// ─── Token Management ───────────────────────────────────────────────────────

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<WhoopTokens> {
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WHOOP token exchange failed: ${res.status} ${err}`);
  }

  return res.json();
}

async function refreshAccessToken(
  refreshToken: string
): Promise<WhoopTokens> {
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      scope: "offline read:recovery read:sleep read:workout read:cycles read:profile read:body_measurement",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WHOOP token refresh failed: ${res.status} ${err}`);
  }

  return res.json();
}

export async function getValidAccessToken(
  device: WhoopDevice
): Promise<string> {
  const expiresAt = device.token_expires_at
    ? new Date(device.token_expires_at)
    : new Date(0);

  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    console.log(`[WHOOP] Refreshing token for user ${device.user_id}`);

    const tokens = await refreshAccessToken(device.refresh_token);
    const newExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

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

// ─── API Requests ───────────────────────────────────────────────────────────

async function whoopGet<T>(
  accessToken: string,
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${WHOOP_API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WHOOP API ${path} failed: ${res.status} ${err}`);
  }

  return res.json();
}

async function whoopGetAll<T>(
  accessToken: string,
  path: string,
  params?: Record<string, string>
): Promise<T[]> {
  const allRecords: T[] = [];
  let nextToken: string | undefined;

  do {
    const queryParams: Record<string, string> = {
      limit: "25",
      ...params,
      ...(nextToken ? { nextToken } : {}),
    };

    const page = await whoopGet<PaginatedResponse<T>>(
      accessToken,
      path,
      queryParams
    );

    allRecords.push(...page.records);
    nextToken = page.next_token ?? undefined;
  } while (nextToken);

  return allRecords;
}

// ─── Data Fetchers ──────────────────────────────────────────────────────────

export interface WhoopRecovery {
  cycle_id: number;
  sleep_id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: string;
  score: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage: number;
    skin_temp_celsius: number;
  } | null;
}

export interface WhoopSleep {
  id: string;
  cycle_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: string;
  score: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_awake_time_milli: number;
      total_no_data_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      sleep_cycle_count: number;
      disturbance_count: number;
    };
    sleep_needed: {
      baseline_milli: number;
      need_from_sleep_debt_milli: number;
      need_from_recent_strain_milli: number;
      need_from_recent_nap_milli: number;
    };
    respiratory_rate: number;
    sleep_performance_percentage: number;
    sleep_consistency_percentage: number;
    sleep_efficiency_percentage: number;
  } | null;
}

export interface WhoopCycle {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  score_state: string;
  score: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  } | null;
}

export interface WhoopWorkout {
  id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_name: string;
  sport_id: number;
  score_state: string;
  score: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    percent_recorded: number;
    distance_meter: number;
    altitude_gain_meter: number;
    altitude_change_meter: number;
    zone_durations: {
      zone_zero_milli: number;
      zone_one_milli: number;
      zone_two_milli: number;
      zone_three_milli: number;
      zone_four_milli: number;
      zone_five_milli: number;
    };
  } | null;
}

export async function fetchRecoveries(
  accessToken: string,
  start: string,
  end?: string
): Promise<WhoopRecovery[]> {
  const params: Record<string, string> = { start };
  if (end) params.end = end;
  return whoopGetAll<WhoopRecovery>(accessToken, "/v2/recovery", params);
}

export async function fetchSleeps(
  accessToken: string,
  start: string,
  end?: string
): Promise<WhoopSleep[]> {
  const params: Record<string, string> = { start };
  if (end) params.end = end;
  const all = await whoopGetAll<WhoopSleep>(
    accessToken,
    "/v2/activity/sleep",
    params
  );
  return all.filter((s) => !s.nap);
}

export async function fetchCycles(
  accessToken: string,
  start: string,
  end?: string
): Promise<WhoopCycle[]> {
  const params: Record<string, string> = { start };
  if (end) params.end = end;
  return whoopGetAll<WhoopCycle>(accessToken, "/v2/cycle", params);
}

export async function fetchWorkouts(
  accessToken: string,
  start: string,
  end?: string
): Promise<WhoopWorkout[]> {
  const params: Record<string, string> = { start };
  if (end) params.end = end;
  return whoopGetAll<WhoopWorkout>(accessToken, "/v2/activity/workout", params);
}

// ─── Device Lookup ──────────────────────────────────────────────────────────

export async function getActiveWhoopDevices(): Promise<WhoopDevice[]> {
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, user_id, access_token, refresh_token, token_expires_at")
    .eq("provider", "whoop")
    .eq("is_active", true);

  if (error) throw new Error(`Failed to fetch WHOOP devices: ${error.message}`);
  return data ?? [];
}

export async function getUserWhoopDevice(
  userId: string
): Promise<WhoopDevice | null> {
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, user_id, access_token, refresh_token, token_expires_at")
    .eq("provider", "whoop")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch WHOOP device: ${error.message}`);
  }
  return data;
}
