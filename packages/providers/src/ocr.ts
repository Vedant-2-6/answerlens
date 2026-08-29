import Tesseract from "tesseract.js";
import type { OcrPage, OcrWord } from "@answerlens/types";

export interface OcrInput {
  imageBase64: string;
  mimeType: "image/png" | "image/jpeg";
  pageIndex: number;
}

export async function ocrPage({ imageBase64, pageIndex }: OcrInput): Promise<OcrPage> {
  const buffer = Buffer.from(imageBase64, "base64");

  const { data } = await Tesseract.recognize(buffer, "eng");

  // Derive canvas dimensions from the max bbox extents across all words
  // (Tesseract does not expose image W/H directly on the Page object)
  let maxX = 1;
  let maxY = 1;
  for (const w of data.words ?? []) {
    if (w.bbox.x1 > maxX) maxX = w.bbox.x1;
    if (w.bbox.y1 > maxY) maxY = w.bbox.y1;
  }

  const imageWidth  = maxX;
  const imageHeight = maxY;

  const words: OcrWord[] = (data.words ?? [])
    .filter((w) => w.text.trim().length > 0)
    .map((w) => ({
      text:      w.text,
      conf:      w.confidence,
      pageIndex,
      box: {
        x: w.bbox.x0 / imageWidth,
        y: w.bbox.y0 / imageHeight,
        w: (w.bbox.x1 - w.bbox.x0) / imageWidth,
        h: (w.bbox.y1 - w.bbox.y0) / imageHeight,
      },
    }));

  return {
    pageIndex,
    words,
    rawText: words.map((w) => w.text).join(" "),
    width:   imageWidth,
    height:  imageHeight,
  };
}