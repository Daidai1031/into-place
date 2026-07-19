import type { ReactNode } from "react";

/**
 * Torn-edged paper card. `seed` picks one of three deterministic torn
 * variants so a list of cards doesn't look cloned; `edge` can switch to a
 * crisp scissor mat or no treatment at all.
 */
export function PaperCard({
  children,
  className = "",
  rotate = 0,
  seed = 0,
  edge = "torn",
}: {
  children: ReactNode;
  className?: string;
  rotate?: number;
  seed?: number;
  edge?: "torn" | "scissor" | "none";
}) {
  const edgeClass =
    edge === "torn" ? `torn-${Math.abs(seed) % 3}` : edge === "scissor" ? "scissor-edge" : "";
  return (
    <div
      className="paper-shadow relative"
      style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }}
    >
      <div className={`relative bg-[#faf6ec] ${edgeClass} ${className}`}>{children}</div>
    </div>
  );
}
