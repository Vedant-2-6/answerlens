"use client";
import type { NormRect } from "@answerlens/types";

interface HighlightBoxProps {
  region: NormRect;
  label?: string;
  active: boolean;
  lowConfidence?: boolean;
  onClick: () => void;
}

export function HighlightBox({ region, label, active, lowConfidence, onClick }: HighlightBoxProps) {
  const { y, x, w, h } = region;
  
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`absolute border-2 cursor-pointer transition-colors ${
        active 
          ? "border-accent bg-accent/20 z-10" 
          : lowConfidence ? "border-accent border-dashed bg-accent/5 hover:bg-accent/20" : "border-accent/50 bg-accent/10 hover:border-accent/80 hover:bg-accent/20"
      }`}
      style={{
        top: `${y * 100}%`,
        left: `${x * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`
      }}
    >
      {label && (
        <div className="absolute -top-6 left-[-2px] px-2 py-0.5 bg-accent text-white text-xs font-bold rounded-t-md whitespace-nowrap">
          {label}
        </div>
      )}
    </div>
  );
}