/**
 * Withings → daily_metrics Sync Engine
 *
 * Fetches body composition and blood pressure data from the Withings API,
 * maps it to the device-agnostic daily_metrics schema, and upserts.
 *
 * Smart merge: Only updates Withings-specific columns. Does NOT overwrite
 * WHOOP data (recovery, sleep, strain). For RHR, WHOOP takes priority
 * since it's measured during sleep (more accurate than BP cuff pulse).
 */

import { createClient } from "@supabase/supabase-js";
import {
  getValidAccessToken,
  fetchMeasures,
  getActiveWithingsDevices,
  getUserWithingsDevice,
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

export interface SyncResult {
  user_id: string;
  days_synced: number;
  date_range: { start: string; end: string } | null;
  errors: string[];
}

function getSyncStartDate(lastSyncAt: string | null): string {
  if (lastSyncAt) {
    const d = new Date(lastSyncAt);
    d.setDate(d.getDate() - 3); // overlap 3 days for late-arriving data
    return d.toISOString();
  }
  // First sync: backfill 90 days
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString();
}

export async function syncWithingsDevice(
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
      `[Withings Sync] User ${device.user_id}: syncing from ${startDate}`
    );

    const measuresByDate = await fetchMeasures(accessToken, startDate, endDate);
    const dates = Object.keys(measuresByDate);

    if (dates.length === 0) {
      console.log(`[Withings Sync] No measures found in range`);
      return result;
    }

    // Upsert each day individually to handle the RHR merge logic
    for (const dateStr of dates) {
      const measures = measuresByDate[dateStr];

      const updateFields: Record<string, unknown> = {
        user_id: device.user_id,
        date: dateStr,
      };

      // Body composition
      if (measures.weight_kg !== undefined) {
        updateFields.weight_kg =
          Math.round(measures.weight_kg * 100) / 100;
      }
      if (measures.body_fat_pct !== undefined) {
        updateFields.body_fat_pct =
          Math.round(measures.body_fat_pct * 100) / 100;
      }
      if (measures.fat_mass_kg !== undefined) {
        updateFields.fat_mass_kg =
          Math.round(measures.fat_mass_kg * 100) / 100;
      }
      if (measures.muscle_mass_kg !== undefined) {
        updateFields.muscle_mass_kg =
          Math.round(measures.muscle_mass_kg * 100) / 100;
      }
      if (measures.bone_mass_kg !== undefined) {
        updateFields.bone_mass_kg =
          Math.round(measures.bone_mass_kg * 100) / 100;
      }
      if (measures.visceral_fat_index !== undefined) {
        updateFields.visceral_fat_index = Math.round(
          measures.visceral_fat_index
        );
      }

      // Blood pressure — always write these, Withings BPM is the source
      if (measures.bp_systolic !== undefined) {
        updateFields.bp_systolic = Math.round(measures.bp_systolic);
      }
      if (measures.bp_diastolic !== undefined) {
        updateFields.bp_diastolic = Math.round(measures.bp_diastolic);
      }

      // Heart rate from BP cuff — only write if WHOOP hasn't set resting_hr_bpm
      if (measures.resting_hr_bpm !== undefined) {
        const { data: existing } = await supabaseAdmin
          .from("daily_metrics")
          .select("resting_hr_bpm, source_devices")
          .eq("user_id", device.user_id)
          .eq("date", dateStr)
          .single();

        const whoopOwnsHR =
          existing?.resting_hr_bpm &&
          existing?.source_devices?.includes("whoop");

        if (!whoopOwnsHR) {
          updateFields.resting_hr_bpm = Math.round(measures.resting_hr_bpm);
        }
      }

      const { error: upsertError } = await supabaseAdmin
        .from("daily_metrics")
        .upsert(updateFields, {
          onConflict: "user_id,date",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        result.errors.push(`Upsert failed for ${dateStr}: ${upsertError.message}`);
        console.error(`[Withings Sync] Upsert error for ${dateStr}:`, upsertError);
      } else {
        result.days_synced++;
      }
    }

    const sortedDates = dates.sort();
    result.date_range = {
      start: sortedDates[0],
      end: sortedDates[sortedDates.length - 1],
    };

    console.log(
      `[Withings Sync] Upserted ${result.days_synced} days: ${result.date_range.start} → ${result.date_range.end}`
    );

    // Update last_sync_at
    await supabaseAdmin
      .from("devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device.id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
    console.error(
      `[Withings Sync] Fatal error for user ${device.user_id}:`,
      err
    );
  }

  return result;
}

export async function syncAllWithingsDevices(): Promise<SyncResult[]> {
  const devices = await getActiveWithingsDevices();
  if (devices.length === 0) return [];

  console.log(`[Withings Sync] Syncing ${devices.length} device(s)`);

  const results: SyncResult[] = [];
  for (const device of devices) {
    const result = await syncWithingsDevice(device);
    results.push(result);
  }

  return results;
}

export { getUserWithingsDevice };
