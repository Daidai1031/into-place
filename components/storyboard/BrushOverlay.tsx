"use client";

import { useEffect, useRef } from "react";

/**
 * Hand-drawn overlay on top of the collage. Strokes live on a <canvas>
 * sized to the stage; each finished stroke serializes the whole canvas to a
 * dataURL for persistence. Receives pointer events only in brush mode.
 */
export function BrushOverlay({
  active,
  color,
  size,
  dataUrl,
  onChange,
}: {
  active: boolean;
  color: string;
  size: number;
  dataUrl: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastEmitted = useRef<string | null>(null);

  // Size the bitmap to the element (with DPR) and restore persisted strokes.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const snapshot = canvas.toDataURL();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const restore = dataUrl ?? (lastEmitted.current ? snapshot : null);
      if (restore) drawImage(canvas, restore);
    };
    fit();
    const obs = new ResizeObserver(fit);
    obs.observe(canvas);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External updates (undo, beat switch, clear) — skip our own emissions.
  useEffect(() => {
    if (dataUrl === lastEmitted.current) return;
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    if (dataUrl) drawImage(canvas, dataUrl);
    lastEmitted.current = dataUrl;
  }, [dataUrl]);

  function pos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full ${active ? "cursor-crosshair" : "pointer-events-none"}`}
      style={{ zIndex: 1000, touchAction: "none" }}
      onPointerDown={(e) => {
        if (!active) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const dpr = window.devicePixelRatio || 1;
        ctx.lineWidth = size * dpr;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 0.1, p.y + 0.1);
        ctx.stroke();
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        const ctx = canvasRef.current!.getContext("2d")!;
        const p = pos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }}
      onPointerUp={() => {
        if (!drawing.current) return;
        drawing.current = false;
        const url = canvasRef.current!.toDataURL("image/png");
        lastEmitted.current = url;
        onChange(url);
      }}
    />
  );
}

function drawImage(canvas: HTMLCanvasElement, url: string) {
  const img = new Image();
  img.onload = () =>
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.src = url;
}
