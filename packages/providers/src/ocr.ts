import { createWorker, createScheduler, Scheduler } from "tesseract.js";
import type { OcrPage, OcrWord } from "@answerlens/types";

export interface OcrInput {
  imageBase64: string;
  mimeType: "image/png" | "image/jpeg";
  pageIndex: number;
  width: number;
  height: number;
}

let sharedScheduler: Scheduler | null = null;
let initPromise: Promise<Scheduler> | null = null;

async function getScheduler(): Promise<Scheduler> {
  if (sharedScheduler) return sharedScheduler;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    const sched = createScheduler();
    // 3 concurrent workers to match pipeline concurrency
    for (let i = 0; i < 3; i++) {
      const worker = await createWorker("eng");
      sched.addWorker(worker);
    }
    sharedScheduler = sched;
    return sched;
  })();
  
  return initPromise;
}

export async function ocrPage({ imageBase64, mimeType, pageIndex, width, height }: OcrInput): Promise<OcrPage> {
  const isBrowser = typeof globalThis !== "undefined" && "window" in globalThis;
  const input = !isBrowser
    ? Buffer.from(imageBase64, "base64")
    : `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;

  const scheduler = await getScheduler();
  const { data } = await scheduler.addJob("recognize", input);

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