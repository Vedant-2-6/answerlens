import Tesseract from "tesseract.js";
import type { OcrPage, OcrWord } from "@answerlens/types";

export interface OcrInput {
  imageBase64: string;
  mimeType: "image/png" | "image/jpeg";
  pageIndex: number;
  width: number;
  height: number;
}

export async function ocrPage({ imageBase64, pageIndex, width, height }: OcrInput): Promise<OcrPage> {
  const buffer = Buffer.from(imageBase64, "base64");

  const { data } = await Tesseract.recognize(buffer, "eng");

  const imageWidth  = width || 1000;
  const imageHeight = height || 1000;

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