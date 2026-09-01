import { NextResponse } from "next/server";
import { mapAnswersLLM } from "@answerlens/mapping";
import type { Question, VisionPage, MappingResult } from "@answerlens/types";

export async function POST(req: Request) {
  try {
    const { questions, visionPages } = await req.json() as { questions: Question[], visionPages: VisionPage[] };

    if (process.env.USE_STUBS === "true") {
      // Simulate that the student only answered 1(a), 1(b), and 2(a)
      const answeredQuestions = questions.slice(0, 3);
      return NextResponse.json({
        mappings: answeredQuestions.map((q, i) => ({
          questionId: q.id,
          regions: [],
          tier: "approximate",
          confidence: 0.99,
          transcription: "Stub answer for " + q.id + "\n\nThis is a simulated student answer.",
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

    const { mappings, orphans } = await mapAnswersLLM(questions, visionPages);

    return NextResponse.json({ mappings, orphans });
  } catch (error: any) {
    console.error("[POST /api/map] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}