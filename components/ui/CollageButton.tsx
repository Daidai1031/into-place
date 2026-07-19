"use client";

import type { ButtonHTMLAttributes } from "react";

/** Primary action button styled like an inked paper label. */
export function CollageButton({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const styles =
    variant === "primary"
      ? "bg-ink text-paper hover:bg-ink-soft"
      : variant === "danger"
        ? "bg-stamp/10 text-stamp border border-stamp/40 hover:bg-stamp/20"
        : "bg-transparent text-ink border border-ink/30 hover:border-ink hover:bg-paper-deep/50";
  return (
    <button
      className={`cursor-pointer px-4 py-2 font-typewriter text-sm tracking-wide shadow-[2px_2px_0_rgb(43_38_32/0.25)] transition-colors active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  );
}
