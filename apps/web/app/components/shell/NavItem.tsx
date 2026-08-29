"use client";
import type { LucideIcon } from "lucide-react";

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  href?: string;
  active?: boolean;
}

export function NavItem({ icon: Icon, label, href = "#", active = false }: NavItemProps) {
  return (
    <a
      href={href}
      className={[
        "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
        active
          ? "bg-surface-muted text-text-body"
          : "text-text-muted hover:text-text-body hover:bg-surface-muted/60",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={18} strokeWidth={1.7} />
      {label}
    </a>
  );
}