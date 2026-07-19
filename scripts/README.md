# Asset Preprocessing and I2V Experiment Tools

The scripts here serve two purposes: processing sourced archives into reviewed collage layers, and running fal image-to-video experiments from a reviewed storyboard frame. The main video path does not depend on a standalone layered renderer or headless browser.

## 0. One-time Setup

```bash
npm install
cp .env.local.example .env.local # Add FAL_KEY; do not commit this file
```

When fal masks are unavailable, the pipeline falls back to local rembg / silueta. Optionally install them on the development machine:

```bash
pip install rembg[cli] onnxruntime
```

## 1. Preprocessing Core: `cutout.mjs`

```ts
type TonePreset = "source" | "mono" | "sepia";
type EdgeStyle = "scissor" | "torn" | "none";

type PreprocessSelection = {
  tone?: "defaults" | TonePreset;
  edge?: "defaults" | EdgeStyle;
  overrides?: Record<string, { tone?: TonePreset; edge?: EdgeStyle }>;
};

materializeCutout(recipeIdOrRecipe, selection = {}, context = {});
```

Fixed order: EXIF orientation → recipe crop → resize (downscale only) → tone → apply cached mask → edge → white border / shadow → QA. RGB always comes from the local source image; the fal mask replaces alpha only.

- `role:card`: preserves the full content within the crop; defaults to `torn`.
- `role:cutout`: uses subject alpha; defaults to `scissor`.
- `role:bg`: defaults to `none`, with no edge or shadow.
- `source` preserves local color; `mono` produces neutral black and white; `sepia` adds a fixed warm tint on top of mono.
- `maxSize` is only the upper bound for the long edge; upscaling is always prohibited.

## 2. Batch Processing: `batch-cutout.mjs`

```bash
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --dry-run
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --only asset_001,asset_014
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --force
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --only asset_014 --refresh-mask
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --tone sepia --edge scissor
node scripts/preprocess-contact-sheet.mjs
```

All routing is defined in `data/preprocess/roosevelt-island.json`:

- `--dry-run` validates only; it neither writes files nor calls fal.
- `--force` reruns only the local pixel stages; only `--refresh-mask` requests another paid mask.
- fal SAM requests must set `apply_mask:false`; the fallback order is SAM → silueta / rembg → cropped paper card.
- All outputs use `*_card.png`, `*_cutout.png`, or `*_bg.png`.
- A recipe rejected during contact-sheet review must set `review.visual: rejected`, `publish:false`, and `fallbackRecipeId`.
- Masks, provenance, hashes, request IDs, parameters, and costs are stored in their corresponding directories under `data/preprocess/`.

## 3. Manual Collage Static Export

A manual collage must be exported as a single 1280×720 PNG before video generation:

1. Prefer export from `CollageCanvas` in the browser.
2. If external-image CORS or browser differences make export unreliable, use server-side Sharp to composite according to `BeatLayout.items`.
3. Use only visually approved cutouts and user brush strokes.
4. The exported result is the I2V start frame; do not send it back to a matting / segmentation model to reverse-engineer layers.

The corresponding export script / route is still pending; see `PLAN.md`.

## 4. I2V Experiment: `run-experiment.mjs`

The experiment input is an approved generated frame or manual collage PNG. Models may only be selected from `I2V_MODELS` in `lib/models.ts`; the schema and current-day price must be re-verified before any paid call.

```bash
npm run experiment -- \
  --model kling-v3-turbo-std \
  --start renders/beat_01.png \
  --prompt "slow camera push in. the paper boat moves gently across the river. preserve printed text, preserve collage layout, no new objects, no morphing" \
  --duration 5 \
  --tag beat_01_kling_a
```

See `lib/models.ts` for available model keys. A hero model, a model whose price cannot be converted automatically, or a call with an estimate over $5 requires confirmation first, followed by the explicit `--yes-i-know-the-cost` flag.

Outputs:

- `clips/{tag}.mp4`: video returned by the model.
- `data/experiments/{tag}.json`: model, request ID, parameters, estimated cost, and output path.

Each production shot allows no more than 3 attempts. After that, change the storyboard frame, motion, or prompt instead of continuing to reroll.
