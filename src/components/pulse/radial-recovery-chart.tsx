"use client";

import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "motion/react";

// ─── Types ───────────────────────────────────────────────────────────────

interface RadialRecoveryChartProps {
  recoveryScore: number | null;
  sleepScore: number | null; // sleep efficiency 0-100
  hrvPercentile: number | null; // derived HRV as 0-100 percentile
  size?: number;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function getScoreColor(score: number | null): string {
  if (score === null) return "var(--pulse-text-tertiary)";
  if (score >= 67) return "var(--pulse-emerald)";
  if (score >= 34) return "var(--pulse-amber)";
  return "var(--pulse-coral)";
}

function getScoreLabel(score: number | null): string {
  if (score === null) return "No data";
  if (score >= 67) return "Optimal";
  if (score >= 34) return "Moderate";
  return "Low";
}

function getGlowColor(score: number | null): string {
  if (score === null) return "transparent";
  if (score >= 67) return "rgba(52, 211, 153, 0.3)";
  if (score >= 34) return "rgba(251, 191, 36, 0.25)";
  return "rgba(248, 113, 113, 0.3)";
}

// ─── Animated Ring ───────────────────────────────────────────────────────

function AnimatedRing({
  center,
  radius,
  strokeWidth,
  progress,
  color,
  delay = 0,
}: {
  center: number;
  radius: number;
  strokeWidth: number;
  progress: number; // 0 to 1
  color: string;
  delay?: number;
}) {
  const circumference = 2 * Math.PI * radius;

  const spring = useSpring(0, {
    stiffness: 60,
    damping: 15,
  });

  const dashOffset = useTransform(
    spring,
    (v: number) => circumference - v * circumference
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      spring.set(progress);
    }, delay);
    return () => clearTimeout(timer);
  }, [progress, spring, delay]);

  return (
    <>
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--pulse-border-subtle)"
        strokeWidth={strokeWidth}
        opacity={0.5}
      />
      {/* Animated value arc */}
      <motion.circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        style={{ strokeDashoffset: dashOffset }}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

export function RadialRecoveryChart({
  recoveryScore,
  sleepScore,
  hrvPercentile,
  size = 240,
  className = "",
}: RadialRecoveryChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ring geometry — design spec: primary 12px, secondary 6px
  const center = size / 2;
  const primaryRadius = center - 20; // outermost recovery ring
  const sleepRadius = primaryRadius - 16; // sleep ring (outer secondary)
  const hrvRadius = sleepRadius - 12; // HRV ring (inner secondary)

  const recoveryProgress = recoveryScore !== null ? recoveryScore / 100 : 0;
  const sleepProgress = sleepScore !== null ? sleepScore / 100 : 0;
  const hrvProgress = hrvPercentile !== null ? hrvPercentile / 100 : 0;

  const scoreColor = getScoreColor(recoveryScore);
  const glowColor = getGlowColor(recoveryScore);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Subtle radial gradient glow behind the chart */}
      {mounted && recoveryScore !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
        />
      )}

      {/* SVG rings */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative z-10"
      >
        {/* HRV ring — innermost secondary */}
        {hrvPercentile !== null && (
          <AnimatedRing
            center={center}
            radius={hrvRadius}
            strokeWidth={5}
            progress={mounted ? hrvProgress : 0}
            color="var(--pulse-blue)"
            delay={200}
          />
        )}

        {/* Sleep ring — outer secondary */}
        {sleepScore !== null && (
          <AnimatedRing
            center={center}
            radius={sleepRadius}
            strokeWidth={5}
            progress={mounted ? sleepProgress : 0}
            color="var(--pulse-blue)"
            delay={100}
          />
        )}

        {/* Recovery ring — primary */}
        <AnimatedRing
          center={center}
          radius={primaryRadius}
          strokeWidth={12}
          progress={mounted ? recoveryProgress : 0}
          color={scoreColor}
          delay={0}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={mounted ? { opacity: 1, scale: 1 } : {}}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.4 }}
          className="font-data text-4xl font-bold tracking-tight"
          style={{ color: scoreColor, fontFamily: "var(--font-data)" }}
        >
          {recoveryScore !== null ? `${Math.round(recoveryScore)}%` : "—"}
        </motion.span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={mounted ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="mt-0.5 text-xs font-medium tracking-wider uppercase"
          style={{ color: "var(--pulse-text-secondary)" }}
        >
          Recovery
        </motion.span>
        {recoveryScore !== null && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={mounted ? { opacity: 1 } : {}}
            transition={{ delay: 0.8 }}
            className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              color: scoreColor,
              backgroundColor:
                recoveryScore >= 67
                  ? "var(--pulse-emerald-muted)"
                  : recoveryScore >= 34
                    ? "var(--pulse-amber-muted)"
                    : "var(--pulse-coral-muted)",
            }}
          >
            {getScoreLabel(recoveryScore)}
          </motion.span>
        )}
      </div>

      {/* Ring labels (small text outside, revealed on hover via CSS) */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {sleepScore !== null && (
          <span className="text-[9px] font-medium" style={{ color: "var(--pulse-blue)" }}>
            Sleep {Math.round(sleepScore)}%
          </span>
        )}
        {hrvPercentile !== null && (
          <span className="text-[9px] font-medium" style={{ color: "var(--pulse-blue)" }}>
            HRV {Math.round(hrvPercentile)}%
          </span>
        )}
      </div>
    </div>
  );
}
