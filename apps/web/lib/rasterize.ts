import * as pdfjsLib from "pdfjs-dist";

if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // Use unpkg to get the .mjs worker for PDF.js 4.x
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export interface RasterizedPage {
  pageIndex: number;
  base64: string;
  width: number;
  height: number;
}

const MAX_LONG_EDGE = 1000;
const QUALITY = 0.85;

export async function rasterizeFile(file: File): Promise<RasterizedPage[]> {
  if (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/jpg" || file.type === "image/webp") {
    return [await rasterizeImage(file)];
  }
  if (file.type === "application/pdf") {
    return rasterizePdf(file);
  }
  throw new Error(`Unsupported file type: ${file.type}`);
}

async function rasterizeImage(file: File): Promise<RasterizedPage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      
      const longEdge = Math.max(width, height);
      if (longEdge > MAX_LONG_EDGE) {
        const scale = MAX_LONG_EDGE / longEdge;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/png");
      
      // Explicit GC
      canvas.width = 0;
      canvas.height = 0;

      resolve({
        pageIndex: 0,
        base64: dataUrl.split(",")[1],
        width,
        height
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

async function rasterizePdf(file: File): Promise<RasterizedPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await Promise.race([
    loadingTask.promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("PDF parsing timed out after 10s. Please check the file.")), 10000))
  ]);
  const pages: RasterizedPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    
    let scale = 1.0;
    const longEdge = Math.max(viewport.width, viewport.height);
    if (longEdge > MAX_LONG_EDGE) {
      scale = MAX_LONG_EDGE / longEdge;
    }
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext("2d")!;
    
    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

    const dataUrl = canvas.toDataURL("image/png");
    
    // Explicit GC
    page.cleanup();
    canvas.width = 0;
    canvas.height = 0;

    pages.push({
      pageIndex: i - 1, // 0-indexed
      base64: dataUrl.split(",")[1],
      width: scaledViewport.width,
      height: scaledViewport.height
    });
  }

  return pages;
}