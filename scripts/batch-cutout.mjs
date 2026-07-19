#!/usr/bin/env node

import * as cutoutApi from "./cutout.mjs";
import {
  FAL_MASK_TOOL_VERSION,
  assertFalVerificationFresh,
  buildCacheIdentity,
  estimateFalMaskCost,
  generateFalMask,
  hashFile,
  hashJson,
  inspectMaskCache,
  sha256,
  stableStringify,
  validateCrop,
} from "./fal-mask.mjs";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BATCH_TOOL_VERSION = "batch-cutout-v2.0.0";
export const CONFIG_PATH = "data/preprocess/roosevelt-island.json";
export const PLACE_JSON = "data/places/roosevelt-island.json";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VALID_TONES = new Set(["source", "mono", "sepia"]);
const VALID_EDGES = new Set(["scissor", "torn"]);
const VALID_ROLES = new Set(["card", "cutout", "bg"]);
const SHA256_RE = /^[a-f0-9]{64}$/;

export function parseArgs(argv) {
  const args = {
    dryRun: false,
    force: false,
    refreshMask: false,
    only: null,
    tone: "defaults",
    edge: "defaults",
  };
  const takeValue = (index, flag) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    return value;
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--refresh-mask") args.refreshMask = true;
    else if (arg === "--only") args.only = new Set(takeValue(index++, arg).split(",").filter(Boolean));
    else if (arg === "--tone") args.tone = takeValue(index++, arg);
    else if (arg === "--edge") args.edge = takeValue(index++, arg);
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.tone !== "defaults" && !VALID_TONES.has(args.tone)) {
    throw new Error(`--tone must be source, mono, or sepia; received ${args.tone}`);
  }
  if (args.edge !== "defaults" && !VALID_EDGES.has(args.edge)) {
    throw new Error(`--edge must be scissor or torn; received ${args.edge}`);
  }
  return args;
}

export const USAGE = `Usage:
  node --env-file-if-exists=.env.local scripts/batch-cutout.mjs [options]

Options:
  --dry-run                       inspect recipes/cache/cost; write nothing
  --only asset_005,recipe_id      select asset ids and/or exact recipe ids
  --force                         rebuild local pixels; never refresh a fal mask
  --refresh-mask                  explicitly submit selected fal mask jobs
  --tone source|mono|sepia        global materialization override
  --edge scissor|torn             global materialization override
  --help                          show this message

Only --refresh-mask can incur fal cost. A missing/stale mask otherwise uses local
silueta/rembg and finally a visibly recorded card fallback.`;

function abs(relativePath) {
  const resolved = path.resolve(PROJECT_ROOT, relativePath);
  const relative = path.relative(PROJECT_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Path escapes project root: ${relativePath}`);
  return resolved;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(abs(relativePath), "utf8"));
}

async function writeJsonAtomic(relativePath, value) {
  const destination = abs(relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  try {
    await rename(temporary, destination);
  } catch (error) {
    if (!(await exists(destination))) throw error;
    await rm(destination, { force: true });
    await rename(temporary, destination);
  }
}

export function validateConfig(config, place) {
  if (config.schemaVersion !== 2 || !Array.isArray(config.recipes)) throw new Error("Expected preprocess schemaVersion 2 with recipes[]");
  const assets = new Map(place.assets.map((asset) => [asset.id, asset]));
  const recipeIds = new Set();
  const outputs = new Set();
  for (const recipe of config.recipes) {
    if (!recipe.id || recipeIds.has(recipe.id)) throw new Error(`Duplicate or missing recipe id: ${recipe.id}`);
    if (!recipe.output || outputs.has(recipe.output)) throw new Error(`Duplicate or missing recipe output: ${recipe.output}`);
    if (!SHA256_RE.test(recipe.sourceSha256 ?? "") || !SHA256_RE.test(recipe.recipeSha256 ?? "")) {
      throw new Error(`${recipe.id}: sourceSha256 and recipeSha256 must be lowercase SHA-256 hashes`);
    }
    recipeIds.add(recipe.id);
    outputs.add(recipe.output);
    if (!VALID_ROLES.has(recipe.role)) throw new Error(`${recipe.id}: invalid role ${recipe.role}`);
    const asset = assets.get(recipe.assetId);
    if (!asset) throw new Error(`${recipe.id}: unknown asset ${recipe.assetId}`);
    if (!asset.source || !asset.source_url || !asset.license) throw new Error(`${recipe.id}: source, source_url, and license are required`);
    if (asset.file !== recipe.input) throw new Error(`${recipe.id}: input does not match the place manifest (${asset.file})`);
    validateCrop(recipe.crop);
    if (!VALID_TONES.has(recipe.defaultTone)) throw new Error(`${recipe.id}: invalid defaultTone ${recipe.defaultTone}`);
    const allowedEdges = new Set([...VALID_EDGES, "none"]);
    if (!allowedEdges.has(recipe.defaultEdge)) throw new Error(`${recipe.id}: invalid defaultEdge ${recipe.defaultEdge}`);
    if (!Number.isFinite(recipe.maxSize) || recipe.maxSize <= 0) throw new Error(`${recipe.id}: maxSize must be positive`);
    if (recipe.review && typeof recipe.review === "object") {
      if (!["pending", "approved", "rejected"].includes(recipe.review.source)) {
        throw new Error(`${recipe.id}: review.source must be pending, approved, or rejected`);
      }
      if (!["pending", "approved", "rejected"].includes(recipe.review.visual)) {
        throw new Error(`${recipe.id}: review.visual must be pending, approved, or rejected`);
      }
      if (recipe.publish === false && recipe.review.visual !== "rejected") {
        throw new Error(`${recipe.id}: publish:false requires review.visual rejected`);
      }
    }
    const suffix = recipe.role === "cutout" ? "_cutout.png" : recipe.role === "card" ? "_card.png" : "_bg.png";
    if (!recipe.output.endsWith(suffix)) throw new Error(`${recipe.id}: ${recipe.role} output must end with ${suffix}`);
    if (recipe.role === "cutout") {
      if (!recipe.mask || !["fal", "local-paper"].includes(recipe.mask.provider)) {
        throw new Error(`${recipe.id}: cutout needs a fal or local-paper mask contract`);
      }
      if (recipe.mask.provider === "fal") {
        if (recipe.mask.model !== config.fal.model) throw new Error(`${recipe.id}: cutout needs the configured fal mask model`);
        if (!Array.isArray(recipe.mask.attempts) || recipe.mask.attempts.length < 1 || recipe.mask.attempts.length > 2) {
          throw new Error(`${recipe.id}: mask attempts must contain one or two prompts`);
        }
      }
    } else if (recipe.mask) {
      throw new Error(`${recipe.id}: only cutout recipes may declare a mask`);
    }
  }
  if (config.recipes.some((recipe) => recipe.assetId === "asset_013")) throw new Error("asset_013 must remain deferred until a page is selected");
  return true;
}

export function resolveSelection(recipe, selection) {
  const assetOverride = selection.overrides?.[recipe.assetId] ?? {};
  const recipeOverride = selection.overrides?.[recipe.id] ?? {};
  const selectedTone = recipeOverride.tone ?? assetOverride.tone ?? selection.tone ?? "defaults";
  const selectedEdge = recipeOverride.edge ?? assetOverride.edge ?? selection.edge ?? "defaults";
  return {
    tone: selectedTone === "defaults" ? recipe.defaultTone : selectedTone,
    edge: selectedEdge === "defaults" ? recipe.defaultEdge : selectedEdge,
  };
}

function recipeSelected(recipe, only) {
  return !only || only.has(recipe.assetId) || only.has(recipe.id);
}

function provenancePath(recipe) {
  return `data/preprocess/provenance/${recipe.id}.json`;
}

async function inspectOutputCache({ recipe, sourceSha256, recipeSha256, toolSha256, selectionSha256 }) {
  const outputPath = abs(recipe.output);
  const recordPath = provenancePath(recipe);
  if (!(await exists(outputPath)) || !(await exists(abs(recordPath)))) return { valid: false, reason: "output_or_provenance_missing" };
  try {
    const provenance = await readJson(recordPath);
    const expected = { sourceSha256, recipeSha256, toolSha256, selectionSha256 };
    for (const [key, value] of Object.entries(expected)) {
      if (provenance.cache?.[key] !== value) return { valid: false, reason: `${key}_mismatch`, provenance };
    }
    const outputSha256 = await hashFile(outputPath);
    if (provenance.output?.sha256 !== outputSha256) return { valid: false, reason: "output_content_hash_mismatch", provenance };
    return { valid: true, provenance, outputSha256 };
  } catch (error) {
    return { valid: false, reason: `provenance_unreadable:${error.message}` };
  }
}

function makeToolSha256(config) {
  return hashJson({
    batch: BATCH_TOOL_VERSION,
    mask: FAL_MASK_TOOL_VERSION,
    pixels: cutoutApi.PREPROCESS_TOOL_VERSION ?? cutoutApi.CUTOUT_TOOL_VERSION ?? config.toolVersion,
  });
}

// Review decisions and the publish gate do not affect source pixels or mask
// semantics. Normalize them out without invalidating already-paid mask caches.
export function recipeHashInput(recipe) {
  const normalized = { ...recipe };
  if (normalized.review && typeof normalized.review === "object") {
    normalized.review = normalized.review.source ?? "pending";
  }
  delete normalized.publish;
  delete normalized.fallbackRecipeId;
  delete normalized.sourceSha256;
  delete normalized.recipeSha256;
  return normalized;
}

async function makeRecipeState(recipe, config, selection) {
  const sourceSha256 = await hashFile(abs(recipe.input));
  const recipeSha256 = hashJson(recipeHashInput(recipe));
  if (recipe.sourceSha256 !== sourceSha256) throw new Error(`${recipe.id}: declared sourceSha256 does not match ${recipe.input}`);
  if (recipe.recipeSha256 !== recipeSha256) throw new Error(`${recipe.id}: declared recipeSha256 is stale`);
  const toolSha256 = makeToolSha256(config);
  const resolvedSelection = resolveSelection(recipe, selection);
  const selectionSha256 = hashJson(resolvedSelection);
  const outputCache = await inspectOutputCache({ recipe, sourceSha256, recipeSha256, toolSha256, selectionSha256 });
  const maskConfigSha256 = hashJson(recipe.mask ?? null);
  const maskCacheIdentity = buildCacheIdentity({ sourceSha256, recipeSha256, toolSha256, maskConfigSha256 });
  const maskCache = recipe.mask?.provider === "fal"
    ? await inspectMaskCache({ recipe, cacheIdentity: maskCacheIdentity, projectRoot: PROJECT_ROOT })
    : { valid: false, reason: "not_applicable" };
  return {
    recipe,
    sourceSha256,
    recipeSha256,
    toolSha256,
    resolvedSelection,
    selectionSha256,
    outputCache,
    maskConfigSha256,
    maskCacheIdentity,
    maskCache,
  };
}

function summarizeAction(state, args) {
  if (state.recipe.publish === false) {
    return `visual review rejected; use ${state.recipe.fallbackRecipeId ?? "recorded fallback"}`;
  }
  const refresh = args.refreshMask && state.recipe.mask?.provider === "fal";
  if (!args.force && !refresh && state.outputCache.valid) return "cached";
  if (refresh) return "refresh fal mask, then materialize";
  if (state.recipe.mask?.provider === "local-paper") return "materialize with local paper/ink mask";
  if (state.maskCache.valid) return "materialize from cached fal mask";
  if (state.recipe.role === "cutout") return "materialize with local rembg/card fallback (no fal call)";
  return "materialize locally";
}

function pruneUnpublishedManifestEntries(place, recipes) {
  const rejectedRecipeIds = new Set(recipes.filter((recipe) => recipe.publish === false).map((recipe) => recipe.id));
  let changed = false;
  for (const asset of place.assets) {
    if (!Array.isArray(asset.cutouts)) continue;
    const kept = asset.cutouts.filter((entry) => !rejectedRecipeIds.has(entry?.recipe_id));
    if (kept.length !== asset.cutouts.length) {
      asset.cutouts = kept;
      changed = true;
    }
  }
  return changed;
}

async function syncRejectedProvenance(states, falConfig) {
  for (const state of states.filter((item) => item.recipe.publish === false)) {
    const recordPath = provenancePath(state.recipe);
    if (!(await exists(abs(recordPath)))) continue;
    const provenance = await readJson(recordPath);
    provenance.review = state.recipe.review;
    provenance.published = false;
    if (provenance.output) provenance.output.published = false;
    provenance.falCalls = (provenance.falCalls ?? []).map((call) => ({
      ...call,
      schema_checked_at: falConfig.schemaCheckedAt,
      price_checked_at: falConfig.pricingCheckedAt,
      unit_price_usd: falConfig.unitPriceUsd,
      pricing_unit: falConfig.unit,
    }));
    await writeJsonAtomic(recordPath, provenance);
  }
}

async function publishStagedBatch(items) {
  const prepared = items.map((item, index) => ({
    stagedPath: item.stageOutput,
    finalPath: abs(item.provenance.output.file),
    backupPath: `${abs(item.provenance.output.file)}.backup-${process.pid}-${Date.now()}-${index}`,
    hadExisting: false,
    published: false,
  }));
  try {
    for (const item of prepared) {
      await mkdir(path.dirname(item.finalPath), { recursive: true });
      item.hadExisting = await exists(item.finalPath);
      if (item.hadExisting) await rename(item.finalPath, item.backupPath);
    }
    for (const item of prepared) {
      await rename(item.stagedPath, item.finalPath);
      item.published = true;
    }
    for (const item of prepared) if (item.hadExisting) await rm(item.backupPath, { force: true });
  } catch (error) {
    for (const item of [...prepared].reverse()) {
      if (item.published && (await exists(item.finalPath))) await rm(item.finalPath, { force: true });
      if (item.hadExisting && (await exists(item.backupPath))) await rename(item.backupPath, item.finalPath);
    }
    throw error;
  }
}

function makeManifestEntry(provenance) {
  return {
    recipe_id: provenance.recipeId,
    file: provenance.output.file,
    role: provenance.actualRole,
    requested_role: provenance.role,
    tone: provenance.selection.tone,
    edge: provenance.selection.edge,
    source_sha256: provenance.source.sha256,
    recipe_sha256: provenance.cache.recipeSha256,
    output_sha256: provenance.output.sha256,
    pixel_origin: provenance.pixelOrigin,
    operations: provenance.operations,
    fal_calls: provenance.falCalls,
    review: provenance.review,
    qa: provenance.qa,
    quality_warnings: provenance.qualityWarnings,
  };
}

function normalizeRecipeReview(review) {
  if (review && typeof review === "object") return review;
  const status = review ?? "pending";
  return { source: status, visual: status, reviewedAt: null, notes: null };
}

function mergeManifestCutout(asset, provenance) {
  const kept = (Array.isArray(asset.cutouts) ? asset.cutouts : []).filter((entry) => {
    if (entry.recipe_id === provenance.recipeId || entry.file === provenance.output.file) return false;
    if (provenance.role === "cutout" && entry.mode === "auto") return false;
    if ((provenance.role === "card" || provenance.role === "bg") && entry.mode === "paper") return false;
    if (entry.role === provenance.role) return false;
    return true;
  });
  asset.cutouts = [...kept, makeManifestEntry(provenance)];
}

async function materializeState({ state, config, selection, args, stagingDir }) {
  const recipe = state.recipe;
  let maskPath = state.maskCache.valid ? state.maskCache.cacheFile : null;
  let maskSha256 = state.maskCache.valid ? state.maskCache.maskSha256 : null;
  let falCalls = state.maskCache.valid ? state.maskCache.metadata.calls ?? [] : [];
  let maskFallback = state.maskCache.valid ? null : state.maskCache.reason;

  let maskBuffer = null;
  if (recipe.mask?.provider === "local-paper") {
    maskBuffer = await cutoutApi.createPaperInkMask(await readFile(abs(recipe.input)), {
      crop: recipe.crop,
      maxSize: recipe.maxSize,
      ...recipe.mask,
    });
    maskSha256 = sha256(maskBuffer);
    maskFallback = null;
  }

  if (args.refreshMask && recipe.mask?.provider === "fal") {
    try {
      const generated = await generateFalMask({
        recipe,
        falConfig: config.fal,
        cacheIdentity: state.maskCacheIdentity,
        projectRoot: PROJECT_ROOT,
      });
      maskPath = generated.maskPath;
      maskSha256 = generated.maskSha256;
      falCalls = generated.calls;
      maskFallback = null;
    } catch (error) {
      falCalls = error.falCalls ?? falCalls;
      maskPath = null;
      maskSha256 = null;
      maskFallback = `fal_failed:${error.message}`;
      console.warn(`  fal mask failed for ${recipe.id}; using local fallback: ${error.message}`);
    }
  }

  const stageOutput = path.join(stagingDir, path.basename(recipe.output));
  const stageOutputRelative = path.relative(PROJECT_ROOT, stageOutput).replaceAll("\\", "/");
  const stagedRecipe = { ...recipe, output: stageOutputRelative, seed: recipe.edgeSeed ?? recipe.seed };
  const inputBuffer = await readFile(abs(recipe.input));
  const materialize = cutoutApi.materializeCutout;
  if (typeof materialize !== "function") {
    throw new Error("scripts/cutout.mjs must export materializeCutout(recipe, selection, context) for preprocess v2");
  }

  let result;
  let actualRole = recipe.role;
  let fallbackReason = maskFallback;
  try {
    result = await materialize(stagedRecipe, selection, {
      projectRoot: PROJECT_ROOT,
      inputBuffer,
      output: stageOutput,
      maskBuffer,
      maskPath,
      cachedMaskPath: maskPath,
      allowRembg: true,
      rembgModel: "silueta",
      finalOutput: recipe.output,
    });
  } catch (error) {
    if (recipe.role !== "cutout" || !recipe.mask?.fallback?.includes("card")) throw error;
    actualRole = "card";
    fallbackReason = `${fallbackReason ? `${fallbackReason};` : ""}rembg_failed:${error.message}`;
    const cardRecipe = { ...stagedRecipe, role: "card", mask: null, defaultEdge: "torn" };
    result = await materialize(cardRecipe, selection, {
      projectRoot: PROJECT_ROOT,
      inputBuffer,
      output: stageOutput,
      allowRembg: false,
      finalOutput: recipe.output,
    });
  }

  if (!(await exists(stageOutput))) throw new Error(`${recipe.id}: materializer did not create ${stageOutputRelative}`);
  const resultQa = result?.qa ?? result?.provenance?.qa ?? null;
  if (resultQa?.valid === false) throw new Error(`${recipe.id}: automatic QA failed: ${stableStringify(resultQa)}`);
  const outputSha256 = await hashFile(stageOutput);
  const coreProvenance = result?.provenance ?? result ?? {};
  const resolved = state.resolvedSelection;
  const operations = coreProvenance.operations ?? result?.operations ?? [];
  const tracedFalCalls = falCalls.map((call) => ({
    ...call,
    schema_checked_at: config.fal.schemaCheckedAt,
    price_checked_at: config.fal.pricingCheckedAt,
    unit_price_usd: config.fal.unitPriceUsd,
    pricing_unit: config.fal.unit,
  }));
  const provenance = {
    schemaVersion: 2,
    recipeId: recipe.id,
    assetId: recipe.assetId,
    role: recipe.role,
    actualRole,
    source: { file: recipe.input, sha256: state.sourceSha256 },
    output: { file: recipe.output, sha256: outputSha256 },
    cache: {
      sourceSha256: state.sourceSha256,
      recipeSha256: state.recipeSha256,
      toolSha256: state.toolSha256,
      selectionSha256: state.selectionSha256,
      cacheKey: sha256(`${state.sourceSha256}:${state.recipeSha256}:${state.toolSha256}:${state.selectionSha256}`),
    },
    selection: resolved,
    pixelOrigin: "Original locally processed source RGB; fal/rembg may only determine alpha and never repaint archive pixels.",
    operations,
    mask: recipe.mask
      ? {
          provider:
            recipe.mask.provider === "local-paper"
              ? "local-paper"
              : maskPath
                ? "fal-cache"
                : actualRole === "cutout"
                  ? "rembg:silueta"
                  : "none",
          file: maskPath ? recipe.mask.cacheFile : null,
          sha256: maskSha256,
          cacheKey: state.maskCacheIdentity.cacheKey,
          fallback: fallbackReason,
        }
      : null,
    falCalls: tracedFalCalls,
    qa: resultQa,
    review: normalizeRecipeReview(recipe.review),
    identity: recipe.identity,
    preserve: recipe.preserve,
    exclude: recipe.exclude,
    qualityWarnings: recipe.qualityWarnings ?? [],
    createdAt: new Date().toISOString(),
  };
  return { state, stageOutput, provenance };
}

export async function runBatch(args) {
  const config = await readJson(CONFIG_PATH);
  const place = await readJson(PLACE_JSON);
  validateConfig(config, place);
  const selection = { tone: args.tone, edge: args.edge, overrides: {} };
  const recipes = config.recipes.filter((recipe) => recipeSelected(recipe, args.only));

  if (args.only && recipes.length === 0) {
    const deferred = config.deferred.filter((item) => args.only.has(item.assetId));
    if (deferred.length) {
      for (const item of deferred) console.log(`DEFERRED ${item.assetId}: ${item.reason}`);
      return { built: 0, cached: 0, deferred: deferred.length };
    }
    throw new Error(`--only did not match any asset or recipe: ${[...args.only].join(",")}`);
  }

  const states = [];
  for (const recipe of recipes) states.push(await makeRecipeState(recipe, config, selection));
  const maximumCost = args.refreshMask
    ? states
        .filter((state) => state.recipe.mask?.provider === "fal" && state.recipe.publish !== false)
        .reduce((sum, state) => sum + estimateFalMaskCost(state.recipe, config.fal), 0)
    : 0;
  if (maximumCost > 2) throw new Error(`Maximum fal mask cost $${maximumCost.toFixed(3)} exceeds $2; obtain developer approval before continuing`);

  console.log(`Preprocess v2: ${states.length} recipe(s), maximum fal cost $${maximumCost.toFixed(3)}`);
  for (const state of states) {
    console.log(
      `${args.dryRun ? "DRY" : "PLAN"} ${state.recipe.id}: ${summarizeAction(state, args)} ` +
        `(output=${state.outputCache.reason ?? "valid"}, mask=${state.maskCache.reason ?? "valid"}, tone=${state.resolvedSelection.tone}, edge=${state.resolvedSelection.edge})`
    );
  }
  if (args.dryRun) return { built: 0, cached: states.filter((state) => summarizeAction(state, args) === "cached").length, maximumCost };
  if (args.refreshMask && states.some((state) => state.recipe.mask?.provider === "fal" && state.recipe.publish !== false)) assertFalVerificationFresh(config.fal);

  const manifestChanged = pruneUnpublishedManifestEntries(place, config.recipes);
  await syncRejectedProvenance(states, config.fal);
  const toBuild = states.filter(
    (state) => state.recipe.publish !== false && (args.force || (args.refreshMask && state.recipe.mask) || !state.outputCache.valid)
  );
  const assets = new Map(place.assets.map((asset) => [asset.id, asset]));
  if (toBuild.length === 0) {
    for (const state of states) {
      if (state.recipe.publish !== false && state.outputCache.valid) {
        mergeManifestCutout(assets.get(state.recipe.assetId), state.outputCache.provenance);
      }
    }
    if (manifestChanged || states.some((state) => state.recipe.publish !== false && state.outputCache.valid)) {
      await writeJsonAtomic(PLACE_JSON, place);
    }
    const skipped = states.filter((state) => state.recipe.publish === false).length;
    return { built: 0, cached: states.length - skipped, skipped, maximumCost };
  }
  const stagingDir = abs(`assets/cutouts/.preprocess-staging-${process.pid}-${Date.now()}`);
  await mkdir(stagingDir, { recursive: true });
  const staged = [];
  try {
    for (const state of toBuild) {
      console.log(`BUILD ${state.recipe.id}`);
      staged.push(await materializeState({ state, config, selection, args, stagingDir }));
    }
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true });
    throw error;
  }

  await publishStagedBatch(staged);
  await rm(stagingDir, { recursive: true, force: true });
  for (const item of staged) {
    await writeJsonAtomic(provenancePath(item.state.recipe), item.provenance);
    mergeManifestCutout(assets.get(item.state.recipe.assetId), item.provenance);
  }
  const builtIds = new Set(staged.map((item) => item.state.recipe.id));
  for (const state of states) {
    if (state.recipe.publish !== false && !builtIds.has(state.recipe.id) && state.outputCache.valid) {
      mergeManifestCutout(assets.get(state.recipe.assetId), state.outputCache.provenance);
    }
  }
  await writeJsonAtomic(PLACE_JSON, place);
  const skipped = states.filter((state) => state.recipe.publish === false).length;
  const cached = states.length - staged.length - skipped;
  console.log(`DONE: ${staged.length} built, ${cached} cached, ${skipped} review-rejected, manifest updated`);
  return { built: staged.length, cached, skipped, maximumCost };
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) console.log(USAGE);
    else await runBatch(args);
  } catch (error) {
    console.error(`Preprocess failed: ${error.message}`);
    process.exitCode = 1;
  }
}
