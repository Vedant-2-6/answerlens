"use client";

interface PrimaryButtonProps {
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

export function PrimaryButton({ disabled, disabledReason, onClick, children }: PrimaryButtonProps) {
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      aria-disabled={disabled}
      aria-describedby={disabled && disabledReason ? "cta-helper" : undefined}
      title={disabled && disabledReason ? disabledReason : undefined}
      className={[
        "flex items-center gap-2 px-7 py-3.5 rounded-[--radius-pill] text-sm font-semibold",
        "transition-colors select-none",
        disabled
          ? "bg-[#d1cece] text-[#f0eeee] cursor-not-allowed"
          : "bg-surface-dark text-white shadow-[--shadow-button] hover:bg-[#3d3d3d] active:bg-[#2a2a2a]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}