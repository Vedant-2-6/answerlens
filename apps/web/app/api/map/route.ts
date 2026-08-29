import { NextResponse } from "next/server";
import { computeCostMatrix, solveHungarian, smithWaterman, tokenize } from "@answerlens/mapping";
import type { Question, VisionPage, MappingResult } from "@answerlens/types";

export async function POST(req: Request) {
  try {
    const { questions, visionPages } = await req.json() as { questions: Question[], visionPages: VisionPage[] };

    if (process.env.USE_STUBS === "true") {
      return NextResponse.json({
        mappings: questions.map((q, i) => ({
          questionId: q.id,
          regions: [],
          tier: "approximate",
          confidence: 0.99,
          transcription: "Stub answer for " + q.id,
          labelEvidence: 1,
          semanticEvidence: 1,
          orderEvidence: 1,
          suppressed: false
        })),
        orphans: []
      });
    }

    if (!questions || !visionPages || questions.length === 0 || visionPages.length === 0) {
      return NextResponse.json({ mappings: [], orphans: [] });
    }

    // 1. Compute scores between each question and each vision page transcription
    const numQuestions = questions.length;
    const numGroups = visionPages.length; // Simplified: each page is a "group"
    const scores = Array(numQuestions).fill(0).map(() => Array(numGroups).fill(0));

    for (let i = 0; i < numQuestions; i++) {
      const qTokens = tokenize(questions[i]!.text);
      for (let j = 0; j < numGroups; j++) {
        const vpTokens = tokenize(visionPages[j]!.transcription);
        const alignment = smithWaterman(qTokens, vpTokens);
        // Normalize score between 0 and 1 roughly
        scores[i]![j] = Math.min(alignment.score / (qTokens.length * 2 || 1), 1.0);
      }
    }

    // 2. Build cost matrix and solve Hungarian
    const { matrix, size } = computeCostMatrix(numQuestions, numGroups, scores);
    const assignment = solveHungarian(matrix);

    // 3. Reconstruct mapping results
    const mappings: MappingResult[] = [];
    for (let i = 0; i < numQuestions; i++) {
      const assignedJ = assignment[i]!;
      if (assignedJ < numGroups) { // Valid assignment (not unassigned/orphan)
        const vp = visionPages[assignedJ]!;
        const conf = scores[i]![assignedJ]!;
        mappings.push({
          questionId: questions[i]!.id,
          regions: vp.approximate_regions.map(r => ({ ...r, pageIndex: vp.pageIndex })),
          tier: conf > 0.8 ? "exact" : "approximate",
          confidence: conf,
          transcription: vp.transcription,
          labelEvidence: conf,
          semanticEvidence: conf,
          orderEvidence: 1.0, // simplified
          suppressed: conf < 0.2 // Very low threshold for now
        });
      } else {
        // Unanswered
      }
    }

    return NextResponse.json({ mappings, orphans: [] });
  } catch (error: any) {
    console.error("[POST /api/map] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}