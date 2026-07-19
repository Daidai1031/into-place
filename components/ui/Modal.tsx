"use client";

import type { ReactNode } from "react";
import { PaperCard } from "./PaperCard";

export function Modal({
  open,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] overflow-y-auto">
        <PaperCard edge="scissor" className={`p-6 ${className}`}>
          {children}
        </PaperCard>
      </div>
    </div>
  );
}
