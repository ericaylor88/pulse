import { Heading } from '@/components/ui/heading';

export default function IllnessLogPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Heading title="Illness Log" description="Log illness events with symptoms, severity, and duration" />
      <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm">Illness Log — Phase 2</p>
      </div>
    </div>
  );
}
