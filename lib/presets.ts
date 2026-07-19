import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Built-in default story presets (data/presets/*.json). A preset seeds the
 * Story page with a curated direction + beats and gives the Storyboard page a
 * per-beat reference set, so the generated-frame pipeline reproduces the
 * approved look without waiting on the LLM. Types are client-importable (the
 * server-only guard only blocks the runtime read, which stays server-side).
 */
export interface PresetBeat {
  id: string;
  act: string;
  text: string;
  transition?: string;
  narration?: string;
  references?: string[]; // asset ids fed to the frame model
}

export interface StoryPreset {
  place_slug: string;
  direction: { id: string; title: string; premise: string };
  protagonist?: { name: string; reason: string };
  ending_text?: string;
  master_style_prompt?: string;
  beats: PresetBeat[];
}

const PRESETS_DIR = path.join(process.cwd(), "data", "presets");

export function getPreset(slug: string): StoryPreset | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    return JSON.parse(readFileSync(path.join(PRESETS_DIR, `${slug}.json`), "utf8")) as StoryPreset;
  } catch {
    return null;
  }
}
