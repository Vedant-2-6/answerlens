import { create } from "zustand";
import type {
  OcrPage,
  Question,
  VisionPage,
  MappingResult,
  GradingResult,
  OrphanRegion,
  StageKind,
  StageStatus,
  GradingMode,
} from "@answerlens/types";

interface SessionState {
  // Upload
  questionFile: File | null;
  answerFile: File | null;
  questionPages: OcrPage[];
  answerPages: OcrPage[];
  setQuestionFile: (f: File | null) => void;
  setAnswerFile: (f: File | null) => void;
  setQuestionPages: (p: OcrPage[]) => void;
  setAnswerPages: (p: OcrPage[]) => void;

  // Pipeline results
  questions: Question[];
  visionPages: VisionPage[];
  mappings: MappingResult[];
  gradings: GradingResult[];
  orphans: OrphanRegion[];
  mode: GradingMode | null;

  // Stage tracking
  stages: Record<StageKind, StageStatus>;
  setStage: (stage: StageKind, status: StageStatus) => void;

  // UI
  selectedQuestionId: string | null;
  selectQuestion: (id: string | null) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;

  // Pipeline setters
  setQuestions: (q: Question[]) => void;
  setVisionPages: (v: VisionPage[]) => void;
  addMapping: (m: MappingResult) => void;
  setMappings: (m: MappingResult[]) => void;
  addGrading: (g: GradingResult) => void;
  setGradings: (g: GradingResult[]) => void;
  setOrphans: (o: OrphanRegion[]) => void;
  setMode: (m: GradingMode) => void;

  // Reset
  reset: () => void;
}

const initialStages: Record<StageKind, StageStatus> = {
  ocr:        { kind: "idle" },
  extraction: { kind: "idle" },
  vision:     { kind: "idle" },
  mapping:    { kind: "idle" },
  grading:    { kind: "idle" },
};

import { persist, createJSONStorage } from "zustand/middleware";

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      questionFile: null,
      answerFile: null,
      questionPages: [],
      answerPages: [],
      setQuestionFile: (f) => set({ questionFile: f }),
      setAnswerFile: (f) => set({ answerFile: f }),
      setQuestionPages: (p) => set({ questionPages: p }),
      setAnswerPages: (p) => set({ answerPages: p }),

      questions: [],
      visionPages: [],
      mappings: [],
      gradings: [],
      orphans: [],
      mode: null,

      stages: initialStages,
      setStage: (stage, status) =>
        set((s) => ({ stages: { ...s.stages, [stage]: status } })),

      selectedQuestionId: null,
      selectQuestion: (id) => set({ selectedQuestionId: id }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

      setQuestions: (q) => set({ questions: q }),
      setVisionPages: (v) => set({ visionPages: v }),
      // For performance in rapid loops, we avoid O(N^2) spread by using push on a slice, though we still need to return a new array reference
      addMapping: (m) => set((s) => { const next = s.mappings.slice(); next.push(m); return { mappings: next }; }),
      setMappings: (m) => set({ mappings: m }),
      addGrading: (g) => set((s) => { const next = s.gradings.slice(); next.push(g); return { gradings: next }; }),
      setGradings: (g) => set({ gradings: g }),
      setOrphans: (o) => set({ orphans: o }),
      setMode: (m) => set({ mode: m }),

      reset: () =>
        set({
          questionFile: null, answerFile: null,
          questionPages: [], answerPages: [],
          questions: [], visionPages: [], mappings: [],
          gradings: [], orphans: [], mode: null,
          stages: initialStages,
          selectedQuestionId: null,
          sidebarCollapsed: false,
        }),
    }),
    {
      name: "answerlens-session",
      storage: createJSONStorage(() => sessionStorage), // Use sessionStorage so it survives soft refreshes but clears on new tabs
      partialize: (state) => Object.fromEntries(
        Object.entries(state).filter(([key]) => !['questionFile', 'answerFile'].includes(key))
      ),
    }
  )
);