import { NextResponse } from "next/server";
import { getCapabilities } from "@/lib/capabilities";
import { xfadeConcat } from "@/lib/film-assemble";

export const maxDuration = 120;

/**
 * Assemble already-generated i2v clips into the final film (pivot 2026-07-19).
 * Downloads each clip URL, xfade-concatenates with FFmpeg, writes final/<slug>.mp4
 * and publishes a copy to public/films/<slug>.mp4 so it plays immediately.
 * Local only (needs FFmpeg + writable fs); simulated environments 501.
 */
interface Body {
  slug: string;
  clips: { videoUrl: string; transitionType?: string | null }[];
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body.slug || !/^[a-z0-9-]+$/.test(body.slug) || !body.clips?.length) {
    return NextResponse.json({ error: "slug and clips required" }, { status: 400 });
  }

  const caps = getCapabilities();
  if (!caps.canWriteFs) {
    return NextResponse.json(
      { error: "assembly runs locally only (needs FFmpeg + writable fs)" },
      { status: 501 },
    );
  }

  try {
    const { writeFile, mkdir, copyFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const root = process.cwd();

    const clipsDir = path.join(root, "renders", body.slug);
    await mkdir(clipsDir, { recursive: true });
    const clipFiles: string[] = [];
    for (let i = 0; i < body.clips.length; i++) {
      const res = await fetch(body.clips[i].videoUrl);
      if (!res.ok) throw new Error(`clip ${i + 1} download failed (${res.status})`);
      const buf = Buffer.from(await res.arrayBuffer());
      const file = path.join(clipsDir, `clip_${String(i + 1).padStart(2, "0")}.mp4`);
      await writeFile(file, buf);
      clipFiles.push(file);
    }

    const finalDir = path.join(root, "final");
    await mkdir(finalDir, { recursive: true });
    const finalOut = path.join(finalDir, `${body.slug}.mp4`);
    const transitions = body.clips.slice(0, -1).map((c) => c.transitionType ?? null);
    xfadeConcat(clipFiles, transitions, finalOut);
    // Every fresh assembly is silent. Keep an exact master for repeatable
    // soundtrack regeneration without ever stacking audio tracks.
    await copyFile(finalOut, path.join(clipsDir, "silent-master.mp4"));

    // Publish so the browser can play it right away.
    const publicDir = path.join(root, "public", "films");
    await mkdir(publicDir, { recursive: true });
    await copyFile(finalOut, path.join(publicDir, `${body.slug}.mp4`));

    return NextResponse.json({ filmUrl: `/films/${body.slug}.mp4`, clips: clipFiles.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
