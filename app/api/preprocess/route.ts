import { NextResponse } from "next/server";
import { getCapabilities } from "@/lib/capabilities";

/**
 * Persist a per-asset tone/edge override. Locally this mirrors the user's
 * choice into data/preprocess/overrides.json for the deterministic pipeline;
 * on Vercel the CSS preview is the experience and localStorage is the truth.
 */
export async function POST(req: Request) {
  const { slug, assetId, tone, edge } = (await req.json()) as {
    slug?: string;
    assetId?: string;
    tone?: string;
    edge?: string;
  };
  if (!slug || !assetId) {
    return NextResponse.json({ error: "slug and assetId required" }, { status: 400 });
  }

  const caps = getCapabilities();
  if (!caps.canWriteFs) {
    return NextResponse.json({ persisted: false, note: "Simulation mode — stored in your browser." });
  }

  const { readFile, writeFile, rename, mkdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const file = path.join(process.cwd(), "data", "preprocess", "overrides.json");
  let overrides: Record<string, Record<string, { tone?: string; edge?: string }>> = {};
  try {
    overrides = JSON.parse(await readFile(file, "utf8"));
  } catch {
    /* first write */
  }
  overrides[slug] = { ...overrides[slug], [assetId]: { tone, edge } };
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(overrides, null, 2), "utf8");
  await rename(tmp, file);
  return NextResponse.json({ persisted: true });
}
