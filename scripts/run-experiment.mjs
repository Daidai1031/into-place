#!/usr/bin/env node
// Minimal I2V experiment runner for one approved storyboard frame.
// It records model, request id, inputs, estimated cost, and output under
// data/experiments/ and clips/. Recheck the endpoint schema and price before
// a paid run; model IDs here come only from lib/models.ts.

import { fal } from "@fal-ai/client";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  I2V_MODELS,
  COST_CONFIRMATION_THRESHOLD_USD,
} from "../lib/models.ts";

const DEFAULT_DURATION_SECONDS = 5;

function parseArgs(argv) {
  const args = { duration: DEFAULT_DURATION_SECONDS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--model") args.model = argv[++i];
    else if (arg === "--start") args.start = argv[++i];
    else if (arg === "--prompt") args.prompt = argv[++i];
    else if (arg === "--tag") args.tag = argv[++i];
    else if (arg === "--duration") args.duration = Number(argv[++i]);
    else if (arg === "--yes-i-know-the-cost") args.confirmed = true;
  }
  return args;
}

function estimateCostUsd(model, durationSeconds) {
  if (model.unit === "seconds") return model.unitPrice * durationSeconds;
  if (model.unit === "videos") return model.unitPrice;
  return null;
}

async function uploadLocalImage(filePath) {
  const buffer = await readFile(filePath);
  const extension = path.extname(filePath).slice(1) || "png";
  const mime = extension === "jpg" ? "jpeg" : extension;
  const file = new File([buffer], path.basename(filePath), { type: `image/${mime}` });
  return fal.storage.upload(file);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const model = I2V_MODELS[args.model];

  if (!model) {
    console.error(`--model must be one of: ${Object.keys(I2V_MODELS).join(", ")}`);
    process.exit(1);
  }
  if (!args.start || !args.prompt || !args.tag) {
    console.error("Required: --model --start --prompt --tag");
    process.exit(1);
  }
  if (!Number.isFinite(args.duration) || args.duration <= 0 || args.duration > model.maxDurationSeconds) {
    console.error(`--duration must be between 1 and ${model.maxDurationSeconds} seconds for ${args.model}`);
    process.exit(1);
  }

  const estimatedCost = estimateCostUsd(model, args.duration);
  const needsConfirmation =
    model.heroOnly ||
    estimatedCost === null ||
    estimatedCost > COST_CONFIRMATION_THRESHOLD_USD;
  if (needsConfirmation && !args.confirmed) {
    console.error(
      `This call requires confirmation (estimated cost: ${estimatedCost === null ? "unknown" : `$${estimatedCost.toFixed(2)}`}). ` +
        "Recheck fal pricing, then pass --yes-i-know-the-cost.",
    );
    process.exit(1);
  }

  if (!process.env.FAL_KEY) {
    console.error("FAL_KEY is missing. Add it to .env.local.");
    process.exit(1);
  }
  fal.config({ credentials: process.env.FAL_KEY });

  const startUrl = await uploadLocalImage(args.start);
  const input = {
    [model.startFrameParam]: startUrl,
    prompt: args.prompt,
    duration: String(args.duration),
  };

  console.log(`Submitting ${model.endpointId} in queue mode...`);
  const result = await fal.subscribe(model.endpointId, {
    input,
    logs: true,
    onQueueUpdate: (update) => {
      const messages = update.logs?.map((log) => log.message).join(" | ") ?? "";
      console.log(`  [${update.status}] ${messages}`);
    },
  });

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) throw new Error("The model returned no video URL.");

  await mkdir("clips", { recursive: true });
  const outputPath = path.join("clips", `${args.tag}.mp4`);
  const response = await fetch(videoUrl);
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));

  await mkdir("data/experiments", { recursive: true });
  const logPath = path.join("data/experiments", `${args.tag}.json`);
  await writeFile(
    logPath,
    JSON.stringify(
      {
        tag: args.tag,
        model: model.endpointId,
        request_id: result.requestId ?? null,
        input: { ...input, [model.startFrameParam]: "(uploaded)" },
        duration_seconds: args.duration,
        estimated_cost_usd: estimatedCost,
        output: outputPath,
        created_at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Saved ${outputPath}`);
  console.log(`Recorded ${logPath}`);
}

main().catch((error) => {
  console.error("Experiment failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
