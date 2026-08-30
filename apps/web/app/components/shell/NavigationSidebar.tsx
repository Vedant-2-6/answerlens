"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid, Users, FileText, Clipboard, Clock,
  Settings, PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { useSessionStore } from "@/app/store/session";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";

import { useRouter } from "next/navigation";

function cx(...args: any[]) { return twMerge(clsx(args)); }

const navItems = [
  { icon: LayoutGrid, label: "Home", isNav: true, href: "/" },
  { icon: Users, label: "My Classroom" },
  { icon: FileText, label: "Assignments" },
  { icon: Clipboard, label: "Exams", active: true },
  { icon: Clock, label: "My Library" },
];

export function NavigationSidebar() {
  const router = useRouter();
  const { sidebarCollapsed, setSidebarCollapsed, reset } = useSessionStore();
  const width = sidebarCollapsed ? 64 : 304;

  const handleDummyClick = (feature: string) => {
    toast.info(`${feature} is in development`, {
      description: "This is a premium feature scheduled for the next release.",
    });
  };

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.isNav) {
      if (item.label === "Home") {
        reset();
        router.push(item.href || "/");
      }
    } else if (!item.active) {
      toast.info(`${item.label} is in development`, {
        description: "This is a premium feature scheduled for the next release.",
      });
    }
  };

  const handleHomeLogo = () => {
    reset();
    router.push("/");
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="shrink-0 flex flex-col rounded-[--radius-pane] bg-surface-card shadow-[--shadow-card] overflow-hidden whitespace-nowrap"
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className={cx("flex items-center pt-4 pb-3", sidebarCollapsed ? "px-3 justify-center" : "px-4 justify-between")}>
        <button 
          onClick={() => {
            sidebarCollapsed ? setSidebarCollapsed(false) : handleHomeLogo();
          }}
          className={cx("flex items-center gap-2 overflow-hidden outline-none shrink-0", sidebarCollapsed && "hover:opacity-80 transition-opacity")}
          title={sidebarCollapsed ? "Expand Sidebar" : undefined}
        >
          <span className="flex shrink-0 items-center justify-center w-8 h-8 rounded-lg bg-surface-dark text-white font-bold text-sm select-none">
            V
          </span>
          {!sidebarCollapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="font-bold text-[15px] text-text-body">
              VedaAI
            </motion.span>
          )}
        </button>
        
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label="Toggle sidebar"
          className={cx(
            "p-1.5 rounded-lg text-text-muted hover:text-text-body hover:bg-surface-muted transition-colors shrink-0",
            sidebarCollapsed ? "hidden" : "block"
          )}
        >
          <PanelRightClose size={18} strokeWidth={1.7} />
        </button>
      </div>

      {/* Toolkit CTA */}
      <div className="px-3 pb-4 flex justify-center mt-2">
        <button
          onClick={() => handleDummyClick("AI Teacher's Toolkit")}
          style={{ width: sidebarCollapsed ? 36 : 256 }}
          className={cx(
            "flex items-center justify-center rounded-full bg-[#2E2E2E] text-white font-medium hover:bg-[#3d3d3d] active:bg-[#2a2a2a] transition-all duration-300 shrink-0 overflow-hidden",
            sidebarCollapsed ? "h-9 shadow-[0_0_0_1.5px_#E3600F] px-0" : "h-11 gap-2.5 px-4 shadow-[0_0_0_2px_#E3600F,0_4px_12px_rgba(227,96,15,0.25)]"
          )}
        >
          {/* Custom double-sparkle SVG to match reference precisely */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <path d="M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8L10 0Z" fill="currentColor"/>
            <path d="M19 13L19.8 16.2L23 17L19.8 17.8L19 21L18.2 17.8L15 17L18.2 16.2L19 13Z" fill="currentColor"/>
          </svg>
          <div 
            className={cx("overflow-hidden whitespace-nowrap transition-all duration-300", sidebarCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}
          >
            <span className="text-[15px]">AI Teacher&apos;s Toolkit</span>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 flex flex-col gap-0.5 mt-2" aria-label="Primary">
        {navItems.map((item, i) => (
          <button
            key={item.label}
            onClick={() => handleNavClick(item)}
            className={cx(
              "flex items-center gap-3 rounded-[10px] transition-colors overflow-hidden",
              sidebarCollapsed ? "w-10 h-10 justify-center mx-auto" : "w-full px-3 py-2.5 text-sm font-semibold",
              item.active ? "bg-surface-muted text-text-body" : "text-text-muted hover:text-text-body hover:bg-surface-muted"
            )}
            title={sidebarCollapsed ? item.label : undefined}
          >
            <item.icon size={18} strokeWidth={1.7} className={cx("shrink-0", item.active && sidebarCollapsed && "text-accent")} />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 flex flex-col gap-2 items-center">
        <button
          onClick={() => handleDummyClick("Settings")}
          className={cx(
            "flex items-center gap-3 rounded-[10px] transition-colors overflow-hidden",
            sidebarCollapsed ? "w-10 h-10 justify-center" : "w-full px-3 py-2 text-sm font-semibold text-text-muted hover:text-text-body hover:bg-surface-muted"
          )}
          title={sidebarCollapsed ? "Settings" : undefined}
        >
          <Settings size={18} strokeWidth={1.7} className="shrink-0" />
          {!sidebarCollapsed && <span>Settings</span>}
        </button>

        <button 
          onClick={() => handleDummyClick("School Profile")}
          className={cx("flex items-center p-3 rounded-[--radius-card] bg-surface-muted overflow-hidden hover:bg-border-hairline transition-colors text-left", sidebarCollapsed ? "w-10 h-10 p-0 justify-center rounded-full" : "w-full gap-3")}
          title={sidebarCollapsed ? "School Profile" : undefined}
        >
          <div className="w-10 h-10 rounded-full bg-surface-pane flex items-center justify-center text-xs font-bold text-text-meta shrink-0">
            DPS
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text-body truncate">Delhi Public School</p>
              <p className="text-xs text-text-meta truncate">Bokaro Steel City</p>
            </div>
          )}
        </button>

        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Expand sidebar"
            className="text-text-muted hover:text-text-body transition-colors mt-2 p-1"
          >
            <PanelRightOpen size={16} />
          </button>
        )}
      </div>
    </motion.aside>
  );
}