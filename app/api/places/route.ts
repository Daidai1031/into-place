import { NextResponse } from "next/server";
import { listPlaces } from "@/lib/places";

export function GET() {
  return NextResponse.json({ places: listPlaces() });
}
