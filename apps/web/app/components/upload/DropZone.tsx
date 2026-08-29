"use client";
import { useRef, useState } from "react";
import { FileChip } from "./FileChip";
import { Upload } from "lucide-react";

interface DropZoneProps {
  kind: "question" | "answer";
  file: File | null;
  onAdd: (f: File) => void;
  onRemove: () => void;
  error?: string;
}

const MAGIC: Record<string, number[]> = {
  "image/png":       [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg":      [0xff, 0xd8, 0xff],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
};

async function validateMagic(file: File): Promise<boolean> {
  const slice = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(slice);
  const expected = MAGIC[file.type];
  return !!expected && expected.every((b, i) => bytes[i] === b);
}

export function DropZone({ kind, file, onAdd, onRemove, error }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string>();

  const displayError = error ?? localError;
  const label = kind === "question" ? "Question Paper" : "Answer Sheet";
  const accentWord = kind === "question" ? "Question Paper" : "Answer Sheet";
  const firstLetter = accentWord[0];
  const rest = accentWord.slice(1);

  async function handleFile(f: File) {
    setLocalError(undefined);
    if (f.size > 10 * 1024 * 1024) {
      setLocalError("File exceeds 10MB limit"); return;
    }
    if (!["application/pdf", "image/png", "image/jpeg"].includes(f.type)) {
      setLocalError("PDF, PNG or JPEG only"); return;
    }
    const ok = await validateMagic(f);
    if (!ok) { setLocalError("Invalid file format"); return; }
    onAdd(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        onClick={() => !file && inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!file) inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={[
          "relative min-h-[186px] flex flex-col items-center justify-center px-6 py-8",
          "rounded-[--radius-dropzone] border-[1.5px] border-dashed transition-colors",
          "bg-surface-card",
          !file ? "cursor-pointer" : "cursor-default",
          displayError ? "border-[#c0350a]" :
          dragOver     ? "border-accent bg-[--accent-tint]/20" :
                         "border-border-dashed",
        ].join(" ")}
      >
        {file ? (
          <FileChip file={file} onRemove={onRemove} />
        ) : (
          <div className="flex flex-col items-center gap-4 text-center pointer-events-none">
            {/* Upload icon tile */}
            <div className="w-11 h-11 rounded-[--radius-tile] bg-surface-dark
                            flex items-center justify-center text-white">
              <Upload size={18} strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-bold text-text-body">
                Upload{" "}
                <span className="text-accent">
                  <span className="first-letter-underline">{firstLetter}</span>{rest}
                </span>
              </p>
              <p className="text-xs text-text-muted mt-1">Max 10MB</p>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept=".pdf,image/png,image/jpeg"
          aria-label={`Choose file for ${label}`}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>

      {displayError && (
        <p role="alert" className="text-xs text-[#c0350a] px-1">{displayError}</p>
      )}
    </div>
  );
}