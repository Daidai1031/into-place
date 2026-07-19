#!/usr/bin/env node
/**
 * Deterministic local asset preprocessing for Into Place.
 *
 * Generative/local segmentation is allowed to decide alpha only. Source RGB is
 * always produced locally: EXIF orientation -> normalized crop -> resize gate ->
 * tone -> cached mask -> edge -> border -> shadow.
 */

import sharp from "sharp";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

export const PREPROCESS_TOOL_VERSION = "2.0.0";
export const TONE_PRESETS = Object.freeze(["source", "mono", "sepia"]);
export const EDGE_STYLES = Object.freeze(["scissor", "torn", "none"]);
export const MATERIAL_ROLES = Object.freeze(["card", "cutout", "bg"]);

const SHA256_RE = /^[a-f0-9]{64}$/;

function assertFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number`);
}

/** Strictly validate a crop in normalized, EXIF-oriented coordinates. */
export function normalizeCrop(crop) {
  if (crop == null || crop === "") return null;

  let values;
  if (typeof crop === "string") {
    values = crop.split(",").map((part) => Number(part.trim()));
  } else if (Array.isArray(crop)) {
    values = crop.map(Number);
  } else if (typeof crop === "object") {
    values = [crop.x ?? crop.left, crop.y ?? crop.top, crop.width ?? crop.w, crop.height ?? crop.h].map(Number);
  } else {
    throw new TypeError("crop must be 'x,y,w,h', a four-value array, or an object");
  }

  if (values.length !== 4) throw new RangeError("crop must contain exactly four values: x,y,width,height");
  const [x, y, width, height] = values;
  for (const [label, value] of Object.entries({ x, y, width, height })) assertFinite(value, `crop.${label}`);
  if (x < 0 || y < 0 || width <= 0 || height <= 0) {
    throw new RangeError("crop x/y must be >= 0 and width/height must be > 0");
  }
  if (x > 1 || y > 1 || width > 1 || height > 1 || x + width > 1 + Number.EPSILON || y + height > 1 + Number.EPSILON) {
    throw new RangeError("crop must fit completely inside normalized EXIF-oriented bounds [0,1]");
  }
  return Object.freeze({ x, y, width, height });
}

/** Convert a normalized crop to inclusive source coverage after EXIF rotation. */
export function cropToPixels(crop, imageWidth, imageHeight) {
  assertFinite(imageWidth, "imageWidth");
  assertFinite(imageHeight, "imageHeight");
  if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    throw new RangeError("image dimensions must be positive integers");
  }
  const normalized = normalizeCrop(crop);
  if (!normalized) return { left: 0, top: 0, width: imageWidth, height: imageHeight };

  const left = Math.floor(normalized.x * imageWidth);
  const top = Math.floor(normalized.y * imageHeight);
  const right = Math.min(imageWidth, left + Math.max(1, Math.round(normalized.width * imageWidth)));
  const bottom = Math.min(imageHeight, top + Math.max(1, Math.round(normalized.height * imageHeight)));
  if (right <= left || bottom <= top) throw new RangeError("crop resolves to zero pixels at this image size");
  return { left, top, width: right - left, height: bottom - top };
}

export function normalizeTone(value = "source") {
  const tone = value === "none" ? "source" : value;
  if (!TONE_PRESETS.includes(tone)) throw new RangeError(`unknown tone '${value}'; expected ${TONE_PRESETS.join(" | ")}`);
  return tone;
}

export function normalizeEdge(value = "none") {
  if (!EDGE_STYLES.includes(value)) throw new RangeError(`unknown edge '${value}'; expected ${EDGE_STYLES.join(" | ")}`);
  return value;
}

export function normalizeRole(value = "cutout") {
  const role = value === "paper" ? "card" : value === "auto" ? "cutout" : value;
  if (!MATERIAL_ROLES.includes(role)) throw new RangeError(`unknown role '${value}'; expected ${MATERIAL_ROLES.join(" | ")}`);
  return role;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object" && !Buffer.isBuffer(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined && typeof value[key] !== "function")
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function seedFrom(value) {
  const digest = createHash("sha256").update(String(value)).digest();
  return digest.readUInt32LE(0) || 0x6d2b79f5;
}

export function createSeededRandom(seed) {
  let state = typeof seed === "number" ? seed >>> 0 : seedFrom(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function findOverride(recipe, selection) {
  const overrides = selection?.overrides ?? {};
  return overrides[recipe.id] ?? overrides[recipe.assetId] ?? {};
}

/** Resolve global defaults and per-recipe overrides without mutating either. */
export function resolvePreprocessSelection(recipe, selection = {}) {
  const override = findOverride(recipe, selection);
  const selectedTone = override.tone ?? selection.tone;
  const selectedEdge = override.edge ?? selection.edge;
  const defaultTone = normalizeTone(recipe.defaultTone ?? recipe.tone ?? (recipe.historical === false ? "source" : "mono"));
  const defaultEdge = normalizeEdge(recipe.defaultEdge ?? recipe.edge ?? (normalizeRole(recipe.role ?? recipe.mode) === "card" ? "torn" : normalizeRole(recipe.role ?? recipe.mode) === "cutout" ? "scissor" : "none"));
  return Object.freeze({
    tone: normalizeTone(!selectedTone || selectedTone === "defaults" ? defaultTone : selectedTone),
    edge: normalizeEdge(!selectedEdge || selectedEdge === "defaults" ? defaultEdge : selectedEdge),
  });
}

export function buildCacheFingerprint({ sourceHash, recipeHash, maskHash = null, tone, edge }) {
  if (!SHA256_RE.test(sourceHash) || !SHA256_RE.test(recipeHash) || (maskHash && !SHA256_RE.test(maskHash))) {
    throw new TypeError("cache hashes must be lowercase SHA-256 hex strings");
  }
  return sha256(stableStringify({ version: PREPROCESS_TOOL_VERSION, sourceHash, recipeHash, maskHash, tone: normalizeTone(tone), edge: normalizeEdge(edge) }));
}

export function buildCutoutFilename(assetId, slug, role) {
  const safe = (value, label) => {
    const result = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!result) throw new TypeError(`${label} is required`);
    return result;
  };
  return `${safe(assetId, "assetId")}_${safe(slug, "slug")}_${normalizeRole(role)}.png`;
}

async function imageToAlpha(maskInput, width, height) {
  const image = sharp(maskInput).rotate().resize(width, height, { fit: "fill", kernel: "lanczos3", withoutEnlargement: false });
  const metadata = await image.metadata();
  const rgba = await image.toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(width * height);
  let alphaHasSignal = false;
  let alphaMin = 255;
  let alphaMax = 0;
  for (let index = 0, pixel = 0; pixel < alpha.length; pixel++, index += rgba.info.channels) {
    const value = rgba.data[index + rgba.info.channels - 1];
    alphaMin = Math.min(alphaMin, value);
    alphaMax = Math.max(alphaMax, value);
  }
  alphaHasSignal = metadata.hasAlpha === true && alphaMax > alphaMin && alphaMin < 250;
  for (let index = 0, pixel = 0; pixel < alpha.length; pixel++, index += rgba.info.channels) {
    alpha[pixel] = alphaHasSignal
      ? rgba.data[index + rgba.info.channels - 1]
      : Math.round(0.2126 * rgba.data[index] + 0.7152 * rgba.data[index + 1] + 0.0722 * rgba.data[index + 2]);
  }
  return Buffer.from(alpha);
}

async function alphaFromRgba(rgbaPng) {
  return sharp(rgbaPng).extractChannel("alpha").toColourspace("b-w").png().toBuffer();
}

async function replaceAlpha(rgbInput, alphaPng, width, height) {
  const alpha = await sharp(alphaPng).resize(width, height, { fit: "fill" }).toColourspace("b-w").raw().toBuffer();
  // removeAlpha and joinChannel are evaluated in libvips' canonical operation
  // order, not necessarily call order. Materialize RGB first so removeAlpha
  // cannot accidentally remove the newly joined mask channel.
  const rgb = await sharp(rgbInput).removeAlpha().png().toBuffer();
  return sharp(rgb)
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

/** Hard, lightly anti-aliased edge suitable for scissors/cutout subjects. */
export async function applyScissorEdge(alphaPng, { threshold = 128, antialias = 0.45 } = {}) {
  assertFinite(threshold, "threshold");
  assertFinite(antialias, "antialias");
  if (threshold < 0 || threshold > 255 || antialias < 0) throw new RangeError("invalid scissor edge options");
  let pipeline = sharp(alphaPng).toColourspace("b-w").threshold(Math.round(threshold));
  if (antialias >= 0.3) pipeline = pipeline.blur(antialias);
  return pipeline.toColourspace("b-w").png().toBuffer();
}

async function seededNoise(width, height, seed, coarseCell, fineCell) {
  const random = createSeededRandom(seed);
  const makeLayer = async (cell) => {
    const gridWidth = Math.max(2, Math.ceil(width / cell) + 2);
    const gridHeight = Math.max(2, Math.ceil(height / cell) + 2);
    const bytes = Buffer.allocUnsafe(gridWidth * gridHeight);
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(random() * 256);
    return sharp(bytes, { raw: { width: gridWidth, height: gridHeight, channels: 1 } })
      .resize(width, height, { fit: "fill", kernel: "cubic" })
      .raw()
      .toBuffer();
  };
  const [coarse, fine] = await Promise.all([makeLayer(coarseCell), makeLayer(fineCell)]);
  const result = Buffer.allocUnsafe(width * height);
  for (let i = 0; i < result.length; i++) result[i] = Math.round(coarse[i] * 0.68 + fine[i] * 0.32);
  return result;
}

/**
 * Seeded torn-paper erosion. Transparent padding is introduced before blur, so
 * an opaque rectangular card receives a genuinely irregular alpha perimeter.
 */
export async function applyTornEdge(alphaPng, options = {}) {
  const metadata = await sharp(alphaPng).metadata();
  const width = options.width ?? metadata.width;
  const height = options.height ?? metadata.height;
  if (!width || !height) throw new Error("torn edge requires mask dimensions");
  const tearWidth = Math.max(2, Math.round(options.tearWidth ?? Math.min(18, Math.max(4, Math.min(width, height) * 0.009))));
  const seed = options.seed ?? "into-place-torn";
  const hard = await sharp(alphaPng)
    .resize(width, height, { fit: "fill" })
    .toColourspace("b-w")
    .threshold(options.threshold ?? 112)
    .raw()
    .toBuffer();
  const pad = tearWidth * 3;
  const extended = await sharp(hard, { raw: { width, height, channels: 1 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "black" })
    .blur(Math.max(0.8, tearWidth * 0.62))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const softened = await sharp(extended.data, {
    raw: { width: extended.info.width, height: extended.info.height, channels: extended.info.channels },
  })
    .extract({ left: pad, top: pad, width, height })
    .raw()
    .toBuffer();
  const noise = await seededNoise(width, height, seed, Math.max(9, tearWidth * 4), Math.max(3, tearWidth));
  const output = Buffer.allocUnsafe(width * height);
  const antialiasBand = Math.max(7, Math.round(tearWidth * 1.4));
  for (let i = 0; i < output.length; i++) {
    if (hard[i] === 0) {
      output[i] = 0;
      continue;
    }
    // Higher noise removes more of the softened boundary; the fully opaque
    // interior is never punctured because the threshold remains below 225.
    const cutoff = 72 + (noise[i] / 255) * 150;
    const coverage = ((softened[i] - cutoff + antialiasBand) / (antialiasBand * 2)) * 255;
    output[i] = Math.max(0, Math.min(255, Math.round(coverage)));
  }
  return sharp(output, { raw: { width, height, channels: 1 } }).toColourspace("b-w").png().toBuffer();
}

/** Alpha QA using run-length connected components (8-connectivity). */
export async function analyzeAlpha(alphaPng, { threshold = 8 } = {}) {
  const raw = await sharp(alphaPng).toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = raw.info;
  const parent = [];
  const sizes = [];
  const find = (label) => {
    let root = label;
    while (parent[root] !== root) root = parent[root];
    while (parent[label] !== label) {
      const next = parent[label];
      parent[label] = root;
      label = next;
    }
    return root;
  };
  const union = (a, b) => {
    a = find(a);
    b = find(b);
    if (a === b) return a;
    if (sizes[a] < sizes[b]) [a, b] = [b, a];
    parent[b] = a;
    sizes[a] += sizes[b];
    return a;
  };
  let previous = [];
  let opaquePixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const current = [];
    let x = 0;
    while (x < width) {
      while (x < width && raw.data[(y * width + x) * channels] <= threshold) x++;
      if (x >= width) break;
      const start = x;
      while (x < width && raw.data[(y * width + x) * channels] > threshold) x++;
      const end = x - 1;
      const label = parent.length;
      parent.push(label);
      sizes.push(end - start + 1);
      opaquePixels += end - start + 1;
      minX = Math.min(minX, start);
      maxX = Math.max(maxX, end);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const run = { start, end, label };
      for (const old of previous) {
        if (old.end + 1 < start) continue;
        if (old.start - 1 > end) break;
        run.label = union(run.label, old.label);
      }
      current.push(run);
    }
    previous = current;
  }
  const roots = new Set(parent.map((_, index) => find(index)));
  return {
    width,
    height,
    opaquePixels,
    coverage: opaquePixels / (width * height),
    bbox: opaquePixels ? { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
    connectedComponents: roots.size,
  };
}

export function validateMaterializedQa(metrics, { role, recipe, sourceBounds, outputMetadata }) {
  const configured = recipe.qa ?? recipe.mask?.qa ?? {};
  const minCoverage = configured.minCoverage ?? (role === "cutout" ? 0.005 : 0.5);
  const maxCoverage = configured.maxCoverage ?? 1;
  const maxConnectedComponents = configured.maxConnectedComponents ?? (role === "cutout" ? 64 : 128);
  const checks = {
    alphaNonEmpty: metrics.opaquePixels > 0 && metrics.bbox !== null,
    coverageInRange: metrics.coverage >= minCoverage && metrics.coverage <= maxCoverage,
    bboxInsideCanvas:
      metrics.bbox !== null &&
      metrics.bbox.left >= 0 &&
      metrics.bbox.top >= 0 &&
      metrics.bbox.left + metrics.bbox.width <= metrics.width &&
      metrics.bbox.top + metrics.bbox.height <= metrics.height,
    connectedRegionsMeasured:
      Number.isInteger(metrics.connectedComponents) &&
      metrics.connectedComponents >= 1 &&
      metrics.connectedComponents <= maxConnectedComponents,
    withoutEnlargement: metrics.width <= sourceBounds.width && metrics.height <= sourceBounds.height,
    outputDimensionsValid: Number.isInteger(outputMetadata.width) && outputMetadata.width > 0 && Number.isInteger(outputMetadata.height) && outputMetadata.height > 0,
    rgbOriginLocal: true,
  };
  const reasons = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  return {
    ...metrics,
    valid: reasons.length === 0,
    checks,
    reasons,
    limits: { minCoverage, maxCoverage, maxConnectedComponents },
    outputWidth: outputMetadata.width,
    outputHeight: outputMetadata.height,
  };
}

async function runRembgMask(localRgbPng, tempDirectory, requestedModel, requestedExecutable) {
  const inputPath = path.join(tempDirectory, "rembg-input.png");
  const outputPath = path.join(tempDirectory, "rembg-output.png");
  await sharp(localRgbPng).png().toFile(inputPath);
  const model = requestedModel || process.env.REMBG_MODEL || "u2net";
  const executables = [requestedExecutable, process.env.REMBG_BIN];
  if (process.platform === "win32" && process.env.APPDATA) {
    executables.push(path.join(process.env.APPDATA, "Python", "Python314", "Scripts", "rembg.exe"));
  }
  executables.push("rembg");

  let lastError;
  for (const executable of [...new Set(executables.filter(Boolean))]) {
    if (path.isAbsolute(executable)) {
      try {
        await access(executable);
      } catch {
        continue;
      }
    }
    try {
      await execFileAsync(executable, ["i", "-m", model, inputPath, outputPath]);
      return alphaFromRgba(await readFile(outputPath));
    } catch (error) {
      lastError = error;
      if (error.code !== "ENOENT") break;
    }
  }
  throw new Error(`no cached mask was supplied and rembg failed (${lastError?.message ?? "rembg executable not found"})`);
}

async function resolveRecipe(recipeOrId, context) {
  if (recipeOrId && typeof recipeOrId === "object") return recipeOrId;
  const id = String(recipeOrId ?? "");
  let recipes = context.recipes;
  if (!recipes) {
    const configPath = context.configPath ?? path.join(context.projectRoot ?? process.cwd(), "data", "preprocess", "roosevelt-island.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    recipes = config.recipes;
  }
  let recipe;
  if (recipes instanceof Map) recipe = recipes.get(id);
  else if (Array.isArray(recipes)) recipe = recipes.find((item) => item.id === id);
  else recipe = recipes?.[id];
  if (!recipe) throw new Error(`unknown preprocess recipe '${id}'`);
  return recipe;
}

function readEffectConfig(recipe, role) {
  const borderValue = recipe.border ?? recipe.whiteBorder;
  const shadowValue = recipe.shadow;
  const border = {
    enabled: role !== "bg" && borderValue !== false,
    width: typeof borderValue === "number" ? borderValue : borderValue?.width ?? recipe.borderWidth ?? 2,
  };
  const shadow = {
    enabled: role !== "bg" && shadowValue !== false,
    offsetX: shadowValue?.offsetX ?? recipe.shadowOffsetX ?? 6,
    offsetY: shadowValue?.offsetY ?? recipe.shadowOffsetY ?? 10,
    blur: shadowValue?.blur ?? recipe.shadowBlur ?? 14,
    opacity: shadowValue?.opacity ?? recipe.shadowOpacity ?? 0.35,
  };
  for (const [name, value] of Object.entries({ borderWidth: border.width, shadowOffsetX: shadow.offsetX, shadowOffsetY: shadow.offsetY, shadowBlur: shadow.blur, shadowOpacity: shadow.opacity })) {
    assertFinite(value, name);
  }
  if (border.width < 0 || shadow.blur < 0 || shadow.opacity < 0 || shadow.opacity > 1) throw new RangeError("invalid border/shadow configuration");
  return { border, shadow };
}

async function composeEffects(subjectPng, subjectAlpha, width, height, effects) {
  if (!effects.border.enabled && !effects.shadow.enabled) return subjectPng;
  const borderWidth = effects.border.enabled ? Math.ceil(effects.border.width) : 0;
  const shadowReach = effects.shadow.enabled
    ? Math.ceil(effects.shadow.blur * 3 + Math.max(Math.abs(effects.shadow.offsetX), Math.abs(effects.shadow.offsetY)))
    : 0;
  const pad = Math.max(2, borderWidth + 2, shadowReach + borderWidth + 2);
  const canvasWidth = width + pad * 2;
  const canvasHeight = height + pad * 2;
  const centeredMask = await sharp(subjectAlpha)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "black" })
    .png()
    .toBuffer();

  let borderMask = centeredMask;
  if (effects.border.enabled && effects.border.width > 0) {
    // sharp/libvips can canonicalise threshold before blur when they share one
    // pipeline. Split the stages so the paper border is a truly opaque,
    // dilated silhouette and cannot become grey over its shadow.
    const blurredBorder = await sharp(centeredMask)
      .blur(Math.max(0.3, effects.border.width * 0.9))
      .toColourspace("b-w")
      .png()
      .toBuffer();
    borderMask = await sharp(blurredBorder)
      .threshold(Math.max(1, Math.round(128 / (effects.border.width + 1))))
      .toColourspace("b-w")
      .png()
      .toBuffer();
  }
  const composites = [];

  // Physical layer order is shadow -> white paper border -> source RGB.
  if (effects.shadow.enabled) {
    const shadowBaseMask = effects.border.enabled ? borderMask : centeredMask;
    const shifted = await sharp(shadowBaseMask)
      .extend({
        top: Math.max(0, effects.shadow.offsetY),
        bottom: Math.max(0, -effects.shadow.offsetY),
        left: Math.max(0, effects.shadow.offsetX),
        right: Math.max(0, -effects.shadow.offsetX),
        background: "black",
      })
      .png()
      .toBuffer({ resolveWithObject: true });
    const shiftedMask = await sharp(shifted.data)
      .extract({
        left: Math.max(0, -effects.shadow.offsetX),
        top: Math.max(0, -effects.shadow.offsetY),
        width: canvasWidth,
        height: canvasHeight,
      })
      .blur(Math.max(0.3, effects.shadow.blur))
      .linear(effects.shadow.opacity, 0)
      .png()
      .toBuffer();
    const blackRgb = await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 3, background: "black" } })
      .png()
      .toBuffer();
    const black = await replaceAlpha(blackRgb, shiftedMask, canvasWidth, canvasHeight);
    composites.push({ input: black, left: 0, top: 0 });
  }
  if (effects.border.enabled) {
    const whiteRgb = await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 3, background: "white" } })
      .png()
      .toBuffer();
    const white = await replaceAlpha(whiteRgb, borderMask, canvasWidth, canvasHeight);
    composites.push({ input: white, left: 0, top: 0 });
  }
  composites.push({ input: subjectPng, left: pad, top: pad });

  return sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toBuffer();
}

/**
 * Materialize a recipe using only local pixels and an optional cached mask.
 *
 * `recipeOrId` may be a recipe object, or an id resolved through
 * `context.recipes`. Cached mask precedence is context.maskBuffer,
 * context.maskPath/context.cachedMaskPath, then recipe.mask.cacheFile.
 */
export async function materializeCutout(recipeOrId, selection = {}, context = {}) {
  const recipe = await resolveRecipe(recipeOrId, context);
  const id = recipe.id ?? recipe.assetId ?? "unnamed-recipe";
  if (recipe.publish === false && context.allowRejectedReview !== true) {
    throw new Error(`recipe '${id}' failed visual review; use fallback '${recipe.fallbackRecipeId ?? "card"}'`);
  }
  const inputPath = recipe.input ?? recipe.file;
  const outputPath = context.output ?? recipe.output;
  const sourceBuffer = context.inputBuffer ?? (inputPath ? await readFile(inputPath) : null);
  if (!sourceBuffer) throw new Error(`recipe '${id}' needs input or context.inputBuffer`);
  const role = normalizeRole(recipe.role ?? recipe.mode ?? "cutout");
  const chosen = resolvePreprocessSelection(recipe, selection);
  const crop = normalizeCrop(recipe.crop);
  const maxSize = Number(recipe.maxSize ?? 0);
  if (!Number.isFinite(maxSize) || maxSize < 0) throw new RangeError("maxSize must be a non-negative number");

  // Transcode after auto-orientation so crop math uses the visible dimensions.
  const oriented = await sharp(sourceBuffer).rotate().png().toBuffer({ resolveWithObject: true });
  let local = sharp(oriented.data);
  const pixelCrop = cropToPixels(crop, oriented.info.width, oriented.info.height);
  if (crop) local = local.extract(pixelCrop);
  if (maxSize > 0) {
    local = local.resize(maxSize, maxSize, { fit: "inside", withoutEnlargement: true, kernel: "lanczos3" });
  }
  if (chosen.tone === "mono" || chosen.tone === "sepia") {
    local = local.grayscale().normalise({ lower: 1, upper: 99 });
    if (chosen.tone === "sepia") {
      local = local.recomb([
        [235 / 255, 0, 0],
        [0, 220 / 255, 0],
        [0, 0, 195 / 255],
      ]);
    }
    local = local.toColourspace("srgb");
  }
  let localRgba = await local.ensureAlpha().png().toBuffer({ resolveWithObject: true });
  const width = localRgba.info.width;
  const height = localRgba.info.height;

  let baseAlpha;
  let maskBuffer = context.maskBuffer ?? null;
  // An explicit null from the batch cache inspector means "cache was checked
  // and is unavailable"; do not fall through and try to open the recipe path.
  const hasMaskPath = Object.prototype.hasOwnProperty.call(context, "maskPath");
  const hasCachedMaskPath = Object.prototype.hasOwnProperty.call(context, "cachedMaskPath");
  const maskPath = hasMaskPath
    ? context.maskPath
    : hasCachedMaskPath
      ? context.cachedMaskPath
      : recipe.mask?.cacheFile;
  if (!maskBuffer && maskPath) maskBuffer = await readFile(maskPath);
  let tempDirectory;
  try {
    if (role === "card") {
      // A card is the cropped rectangle, regardless of an input file's alpha.
      baseAlpha = await sharp(Buffer.alloc(width * height, 255), {
        raw: { width, height, channels: 1 },
      })
        .toColourspace("b-w")
        .png()
        .toBuffer();
    } else if (role === "bg") {
      baseAlpha = await alphaFromRgba(localRgba.data);
    } else if (maskBuffer) {
      const supplied = await imageToAlpha(maskBuffer, width, height);
      const sourceAlpha = await sharp(localRgba.data).extractChannel("alpha").toColourspace("b-w").raw().toBuffer();
      const combined = Buffer.allocUnsafe(width * height);
      for (let i = 0; i < combined.length; i++) combined[i] = Math.round((supplied[i] * sourceAlpha[i]) / 255);
      baseAlpha = await sharp(combined, { raw: { width, height, channels: 1 } }).toColourspace("b-w").png().toBuffer();
    } else {
      const sourceAlpha = await sharp(localRgba.data).extractChannel("alpha").toColourspace("b-w").raw().toBuffer();
      let hasTransparency = false;
      for (const value of sourceAlpha) {
        if (value < 250) {
          hasTransparency = true;
          break;
        }
      }
      if (hasTransparency) {
        baseAlpha = await sharp(sourceAlpha, { raw: { width, height, channels: 1 } }).toColourspace("b-w").png().toBuffer();
      } else if (context.allowRembg === false) {
        throw new Error(`cutout recipe '${id}' has no cached mask`);
      } else {
        tempDirectory = await mkdtemp(path.join(os.tmpdir(), "into-place-cutout-"));
        baseAlpha = await runRembgMask(localRgba.data, tempDirectory, context.rembgModel, context.rembgExecutable);
      }
    }

    let finalAlpha;
    if (chosen.edge === "scissor") finalAlpha = await applyScissorEdge(baseAlpha, recipe.scissor);
    else if (chosen.edge === "torn") {
      finalAlpha = await applyTornEdge(baseAlpha, {
        ...(recipe.torn ?? {}),
        width,
        height,
        seed: recipe.torn?.seed ?? recipe.seed ?? id,
      });
    } else finalAlpha = baseAlpha;

    // Replace alpha only; every RGB byte originates from the local pipeline.
    const subjectPng = await replaceAlpha(localRgba.data, finalAlpha, width, height);
    const effects = readEffectConfig(recipe, role);
    const outputBuffer = await composeEffects(subjectPng, finalAlpha, width, height, effects);
    if (outputPath && context.write !== false) {
      await mkdir(path.dirname(outputPath), { recursive: true });
      await sharp(outputBuffer).png().toFile(outputPath);
    }

    const sourceHash = sha256(sourceBuffer);
    const recipeHash = sha256(stableStringify(recipe));
    const maskHash = maskBuffer ? sha256(maskBuffer) : null;
    const outputHash = sha256(outputBuffer);
    const alphaMetrics = await analyzeAlpha(finalAlpha);
    const outputMetadata = await sharp(outputBuffer).metadata();
    const qa = validateMaterializedQa(alphaMetrics, { role, recipe, sourceBounds: pixelCrop, outputMetadata });
    return {
      id,
      output: outputPath ?? null,
      buffer: outputBuffer,
      role,
      tone: chosen.tone,
      edge: chosen.edge,
      sourceHash,
      recipeHash,
      maskHash,
      outputHash,
      cacheKey: buildCacheFingerprint({ sourceHash, recipeHash, maskHash, tone: chosen.tone, edge: chosen.edge }),
      pixelOrigin: "local-source-rgb",
      operations: [
        "exif-auto-orient",
        ...(crop ? [`normalized-crop:${crop.x},${crop.y},${crop.width},${crop.height}`] : []),
        ...(maxSize > 0 ? [`resize-inside:${maxSize}:without-enlargement`] : []),
        `tone:${chosen.tone}`,
        ...(role === "cutout" ? [maskBuffer ? "cached-mask-alpha-only" : "local-alpha-mask-only"] : []),
        `edge:${chosen.edge}`,
        ...(effects.border.enabled ? ["white-border"] : []),
        ...(effects.shadow.enabled ? ["shadow-behind-border"] : []),
      ],
      qa,
    };
  } finally {
    if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
  }
}

/** Backward-compatible wrapper used by the original batch script. */
export async function cutout(options) {
  if (!options?.input || !options?.output) throw new Error("cutout() needs input and output paths");
  const role = normalizeRole(options.role ?? options.mode ?? "auto");
  const tone = normalizeTone(options.tone ?? "source");
  const edge = options.edge ?? (options.tornEdge === false ? (role === "cutout" ? "scissor" : "none") : "torn");
  const result = await materializeCutout(
    {
      id: options.id ?? path.parse(options.output).name,
      input: options.input,
      output: options.output,
      role,
      crop: options.crop,
      maxSize: options.maxSize,
      defaultTone: tone,
      defaultEdge: edge,
      border: options.whiteBorder === false ? false : { width: options.borderWidth ?? 2 },
      shadow: options.shadow === false
        ? false
        : {
            offsetX: options.shadowOffsetX ?? 6,
            offsetY: options.shadowOffsetY ?? 10,
            blur: options.shadowBlur ?? 14,
            opacity: options.shadowOpacity ?? 0.35,
          },
      seed: options.seed,
    },
    {},
    { maskPath: options.maskPath, maskBuffer: options.maskBuffer, allowRembg: options.allowRembg }
  );
  console.log(`created ${options.output} (${result.qa.outputWidth}x${result.qa.outputHeight}, ${result.role}/${result.tone}/${result.edge})`);
  return options.output;
}

export function parseArgs(argv) {
  const args = { role: "cutout", tone: "source", edge: "torn", shadow: true, whiteBorder: true, maxSize: 0 };
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (argument === "--in") args.input = argv[++i];
    else if (argument === "--out") args.output = argv[++i];
    else if (argument === "--mask") args.maskPath = argv[++i];
    else if (argument === "--role") args.role = argv[++i];
    else if (argument === "--mode") args.role = argv[++i];
    else if (argument === "--tone") args.tone = argv[++i];
    else if (argument === "--edge") args.edge = argv[++i];
    else if (argument === "--crop") args.crop = argv[++i];
    else if (argument === "--max-size") args.maxSize = Number(argv[++i]);
    else if (argument === "--seed") args.seed = argv[++i];
    else if (argument === "--no-torn-edge") args.edge = "scissor";
    else if (argument === "--no-shadow") args.shadow = false;
    else if (argument === "--no-border") args.whiteBorder = false;
    else throw new Error(`unknown argument '${argument}'`);
  }
  return args;
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.input || !args.output) {
      console.error(
        "Usage: node scripts/cutout.mjs --in source --out output.png " +
          "[--mask cached-mask.png] [--role card|cutout|bg] [--tone source|mono|sepia] " +
          "[--edge scissor|torn|none] [--crop x,y,w,h] [--max-size N] [--seed value] " +
          "[--no-shadow] [--no-border]"
      );
      process.exitCode = 1;
    } else {
      await cutout(args);
    }
  } catch (error) {
    console.error(`cutout failed: ${error.message}`);
    process.exitCode = 1;
  }
}
