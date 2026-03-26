/**
 * Open-Meteo Weather + Air Quality Sync
 *
 * Fetches daily weather and AQI data for Los Angeles from Open-Meteo
 * (free, no API key) and upserts into the weather_daily table.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Los Angeles coordinates
const LAT = 34.0522;
const LON = -118.2437;

interface WeatherRow {
  user_id: string;
  date: string;
  temp_max_c: number | null;
  temp_min_c: number | null;
  apparent_temp_max_c: number | null;
  apparent_temp_min_c: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  wind_gusts_kmh: number | null;
  uv_index: number | null;
  precipitation_mm: number | null;
  pm25: number | null;
  pm10: number | null;
  ozone_ugm3: number | null;
  aqi_us: number | null;
  wildfire_pm10: number | null;
}

export interface WeatherSyncResult {
  days_synced: number;
  date_range: { start: string; end: string } | null;
  errors: string[];
}

/**
 * Fetch daily weather from Open-Meteo Weather API
 */
async function fetchWeather(
  startDate: string,
  endDate: string
): Promise<
  Map<
    string,
    {
      temp_max: number;
      temp_min: number;
      apparent_max: number;
      apparent_min: number;
      precipitation: number;
      wind_speed: number;
      wind_direction: number;
      wind_gusts: number;
      uv_index: number;
    }
  >
> {
  const params = new URLSearchParams({
    latitude: LAT.toString(),
    longitude: LON.toString(),
    daily:
      "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,wind_gusts_10m_max,uv_index_max",
    start_date: startDate,
    end_date: endDate,
    timezone: "America/Los_Angeles",
  });

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(`Open-Meteo Weather API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const daily = data.daily;
  const result = new Map<string, any>();

  if (daily && daily.time) {
    for (let i = 0; i < daily.time.length; i++) {
      result.set(daily.time[i], {
        temp_max: daily.temperature_2m_max[i],
        temp_min: daily.temperature_2m_min[i],
        apparent_max: daily.apparent_temperature_max[i],
        apparent_min: daily.apparent_temperature_min[i],
        precipitation: daily.precipitation_sum[i],
        wind_speed: daily.wind_speed_10m_max[i],
        wind_direction: daily.wind_direction_10m_dominant[i],
        wind_gusts: daily.wind_gusts_10m_max[i],
        uv_index: daily.uv_index_max[i],
      });
    }
  }

  return result;
}

/**
 * Fetch hourly humidity and pressure, then compute daily averages.
 * Open-Meteo doesn't provide daily humidity/pressure directly.
 */
async function fetchHumidityPressure(
  startDate: string,
  endDate: string
): Promise<
  Map<string, { humidity: number; pressure: number }>
> {
  const params = new URLSearchParams({
    latitude: LAT.toString(),
    longitude: LON.toString(),
    hourly: "relative_humidity_2m,surface_pressure",
    start_date: startDate,
    end_date: endDate,
    timezone: "America/Los_Angeles",
  });

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(`Open-Meteo Hourly API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const hourly = data.hourly;
  const result = new Map<string, { humidity: number; pressure: number }>();

  if (hourly && hourly.time) {
    // Group by date and average
    const byDate = new Map<string, { humidities: number[]; pressures: number[] }>();

    for (let i = 0; i < hourly.time.length; i++) {
      const date = hourly.time[i].split("T")[0];
      if (!byDate.has(date)) {
        byDate.set(date, { humidities: [], pressures: [] });
      }
      const bucket = byDate.get(date)!;
      if (hourly.relative_humidity_2m[i] !== null) {
        bucket.humidities.push(hourly.relative_humidity_2m[i]);
      }
      if (hourly.surface_pressure[i] !== null) {
        bucket.pressures.push(hourly.surface_pressure[i]);
      }
    }

    for (const [date, bucket] of byDate) {
      const avgHumidity =
        bucket.humidities.length > 0
          ? Math.round(
              bucket.humidities.reduce((a, b) => a + b, 0) /
                bucket.humidities.length
            )
          : 0;
      const avgPressure =
        bucket.pressures.length > 0
          ? Math.round(
              (bucket.pressures.reduce((a, b) => a + b, 0) /
                bucket.pressures.length) *
                10
            ) / 10
          : 0;

      result.set(date, { humidity: avgHumidity, pressure: avgPressure });
    }
  }

  return result;
}

/**
 * Fetch daily air quality from Open-Meteo Air Quality API.
 * Uses US AQI and pollutant concentrations.
 */
async function fetchAirQuality(
  startDate: string,
  endDate: string
): Promise<
  Map<
    string,
    {
      pm25: number | null;
      pm10: number | null;
      ozone: number | null;
      aqi_us: number | null;
    }
  >
> {
  const params = new URLSearchParams({
    latitude: LAT.toString(),
    longitude: LON.toString(),
    hourly: "pm2_5,pm10,ozone,us_aqi",
    start_date: startDate,
    end_date: endDate,
    timezone: "America/Los_Angeles",
  });

  const res = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(`Open-Meteo AQI API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const hourly = data.hourly;
  const result = new Map<string, any>();

  if (hourly && hourly.time) {
    // Group by date, take daily max for AQI and daily mean for pollutants
    const byDate = new Map<
      string,
      { pm25s: number[]; pm10s: number[]; ozones: number[]; aqis: number[] }
    >();

    for (let i = 0; i < hourly.time.length; i++) {
      const date = hourly.time[i].split("T")[0];
      if (!byDate.has(date)) {
        byDate.set(date, { pm25s: [], pm10s: [], ozones: [], aqis: [] });
      }
      const bucket = byDate.get(date)!;
      if (hourly.pm2_5[i] !== null) bucket.pm25s.push(hourly.pm2_5[i]);
      if (hourly.pm10[i] !== null) bucket.pm10s.push(hourly.pm10[i]);
      if (hourly.ozone[i] !== null) bucket.ozones.push(hourly.ozone[i]);
      if (hourly.us_aqi[i] !== null) bucket.aqis.push(hourly.us_aqi[i]);
    }

    for (const [date, bucket] of byDate) {
      const avg = (arr: number[]) =>
        arr.length > 0
          ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
          : null;
      const max = (arr: number[]) =>
        arr.length > 0 ? Math.round(Math.max(...arr)) : null;

      result.set(date, {
        pm25: avg(bucket.pm25s),
        pm10: avg(bucket.pm10s),
        ozone: avg(bucket.ozones),
        aqi_us: max(bucket.aqis), // AQI uses daily max (EPA convention)
      });
    }
  }

  return result;
}

/**
 * Sync weather + AQI for all active users.
 * Fetches last 7 days to backfill any gaps.
 */
export async function syncWeather(): Promise<WeatherSyncResult> {
  const result: WeatherSyncResult = {
    days_synced: 0,
    date_range: null,
    errors: [],
  };

  try {
    // Date range: last 7 days + today
    const endDate = new Date().toISOString().split("T")[0];
    const startD = new Date();
    startD.setDate(startD.getDate() - 7);
    const startDate = startD.toISOString().split("T")[0];

    console.log(`[Weather Sync] Fetching ${startDate} → ${endDate}`);

    // Fetch all three data sources in parallel
    const [weatherData, humidityData, aqiData] = await Promise.all([
      fetchWeather(startDate, endDate).catch((e) => {
        result.errors.push(`Weather fetch: ${e.message}`);
        return new Map() as ReturnType<typeof fetchWeather> extends Promise<infer T> ? T : never;
      }),
      fetchHumidityPressure(startDate, endDate).catch((e) => {
        result.errors.push(`Humidity/pressure fetch: ${e.message}`);
        return new Map() as ReturnType<typeof fetchHumidityPressure> extends Promise<infer T> ? T : never;
      }),
      fetchAirQuality(startDate, endDate).catch((e) => {
        result.errors.push(`AQI fetch: ${e.message}`);
        return new Map() as ReturnType<typeof fetchAirQuality> extends Promise<infer T> ? T : never;
      }),
    ]);

    // Get all user IDs (weather is written per-user for RLS compatibility)
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id");

    if (profileError || !profiles) {
      result.errors.push(
        `Failed to fetch profiles: ${profileError?.message || "no data"}`
      );
      return result;
    }

    // Collect all dates from all sources
    const allDates = new Set<string>([
      ...weatherData.keys(),
      ...aqiData.keys(),
    ]);

    if (allDates.size === 0) {
      console.log("[Weather Sync] No data returned from APIs");
      return result;
    }

    // Build rows for each user × date
    const rows: WeatherRow[] = [];

    for (const userId of profiles.map((p) => p.id)) {
      for (const date of allDates) {
        const w = weatherData.get(date);
        const h = humidityData.get(date);
        const a = aqiData.get(date);

        rows.push({
          user_id: userId,
          date,
          temp_max_c: w?.temp_max ?? null,
          temp_min_c: w?.temp_min ?? null,
          apparent_temp_max_c: w?.apparent_max ?? null,
          apparent_temp_min_c: w?.apparent_min ?? null,
          humidity_pct: h?.humidity ?? null,
          pressure_hpa: h?.pressure ?? null,
          wind_speed_kmh: w?.wind_speed ?? null,
          wind_direction_deg: w?.wind_direction ?? null,
          wind_gusts_kmh: w?.wind_gusts ?? null,
          uv_index: w?.uv_index ?? null,
          precipitation_mm: w?.precipitation ?? null,
          pm25: a?.pm25 ?? null,
          pm10: a?.pm10 ?? null,
          ozone_ugm3: a?.ozone ?? null,
          aqi_us: a?.aqi_us ?? null,
          wildfire_pm10: null, // TODO: separate wildfire PM source
        });
      }
    }

    // Upsert
    const { error: upsertError } = await supabaseAdmin
      .from("weather_daily")
      .upsert(rows, {
        onConflict: "user_id,date",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      result.errors.push(`Upsert failed: ${upsertError.message}`);
      console.error("[Weather Sync] Upsert error:", upsertError);
    } else {
      result.days_synced = allDates.size;
      const sortedDates = Array.from(allDates).sort();
      result.date_range = {
        start: sortedDates[0],
        end: sortedDates[sortedDates.length - 1],
      };
      console.log(
        `[Weather Sync] Upserted ${rows.length} rows (${profiles.length} users × ${allDates.size} days)`
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
    console.error("[Weather Sync] Fatal error:", err);
  }

  return result;
}
