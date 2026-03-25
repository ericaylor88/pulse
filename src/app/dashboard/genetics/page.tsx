import { Heading } from '@/components/ui/heading';

export default function GeneticsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Heading title="Genetic Profile" description="SNP results with personalized health context" />
      <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm">Genetic Profile — Phase 1</p>
      </div>
    </div>
  );
}
