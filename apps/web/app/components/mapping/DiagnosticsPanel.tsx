"use client";
import { useSearchParams } from "next/navigation";
import { useSessionStore } from "@/app/store/session";

export function DiagnosticsPanel() {
  const searchParams = useSearchParams();
  const { stages, questions, visionPages, gradings, mappings } = useSessionStore();

  if (searchParams.get("debug") !== "true") {
    return null;
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[400px] bg-white border-l border-border-default shadow-2xl z-50 flex flex-col">
      <div className="p-4 border-b border-border-default bg-surface-muted flex items-center justify-between">
        <h2 className="font-bold text-text-body">Pipeline Diagnostics</h2>
        <span className="text-xs bg-black text-white px-2 py-1 rounded">DEBUG</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 text-sm">
        <section>
          <h3 className="font-semibold text-text-meta uppercase mb-2">Stage Timings</h3>
          <div className="space-y-1">
            {Object.entries(stages).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border-default py-1">
                <span className="capitalize">{k}</span>
                <span className="font-mono text-xs">
                  {v.kind === "done" ? `${v.durationMs}ms` : v.kind}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-text-meta uppercase mb-2">Extracted Data</h3>
          <div className="flex justify-between text-xs">
            <span>Questions: {questions.length}</span>
            <span>Vision Pages: {visionPages.length}</span>
            <span>Mappings: {mappings.length}</span>
            <span>Gradings: {gradings.length}</span>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-text-meta uppercase mb-2">Confidence Dist</h3>
          <div className="space-y-1">
            {mappings.map((m, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <span>Q{m.questionId} Mapping</span>
                <span className={`font-mono ${m.confidence < 0.5 ? 'text-red-500 font-bold' : ''}`}>
                  {(m.confidence * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}