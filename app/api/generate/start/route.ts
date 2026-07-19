import { NextResponse } from "next/server";
import { getCapabilities } from "@/lib/capabilities";
import { layoutToScene } from "@/lib/layout-to-scene";
import type { ProjectState } from "@/lib/local-store";

/**
 * Kick off film generation. The client owns the progress theater; this route
 * returns the step plan + film URL. Locally it also persists the real
 * pipeline inputs (data/project.json + data/scenes/generated/*) so the
 * render track can pick them up — Vercel writes nothing.
 */
export async function POST(req: Request) {
  const { project } = (await req.json()) as { project: ProjectState };
  if (!project?.slug || !project.story?.beats?.length) {
    return NextResponse.json({ error: "project with story beats required" }, { status: 400 });
  }

  const caps = getCapabilities();
  const persisted: string[] = [];

  if (caps.canWriteFs) {
    const { writeFile, mkdir, rename } = await import("node:fs/promises");
    const path = await import("node:path");

    const projectFile = path.join(process.cwd(), "data", "project.json");
    const tmp = `${projectFile}.tmp`;
    await writeFile(tmp, JSON.stringify(project, null, 2), "utf8");
    await rename(tmp, projectFile);
    persisted.push("data/project.json");

    const sceneDir = path.join(process.cwd(), "data", "scenes", "generated", project.slug);
    await mkdir(sceneDir, { recursive: true });
    const beats = project.story.beats;
    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      const layout = project.layouts[beat.id];
      if (!layout || layout.items.length === 0) continue;
      const next = beats[i + 1];
      const transition = next ? (project.transitions[`${beat.id}->${next.id}`] ?? null) : null;
      const scene = layoutToScene(beat, layout, transition);
      const file = path.join(sceneDir, `beat_${String(i + 1).padStart(2, "0")}.json`);
      await writeFile(file, JSON.stringify(scene, null, 2), "utf8");
      persisted.push(`data/scenes/generated/${project.slug}/beat_${String(i + 1).padStart(2, "0")}.json`);
    }
  }

  // Film to play when the theater finishes: a real render if one exists.
  let filmUrl: string | null = null;
  try {
    const { readdirSync } = await import("node:fs");
    const path = await import("node:path");
    const filmsDir = path.join(process.cwd(), "public", "films");
    const files = readdirSync(filmsDir).filter((f) => f.endsWith(".mp4"));
    const exact = files.find((f) => f === `${project.slug}.mp4`);
    filmUrl = exact ? `/films/${exact}` : files[0] ? `/films/${files[0]}` : null;
  } catch {
    filmUrl = `/films/${project.slug}.mp4`; // conventional URL; client handles 404
  }

  const steps = [
    { label: "Compiling scene definitions", ms: 1800 },
    { label: "Rendering parallax shots (archive pixels untouched)", ms: 3400 },
    { label: "Building transitions", ms: 2400 },
    { label: "Assembling the film", ms: 2000 },
  ];

  return NextResponse.json({
    jobId: `gen_${Date.now()}`,
    mode: caps.canRunPipeline ? "local" : "simulated",
    steps,
    filmUrl,
    persisted,
  });
}
