import { NextResponse } from "next/server";
import { z } from "zod";
import { ocrPage } from "@answerlens/providers";

const Body = z.object({
  imageBase64: z.string().min(100, "imageBase64 too short"),
  mimeType:    z.enum(["image/png", "image/jpeg"]),
  pageIndex:   z.number().int().min(0),
});

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPG_MAGIC = [0xff, 0xd8, 0xff];

export const maxDuration = 60; // seconds (Vercel function timeout)

export async function POST(req: Request) {
  // 1. Parse body
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Bad request", issues: e }, { status: 400 });
  }

  // 2. Magic-byte server guard (defence-in-depth beyond client validation)
  if (process.env.USE_STUBS === "true") {
    return NextResponse.json({
      pageIndex: parsed.pageIndex,
      words: [{ text: "stub", conf: 99, pageIndex: parsed.pageIndex, box: { x: 0, y: 0, w: 1, h: 1 } }],
      rawText: "stub ocr text",
      width: 1000,
      height: 1000
    });
  }
  const buf = Buffer.from(parsed.imageBase64, "base64");
  const isPng = PNG_MAGIC.every((b, i) => buf[i] === b);
  const isJpg = JPG_MAGIC.every((b, i) => buf[i] === b);
  if (!isPng && !isJpg) {
    return NextResponse.json({ error: "Invalid image format" }, { status: 415 });
  }

  // 3. Run OCR
  try {
    const result = await ocrPage({
      imageBase64: parsed.imageBase64,
      mimeType:    parsed.mimeType,
      pageIndex:   parsed.pageIndex,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-cache, no-store" },
    });
  } catch (err) {
    console.error("[ocr route]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };
