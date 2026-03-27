/**
 * Genetic Profile Configuration
 * Maps rsid → display metadata for the Genetics page.
 * 
 * Categories:
 *   - metabolism: How the body processes substances (caffeine, dopamine)
 *   - nutrients: Vitamin/mineral absorption and utilization
 *   - performance: Athletic and physical traits
 *
 * Each SNP entry includes plain-language explanations for each
 * possible genotype so the UI can display context without hardcoding
 * medical interpretations in the component.
 */

export type GeneticCategory = 'metabolism' | 'nutrients' | 'performance';

export interface SnpConfig {
  rsid: string;
  gene: string;
  trait: string;
  category: GeneticCategory;
  description: string;
  /** What this gene does in plain language */
  plainExplanation: string;
  /** Map of genotype → { label, detail, actionable } */
  genotypes: Record<
    string,
    {
      label: string;
      detail: string;
      actionable: string;
    }
  >;
  /** PubMed or dbSNP reference for credibility */
  reference: string;
}

export const CATEGORY_LABELS: Record<GeneticCategory, string> = {
  metabolism: 'Metabolism',
  nutrients: 'Nutrients & Vitamins',
  performance: 'Performance & Recovery',
};

export const CATEGORY_ICONS: Record<GeneticCategory, string> = {
  metabolism: '⚡',
  nutrients: '💊',
  performance: '🏋️',
};

export const CATEGORY_ORDER: GeneticCategory[] = [
  'metabolism',
  'nutrients',
  'performance',
];

export const SNP_CONFIG: Record<string, SnpConfig> = {
  rs762551: {
    rsid: 'rs762551',
    gene: 'CYP1A2',
    trait: 'Caffeine metabolism speed',
    category: 'metabolism',
    description:
      'CYP1A2 encodes the primary liver enzyme that metabolizes caffeine. Your genotype determines how quickly caffeine is cleared from your system.',
    plainExplanation:
      'This gene controls how fast your liver breaks down caffeine. Fast metabolizers clear caffeine quickly and may benefit from it before exercise. Slow metabolizers hold onto caffeine longer, which can disrupt sleep and increase cardiovascular stress.',
    genotypes: {
      'AA': {
        label: 'Fast metabolizer',
        detail:
          'You clear caffeine quickly. Most research shows performance benefits from caffeine for this genotype.',
        actionable:
          'Caffeine before workouts likely helps. A reasonable cutoff is 8–10 hours before bed, though you may tolerate closer.',
      },
      'AC': {
        label: 'Moderate metabolizer',
        detail:
          'You metabolize caffeine at an intermediate rate. Effects linger longer than fast metabolizers.',
        actionable:
          'Limit to 1–2 cups before noon. Allow 10–12 hours before bed for best sleep quality.',
      },
      'CC': {
        label: 'Slow metabolizer',
        detail:
          'You clear caffeine slowly. Elevated blood caffeine can persist 6–8+ hours after consumption.',
        actionable:
          'Keep caffeine to mornings only (before 10AM). Consider limiting to 1 cup. Monitor HRV impact.',
      },
    },
    reference: 'https://www.ncbi.nlm.nih.gov/snp/rs762551',
  },
  rs4680: {
    rsid: 'rs4680',
    gene: 'COMT',
    trait: 'Dopamine metabolism',
    category: 'metabolism',
    description:
      'COMT (catechol-O-methyltransferase) breaks down dopamine, epinephrine, and norepinephrine in the prefrontal cortex. This affects stress resilience and cognitive performance.',
    plainExplanation:
      'This gene affects how fast your brain clears dopamine. Slow clearance means higher baseline dopamine (better focus, more stress sensitivity). Fast clearance means lower baseline dopamine (more stress resilient, may need more stimulation).',
    genotypes: {
      'AA': {
        label: 'Worrier (slow COMT)',
        detail:
          'Higher dopamine baseline. Better memory and attention at rest, but more vulnerable to stress-induced performance drops.',
        actionable:
          'Stress management is critical for you. Prioritize sleep, meditation, and avoid stacking stressors. Caffeine may increase anxiety.',
      },
      'AG': {
        label: 'Intermediate',
        detail:
          'Balanced dopamine metabolism. Moderate stress sensitivity with good baseline cognitive function.',
        actionable:
          'You have flexibility. Monitor your response to stress and stimulants — adjust based on how you feel.',
      },
      'GG': {
        label: 'Warrior (fast COMT)',
        detail:
          'Lower dopamine baseline. More stress-resilient, better performance under pressure, but may need more stimulation for focus.',
        actionable:
          'You handle pressure well. May benefit from caffeine or high-intensity exercise for focus. Less sensitive to stress stacking.',
      },
    },
    reference: 'https://www.ncbi.nlm.nih.gov/snp/rs4680',
  },
  rs1801133: {
    rsid: 'rs1801133',
    gene: 'MTHFR',
    trait: 'Methylation capacity',
    category: 'nutrients',
    description:
      'MTHFR converts folate into its active form (methylfolate), which is essential for DNA repair, neurotransmitter synthesis, and homocysteine metabolism.',
    plainExplanation:
      'This gene determines how well you convert dietary folate into the active form your body needs. Reduced function can mean higher homocysteine levels (a cardiovascular risk marker) and may affect mood and energy.',
    genotypes: {
      'CC': {
        label: 'Normal function',
        detail:
          'Full MTHFR enzyme activity. Standard folate metabolism. No special supplementation needed from a genetic standpoint.',
        actionable:
          'Standard diet with leafy greens provides adequate folate. No genetic reason to supplement methylfolate.',
      },
      'CT': {
        label: 'Reduced function (~65%)',
        detail:
          'One copy of the variant reduces enzyme efficiency to about 65% of normal. Mildly elevated homocysteine possible.',
        actionable:
          'Consider methylfolate (400–800mcg) instead of folic acid. Eat folate-rich foods. Monitor homocysteine on blood panels.',
      },
      'TT': {
        label: 'Significantly reduced (~30%)',
        detail:
          'Two copies reduce enzyme activity to roughly 30% of normal. Higher risk of elevated homocysteine.',
        actionable:
          'Methylfolate supplementation (800–1000mcg) is worth discussing with your doctor. Avoid folic acid (synthetic form). Track homocysteine quarterly.',
      },
    },
    reference: 'https://www.ncbi.nlm.nih.gov/snp/rs1801133',
  },
  rs1544410: {
    rsid: 'rs1544410',
    gene: 'VDR (BsmI)',
    trait: 'Vitamin D receptor efficiency',
    category: 'nutrients',
    description:
      'The VDR gene encodes the vitamin D receptor, which controls how effectively your cells respond to vitamin D. This affects bone density, immune function, and mood.',
    plainExplanation:
      'This gene affects how well your cells use vitamin D once it's in your blood. Even with adequate blood levels, some genotypes may need higher levels to get the same cellular benefit.',
    genotypes: {
      'CC': {
        label: 'Normal receptor efficiency',
        detail:
          'Standard vitamin D receptor function. Normal cellular response to circulating vitamin D.',
        actionable:
          'Maintain blood vitamin D at 40–60 ng/mL through sun exposure and supplementation as needed.',
      },
      'CT': {
        label: 'Slightly reduced efficiency',
        detail:
          'Mildly reduced receptor binding. You may need slightly higher blood levels for optimal cellular response.',
        actionable:
          'Target blood vitamin D of 50–70 ng/mL. Supplement with D3 + K2. Retest quarterly.',
      },
      'TT': {
        label: 'Reduced receptor efficiency',
        detail:
          'Lower receptor binding efficiency. Even adequate blood levels may not translate to full cellular benefit.',
        actionable:
          'Target blood vitamin D of 60–80 ng/mL. Supplement D3 (2000–5000 IU daily) with K2. Monitor on blood panels.',
      },
    },
    reference: 'https://www.ncbi.nlm.nih.gov/snp/rs1544410',
  },
  rs1815739: {
    rsid: 'rs1815739',
    gene: 'ACTN3',
    trait: 'Muscle fiber type',
    category: 'performance',
    description:
      'ACTN3 produces alpha-actinin-3, a protein found exclusively in fast-twitch (type II) muscle fibers. The "speed gene" influences explosive power vs endurance capacity.',
    plainExplanation:
      'This gene determines whether your fast-twitch muscle fibers produce a key structural protein. Having it favors explosive power (sprinting, lifting). Not having it shifts your fiber composition toward endurance.',
    genotypes: {
      'CC': {
        label: 'Power/sprint advantage',
        detail:
          'Full alpha-actinin-3 production. Higher proportion of functional fast-twitch fibers. Over-represented in elite sprinters and power athletes.',
        actionable:
          'Your genetics favor explosive training (sprints, heavy lifts, plyometrics). You recover well from high-intensity work.',
      },
      'CT': {
        label: 'Mixed power/endurance',
        detail:
          'Partial alpha-actinin-3 production. Balanced fast-twitch and slow-twitch profile. Versatile athletic potential.',
        actionable:
          'You can excel at both power and endurance work. Periodize training to develop both systems.',
      },
      'TT': {
        label: 'Endurance advantage',
        detail:
          'No alpha-actinin-3 production (null genotype). Shift toward slow-twitch dominance. Over-represented in elite endurance athletes.',
        actionable:
          'Your genetics favor endurance training (running, cycling, swimming). Explosive work may require more recovery time.',
      },
    },
    reference: 'https://www.ncbi.nlm.nih.gov/snp/rs1815739',
  },
};

export function getSnpConfig(rsid: string): SnpConfig | undefined {
  return SNP_CONFIG[rsid];
}

export function getSnpsByCategory(
  category: GeneticCategory
): SnpConfig[] {
  return Object.values(SNP_CONFIG).filter((s) => s.category === category);
}
