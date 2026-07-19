import "server-only";
import { callLlm, extractJson } from "./fal-server";
import type { StoryBeat } from "./local-store";

/**
 * Structured prompt builders for story work. No hand-written free prompts —
 * every call is compiled from place data + user selections, mirroring the
 * prompt-compiler discipline used for shots.
 */

export interface AssetBrief {
  id: string;
  title: string;
  era: string;
  type: string;
  description?: string;
  contributor?: string;
}

export interface PlaceBrief {
  name: string;
  region: string;
  tagline: string;
}

const STORY_SYSTEM = `You are the narrative agent of "Into Place", a platform that turns real archival material about a place into short collage films. You write grounded, specific, emotionally honest material. Historical claims must stay consistent with the provided archive items; invented specifics beyond them must be plausible and clearly modest. Always answer with STRICT JSON only — no markdown fences, no commentary.`;

function archiveBlock(assets: AssetBrief[]): string {
  return assets
    .map(
      (a) =>
        `- [${a.id}] "${a.title}" (${a.era}, ${a.type}${a.contributor === "user" ? ", contributed by the user today" : ""})${a.description ? ` — ${a.description}` : ""}`,
    )
    .join("\n");
}

export async function generateDirections(place: PlaceBrief, assets: AssetBrief[]) {
  const prompt = `Place: ${place.name} (${place.region}) — ${place.tagline}

Curated archive items:
${archiveBlock(assets)}

Propose exactly 3 alternative story directions for a short film that CONTINUES this place's history into its next chapter, each rooted in the archive above. Vary the emotional register (e.g. elegiac / hopeful / uncanny).

JSON schema: [{"id":"dir_1","title":"...","premise":"one or two sentences"}]`;
  const { output, requestId } = await callLlm({ system: STORY_SYSTEM, prompt, maxTokens: 800 });
  return {
    directions: extractJson<{ id: string; title: string; premise: string }[]>(output),
    requestId,
  };
}

export async function generateBeats(
  place: PlaceBrief,
  assets: AssetBrief[],
  direction: { title: string; premise: string },
) {
  const prompt = `Place: ${place.name} (${place.region}) — ${place.tagline}

Curated archive items:
${archiveBlock(assets)}

Chosen story direction: "${direction.title}" — ${direction.premise}

Write the storyboard as 5 to 8 beats (pick the count the story needs). Each beat is 1–2 sentences of what we SEE and FEEL, grounded in the archive items where possible. Loosely follow a five-act arc (stasis, turn, depth, recognition, release) but name acts naturally. Beats must continue the place's history toward today and beyond.

JSON schema: [{"id":"beat_1","act":"short act label","text":"1-2 sentences"}]`;
  const { output, requestId } = await callLlm({ system: STORY_SYSTEM, prompt, maxTokens: 1600 });
  const beats = extractJson<StoryBeat[]>(output).slice(0, 8);
  return { beats, requestId };
}

export async function rerollBeat(
  place: PlaceBrief,
  assets: AssetBrief[],
  beats: StoryBeat[],
  targetId: string,
  mode: "reroll" | "insert_after",
) {
  const list = beats
    .map((b) => `${b.id === targetId ? ">> " : "   "}[${b.id}] (${b.act}) ${b.text}`)
    .join("\n");
  const task =
    mode === "reroll"
      ? `Rewrite ONLY the beat marked with ">>" — same story position, a fresh visual/emotional take. Keep continuity with neighbors.`
      : `Write ONE NEW beat that goes immediately AFTER the beat marked with ">>", bridging it to the next beat. Keep continuity.`;
  const prompt = `Place: ${place.name} (${place.region}) — ${place.tagline}

Archive items:
${archiveBlock(assets)}

Current storyboard:
${list}

${task}

JSON schema: {"act":"short act label","text":"1-2 sentences"}`;
  const { output, requestId } = await callLlm({ system: STORY_SYSTEM, prompt, maxTokens: 400 });
  return { beat: extractJson<{ act: string; text: string }>(output), requestId };
}

export async function suggestTransition(
  fromBeat: StoryBeat,
  toBeat: StoryBeat,
) {
  const prompt = `Two consecutive storyboard beats of an archival collage film:

FROM (${fromBeat.act}): ${fromBeat.text}
TO (${toBeat.act}): ${toBeat.text}

Suggest the best transition between them. Allowed types: "page_turn" (archive page flips), "wipe" (paper edge wipes across), "match_cut" (shapes align across the cut), "push_dissolve" (camera pushes through into the next scene). Add one short sentence of intent.

JSON schema: {"type":"page_turn|wipe|match_cut|push_dissolve","note":"one sentence"}`;
  const { output, requestId } = await callLlm({ system: STORY_SYSTEM, prompt, maxTokens: 200, temperature: 0.6 });
  return { transition: extractJson<{ type: string; note: string }>(output), requestId };
}
