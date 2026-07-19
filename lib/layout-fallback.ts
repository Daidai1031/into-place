import type { LayoutItem } from "./local-store";

export interface LayoutAssetInput {
  id: string;
  cutout: string; // public URL
  role: "card" | "cutout" | "bg";
  width: number;
  height: number;
}

/**
 * Deterministic heuristic layout: backgrounds fill the stage low in the
 * stack, foreground pieces scatter on a golden-angle spiral with gentle
 * rotation. Used when the AI layout is unavailable — the demo never blocks.
 */
export function fallbackLayout(assets: LayoutAssetInput[]): LayoutItem[] {
  const bgs = assets.filter((a) => a.role === "bg");
  const rest = assets.filter((a) => a.role !== "bg");
  const items: LayoutItem[] = [];

  bgs.forEach((bg, i) => {
    items.push({ assetId: bg.id, cutout: bg.cutout, x: 0.5, y: 0.5, scale: 3, rotation: 0, z: i });
  });

  const GOLDEN = 137.508;
  rest.forEach((asset, i) => {
    const angle = (i * GOLDEN * Math.PI) / 180;
    const radius = 0.08 + 0.3 * Math.sqrt((i + 0.5) / Math.max(rest.length, 1));
    items.push({
      assetId: asset.id,
      cutout: asset.cutout,
      x: Math.min(0.88, Math.max(0.12, 0.5 + radius * Math.cos(angle) * 1.4)),
      y: Math.min(0.85, Math.max(0.15, 0.5 + radius * Math.sin(angle))),
      scale: i === 0 ? 1.25 : 0.9 - i * 0.04,
      rotation: ((i * 7) % 11) - 5,
      z: bgs.length + rest.length - i,
    });
  });
  return items;
}

/** Clamp/repair an LLM-proposed layout so every item stays usable on stage. */
export function sanitizeLayout(
  proposed: Partial<LayoutItem>[],
  assets: LayoutAssetInput[],
): LayoutItem[] | null {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const items: LayoutItem[] = [];
  for (const p of proposed) {
    const asset = p.assetId ? byId.get(p.assetId) : undefined;
    if (!asset) continue;
    items.push({
      assetId: asset.id,
      cutout: asset.cutout,
      x: clamp(num(p.x, 0.5), 0.02, 0.98),
      y: clamp(num(p.y, 0.5), 0.02, 0.98),
      scale: clamp(num(p.scale, 1), 0.15, 4),
      rotation: clamp(num(p.rotation, 0), -45, 45),
      z: Math.round(num(p.z, items.length)),
    });
  }
  // Every requested asset must appear exactly once.
  for (const asset of assets) {
    if (!items.some((i) => i.assetId === asset.id)) return null;
  }
  return items.length >= 1 ? items : null;
}

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
