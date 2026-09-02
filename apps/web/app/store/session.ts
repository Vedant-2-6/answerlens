
import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";
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
  StudentSession,
  OptionGroup
} from "@answerlens/types";

interface SessionState {
  // Global class state
  questionFile: File | null;
  questionPages: OcrPage[];
  questions: Question[];
  paperMaxMarks: number | null;
  mode: GradingMode | null;
  optionGroups?: OptionGroup[];
  estimatedGradeLevel: string | null;
  subjectArea: string | null;
  globalExtractionStage: StageStatus;

  // Setters for global
  setQuestionFile: (f: File | null) => void;
  setQuestionPages: (p: OcrPage[]) => void;
  setQuestions: (q: Question[]) => void;
  setPaperMaxMarks: (n: number | null) => void;
  setMode: (m: GradingMode) => void;
  setOptionGroups: (og: OptionGroup[]) => void;
  setEstimatedGradeLevel: (g: string | null) => void;
  setSubjectArea: (s: string | null) => void;
  setGlobalExtractionStage: (status: StageStatus) => void;

  // Array of students
  students: StudentSession[];
  
  // UI selection
  activeStudentId: string | null;
  setActiveStudent: (id: string | null) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;

  // Per-student setters
  addStudent: (s: StudentSession) => void;
  updateStudent: (id: string, partial: Partial<StudentSession>) => void;
  removeStudent: (id: string) => void;

  // Current student interactions (MappingScreen)
  selectedQuestionId: string | null;
  selectQuestion: (id: string | null) => void;
  setCorrection: (qid: string, correction: { type: "mapping" | "grading"; notes: string } | null) => void;

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

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      questionFile: null,
      questionPages: [],
      questions: [],
      paperMaxMarks: null,
      mode: null,
      optionGroups: [],
      estimatedGradeLevel: null,
      subjectArea: null,
      globalExtractionStage: { kind: "idle" },

      setQuestionFile: (f) => set({ questionFile: f }),
      setQuestionPages: (p) => set({ questionPages: p }),
      setQuestions: (q) => set({ questions: q }),
      setPaperMaxMarks: (n) => set({ paperMaxMarks: n }),
      setMode: (m) => set({ mode: m }),
      setOptionGroups: (og) => set({ optionGroups: og }),
      setEstimatedGradeLevel: (g) => set({ estimatedGradeLevel: g }),
      setSubjectArea: (s) => set({ subjectArea: s }),
      setGlobalExtractionStage: (status) => set({ globalExtractionStage: status }),

      students: [],
      activeStudentId: null,
      setActiveStudent: (id) => set({ activeStudentId: id }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

      addStudent: (student) => set((state) => ({ students: [...state.students, student] })),
      updateStudent: (id, partial) => set((state) => ({
        students: state.students.map(s => s.id === id ? { ...s, ...partial } : s)
      })),
      removeStudent: (id) => set((state) => ({
        students: state.students.filter(s => s.id !== id),
        activeStudentId: state.activeStudentId === id ? null : state.activeStudentId
      })),

      selectedQuestionId: null,
      selectQuestion: (id) => set({ selectedQuestionId: id }),
      setCorrection: (qid, correction) => set((state) => {
        const student = state.students.find(s => s.id === state.activeStudentId);
        if (!student) return state;
        const next = { ...(student.corrections || {}) };
        if (correction) {
          next[qid] = correction;
        } else {
          delete next[qid];
        }
        return {
          students: state.students.map(s => s.id === student.id ? { ...s, corrections: next } : s)
        };
      }),

      reset: () =>
        set({
          questionFile: null,
          questionPages: [],
          questions: [],
          paperMaxMarks: null,
          mode: null,
          optionGroups: [],
          estimatedGradeLevel: null,
          subjectArea: null,
          globalExtractionStage: { kind: "idle" },
          students: [],
          activeStudentId: null,
          sidebarCollapsed: false,
          selectedQuestionId: null,
        }),
    }),
    {
      name: "answerlens-class-session",
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => Object.fromEntries(
        Object.entries(state).filter(([key]) => !["questionFile"].includes(key))
      ) as any,
    }
  )
);

