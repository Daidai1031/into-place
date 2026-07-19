import { NextResponse } from "next/server";
import { getPlace } from "@/lib/places";
import { rerollBeat, type AssetBrief } from "@/lib/llm";
import type { StoryBeat } from "@/lib/local-store";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    slug: string;
    assets: AssetBrief[];
    beats: StoryBeat[];
    targetId: string;
    mode: "reroll" | "insert_after";
  };
  const place = getPlace(body.slug);
  if (!place) return NextResponse.json({ error: "Place not found" }, { status: 404 });

  try {
    const { beat, requestId } = await rerollBeat(
      { name: place.name, region: place.region, tagline: place.tagline },
      body.assets ?? [],
      body.beats ?? [],
      body.targetId,
      body.mode ?? "reroll",
    );
    return NextResponse.json({ beat, requestId });
  } catch (err) {
    console.error("story/reroll failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Beat generation failed — try again" }, { status: 502 });
  }
}
