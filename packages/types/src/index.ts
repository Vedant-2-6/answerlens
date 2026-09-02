// @answerlens/types — canonical session entity shapes
// ALL imports in the monorepo come from here. Do not redefine these interfaces elsewhere.

// ─── Coordinate System ───────────────────────────────────────────────────────

/**
 * Normalized rectangle. All values are fractions of the page dimensions (0–1).
 * Invariant: x + w <= 1, y + h <= 1.
 * Pixel conversion happens ONLY in RegionOverlay at render time.
 */
export interface NormRect {
  x: number; // left edge as fraction of page width
  y: number; // top edge as fraction of page height
  w: number; // width as fraction of page width
  h: number; // height as fraction of page height
}

export interface NormRectWithPage extends NormRect {
  pageIndex: number; // 0-indexed absolute page number within the document
}

// ─── OCR Output ──────────────────────────────────────────────────────────────

export interface OcrWord {
  text: string;
  box: NormRect;
  pageIndex: number; // 0-indexed
  conf: number;      // Tesseract confidence 0–100
}

export interface OcrPage {
  pageIndex: number;
  words: OcrWord[];
  rawText: string;   // whitespace-joined, for LLM context
  width: number;     // pixel width used for normalisation (diagnostic only)
  height: number;    // pixel height used for normalisation (diagnostic only)
}

// ─── Vision Output ───────────────────────────────────────────────────────────

export interface VisionBlock {
  index: number;
  kind: "answer" | "rough-work" | "label-only" | "diagram" | "page-meta" | "strike-through" | string;
  label: string | null;
  approxTopFraction: number;
  approxBottomFraction: number;
  text: string;
  finalAnswerText?: string | null;
  continuedFromPrevious?: boolean;
  continuesToNextPage?: boolean;
}

export interface VisionPage {
  pageIndex: number;
  blocks: VisionBlock[];
}

// ─── Questions ───────────────────────────────────────────────────────────────

export interface Question {
  id: string;           // stable, URL-safe: "Q1", "Q2", "Q11a", "Q11b"
  labelRaw: string;     // verbatim as printed: "11 (a)", "2.", "Q.3"
  text: string;         // question body, max 600 chars
  maxMarks: number | null; // null if not printed
  pageIndex: number;    // page where the question header appears
  isSubPart: boolean;
  parentId: string | null; // "Q11" for sub-parts, null for top-level
  optionGroupId?: string | null;
}

// ─── Pipeline Stage Status ───────────────────────────────────────────────────

export type StageKind = "ocr" | "extraction" | "vision" | "mapping" | "grading";

export type StageStatus =
  | { kind: "idle" }
  | { kind: "running"; completedPages: number; totalPages: number }
  | { kind: "done"; durationMs: number }
  | { kind: "failed"; message: string; retryable: boolean };

// ─── Mapping ─────────────────────────────────────────────────────────────────

export interface MappingResult {
  questionId: string;
  regions: NormRectWithPage[]; // max MAX_REGIONS = 4
  tier: "exact" | "approximate";
  confidence: number;          // 0–1, five-term weighted
  transcription: string;
  labelEvidence: number;       // 0–1 sub-score
  semanticEvidence: number;    // 0–1 sub-score
  orderEvidence: number;       // 0–1 sub-score
  suppressed: boolean;         // true when confidence < REVIEW_THRESHOLD (0.50)
  finalAnswerText?: string | null;
}

export interface OrphanRegion {
  regions: NormRectWithPage[];
  transcription: string;
  confidence: number;
}

// ─── Grading ─────────────────────────────────────────────────────────────────

export type Verdict = "full" | "partial" | "zero";
export type QualitativeLabel = "Correct" | "Partial" | "Incorrect" | "Needs review";

export interface RubricPoint {
  id: string;
  text: string;
  weight: number;    // marks allocated to this point
  required: boolean; // if true and unmet, total marks forced to 0
}

export interface RubricVerdict {
  pointId: string;
  verdict: "met" | "partial" | "unmet";
  justification: string; // one sentence naming the specific evidence
}

export interface GradingResult {
  questionId: string;
  marks: number | null;       // null in qualitative mode
  maxMarks: number | null;
  verdict: Verdict;
  qualitative: QualitativeLabel | null; // null in quantitative mode
  feedback: string;           // max 2 sentences, deterministic from rubric verdicts
  rubricVerdicts: RubricVerdict[];
  suppressed: boolean;        // true when mapping.confidence < 0.50 (grading skipped)
  provisional: boolean;       // always true in raw results, toggled later in UI
  countedTowardTotal?: boolean;
}

export interface PaperSummary {
  themes: string[];   // 2–3 recurring missed themes
  summary: string;    // 3-sentence paragraph
}

// ─── Option Groups ───────────────────────────────────────────────────────────

export interface OptionGroup {
  id: string;
  memberQuestionIds: string[];
  requiredCount: number;
  instructionRaw: string;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export type GradingMode = "quantitative" | "qualitative";

export interface StudentSession {
  id: string; // generated
  filename: string;
  answerFile?: any; // Note: Not persisted
  answerPages: OcrPage[];
  visionPages: VisionPage[];
  mappings: MappingResult[];
  gradings: GradingResult[];
  orphans: OrphanRegion[];
  stages: Record<StageKind, StageStatus>;
  error?: string | null;
  corrections?: Record<string, { type: 'mapping' | 'grading'; notes: string }>;
}

export interface ClassSession {
  id: string; // crypto.randomUUID()
  questions: Question[];
  questionPages: OcrPage[];
  paperMaxMarks: number | null;
  mode: GradingMode | null; // derived once extraction completes
  createdAt: number; // Date.now()
  optionGroups?: OptionGroup[];
  estimatedGradeLevel?: string | null;
  subjectArea?: string | null;
  students: StudentSession[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Exhaustiveness check for discriminated union switches. */
export function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

export interface GradingSettings {
  focus: 'answer' | 'steps';
  allowPartial: boolean;
}

