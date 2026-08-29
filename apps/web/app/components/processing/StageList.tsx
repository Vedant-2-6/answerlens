"use client";
import { useState } from "react";
import type { StageKind, StageStatus } from "@answerlens/types";
import { CheckCircle2, XCircle, Circle, Loader2, ChevronDown, ChevronRight } from "lucide-react";

const STAGE_LABELS: Record<StageKind, string> = {
  ocr:        "Reading files",
  extraction: "Extracting questions",
  vision:     "Analysing answer sheet",
  mapping:    "Mapping answers",
  grading:    "Grading",
};

const STAGE_DESCRIPTIONS: Record<StageKind, string> = {
  ocr:        "Rasterizing documents and extracting raw text from images via OCR.",
  extraction: "Using AI to locate and structure questions from the question paper.",
  vision:     "Using AI to detect handwriting blocks and drawings on the answer sheet.",
  mapping:    "Aligning the student's handwritten answers to the correct questions.",
  grading:    "Evaluating the answers against the generated rubric to assign marks.",
};

const STAGE_ORDER: StageKind[] = ["ocr", "extraction", "vision", "mapping", "grading"];

interface StageListProps {
  stages: Record<StageKind, StageStatus>;
}

export function StageList({ stages }: StageListProps) {
  const [expandedStage, setExpandedStage] = useState<StageKind | null>(null);

  return (
    <div className="flex flex-col gap-2 w-full max-w-xs">
      {STAGE_ORDER.map((key) => {
        const s = stages[key];
        const label = STAGE_LABELS[key];
        const desc = STAGE_DESCRIPTIONS[key];
        
        const isDone    = s.kind === "done";
        const isActive  = s.kind === "running";
        const isFailed  = s.kind === "failed";
        const isPending = s.kind === "idle";
        const isExpanded = expandedStage === key;

        return (
          <div key={key} className="flex flex-col gap-1">
            <button 
              onClick={() => setExpandedStage(isExpanded ? null : key)}
              className="flex items-center gap-3 text-left w-full hover:bg-black/5 p-1 -ml-1 rounded transition-colors"
            >
              {/* Status dot */}
              <span className="w-4 h-4 flex items-center justify-center shrink-0">
                {isDone   && <CheckCircle2 size={16} className="text-[#34ac15]" />}
                {isFailed && <XCircle      size={16} className="text-[#c0350a]" />}
                {isActive && (
                  <Loader2 size={16} className="text-accent animate-spin" />
                )}
                {isPending && <Circle size={14} className="text-text-muted" />}
              </span>

              {/* Label */}
              <span className={[
                "text-sm flex-1",
                isDone    ? "text-text-body"             : "",
                isActive  ? "text-text-body font-medium" : "",
                isFailed  ? "text-[#c0350a]"             : "",
                isPending ? "text-text-muted"             : "",
              ].filter(Boolean).join(" ")}>
                {label}
                {isActive && s.completedPages > 0 && (
                  <span className="text-text-muted text-xs ml-2">
                    page {s.completedPages} of {s.totalPages}
                  </span>
                )}
                {isFailed && (
                  <span className="text-xs ml-2">— {s.message}</span>
                )}
              </span>

              <span className="text-text-muted opacity-50 shrink-0">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            
            {/* Internal Details Accordion */}
            {isExpanded && (
              <div className="pl-8 pr-2 py-1 text-xs text-text-muted animate-in fade-in slide-in-from-top-1">
                <p className="mb-1">{desc}</p>
                {isActive && (
                  <p className="font-mono text-[10px] text-accent">
                    &gt; Processing {s.completedPages > 0 ? `page ${s.completedPages}` : 'initialization'}...
                  </p>
                )}
                {isDone && (
                  <p className="font-mono text-[10px] text-[#34ac15]">
                    &gt; Completed successfully.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}