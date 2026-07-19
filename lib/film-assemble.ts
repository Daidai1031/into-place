/**
 * Shared film-assembly helpers (used by /api/assemble and scripts/render-film.mts).
 * NOT server-only: the tsx script imports it too. Node built-ins only — never
 * import this from client code.
 *
 * The film is always built as ONE CLIP PER BEAT (image-to-video from that beat's
 * approved frame), then xfade-concatenated. There is no single long generation.
 */
import { execFileSync } from "node:child_process";
import type { FalModel } from "./models";

/** Snap a requested duration to what the model actually accepts. */
export function snapDuration(endpointId: string, requested: number): number {
  const nearest = (allowed: number[]) =>
    allowed.reduce((a, b) => (Math.abs(b - requested) < Math.abs(a - requested) ? b : a));
  if (endpointId.includes("kling")) return nearest([5, 10]);
  if (endpointId.includes("veo3.1")) return nearest([4, 6, 8]);
  if (endpointId.includes("happy-horse")) return Math.max(3, Math.min(15, Math.round(requested)));
  return Math.max(1, Math.round(requested));
}

/** Per-model i2v input (duration formatting + muted audio differ by family). */
export function buildI2vInput(
  model: FalModel,
  frameUrl: string,
  prompt: string,
  duration: number,
): Record<string, unknown> {
  const d = snapDuration(model.endpointId, duration);
  const input: Record<string, unknown> = { [model.startFrameParam]: frameUrl, prompt };
  if (model.endpointId.includes("veo3.1")) {
    input.duration = `${d}s`;
    input.generate_audio = false;
  } else if (model.endpointId.includes("kling")) {
    input.duration = String(d);
    input.generate_audio = false;
  } else if (model.endpointId.includes("happy-horse")) {
    input.duration = d;
    input.resolution = "720p";
  } else {
    input.duration = d;
  }
  return input;
}

const XFADE: Record<string, string> = {
  push_dissolve: "fade",
  crossfade: "fade",
  wipe: "wipeleft",
  page_turn: "smoothleft",
  match_cut: "fade",
  cut: "fade",
  custom: "fade",
};

/**
 * Unified grade applied to EVERY clip so five separately-generated shots share
 * one look (a shared grade, not per-clip histogram matching). Tuned muted
 * blue-gray shadows + warm/sepia mids per the master style, and deliberately
 * LIFTS the image — the raw i2v output reads a touch too dark. Tune here:
 *  - eq brightness: overall lift (raise if still dark, lower if washed out)
 *  - curves black point (0/0.05): un-crush shadows without flattening
 *  - colorbalance: shadows→blue-gray, mids→sepia; keep small to stay restrained
 */
const GRADE =
  "eq=brightness=0.06:contrast=1.04:saturation=0.85," +
  "curves=all='0/0.05 0.5/0.52 1/0.97'," +
  "colorbalance=rs=-0.03:bs=0.05:rm=0.03:bm=-0.03";

const SCALE =
  "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1," +
  GRADE +
  ",format=yuv420p,fps=30";

function ffprobeDuration(file: string): number {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file,
  ]).toString().trim();
  return Number(out) || 5;
}

/**
 * xfade-concatenate clips into `out`. `transitions[i]` is the transition BETWEEN
 * clip i and clip i+1 (length clips.length-1, nulls allowed). All clips are
 * scaled/padded to 1280x720@30 and run through the unified GRADE first; the
 * finished film fades to black over `fadeOutDur`. No audio (clips are muted).
 */
export function xfadeConcat(
  clipFiles: string[],
  transitions: (string | null)[],
  out: string,
  transitionDur = 0.7,
  fadeOutDur = 1.0,
): void {
  if (clipFiles.length === 0) throw new Error("no clips to assemble");
  if (clipFiles.length === 1) {
    const dur = ffprobeDuration(clipFiles[0]);
    const st = Math.max(0, dur - fadeOutDur);
    const vf = `${SCALE},fade=t=out:st=${st.toFixed(2)}:d=${fadeOutDur.toFixed(2)}`;
    execFileSync("ffmpeg", [
      "-y", "-i", clipFiles[0], "-vf", vf,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
    ], { stdio: "inherit" });
    return;
  }
  const durs = clipFiles.map(ffprobeDuration);
  const inputs = clipFiles.flatMap((c) => ["-i", c]);
  let fc = clipFiles.map((_, i) => `[${i}:v]${SCALE}[v${i}]`).join(";") + ";";
  let prev = "[v0]";
  let cum = durs[0];
  for (let m = 1; m < clipFiles.length; m++) {
    const t = Math.min(transitionDur, durs[m] - 0.1, durs[m - 1] - 0.1);
    const offset = Math.max(0, cum - t);
    const xf = XFADE[transitions[m - 1] ?? "push_dissolve"] ?? "fade";
    fc += `${prev}[v${m}]xfade=transition=${xf}:duration=${t.toFixed(2)}:offset=${offset.toFixed(2)}[vx${m}];`;
    cum = cum + durs[m] - t;
    prev = `[vx${m}]`;
  }
  // Fade the assembled timeline to black over the final fadeOutDur seconds.
  const st = Math.max(0, cum - fadeOutDur);
  fc += `${prev}fade=t=out:st=${st.toFixed(2)}:d=${fadeOutDur.toFixed(2)}[vout]`;
  execFileSync("ffmpeg", [
    "-y", ...inputs, "-filter_complex", fc, "-map", "[vout]",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
  ], { stdio: "inherit" });
}
