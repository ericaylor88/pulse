"""
Pulse Correlation Engine — FastAPI service for Railway
Computes correlations between health metrics, habits, and environmental data.
Uses pingouin for statistics and scikit-learn for anomaly detection.

Deploy to Railway:
  1. railway init
  2. railway link
  3. railway up

Env vars needed on Railway:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import os
import json
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import pingouin as pg
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.ensemble import IsolationForest
from supabase import create_client, Client

app = FastAPI(title="Pulse Correlation Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pulse-ecru-three.vercel.app",
        "http://localhost:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Supabase client ─────────────────────────────────────────────────────

def get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


# ─── Metric config ───────────────────────────────────────────────────────

CONTINUOUS_METRICS = [
    "recovery_score", "hrv_rmssd", "resting_hr", "sleep_score",
    "total_sleep_min", "deep_sleep_min", "rem_sleep_min",
    "strain_score", "calories_total", "spo2_pct", "skin_temp_c",
    "weight_kg", "body_fat_pct", "muscle_mass_kg",
    "bp_systolic", "bp_diastolic",
]

BINARY_HABITS = [
    "foam_rolling", "compression", "tea_before_bed", "video_games", "sex",
]

QUANTITY_HABITS = ["coffee_cups", "alcohol_drinks"]

WEATHER_METRICS = [
    "temp_max_c", "humidity_pct", "pressure_hpa", "uv_index",
    "aqi_us", "pm25",
]


# ─── Models ──────────────────────────────────────────────────────────────

class CorrelationRequest(BaseModel):
    user_id: str
    min_days: int = 60
    max_lag: int = 3


class AnomalyRequest(BaseModel):
    user_id: str
    lookback_days: int = 90
    contamination: float = 0.05


class CorrelationResult(BaseModel):
    variable_a: str
    variable_b: str
    lag_days: int
    r_value: float
    p_value: float
    n: int
    effect_size: str
    confidence_tier: str
    method: str


# ─── Helpers ─────────────────────────────────────────────────────────────

def classify_effect(r: float) -> str:
    absR = abs(r)
    if absR >= 0.5:
        return "large"
    elif absR >= 0.3:
        return "medium"
    elif absR >= 0.1:
        return "small"
    return "negligible"


def classify_confidence(n: int, r: float, p: float) -> str:
    absR = abs(r)
    if n >= 90 and absR >= 0.3 and p < 0.01:
        return "high"
    elif n >= 60 and absR >= 0.25 and p < 0.05:
        return "medium"
    return "low"


# ─── Correlation engine ──────────────────────────────────────────────────

def run_correlations(user_id: str, min_days: int, max_lag: int) -> list[CorrelationResult]:
    sb = get_supabase()

    # Fetch daily metrics
    metrics_resp = sb.table("daily_metrics").select("*").eq("user_id", user_id).order("date").execute()
    checkins_resp = sb.table("check_ins").select("*").eq("user_id", user_id).order("date").execute()
    weather_resp = sb.table("weather_daily").select("*").eq("user_id", user_id).order("date").execute()

    if not metrics_resp.data:
        return []

    # Build DataFrames
    df_metrics = pd.DataFrame(metrics_resp.data).set_index("date")
    df_checkins = pd.DataFrame(checkins_resp.data).set_index("date") if checkins_resp.data else pd.DataFrame()
    df_weather = pd.DataFrame(weather_resp.data).set_index("date") if weather_resp.data else pd.DataFrame()

    # Merge on date
    df = df_metrics[CONTINUOUS_METRICS].copy()

    if not df_checkins.empty:
        habit_cols = [c for c in BINARY_HABITS + QUANTITY_HABITS if c in df_checkins.columns]
        df = df.join(df_checkins[habit_cols], how="left")

    if not df_weather.empty:
        weather_cols = [c for c in WEATHER_METRICS if c in df_weather.columns]
        df = df.join(df_weather[weather_cols], how="left")

    # Convert booleans to int
    for col in BINARY_HABITS:
        if col in df.columns:
            df[col] = df[col].astype(float)

    if len(df) < min_days:
        return []

    results: list[CorrelationResult] = []

    # Define pairs to test
    outcome_vars = ["recovery_score", "hrv_rmssd", "resting_hr", "sleep_score",
                    "total_sleep_min", "deep_sleep_min", "strain_score"]

    predictor_vars = (
        BINARY_HABITS + QUANTITY_HABITS +
        [m for m in WEATHER_METRICS if m in df.columns] +
        ["strain_score", "total_sleep_min", "deep_sleep_min"]
    )

    tested_pairs = set()

    for outcome in outcome_vars:
        if outcome not in df.columns:
            continue
        for predictor in predictor_vars:
            if predictor not in df.columns or predictor == outcome:
                continue

            pair_key = tuple(sorted([outcome, predictor]))
            if pair_key in tested_pairs:
                continue
            tested_pairs.add(pair_key)

            for lag in range(0, max_lag + 1):
                try:
                    if lag > 0:
                        pred_shifted = df[predictor].shift(lag)
                        pair_df = pd.DataFrame({
                            "x": pred_shifted,
                            "y": df[outcome]
                        }).dropna()
                    else:
                        pair_df = pd.DataFrame({
                            "x": df[predictor],
                            "y": df[outcome]
                        }).dropna()

                    n = len(pair_df)
                    if n < min_days:
                        continue

                    # Use point-biserial for binary, Spearman for continuous
                    if predictor in BINARY_HABITS:
                        # Point-biserial is equivalent to Pearson on binary
                        corr = pg.corr(pair_df["x"], pair_df["y"], method="pearson")
                        method = "point-biserial"
                    else:
                        corr = pg.corr(pair_df["x"], pair_df["y"], method="spearman")
                        method = "spearman"

                    r_val = float(corr["r"].iloc[0])
                    p_val = float(corr["p-val"].iloc[0])

                    # Skip negligible
                    if abs(r_val) < 0.1:
                        continue

                    effect = classify_effect(r_val)
                    tier = classify_confidence(n, r_val, p_val)

                    results.append(CorrelationResult(
                        variable_a=predictor,
                        variable_b=outcome,
                        lag_days=lag,
                        r_value=round(r_val, 4),
                        p_value=round(p_val, 6),
                        n=n,
                        effect_size=effect,
                        confidence_tier=tier,
                        method=method,
                    ))

                except Exception as e:
                    print(f"[Corr] Error {predictor}->{outcome} lag{lag}: {e}")
                    continue

    # Apply Holm correction for multiple comparisons
    if results:
        p_values = [r.p_value for r in results]
        n_tests = len(p_values)
        sorted_indices = np.argsort(p_values)

        for rank, idx in enumerate(sorted_indices):
            adjusted_p = min(p_values[idx] * (n_tests - rank), 1.0)
            results[idx].p_value = round(adjusted_p, 6)
            # Reclassify confidence with adjusted p
            results[idx].confidence_tier = classify_confidence(
                results[idx].n, results[idx].r_value, adjusted_p
            )

    # Sort by |r| descending
    results.sort(key=lambda x: abs(x.r_value), reverse=True)

    return results


# ─── Anomaly detection ───────────────────────────────────────────────────

def run_anomaly_detection(user_id: str, lookback_days: int, contamination: float) -> list[dict]:
    sb = get_supabase()

    cutoff = (datetime.now() - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    resp = sb.table("daily_metrics").select("*").eq("user_id", user_id).gte("date", cutoff).order("date").execute()

    if not resp.data or len(resp.data) < 30:
        return []

    df = pd.DataFrame(resp.data)
    feature_cols = [c for c in CONTINUOUS_METRICS if c in df.columns]

    # Fill NaN with column median for IsolationForest
    features = df[feature_cols].copy()
    features = features.fillna(features.median())

    if features.empty:
        return []

    model = IsolationForest(contamination=contamination, random_state=42, n_jobs=-1)
    predictions = model.fit_predict(features)
    scores = model.decision_function(features)

    anomalies = []
    for i, (pred, score) in enumerate(zip(predictions, scores)):
        if pred == -1:  # anomaly
            row = resp.data[i]
            # Find which metrics are most anomalous
            deviations = {}
            for col in feature_cols:
                val = features.iloc[i][col]
                col_median = features[col].median()
                col_std = features[col].std()
                if col_std > 0:
                    z = (val - col_median) / col_std
                    if abs(z) > 1.5:
                        deviations[col] = round(z, 2)

            anomalies.append({
                "date": row["date"],
                "anomaly_score": round(float(score), 4),
                "deviations": deviations,
            })

    return anomalies


# ─── API Routes ──────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "pulse-correlation-engine"}


@app.post("/correlations/compute")
async def compute_correlations(req: CorrelationRequest, bg: BackgroundTasks):
    results = run_correlations(req.user_id, req.min_days, req.max_lag)

    if not results:
        return {"ok": True, "message": "Not enough data", "correlations": 0}

    # Store in Supabase
    sb = get_supabase()

    # Clear old correlations for this user
    sb.table("correlations").delete().eq("user_id", req.user_id).execute()

    # Insert new
    rows = [
        {
            "user_id": req.user_id,
            "variable_a": r.variable_a,
            "variable_b": r.variable_b,
            "lag_days": r.lag_days,
            "r_value": r.r_value,
            "p_value": r.p_value,
            "n": r.n,
            "effect_size": r.effect_size,
            "confidence_tier": r.confidence_tier,
            "method": r.method,
        }
        for r in results
    ]

    # Batch insert
    for i in range(0, len(rows), 50):
        sb.table("correlations").insert(rows[i:i + 50]).execute()

    return {
        "ok": True,
        "correlations": len(results),
        "high_confidence": sum(1 for r in results if r.confidence_tier == "high"),
        "medium_confidence": sum(1 for r in results if r.confidence_tier == "medium"),
        "top_5": [
            {"pair": f"{r.variable_a} -> {r.variable_b}", "r": r.r_value, "tier": r.confidence_tier}
            for r in results[:5]
        ],
    }


@app.post("/anomalies/detect")
async def detect_anomalies(req: AnomalyRequest):
    anomalies = run_anomaly_detection(req.user_id, req.lookback_days, req.contamination)

    return {
        "ok": True,
        "anomalies_found": len(anomalies),
        "anomalies": anomalies,
    }
