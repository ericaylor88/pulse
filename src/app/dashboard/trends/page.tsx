import { Heading } from '@/components/ui/heading';

export default function TrendsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Heading title="Trends" description="Interactive time-series explorer across all metrics" />
      <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm">Trends — Phase 2</p>
      </div>
    </div>
  );
}
