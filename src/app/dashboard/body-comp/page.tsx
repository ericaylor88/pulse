import { Heading } from '@/components/ui/heading';

export default function BodyCompPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Heading title="Body Composition" description="Weight, body fat, muscle mass trends and DEXA milestones" />
      <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm">Body Composition — Phase 2</p>
      </div>
    </div>
  );
}
