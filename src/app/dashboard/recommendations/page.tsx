import { Heading } from '@/components/ui/heading';

export default function RecommendationsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Heading title="Recommendations" description="AI-generated insights with confidence tiers" />
      <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm">Recommendations — Phase 3</p>
      </div>
    </div>
  );
}
