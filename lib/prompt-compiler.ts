/**
 * Prompt compiler — the single place natural-language prompts are built
 * (CLAUDE.md discipline: never hand-write prompts, compile them from structure).
 *
 * The developer's validated master style prompt (2026-07-19) is decomposed here
 * into reusable blocks. Everything downstream — text-to-image storyboard frames,
 * image-to-video motion, and frame edits — composes these blocks so the whole
 * film shares one look. Pure string logic: no fal / server imports, safe to
 * import on the client for prompt previews.
 */

import type { StoryBeat } from "./local-store";
import type { AssetBrief, PlaceBrief } from "./llm";

/** Master style, decomposed from the validated 15s collage-animation prompt. */
export const STYLE = {
  medium:
    "a handmade, tactile, editorial paper-collage still: layered 2.5D multiplane depth built from stacked paper cutouts, archival photographs, map fragments, newspaper clippings, hand-drawn textures, torn paper edges, vintage typography and masked image layers; materials overlap with clear hierarchy and spatial logic — a 2D frame with a 3D sense of space",
  palette:
    "low-saturation vintage print palette: warm sepia and faded cream with soft muted blue-gray accents, aged-paper warmth, gentle historical texture overlays, tactile paper textures, a nostalgic archival photo feeling, restrained but warm — evenly and softly lit, never dark or high-contrast",
  mood:
    "thoughtful, quiet, reflective and nostalgic; warm and human, like leafing through an old family archive — calm, not eerie, not somber, not haunting",
  grain:
    "texture overlays, roughened edges, paper grain and delicate film grain, irregular handmade imperfections",
  motion:
    "gentle parallax between foreground, midground and background layers, subtle drop-shadow depth, layered compositing, a slight wiggle and gentle camera drift",
  transitionFeel:
    "transitions feel like animated collage construction — pieces sliding, revealing, layering and reassembling",
} as const;

/** Negative / avoid block — every generated frame and shot carries it. */
export const AVOID =
  "Avoid any horror, eerie, creepy, ominous, unsettling or ghostly mood; avoid dark shadows, gloomy low-key lighting, heavy vignettes, cold desaturated grays, sickly green/teal color casts and high contrast. Also avoid a tourism-ad look, glossy travel visuals, drone-commercial energy, overly polished 3D rendering, bright oversaturated cheerful colors, generic city montage, sleek motion graphics, and clean corporate infographic looks.";

/**
 * Preservation block (CLAUDE.md fixed constraints). Guards identity/material
 * from being rewritten during generation or editing — it does NOT forbid
 * pose/position motion.
 */
export const PRESERVATION =
  "no morphing, no new objects, no face changes, no costume changes, no architecture changes, preserve printed text, preserve collage layout";

/** Audio block — generation is always muted; narration/subtitles added later. */
export const AUDIO = "Diegetic sounds only. No music. No dialogue. No subtitles.";

function referenceBlock(references: AssetBrief[]): string {
  if (!references.length) return "";
  const lines = references
    .map((r) => `- "${r.title}" (${r.era}, ${r.type})`)
    .join("\n");
  return `\n\nUse these real archival pieces as visual references — keep their identities, printed text and materials intact; compose them as collage layers, do not invent new versions of them:\n${lines}`;
}

/**
 * Text-to-image prompt for one storyboard frame.
 * Composes: film context + beat scene + collage medium + references + palette/mood + avoid.
 */
export function compileFramePrompt(args: {
  place: PlaceBrief;
  beat: StoryBeat;
  references?: AssetBrief[];
  filmPremise?: string;
}): string {
  const { place, beat, references = [], filmPremise } = args;
  return [
    `A single storyboard frame (16:9) for a short collage film about ${place.name} (${place.region}).`,
    filmPremise ? `Film premise: ${filmPremise}` : "",
    `Scene (${beat.act}): ${beat.text}`,
    `Render it as ${STYLE.medium}.`,
    referenceBlock(references),
    `Visual style: ${STYLE.palette}. ${STYLE.grain}. Overall tone ${STYLE.mood}.`,
    AVOID,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export interface ShotMotion {
  /** exactly one camera move, e.g. "slow dolly in", "gentle crane out" */
  camera?: string;
  /** exactly one subject/environment action, e.g. "the tram car drifts left to right" */
  action?: string;
}

/**
 * Image-to-video motion prompt. One camera move + one subject/environment action
 * (split into separate sentences, never merged into "everything moves"), plus the
 * collage parallax feel, preservation, avoid and audio blocks. Defaults to a
 * restrained drift when no explicit motion is given.
 */
export function compileMotionPrompt(args: {
  beat: StoryBeat;
  motion?: ShotMotion;
}): string {
  const { beat, motion = {} } = args;
  const camera = motion.camera ?? "a slow, gentle camera drift with subtle multiplane parallax";
  const parts = [
    `Animate this collage frame. Scene (${beat.act}): ${beat.text}`,
    `Camera: ${camera}.`,
  ];
  if (motion.action) parts.push(`Motion: ${motion.action}.`);
  parts.push(`${STYLE.motion}. ${STYLE.grain}.`);
  parts.push(`Constraints: ${PRESERVATION}.`);
  parts.push(AVOID);
  parts.push(AUDIO);
  return parts.join("\n\n");
}

/**
 * Edit instruction for an image-editing model (e.g. nano-banana edit) that
 * takes the current frame plus references and applies a targeted change.
 * `dropHint` (normalized 0–1 x/y) positions a dragged archival piece.
 */
export function compileEditPrompt(args: {
  instruction?: string;
  assetTitle?: string;
  dropHint?: { x: number; y: number };
}): string {
  const { instruction, assetTitle, dropHint } = args;
  const where = dropHint
    ? ` around ${describePosition(dropHint)}`
    : "";
  const change = assetTitle
    ? `Add the provided archival piece "${assetTitle}" into the scene${where}, integrated as a torn-paper collage layer that matches the existing ${STYLE.palette}.`
    : instruction
      ? instruction
      : "Refine the collage composition.";
  return [
    `Edit this storyboard collage frame. ${change}`,
    `Keep the rest of the frame unchanged. Constraints: ${PRESERVATION}.`,
    AVOID,
  ].join("\n\n");
}

function describePosition(p: { x: number; y: number }): string {
  const h = p.x < 0.34 ? "left" : p.x > 0.66 ? "right" : "center";
  const v = p.y < 0.34 ? "top" : p.y > 0.66 ? "bottom" : "middle";
  return v === "middle" && h === "center" ? "the center" : `the ${v} ${h}`;
}
