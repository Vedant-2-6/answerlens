import { NextResponse } from "next/server";
import { z } from "zod";
import { ocrPage } from "@answerlens/providers";

const Body = z.object({
  imageBase64: z.string().min(100, "imageBase64 too short"),
  mimeType:    z.enum(["image/png", "image/jpeg"]),
  pageIndex:   z.number().int().min(0),
  width:       z.number().int().min(1),
  height:      z.number().int().min(1),
});

export const maxDuration = 60; // seconds (Vercel function timeout)

export async function POST(req: Request) {
  // 1. Parse body
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Bad request", issues: e }, { status: 400 });
  }

  if (process.env.USE_STUBS === "true") {
    return NextResponse.json({
      pageIndex: parsed.pageIndex,
      words: [{ text: "stub", conf: 99, pageIndex: parsed.pageIndex, box: { x: 0, y: 0, w: 1, h: 1 } }],
      rawText: "stub ocr text",
      width: parsed.width,
      height: parsed.height
    });
  }

  // 2. Magic-byte server guard via Base64 prefix (avoids buffering entire 5MB string)
  const prefix = parsed.imageBase64.slice(0, 20);
  const isPng = prefix.startsWith("iVBORw0KGgo");
  const isJpg = prefix.startsWith("/9j/");
  if (!isPng && !isJpg) {
    return NextResponse.json({ error: "Invalid image format (only PNG/JPG allowed)" }, { status: 415 });
  }

  // 3. Run OCR
  try {
    const result = await ocrPage({
      imageBase64: parsed.imageBase64,
      mimeType:    parsed.mimeType,
      pageIndex:   parsed.pageIndex,
      width:       parsed.width,
      height:      parsed.height,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-cache, no-store" },
    });
  } catch (err) {
    console.error("[ocr route]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
