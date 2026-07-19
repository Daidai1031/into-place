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

/** Audio block — the i2v GENERATION is always muted; a curated audio pass
 * (foley + music) is added later in post, compiled by the helpers below. */
export const AUDIO = "Diegetic sounds only. No music. No dialogue. No subtitles.";

/**
 * Sound design (post-production audio pass). Declarative, per-beat, mirroring the
 * collage-recipe discipline: cues live in the preset and are compiled here — the
 * prompt is never hand-written. `diegetic` are discrete, on-screen foley cues
 * ("a quill pen scratching on paper"); `ambient` is the continuous room/place
 * bed ("faint institutional room tone, distant indistinct murmuring").
 */
export interface BeatSound {
  diegetic?: string[];
  ambient?: string;
}

/** Kept OUT of the diegetic foley track: no score, no intelligible words. Voices
 * (crowd murmur, an orator's cadence) are allowed only as indistinct ambience. */
export const SOUND_NEGATIVE =
  "music, musical score, melody, background music, singing, lyrics, intelligible speech, clear spoken words, dialogue, narration, voiceover, subtitles, modern city traffic, car engines, sirens, phone notifications, electronic beeps, synth, distortion, harsh clipping noise";

/** Kept OUT of the music bed: nothing that fights the calm archival mood. */
export const MUSIC_NEGATIVE =
  "harsh, aggressive, horror, eerie, ominous, suspenseful, dissonant, distorted, heavy drums, percussion-driven, EDM, electronic beats, pop, vocals, singing, lyrics, upbeat commercial jingle, triumphant fanfare, low quality";

/**
 * MMAudio-style prompt for one clip's diegetic foley. Timed to on-screen motion;
 * sparse, close, period-appropriate. No music (that comes from the score bed).
 */
export function compileSoundPrompt(sound: BeatSound, beat?: { act?: string }): string {
  const cues = sound.diegetic?.length ? sound.diegetic.join("; ") : "";
  const bed = sound.ambient?.trim();
  return [
    "Diegetic sound design for a quiet, tactile, hand-made archival collage film — realistic, close, restrained foley only, timed to the motion on screen.",
    beat?.act ? `Scene mood: ${beat.act}.` : "",
    cues ? `Foreground sounds: ${cues}.` : "",
    bed ? `Continuous background bed: ${bed}.` : "",
    "Keep it sparse, intimate and period-appropriate. Any human voices are distant and indistinct — never intelligible words, never a clear speaker. No music, no score.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * One merged foley prompt for the whole assembled film (fallback when per-clip
 * renders are unavailable and MMAudio runs on the final cut). Dedupes cues in
 * beat order so the soundscape reads as a single continuous passage.
 */
export function compileWholeFilmSoundPrompt(beats: { sound?: BeatSound; act?: string }[]): string {
  const cues: string[] = [];
  const beds: string[] = [];
  for (const b of beats) {
    for (const c of b.sound?.diegetic ?? []) if (!cues.includes(c)) cues.push(c);
    const bed = b.sound?.ambient?.trim();
    if (bed && !beds.includes(bed)) beds.push(bed);
  }
  return [
    "Diegetic sound design for a short, quiet, hand-made archival collage film — a single continuous passage of realistic, close, restrained foley timed to the motion on screen.",
    cues.length ? `Foreground sounds, unfolding in order: ${cues.join("; ")}.` : "",
    beds.length ? `Shifting background bed: ${beds.join("; then ")}.` : "",
    "Keep it sparse, intimate and period-appropriate. Any human voices are distant and indistinct — never intelligible words. No music, no score.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Text-to-music prompt for the score bed. Derived from the film's mood, not
 * hand-tuned per run; deliberately low-energy so it sits under the foley.
 */
export function compileMusicPrompt(args: { title?: string; premise?: string } = {}): string {
  return [
    "An original instrumental score for a reflective historical documentary collage film about a place and the voices it tried to contain.",
    "Warm, sparse and nostalgic: soft solo piano with subtle warm strings and a low sustained drone, slow tempo, gentle and human, quietly hopeful.",
    "Restrained, calm and contemplative — like leafing through an old family archive; never eerie, never somber, never suspenseful, never grand or triumphant.",
    "Low, even dynamics so it can sit softly beneath narration and diegetic sound. Muted, aged, analog warmth, gentle tape hiss. Instrumental only, no vocals, no drums.",
  ].join(" ");
}

/** A sparse collage reads more clearly and keeps each archival source legible. */
export const MAX_SOURCE_IMAGES_PER_FRAME = 7;
export const SOURCE_IMAGE_LIMIT =
  "Use no more than seven archival or reference images in this frame. The source images do not need to remain complete: crop, tear, fold, isolate figures or objects, separate depth layers and spatially reassemble them so the collage can move. Preserve historical identity and provenance, not the original rectangular composition.";

function referenceBlock(references: AssetBrief[]): string {
  if (!references.length) return "";
  const lines = references
    .map((r) => `- "${r.title}" (${r.era}, ${r.type})`)
    .join("\n");
  return `\n\nUse these real archival pieces as visual references — keep their identities, printed text and materials intact; compose them as collage layers, do not invent new versions of them:\n${lines}`;
}

/**
 * Pull only explicit, displayable time points out of a storyboard beat. Broad
 * phrases such as "years later" are deliberately ignored: the frame should
 * never invent a date that the storyboard did not actually provide.
 */
export function extractBeatTimePoints(
  beat: Pick<StoryBeat, "act" | "text" | "visualDirection">,
): string[] {
  const source = [beat.act, beat.text, beat.visualDirection].filter(Boolean).join(" ");
  const pattern =
    /\b(?:(?:early|mid|late)[ -](?:1[5-9]\d0s|20\d0s|\d{1,2}(?:st|nd|rd|th)[ -]century)|(?:(?:ca\.?|circa)\s+)?(?:1[5-9]\d{2}|20\d{2})(?:s|\s*[–—-]\s*(?:\d{2}|\d{4}))?|\d{1,2}(?:st|nd|rd|th)[ -]century|present[ -]day|today)\b/gi;
  const matches = [...source.matchAll(pattern)].map((match) => ({
    index: match.index ?? 0,
    value: /^present[ -]day$/i.test(match[0])
      ? "PRESENT DAY"
      : /^today$/i.test(match[0])
        ? "TODAY"
        : match[0],
  }));

  matches.sort((a, b) => a.index - b.index);
  return matches
    .map((match) => match.value)
    .filter(
      (value, index, all) =>
        all.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index,
    );
}

function timeMarkerBlock(beat: StoryBeat): string {
  const timePoints = extractBeatTimePoints(beat);
  if (!timePoints.length) return "";
  const labels = timePoints.map((timePoint) => `"${timePoint}"`).join(", ");
  return `Visible time marker: the storyboard explicitly names ${labels}. Render ${
    timePoints.length === 1 ? "this time point" : "these time points"
  } as concise, clearly legible text inside the frame, integrated into the paper collage as period-appropriate archival typography. Keep the wording exact, and do not invent or add any other date or time label.`;
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
    beat.visualDirection ? `Storyboard staging: ${beat.visualDirection}` : "",
    timeMarkerBlock(beat),
    `Render it as ${STYLE.medium}.`,
    referenceBlock(references),
    SOURCE_IMAGE_LIMIT,
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
