/**
 * Generate the five "Women Who Crossed the Water" storyboard frames with fal
 * nano-banana-2/edit. Each beat uses at most seven real archival references,
 * and one source asset may appear in at most two scenes. The shared compiled
 * style prompt holds continuity without repeating a previous frame as a style
 * anchor across the whole film.
 *
 * Run:  npx tsx scripts/gen-storyboard-preview.mts
 * Reads FAL_KEY from .env.local. Never prints the key.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fal } from "@fal-ai/client";
import sharp from "sharp";
import { compileFramePrompt } from "../lib/prompt-compiler.ts";

const ROOT = process.cwd();
const OUT = `${ROOT}/data/storyboard-preview`;
const ENDPOINT = "fal-ai/nano-banana-2/edit";

// --- load FAL_KEY from .env.local (no logging) ---
const envRaw = readFileSync(`${ROOT}/.env.local`, "utf8");
const falKey = envRaw.match(/^FAL_KEY=(.*)$/m)?.[1]?.trim();
if (!falKey) throw new Error("FAL_KEY not found in .env.local");
fal.config({ credentials: falKey });

// --- load preset + place ---
const preset = JSON.parse(readFileSync(`${ROOT}/data/presets/roosevelt-island.json`, "utf8"));
const place = JSON.parse(readFileSync(`${ROOT}/data/places/roosevelt-island.json`, "utf8"));
const placeBrief = { name: place.name, region: place.region, tagline: place.tagline };
const filmPremise = `${preset.direction.premise} Protagonist thread: ${preset.protagonist.name} — ${preset.protagonist.reason}`;

const briefById = new Map<string, { id: string; title: string; era: string; type: string }>();
const cutoutById = new Map<string, string>();
for (const a of place.assets) {
  briefById.set(a.id, { id: a.id, title: a.title, era: a.era, type: a.type });
  const cut = a.cutouts?.find((c: { role: string }) => c.role !== "bg") ?? a.cutouts?.[0];
  if (cut) cutoutById.set(a.id, cut.file);
}

mkdirSync(OUT, { recursive: true });

async function uploadCutout(assetId: string): Promise<string> {
  const rel = cutoutById.get(assetId);
  if (!rel) throw new Error(`no cutout for ${assetId}`);
  const buf = readFileSync(`${ROOT}/${rel}`);
  const blob = new Blob([new Uint8Array(buf)], { type: "image/png" });
  return fal.storage.upload(blob);
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

async function callModel(input: Record<string, unknown>): Promise<{ url: string; requestId: string }> {
  try {
    const r = await fal.subscribe(ENDPOINT, { input, logs: false });
    const url = (r.data as { images?: { url: string }[] }).images?.[0]?.url;
    if (!url) throw new Error("no image url in response");
    return { url, requestId: r.requestId };
  } catch (e) {
    // Retry once with a minimal payload in case a param name is rejected.
    const minimal = { prompt: input.prompt, image_urls: input.image_urls };
    const r = await fal.subscribe(ENDPOINT, { input: minimal, logs: false });
    const url = (r.data as { images?: { url: string }[] }).images?.[0]?.url;
    if (!url) throw e;
    return { url, requestId: r.requestId };
  }
}

const results: { beat: string; requestId: string; file: string; refs: string[] }[] = [];
const sceneUseCounts = new Map<string, number>();
for (const beat of preset.beats) {
  if (beat.references.length > 7) throw new Error(`${beat.id} has more than seven source images`);
  for (const id of new Set<string>(beat.references)) {
    const next = (sceneUseCounts.get(id) ?? 0) + 1;
    if (next > 2) throw new Error(`${id} appears in more than two scenes`);
    sceneUseCounts.set(id, next);
  }
}

for (let i = 0; i < preset.beats.length; i++) {
  const beat = preset.beats[i];
  const refIds: string[] = beat.references.slice(0, 7);
  process.stdout.write(`\n[${i + 1}/5] ${beat.act} — refs: ${refIds.join(", ")}\n`);

  const refUrls = await Promise.all(refIds.map(uploadCutout));
  const references = refIds.map((id) => briefById.get(id)!).filter(Boolean);

  const prompt = compileFramePrompt({ place: placeBrief, beat, references, filmPremise });

  const { url, requestId } = await callModel({
    prompt,
    image_urls: refUrls,
    aspect_ratio: "16:9",
    num_images: 1,
  });

  const dest = `${OUT}/beat_0${i + 1}.png`;
  await download(url, dest);
  results.push({ beat: beat.act, requestId, file: dest, refs: refIds });
  process.stdout.write(`   ✓ ${requestId} → ${dest}\n`);
}

// --- montage 2 columns x 3 rows ---
const TW = 620;
const TH = 349; // 16:9
const cols = 2;
const rows = 3;
const tiles = await Promise.all(
  results.map(async (r, i) => {
    const img = await sharp(r.file).resize(TW, TH, { fit: "contain", background: "#e9e2d2" }).toBuffer();
    return { input: img, left: (i % cols) * TW, top: Math.floor(i / cols) * TH };
  }),
);
await sharp({ create: { width: cols * TW, height: rows * TH, channels: 3, background: "#c9c0ad" } })
  .composite(tiles)
  .png()
  .toFile(`${OUT}/montage.png`);

process.stdout.write(`\n=== done ===\n`);
for (const r of results) process.stdout.write(`${r.beat}: ${r.requestId}\n`);
process.stdout.write(`montage → ${OUT}/montage.png\n`);
