"use client";
import {
  LayoutGrid, Users, FileText, Clipboard, Clock,
  Settings, PanelRightClose, Sparkles,
} from "lucide-react";
import { NavItem } from "./NavItem";

interface SidebarProps { onCollapse: () => void; }

export function Sidebar({ onCollapse }: SidebarProps) {
  return (
    <aside
      className="w-[304px] shrink-0 flex flex-col rounded-[--radius-pane]
                 bg-surface-card shadow-[--shadow-card] overflow-hidden"
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg
                           bg-surface-dark text-white font-bold text-sm select-none">
            V
          </span>
          <span className="font-bold text-[15px] text-text-body">VedaAI</span>
        </div>
        <button
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          className="p-1 rounded-lg text-text-muted hover:text-text-body hover:bg-surface-muted transition-colors"
        >
          <PanelRightClose size={18} strokeWidth={1.7} />
        </button>
      </div>

      {/* Toolkit CTA */}
      <div className="px-3 pb-4">
        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                     rounded-[--radius-pill] bg-surface-dark text-white text-sm font-semibold
                     ring-2 ring-accent shadow-[--shadow-button]
                     hover:bg-[#3d3d3d] active:bg-[#2a2a2a] transition-colors"
        >
          <Sparkles size={15} strokeWidth={2} />
          AI Teacher&apos;s Toolkit
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 flex flex-col gap-0.5" aria-label="Primary">
        <NavItem icon={LayoutGrid}  label="Home" />
        <NavItem icon={Users}       label="My Classroom" />
        <NavItem icon={FileText}    label="Assignments" />
        <NavItem icon={Clipboard}   label="Exams" active />
        <NavItem icon={Clock}       label="My Library" />
      </nav>

      {/* Footer */}
      <div className="p-3 flex flex-col gap-2">
        <NavItem icon={Settings} label="Settings" />
        <div className="flex items-center gap-3 p-3 rounded-[--radius-card] bg-surface-muted">
          <div className="w-10 h-10 rounded-full bg-surface-pane flex items-center
                          justify-center text-xs font-bold text-text-meta shrink-0">
            DPS
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-body truncate">Delhi Public School</p>
            <p className="text-xs text-text-meta truncate">Bokaro Steel City</p>
          </div>
        </div>
      </div>
    </aside>
  );
}