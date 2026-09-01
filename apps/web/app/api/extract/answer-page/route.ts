import { NextResponse } from "next/server";
import { z } from "zod";
import { extractAnswerPage } from "@answerlens/extraction";
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

const AnswerRequestSchema = z.object({
  page: OcrPageSchema,
  imageBase64: z.string()
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = AnswerRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { page, imageBase64 } = parsed.data;
    
    let result: any;
    if (process.env.USE_STUBS === "true") {
      result = {
        pageIndex: page.pageIndex,
        pageEmpty: false,
        orientationSuspect: false,
        blocks: [{ text: "Stub answer text", approxTopFraction: 0, approxBottomFraction: 1, kind: "answer" }]
      };
    } else {
      result = await extractAnswerPage(page as OcrPage, imageBase64);
    }

    const transcription = (result.blocks || [])
      .filter((b: any) => b.kind === "answer" || b.kind === "rough-work")
      .map((b: any) => b.text)
      .join("\n\n");

    const approximate_regions = (result.blocks || [])
      .filter((b: any) => b.kind === "answer" || b.kind === "rough-work")
      .map((b: any) => ({
        x: 0,
        y: b.approxTopFraction,
        w: 1,
        h: Math.max(0.1, b.approxBottomFraction - b.approxTopFraction)
      }));

    return NextResponse.json({
      pageIndex: page.pageIndex,
      transcription,
      approximate_regions
    });

  } catch (error: any) {
    console.error("[POST /api/extract/answer-page] Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
