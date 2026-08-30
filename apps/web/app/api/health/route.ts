import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Called by UploadScreen on mount to check provider availability.
 * Returns {ocr, llm, stub} — a degraded provider shows a banner but does not block upload.
 */
export async function GET() {
  const useStubs = process.env.USE_STUBS === "true";
  const ocrProvider = process.env.OCR_PROVIDER ?? "tesseract";
  const omniRouteUrl = process.env.AI_BASE_URL;
  const omniRouteKey = process.env.AI_API_KEY;

  let ocrStatus: "ok" | "error" = "ok";
  let llmStatus: "ok" | "error" = "ok";

  if (!useStubs) {
    // Check OCR — Tesseract.js runs locally, always available when the function is warm
    // We do a lightweight check: just ensure the env is set correctly
    if (ocrProvider !== "tesseract") {
      ocrStatus = "error";
    }

    // Check LLM — verify env variables are set
    if (!omniRouteUrl || !omniRouteKey) {
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
