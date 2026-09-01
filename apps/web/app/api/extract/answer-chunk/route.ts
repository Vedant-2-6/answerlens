import { NextResponse } from "next/server";
import { extractAnswerPagesChunk } from "@answerlens/extraction";
import type { OcrPage } from "@answerlens/types";

export async function POST(req: Request) {
  try {
    const { pages, imagesBase64 } = await req.json() as { pages: OcrPage[], imagesBase64: string[] };

    if (!pages || !imagesBase64 || pages.length !== imagesBase64.length) {
      return NextResponse.json({ error: "Invalid pages or imagesBase64 array" }, { status: 400 });
    }

    if (process.env.USE_STUBS === "true") {
      // Mock logic here
      return NextResponse.json(
        pages.map(p => ({
          pageIndex: p.pageIndex,
          pageEmpty: false,
          orientationSuspect: false,
          blocks: [
            {
              index: 0,
              kind: "answer",
              text: "Stubbed answer for page " + p.pageIndex,
              label: "Q1",
              note: null,
              approxTopFraction: 0.1,
              approxBottomFraction: 0.2,
              illegibleSpans: 0,
              continuedFromPrevious: false,
              continuesToNextPage: false
            }
          ]
        }))
      );
    }

    const result = await extractAnswerPagesChunk(pages, imagesBase64);
    return NextResponse.json(result.pages);
  } catch (error: any) {
    console.error("[POST /api/extract/answer-chunk] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
