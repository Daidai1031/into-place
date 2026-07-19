import { NextResponse } from "next/server";
import { getCapabilities } from "@/lib/capabilities";
import type { ProjectState } from "@/lib/local-store";

/** Mirror browser project state into data/project.json (local dev only). */
export async function POST(req: Request) {
  const { project } = (await req.json()) as { project: ProjectState };
  if (!project?.slug) {
    return NextResponse.json({ error: "project required" }, { status: 400 });
  }
  const caps = getCapabilities();
  if (!caps.canWriteFs) {
    return NextResponse.json({ persisted: false, note: "Simulation mode — browser storage is the source of truth." });
  }
  const { writeFile, rename } = await import("node:fs/promises");
  const path = await import("node:path");
  const file = path.join(process.cwd(), "data", "project.json");
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(project, null, 2), "utf8");
  await rename(tmp, file);
  return NextResponse.json({ persisted: true });
}
