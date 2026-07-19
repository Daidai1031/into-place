"use client";

import type { LayoutAssetInput } from "@/lib/layout-fallback";

/** Curated assets ready to drop on the canvas. The caller owns the hard cap. */
export function AssetShelf({
  assets,
  usedIds,
  disabledIds,
  max,
  onAdd,
}: {
  assets: LayoutAssetInput[];
  usedIds: Set<string>;
  disabledIds: Set<string>;
  max: number;
  onAdd: (asset: LayoutAssetInput) => void;
}) {
  const atMax = usedIds.size >= max;
  return (
    <div>
      <p className="font-typewriter text-xs uppercase tracking-wider text-ink-soft">
        Curated pieces{" "}
        <span className="normal-case tracking-normal">
          · {usedIds.size} on canvas (up to {max})
        </span>
      </p>
      <div className="mt-2 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1">
        {assets.map((asset) => {
          const used = usedIds.has(asset.id);
          const sceneLimit = disabledIds.has(asset.id);
          return (
            <button
              key={asset.id}
              disabled={used || atMax || sceneLimit}
              onClick={() => onAdd(asset)}
              title={
                used
                  ? "Already on canvas"
                  : sceneLimit
                    ? "Already used in two scenes"
                    : atMax
                      ? `${max} pieces max`
                      : "Add to canvas"
              }
              className={`group relative flex h-16 cursor-pointer items-center justify-center border bg-paper-deep/30 p-1 transition-all ${
                used
                  ? "border-accent/50 opacity-40"
                  : atMax || sceneLimit
                    ? "cursor-not-allowed border-ink/10 opacity-40"
                    : "border-ink/15 hover:border-stamp/60 hover:bg-paper-deep/60"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.cutout}
                alt={asset.id}
                className="max-h-full max-w-full object-contain"
                loading="lazy"
              />
              {used && (
                <span className="absolute right-0.5 top-0.5 font-typewriter text-[10px] text-accent">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
