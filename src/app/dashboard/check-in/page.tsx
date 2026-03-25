import { Heading } from '@/components/ui/heading';

export default function CheckInPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Heading title="Daily Check-in" description="Log habits, supplements, and notes" />
      <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm">Daily Check-in — Phase 1</p>
      </div>
    </div>
  );
}
