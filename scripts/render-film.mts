/**
 * Render the film from generated storyboard frames via image-to-video (pivot
 * 2026-07-19). Reads data/scenes/generated/<slug>/film-manifest.json (written by
 * /api/generate/start), submits one i2v shot per beat in queue mode, polls, then
 * xfade-concats the clips into final/<slug>.mp4.
 *
 * Run (paid — spends FAL_KEY):
 *   npx tsx scripts/render-film.mts --slug=roosevelt-island --model=kling-v3-turbo-std --yes
 * Dry cost estimate (no submit):
 *   npx tsx scripts/render-film.mts --slug=roosevelt-island
 * Reads FAL_KEY from .env.local. Never prints the key. Muted clips (narration
 * is layered later). After it finishes, run: node scripts/sync-public.mjs
 */
import { copyFileSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fal } from "@fal-ai/client";
import { I2V_MODELS, I2V_DEFAULT, COST_CONFIRMATION_THRESHOLD_USD } from "../lib/models.ts";
import { buildI2vInput, xfadeConcat } from "../lib/film-assemble.ts";

const ROOT = process.cwd();
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const slug = (args.slug as string) ?? "roosevelt-island";
const modelKey = (args.model as string) ?? I2V_DEFAULT;
const durationDefault = Number(args.duration ?? 5);
const go = Boolean(args.yes);
const TRANSITION_DUR = 0.7;

const model = I2V_MODELS[modelKey];
if (!model) throw new Error(`unknown i2v model "${modelKey}" — options: ${Object.keys(I2V_MODELS).join(", ")}`);

const manifestPath = `${ROOT}/data/scenes/generated/${slug}/film-manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const isRenderable = (b: ManifestShot) =>
  b.mode === "generated" && Boolean(b.frameUrl) && b.frameSource !== "placeholder";
const shots = (manifest.beats as ManifestShot[]).filter(isRenderable);
const skipped = (manifest.beats as ManifestShot[]).filter((b) => !isRenderable(b));

interface ManifestShot {
  index: number;
  beatId: string;
  act: string;
  mode: string;
  frameUrl: string | null;
  frameSource: string | null;
  durationSeconds: number;
  motionPrompt: string;
  transitionOut: { type: string; note: string } | null;
}

const estCost = shots.reduce((s, b) => s + model.unitPrice * (b.durationSeconds || durationDefault), 0);
process.stdout.write(
  `Film: ${slug}\nModel: ${model.displayName} ($${model.unitPrice}/s)\nShots: ${shots.length}` +
    `${skipped.length ? ` (skipping ${skipped.length}: no generated frame)` : ""}\n` +
    `Estimated cost: ~$${estCost.toFixed(2)}\n`,
);
if (skipped.length) for (const s of skipped) process.stdout.write(`  · skip ${s.beatId} (${s.mode}, source=${s.frameSource})\n`);

if (!go) {
  process.stdout.write(`\nDry run. Re-run with --yes to submit (paid).\n`);
  process.exit(0);
}
if (model.heroOnly || estCost > COST_CONFIRMATION_THRESHOLD_USD) {
  // A second guardrail even with --yes, for hero / over-threshold runs.
  if (!args.confirm) {
    process.stdout.write(`\n⚠ hero model or >$${COST_CONFIRMATION_THRESHOLD_USD}; add --confirm to proceed.\n`);
    process.exit(1);
  }
}

// --- FAL key ---
const falKey = readFileSync(`${ROOT}/.env.local`, "utf8").match(/^FAL_KEY=(.*)$/m)?.[1]?.trim();
if (!falKey) throw new Error("FAL_KEY not found in .env.local");
fal.config({ credentials: falKey });

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function renderShot(shot: ManifestShot, dest: string): Promise<void> {
  const duration = shot.durationSeconds || durationDefault;
  const input = buildI2vInput(model, shot.frameUrl!, shot.motionPrompt, duration);
  const { request_id } = await fal.queue.submit(model.endpointId, { input });
  process.stdout.write(`  submit ${shot.beatId} → ${request_id}\n`);
  for (let t = 0; t < 240; t++) {
    const st = (await fal.queue.status(model.endpointId, { requestId: request_id })) as { status: string };
    if (st.status === "COMPLETED") break;
    await sleep(5000);
  }
  const res = await fal.queue.result(model.endpointId, { requestId: request_id });
  const url = (res.data as { video?: { url: string } }).video?.url;
  if (!url) throw new Error(`no video url for ${shot.beatId}`);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(dest, buf);
  process.stdout.write(`  ✓ ${shot.beatId} → ${dest} (req ${request_id})\n`);
}

const clipsDir = `${ROOT}/renders/${slug}`;
mkdirSync(clipsDir, { recursive: true });
const clipPaths: string[] = [];
for (const shot of shots) {
  const dest = `${clipsDir}/clip_${String(shot.index).padStart(2, "0")}.mp4`;
  await renderShot(shot, dest);
  clipPaths.push(dest);
}

mkdirSync(`${ROOT}/final`, { recursive: true });
const finalOut = `${ROOT}/final/${slug}.mp4`;
const transitions = shots.map((s) => s.transitionOut?.type ?? null);
process.stdout.write(`\nConcatenating ${clipPaths.length} clips with xfade…\n`);
xfadeConcat(clipPaths, transitions, finalOut, TRANSITION_DUR);
copyFileSync(finalOut, `${clipsDir}/silent-master.mp4`);
process.stdout.write(`\n✓ film → ${finalOut}\nNext: node scripts/sync-public.mjs  (copies into public/films/)\n`);
