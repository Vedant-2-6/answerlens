import type { Question, VisionPage, MappingResult, GradingResult, StageKind, OcrPage } from "@answerlens/types";

export type PipelineEvent = 
  | { type: "STAGE_START"; stage: StageKind; total?: number }
  | { type: "STAGE_PROGRESS"; stage: StageKind; completed: number }
  | { type: "STAGE_DONE"; stage: StageKind; durationMs: number }
  | { type: "STAGE_ERROR"; stage: StageKind; message: string; retryable: boolean }
  | { type: "RESULTS"; questions: Question[]; visionPages: VisionPage[]; mappings: MappingResult[]; gradings: GradingResult[] };

export interface RasterizedPage {
  pageIndex: number;
  base64: string;
  width: number;
  height: number;
}

export interface PipelineDependencies {
  rasterizeFile: (file: File) => Promise<RasterizedPage[]>;
}

export class PipelineOrchestrator {
  private onEvent: (event: PipelineEvent) => void;
  private deps: PipelineDependencies;
  private isCancelled = false;
  private activeStage: StageKind = "ocr"; // track it

  constructor(onEvent: (event: PipelineEvent) => void, deps: PipelineDependencies) {
    this.onEvent = onEvent;
    this.deps = deps;
  }

  cancel() { this.isCancelled = true; }

  private async asyncPool<T, R>(concurrency: number, items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    const executing: Set<Promise<void>> = new Set();
    
    let i = 0;
    for (const item of items) {
      if (this.isCancelled) throw new Error("Cancelled");
      const index = i++;
      const p = fn(item).then(res => { results[index] = res; });
      executing.add(p);
      
      const clean = p.finally(() => executing.delete(p));
      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);
    return results;
  }

  async run(questionFile: File, answerFile: File) {
    try {
      if (this.isCancelled) return;

      // ------------------------------------------------------------------
      // Stage 0: Rasterize PDFs/Images → base64 pages in browser
      // ------------------------------------------------------------------
      this.activeStage = "ocr";
      const t_ocr = performance.now();
      this.onEvent({ type: "STAGE_START", stage: "ocr", total: 1 }); // Give immediate UI feedback
      await new Promise(r => setTimeout(r, 50)); // Allow browser to paint the UI update

      const [qPages, aPages] = await Promise.all([
        this.deps.rasterizeFile(questionFile),
        this.deps.rasterizeFile(answerFile),
      ]);

      if (this.isCancelled) return;

      // ------------------------------------------------------------------
      // Stage 1: OCR — send each image to /api/ocr, get OcrPage back
      // ------------------------------------------------------------------
      const total = qPages.length + aPages.length;
      this.onEvent({ type: "STAGE_START", stage: "ocr", total }); // Update with actual total

      let ocrDone = 0;
      const ocrPage = async (p: RasterizedPage) => {
        const res = await this.callApi("/api/ocr", {
          imageBase64: p.base64,
          mimeType: "image/png",
          pageIndex: p.pageIndex,
        });
        ocrDone++;
        this.onEvent({ type: "STAGE_PROGRESS", stage: "ocr", completed: ocrDone });
        return { ocrPage: res as OcrPage, base64: p.base64 };
      };

      // Batch 3 concurrent calls to prevent exhausting browser sockets and API limits
      const allPages = [...qPages, ...aPages];
      const allOcrResults = await this.asyncPool(3, allPages, ocrPage);
      
      const qOcr = allOcrResults.slice(0, qPages.length);
      const aOcr = allOcrResults.slice(qPages.length);

      this.onEvent({ type: "STAGE_DONE", stage: "ocr", durationMs: Math.round(performance.now() - t_ocr) });
      if (this.isCancelled) return;

      // ------------------------------------------------------------------
      // Stage 2: Extract questions from question-paper OCR pages
      //   POST /api/extract  { pages: OcrPage[] }  → { questions: Question[] }
      // ------------------------------------------------------------------
      this.activeStage = "extraction";
      const t_extraction = performance.now();
      this.onEvent({ type: "STAGE_START", stage: "extraction", total: 1 });
      const extractRes = await this.callApi("/api/extract", {
        pages: qOcr.map(q => q.ocrPage),
      });
      const allQuestions: Question[] = extractRes.questions ?? [];
      this.onEvent({ type: "STAGE_DONE", stage: "extraction", durationMs: Math.round(performance.now() - t_extraction) });
      if (this.isCancelled) return;

      // ------------------------------------------------------------------
      // Stage 3: Vision — analyse answer-sheet pages
      //   POST /api/extract/answer-page  { page, imageBase64 }  → VisionPage
      // ------------------------------------------------------------------
      this.activeStage = "vision";
      const t_vision = performance.now();
      this.onEvent({ type: "STAGE_START", stage: "vision", total: aOcr.length });
      const allVisionPages: VisionPage[] = [];
      for (let i = 0; i < aOcr.length; i++) {
        const item = aOcr[i]!;
        const { ocrPage: page, base64 } = item;
        const vp = await this.callApi("/api/extract/answer-page", { page, imageBase64: base64 });
        allVisionPages.push(vp as VisionPage);
        this.onEvent({ type: "STAGE_PROGRESS", stage: "vision", completed: i + 1 });
      }
      this.onEvent({ type: "STAGE_DONE", stage: "vision", durationMs: Math.round(performance.now() - t_vision) });
      if (this.isCancelled) return;

      // ------------------------------------------------------------------
      // Stage 4: Mapping
      //   POST /api/map  { questions, visionPages }  → { mappings }
      // ------------------------------------------------------------------
      this.activeStage = "mapping";
      const t_mapping = performance.now();
      this.onEvent({ type: "STAGE_START", stage: "mapping", total: 1 });
      const mapRes = await this.callApi("/api/map", {
        questions: allQuestions,
        visionPages: allVisionPages,
      });
      const allMappings: MappingResult[] = mapRes.mappings ?? [];
      this.onEvent({ type: "STAGE_DONE", stage: "mapping", durationMs: Math.round(performance.now() - t_mapping) });
      if (this.isCancelled) return;

      // ------------------------------------------------------------------
      // Stage 5: Grading — one call per mapping
      //   POST /api/grade  { mapping }  → GradingResult
      // ------------------------------------------------------------------
      this.activeStage = "grading";
      const t_grading = performance.now();
      this.onEvent({ type: "STAGE_START", stage: "grading", total: allMappings.length });
      const allGradings: GradingResult[] = [];
      for (let i = 0; i < allMappings.length; i++) {
        const gradeRes = await this.callApi("/api/grade", { mapping: allMappings[i] });
        allGradings.push(gradeRes as GradingResult);
        this.onEvent({ type: "STAGE_PROGRESS", stage: "grading", completed: i + 1 });
      }
      this.onEvent({ type: "STAGE_DONE", stage: "grading", durationMs: Math.round(performance.now() - t_grading) });

      // ------------------------------------------------------------------
      // Done — fire RESULTS
      // ------------------------------------------------------------------
      this.onEvent({
        type: "RESULTS",
        questions: allQuestions,
        visionPages: allVisionPages,
        mappings: allMappings,
        gradings: allGradings,
      });

    } catch (e: any) {
      if (!this.isCancelled) {
        console.error("[Pipeline] fatal error:", e);
        this.onEvent({ type: "STAGE_ERROR", stage: this.activeStage, message: e?.message ?? "Unknown error", retryable: true });
      }
    }
  }

  private async callApi(route: string, body: unknown): Promise<any> {
    const res = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let text = res.statusText;
      try {
        const bodyText = await res.text();
        if (bodyText) text = bodyText;
      } catch (e) {
        // Stream already consumed or inaccessible
      }
      throw new Error(`[${route}] ${res.status}: ${text}`);
    }
    return res.json();
  }
}