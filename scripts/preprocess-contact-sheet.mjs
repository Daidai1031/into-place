#!/usr/bin/env node

/**
 * Human-review contact sheet for Roosevelt Island preprocess v2.
 *
 * This script is intentionally read-only with respect to sources, masks,
 * published cutouts, provenance, and the place manifest. It never imports or
 * calls fal. The only write is the requested contact-sheet PNG.
 */

import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { cropToPixels, materializeCutout } from "./cutout.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(PROJECT_ROOT, "data", "preprocess", "roosevelt-island.json");
const DEFAULT_OUTPUT = "renders/preprocess-review/contact-sheet.png";

const SHEET_WIDTH = 2100;
const MARGIN_X = 26;
const TOP_HEIGHT = 122;
const ROW_INFO_HEIGHT = 76;
const PANEL_HEIGHT = 220;
const ROW_GAP = 18;
const ROW_HEIGHT = ROW_INFO_HEIGHT + PANEL_HEIGHT + ROW_GAP;
const COLUMN_GAP = 12;
const COLUMN_COUNT = 6;
const PANEL_WIDTH = Math.floor(
  (SHEET_WIDTH - MARGIN_X * 2 - COLUMN_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT,
);
const PREVIEW_MAX_SIZE = 960;

const COLUMNS = [
  "SOURCE / FULL FRAME",
  "SEMANTIC CROP",
  "MASK (ALPHA ONLY)",
  "HARD / SCISSOR",
  "TORN PAPER",
  "PUBLISHED FINAL",
];

const USAGE = `Usage:
  node scripts/preprocess-contact-sheet.mjs [options]

Options:
  --only asset_005,recipe_id   include asset ids and/or exact recipe ids
  --out path/to/sheet.png      output path (default: ${DEFAULT_OUTPUT})
  --help                       show this message

The command never calls fal or rembg and never changes sources, masks, cutouts,
provenance, or the place manifest.`;

function parseArgs(argv) {
  const parsed = { only: null, out: DEFAULT_OUTPUT, help: false };
  const takeValue = (index, flag) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    return value;
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--only") {
      parsed.only = new Set(
        takeValue(index++, arg)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      );
    } else if (arg === "--out") {
      parsed.out = takeValue(index++, arg);
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function resolveInsideProject(requestedPath) {
  const resolved = path.resolve(PROJECT_ROOT, requestedPath);
  const relative = path.relative(PROJECT_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Output must remain inside the project workspace: ${requestedPath}`);
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

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function reviewLabel(review) {
  if (!review || typeof review !== "object") return String(review ?? "pending");
  return `${review.source ?? "pending"}/${review.visual ?? "pending"}`;
}

function truncate(value, maximum) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= maximum ? text : `${text.slice(0, maximum - 1)}…`;
}

function formatCrop(crop) {
  return crop ? crop.map((value) => Number(value).toFixed(3)).join(", ") : "full frame";
}

function orientedDimensions(metadata) {
  const swapsAxes = [5, 6, 7, 8].includes(metadata.orientation);
  return swapsAxes
    ? { width: metadata.height, height: metadata.width }
    : { width: metadata.width, height: metadata.height };
}

function checkerSvg(width, height) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <pattern id="checker" width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="#252c35"/>
          <rect width="12" height="12" fill="#3b4552"/>
          <rect x="12" y="12" width="12" height="12" fill="#3b4552"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#checker)"/>
    </svg>
  `);
}

async function panelFromImage(input, { checker = false, rotate = true } = {}) {
  let image = sharp(input);
  if (rotate) image = image.rotate();
  const contained = await image
    .resize(PANEL_WIDTH, PANEL_HEIGHT, {
      fit: "contain",
      withoutEnlargement: true,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const background = checker
    ? checkerSvg(PANEL_WIDTH, PANEL_HEIGHT)
    : {
        create: {
          width: PANEL_WIDTH,
          height: PANEL_HEIGHT,
          channels: 4,
          background: { r: 20, g: 24, b: 30, alpha: 1 },
        },
      };
  return sharp(background).composite([{ input: contained, left: 0, top: 0 }]).png().toBuffer();
}

async function noticePanel(title, detail = "") {
  const safeTitle = escapeXml(truncate(title, 34));
  const safeDetail = escapeXml(truncate(detail, 54));
  return sharp(
    Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_WIDTH}" height="${PANEL_HEIGHT}">
        <rect width="100%" height="100%" rx="5" fill="#161b22"/>
        <path d="M20 ${PANEL_HEIGHT / 2} H${PANEL_WIDTH - 20}" stroke="#303946" stroke-width="1" stroke-dasharray="6 7"/>
        <text x="50%" y="${PANEL_HEIGHT / 2 - 8}" text-anchor="middle"
          font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#93a4b8">${safeTitle}</text>
        <text x="50%" y="${PANEL_HEIGHT / 2 + 20}" text-anchor="middle"
          font-family="Arial, sans-serif" font-size="12" fill="#708196">${safeDetail}</text>
      </svg>
    `),
  )
    .png()
    .toBuffer();
}

async function maskDisplayBuffer(maskBuffer) {
  const metadata = await sharp(maskBuffer).metadata();
  const rgba = await sharp(maskBuffer).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let alphaMin = 255;
  let alphaMax = 0;
  for (let offset = rgba.info.channels - 1; offset < rgba.data.length; offset += rgba.info.channels) {
    alphaMin = Math.min(alphaMin, rgba.data[offset]);
    alphaMax = Math.max(alphaMax, rgba.data[offset]);
  }
  const useAlpha = metadata.hasAlpha === true && alphaMax > alphaMin && alphaMin < 250;
  const gray = Buffer.allocUnsafe(rgba.info.width * rgba.info.height);
  for (let offset = 0, pixel = 0; pixel < gray.length; offset += rgba.info.channels, pixel++) {
    gray[pixel] = useAlpha
      ? rgba.data[offset + rgba.info.channels - 1]
      : Math.round(0.2126 * rgba.data[offset] + 0.7152 * rgba.data[offset + 1] + 0.0722 * rgba.data[offset + 2]);
  }
  return sharp(gray, { raw: { width: rgba.info.width, height: rgba.info.height, channels: 1 } })
    .png()
    .toBuffer();
}

async function makeSourcePanel(sourceBuffer) {
  return panelFromImage(sourceBuffer, { checker: false, rotate: true });
}

async function makeSemanticCrop(sourceBuffer, crop) {
  const metadata = await sharp(sourceBuffer).metadata();
  const dimensions = orientedDimensions(metadata);
  if (!dimensions.width || !dimensions.height) throw new Error("source dimensions unavailable");
  const pixelCrop = cropToPixels(crop, dimensions.width, dimensions.height);
  let pipeline = sharp(sourceBuffer).rotate();
  if (crop) pipeline = pipeline.extract(pixelCrop);
  return pipeline
    .resize(PREVIEW_MAX_SIZE, PREVIEW_MAX_SIZE, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: "lanczos3",
    })
    .png()
    .toBuffer();
}

async function makeEdgePreview(recipe, cropBuffer, maskBuffer, edge) {
  if (recipe.role === "bg") return null;
  if (recipe.role === "cutout" && !maskBuffer) return null;
  const previewRecipe = {
    ...recipe,
    input: undefined,
    output: undefined,
    crop: null,
    maxSize: PREVIEW_MAX_SIZE,
    seed: recipe.edgeSeed ?? recipe.seed ?? recipe.id,
  };
  const result = await materializeCutout(
    previewRecipe,
    { tone: "defaults", edge },
    {
      inputBuffer: cropBuffer,
      maskBuffer,
      allowRembg: false,
      allowRejectedReview: true,
      write: false,
    },
  );
  return result.buffer;
}

async function reviewRecipe(recipe) {
  const sourcePath = path.resolve(PROJECT_ROOT, recipe.input);
  const finalPath = path.resolve(PROJECT_ROOT, recipe.output);
  const maskPath = recipe.mask?.cacheFile ? path.resolve(PROJECT_ROOT, recipe.mask.cacheFile) : null;
  const warnings = [];

  if (!(await exists(sourcePath))) {
    const missing = await noticePanel("MISSING SOURCE", recipe.input);
    return {
      recipe,
      panels: [missing, missing, await noticePanel("MASK UNAVAILABLE"), await noticePanel("PREVIEW UNAVAILABLE"), await noticePanel("PREVIEW UNAVAILABLE"), await noticePanel("FINAL UNAVAILABLE")],
      warnings: [`missing source: ${recipe.input}`],
      maskMissing: Boolean(recipe.mask),
      finalMissing: !(await exists(finalPath)),
    };
  }

  const sourceBuffer = await readFile(sourcePath);
  let cropBuffer;
  let sourcePanel;
  let cropPanel;
  try {
    [sourcePanel, cropBuffer] = await Promise.all([
      makeSourcePanel(sourceBuffer),
      makeSemanticCrop(sourceBuffer, recipe.crop),
    ]);
    cropPanel = await panelFromImage(cropBuffer, { checker: false, rotate: false });
  } catch (error) {
    warnings.push(`source/crop preview failed: ${error.message}`);
    sourcePanel = await noticePanel("SOURCE PREVIEW ERROR", error.message);
    cropPanel = await noticePanel("CROP PREVIEW ERROR", error.message);
  }

  let maskBuffer = null;
  let maskPanel;
  if (!recipe.mask) {
    maskPanel = await noticePanel("N/A", `${recipe.role} recipe has no subject mask`);
  } else if (!maskPath || !(await exists(maskPath))) {
    maskPanel = await noticePanel("MISSING MASK", recipe.mask.cacheFile ?? "cache path not configured");
    warnings.push(`missing mask: ${recipe.mask.cacheFile ?? "unconfigured"}`);
  } else {
    maskBuffer = await readFile(maskPath);
    try {
      maskPanel = await panelFromImage(await maskDisplayBuffer(maskBuffer), { checker: false, rotate: false });
    } catch (error) {
      warnings.push(`mask preview failed: ${error.message}`);
      maskPanel = await noticePanel("MASK PREVIEW ERROR", error.message);
      maskBuffer = null;
    }
  }

  const edgePanels = [];
  for (const edge of ["scissor", "torn"]) {
    if (recipe.role === "bg") {
      edgePanels.push(await noticePanel("N/A", "background role has edge:none"));
      continue;
    }
    if (recipe.role === "cutout" && !maskBuffer) {
      edgePanels.push(await noticePanel("PREVIEW DISABLED", "cached subject mask is missing"));
      continue;
    }
    if (!cropBuffer) {
      edgePanels.push(await noticePanel("PREVIEW UNAVAILABLE", "semantic crop could not be decoded"));
      continue;
    }
    try {
      const preview = await makeEdgePreview(recipe, cropBuffer, maskBuffer, edge);
      edgePanels.push(await panelFromImage(preview, { checker: true, rotate: false }));
    } catch (error) {
      warnings.push(`${edge} preview failed: ${error.message}`);
      edgePanels.push(await noticePanel(`${edge.toUpperCase()} PREVIEW ERROR`, error.message));
    }
  }

  let finalPanel;
  const finalExists = await exists(finalPath);
  const intentionallyUnpublished = recipe.publish === false;
  const finalMissing = !finalExists && !intentionallyUnpublished;
  if (intentionallyUnpublished) {
    finalPanel = await noticePanel("REVIEW REJECTED", `fallback: ${recipe.fallbackRecipeId ?? "card"}`);
  } else if (finalMissing) {
    finalPanel = await noticePanel("MISSING FINAL", recipe.output);
    warnings.push(`missing final: ${recipe.output}`);
  } else {
    try {
      finalPanel = await panelFromImage(await readFile(finalPath), { checker: true, rotate: false });
    } catch (error) {
      warnings.push(`final preview failed: ${error.message}`);
      finalPanel = await noticePanel("FINAL PREVIEW ERROR", error.message);
    }
  }

  return {
    recipe,
    panels: [sourcePanel, cropPanel, maskPanel, ...edgePanels, finalPanel],
    warnings,
    maskMissing: Boolean(recipe.mask) && !maskBuffer,
    finalMissing,
    intentionallyUnpublished,
  };
}

function sheetSvg(rows, height) {
  const columnLabels = COLUMNS.map((label, index) => {
    const x = MARGIN_X + index * (PANEL_WIDTH + COLUMN_GAP) + PANEL_WIDTH / 2;
    return `<text x="${x}" y="104" text-anchor="middle" class="column">${escapeXml(label)}</text>`;
  }).join("");

  const rowMarkup = rows.map(({ recipe, warnings }, index) => {
    const y = TOP_HEIGHT + index * ROW_HEIGHT;
    const crop = formatCrop(recipe.crop);
    const warningText = [...(recipe.qualityWarnings ?? []), ...warnings].join(" · ");
    return `
      <rect x="12" y="${y}" width="${SHEET_WIDTH - 24}" height="${ROW_HEIGHT - 4}"
        rx="8" fill="${index % 2 === 0 ? "#10151b" : "#131a22"}"/>
      <text x="${MARGIN_X}" y="${y + 25}" class="recipe">${escapeXml(recipe.id)}</text>
      <text x="${MARGIN_X + 380}" y="${y + 25}" class="meta">role ${escapeXml(recipe.role)} · tone ${escapeXml(recipe.defaultTone)} · edge ${escapeXml(recipe.defaultEdge)} · review ${escapeXml(reviewLabel(recipe.review))}</text>
      <text x="${MARGIN_X}" y="${y + 48}" class="identity">${escapeXml(truncate(recipe.identity, 150))}</text>
      <text x="${MARGIN_X}" y="${y + 67}" class="detail">crop ${escapeXml(crop)}${warningText ? ` · ⚠ ${escapeXml(truncate(warningText, 165))}` : ""}</text>
    `;
  }).join("");

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_WIDTH}" height="${height}">
      <style>
        text { font-family: Arial, sans-serif; }
        .title { fill: #f2f5f8; font-size: 28px; font-weight: 700; }
        .subtitle { fill: #91a1b5; font-size: 14px; }
        .column { fill: #aebdcd; font-size: 13px; font-weight: 700; letter-spacing: 0.6px; }
        .recipe { fill: #f0f4f8; font-size: 19px; font-weight: 700; }
        .meta { fill: #a8bacd; font-size: 14px; }
        .identity { fill: #d3dce6; font-size: 14px; }
        .detail { fill: #8092a6; font-size: 12px; }
      </style>
      <rect width="100%" height="100%" fill="#090d12"/>
      <text x="${MARGIN_X}" y="40" class="title">Roosevelt Island — preprocess v2 review</text>
      <text x="${MARGIN_X}" y="67" class="subtitle">Local-only QA: source → crop → cached mask → deterministic edge variants → published PNG. Checkerboard indicates transparency.</text>
      ${columnLabels}
      ${rowMarkup}
    </svg>
  `);
}

async function buildContactSheet({ only, out }) {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const recipes = config.recipes.filter(
    (recipe) => !only || only.has(recipe.assetId) || only.has(recipe.id),
  );
  if (recipes.length === 0) {
    throw new Error(`--only did not match any asset or recipe: ${[...(only ?? [])].join(",")}`);
  }

  const rows = [];
  for (let index = 0; index < recipes.length; index++) {
    const recipe = recipes[index];
    process.stdout.write(`[${index + 1}/${recipes.length}] ${recipe.id}\n`);
    rows.push(await reviewRecipe(recipe));
  }

  const height = TOP_HEIGHT + rows.length * ROW_HEIGHT + 18;
  const composites = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    for (let columnIndex = 0; columnIndex < COLUMN_COUNT; columnIndex++) {
      composites.push({
        input: rows[rowIndex].panels[columnIndex],
        left: MARGIN_X + columnIndex * (PANEL_WIDTH + COLUMN_GAP),
        top: TOP_HEIGHT + rowIndex * ROW_HEIGHT + ROW_INFO_HEIGHT,
      });
    }
  }

  const outputPath = resolveInsideProject(out);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(sheetSvg(rows, height)).composite(composites).png().toFile(outputPath);

  const missingMasks = rows.filter((row) => row.maskMissing).length;
  const missingFinals = rows.filter((row) => row.finalMissing).length;
  const rejectedFinals = rows.filter((row) => row.intentionallyUnpublished).length;
  const warningCount = rows.reduce((sum, row) => sum + row.warnings.length + (row.recipe.qualityWarnings?.length ?? 0), 0);
  console.log(`Contact sheet: ${path.relative(PROJECT_ROOT, outputPath).replaceAll("\\", "/")}`);
  console.log(`Rows: ${rows.length}; missing masks: ${missingMasks}; missing finals: ${missingFinals}; review-rejected: ${rejectedFinals}; warnings: ${warningCount}`);
  return { outputPath, rows: rows.length, missingMasks, missingFinals, rejectedFinals, warningCount };
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) console.log(USAGE);
    else await buildContactSheet(args);
  } catch (error) {
    console.error(`Contact sheet failed: ${error.message}`);
    process.exitCode = 1;
  }
}

export { buildContactSheet, parseArgs };
