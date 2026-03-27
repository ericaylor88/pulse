"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dna,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  FileText,
} from "lucide-react";
import {
  type GeneticCategory,
  type SnpConfig,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  CATEGORY_ORDER,
  getSnpConfig,
  getSnpsByCategory,
} from "@/lib/genetic-config";

// ─── Types ───────────────────────────────────────────────────────────────

interface GeneticRow {
  id: string;
  rsid: string;
  gene: string;
  genotype: string;
  trait: string;
  interpretation: string;
}

// ─── Component ───────────────────────────────────────────────────────────

export default function GeneticsPage() {
  const [snps, setSnps] = useState<GeneticRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const supabase = createClient();

  const fetchGenetics = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("genetic_profile")
      .select("*")
      .eq("user_id", user.id)
      .order("gene", { ascending: true });

    if (!error && data) {
      setSnps(data);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchGenetics();
  }, [fetchGenetics]);

  const toggleExpanded = (rsid: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(rsid)) {
        next.delete(rsid);
      } else {
        next.add(rsid);
      }
      return next;
    });
  };

  // Group SNPs by category using config
  const groupedSnps: Record<GeneticCategory, GeneticRow[]> = {
    metabolism: [],
    nutrients: [],
    performance: [],
  };

  snps.forEach((row) => {
    const config = getSnpConfig(row.rsid);
    if (config) {
      groupedSnps[config.category].push(row);
    }
  });

  // ─── Loading skeleton ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Genetic Profile
          </h1>
          <p className="text-muted-foreground text-sm">
            SNP results with personalized health context
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-5 w-32 rounded bg-muted" />
                <div className="h-4 w-48 rounded bg-muted" />
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

  // ─── Empty state ───────────────────────────────────────────────────────

  if (snps.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Genetic Profile
          </h1>
          <p className="text-muted-foreground text-sm">
            SNP results with personalized health context
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Dna
              className="mb-4 h-12 w-12"
              style={{ color: "var(--pulse-purple)" }}
            />
            <h3 className="mb-2 text-lg font-semibold">
              No genetic data yet
            </h3>
            <p className="text-muted-foreground max-w-sm text-sm">
              Upload your Ancestry.com or 23andMe raw data file to see
              personalized insights based on your DNA.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Genetic Profile</h1>
        <p className="text-muted-foreground text-sm">
          {snps.length} actionable SNPs from your Ancestry DNA file
        </p>
      </div>

      {/* Disclaimer banner */}
      <Card
        className="border-l-[3px]"
        style={{ borderLeftColor: "var(--pulse-purple)" }}
      >
        <CardContent className="flex gap-3 py-3">
          <Sparkles
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "var(--pulse-purple)" }}
          />
          <div>
            <p
              className="text-xs font-medium"
              style={{ color: "var(--pulse-purple)" }}
            >
              About genetic insights
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              These results are based on published research and your raw
              genotype data. Genetic variants are one factor among many —
              environment, habits, and lifestyle often have a larger effect.
              This is not medical advice.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Category groups */}
      {CATEGORY_ORDER.map((category) => {
        const categorySnps = groupedSnps[category];
        if (categorySnps.length === 0) return null;

        return (
          <div key={category} className="flex flex-col gap-4">
            {/* Category header */}
            <div className="flex items-center gap-2">
              <span className="text-lg">{CATEGORY_ICONS[category]}</span>
              <h2 className="text-lg font-semibold tracking-tight">
                {CATEGORY_LABELS[category]}
              </h2>
              <Badge variant="secondary" className="text-xs">
                {categorySnps.length}
              </Badge>
            </div>

            {/* SNP cards */}
            <div className="grid gap-4 md:grid-cols-2">
              {categorySnps.map((row) => {
                const config = getSnpConfig(row.rsid);
                if (!config) return null;

                const genotypeInfo = config.genotypes[row.genotype];
                const isExpanded = expandedCards.has(row.rsid);

                return (
                  <SnpCard
                    key={row.rsid}
                    row={row}
                    config={config}
                    genotypeInfo={genotypeInfo}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpanded(row.rsid)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Source attribution */}
      <Card className="mt-2">
        <CardContent className="flex items-center gap-3 py-3">
          <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
          <p className="text-muted-foreground text-xs">
            Data source: Ancestry.com DNA raw data file (v2.0 array, 677,455
            SNPs). Parsed and filtered to actionable variants with published
            research support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── SNP Card Component ──────────────────────────────────────────────────

function SnpCard({
  row,
  config,
  genotypeInfo,
  isExpanded,
  onToggle,
}: {
  row: GeneticRow;
  config: SnpConfig;
  genotypeInfo:
    | { label: string; detail: string; actionable: string }
    | undefined;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:border-[var(--pulse-border-default)]"
      onClick={onToggle}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <span
                className="font-semibold"
                style={{ color: "var(--pulse-purple)" }}
              >
                {config.gene}
              </span>
              <span className="text-muted-foreground text-xs font-normal font-mono">
                {config.rsid}
              </span>
            </CardTitle>
            <CardDescription className="text-sm">
              {config.trait}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* Genotype badge */}
            <Badge
              className="font-mono text-xs font-semibold"
              style={{
                backgroundColor: "var(--pulse-purple)",
                color: "#FFFFFF",
              }}
            >
              {row.genotype}
            </Badge>
            {isExpanded ? (
              <ChevronUp className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        {/* Result label */}
        {genotypeInfo && (
          <div
            className="rounded-md border px-3 py-2"
            style={{
              borderColor: "var(--pulse-purple)",
              backgroundColor: "rgba(167, 139, 250, 0.1)",
            }}
          >
            <p
              className="text-sm font-medium"
              style={{ color: "var(--pulse-purple)" }}
            >
              {genotypeInfo.label}
            </p>
          </div>
        )}

        {/* Plain language explanation */}
        <p className="text-muted-foreground text-sm leading-relaxed">
          {config.plainExplanation}
        </p>

        {/* Expanded details */}
        {isExpanded && genotypeInfo && (
          <div className="flex flex-col gap-3 border-t pt-3">
            {/* What this means for you */}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                What this means for you
              </p>
              <p className="text-sm leading-relaxed">
                {genotypeInfo.detail}
              </p>
            </div>

            {/* Actionable recommendation */}
            <div
              className="rounded-md border-l-2 py-2 pl-3"
              style={{ borderColor: "var(--pulse-purple)" }}
            >
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recommendation
              </p>
              <p className="text-sm leading-relaxed">
                {genotypeInfo.actionable}
              </p>
            </div>

            {/* Gene description */}
            <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {config.description}
              </p>
            </div>

            {/* Reference link */}
            <a
              href={config.reference}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs hover:underline"
              style={{ color: "var(--pulse-purple)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              View on dbSNP (NCBI)
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
