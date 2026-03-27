"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  User,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Monitor,
  Activity,
  Scale,
  Heart,
  RefreshCw,
  ExternalLink,
  Shield,
  Database,
  LogOut,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────

interface DeviceRow {
  id: string;
  provider: string;
  is_active: boolean;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

// ─── Device config ───────────────────────────────────────────────────────

const DEVICE_CONFIG: Record<
  string,
  {
    name: string;
    description: string;
    icon: React.ReactNode;
    connectUrl: string;
    metrics: string[];
  }
> = {
  whoop: {
    name: "WHOOP",
    description: "Recovery, sleep, strain, HRV, and respiratory data",
    icon: <Activity className="h-5 w-5" />,
    connectUrl: "/api/whoop/authorize",
    metrics: ["Recovery", "Sleep", "Strain", "HRV", "RHR", "SpO2"],
  },
  withings: {
    name: "Withings",
    description: "Body composition, blood pressure, and weight tracking",
    icon: <Scale className="h-5 w-5" />,
    connectUrl: "/api/withings/authorize",
    metrics: ["Weight", "Body Fat %", "Muscle Mass", "Blood Pressure"],
  },
};

// ─── Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch profile
    setProfile({
      email: user.email || "",
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
      created_at: user.created_at,
    });

    // Fetch devices
    const { data: deviceData } = await supabase
      .from("devices")
      .select("*")
      .eq("user_id", user.id);

    if (deviceData) {
      setDevices(deviceData);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDisconnect = async (provider: string) => {
    setDisconnecting(provider);
    try {
      const res = await fetch(`/api/${provider}/disconnect`, {
        method: "POST",
      });
      if (res.ok) {
        // Refresh device list
        await fetchData();
      }
    } catch (err) {
      console.error("Disconnect failed:", err);
    }
    setDisconnecting(null);
  };

  const handleConnect = (provider: string) => {
    const config = DEVICE_CONFIG[provider];
    if (config) {
      window.location.href = config.connectUrl;
    }
  };

  const getDevice = (provider: string): DeviceRow | undefined => {
    return devices.find((d) => d.provider === provider && d.is_active);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  // ─── Loading ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm">
            Devices, profile, and preferences
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-16 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Devices, profile, and preferences
        </p>
      </div>

      {/* ── Account ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          Account
        </h2>

        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-12 w-12 rounded-full border"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div>
                {profile?.full_name && (
                  <p className="font-medium">{profile.full_name}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {profile?.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Member since{" "}
                  {new Date(profile?.created_at || "").toLocaleDateString(
                    "en-US",
                    { month: "long", year: "numeric" }
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Connected Devices ───────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Wifi className="h-5 w-5 text-muted-foreground" />
          Connected Devices
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(DEVICE_CONFIG).map(([provider, config]) => {
            const device = getDevice(provider);
            const isConnected = !!device;
            const isDisconnecting = disconnecting === provider;

            return (
              <Card
                key={provider}
                className={cn(
                  "transition-colors",
                  isConnected &&
                    "border-[var(--pulse-emerald)]/30"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          isConnected
                            ? "bg-[var(--pulse-emerald-muted)]"
                            : "bg-muted"
                        )}
                        style={
                          isConnected
                            ? { color: "var(--pulse-emerald)" }
                            : undefined
                        }
                      >
                        {config.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {config.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {config.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={isConnected ? "default" : "secondary"}
                      className={cn(
                        "text-xs",
                        isConnected &&
                          "border-none"
                      )}
                      style={
                        isConnected
                          ? {
                              backgroundColor: "var(--pulse-emerald-muted)",
                              color: "var(--pulse-emerald)",
                            }
                          : undefined
                      }
                    >
                      {isConnected ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-3 pt-0">
                  {/* Metrics list */}
                  <div className="flex flex-wrap gap-1.5">
                    {config.metrics.map((metric) => (
                      <Badge
                        key={metric}
                        variant="secondary"
                        className="text-xs font-normal"
                      >
                        {metric}
                      </Badge>
                    ))}
                  </div>

                  {/* Connection info */}
                  {isConnected && device && (
                    <p className="text-xs text-muted-foreground">
                      Connected{" "}
                      {new Date(device.created_at).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </p>
                  )}

                  {/* Action button */}
                  {isConnected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-xs"
                      onClick={() => handleDisconnect(provider)}
                      disabled={isDisconnecting}
                    >
                      {isDisconnecting ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5" />
                      )}
                      {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full gap-2 text-xs"
                      onClick={() => handleConnect(provider)}
                      style={{
                        backgroundColor: "var(--pulse-brand)",
                        color: "#FFFFFF",
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Connect {config.name}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Appearance ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Sun className="h-5 w-5 text-muted-foreground" />
          Appearance
        </h2>

        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Choose your preferred color mode
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "light", label: "Light", icon: Sun },
                  { value: "system", label: "System", icon: Monitor },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-colors",
                      theme === value
                        ? "border-[var(--pulse-brand)] bg-[var(--pulse-brand)]/10"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={
                        theme === value
                          ? { color: "var(--pulse-brand)" }
                          : undefined
                      }
                    />
                    <span
                      className={cn(
                        "text-xs font-medium",
                        theme === value
                          ? ""
                          : "text-muted-foreground"
                      )}
                      style={
                        theme === value
                          ? { color: "var(--pulse-brand)" }
                          : undefined
                      }
                    >
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Data & Privacy ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          Data &amp; Privacy
        </h2>

        <Card>
          <CardContent className="flex flex-col gap-4 py-4">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Your data stays yours</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  All health data is stored in your private Supabase database
                  with row-level security. No data is shared with third
                  parties. Device connections use OAuth 2.0 — Pulse never sees
                  your device passwords.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Heart className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Not medical advice</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Pulse provides observations and correlations based on your
                  data. All recommendations are for informational purposes
                  only and should not be used as a substitute for professional
                  medical advice.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
