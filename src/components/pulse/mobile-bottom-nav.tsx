"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  TrendingUp,
  ClipboardCheck,
  GitCompareArrows,
  MoreHorizontal,
  Scale,
  Heart,
  Sparkles,
  Pill,
  ThermometerSun,
  Dna,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

interface NavTab {
  label: string;
  href: string;
  icon: React.ElementType;
}

const PRIMARY_TABS: NavTab[] = [
  { label: "Briefing", href: "/dashboard/overview", icon: Activity },
  { label: "Trends", href: "/dashboard/trends", icon: TrendingUp },
  { label: "Check-in", href: "/dashboard/check-in", icon: ClipboardCheck },
  { label: "Correlations", href: "/dashboard/correlations", icon: GitCompareArrows },
];

const MORE_TABS: NavTab[] = [
  { label: "Body Comp", href: "/dashboard/body-comp", icon: Scale },
  { label: "Blood Work", href: "/dashboard/blood-work", icon: Heart },
  { label: "Recommendations", href: "/dashboard/recommendations", icon: Sparkles },
  { label: "Supplements", href: "/dashboard/supplements", icon: Pill },
  { label: "Illness Log", href: "/dashboard/illness-log", icon: ThermometerSun },
  { label: "Genetics", href: "/dashboard/genetics", icon: Dna },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

function TabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: NavTab;
  isActive: boolean;
  onClick?: () => void;
}) {
  const Icon = tab.icon;
  const Component = onClick ? "button" : Link;
  const props = onClick
    ? { onClick, type: "button" as const }
    : { href: tab.href };

  return (
    <Component
      {...(props as any)}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-2 transition-colors",
        isActive
          ? "text-[var(--pulse-brand)]"
          : "text-[var(--pulse-text-tertiary)]"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
      <span
        className={cn(
          "text-[10px] leading-tight truncate max-w-full",
          isActive ? "font-semibold" : "font-medium"
        )}
      >
        {tab.label}
      </span>
    </Component>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const isMoreActive = MORE_TABS.some((t) => pathname === t.href);

  return (
    <>
      {/* More menu overlay */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setMoreOpen(false)}
            />
            {/* Panel */}
            <motion.div
              initial={shouldReduceMotion ? undefined : { y: "100%" }}
              animate={{ y: 0 }}
              exit={shouldReduceMotion ? undefined : { y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed bottom-16 left-0 right-0 z-50 rounded-t-2xl p-4 pb-2 lg:hidden"
              style={{
                background: "var(--pulse-bg-surface)",
                borderTop: "1px solid var(--pulse-border-subtle)",
                borderLeft: "1px solid var(--pulse-border-subtle)",
                borderRight: "1px solid var(--pulse-border-subtle)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--pulse-text-tertiary)" }}
                >
                  More
                </span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="p-1 rounded-md"
                  style={{ color: "var(--pulse-text-tertiary)" }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {MORE_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = pathname === tab.href;
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl p-3 transition-colors",
                        active
                          ? "bg-[var(--pulse-brand)]/10 text-[var(--pulse-brand)]"
                          : "text-[var(--pulse-text-secondary)] active:bg-[var(--pulse-bg-surface-raised)]"
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                      <span className="text-[10px] font-medium leading-tight text-center">
                        {tab.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom nav bar — visible on mobile only */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch lg:hidden"
        style={{
          height: 64,
          background: "var(--pulse-glass-bg)",
          backdropFilter: "blur(16px) saturate(1.2)",
          WebkitBackdropFilter: "blur(16px) saturate(1.2)",
          borderTop: "1px solid var(--pulse-border-subtle)",
        }}
      >
        {PRIMARY_TABS.map((tab) => (
          <TabButton
            key={tab.href}
            tab={tab}
            isActive={pathname === tab.href}
          />
        ))}
        <TabButton
          tab={{ label: "More", href: "#", icon: MoreHorizontal }}
          isActive={isMoreActive || moreOpen}
          onClick={() => setMoreOpen((prev) => !prev)}
        />
      </nav>
    </>
  );
}
