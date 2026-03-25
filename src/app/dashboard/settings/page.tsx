import { Heading } from '@/components/ui/heading';

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Heading title="Settings" description="Devices, profile, and preferences" />
      <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm">Settings — Phase 1</p>
      </div>
    </div>
  );
}
