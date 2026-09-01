import { NextResponse } from "next/server";

import { getLLMCredentials } from "@answerlens/providers";

/**
 * GET /api/health
 * Called by UploadScreen on mount to check provider availability.
 * Returns {ocr, llm, stub} — a degraded provider shows a banner but does not block upload.
 */
export async function GET() {
  const useStubs = process.env.USE_STUBS === "true";
  const ocrProvider = process.env.OCR_PROVIDER ?? "tesseract";

  let ocrStatus: "ok" | "error" = "ok";
  let llmStatus: "ok" | "error" = "ok";

  if (!useStubs) {
    if (ocrProvider !== "tesseract") {
      ocrStatus = "error";
    }

    try {
      getLLMCredentials();
    } catch (err) {
      llmStatus = "error";
    }
  }

  return NextResponse.json(
    { ocr: ocrStatus, llm: llmStatus, stub: useStubs },
    {
      headers: {
        "Cache-Control": "no-cache, no-store",
      },
    }
  );
}
