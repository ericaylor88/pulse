import { Heading } from '@/components/ui/heading';

export default function BloodWorkPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Heading title="Blood Work" description="Biomarker cards with optimal ranges and trends" />
      <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm">Blood Work — Phase 2</p>
      </div>
    </div>
  );
}
