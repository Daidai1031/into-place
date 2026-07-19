import { NextResponse } from "next/server";
import { getCapabilities } from "@/lib/capabilities";
import { submitVideoJob } from "@/lib/fal-server";
import { compileMotionPrompt, type ShotMotion } from "@/lib/prompt-compiler";
import { buildI2vInput, snapDuration } from "@/lib/film-assemble";
import { I2V_MODELS, I2V_DEFAULT, COST_CONFIRMATION_THRESHOLD_USD } from "@/lib/models";
import type { StoryBeat } from "@/lib/local-store";

export const maxDuration = 60;

/**
 * Submit ONE image-to-video shot (pivot 2026-07-19): the approved storyboard
 * frame is the first frame, animated per the compiled motion prompt. Queue mode
 * only (submit + poll via /api/shot/status) — never a synchronous wait.
 *
 * Cost discipline (CLAUDE.md): estimate > $5 or a hero-only model requires
 * `confirmed: true`. Simulated environments (Vercel / no FAL_KEY) never submit.
 */
interface Body {
  frameUrl: string;
  beat: StoryBeat;
  motion?: ShotMotion;
  model?: string; // key into I2V_MODELS
  durationSeconds?: number;
  resolution?: string;
  confirmed?: boolean;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body.frameUrl || !body.beat) {
    return NextResponse.json({ error: "frameUrl and beat required" }, { status: 400 });
  }

  const caps = getCapabilities();
  const modelKey = body.model ?? I2V_DEFAULT;
  const model = I2V_MODELS[modelKey] ?? I2V_MODELS[I2V_DEFAULT];
  const duration = snapDuration(model.endpointId, body.durationSeconds ?? 5);
  const estimatedCostUsd = Number((model.unitPrice * duration).toFixed(3));
  const motionPrompt = compileMotionPrompt({ beat: body.beat, motion: body.motion });

  if (!caps.canRunPipeline || !caps.hasFal) {
    return NextResponse.json({
      status: "simulated",
      model: modelKey,
      estimatedCostUsd,
      motionPrompt,
      note: "Simulated environment — no video generated.",
    });
  }

  if ((estimatedCostUsd > COST_CONFIRMATION_THRESHOLD_USD || model.heroOnly) && !body.confirmed) {
    return NextResponse.json({
      status: "needs_confirmation",
      estimatedCostUsd,
      model: modelKey,
      endpointId: model.endpointId,
      heroOnly: Boolean(model.heroOnly),
    });
  }

  try {
    const input = buildI2vInput(model, body.frameUrl, motionPrompt, duration);
    const { requestId } = await submitVideoJob(model.endpointId, input);
    return NextResponse.json({
      status: "queued",
      requestId,
      endpointId: model.endpointId,
      model: modelKey,
      estimatedCostUsd,
      durationSeconds: duration,
      motionPrompt,
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
