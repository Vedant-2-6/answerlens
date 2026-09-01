import { NextResponse } from "next/server";
import { z } from "zod";
import { extractQuestions } from "@answerlens/extraction";
import type { OcrPage } from "@answerlens/types";

const NormRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

const OcrWordSchema = z.object({
  text: z.string(),
  box: NormRectSchema,
  pageIndex: z.number(),
  conf: z.number(),
});

const OcrPageSchema = z.object({
  pageIndex: z.number(),
  words: z.array(OcrWordSchema),
  rawText: z.string(),
  width: z.number(),
  height: z.number(),
});

const ExtractRequestSchema = z.object({
  pages: z.array(OcrPageSchema),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = ExtractRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    const { pages } = parsed.data;

    let result: any;
    if (process.env.USE_STUBS === "true") {
      result = {
        questions: [
          { labelRaw: "1.", parentLabel: null, depth: 0, text: "Stub question", marks: 2, answerable: true, uncertain: false, sourceLines: ["p1:l1"] }
        ],
        sections: [],
        choiceGroups: [],
        paperMaxMarks: 20,
        suspicious: []
      };
    } else {
      result = await extractQuestions(pages as OcrPage[]);
    }

    // Transform QuestionCandidate to Question
    const formattedQuestions = (result.questions || []).map((cand: any, idx: number) => {
      // Parse page index from first source line (e.g. "p1:l1" -> 0-indexed page)
      const pageIndexMatch = cand.sourceLines?.[0]?.match(/^p(\d+):l/);
      const pageIndex = pageIndexMatch ? parseInt(pageIndexMatch[1], 10) - 1 : 0;
      
      const parentId = cand.parentLabel ? `Q-${cand.parentLabel.replace(/\s+/g, '-')}` : null;
      // Derive a safe ID
      let id = `Q-${cand.labelRaw.replace(/[^a-zA-Z0-9]/g, '-')}`;
      if (parentId) id = `${parentId}-${cand.labelRaw.replace(/[^a-zA-Z0-9]/g, '-')}`;
      
      // Handle duplicates
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

    return NextResponse.json({ ...result, questions: formattedQuestions });

  } catch (error: any) {
    console.error("[POST /api/extract] Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}