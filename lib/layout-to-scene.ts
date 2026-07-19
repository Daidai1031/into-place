import type { BeatLayout, StoryBeat, TransitionNote } from "./local-store";

/**
 * Convert a user-approved storyboard layout into the spec/01 scene format
 * consumed by scripts/scene-to-hyperframes.mjs. Coordinate mapping:
 * - canvas x,y are 0..1 with (0.5,0.5) at center → scene x,y are centered 0
 * - canvas z-order (0..n) → scene depth 0.05..0.9 (higher = closer)
 * - canvas scale 1.0 = 35% of stage width → scene scale passthrough with the
 *   same base fraction; the render track calibrates per-asset if needed.
 */
export function layoutToScene(
  beat: StoryBeat,
  layout: BeatLayout,
  transitionOut: TransitionNote | null,
) {
  const sorted = [...layout.items].sort((a, b) => a.z - b.z);
  const n = Math.max(sorted.length - 1, 1);
  return {
    _note: `Generated from user storyboard — beat "${beat.act}": ${beat.text}`,
    beat_id: beat.id,
    planes: sorted.map((item, i) => ({
      asset: publicUrlToRepoPath(item.cutout),
      z: 0.05 + (i / n) * 0.85,
      x: round(item.x - 0.5),
      y: round(item.y - 0.5),
      scale: round(item.scale * 0.35),
      rotation: round(item.rotation),
      shadow: i > 0,
    })),
    brush_overlay: layout.brushDataUrl ? true : false,
    camera_path: {
      from: { z: 0, x: 0, y: 0 },
      to: { z: 0.25, x: 0, y: 0 },
      easing: "ease-in-out",
    },
    transition_out: transitionOut ?? { type: "push_dissolve", note: "" },
  };
}

function publicUrlToRepoPath(url: string): string {
  if (url.startsWith("/cutouts/")) return `assets/cutouts/${url.slice("/cutouts/".length)}`;
  if (url.startsWith("data:")) return "(user upload — embedded image)";
  return url;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
