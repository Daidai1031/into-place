import { NextResponse } from "next/server";

/** Shared 501 responder for spec/03 routes not needed by the current UI. */
export function notImplemented(feature: string) {
  return NextResponse.json(
    {
      error: `${feature} is not implemented yet`,
      note: "Kept as a stub so spec/03 route names stay honest.",
    },
    { status: 501 },
  );
}
