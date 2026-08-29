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
    
    const baseUrl = process.env.OMNIROUTE_BASE_URL;
    const apiKey = process.env.OMNIROUTE_API_KEY;
    const model = process.env.OMNIROUTE_VISION_MODEL || process.env.OMNIROUTE_EXTRACTION_MODEL;
    
    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json({ error: "Missing OmniRoute environment variables" }, { status: 500 });
    }

    if (process.env.USE_STUBS === "true") {
      return NextResponse.json({
        pageIndex: page.pageIndex,
        pageEmpty: false,
        orientationSuspect: false,
        blocks: [
          {
            index: 0,
            kind: 'answer',
            text: "Stub answer text",
            label: "1",
            note: null,
            illegibleSpans: 0,
            approxTopFraction: 0.1,
            approxBottomFraction: 0.3,
            continuedFromPrevious: false,
            continuesToNextPage: false
          }
        ]
      });
    }

    const result = await extractAnswerPage(page as OcrPage, imageBase64, baseUrl, apiKey, model);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("[POST /api/extract/answer-page] Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}