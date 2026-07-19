"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";

/**
 * Wraps a handful of collage layers (background map fragment, tucked-in
 * photos) and nudges each one — by its `data-depth` (0-1) — opposite the
 * cursor. AtlasMap and any element without data-depth is untouched, so
 * markers and the input stay put. No-ops under prefers-reduced-motion.
 *
 * `active` fires a one-shot "wake" nudge on every data-depth layer — used
 * to make the background fragments visibly stir the moment a globe marker
 * is focused, even before the pointer moves.
 */
export function CollageParallax({
  children,
  className = "",
  active = false,
}: {
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layers = ref.current?.querySelectorAll<HTMLElement>("[data-depth]");
    layers?.forEach((layer, i) => {
      const depth = Number(layer.dataset.depth ?? 0);
      layer.style.transition = "transform 900ms cubic-bezier(0.2, 0.8, 0.2, 1)";
      layer.style.transform = `translate(${depth * -14}px, ${depth * 18}px) rotate(${depth * 2}deg)`;
      setTimeout(() => {
        layer.style.transform = "";
        layer.style.transition = "";
      }, 950 + i * 90);
    });
  }, [active]);

  function handleMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ref.current?.querySelectorAll<HTMLElement>("[data-depth]").forEach((layer) => {
      const depth = Number(layer.dataset.depth ?? 0);
      layer.style.transform = `translate(${px * depth * -18}px, ${py * depth * -14}px)`;
    });
  }

  function handleLeave() {
    ref.current?.querySelectorAll<HTMLElement>("[data-depth]").forEach((layer) => {
      layer.style.transform = "";
    });
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={className}
    >
      {children}
    </div>
  );
}
