/**
 * Audio pass — the last step before export (2026-07-19). Adds curated sound to
 * the otherwise-silent assembled film:
 *   1. Diegetic foley, timed to each shot's motion, via MMAudio V2 (video→audio).
 *   2. One warm, restrained score bed for the whole film, via Lyria 2 (text→music).
 *   3. FFmpeg mix: foley delayed to each shot's offset + ducked music, faded out
 *      with the picture, muxed onto final/<slug>.mp4.
 *
 * Cues are declarative (data/presets/<slug>.json `beat.sound`) and compiled by
 * lib/prompt-compiler — prompts are never hand-written here. The i2v clips stay
 * muted; this is the only place audio enters the film.
 *
 * Two source modes, auto-detected:
 *   · per-clip  — renders/<slug>/clip_XX.mp4 present (a real render-film run):
 *                 foley is generated per clip and placed at its xfade offset.
 *   · whole-cut — only final/<slug>.mp4 present (e.g. the demo cut): one merged
 *                 foley prompt runs on the whole assembled film.
 *
 * Run (paid — spends FAL_KEY; ~$0.15 for the RI film):
 *   npx tsx scripts/add-audio.mts --slug=roosevelt-island --yes
 * Dry cost estimate (no submit):
 *   npx tsx scripts/add-audio.mts --slug=roosevelt-island
 * After it finishes: node scripts/sync-public.mjs
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { fal } from "@fal-ai/client";
import {
  MMAUDIO_V2,
  LYRIA2,
  COST_CONFIRMATION_THRESHOLD_USD,
  type AudioModel,
} from "../lib/models.ts";
import {
  compileSoundPrompt,
  compileWholeFilmSoundPrompt,
  compileMusicPrompt,
  SOUND_NEGATIVE,
  MUSIC_NEGATIVE,
  type BeatSound,
} from "../lib/prompt-compiler.ts";
import {
  ffprobeDuration,
  clipOffsets,
  muxFilmAudio,
  type FoleyTrack,
} from "../lib/film-assemble.ts";

const ROOT = process.cwd();
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const slug = (args.slug as string) ?? "roosevelt-island";
const go = Boolean(args.yes);
// --remix re-mixes the LAST generated foley + music (from audio-provenance.json)
// with the current gains — no fal calls, no cost. Use it to tune the mix.
const remix = Boolean(args.remix);
const TRANSITION_DUR = 0.7; // must match scripts/render-film.mts

const foleyModel: AudioModel = MMAUDIO_V2;
const musicModel: AudioModel = LYRIA2;
const noMusic = Boolean(args["no-music"]);
const noFoley = Boolean(args["no-foley"]);

interface PresetBeatJson {
  id: string;
  act?: string;
  sound?: BeatSound;
}

// --- preset (declarative sound cues) ---
const preset = JSON.parse(
  readFileSync(`${ROOT}/data/presets/${slug}.json`, "utf8"),
) as { direction?: { title?: string; premise?: string }; beats: PresetBeatJson[] };
const beats = preset.beats;

// --- resolve source mode ---
const clipsDir = `${ROOT}/renders/${slug}`;
const finalPath = (args.out as string) ?? `${ROOT}/final/${slug}.mp4`;
mkdirSync(clipsDir, { recursive: true });
const audioDir = `${clipsDir}/audio`;
mkdirSync(audioDir, { recursive: true });

const clipFiles = existsSync(clipsDir)
  ? readdirSync(clipsDir)
      .filter((f) => /^clip_\d+\.mp4$/.test(f))
      .sort()
      .map((f) => `${clipsDir}/${f}`)
  : [];
const perClip = clipFiles.length > 0;

if (!existsSync(finalPath) && !perClip) {
  throw new Error(
    `no film to score: neither renders/${slug}/clip_*.mp4 nor ${finalPath} exist. Render the film first.`,
  );
}

// Durable silent master to mux onto and (in whole-cut mode) to score. Created
// once from the first silent assembly so re-runs stay idempotent.
const silentMaster = `${clipsDir}/silent-master.mp4`;
if (!existsSync(silentMaster)) {
  if (!existsSync(finalPath))
    throw new Error(`need an assembled ${finalPath} to mux onto (run render-film first)`);
  copyFileSync(finalPath, silentMaster);
}
const videoIn = silentMaster;
const totalDur = ffprobeDuration(videoIn);

// --- remix short-circuit: reuse the last generated audio, just re-mux ---
if (remix) {
  const provPath = `${ROOT}/data/scenes/generated/${slug}/audio-provenance.json`;
  if (!existsSync(provPath)) throw new Error(`--remix needs a prior run: ${provPath} not found`);
  const prov = JSON.parse(readFileSync(provPath, "utf8")) as {
    foley: { file: string; startSec: number }[];
    music: { file: string } | null;
  };
  const foley: FoleyTrack[] = prov.foley
    .filter((f) => existsSync(f.file))
    .map((f) => ({ file: f.file, startSec: f.startSec }));
  const music = prov.music && existsSync(prov.music.file) ? prov.music.file : null;
  process.stdout.write(`Re-mixing ${foley.length} foley track(s)${music ? " + music" : ""} → ${finalPath}\n`);
  muxFilmAudio({ videoIn, out: finalPath, foley, musicFile: music });
  process.stdout.write(`✓ remixed → ${finalPath}\nNext: node scripts/sync-public.mjs\n`);
  process.exit(0);
}

// Segments to generate foley for.
interface Segment {
  label: string;
  file: string; // the video to feed MMAudio
  durSec: number;
  startSec: number;
  prompt: string;
}
let segments: Segment[] = [];
if (noFoley) {
  segments = [];
} else if (perClip) {
  const durs = clipFiles.map(ffprobeDuration);
  const starts = clipOffsets(durs, TRANSITION_DUR);
  segments = clipFiles.map((file, i) => {
    const beat = beats[i] ?? {};
    const sound = beat.sound ?? {};
    return {
      label: beat.id ?? `clip_${i + 1}`,
      file,
      durSec: durs[i],
      startSec: starts[i],
      prompt: compileSoundPrompt(sound, { act: beat.act }),
    };
  });
} else {
  segments = [
    {
      label: "whole-cut",
      file: videoIn,
      durSec: totalDur,
      startSec: 0,
      prompt: compileWholeFilmSoundPrompt(beats),
    },
  ];
}

// --- cost estimate ---
const foleyDur = segments.reduce((s, seg) => s + Math.min(Math.ceil(seg.durSec), 30), 0);
const foleyCost = noFoley ? 0 : foleyDur * foleyModel.unitPrice;
const musicCost = noMusic ? 0 : musicModel.unitPrice; // one <=30s Lyria generation
const estCost = foleyCost + musicCost;

process.stdout.write(
  `Audio pass: ${slug}\n` +
    `Mode: ${perClip ? `per-clip (${segments.length} shots)` : "whole-cut (1 pass)"}\n` +
    `Foley: ${noFoley ? "(skipped)" : `${foleyModel.displayName} — ~${foleyDur}s @ $${foleyModel.unitPrice}/s`}\n` +
    `Music: ${noMusic ? "(skipped)" : `${musicModel.displayName} — $${musicModel.unitPrice}/30s`}\n` +
    `Film length: ${totalDur.toFixed(2)}s\n` +
    `Estimated cost: ~$${estCost.toFixed(3)}\n`,
);
if (!perClip && !noFoley) {
  process.stdout.write(
    `  · note: no per-clip renders found — foley runs once on the whole cut.\n` +
      `    (run scripts/render-film.mts first for shot-accurate foley placement.)\n`,
  );
}

if (!go) {
  process.stdout.write(`\nDry run. Re-run with --yes to submit (paid).\n`);
  process.exit(0);
}
if (estCost > COST_CONFIRMATION_THRESHOLD_USD && !args.confirm) {
  process.stdout.write(`\n⚠ estimate >$${COST_CONFIRMATION_THRESHOLD_USD}; add --confirm to proceed.\n`);
  process.exit(1);
}

// --- FAL key ---
const falKey = readFileSync(`${ROOT}/.env.local`, "utf8").match(/^FAL_KEY=(.*)$/m)?.[1]?.trim();
if (!falKey) throw new Error("FAL_KEY not found in .env.local");
fal.config({ credentials: falKey });

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
async function download(url: string, dest: string): Promise<void> {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(dest, buf);
}
async function uploadVideo(file: string): Promise<string> {
  const buf = readFileSync(file);
  const blob = new Blob([new Uint8Array(buf)], { type: "video/mp4" });
  return fal.storage.upload(blob);
}

interface Provenance {
  model: string;
  requestId: string;
  prompt: string;
  negativePrompt: string;
  params: Record<string, unknown>;
  costUsd: number;
}
const provenance: { foley: (Provenance & { label: string; startSec: number; file: string })[]; music: (Provenance & { file: string }) | null } = {
  foley: [],
  music: null,
};

// --- 1) foley per segment (MMAudio; video model → queue mode) ---
const foleyTracks: FoleyTrack[] = [];
for (const seg of segments) {
  const duration = Math.min(Math.ceil(seg.durSec), 30);
  process.stdout.write(`\n▶ foley ${seg.label} (${seg.durSec.toFixed(2)}s @ +${seg.startSec.toFixed(2)}s)\n`);
  const videoUrl = await uploadVideo(seg.file);
  const input = {
    video_url: videoUrl,
    prompt: seg.prompt,
    negative_prompt: SOUND_NEGATIVE,
    duration,
  };
  const { request_id } = await fal.queue.submit(foleyModel.endpointId, { input });
  process.stdout.write(`  submit → ${request_id}\n`);
  for (let t = 0; t < 120; t++) {
    const st = (await fal.queue.status(foleyModel.endpointId, { requestId: request_id })) as { status: string };
    if (st.status === "COMPLETED") break;
    await sleep(3000);
  }
  const res = await fal.queue.result(foleyModel.endpointId, { requestId: request_id });
  const url = (res.data as { video?: { url: string } }).video?.url;
  if (!url) throw new Error(`MMAudio returned no video for ${seg.label}`);
  const dest = `${audioDir}/foley_${seg.label}.mp4`;
  await download(url, dest);
  foleyTracks.push({ file: dest, startSec: seg.startSec });
  provenance.foley.push({
    label: seg.label,
    startSec: seg.startSec,
    file: dest,
    model: foleyModel.endpointId,
    requestId: request_id,
    prompt: seg.prompt,
    negativePrompt: SOUND_NEGATIVE,
    params: { duration },
    costUsd: duration * foleyModel.unitPrice,
  });
  process.stdout.write(`  ✓ ${dest} (req ${request_id})\n`);
}

// --- 2) music bed (Lyria; audio gen → subscribe) ---
let musicFile: string | null = null;
if (!noMusic) {
  const musicPrompt = compileMusicPrompt({
    title: preset.direction?.title,
    premise: preset.direction?.premise,
  });
  process.stdout.write(`\n▶ music bed (${musicModel.displayName})\n`);
  const res = await fal.subscribe(musicModel.endpointId, {
    input: { prompt: musicPrompt, negative_prompt: MUSIC_NEGATIVE },
    logs: false,
  });
  const audioUrl = (res.data as { audio?: { url: string } }).audio?.url;
  if (!audioUrl) throw new Error("Lyria returned no audio");
  const ext = audioUrl.split("?")[0].split(".").pop() || "mp3";
  musicFile = `${audioDir}/music.${ext}`;
  await download(audioUrl, musicFile);
  provenance.music = {
    file: musicFile,
    model: musicModel.endpointId,
    requestId: res.requestId,
    prompt: musicPrompt,
    negativePrompt: MUSIC_NEGATIVE,
    params: {},
    costUsd: musicModel.unitPrice,
  };
  process.stdout.write(`  ✓ ${musicFile} (req ${res.requestId})\n`);
}

// --- 3) mix + mux ---
process.stdout.write(`\n▶ mixing audio onto ${finalPath}\n`);
muxFilmAudio({ videoIn, out: finalPath, foley: foleyTracks, musicFile });

// --- provenance (no keys) ---
const provDir = `${ROOT}/data/scenes/generated/${slug}`;
mkdirSync(provDir, { recursive: true });
const totalCost = provenance.foley.reduce((s, f) => s + f.costUsd, 0) + (provenance.music?.costUsd ?? 0);
writeFileSync(
  `${provDir}/audio-provenance.json`,
  JSON.stringify(
    { slug, mode: perClip ? "per-clip" : "whole-cut", filmDurationSec: totalDur, totalCostUsd: totalCost, ...provenance },
    null,
    2,
  ),
);

process.stdout.write(
  `\n✓ scored film → ${finalPath}\n` +
    `  silent master kept at ${silentMaster}\n` +
    `  provenance → ${provDir}/audio-provenance.json\n` +
    `Next: node scripts/sync-public.mjs  (copies into public/films/)\n`,
);
