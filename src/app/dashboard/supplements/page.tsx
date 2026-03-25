import { Heading } from '@/components/ui/heading';

export default function SupplementsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Heading title="Supplements" description="Track daily supplement intake, doses, and timing" />
      <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm">Supplements — Phase 2</p>
      </div>
    </div>
  );
}
