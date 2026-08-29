"use client";
import type { StageKind, StageStatus } from "@answerlens/types";
import { CheckCircle2, XCircle, Circle, Loader2 } from "lucide-react";

const STAGE_LABELS: Record<StageKind, string> = {
  ocr:        "Reading files",
  extraction: "Extracting questions",
  vision:     "Analysing answer sheet",
  mapping:    "Mapping answers",
  grading:    "Grading",
};

const STAGE_ORDER: StageKind[] = ["ocr", "extraction", "vision", "mapping", "grading"];

interface StageListProps {
  stages: Record<StageKind, StageStatus>;
}

export function StageList({ stages }: StageListProps) {
  return (
    <div className="flex flex-col gap-2 w-full max-w-xs">
      {STAGE_ORDER.map((key) => {
        const s = stages[key];
        const label = STAGE_LABELS[key];

        const isDone    = s.kind === "done";
        const isActive  = s.kind === "running";
        const isFailed  = s.kind === "failed";
        const isPending = s.kind === "idle";

        return (
          <div key={key} className="flex items-center gap-3">
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
              "text-sm",
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
          </div>
        );
      })}
    </div>
  );
}