import { NextResponse } from "next/server";

import { getAudioJob } from "@/lib/audio-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId") ?? "";
  if (!/^audio_[a-z0-9_]+$/i.test(jobId)) {
    return NextResponse.json({ error: "A valid audio job id is required." }, { status: 400 });
  }
  const job = getAudioJob(jobId);
  if (!job) return NextResponse.json({ error: "Audio job not found." }, { status: 404 });
  return NextResponse.json(job, {
    headers: { "Cache-Control": "no-store" },
  });
}
