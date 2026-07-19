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
  paper_slide: "slideleft", // next shot pushes in laterally, like a page shoved aside
  paper_reveal: "revealup", // previous shot lifts away, revealing the next underneath
};

/**
 * `torn_paper` has no built-in xfade equivalent, so it's the one type driven by
 * a custom expr instead of the XFADE name table: a vertical sweep (top to
 * bottom, distinct from paper_slide's lateral push) perturbed by a sum of sines
 * so the boundary reads as a ragged tear rather than a straight wipe line.
 * Variables per ffmpeg's xfade custom transition: X,Y,W,H,P (progress),A,B.
 */
const TORN_PAPER_EXPR =
  "if(lt(Y,H*P+18*sin(X*0.045)+9*sin(X*0.11+1.7)),A,B)";

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

export function ffprobeDuration(file: string): number {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file,
  ]).toString().trim();
  return Number(out) || 5;
}

/** True when a media file already contains at least one audio stream. */
export function hasAudioStream(file: string): boolean {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file,
  ]).toString().trim();
  return out.length > 0;
}

/**
 * Start time (seconds) of each clip on the xfade-concatenated timeline, using
 * the exact same offset math as `xfadeConcat` so the audio pass can place each
 * clip's foley in sync with what ends up on screen. `durs[i]` is clip i's raw
 * duration; `transitionDur` is the nominal xfade length.
 */
export function clipOffsets(durs: number[], transitionDur = 0.7): number[] {
  const starts: number[] = [];
  let cum = 0;
  for (let i = 0; i < durs.length; i++) {
    if (i === 0) {
      starts.push(0);
      cum = durs[0];
      continue;
    }
    const t = Math.min(transitionDur, durs[i] - 0.1, durs[i - 1] - 0.1);
    const offset = Math.max(0, cum - t);
    starts.push(offset);
    cum = cum + durs[i] - t;
  }
  return starts;
}

export interface FoleyTrack {
  /** A media file whose audio stream is the diegetic foley for one clip. */
  file: string;
  /** When (seconds) this clip begins on the final timeline (see clipOffsets). */
  startSec: number;
}

/**
 * Mux a curated audio track onto an already-assembled (silent) film: each
 * foley track is delayed to its clip offset and summed, one music bed is looped
 * to length and ducked underneath optional narration, the whole mix fades out
 * with the picture and passes through a limiter to stay clear of clipping.
 * Video is copied, not re-encoded; each layer has its own gain control.
 */
export function muxFilmAudio(args: {
  videoIn: string;
  out: string;
  foley: FoleyTrack[];
  musicFile?: string | null;
  narrationFile?: string | null;
  foleyGainDb?: number;
  musicGainDb?: number;
  narrationGainDb?: number;
  narrationDelaySec?: number;
  fadeOutDur?: number;
}): void {
  const {
    videoIn,
    out,
    foley,
    musicFile = null,
    narrationFile = null,
    foleyGainDb = 0,
    musicGainDb = -13,
    narrationGainDb = -3,
    narrationDelaySec = 0.6,
    fadeOutDur = 1.0,
  } = args;
  if (foley.length === 0 && !musicFile && !narrationFile) {
    throw new Error("muxFilmAudio: no audio inputs");
  }
  const total = ffprobeDuration(videoIn);
  const fadeSt = Math.max(0, total - fadeOutDur);

  // Input 0 = the silent video. Foley inputs follow, then a stream-looped music
  // input (so a short score tiles to cover a longer film before it is trimmed).
  const inputs: string[] = ["-i", videoIn];
  const parts: string[] = [];
  const mixLabels: string[] = [];

  // Everything is forced to stereo/48k before mixing so a mono foley source
  // (MMAudio returns mono) never collapses the stereo music bed to mono.
  const STEREO = "aresample=48000,aformat=channel_layouts=stereo";
  foley.forEach((f, i) => {
    const idx = i + 1; // ffmpeg input index
    inputs.push("-i", f.file);
    const delayMs = Math.max(0, Math.round(f.startSec * 1000));
    parts.push(
      `[${idx}:a]${STEREO},adelay=${delayMs}:all=1,volume=${foleyGainDb}dB[fx${i}]`,
    );
    mixLabels.push(`[fx${i}]`);
  });

  if (musicFile) {
    const idx = foley.length + 1;
    inputs.push("-stream_loop", "-1", "-i", musicFile);
    const gain = narrationFile ? Math.min(musicGainDb, -17) : musicGainDb;
    parts.push(
      `[${idx}:a]${STEREO},atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,volume=${gain}dB[music]`,
    );
    mixLabels.push(`[music]`);
  }

  if (narrationFile) {
    const idx = foley.length + (musicFile ? 2 : 1);
    const delayMs = Math.max(0, Math.round(narrationDelaySec * 1000));
    inputs.push("-i", narrationFile);
    parts.push(
      `[${idx}:a]${STEREO},adelay=${delayMs}:all=1,apad,atrim=0:${total.toFixed(3)},volume=${narrationGainDb}dB[narration]`,
    );
    mixLabels.push(`[narration]`);
  }

  const n = mixLabels.length;
  const mixIn = mixLabels.join("");
  // normalize=0 keeps each source at its set gain (amix otherwise divides by n).
  parts.push(
    `${mixIn}amix=inputs=${n}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)}[amixed]`,
  );
  parts.push(
    `[amixed]afade=t=out:st=${fadeSt.toFixed(2)}:d=${fadeOutDur.toFixed(2)},alimiter=limit=0.95[aout]`,
  );

  execFileSync("ffmpeg", [
    "-y", ...inputs,
    "-filter_complex", parts.join(";"),
    "-map", "0:v", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart", "-shortest", out,
  ], { stdio: "inherit" });
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
    const type = transitions[m - 1] ?? "push_dissolve";
    const seg =
      type === "torn_paper"
        ? `xfade=transition=custom:expr='${TORN_PAPER_EXPR}':duration=${t.toFixed(2)}:offset=${offset.toFixed(2)}`
        : `xfade=transition=${XFADE[type] ?? "fade"}:duration=${t.toFixed(2)}:offset=${offset.toFixed(2)}`;
    fc += `${prev}[v${m}]${seg}[vx${m}];`;
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
