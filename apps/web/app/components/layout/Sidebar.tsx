"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, BarChart3, ListChecks, Settings, FlaskConical } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Exams & Batches", href: "/exams", icon: FileText },
  { name: "Rubrics", href: "/rubrics", icon: ListChecks },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Test Scanner", href: "/", icon: FlaskConical },
];

export function Sidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-surface overflow-hidden text-text">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-white flex flex-col hidden md:flex shrink-0">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center text-white font-bold text-lg shadow-sm">
              V
            </div>
            <span className="font-bold text-xl tracking-tight">AnswerLens</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 relative">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link key={item.name} href={item.href}>
                <span className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive 
                    ? "bg-accent/10 text-accent font-medium" 
                    : "text-text-muted hover:bg-surface hover:text-text"
                }`}>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute left-0 w-1 h-8 bg-accent rounded-r-full"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className="w-5 h-5" />
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-text-muted hover:bg-surface hover:text-text transition-colors text-left">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden border-b border-border bg-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent flex items-center justify-center text-white font-bold text-xs">V</div>
            <span className="font-bold">AnswerLens</span>
          </div>
          <button className="p-2 bg-surface rounded-md">
             <MenuIcon />
          </button>
        </header>
        
        <main className="flex-1 overflow-auto bg-surface/30">
          {children}
        </main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}
