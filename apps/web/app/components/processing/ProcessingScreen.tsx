
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/app/store/session";
import { useSettingsStore } from "@/app/store/settings";
import { SparkleCluster } from "./SparkleCluster";
import { StageList } from "./StageList";
import type { StageKind, StageStatus, StudentSession } from "@answerlens/types";
import { PipelineOrchestrator } from "@answerlens/pipeline";
import { rasterizeFile } from "@/lib/rasterize";
import { Check, Loader2, XCircle } from "lucide-react";

export function ProcessingScreen() {
  const router = useRouter();
  const {
    questionFile,
    students,
    updateStudent,
    setQuestions,
    setPaperMaxMarks,
    setOptionGroups,
    setEstimatedGradeLevel,
    setSubjectArea,
    setGlobalExtractionStage,
    globalExtractionStage,
  } = useSessionStore();
  const { settings } = useSettingsStore();

  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [batchFinished, setBatchFinished] = useState(false);

  useEffect(() => {
    if (!questionFile || students.length === 0) {
      router.replace("/");
      return;
    }

    const orchestrator = new PipelineOrchestrator((event) => {
      if (event.type === "EXTRACTION_RESULTS") {
        setQuestions(event.questions);
        setPaperMaxMarks(event.paperMaxMarks ?? null);
        setOptionGroups(event.optionGroups || []);
        setEstimatedGradeLevel(event.estimatedGradeLevel ?? null);
        setSubjectArea(event.subjectArea ?? null);
        return;
      }
      
      if (event.type === "STUDENT_RESULTS") {
        updateStudent(event.studentId, {
          visionPages: event.visionPages,
          mappings: event.mappings,
          gradings: event.gradings,
        });
        return;
      }

      if (event.studentId) {
        // Update student stage
        const student = useSessionStore.getState().students.find(s => s.id === event.studentId);
        if (!student) return;
        
        let newStatus: StageStatus = student.stages[event.stage];
        if (event.type === "STAGE_START") {
          newStatus = { kind: "running", completedPages: 0, totalPages: event.total || 1 };
        } else if (event.type === "STAGE_PROGRESS") {
          const total = newStatus.kind === "running" ? newStatus.totalPages : 1;
          newStatus = { kind: "running", completedPages: event.completed, totalPages: total };
        } else if (event.type === "STAGE_DONE") {
          newStatus = { kind: "done", durationMs: event.durationMs };
        } else if (event.type === "STAGE_ERROR") {
          newStatus = { kind: "failed", message: event.message, retryable: event.retryable };
        }
        
        updateStudent(event.studentId, {
          stages: { ...student.stages, [event.stage]: newStatus }
        });
      } else {
        // Global stage
        let newStatus: StageStatus = useSessionStore.getState().globalExtractionStage;
        if (event.type === "STAGE_START") {
          newStatus = { kind: "running", completedPages: 0, totalPages: event.total || 1 };
        } else if (event.type === "STAGE_PROGRESS") {
          const total = newStatus.kind === "running" ? newStatus.totalPages : 1;
          newStatus = { kind: "running", completedPages: event.completed, totalPages: total };
        } else if (event.type === "STAGE_DONE") {
          newStatus = { kind: "done", durationMs: event.durationMs };
        } else if (event.type === "STAGE_ERROR") {
          newStatus = { kind: "failed", message: event.message, retryable: event.retryable };
        }
        setGlobalExtractionStage(newStatus);
      }
    }, { rasterizeFile });

    let isCancelled = false;
    const runBatch = async () => {
      // 1. Run global extraction
      const extRes = await orchestrator.runGlobalExtraction(questionFile);
      if (isCancelled) return;
      if (!extRes) return; // failed global extraction

      // 2. Loop students sequentially
      for (const student of students) {
        if (isCancelled) return;
        setCurrentStudentId(student.id);
        
        // Skip if already successfully graded (in case of retries later)
        if (student.stages.grading.kind === "done") continue;
        
        if (!student.answerFile) {
           updateStudent(student.id, { error: "Missing answer file" });
           continue;
        }

        await orchestrator.runStudentPipeline(
          student.id,
          student.answerFile,
          extRes.allQuestions,
          extRes.optionGroups || [],
          settings
        );
      }

      if (!isCancelled) {
        setBatchFinished(true);
        router.push("/results");
      }
    };

    runBatch();

    return () => {
      isCancelled = true;
      orchestrator.cancel();
    };
  }, []); // Only run once on mount

  const anyFailed = globalExtractionStage.kind === "failed" || students.some(s => Object.values(s.stages).some(st => st.kind === "failed"));
  const isGlobalRunning = globalExtractionStage.kind === "running" || globalExtractionStage.kind === "idle";
  
  return (
    <div className="h-full bg-surface-card rounded-[--radius-pane] flex flex-col items-center pt-24 px-6 overflow-y-auto">
      <div className="flex flex-col items-center gap-5 text-center w-full max-w-2xl">
        <SparkleCluster animate={!batchFinished && !anyFailed} />

        <div>
          <h2 className="text-[22px] font-[700] leading-[30px] text-text-body">
            {isGlobalRunning ? "Extracting Question Paper..." : "Grading Class Batch..."}
          </h2>
          <p className="text-[15px] text-text-meta mt-1">This may take a while depending on class size</p>
        </div>

        {globalExtractionStage.kind === "failed" && (
          <div className="text-red-500 font-medium">Question extraction failed. Please try again.</div>
        )}

        <div className="w-full flex flex-col gap-2 mt-8">
          <div className="flex justify-between items-center px-4 py-2 bg-surface-dark rounded-md border border-border-default">
            <span className="font-medium text-sm">Question Paper</span>
            {globalExtractionStage.kind === "running" && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
            {globalExtractionStage.kind === "done" && <Check className="w-4 h-4 text-green-500" />}
            {globalExtractionStage.kind === "failed" && <XCircle className="w-4 h-4 text-red-500" />}
          </div>

          <h3 className="text-sm font-semibold text-text-body mt-4 text-left px-2">Student Queue ({students.length})</h3>
          {students.map((s) => {
            const isProcessing = s.id === currentStudentId && s.stages.grading.kind !== "done";
            const isDone = s.stages.grading.kind === "done";
            const isFailed = Object.values(s.stages).some(st => st.kind === "failed") || s.error;

            return (
              <div key={s.id} className="flex justify-between items-center px-4 py-2 bg-surface-app rounded-md border border-border-default">
                <span className="text-sm truncate max-w-[200px]">{s.filename}</span>
                <div className="flex items-center gap-2">
                  {isProcessing && <span className="text-xs text-text-muted">Processing...</span>}
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
                  {isDone && <Check className="w-4 h-4 text-green-500" />}
                  {isFailed && <span title={s.error || "Failed"}><XCircle className="w-4 h-4 text-red-500" /></span>}
                  {isFailed && (
                    <button className="text-xs bg-accent text-white px-2 py-1 rounded" onClick={() => {
                        // In a real app we would wire this to re-run the student
                    }}>Retry</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

