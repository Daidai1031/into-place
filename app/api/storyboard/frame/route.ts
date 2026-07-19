import { NextResponse } from "next/server";
import { callImageModel, uploadToFal } from "@/lib/fal-server";
import { getCapabilities } from "@/lib/capabilities";
import {
  compileFramePrompt,
  compileEditPrompt,
  MAX_SOURCE_IMAGES_PER_FRAME,
} from "@/lib/prompt-compiler";
import { T2I_MODELS, T2I_DEFAULT, NANO_BANANA_2 } from "@/lib/models";
import type { AssetBrief, PlaceBrief } from "@/lib/llm";
import type { StoryBeat } from "@/lib/local-store";

export const maxDuration = 60;

/**
 * Generate or edit ONE storyboard frame with a text-to-image model
 * (pivot 2026-07-19). The frame IS the output now and is ALWAYS labeled
 * "AI-generated" in the UI — archive assets are fed only as visual references
 * and keep their own provenance. Prompts are compiled (never hand-written) via
 * lib/prompt-compiler.ts. Cheap (~$0.04/frame) so it stays synchronous.
 *
 * Modes:
 *  - generate:        prompt from beat + reference contact sheet.
 *  - edit_add_asset:  current frame + a dragged archival cutout at a drop point.
 *  - edit_prompt:     current frame + a natural-language instruction.
 *
 * Env-split (mirrors /api/storyboard/layout): no FAL_KEY or Vercel → return a
 * clearly-labeled placeholder frame. The demo never blocks on a model.
 */

interface FrameRequest {
  place: PlaceBrief;
  beat: StoryBeat;
  references?: AssetBrief[]; // for prompt text
  filmPremise?: string;
  model?: string; // key into T2I_MODELS
  mode: "generate" | "edit_add_asset" | "edit_prompt";
  /** contact sheet (jpeg dataURL) of the reference cutouts — generate mode */
  referenceSheetDataUrl?: string;
  /** fal-hosted url of the current frame — edit modes */
  currentImageUrl?: string;
  /** dragged cutout as dataURL — edit_add_asset */
  addAssetDataUrl?: string;
  addAssetTitle?: string;
  dropHint?: { x: number; y: number };
  /** natural-language change — edit_prompt */
  instruction?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as FrameRequest;
  const caps = getCapabilities();

  // Pick model; edits require edit-capable model → fall back to nano-banana-2.
  let model = T2I_MODELS[body.model ?? T2I_DEFAULT] ?? T2I_MODELS[T2I_DEFAULT];
  const isEdit = body.mode !== "generate";
  if (isEdit && !model.supportsEdit) model = NANO_BANANA_2;

  const prompt =
    body.mode === "edit_add_asset"
      ? compileEditPrompt({ assetTitle: body.addAssetTitle, dropHint: body.dropHint })
      : body.mode === "edit_prompt"
        ? compileEditPrompt({ instruction: body.instruction })
        : compileFramePrompt({
            place: body.place,
            beat: body.beat,
            references: (body.references ?? []).slice(0, MAX_SOURCE_IMAGES_PER_FRAME),
            filmPremise: body.filmPremise,
          });

  // Simulated environments: labeled placeholder, never block.
  if (!caps.hasFal || !caps.canRunPipeline) {
    return NextResponse.json({
      imageUrl: placeholderFrame(body.beat, model.displayName),
      model: body.model ?? T2I_DEFAULT,
      prompt,
      requestId: null,
      costUsd: null,
      source: "placeholder",
    });
  }

  try {
    // Assemble the image reference set that the model actually sees.
    const imageUrls: string[] = [];
    if (body.mode === "generate") {
      if (body.referenceSheetDataUrl) {
        imageUrls.push(await uploadToFal(dataUrlToBlob(body.referenceSheetDataUrl)));
      }
    } else {
      if (body.currentImageUrl) imageUrls.push(body.currentImageUrl);
      if (body.mode === "edit_add_asset" && body.addAssetDataUrl) {
        imageUrls.push(await uploadToFal(dataUrlToBlob(body.addAssetDataUrl)));
      }
    }

    const input: Record<string, unknown> = { [model.promptParam]: prompt };
    if (model.imageRefsParam && imageUrls.length) {
      input[model.imageRefsParam] = imageUrls;
    }
    if (model.aspectRatioParam) {
      input[model.aspectRatioParam] = model.aspectRatioValue ?? "16:9";
    }
    input.num_images = 1;
    if (model.extraInput) Object.assign(input, model.extraInput);

    const { imageUrl, requestId } = await callImageModel(model.endpointId, input);

    return NextResponse.json({
      imageUrl,
      model: body.model ?? T2I_DEFAULT,
      prompt,
      requestId,
      costUsd: estimateCost(model.endpointId),
      source: "generated",
    });
  } catch (err) {
    console.warn("frame generation failed:", err instanceof Error ? err.message : err);
    // Never block the workflow — hand back a labeled placeholder.
    return NextResponse.json({
      imageUrl: placeholderFrame(body.beat, model.displayName),
      model: body.model ?? T2I_DEFAULT,
      prompt,
      requestId: null,
      costUsd: null,
      source: "placeholder",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Rough per-call estimate (real cost verified via fal MCP before paid runs). */
function estimateCost(endpointId: string): number {
  if (endpointId.includes("flux")) return 0.045;
  return 0.04; // nano-banana family
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, data] = dataUrl.split(",");
  const mime = head.match(/data:(.*?);/)?.[1] ?? "image/png";
  return new Blob([Buffer.from(data, "base64")], { type: mime });
}

/** Labeled SVG placeholder for simulated/failed generation — clearly not archive. */
function placeholderFrame(beat: StoryBeat, modelName: string): string {
  const text = beat.text.length > 120 ? beat.text.slice(0, 117) + "…" : beat.text;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#e9e2d2"/>
  <rect x="24" y="24" width="1232" height="672" fill="none" stroke="#a5432c" stroke-width="3" stroke-dasharray="12 10"/>
  <text x="64" y="120" font-family="Georgia, serif" font-size="34" fill="#5b5344">${escapeXml(beat.act)}</text>
  <foreignObject x="64" y="150" width="1152" height="360">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Georgia,serif;font-size:40px;line-height:1.35;color:#3a352c">${escapeXml(text)}</div>
  </foreignObject>
  <text x="64" y="650" font-family="monospace" font-size="24" fill="#a5432c">AI-GENERATED FRAME — simulated (${escapeXml(modelName)}, no live generation)</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}
