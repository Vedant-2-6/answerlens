"use client";
import {
  LayoutGrid, Users, FileText, Clipboard, Clock, Settings, ChevronsRight, Sparkles,
} from "lucide-react";

export function NavRail({ onExpand }: { onExpand: () => void }) {
  const navIcons = [LayoutGrid, Users, FileText, Clipboard, Clock];
  return (
    <aside
      className="w-16 shrink-0 flex flex-col items-center rounded-[--radius-pane]
                 bg-surface-card shadow-[--shadow-card] py-4 gap-4"
      aria-label="Navigation rail"
    >
      {/* Logo mark */}
      <span className="flex items-center justify-center w-8 h-8 rounded-lg
                       bg-surface-dark text-white font-bold text-sm select-none">
        V
      </span>

      {/* Toolkit icon */}
      <button
        aria-label="AI Teacher's Toolkit"
        className="w-9 h-9 rounded-full bg-surface-dark flex items-center justify-center
                   text-white ring-2 ring-accent hover:bg-[#3d3d3d] transition-colors"
      >
        <Sparkles size={16} strokeWidth={2} />
      </button>

      {/* Nav icons */}
      <nav className="flex flex-col gap-2 flex-1" aria-label="Primary">
        {navIcons.map((Icon, i) => (
          <button
            key={i}
            className={[
              "w-9 h-9 flex items-center justify-center rounded-xl transition-colors",
              i === 3
                ? "bg-surface-muted text-text-body"
                : "text-text-muted hover:text-text-body hover:bg-surface-muted",
            ].join(" ")}
            aria-label={["Home","My Classroom","Assignments","Exams","My Library"][i]}
          >
            <Icon size={18} strokeWidth={1.7} />
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex flex-col gap-2 items-center">
        <button className="w-9 h-9 flex items-center justify-center rounded-xl
                           text-text-muted hover:text-text-body hover:bg-surface-muted transition-colors"
                aria-label="Settings">
          <Settings size={18} strokeWidth={1.7} />
        </button>
        <div className="w-9 h-9 rounded-full bg-surface-muted flex items-center
                        justify-center text-[10px] font-bold text-text-meta">
          DPS
        </div>
        <button
          onClick={onExpand}
          aria-label="Expand sidebar"
          className="text-text-muted hover:text-text-body transition-colors"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </aside>
  );
}