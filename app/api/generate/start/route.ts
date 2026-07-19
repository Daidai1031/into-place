import { NextResponse } from "next/server";
import { getCapabilities } from "@/lib/capabilities";
import { compileMotionPrompt } from "@/lib/prompt-compiler";
import { I2V_DEFAULT } from "@/lib/models";
import type { ProjectState } from "@/lib/local-store";

/**
 * Prepare the film preview. The client owns the progress theater; this route
 * returns its step plan and the pre-rendered demo URL. Locally it mirrors the
 * approved storyboard state to data/project.json. Real I2V queue submission
 * and assembly remain separate pending routes; Vercel writes nothing.
 */
export async function POST(req: Request) {
  const { project } = (await req.json()) as { project: ProjectState };
  if (!project?.slug || !project.story?.beats?.length) {
    return NextResponse.json({ error: "project with story beats required" }, { status: 400 });
  }

  const caps = getCapabilities();
  const persisted: string[] = [];

  if (caps.canWriteFs) {
    const { writeFile, rename } = await import("node:fs/promises");
    const path = await import("node:path");

    const projectFile = path.join(process.cwd(), "data", "project.json");
    const tmp = `${projectFile}.tmp`;
    await writeFile(tmp, JSON.stringify(project, null, 2), "utf8");
    await rename(tmp, projectFile);
    persisted.push("data/project.json");

    // Film manifest — the traceable input for scripts/render-film.mts (i2v).
    const { mkdir } = await import("node:fs/promises");
    const beats = project.story.beats;
    const shots = beats.map((b, i) => {
      const mode = project.beatMode?.[b.id] ?? "generated";
      const frame = project.frames?.[b.id] ?? null;
      const next = beats[i + 1];
      const transitionOut = next ? (project.transitions?.[`${b.id}->${next.id}`] ?? null) : null;
      return {
        index: i + 1,
        beatId: b.id,
        act: b.act,
        text: b.text,
        mode,
        frameUrl: mode === "generated" ? (frame?.imageUrl ?? null) : null,
        frameSource: frame?.source ?? null,
        frameModel: frame?.model ?? null,
        durationSeconds: 5,
        motionPrompt: compileMotionPrompt({ beat: b }),
        transitionOut,
      };
    });
    const manifest = {
      slug: project.slug,
      pipeline: "generated-frame->i2v",
      i2vModelDefault: I2V_DEFAULT,
      createdWith: "api/generate/start",
      beats: shots,
    };
    const genDir = path.join(process.cwd(), "data", "scenes", "generated", project.slug);
    await mkdir(genDir, { recursive: true });
    const manifestFile = path.join(genDir, "film-manifest.json");
    const mtmp = `${manifestFile}.tmp`;
    await writeFile(mtmp, JSON.stringify(manifest, null, 2), "utf8");
    await rename(mtmp, manifestFile);
    persisted.push(`data/scenes/generated/${project.slug}/film-manifest.json`);
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
    { label: "Validating approved storyboard frames", ms: 1800 },
    { label: "Compiling image-to-video prompts", ms: 2600 },
    { label: "Preparing video shots", ms: 3000 },
    { label: "Preparing the film preview", ms: 1800 },
  ];

  return NextResponse.json({
    jobId: `gen_${Date.now()}`,
    mode: caps.canWriteFs ? "local-preview" : "simulated",
    steps,
    filmUrl,
    persisted,
  });
}
