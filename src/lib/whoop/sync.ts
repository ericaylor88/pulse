/**
 * WHOOP → daily_metrics Sync Engine
 *
 * Fetches recovery, sleep, cycle, and workout data from the WHOOP API,
 * maps it to the device-agnostic daily_metrics schema, and upserts.
 */

import { createClient } from "@supabase/supabase-js";
import {
  getValidAccessToken,
  fetchRecoveries,
  fetchSleeps,
  fetchCycles,
  fetchWorkouts,
  type WhoopRecovery,
  type WhoopSleep,
  type WhoopCycle,
  type WhoopWorkout,
} from "./client";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DeviceRecord {
  id: number;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
}

interface DailyMetricsRow {
  user_id: string;
  date: string;
  recovery_score: number | null;
  hrv_rmssd_ms: number | null;
  resting_heart_rate: number | null;
  spo2_pct: number | null;
  skin_temp_celsius: number | null;
  sleep_duration_ms: number | null;
  sleep_light_ms: number | null;
  sleep_sws_ms: number | null;
  sleep_rem_ms: number | null;
  sleep_awake_ms: number | null;
  sleep_performance_pct: number | null;
  sleep_efficiency_pct: number | null;
  sleep_consistency_pct: number | null;
  respiratory_rate: number | null;
  sleep_disturbance_count: number | null;
  strain: number | null;
  calories_kj: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
}

export interface SyncResult {
  user_id: string;
  days_synced: number;
  date_range: { start: string; end: string } | null;
  errors: string[];
}

function toCalendarDate(isoTimestamp: string, tzOffset?: string): string {
  const date = new Date(isoTimestamp);

  if (tzOffset) {
    const match = tzOffset.match(/^([+-])(\d{2}):(\d{2})$/);
    if (match) {
      const sign = match[1] === "+" ? 1 : -1;
      const hours = parseInt(match[2], 10);
      const minutes = parseInt(match[3], 10);
      const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;
      date.setTime(date.getTime() + offsetMs);
    }
  }

  return date.toISOString().split("T")[0];
}

function getSyncStartDate(lastSyncAt: string | null): string {
  if (lastSyncAt) {
    const d = new Date(lastSyncAt);
    d.setDate(d.getDate() - 3);
    return d.toISOString();
  }
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString();
}

export async function syncWhoopDevice(
  device: DeviceRecord
): Promise<SyncResult> {
  const result: SyncResult = {
    user_id: device.user_id,
    days_synced: 0,
    date_range: null,
    errors: [],
  };

  try {
    const accessToken = await getValidAccessToken(device);

    const { data: deviceRow } = await supabaseAdmin
      .from("devices")
      .select("last_sync_at")
      .eq("id", device.id)
      .single();

    const startDate = getSyncStartDate(deviceRow?.last_sync_at ?? null);
    const endDate = new Date().toISOString();

    console.log(
      `[WHOOP Sync] User ${device.user_id}: syncing from ${startDate}`
    );

    const [recoveries, sleeps, cycles, workouts] = await Promise.all([
      fetchRecoveries(accessToken, startDate, endDate).catch((e) => {
        result.errors.push(`Recovery fetch failed: ${e.message}`);
        return [] as WhoopRecovery[];
      }),
      fetchSleeps(accessToken, startDate, endDate).catch((e) => {
        result.errors.push(`Sleep fetch failed: ${e.message}`);
        return [] as WhoopSleep[];
      }),
      fetchCycles(accessToken, startDate, endDate).catch((e) => {
        result.errors.push(`Cycle fetch failed: ${e.message}`);
        return [] as WhoopCycle[];
      }),
      fetchWorkouts(accessToken, startDate, endDate).catch((e) => {
        result.errors.push(`Workout fetch failed: ${e.message}`);
        return [] as WhoopWorkout[];
      }),
    ]);

    console.log(
      `[WHOOP Sync] Fetched: ${recoveries.length} recoveries, ${sleeps.length} sleeps, ${cycles.length} cycles, ${workouts.length} workouts`
    );

    // Index by calendar date
    const recoveryByDate = new Map<string, WhoopRecovery>();
    for (const r of recoveries) {
      if (r.score_state !== "SCORED" || !r.score) continue;
      const date = toCalendarDate(r.created_at);
      recoveryByDate.set(date, r);
    }

    const sleepByDate = new Map<string, WhoopSleep>();
    for (const s of sleeps) {
      if (s.score_state !== "SCORED" || !s.score) continue;
      const date = toCalendarDate(s.end, s.timezone_offset);
      sleepByDate.set(date, s);
    }

    const cycleByDate = new Map<string, WhoopCycle>();
    for (const c of cycles) {
      if (c.score_state !== "SCORED" || !c.score) continue;
      const date = toCalendarDate(c.start, c.timezone_offset);
      cycleByDate.set(date, c);
    }

    const allDates = new Set<string>([
      ...Array.from(recoveryByDate.keys()),
      ...Array.from(sleepByDate.keys()),
      ...Array.from(cycleByDate.keys()),
    ]);

    if (allDates.size === 0) {
      console.log(`[WHOOP Sync] No scored data found in range`);
      return result;
    }

    // Build daily_metrics rows
    const rows: DailyMetricsRow[] = [];

    for (const date of allDates) {
      const recovery = recoveryByDate.get(date);
      const sleep = sleepByDate.get(date);
      const cycle = cycleByDate.get(date);

      rows.push({
        user_id: device.user_id,
        date,
        recovery_score: recovery?.score?.recovery_score ?? null,
        hrv_rmssd_ms: recovery?.score?.hrv_rmssd_milli ?? null,
        resting_heart_rate: recovery?.score?.resting_heart_rate ?? null,
        spo2_pct: recovery?.score?.spo2_percentage ?? null,
        skin_temp_celsius: recovery?.score?.skin_temp_celsius ?? null,
        sleep_duration_ms:
          sleep?.score?.stage_summary
            ? sleep.score.stage_summary.total_in_bed_time_milli -
              sleep.score.stage_summary.total_awake_time_milli
            : null,
        sleep_light_ms:
          sleep?.score?.stage_summary?.total_light_sleep_time_milli ?? null,
        sleep_sws_ms:
          sleep?.score?.stage_summary?.total_slow_wave_sleep_time_milli ?? null,
        sleep_rem_ms:
          sleep?.score?.stage_summary?.total_rem_sleep_time_milli ?? null,
        sleep_awake_ms:
          sleep?.score?.stage_summary?.total_awake_time_milli ?? null,
        sleep_performance_pct:
          sleep?.score?.sleep_performance_percentage ?? null,
        sleep_efficiency_pct:
          sleep?.score?.sleep_efficiency_percentage ?? null,
        sleep_consistency_pct:
          sleep?.score?.sleep_consistency_percentage ?? null,
        respiratory_rate: sleep?.score?.respiratory_rate ?? null,
        sleep_disturbance_count:
          sleep?.score?.stage_summary?.disturbance_count ?? null,
        strain: cycle?.score?.strain ?? null,
        calories_kj: cycle?.score?.kilojoule ?? null,
        avg_heart_rate: cycle?.score?.average_heart_rate ?? null,
        max_heart_rate: cycle?.score?.max_heart_rate ?? null,
      });
    }

    // Upsert
    const { error: upsertError } = await supabaseAdmin
      .from("daily_metrics")
      .upsert(rows, {
        onConflict: "user_id,date",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      result.errors.push(`Upsert failed: ${upsertError.message}`);
      console.error(`[WHOOP Sync] Upsert error:`, upsertError);
    } else {
      result.days_synced = rows.length;
      const sortedDates = [...allDates].sort();
      result.date_range = {
        start: sortedDates[0],
        end: sortedDates[sortedDates.length - 1],
      };
      console.log(
        `[WHOOP Sync] Upserted ${rows.length} days: ${result.date_range.start} → ${result.date_range.end}`
      );
    }

    // Update last_sync_at
    await supabaseAdmin
      .from("devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device.id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
    console.error(`[WHOOP Sync] Fatal error for user ${device.user_id}:`, err);
  }

  return result;
}

export async function syncAllWhoopDevices(): Promise<SyncResult[]> {
  const { data: devices, error } = await supabaseAdmin
    .from("devices")
    .select("id, user_id, access_token, refresh_token, token_expires_at")
    .eq("provider", "whoop")
    .eq("is_active", true);

  if (error) throw new Error(`Failed to fetch devices: ${error.message}`);
  if (!devices || devices.length === 0) return [];

  console.log(`[WHOOP Sync] Syncing ${devices.length} device(s)`);

  const results: SyncResult[] = [];
  for (const device of devices) {
    const result = await syncWhoopDevice(device);
    results.push(result);
  }

  return results;
}
