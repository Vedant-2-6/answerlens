"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/app/store/session";
import { SparkleCluster } from "./SparkleCluster";
import { StageList } from "./StageList";
import type { StageKind } from "@answerlens/types";
import { PipelineOrchestrator } from "@answerlens/pipeline";
import { rasterizeFile } from "@/lib/rasterize";

const STAGE_ORDER: StageKind[] = ["ocr","extraction","vision","mapping","grading"];

function computeProgress(stages: Record<StageKind, { kind: string }>): number {
  const done = STAGE_ORDER.filter((k) => stages[k].kind === "done").length;
  const running = STAGE_ORDER.some((k) => stages[k].kind === "running") ? 1 : 0;
  return Math.round(((done + running * 0.5) / STAGE_ORDER.length) * 100);
}

export function ProcessingScreen() {
  const router = useRouter();
  const { 
    stages, setStage, 
    questionFile, answerFile,
    setQuestions, setVisionPages, setMappings, setGradings, setOrphans, setMode 
  } = useSessionStore();
  
  const pct = computeProgress(stages);
  const anyFailed = STAGE_ORDER.some((k) => stages[k].kind === "failed");
  const anyRunning = STAGE_ORDER.some((k) => stages[k].kind === "running");

  const activeStage = STAGE_ORDER.find((k) => stages[k].kind === "running");
  
  let headline = "Processing...";
  if (anyFailed) {
    headline = "Processing Failed";
  } else if (activeStage) {
    headline = {
        ocr: "Reading files...",
        extraction: "Extracting questions...",
        vision: "Analysing answer sheet...",
        mapping: "Mapping answers...",
        grading: "Grading...",
    }[activeStage] || "Processing...";
  }

  useEffect(() => {
    if (!questionFile || !answerFile) {
      router.replace("/");
      return;
    }

    const orchestrator = new PipelineOrchestrator((event) => {
      switch (event.type) {
        case 'STAGE_START':
          setStage(event.stage, { kind: 'running', completedPages: 0, totalPages: event.total || 1 });
          break;
        case 'STAGE_PROGRESS': {
          const currentStage = useSessionStore.getState().stages[event.stage];
          const total = currentStage.kind === 'running' ? currentStage.totalPages : 1;
          setStage(event.stage, { 
            kind: 'running', 
            completedPages: event.completed, 
            totalPages: total
          });
          break;
        }
        case 'STAGE_DONE':
          setStage(event.stage, { kind: 'done', durationMs: event.durationMs });
          break;
        case 'STAGE_ERROR':
          setStage(event.stage, { kind: 'failed', message: event.message, retryable: event.retryable });
          break;
        case 'RESULTS':
          setQuestions(event.questions);
          setVisionPages(event.visionPages);
          setMappings(event.mappings);
          setGradings(event.gradings);
          setMode("quantitative");
          router.push("/results");
          break;
      }
    }, { rasterizeFile });

    orchestrator.run(questionFile, answerFile);

    return () => {
      orchestrator.cancel();
    };
  }, [questionFile, answerFile, router, setStage, setQuestions, setVisionPages, setMappings, setGradings, setMode]);

  return (
    <div className="h-full bg-surface-card rounded-[--radius-pane] flex items-center justify-center">
      <div className="flex flex-col items-center gap-5 text-center px-6">
        <SparkleCluster animate={anyRunning || pct === 0} />

        <div>
          <h2 className="text-[22px] font-[700] leading-[30px] text-text-body">
            {headline}
          </h2>
          <p className="text-[15px] text-text-meta mt-1">This may take a while</p>
        </div>

        <div className="w-[320px] h-1.5 rounded-full bg-surface-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <StageList stages={stages} />
      </div>
    </div>
  );
}