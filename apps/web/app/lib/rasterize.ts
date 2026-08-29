"use client";

export interface RasterPage {
  base64: string;
  width: number;
  height: number;
}

export interface RasterResult {
  pageCount: number;
  toBase64: (pageIndex: number, dpi?: number) => Promise<RasterPage>;
}

export async function rasterizePDF(file: File): Promise<RasterResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs", import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;

  if (pageCount > 20) throw new Error("PAGE_LIMIT_EXCEEDED");

  async function toBase64(pageIndex: number, dpi = 150): Promise<RasterPage> {
    const page = await pdf.getPage(pageIndex + 1);
    const scale = dpi / 72;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width  = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2d context unavailable");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    const base64  = dataUrl.replace(/^data:image\/png;base64,/, "");
    return { base64, width: canvas.width, height: canvas.height };
  }

  return { pageCount, toBase64 };
}

export async function rasterizeImage(file: File): Promise<RasterResult> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).replace(/^data:[^;]+;base64,/, ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return {
    pageCount: 1,
    toBase64: async (_pageIndex: number): Promise<RasterPage> => {
      const img = new Image();
      img.src = `data:${file.type};base64,${base64}`;
      await new Promise<void>((r, rej) => { img.onload = () => r(); img.onerror = rej; });
      const canvas = document.createElement("canvas");
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      return {
        base64: canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""),
        width:  canvas.width,
        height: canvas.height,
      };
    },
  };
}