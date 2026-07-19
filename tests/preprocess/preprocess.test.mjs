import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

import {
  PREPROCESS_TOOL_VERSION,
  analyzeAlpha,
  applyScissorEdge,
  applyTornEdge,
  buildCacheFingerprint,
  buildCutoutFilename,
  cropToPixels,
  materializeCutout,
  normalizeCrop,
  resolvePreprocessSelection,
  sha256,
  validateMaterializedQa,
} from "../../scripts/cutout.mjs";

async function solid(width, height, colour = { r: 180, g: 30, b: 20 }) {
  return sharp({ create: { width, height, channels: 3, background: colour } }).png().toBuffer();
}

async function alphaRaw(image) {
  return sharp(image).extractChannel("alpha").toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });
}

function baseRecipe(overrides = {}) {
  return {
    id: "asset_test_card",
    role: "card",
    defaultTone: "source",
    defaultEdge: "none",
    border: false,
    shadow: false,
    ...overrides,
  };
}

test("strict normalized crop rejects overflow, zero size, NaN, and extra values", () => {
  assert.deepEqual(normalizeCrop("0.1,0.2,0.3,0.4"), { x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
  assert.throws(() => normalizeCrop("0.8,0,0.3,1"), /fit completely/);
  assert.throws(() => normalizeCrop([0, 0, 0, 1]), /must be > 0/);
  assert.throws(() => normalizeCrop("0,0,nope,1"), /finite/);
  assert.throws(() => normalizeCrop("0,0,1,1,1"), /exactly four/);
  assert.deepEqual(cropToPixels([0.1, 0.2, 0.3, 0.4], 10, 10), { left: 1, top: 2, width: 3, height: 4 });
});

test("crop is evaluated after EXIF orientation", async () => {
  const physical = await sharp({ create: { width: 8, height: 4, channels: 3, background: { r: 20, g: 40, b: 60 } } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const result = await materializeCutout(baseRecipe({ crop: [0, 0, 1, 0.5] }), {}, { inputBuffer: physical, write: false });
  // Orientation 6 swaps visible dimensions to 4x8; top half is 4x4.
  const metadata = await sharp(result.buffer).metadata();
  assert.deepEqual([metadata.width, metadata.height], [4, 4]);
  assert.match(result.operations.join(" "), /exif-auto-orient/);
});

test("maxSize never enlarges and shrinks only when necessary", async () => {
  const input = await solid(10, 6);
  const largeLimit = await materializeCutout(baseRecipe({ maxSize: 100 }), {}, { inputBuffer: input, write: false });
  const smallLimit = await materializeCutout(baseRecipe({ maxSize: 5 }), {}, { inputBuffer: input, write: false });
  assert.deepEqual([largeLimit.qa.outputWidth, largeLimit.qa.outputHeight], [10, 6]);
  assert.deepEqual([smallLimit.qa.outputWidth, smallLimit.qa.outputHeight], [5, 3]);
  assert.match(largeLimit.operations.join(" "), /without-enlargement/);
});

test("source, mono and sepia tones are selected globally or per recipe", async () => {
  const input = await solid(8, 8, { r: 220, g: 80, b: 30 });
  const recipe = baseRecipe({ defaultTone: "mono" });
  assert.deepEqual(resolvePreprocessSelection(recipe, {}), { tone: "mono", edge: "none" });
  assert.deepEqual(resolvePreprocessSelection(recipe, { tone: "source" }), { tone: "source", edge: "none" });
  assert.deepEqual(
    resolvePreprocessSelection(recipe, { tone: "sepia", overrides: { asset_test_card: { tone: "source", edge: "torn" } } }),
    { tone: "source", edge: "torn" }
  );

  const source = await materializeCutout(recipe, { tone: "source" }, { inputBuffer: input, write: false });
  const mono = await materializeCutout(recipe, { tone: "mono" }, { inputBuffer: input, write: false });
  const sepia = await materializeCutout(recipe, { tone: "sepia" }, { inputBuffer: input, write: false });
  const sourcePixel = await sharp(source.buffer).removeAlpha().raw().toBuffer();
  const monoPixel = await sharp(mono.buffer).removeAlpha().raw().toBuffer();
  const sepiaPixel = await sharp(sepia.buffer).removeAlpha().raw().toBuffer();
  assert.deepEqual([...sourcePixel.subarray(0, 3)], [220, 80, 30]);
  assert.equal(monoPixel[0], monoPixel[1]);
  assert.equal(monoPixel[1], monoPixel[2]);
  assert.ok(sepiaPixel[0] > sepiaPixel[1] && sepiaPixel[1] > sepiaPixel[2]);
});

test("seeded torn edge is stable, seed-sensitive, and tears opaque card rectangles", async () => {
  const fullMask = await sharp(Buffer.alloc(96 * 72, 255), { raw: { width: 96, height: 72, channels: 1 } }).png().toBuffer();
  const first = await applyTornEdge(fullMask, { seed: "same", tearWidth: 7 });
  const second = await applyTornEdge(fullMask, { seed: "same", tearWidth: 7 });
  const different = await applyTornEdge(fullMask, { seed: "different", tearWidth: 7 });
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, different);

  const qa = await analyzeAlpha(first);
  assert.ok(qa.coverage > 0.65 && qa.coverage < 0.99, `unexpected torn coverage ${qa.coverage}`);
  const raw = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  const opaqueCountsByRow = [];
  for (let y = 0; y < raw.info.height; y++) {
    let count = 0;
    for (let x = 0; x < raw.info.width; x++) if (raw.data[y * raw.info.width + x] > 8) count++;
    opaqueCountsByRow.push(count);
  }
  assert.ok(new Set(opaqueCountsByRow.slice(0, 12)).size > 2, "torn top edge should be irregular across rows");
  assert.equal(raw.data[36 * 96 + 48], 255, "the card interior must remain solid");
});

test("scissor hardens a soft mask while none preserves it", async () => {
  const pixels = Buffer.from([0, 64, 127, 128, 192, 255]);
  const mask = await sharp(pixels, { raw: { width: 6, height: 1, channels: 1 } }).png().toBuffer();
  const scissor = await applyScissorEdge(mask, { antialias: 0 });
  const source = await sharp(mask).toColourspace("b-w").raw().toBuffer();
  const hardened = await sharp(scissor).toColourspace("b-w").raw().toBuffer();
  assert.deepEqual([...source], [...pixels]);
  assert.deepEqual([...hardened], [0, 0, 0, 255, 255, 255]);
});

test("cached masks change alpha only; local source RGB remains exact", async () => {
  const inputPixels = Buffer.from([
    10, 20, 30, 40, 50, 60,
    70, 80, 90, 100, 110, 120,
  ]);
  const input = await sharp(inputPixels, { raw: { width: 2, height: 2, channels: 3 } }).png().toBuffer();
  const mask = await sharp(Buffer.from([255, 0, 255, 0]), { raw: { width: 2, height: 2, channels: 1 } }).png().toBuffer();
  const result = await materializeCutout(
    baseRecipe({ id: "masked", role: "cutout", defaultEdge: "none" }),
    {},
    { inputBuffer: input, maskBuffer: mask, write: false, allowRembg: false }
  );
  const rgba = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
  assert.equal(rgba.info.channels, 4);
  for (let pixel = 0; pixel < 4; pixel++) {
    assert.deepEqual(
      [...rgba.data.subarray(pixel * 4, pixel * 4 + 3)],
      [...inputPixels.subarray(pixel * 3, pixel * 3 + 3)]
    );
  }
  assert.deepEqual([rgba.data[3], rgba.data[7], rgba.data[11], rgba.data[15]], [255, 0, 255, 0]);
  assert.equal(result.pixelOrigin, "local-source-rgb");
  assert.match(result.operations.join(" "), /cached-mask-alpha-only/);
});

test("card, cutout, and bg roles have distinct alpha behavior", async () => {
  const rgbaInput = await sharp({ create: { width: 5, height: 5, channels: 4, background: { r: 80, g: 100, b: 120, alpha: 0.4 } } })
    .png()
    .toBuffer();
  const card = await materializeCutout(baseRecipe({ role: "card" }), {}, { inputBuffer: rgbaInput, write: false });
  const bg = await materializeCutout(baseRecipe({ role: "bg" }), {}, { inputBuffer: rgbaInput, write: false });
  const cardAlpha = await alphaRaw(card.buffer);
  const bgAlpha = await alphaRaw(bg.buffer);
  assert.ok([...cardAlpha.data].every((value) => value === 255));
  assert.ok([...bgAlpha.data].every((value) => value >= 101 && value <= 103));
  await assert.rejects(
    materializeCutout(baseRecipe({ role: "cutout" }), {}, { inputBuffer: await solid(5, 5), write: false, allowRembg: false }),
    /no cached mask/
  );
});

test("an explicitly missing inspected mask does not reopen a stale recipe cache path", async () => {
  await assert.rejects(
    materializeCutout(
      baseRecipe({
        id: "missing-inspected-mask",
        role: "cutout",
        mask: { cacheFile: "definitely-not-present.png" },
      }),
      {},
      { inputBuffer: await solid(5, 5), maskPath: null, cachedMaskPath: null, write: false, allowRembg: false }
    ),
    /no cached mask/
  );
});

test("materializeCutout resolves recipe ids and blocks visually rejected publication", async () => {
  const input = await solid(5, 5);
  const resolved = baseRecipe({ id: "resolved-card" });
  const result = await materializeCutout("resolved-card", {}, { recipes: [resolved], inputBuffer: input, write: false });
  assert.equal(result.id, "resolved-card");

  await assert.rejects(
    materializeCutout(
      { ...resolved, id: "rejected", publish: false, fallbackRecipeId: "resolved-card" },
      {},
      { inputBuffer: input, write: false }
    ),
    /failed visual review.*resolved-card/
  );
});

test("shadow is behind the white border, and both are outside source content", async () => {
  const result = await materializeCutout(
    baseRecipe({
      role: "card",
      border: { width: 2 },
      shadow: { offsetX: 2, offsetY: 2, blur: 1, opacity: 1 },
    }),
    {},
    { inputBuffer: await solid(12, 12, { r: 255, g: 0, b: 0 }), write: false }
  );
  const raw = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
  const reds = [];
  for (let y = 0; y < raw.info.height; y++) {
    for (let x = 0; x < raw.info.width; x++) {
      const index = (y * raw.info.width + x) * 4;
      if (raw.data[index] > 245 && raw.data[index + 1] < 10 && raw.data[index + 2] < 10 && raw.data[index + 3] > 245) reds.push({ x, y });
    }
  }
  const maxRedX = Math.max(...reds.map(({ x }) => x));
  const middleY = reds[Math.floor(reds.length / 2)].y;
  const borderIndex = (middleY * raw.info.width + maxRedX + 1) * 4;
  assert.ok(raw.data[borderIndex] > 245 && raw.data[borderIndex + 1] > 245 && raw.data[borderIndex + 2] > 245, "white border must composite over shadow");
  assert.ok(result.qa.outputWidth > 12 && result.qa.outputHeight > 12);
});

test("cache fingerprint includes tool version, recipe, mask, tone and edge", () => {
  const sourceHash = sha256("source");
  const recipeHash = sha256("recipe");
  const maskHash = sha256("mask");
  const first = buildCacheFingerprint({ sourceHash, recipeHash, maskHash, tone: "mono", edge: "torn" });
  const same = buildCacheFingerprint({ sourceHash, recipeHash, maskHash, tone: "mono", edge: "torn" });
  const changed = buildCacheFingerprint({ sourceHash, recipeHash, maskHash, tone: "mono", edge: "scissor" });
  assert.equal(first, same);
  assert.notEqual(first, changed);
  assert.equal(PREPROCESS_TOOL_VERSION, "2.0.0");
});

test("role filenames are normalized and explicit", () => {
  assert.equal(buildCutoutFilename("asset_005", "Workhouse", "card"), "asset_005_workhouse_card.png");
  assert.equal(buildCutoutFilename("asset_003", "Map", "bg"), "asset_003_map_bg.png");
  assert.throws(() => buildCutoutFilename("", "map", "bg"), /assetId is required/);
});

test("automatic QA gates alpha, crop enlargement, connected regions, and output dimensions", () => {
  const good = validateMaterializedQa(
    { width: 10, height: 8, opaquePixels: 40, coverage: 0.5, bbox: { left: 1, top: 1, width: 8, height: 6 }, connectedComponents: 1 },
    { role: "cutout", recipe: { mask: { qa: { minCoverage: 0.1, maxCoverage: 0.8 } } }, sourceBounds: { width: 20, height: 16 }, outputMetadata: { width: 14, height: 12 } }
  );
  assert.equal(good.valid, true);
  assert.equal(good.checks.rgbOriginLocal, true);

  const bad = validateMaterializedQa(
    { width: 21, height: 17, opaquePixels: 0, coverage: 0, bbox: null, connectedComponents: 0 },
    { role: "cutout", recipe: {}, sourceBounds: { width: 20, height: 16 }, outputMetadata: { width: 0, height: 0 } }
  );
  assert.equal(bad.valid, false);
  assert.ok(bad.reasons.includes("alphaNonEmpty"));
  assert.ok(bad.reasons.includes("withoutEnlargement"));
  assert.ok(bad.reasons.includes("outputDimensionsValid"));
});
