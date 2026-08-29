import { Suspense } from "react";
import { AppShell } from "@/app/components/shell/AppShell";
import { MappingScreen } from "@/app/components/mapping/MappingScreen";

export default function ResultsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div>Loading results...</div>}>
        <MappingScreen />
      </Suspense>
    </AppShell>
  );
}