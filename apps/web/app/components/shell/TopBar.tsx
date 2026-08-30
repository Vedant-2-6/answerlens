"use client";
import { ArrowLeft, ClipboardList, HelpCircle, Bell, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/app/store/session";

export function TopBar() {
  const router = useRouter();
  const reset = useSessionStore(state => state.reset);

  const handleDummyClick = (feature: string) => {
    toast.info(`${feature} is in development`, {
      description: "This is a premium feature scheduled for the next release.",
    });
  };

  const handleGoBack = () => {
    reset();
    router.push("/");
  };

  return (
    <header className="h-11 shrink-0 flex items-center justify-between px-4
                       bg-surface-card rounded-[--radius-pane] shadow-[--shadow-card]">
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <button onClick={handleGoBack} aria-label="Go back" className="hover:text-text-body transition-colors">
          <ArrowLeft size={16} />
        </button>
        <ClipboardList size={15} strokeWidth={1.7} />
        <span className="font-medium text-text-body">Exams</span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        <button onClick={() => handleDummyClick("Help & Support")} aria-label="Help" className="text-text-muted hover:text-text-body transition-colors">
          <HelpCircle size={18} strokeWidth={1.7} />
        </button>
        <button onClick={() => handleDummyClick("Notifications")} aria-label="Notifications" className="relative text-text-muted hover:text-text-body transition-colors">
          <Bell size={18} strokeWidth={1.7} />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent" />
        </button>
        <button onClick={() => handleDummyClick("AI Features")} aria-label="AI features" className="text-text-muted hover:text-text-body transition-colors">
          <Sparkles size={18} strokeWidth={1.7} />
        </button>
        <button onClick={() => handleDummyClick("Teacher Profile")} className="flex items-center gap-2 text-sm font-medium text-text-body hover:opacity-80 transition-opacity">
          <span className="w-7 h-7 rounded-full bg-surface-muted flex items-center justify-center text-xs font-bold">M</span>
          <span className="hidden sm:inline">Madhur Rastogi</span>
          <span className="text-text-muted text-xs">âˆ¨</span>
        </button>
      </div>
    </header>
  );
}