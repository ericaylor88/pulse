import { Heading } from '@/components/ui/heading';

export default function CorrelationsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Heading title="Correlations" description="Discover what actually affects your recovery, sleep, and health" />
      <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm">Correlations — Phase 3</p>
      </div>
    </div>
  );
}
