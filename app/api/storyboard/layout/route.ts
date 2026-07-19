import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { extractJson } from "@/lib/fal-server";
import {
  fallbackLayout,
  sanitizeLayout,
  type LayoutAssetInput,
} from "@/lib/layout-fallback";

export const maxDuration = 60;

const VISION_ENDPOINT = "fal-ai/any-llm/vision";
const VISION_MODEL = "anthropic/claude-sonnet-4.5";
const DRAFT_ENDPOINT = "fal-ai/nano-banana/edit"; // $0.0398/image (checked 2026-07-19)
const MAX_COLLAGE_IMAGES = 7;

/**
 * Initial collage layout for one storyboard beat.
 * Step 1: nano-banana composes a REFERENCE draft from the labeled contact
 *         sheet (reference only — never shown as output, never a final frame).
 * Step 2: a vision LLM reads the reference + contact sheet and emits layout
 *         JSON that places the REAL cutout PNGs; pixels are never repainted.
 * Any failure → deterministic heuristic. The demo never blocks on a model.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    beatText: string;
    contactSheetDataUrl?: string;
    assets: LayoutAssetInput[];
  };
  if (!body.assets?.length) {
    return NextResponse.json({ error: "assets required" }, { status: 400 });
  }
  if (body.assets.length > MAX_COLLAGE_IMAGES) {
    return NextResponse.json(
      { error: `a collage can use at most ${MAX_COLLAGE_IMAGES} source images` },
      { status: 400 },
    );
  }

  const assetLines = body.assets
    .map(
      (a, i) =>
        `${i + 1}. id="${a.id}" role=${a.role} aspect=${(a.width / Math.max(a.height, 1)).toFixed(2)}`,
    )
    .join("\n");

  let referenceUrl: string | null = null;
  const requestIds: Record<string, string> = {};

  try {
    if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");
    fal.config({ credentials: process.env.FAL_KEY });

    // Upload the client-built contact sheet once; both models reference it.
    if (!body.contactSheetDataUrl) throw new Error("no contact sheet");
    const blob = dataUrlToBlob(body.contactSheetDataUrl);
    const sheetUrl = await fal.storage.upload(blob);

    // Step 1 — composition reference draft (best effort).
    try {
      const draft = await fal.subscribe(DRAFT_ENDPOINT, {
        input: {
          prompt: `This contact sheet shows numbered paper cutouts and archival photo cards. Recompose EXACTLY these numbered pieces into a single 16:9 collage that stages this scene: "${body.beatText}". Keep every piece recognizable and unchanged in content — only reposition, resize, rotate, overlap them on a warm paper background. Do not add new objects, text, or effects.`,
          image_urls: [sheetUrl],
          aspect_ratio: "16:9",
          num_images: 1,
          limit_generations: true,
        },
      });
      const images = (draft.data as { images?: { url?: string }[] }).images;
      referenceUrl = images?.[0]?.url ?? null;
      requestIds.reference = draft.requestId;
    } catch (e) {
      console.warn("layout reference draft failed:", e instanceof Error ? e.message : e);
    }

    // Step 2 — vision LLM turns the reference into placement JSON.
    const visionImages = [sheetUrl, ...(referenceUrl ? [referenceUrl] : [])];
    const vision = await fal.subscribe(VISION_ENDPOINT, {
      input: {
        model: VISION_MODEL,
        system_prompt:
          "You are a collage layout engine. Answer with STRICT JSON only — no fences, no commentary.",
        prompt: `Image 1 is a numbered contact sheet of paper cutouts.${referenceUrl ? " Image 2 is a composed collage reference using those pieces." : ""}

Scene to stage: "${body.beatText}"

Pieces:
${assetLines}

Place EVERY piece once on a 16:9 stage${referenceUrl ? ", matching the reference composition as closely as possible" : ""}. Coordinates: x,y are the piece CENTER in 0..1 stage fractions. scale 1.0 = piece spans 35% of stage width. rotation in degrees (-45..45). z = stacking order (0 = back). role=bg pieces go behind at large scale.

JSON schema: [{"assetId":"...","x":0.5,"y":0.5,"scale":1,"rotation":0,"z":0}]`,
        image_urls: visionImages,
        temperature: 0.4,
        max_tokens: 1200,
      },
    });
    requestIds.vision = vision.requestId;
    const data = vision.data as { output: string; error?: string | null };
    if (data.error) throw new Error(data.error);
    const proposed = extractJson<Record<string, unknown>[]>(data.output);
    const layout = sanitizeLayout(proposed, body.assets);
    if (!layout) throw new Error("layout failed validation");

    return NextResponse.json({ layout, referenceUrl, requestIds, source: "ai" });
  } catch (err) {
    console.warn("AI layout failed, using heuristic:", err instanceof Error ? err.message : err);
    return NextResponse.json({
      layout: fallbackLayout(body.assets),
      referenceUrl,
      requestIds,
      source: "fallback",
    });
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, data] = dataUrl.split(",");
  const mime = head.match(/data:(.*?);/)?.[1] ?? "image/png";
  const bytes = Buffer.from(data, "base64");
  return new Blob([bytes], { type: mime });
}
