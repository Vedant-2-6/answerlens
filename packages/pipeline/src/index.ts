
import type { Question, VisionPage, MappingResult, GradingResult, StageKind, OcrPage } from "@answerlens/types";
import { ocrPage as localOcrPage, configureOcrLanguages, detectSecondaryLanguage } from "@answerlens/providers";

export type PipelineEvent = 
  | { type: "STAGE_START"; stage: StageKind; total?: number; studentId?: string }
  | { type: "STAGE_PROGRESS"; stage: StageKind; completed: number; studentId?: string }
  | { type: "STAGE_DONE"; stage: StageKind; durationMs: number; studentId?: string }
  | { type: "STAGE_ERROR"; stage: StageKind; message: string; retryable: boolean; studentId?: string }
  | { type: "EXTRACTION_RESULTS"; questions: Question[]; paperMaxMarks: number | null; optionGroups?: any[]; estimatedGradeLevel?: string | null; subjectArea?: string | null }
  | { type: "STUDENT_RESULTS"; studentId: string; visionPages: VisionPage[]; mappings: MappingResult[]; gradings: GradingResult[] };

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
  private activeStage: StageKind = "ocr";

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

  // Cache to avoid re-running identical API calls (e.g. grading chunks on retry)
  private static responseCache = new Map<string, any>();

  private async hashPayload(payload: string): Promise<string> {
    if (typeof crypto === "undefined" || !crypto.subtle) {
      // Fallback for non-browser/unsupported environments
      let hash = 0;
      for (let i = 0; i < payload.length; i++) {
        hash = ((hash << 5) - hash) + payload.charCodeAt(i);
        hash = hash & hash; 
      }
      return hash.toString();
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async callApi(route: string, body: unknown): Promise<any> {
    const payloadString = JSON.stringify(body);
    const hash = await this.hashPayload(`${route}:${payloadString}`);
    
    if (PipelineOrchestrator.responseCache.has(hash)) {
      console.log(`[Pipeline] Cache hit for ${route}`);
      return PipelineOrchestrator.responseCache.get(hash);
    }

    const res = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payloadString,
    });
    
    if (!res.ok) {
      let text = res.statusText;
      try {
        const bodyText = await res.text();
        if (bodyText) text = bodyText;
      } catch (e) {}
      throw new Error(`[${route}] ${res.status}: ${text}`);
    }
    
    const jsonRes = await res.json();
    PipelineOrchestrator.responseCache.set(hash, jsonRes);
    return jsonRes;
  }

  async runGlobalExtraction(questionFile: File) {
    try {
      if (this.isCancelled) return null;

      // Stage 0: Rasterize
      this.activeStage = "ocr";
      const t_ocr = performance.now();
      this.onEvent({ type: "STAGE_START", stage: "ocr", total: 1 });
      await new Promise(r => setTimeout(r, 50));
      const qPages = await this.deps.rasterizeFile(questionFile);
      if (this.isCancelled) return null;

      // Stage 1: OCR
      this.onEvent({ type: "STAGE_START", stage: "ocr", total: qPages.length });
      let ocrDone = 0;
      const qOcr = await this.asyncPool(3, qPages, async (p: RasterizedPage) => {
        const res = await localOcrPage({
          imageBase64: p.base64,
          mimeType: "image/jpeg",
          pageIndex: p.pageIndex,
          width: p.width,
          height: p.height,
        });
        ocrDone++;
        this.onEvent({ type: "STAGE_PROGRESS", stage: "ocr", completed: ocrDone });
        return { ocrPage: res as OcrPage, base64: p.base64 };
      });
      this.onEvent({ type: "STAGE_DONE", stage: "ocr", durationMs: Math.round(performance.now() - t_ocr) });
      if (this.isCancelled) return null;
      
      // Auto-detect secondary language (e.g., Hindi, Gujarati)
      const combinedText = qOcr.map(q => q.ocrPage.rawText).join(" ");
      const secLang = detectSecondaryLanguage(combinedText);
      if (secLang) {
        console.log(`[Pipeline] Detected secondary language: ${secLang}. Pre-warming workers...`);
        // We do not wait for this to finish to avoid blocking extraction!
        // It will run in the background and swap the workers before student OCR.
        configureOcrLanguages(`eng+${secLang}`).catch(console.error);
      }

      // Stage 2: Extraction
      this.activeStage = "extraction";
      const t_extraction = performance.now();
      const extChunkSize = 2;
      const extChunks = [];
      for (let i = 0; i < qOcr.length; i += extChunkSize) {
        extChunks.push(qOcr.slice(i, i + extChunkSize));
      }
      this.onEvent({ type: "STAGE_START", stage: "extraction", total: qOcr.length });
      
      let completedExtPages = 0;
      const extResults = await this.asyncPool(2, extChunks, async (chunk) => {
        const res = await this.callApi("/api/extract", { pages: chunk.map(q => q.ocrPage) });
        completedExtPages += chunk.length;
        this.onEvent({ type: "STAGE_PROGRESS", stage: "extraction", completed: completedExtPages });
        return res;
      });

      let mergedCandidates: any[] = [];
      let mergedChoiceGroups: any[] = [];
      let paperMaxMarks: number | null = null;
      let estimatedGradeLevel: string | null = null;
      let subjectArea: string | null = null;

      for (const res of extResults) {
        mergedCandidates.push(...(res.questions || []));
        mergedChoiceGroups.push(...(res.choiceGroups || []));
        if (paperMaxMarks === null && res.paperMaxMarks != null) paperMaxMarks = res.paperMaxMarks;
        if (estimatedGradeLevel === null && res.estimatedGradeLevel != null) estimatedGradeLevel = res.estimatedGradeLevel;
        if (subjectArea === null && res.subjectArea != null) subjectArea = res.subjectArea;
      }

      const allQuestions: Question[] = mergedCandidates.map((cand: any, idx: number) => {
        const pageIndexMatch = cand.sourceLines?.[0]?.match(/^p(\d+):l/);
        const pageIndex = pageIndexMatch ? parseInt(pageIndexMatch[1], 10) - 1 : 0;
        const parentId = cand.parentLabel ? `Q-${cand.parentLabel.replace(/\s+/g, "-")}` : null;
        let id = `Q-${cand.labelRaw.replace(/[^a-zA-Z0-9]/g, "-")}`;
        if (parentId) id = `${parentId}-${cand.labelRaw.replace(/[^a-zA-Z0-9]/g, "-")}`;
        id = `${id}-${idx}`;
        return {
          id,
          labelRaw: cand.labelRaw,
          text: cand.text,
          maxMarks: cand.marks,
          pageIndex: Math.max(0, pageIndex),
          isSubPart: cand.depth > 0,
          parentId
        };
      });

      const optionGroups: any[] = [];
      mergedChoiceGroups.forEach((cg: any, idx: number) => {
        const ogId = `og-${idx}`;
        const memberQuestionIds: string[] = [];
        cg.memberLabels.forEach((label: string) => {
          const matchedQ = allQuestions.find(q => q.labelRaw.trim() === label.trim());
          if (matchedQ) {
            matchedQ.optionGroupId = ogId;
            memberQuestionIds.push(matchedQ.id);
          }
        });
        if (memberQuestionIds.length > 0) {
          optionGroups.push({
            id: ogId,
            memberQuestionIds,
            requiredCount: cg.requiredCount,
            instructionRaw: cg.sourceText || ""
          });
        }
      });

      this.onEvent({ type: "STAGE_DONE", stage: "extraction", durationMs: Math.round(performance.now() - t_extraction) });
      
      this.onEvent({
        type: "EXTRACTION_RESULTS",
        questions: allQuestions,
        paperMaxMarks,
        optionGroups,
        estimatedGradeLevel,
        subjectArea,
      });

      return { allQuestions, optionGroups };
    } catch (e: any) {
      if (!this.isCancelled) {
        console.error("[Pipeline] fatal extraction error:", e);
        this.onEvent({ type: "STAGE_ERROR", stage: this.activeStage, message: e?.message ?? "Unknown error", retryable: true });
      }
      return null;
    }
  }

  async runStudentPipeline(studentId: string, answerFile: File, allQuestions: Question[], optionGroups: any[], settings?: any) {
    try {
      if (this.isCancelled) return null;

      // Stage 0: Rasterize
      this.activeStage = "ocr";
      const t_ocr = performance.now();
      this.onEvent({ type: "STAGE_START", stage: "ocr", total: 1, studentId });
      const aPages = await this.deps.rasterizeFile(answerFile);
      if (this.isCancelled) return null;

      // Stage 1: OCR
      this.onEvent({ type: "STAGE_START", stage: "ocr", total: aPages.length, studentId });
      let ocrDone = 0;
      const aOcr = await this.asyncPool(3, aPages, async (p: RasterizedPage) => {
        const res = await localOcrPage({
          imageBase64: p.base64,
          mimeType: "image/jpeg",
          pageIndex: p.pageIndex,
          width: p.width,
          height: p.height,
        });
        ocrDone++;
        this.onEvent({ type: "STAGE_PROGRESS", stage: "ocr", completed: ocrDone, studentId });
        return { ocrPage: res as OcrPage, base64: p.base64 };
      });
      this.onEvent({ type: "STAGE_DONE", stage: "ocr", durationMs: Math.round(performance.now() - t_ocr), studentId });
      if (this.isCancelled) return null;

      // Stage 3: Vision
      this.activeStage = "vision";
      const t_vision = performance.now();
      this.onEvent({ type: "STAGE_START", stage: "vision", total: aOcr.length, studentId });
      const allVisionPages: VisionPage[] = [];
      const chunkSize = 3;
      const chunks = [];
      for (let i = 0; i < aOcr.length; i += chunkSize) {
        chunks.push(aOcr.slice(i, i + chunkSize));
      }
      let completedVisionPages = 0;
      const chunkResults = await this.asyncPool(2, chunks, async (chunk) => {
        const pages = chunk.map(c => c.ocrPage);
        const imagesBase64 = chunk.map(c => c.base64);
        const rawVps = await this.callApi("/api/extract/answer-chunk", { pages, imagesBase64 });
        const transformedVps: VisionPage[] = (rawVps as any[]).map(vp => ({
          pageIndex: vp.pageIndex,
          imageQuality: vp.imageQuality || "good",
          blocks: (vp.blocks || []).map((b: any) => ({
            index: b.index ?? 0,
            kind: b.kind || "answer",
            label: b.label || null,
            approxTopFraction: b.approxTopFraction ?? 0,
            approxBottomFraction: b.approxBottomFraction ?? 1,
            text: b.text || "",
            continuedFromPrevious: b.continuedFromPrevious || false,
            continuesToNextPage: b.continuesToNextPage || false,
          })),
        }));
        completedVisionPages += chunk.length;
        this.onEvent({ type: "STAGE_PROGRESS", stage: "vision", completed: completedVisionPages, studentId });
        return transformedVps;
      });
      for (const res of chunkResults) allVisionPages.push(...res);
      allVisionPages.sort((a, b) => a.pageIndex - b.pageIndex);
      
      const unusablePage = allVisionPages.find(p => p.imageQuality === "unusable");
      if (unusablePage) {
        throw new Error(`Page ${unusablePage.pageIndex + 1} is unusable (blurry/dark/cropped). Please re-scan this page.`);
      }
      
      this.onEvent({ type: "STAGE_DONE", stage: "vision", durationMs: Math.round(performance.now() - t_vision), studentId });
      if (this.isCancelled) return null;

      // Stage 4: Mapping
      this.activeStage = "mapping";
      const t_mapping = performance.now();
      this.onEvent({ type: "STAGE_START", stage: "mapping", total: 1, studentId });
      const mapRes = await this.callApi("/api/map", { questions: allQuestions, visionPages: allVisionPages });
      const allMappings: MappingResult[] = mapRes.mappings ?? [];
      this.onEvent({ type: "STAGE_DONE", stage: "mapping", durationMs: Math.round(performance.now() - t_mapping), studentId });
      if (this.isCancelled) return null;

      // Stage 5: Grading
      this.activeStage = "grading";
      const t_grading = performance.now();
      this.onEvent({ type: "STAGE_START", stage: "grading", total: allMappings.length, studentId });
      const gradeItems = allMappings.map(mapping => ({
        mapping,
        question: allQuestions.find(q => q.id === mapping.questionId)
      })).filter(i => !!i.question);

      let allGradings: GradingResult[] = [];
      if (gradeItems.length > 0) {
        const gradeChunkSize = 4;
        const gradeChunks = [];
        for (let i = 0; i < gradeItems.length; i += gradeChunkSize) {
          gradeChunks.push(gradeItems.slice(i, i + gradeChunkSize));
        }
        let completedGradings = 0;
        const gradingChunkResults = await this.asyncPool(2, gradeChunks, async (chunk) => {
          const res = await this.callApi("/api/grade-batch", { items: chunk, settings });
          completedGradings += chunk.length;
          this.onEvent({ type: "STAGE_PROGRESS", stage: "grading", completed: completedGradings, studentId });
          return res as GradingResult[];
        });
        for (const res of gradingChunkResults) allGradings.push(...res);

        for (const r of allGradings) r.countedTowardTotal = true;
        if (optionGroups && optionGroups.length > 0) {
          for (const og of optionGroups) {
            const groupResults = allGradings.filter(r => og.memberQuestionIds.includes(r.questionId));
            groupResults.sort((a, b) => {
              const ratioA = a.maxMarks ? (a.marks || 0) / a.maxMarks : 0;
              const ratioB = b.maxMarks ? (b.marks || 0) / b.maxMarks : 0;
              return ratioB - ratioA;
            });
            groupResults.forEach((r, idx) => {
              r.countedTowardTotal = idx < og.requiredCount;
            });
          }
        }
      }
      this.onEvent({ type: "STAGE_DONE", stage: "grading", durationMs: Math.round(performance.now() - t_grading), studentId });

      this.onEvent({
        type: "STUDENT_RESULTS",
        studentId,
        visionPages: allVisionPages,
        mappings: allMappings,
        gradings: allGradings,
      });

      return { allVisionPages, allMappings, allGradings };
    } catch (e: any) {
      if (!this.isCancelled) {
        console.error(`[Pipeline] fatal student ${studentId} error:`, e);
        this.onEvent({ type: "STAGE_ERROR", stage: this.activeStage, message: e?.message ?? "Unknown error", retryable: true, studentId });
      }
      return null;
    }
  }
}

