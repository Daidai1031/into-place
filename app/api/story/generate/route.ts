import { NextResponse } from "next/server";
import { getPlace } from "@/lib/places";
import { generateDirections, generateBeats, type AssetBrief } from "@/lib/llm";

export const maxDuration = 60;

/**
 * phase "directions": propose 3 story directions from the curated archive.
 * phase "beats": write 5–8 beats for the chosen direction.
 * Request ids are returned for traceability (never the key).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    slug: string;
    phase: "directions" | "beats";
    assets: AssetBrief[];
    direction?: { title: string; premise: string };
  };
  const place = getPlace(body.slug);
  if (!place) return NextResponse.json({ error: "Place not found" }, { status: 404 });
  if (!body.assets?.length) {
    return NextResponse.json({ error: "No curated assets provided" }, { status: 400 });
  }
  const brief = { name: place.name, region: place.region, tagline: place.tagline };

  try {
    if (body.phase === "directions") {
      const { directions, requestId } = await generateDirections(brief, body.assets);
      return NextResponse.json({ directions, requestId });
    }
    if (!body.direction) {
      return NextResponse.json({ error: "direction required for beats phase" }, { status: 400 });
    }
    const { beats, requestId } = await generateBeats(brief, body.assets, body.direction);
    if (beats.length < 5) {
      return NextResponse.json({ error: "Model returned fewer than 5 beats — try again" }, { status: 502 });
    }
    return NextResponse.json({ beats, requestId });
  } catch (err) {
    console.error("story/generate failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Story generation failed — try again" }, { status: 502 });
  }
}
