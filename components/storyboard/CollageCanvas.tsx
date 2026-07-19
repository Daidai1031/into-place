"use client";

import { useRef, useState, type ReactNode } from "react";
import type { LayoutItem } from "@/lib/local-store";

const BASE_WIDTH_FRAC = 0.35; // scale 1.0 → item spans 35% of stage width

/**
 * The 16:9 collage stage. Drag to move; the single corner handle both
 * rotates and scales (sticker-editor style). All coordinates are normalized
 * (0–1 of stage) so the same JSON drives the render pipeline later.
 */
export function CollageCanvas({
  items,
  selectedId,
  interactive,
  onSelect,
  onCommit,
  children,
}: {
  items: LayoutItem[];
  selectedId: string | null;
  interactive: boolean; // false while the brush tool owns the pointer
  onSelect: (assetId: string | null) => void;
  onCommit: (items: LayoutItem[]) => void;
  children?: ReactNode; // brush overlay
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [gestureItems, setGestureItems] = useState<LayoutItem[] | null>(null);
  const gesture = useRef<{
    kind: "move" | "transform";
    assetId: string;
    startX: number;
    startY: number;
    itemStart: LayoutItem;
    centerPx?: { x: number; y: number };
    startAngle?: number;
    startDist?: number;
  } | null>(null);

  const shown = gestureItems ?? items;

  function stageRect() {
    return stageRef.current!.getBoundingClientRect();
  }

  function beginMove(e: React.PointerEvent, item: LayoutItem) {
    if (!interactive) return;
    e.preventDefault();
    onSelect(item.assetId);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture.current = {
      kind: "move",
      assetId: item.assetId,
      startX: e.clientX,
      startY: e.clientY,
      itemStart: item,
    };
    setGestureItems(items);
  }

  function beginTransform(e: React.PointerEvent, item: LayoutItem) {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = stageRect();
    const center = {
      x: rect.left + item.x * rect.width,
      y: rect.top + item.y * rect.height,
    };
    gesture.current = {
      kind: "transform",
      assetId: item.assetId,
      startX: e.clientX,
      startY: e.clientY,
      itemStart: item,
      centerPx: center,
      startAngle: Math.atan2(e.clientY - center.y, e.clientX - center.x),
      startDist: Math.hypot(e.clientX - center.x, e.clientY - center.y),
    };
    setGestureItems(items);
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const rect = stageRect();
    setGestureItems((prev) =>
      (prev ?? items).map((it) => {
        if (it.assetId !== g.assetId) return it;
        if (g.kind === "move") {
          return {
            ...it,
            x: clamp(g.itemStart.x + (e.clientX - g.startX) / rect.width, 0.02, 0.98),
            y: clamp(g.itemStart.y + (e.clientY - g.startY) / rect.height, 0.02, 0.98),
          };
        }
        const angle = Math.atan2(e.clientY - g.centerPx!.y, e.clientX - g.centerPx!.x);
        const dist = Math.hypot(e.clientX - g.centerPx!.x, e.clientY - g.centerPx!.y);
        return {
          ...it,
          rotation: clamp(
            g.itemStart.rotation + ((angle - g.startAngle!) * 180) / Math.PI,
            -60,
            60,
          ),
          scale: clamp(g.itemStart.scale * (dist / Math.max(g.startDist!, 8)), 0.15, 4.5),
        };
      }),
    );
  }

  function onPointerUp() {
    if (!gesture.current) return;
    gesture.current = null;
    setGestureItems((finalItems) => {
      if (finalItems) onCommit(finalItems);
      return null;
    });
  }

  return (
    <div
      ref={stageRef}
      className="relative aspect-video w-full touch-none select-none overflow-hidden bg-[#efe6d0] shadow-[inset_0_0_60px_rgb(43_38_32/0.15)]"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerDown={(e) => {
        if (e.target === stageRef.current) onSelect(null);
      }}
    >
      {[...shown]
        .sort((a, b) => a.z - b.z)
        .map((item) => {
          const selected = item.assetId === selectedId;
          return (
            <div
              key={item.assetId}
              className={`absolute ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{
                left: `${item.x * 100}%`,
                top: `${item.y * 100}%`,
                width: `${item.scale * BASE_WIDTH_FRAC * 100}%`,
                transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                zIndex: item.z,
              }}
              onPointerDown={(e) => beginMove(e, item)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.cutout}
                alt=""
                draggable={false}
                className="pointer-events-none w-full select-none drop-shadow-[0_4px_8px_rgb(43_38_32/0.35)]"
              />
              {selected && interactive && (
                <>
                  <div className="pointer-events-none absolute -inset-1 border-2 border-dashed border-stamp/70" />
                  <button
                    aria-label="Rotate and scale"
                    className="absolute -right-2.5 -top-2.5 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-paper bg-stamp shadow-md"
                    onPointerDown={(e) => beginTransform(e, item)}
                  />
                </>
              )}
            </div>
          );
        })}
      {children}
    </div>
  );
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
