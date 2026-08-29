"use client";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface FileChipProps {
  file: File;
  onRemove: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

async function getPdfPageCount(file: File): Promise<number | null> {
  try {
    const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
    GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs", import.meta.url
    ).toString();
    const ab = await file.arrayBuffer();
    const pdf = await getDocument({ data: ab }).promise;
    return pdf.numPages;
  } catch { return null; }
}

export function FileChip({ file, onRemove }: FileChipProps) {
  const [pageCount, setPageCount] = useState<number | null>(null);
  const isPdf = file.type === "application/pdf";

  useEffect(() => {
    if (isPdf) {
      getPdfPageCount(file).then(setPageCount);
    } else {
      setPageCount(1);
    }
  }, [file, isPdf]);

  return (
    // Positioned relative so the remove button overlaps top-right corner
    <div className="relative w-full">
      {/* Remove button — overlaps top-right, ringed in accent-tint */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label="Remove file"
        className="absolute -top-3 -right-3 z-10 w-7 h-7 rounded-full bg-surface-dark
                   flex items-center justify-center text-white ring-2 ring-accent-tint
                   hover:bg-[#3d3d3d] transition-colors"
      >
        <X size={12} strokeWidth={2.5} />
      </button>

      {/* Chip body */}
      <div className="flex items-center gap-3 p-3 rounded-[--radius-card]
                      bg-surface-sunken w-full max-w-[280px] mx-auto">
        {/* PDF glyph */}
        <div className="w-8 h-8 shrink-0 rounded bg-red-500 flex items-center
                        justify-center text-white text-[9px] font-bold leading-none">
          PDF
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-text-body truncate">{file.name}</p>
          <p className="text-xs text-text-muted mt-0.5">
            {formatBytes(file.size)}
            {pageCount !== null && (
              <> &bull; {pageCount} {pageCount === 1 ? "Page" : "Pages"}</>
            )}
            {pageCount === null && isPdf && (
              <> &bull; <span className="animate-pulse">…</span></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}