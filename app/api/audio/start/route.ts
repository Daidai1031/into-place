import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import {
  estimateAudioCost,
  findRunningAudioJob,
  startAudioJob,
} from "@/lib/audio-jobs";
import { getCapabilities } from "@/lib/capabilities";
import { getPlace } from "@/lib/places";

export const runtime = "nodejs";

interface Body {
  slug?: string;
  confirmed?: boolean;
  music?: boolean;
  narration?: boolean;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const slug = body.slug ?? "";
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "A valid place slug is required." }, { status: 400 });
  }
  const place = getPlace(slug);
  if (!place) return NextResponse.json({ error: "Place not found." }, { status: 404 });
  const selection = {
    music: body.music !== false,
    narration: Boolean(body.narration),
  };
  if (!selection.music && !selection.narration) {
    return NextResponse.json({ error: "Select background music, narration, or both." }, { status: 400 });
  }
  if (!body.confirmed) {
    return NextResponse.json(
      { error: "Confirm the estimated paid audio generation cost first." },
      { status: 400 },
    );
  }

  const caps = getCapabilities();
  if (!caps.canRunPipeline || !caps.canWriteFs || !caps.hasFal) {
    return NextResponse.json(
      { error: "Music generation requires the local pipeline and a FAL key." },
      { status: 501 },
    );
  }

  const root = process.cwd();
  if (!existsSync(path.join(root, "final", `${slug}.mp4`))) {
    return NextResponse.json({ error: "Generate the film before adding music." }, { status: 409 });
  }
  if (selection.narration && !existsSync(path.join(root, "data", "project.json"))) {
    return NextResponse.json({ error: "Save the current Story map before adding narration." }, { status: 409 });
  }

  const existing = findRunningAudioJob(slug);
  if (existing) {
    return NextResponse.json(
      { ...existing, estimatedCostUsd: estimateAudioCost(existing.selection) },
      { status: 202 },
    );
  }

  const job = startAudioJob(slug, selection, { name: place.name, region: place.region });
  return NextResponse.json(
    { ...job, estimatedCostUsd: estimateAudioCost(selection) },
    { status: 202 },
  );
}
