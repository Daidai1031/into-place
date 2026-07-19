import { NextResponse } from "next/server";

/** Progress is client-driven (steps from /api/generate/start); this route
 *  exists for spec/03 compatibility and always reports done. */
export function GET() {
  return NextResponse.json({ status: "done" });
}
