import { NextResponse } from "next/server";
import { suggestTransition } from "@/lib/llm";
import type { StoryBeat } from "@/lib/local-store";

export const maxDuration = 30;

export async function POST(req: Request) {
  const body = (await req.json()) as { from: StoryBeat; to: StoryBeat };
  if (!body.from || !body.to) {
    return NextResponse.json({ error: "from and to beats required" }, { status: 400 });
  }
  try {
    const { transition, requestId } = await suggestTransition(body.from, body.to);
    return NextResponse.json({ transition, requestId });
  } catch (err) {
    console.error("transition/suggest failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Suggestion failed — try again" }, { status: 502 });
  }
}
