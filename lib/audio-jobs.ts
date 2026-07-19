import "server-only";

import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type AudioJobStatus = "running" | "done" | "failed";

export interface AudioSelection {
  music: boolean;
  narration: boolean;
}

export interface AudioJob {
  id: string;
  slug: string;
  status: AudioJobStatus;
  message: string;
  error?: string;
  filmUrl?: string;
  selection: AudioSelection;
  narrationText?: string;
  startedAt: string;
  finishedAt?: string;
}

export function estimateAudioCost(selection: AudioSelection): number {
  return (selection.music ? 0.1 : 0) + (selection.narration ? 0.03 : 0);
}

interface InternalAudioJob extends AudioJob {
  output: string;
}

declare global {
  // Keep jobs alive across route-module reloads in local Next development.
  var __intoPlaceAudioJobs: Map<string, InternalAudioJob> | undefined;
}

const jobs = (globalThis.__intoPlaceAudioJobs ??= new Map<string, InternalAudioJob>());

function publicJob(job: InternalAudioJob): AudioJob {
  const { output: _output, ...safe } = job;
  return safe;
}

function appendOutput(job: InternalAudioJob, chunk: string) {
  job.output = (job.output + chunk).slice(-16_000);
  const latest = chunk
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  if (latest) job.message = latest;
}

export function getAudioJob(id: string): AudioJob | null {
  const job = jobs.get(id);
  return job ? publicJob(job) : null;
}

export function findRunningAudioJob(slug: string): AudioJob | null {
  const job = [...jobs.values()].find(
    (candidate) => candidate.slug === slug && candidate.status === "running",
  );
  return job ? publicJob(job) : null;
}

export function startAudioJob(
  slug: string,
  selection: AudioSelection,
  place: { name: string; region: string },
): AudioJob {
  const root = process.cwd();
  const script = path.join(root, "scripts", "add-audio.mts");
  const job: InternalAudioJob = {
    id: `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    slug,
    status: "running",
    message: selection.narration
      ? "Preparing narration from the Story map…"
      : "Starting music generation…",
    selection,
    startedAt: new Date().toISOString(),
    output: "",
  };
  jobs.set(job.id, job);

  const childArgs = [
    "--import",
    "tsx",
    script,
    `--slug=${slug}`,
    `--place-name=${place.name}`,
    `--region=${place.region}`,
    "--no-foley",
    "--yes",
  ];
  if (!selection.music) childArgs.push("--no-music");
  if (selection.narration) childArgs.push("--narration");

  const child = spawn(
    process.execPath,
    childArgs,
    {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  child.stdout.on("data", (chunk: Buffer) => appendOutput(job, chunk.toString()));
  child.stderr.on("data", (chunk: Buffer) => appendOutput(job, chunk.toString()));
  child.on("error", (error) => {
    job.status = "failed";
    job.error = error.message;
    job.message = "Could not start the audio process.";
    job.finishedAt = new Date().toISOString();
  });
  child.on("close", (code) => {
    if (job.status === "failed") return;
    if (code !== 0) {
      job.status = "failed";
      job.error =
        job.output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .at(-1) ?? `Audio process exited with code ${code ?? "unknown"}.`;
      job.message = "Audio generation failed.";
      job.finishedAt = new Date().toISOString();
      return;
    }

    try {
      const finalFile = path.join(root, "final", `${slug}.mp4`);
      if (!existsSync(finalFile)) throw new Error("The scored film was not created.");
      const publicDir = path.join(root, "public", "films");
      mkdirSync(publicDir, { recursive: true });
      copyFileSync(finalFile, path.join(publicDir, `${slug}.mp4`));
      const provenanceFile = path.join(
        root,
        "data",
        "scenes",
        "generated",
        slug,
        "audio-provenance.json",
      );
      if (existsSync(provenanceFile)) {
        const provenance = JSON.parse(
          // This file contains prompts and request ids, never credentials.
          readFileSync(provenanceFile, "utf8"),
        ) as { narration?: { text?: string } | null };
        job.narrationText = provenance.narration?.text;
      }
      job.status = "done";
      job.message = selection.narration
        ? selection.music
          ? "Background music and narration are ready."
          : "Narration is ready."
        : "Background music is ready.";
      job.filmUrl = `/films/${slug}.mp4?v=${Date.now()}`;
      job.finishedAt = new Date().toISOString();
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      job.message = "Audio was generated but the film could not be published.";
      job.finishedAt = new Date().toISOString();
    }
  });

  return publicJob(job);
}
