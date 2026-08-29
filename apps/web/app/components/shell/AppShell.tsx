"use client";
import { NavigationSidebar } from "./NavigationSidebar";
import { TopBar } from "./TopBar";
import { Toaster } from "sonner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen p-3 gap-3 bg-surface-page overflow-hidden">
      <NavigationSidebar />
      <div className="flex flex-col flex-1 min-w-0 gap-3">
        <TopBar />
        <main className="flex-1 min-h-0 overflow-hidden rounded-[--radius-pane] bg-surface-app shadow-[inset_0_0_8px_rgba(0,0,0,0.02)]">
          {children}
        </main>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}