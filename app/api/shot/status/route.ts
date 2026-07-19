import { NextResponse } from "next/server";
import { getCapabilities } from "@/lib/capabilities";
import { videoJobStatus, videoJobResult } from "@/lib/fal-server";

export const maxDuration = 30;

/**
 * Poll one image-to-video shot submitted via /api/shot/generate.
 * GET ?endpointId=...&requestId=... → { status, videoUrl? }.
 * Simulated environments report done with no url.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const endpointId = searchParams.get("endpointId");
  const requestId = searchParams.get("requestId");
  if (!endpointId || !requestId) {
    return NextResponse.json({ error: "endpointId and requestId required" }, { status: 400 });
  }

  const caps = getCapabilities();
  if (!caps.canRunPipeline || !caps.hasFal) {
    return NextResponse.json({ status: "done", simulated: true, videoUrl: null });
  }

  try {
    const { status } = await videoJobStatus(endpointId, requestId);
    if (status === "COMPLETED") {
      const { videoUrl } = await videoJobResult(endpointId, requestId);
      return NextResponse.json({ status: "completed", videoUrl });
    }
    return NextResponse.json({ status });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
