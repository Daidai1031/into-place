import type { AssetStatus, Edge, Tone } from "./types";

/**
 * localStorage is the single source of truth for user state in BOTH
 * environments (Vercel has no writable fs). Locally, /api/project/save
 * mirrors this into data/project.json right before the render pipeline runs.
 */

export type ModerationStage = "uploading" | "pending" | "checking" | "approved";

export interface UserUpload {
  id: string;
  title: string;
  description: string;
  era: string;
  dataUrl: string; // client-resized JPEG ≤1600px
  shareToPlace: boolean;
  uploadRole: string | null;
  moderation: ModerationStage;
  createdAt: string;
}

export interface StoryBeat {
  id: string;
  act: string; // e.g. "Stasis", "Peripeteia" — LLM may extend beyond five
  text: string; // 1–2 sentences
  visualDirection?: string; // optional preset-authored staging; does not alter the story text
}

export interface StoryState {
  directions: { id: string; title: string; premise: string }[];
  chosenDirectionId: string | null;
  beats: StoryBeat[];
}

export interface LayoutItem {
  assetId: string;
  cutout: string; // public URL of the real cutout PNG
  x: number; // normalized 0–1 of stage width (center)
  y: number; // normalized 0–1 of stage height (center)
  scale: number; // 1 = natural size fitted to stage
  rotation: number; // degrees
  z: number;
}

export interface BeatLayout {
  items: LayoutItem[];
  brushDataUrl: string | null; // user's hand-drawn overlay
  referenceNote?: string; // provenance note about the AI reference draft
}

export interface TransitionNote {
  type:
    | "page_turn"
    | "wipe"
    | "match_cut"
    | "push_dissolve"
    | "custom"
    | "torn_paper"
    | "paper_reveal"
    | "paper_slide";
  note: string;
}

/** A single edit applied to a generated storyboard frame. */
export interface FrameEdit {
  kind: "add_asset" | "prompt";
  assetId?: string; // add_asset
  instruction?: string; // prompt
  at?: string; // ISO
}

/**
 * Generated storyboard frame (pivot 2026-07-19). This is now the primary
 * per-beat artifact; it is ALWAYS labeled as AI-generated in the UI. Archive
 * assets listed in `references` keep their own provenance elsewhere.
 */
export interface BeatFrame {
  imageUrl: string; // fal-hosted URL preferred (localStorage quota)
  model: string; // key into T2I_MODELS
  prompt: string; // compiled prompt used
  references: string[]; // asset ids fed as visual references
  edits: FrameEdit[];
  requestId: string | null;
  costUsd: number | null;
  source: "generated" | "placeholder";
  attempts: number;
}

/** Per-beat authoring mode: generated frame (default) or manual collage (fallback). */
export type BeatMode = "generated" | "collage";

export interface FilmEntry {
  id: string;
  placeSlug: string;
  title: string;
  url: string;
  createdAt: string;
  liked: boolean;
  favorite: boolean;
}

export interface ProjectState {
  slug: string;
  selections: Record<string, AssetStatus>;
  tuning: Record<string, { tone?: Tone; edge?: Edge }>;
  uploads: UserUpload[];
  story: StoryState | null;
  frames: Record<string, BeatFrame>; // key: beat id — generated storyboard frame (primary)
  beatMode: Record<string, BeatMode>; // key: beat id — default "generated"
  layouts: Record<string, BeatLayout>; // key: beat id — manual collage (fallback path)
  transitions: Record<string, TransitionNote>; // key: `${beatA}->${beatB}`
  updatedAt: string;
}

export function emptyProject(slug: string): ProjectState {
  return {
    slug,
    selections: {},
    tuning: {},
    uploads: [],
    story: null,
    frames: {},
    beatMode: {},
    layouts: {},
    transitions: {},
    updatedAt: new Date().toISOString(),
  };
}

const projectKey = (slug: string) => `into-place:project:${slug}`;
const FILMS_KEY = "into-place:films";

export function loadProject(slug: string): ProjectState {
  if (typeof window === "undefined") return emptyProject(slug);
  try {
    const raw = window.localStorage.getItem(projectKey(slug));
    if (!raw) return emptyProject(slug);
    return { ...emptyProject(slug), ...(JSON.parse(raw) as ProjectState) };
  } catch {
    return emptyProject(slug);
  }
}

export function saveProject(project: ProjectState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      projectKey(project.slug),
      JSON.stringify({ ...project, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Quota exceeded (too many uploads) — surface softly in the UI layer.
    console.warn("Could not persist project state (storage quota?)");
  }
}

export function loadFilms(): FilmEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(FILMS_KEY) ?? "[]") as FilmEntry[];
  } catch {
    return [];
  }
}

export function saveFilms(films: FilmEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FILMS_KEY, JSON.stringify(films));
}
