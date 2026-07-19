import { NextResponse } from "next/server";
import { getCapabilities } from "@/lib/capabilities";

export function GET() {
  return NextResponse.json(getCapabilities());
}
