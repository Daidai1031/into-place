import { fal } from "@fal-ai/client";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const FAL_MASK_MODEL = "fal-ai/sam-3/image";
export const FAL_MASK_TOOL_VERSION = "fal-mask-v2.0.0";

const MAX_ATTEMPTS = 2;
const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashJson(value) {
  return sha256(stableStringify(value));
}

export async function hashFile(filePath) {
  return sha256(await readFile(filePath));
}

export function buildCacheIdentity({ sourceSha256, recipeSha256, toolSha256, maskConfigSha256 }) {
  const identity = { sourceSha256, recipeSha256, toolSha256, maskConfigSha256 };
  return { ...identity, cacheKey: hashJson(identity) };
}

export function validateCrop(crop) {
  if (crop == null) return null;
  if (!Array.isArray(crop) || crop.length !== 4 || crop.some((value) => !Number.isFinite(value))) {
    throw new Error(`crop must be null or [x,y,width,height], received ${JSON.stringify(crop)}`);
  }
  const [x, y, width, height] = crop;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
    throw new Error(`crop must fit inside normalized 0..1 bounds, received ${JSON.stringify(crop)}`);
  }
  return crop;
}

function resolveProjectPath(projectRoot, relativePath) {
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing path outside project root: ${relativePath}`);
  }
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

async function atomicWrite(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, contents);
  try {
    await rename(temporary, filePath);
  } catch (error) {
    if (!(await exists(filePath))) throw error;
    await rm(filePath, { force: true });
    await rename(temporary, filePath);
  }
}

async function writeJsonAtomic(filePath, value) {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function prepareFalMaskInput({ sourcePath, crop = null, maxSize = 2400 }) {
  validateCrop(crop);
  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Cannot read image dimensions: ${sourcePath}`);

  const swapsAxes = metadata.orientation >= 5 && metadata.orientation <= 8;
  const orientedWidth = swapsAxes ? metadata.height : metadata.width;
  const orientedHeight = swapsAxes ? metadata.width : metadata.height;
  let workingWidth = orientedWidth;
  let workingHeight = orientedHeight;
  let pipeline = sharp(sourcePath).rotate();

  if (crop) {
    const [x, y, width, height] = crop;
    const left = Math.min(orientedWidth - 1, Math.round(x * orientedWidth));
    const top = Math.min(orientedHeight - 1, Math.round(y * orientedHeight));
    const cropWidth = Math.max(1, Math.min(orientedWidth - left, Math.round(width * orientedWidth)));
    const cropHeight = Math.max(1, Math.min(orientedHeight - top, Math.round(height * orientedHeight)));
    pipeline = pipeline.extract({ left, top, width: cropWidth, height: cropHeight });
    workingWidth = cropWidth;
    workingHeight = cropHeight;
  }

  if (maxSize > 0 && Math.max(workingWidth, workingHeight) > maxSize) {
    pipeline = pipeline.resize({
      width: maxSize,
      height: maxSize,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const buffer = await pipeline.png().toBuffer();
  const outputMetadata = await sharp(buffer).metadata();
  return {
    buffer,
    width: outputMetadata.width,
    height: outputMetadata.height,
    sourceWidth: orientedWidth,
    sourceHeight: orientedHeight,
    crop,
  };
}

export function assertFalVerificationFresh(falConfig, now = new Date()) {
  if (!falConfig || falConfig.model !== FAL_MASK_MODEL) {
    throw new Error(`fal configuration must explicitly target ${FAL_MASK_MODEL}`);
  }
  if (falConfig.unit !== "request" || !Number.isFinite(falConfig.unitPriceUsd)) {
    throw new Error("fal pricing metadata is missing a per-request USD price");
  }
  for (const field of ["schemaCheckedAt", "pricingCheckedAt"]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(falConfig[field] ?? "")) {
      throw new Error(`fal.${field} must be an ISO date refreshed with fal MCP`);
    }
    const ageDays = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.parse(`${falConfig[field]}T00:00:00Z`)) / 86_400_000);
    if (ageDays < 0 || ageDays > 1) {
      throw new Error(
        `fal ${field}=${falConfig[field]} is stale. Re-check ${FAL_MASK_MODEL} with fal MCP today and update data/preprocess/roosevelt-island.json before --refresh-mask.`
      );
    }
  }
  if (falConfig.inputContract?.apply_mask !== false) {
    throw new Error("fal input contract must pin apply_mask:false; generated pixels may not replace archive RGB");
  }
}

async function normalizeMask(downloadedBuffer) {
  const image = sharp(downloadedBuffer);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("fal returned a mask without readable dimensions");

  let maskPipeline;
  if (metadata.hasAlpha) {
    const stats = await image.ensureAlpha().stats();
    const alpha = stats.channels[3];
    const usefulAlpha = alpha && alpha.min < 250 && alpha.max > 5 && alpha.mean < 250;
    maskPipeline = usefulAlpha ? sharp(downloadedBuffer).ensureAlpha().extractChannel("alpha") : sharp(downloadedBuffer).grayscale();
  } else {
    maskPipeline = sharp(downloadedBuffer).grayscale();
  }

  const buffer = await maskPipeline.threshold(127).png().toBuffer();
  const stats = await sharp(buffer).stats();
  const coverage = stats.channels[0].mean / 255;
  return { buffer, width: metadata.width, height: metadata.height, coverage };
}

function validateMaskQa(mask, qa = {}) {
  const minCoverage = qa.minCoverage ?? 0.01;
  const maxCoverage = qa.maxCoverage ?? 0.95;
  if (!(mask.coverage >= minCoverage && mask.coverage <= maxCoverage)) {
    return {
      valid: false,
      reason: `mask coverage ${mask.coverage.toFixed(4)} is outside ${minCoverage}..${maxCoverage}`,
      coverage: mask.coverage,
      minCoverage,
      maxCoverage,
    };
  }
  return { valid: true, coverage: mask.coverage, minCoverage, maxCoverage };
}

async function pollQueue({ endpoint, requestId, pollIntervalMs, timeoutMs, onStatus }) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await fal.queue.status(endpoint, { requestId, logs: true });
    onStatus?.(status);
    if (status.status === "COMPLETED") return status;
    if (["FAILED", "CANCELLED"].includes(status.status)) {
      const detail = status.error ?? status.error_message ?? status.logs?.at?.(-1)?.message ?? "no error detail returned";
      throw new Error(`fal request ${requestId} ${status.status.toLowerCase()}: ${detail}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`Timed out waiting for fal request ${requestId} after ${timeoutMs}ms`);
}

export async function inspectMaskCache({ recipe, cacheIdentity, projectRoot = process.cwd() }) {
  if (!recipe.mask?.cacheFile || !recipe.mask?.metadataFile) return { valid: false, reason: "recipe_has_no_mask_cache" };
  const cacheFile = resolveProjectPath(projectRoot, recipe.mask.cacheFile);
  const metadataFile = resolveProjectPath(projectRoot, recipe.mask.metadataFile);
  if (!(await exists(cacheFile)) || !(await exists(metadataFile))) return { valid: false, reason: "mask_cache_missing" };

  try {
    const metadata = JSON.parse(await readFile(metadataFile, "utf8"));
    for (const [key, expected] of Object.entries(cacheIdentity)) {
      if (metadata.cache?.[key] !== expected) return { valid: false, reason: `mask_cache_${key}_mismatch`, metadata };
    }
    const maskSha256 = await hashFile(cacheFile);
    if (maskSha256 !== metadata.mask?.sha256) return { valid: false, reason: "mask_cache_content_hash_mismatch", metadata };
    return { valid: true, cacheFile, metadataFile, maskSha256, metadata };
  } catch (error) {
    return { valid: false, reason: `mask_cache_unreadable:${error.message}` };
  }
}

export function estimateFalMaskCost(recipe, falConfig) {
  const attempts = Math.min(MAX_ATTEMPTS, recipe.mask?.attempts?.length ?? 0);
  return attempts * falConfig.unitPriceUsd;
}

export async function generateFalMask({
  recipe,
  falConfig,
  cacheIdentity,
  projectRoot = process.cwd(),
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = new Date(),
}) {
  assertFalVerificationFresh(falConfig, now);
  if (recipe.role !== "cutout" || recipe.mask?.provider !== "fal") {
    throw new Error(`Recipe ${recipe.id} is not configured for a fal mask`);
  }
  if (!process.env.FAL_KEY) {
    throw new Error("FAL_KEY is required for --refresh-mask (load it from .env.local; it is never logged or persisted)");
  }

  const attempts = (recipe.mask.attempts ?? []).slice(0, MAX_ATTEMPTS);
  if (attempts.length === 0) throw new Error(`Recipe ${recipe.id} has no fal mask prompt attempts`);
  const cacheFile = resolveProjectPath(projectRoot, recipe.mask.cacheFile);
  const metadataFile = resolveProjectPath(projectRoot, recipe.mask.metadataFile);
  const sourcePath = resolveProjectPath(projectRoot, recipe.input);
  const prepared = await prepareFalMaskInput({ sourcePath, crop: recipe.crop, maxSize: recipe.maxSize });

  fal.config({ credentials: process.env.FAL_KEY });
  const upload = new File([prepared.buffer], `${recipe.id}_fal_input.png`, { type: "image/png" });
  const uploadedUrl = await fal.storage.upload(upload);
  const calls = [];
  const runMetadata = {
    schemaVersion: 1,
    recipeId: recipe.id,
    model: FAL_MASK_MODEL,
    cache: cacheIdentity,
    sourceInput: {
      file: recipe.input,
      crop: recipe.crop,
      uploaded: true,
      uploadedUrl: "(redacted uploaded cropped source)",
      width: prepared.width,
      height: prepared.height,
    },
    verification: {
      schemaCheckedAt: falConfig.schemaCheckedAt,
      pricingCheckedAt: falConfig.pricingCheckedAt,
      unitPriceUsd: falConfig.unitPriceUsd,
      unit: falConfig.unit,
    },
    calls,
    updatedAt: now.toISOString(),
  };

  for (let index = 0; index < attempts.length; index++) {
    const attempt = attempts[index];
    const input = {
      image_url: uploadedUrl,
      prompt: attempt.prompt,
      apply_mask: false,
      return_multiple_masks: false,
      output_format: "png",
      include_scores: true,
      include_boxes: true,
      ...(attempt.point_prompts ? { point_prompts: attempt.point_prompts } : {}),
      ...(attempt.box_prompts ? { box_prompts: attempt.box_prompts } : {}),
    };
    const call = {
      attempt: index + 1,
      model: FAL_MASK_MODEL,
      request_id: null,
      input: { ...input, image_url: "(uploaded cropped source)" },
      estimated_cost_usd: falConfig.unitPriceUsd,
      status: "submitting",
      submitted_at: new Date().toISOString(),
    };
    calls.push(call);
    await writeJsonAtomic(metadataFile, runMetadata);

    try {
      const submitted = await fal.queue.submit(FAL_MASK_MODEL, { input });
      const requestId = submitted.request_id ?? submitted.requestId;
      if (!requestId) throw new Error("fal queue submit did not return request_id");
      call.request_id = requestId;
      call.status = "queued";
      await writeJsonAtomic(metadataFile, runMetadata);

      await pollQueue({
        endpoint: FAL_MASK_MODEL,
        requestId,
        pollIntervalMs,
        timeoutMs,
        onStatus(status) {
          call.status = status.status.toLowerCase();
        },
      });
      const result = await fal.queue.result(FAL_MASK_MODEL, { requestId });
      const data = result.data ?? result;
      const maskUrl = data.masks?.[0]?.url;
      if (!maskUrl) throw new Error("fal result did not contain masks[0].url");
      const response = await fetch(maskUrl);
      if (!response.ok) throw new Error(`mask download failed with HTTP ${response.status}`);
      const normalized = await normalizeMask(Buffer.from(await response.arrayBuffer()));
      const qa = validateMaskQa(normalized, recipe.mask.qa);
      call.qa = qa;
      call.result = {
        mask_url: "(redacted fal result URL)",
        score: data.scores?.[0] ?? data.metadata?.[0]?.score ?? null,
        box: data.boxes?.[0] ?? data.metadata?.[0]?.box ?? null,
        width: normalized.width,
        height: normalized.height,
      };
      call.completed_at = new Date().toISOString();
      if (!qa.valid) {
        call.status = "rejected_by_qa";
        await writeJsonAtomic(metadataFile, runMetadata);
        continue;
      }

      await atomicWrite(cacheFile, normalized.buffer);
      const maskSha256 = sha256(normalized.buffer);
      call.status = "completed";
      runMetadata.mask = {
        file: recipe.mask.cacheFile,
        sha256: maskSha256,
        width: normalized.width,
        height: normalized.height,
        coverage: normalized.coverage,
      };
      runMetadata.updatedAt = new Date().toISOString();
      await writeJsonAtomic(metadataFile, runMetadata);
      return { maskPath: cacheFile, maskSha256, metadata: runMetadata, calls, qa };
    } catch (error) {
      call.status = "failed";
      call.error = error.message;
      call.completed_at = new Date().toISOString();
      runMetadata.updatedAt = new Date().toISOString();
      await writeJsonAtomic(metadataFile, runMetadata);
    }
  }

  const error = new Error(`All ${calls.length} fal mask attempts failed QA for ${recipe.id}`);
  error.falCalls = calls;
  throw error;
}
