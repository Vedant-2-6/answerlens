"use client";
import { useSessionStore } from "@/app/store/session";
import { SummaryBar } from "./SummaryBar";
import { QuestionPane } from "./QuestionPane";
import { AnswerPane } from "./AnswerPane";
import { DiagnosticsPanel } from "./DiagnosticsPanel";

export function MappingScreen() {
  const { questions, visionPages, mappings, gradings } = useSessionStore();

  

  return (
    <div className="h-full flex flex-col bg-surface-app">
      <SummaryBar />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left pane: Questions & Grades */}
        <div className="w-[380px] flex-shrink-0 bg-surface-card border-r border-border-default overflow-y-auto">
          <QuestionPane />
        </div>

        {/* Right pane: Interactive Paper Viewer */}
        <div className="flex-1 bg-surface-dark overflow-hidden">
          <AnswerPane />
        </div>
      </div>
      <DiagnosticsPanel />
    </div>
  );
}