import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs, recipeHashInput, resolveSelection, validateConfig } from "../scripts/batch-cutout.mjs";
import { assertFalVerificationFresh, buildCacheIdentity, hashJson, validateCrop } from "../scripts/fal-mask.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("CLI separates local rebuilds from paid mask refreshes", () => {
  const args = parseArgs([
    "--dry-run",
    "--only",
    "asset_005,asset_001_smallpox_cutout",
    "--force",
    "--refresh-mask",
    "--tone",
    "sepia",
    "--edge",
    "scissor",
  ]);
  assert.equal(args.dryRun, true);
  assert.equal(args.force, true);
  assert.equal(args.refreshMask, true);
  assert.deepEqual([...args.only], ["asset_005", "asset_001_smallpox_cutout"]);
  assert.equal(args.tone, "sepia");
  assert.equal(args.edge, "scissor");
  assert.throws(() => parseArgs(["--tone", "invented"]), /--tone/);
  assert.throws(() => parseArgs(["--refresh-mask=yes"]), /Unknown argument/);
});

test("Roosevelt Island v2 recipes are complete, named, and source-audited", async () => {
  const config = JSON.parse(await readFile(path.join(root, "data/preprocess/roosevelt-island.json"), "utf8"));
  const place = JSON.parse(await readFile(path.join(root, "data/places/roosevelt-island.json"), "utf8"));
  assert.equal(validateConfig(config, place), true);
  assert.equal(config.recipes.length, 24);
  assert.equal(new Set(config.recipes.map((recipe) => recipe.assetId)).size, 18);
  assert.equal(config.recipes.filter((recipe) => recipe.mask?.provider === "fal").length, 8);
  assert.equal(config.recipes.filter((recipe) => recipe.publish === false).length, 5);
  assert.equal(config.recipes.some((recipe) => recipe.assetId === "asset_013"), false);
  for (const recipe of config.recipes) {
    assert.match(recipe.sourceSha256, /^[a-f0-9]{64}$/);
    assert.equal(recipe.recipeSha256, hashJson(recipeHashInput(recipe)), `${recipe.id} has a stale declared recipe hash`);
  }

  const workhouse = config.recipes.find((recipe) => recipe.id === "asset_005_workhouse_card");
  assert.deepEqual(workhouse.crop, [0.108, 0.04, 0.755, 0.56]);
  assert.match(workhouse.exclude, /grayscale strip/i);

  const calibrationCropRegression = new Map([
    ["asset_004_asylum1866_card", [0.205, 0.035, 0.58, 0.56]],
    ["asset_005_workhouse_card", [0.108, 0.04, 0.755, 0.56]],
    ["asset_006_penitentiary_card", [0.075, 0.035, 0.85, 0.68]],
    ["asset_007_almshouse_card", [0.195, 0.055, 0.6, 0.52]],
    ["asset_008_darkcell_card", [0.305, 0.075, 0.305, 0.5]],
    ["asset_009_bridgeplan_card", [0.035, 0.02, 0.93, 0.77]],
  ]);
  for (const [id, expected] of calibrationCropRegression) {
    const recipe = config.recipes.find((item) => item.id === id);
    assert.deepEqual(recipe.crop, expected, `${id} must keep its reviewed calibration-strip crop`);
  }
});

test("human review metadata does not invalidate paid mask pixels", () => {
  const base = { id: "asset_x", review: "approved", role: "cutout", mask: { prompt: "building" } };
  const reviewed = {
    ...base,
    review: { source: "approved", visual: "rejected", notes: "holes" },
    publish: false,
    fallbackRecipeId: "asset_x_card",
  };
  assert.equal(hashJson(recipeHashInput(base)), hashJson(recipeHashInput(reviewed)));
});

test("selection supports global values and recipe overrides", () => {
  const recipe = { id: "asset_005_workhouse_card", assetId: "asset_005", defaultTone: "mono", defaultEdge: "torn" };
  assert.deepEqual(resolveSelection(recipe, { tone: "defaults", edge: "defaults" }), { tone: "mono", edge: "torn" });
  assert.deepEqual(resolveSelection(recipe, { tone: "sepia", edge: "scissor" }), { tone: "sepia", edge: "scissor" });
  assert.deepEqual(
    resolveSelection(recipe, {
      tone: "source",
      edge: "scissor",
      overrides: { asset_005: { tone: "mono" }, asset_005_workhouse_card: { tone: "sepia", edge: "torn" } },
    }),
    { tone: "sepia", edge: "torn" }
  );
});

test("crop validation rejects spill and zero-area crops", () => {
  assert.deepEqual(validateCrop([0.1, 0.2, 0.3, 0.4]), [0.1, 0.2, 0.3, 0.4]);
  assert.throws(() => validateCrop([0.8, 0.2, 0.3, 0.4]), /fit inside/);
  assert.throws(() => validateCrop([0.1, 0.2, 0, 0.4]), /fit inside/);
});

test("cache identity is stable but invalidates on source, recipe, tool, or mask config changes", () => {
  assert.equal(hashJson({ b: 2, a: 1 }), hashJson({ a: 1, b: 2 }));
  const base = { sourceSha256: "source", recipeSha256: "recipe", toolSha256: "tool", maskConfigSha256: "mask" };
  const first = buildCacheIdentity(base);
  assert.equal(first.cacheKey, buildCacheIdentity({ ...base }).cacheKey);
  for (const key of Object.keys(base)) {
    assert.notEqual(first.cacheKey, buildCacheIdentity({ ...base, [key]: `${base[key]}-changed` }).cacheKey);
  }
});

test("paid refresh requires fresh schema/pricing metadata and apply_mask:false", () => {
  const valid = {
    model: "fal-ai/sam-3/image",
    unit: "request",
    unitPriceUsd: 0.005,
    schemaCheckedAt: "2026-07-18",
    pricingCheckedAt: "2026-07-18",
    inputContract: { apply_mask: false },
  };
  assert.doesNotThrow(() => assertFalVerificationFresh(valid, new Date("2026-07-18T12:00:00Z")));
  assert.throws(
    () => assertFalVerificationFresh({ ...valid, schemaCheckedAt: "2026-07-15" }, new Date("2026-07-18T12:00:00Z")),
    /stale/
  );
  assert.throws(() => assertFalVerificationFresh({ ...valid, inputContract: { apply_mask: true } }, new Date("2026-07-18T12:00:00Z")), /apply_mask:false/);
});

test("regression scenes reference existing, visually approved outputs", async () => {
  const config = JSON.parse(await readFile(path.join(root, "data/preprocess/roosevelt-island.json"), "utf8"));
  const rejectedOutputs = new Set(config.recipes.filter((recipe) => recipe.publish === false).map((recipe) => recipe.output));
  for (const relativeScene of ["data/scenes/test-collage.json", "data/scenes/s1-stasis.json", "data/scenes/s3-time-corridor.json"]) {
    const scene = JSON.parse(await readFile(path.join(root, relativeScene), "utf8"));
    for (const plane of scene.planes) {
      assert.equal(rejectedOutputs.has(plane.asset), false, `${relativeScene} references a visually rejected output`);
      await readFile(path.join(root, plane.asset));
    }
  }
});
