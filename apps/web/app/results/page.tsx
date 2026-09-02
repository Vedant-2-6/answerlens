
"use client";
import { Suspense } from "react";
import { AppShell } from "@/app/components/shell/AppShell";
import { MappingScreen } from "@/app/components/mapping/MappingScreen";
import { ClassRoster } from "@/app/components/results/ClassRoster";
import { useSessionStore } from "@/app/store/session";

export default function ResultsPage() {
  const { activeStudentId } = useSessionStore();

  return (
    <AppShell>
      <Suspense fallback={<div>Loading results...</div>}>
        {activeStudentId ? <MappingScreen /> : <ClassRoster />}
      </Suspense>
    </AppShell>
  );
}

