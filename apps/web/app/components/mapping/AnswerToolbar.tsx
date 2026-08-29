"use client";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";

interface AnswerToolbarProps {
  zoom: number;
  onZoom: (z: number) => void;
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
}

export function AnswerToolbar({ zoom, onZoom, page, pageCount, onPageChange }: AnswerToolbarProps) {
  return (
    <div className="h-12 bg-surface-dark border-b border-border-default flex items-center justify-between px-4 text-text-muted">
      <div className="flex items-center gap-2">
        <button 
          onClick={() => onZoom(Math.max(0.5, zoom - 0.25))}
          className="p-1.5 hover:bg-white/10 rounded transition-colors"
          aria-label="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <span className="text-sm font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button 
          onClick={() => onZoom(Math.min(3, zoom + 0.25))}
          className="p-1.5 hover:bg-white/10 rounded transition-colors"
          aria-label="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          className="p-1.5 hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Previous Page"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium">Page {page + 1} of {Math.max(1, pageCount)}</span>
        <button
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
          className="p-1.5 hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Next Page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}