"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Place } from "@/lib/types";
import { useProject } from "@/lib/hooks/useProject";
import { useFilms } from "@/lib/hooks/useFilms";
import { I2V_MODELS, I2V_DEFAULT } from "@/lib/models";
import { CollageButton } from "@/components/ui/CollageButton";
import { Stamp } from "@/components/ui/Stamp";
import { JourneyBook } from "./JourneyBook";

interface GenStep {
  label: string;
}
type Phase = "idle" | "running" | "done" | "failed";
type SceneStatus = "waiting" | "queued" | "rendering" | "done" | "failed";
interface SceneState {
  beatId: string;
  act: string;
  status: SceneStatus;
  motionPrompt?: string;
  model?: string;
  costUsd?: number;
  videoUrl?: string;
  error?: string;
}

const SCENE_STATUS_LABEL: Record<SceneStatus, string> = {
  waiting: "queued to start",
  queued: "submitting to the model…",
  rendering: "animating — this takes 1–3 min…",
  done: "ready — preview below",
  failed: "failed",
};
interface Caps {
  isLocal: boolean;
  canRunPipeline: boolean;
  canWriteFs: boolean;
  hasFal: boolean;
}

/** Per-shot durations each model actually accepts (seconds). */
const DUR_OPTIONS: Record<string, number[]> = {
  "kling-v3-turbo-std": [5, 10],
  "happy-horse": [3, 4, 5, 6, 7, 8],
  "veo3.1-hero": [4, 6, 8],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function FilmView({ place }: { place: Place }) {
  const { project, hydrated } = useProject(place.slug);
  const { films, update: updateFilms, hydrated: filmsHydrated } = useFilms();
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<GenStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [scenes, setScenes] = useState<SceneState[]>([]);
  const [assembling, setAssembling] = useState(false);
  const [mode, setMode] = useState<string>("simulated");
  const [filmUrl, setFilmUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState<Caps | null>(null);
  const [filmModel, setFilmModel] = useState<string>(I2V_DEFAULT);
  const [secondsPerShot, setSecondsPerShot] = useState<number>(5);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelled = useRef(false);

  useEffect(() => {
    fetch("/api/capabilities").then((r) => r.json()).then(setCaps).catch(() => {});
    return () => {
      cancelled.current = true;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const beats = project.story?.beats ?? [];
  const beatReady = (id: string) => {
    const m = project.beatMode[id] ?? "generated";
    return m === "generated"
      ? Boolean(project.frames[id]?.imageUrl)
      : (project.layouts[id]?.items.length ?? 0) > 0;
  };
  const readyCount = beats.filter((b) => beatReady(b.id)).length;
  const ready = beats.length >= 5 && readyCount === beats.length;

  // Shots we can actually animate in-app (generated, real frame — not placeholder).
  const renderableShots = useMemo(
    () =>
      beats
        .map((b, i) => ({ beat: b, next: beats[i + 1] ?? null }))
        .filter(
          ({ beat }) =>
            (project.beatMode[beat.id] ?? "generated") === "generated" &&
            project.frames[beat.id]?.imageUrl &&
            project.frames[beat.id]?.source === "generated",
        ),
    [beats, project.beatMode, project.frames],
  );

  const canRunReal = Boolean(caps?.canRunPipeline && caps?.hasFal) && renderableShots.length > 0;
  const unitPrice = I2V_MODELS[filmModel]?.unitPrice ?? 0;
  const estCost = unitPrice * secondsPerShot * renderableShots.length;
  const durOptions = DUR_OPTIONS[filmModel] ?? [5];

  function pickModel(key: string) {
    setFilmModel(key);
    const opts = DUR_OPTIONS[key] ?? [5];
    if (!opts.includes(secondsPerShot)) setSecondsPerShot(opts[0]);
  }

  async function pollShot(endpointId: string, requestId: string): Promise<string> {
    const q = `endpointId=${encodeURIComponent(endpointId)}&requestId=${encodeURIComponent(requestId)}`;
    for (let t = 0; t < 180 && !cancelled.current; t++) {
      const r = await fetch(`/api/shot/status?${q}`);
      const d = await r.json();
      if (d.status === "completed" && d.videoUrl) return d.videoUrl as string;
      if (d.status === "error") throw new Error(d.error ?? "shot failed");
      await sleep(5000);
    }
    throw new Error("shot timed out");
  }

  const patchScene = (i: number, patch: Partial<SceneState>) =>
    setScenes((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  async function runReal() {
    setMode("local");
    setAssembling(false);
    setScenes(
      renderableShots.map((s) => ({ beatId: s.beat.id, act: s.beat.act, status: "waiting" })),
    );
    await fetch("/api/project/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
    }).catch(() => {});

    const clips: { videoUrl: string; transitionType: string | null }[] = [];
    for (let i = 0; i < renderableShots.length; i++) {
      const { beat, next } = renderableShots[i];
      patchScene(i, { status: "queued" });
      const gen = await fetch("/api/shot/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frameUrl: project.frames[beat.id]!.imageUrl,
          beat,
          model: filmModel,
          durationSeconds: secondsPerShot,
          confirmed: true,
        }),
      }).then((r) => r.json());
      if (gen.status !== "queued") {
        const msg = gen.error ?? `scene ${i + 1}: ${gen.status ?? "failed"}`;
        patchScene(i, { status: "failed", error: msg, motionPrompt: gen.motionPrompt });
        throw new Error(msg);
      }
      // Surface exactly what the model was told + which model + cost, live.
      patchScene(i, {
        status: "rendering",
        motionPrompt: gen.motionPrompt,
        model: gen.model,
        costUsd: gen.estimatedCostUsd,
      });
      let videoUrl: string;
      try {
        videoUrl = await pollShot(gen.endpointId, gen.requestId);
      } catch (e) {
        patchScene(i, { status: "failed", error: e instanceof Error ? e.message : "shot failed" });
        throw e;
      }
      // Preview this clip immediately — don't wait for the other scenes.
      patchScene(i, { status: "done", videoUrl });
      const transitionType = next
        ? (project.transitions[`${beat.id}->${next.id}`]?.type ?? null)
        : null;
      clips.push({ videoUrl, transitionType });
    }

    setAssembling(true);
    const asm = await fetch("/api/assemble", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: place.slug, clips }),
    });
    const asmData = await asm.json();
    if (!asm.ok) throw new Error(asmData.error ?? "assembly failed");
    setFilmUrl(asmData.filmUrl);
    setAssembling(false);
    setPhase("done");
  }

  async function runSimulated() {
    await fetch("/api/project/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
    }).catch(() => {});
    const res = await fetch("/api/generate/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Generation failed");
    setSteps((data.steps as { label: string }[]).map((s) => ({ label: s.label })));
    setMode(data.mode);
    let acc = 0;
    (data.steps as { ms: number }[]).forEach((step, i) => {
      acc += step.ms;
      timers.current.push(setTimeout(() => setStepIndex(i + 1), acc));
    });
    timers.current.push(
      setTimeout(() => {
        setFilmUrl(data.filmUrl);
        setPhase("done");
      }, acc + 400),
    );
  }

  async function generate() {
    setPhase("running");
    setError(null);
    setStepIndex(0);
    setScenes([]);
    setAssembling(false);
    cancelled.current = false;
    try {
      if (canRunReal) await runReal();
      else await runSimulated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setPhase("failed");
    }
  }

  function saveToLibrary() {
    if (!filmUrl) return;
    updateFilms((prev) => [
      {
        id: `film_${Date.now()}`,
        placeSlug: place.slug,
        title: `${place.name} — ${project.story?.directions.find((d) => d.id === project.story?.chosenDirectionId)?.title ?? "A place remembers"}`,
        url: filmUrl,
        createdAt: new Date().toISOString(),
        liked: false,
        favorite: false,
      },
      ...prev,
    ]);
    setSaved(true);
  }

  if (!hydrated) return null;

  const totalSeconds = Math.round(
    secondsPerShot * renderableShots.length - 0.7 * Math.max(0, renderableShots.length - 1),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl">The film</h2>
          <p className="mt-1 font-typewriter text-sm text-ink-soft">
            {beats.length} scenes · {readyCount} storyboarded ·{" "}
            {mode === "local" ? "live pipeline" : mode === "local-preview" ? "local preview" : "simulation mode"}
          </p>
        </div>
        {filmsHydrated && films.length > 0 && (
          <Link
            href="/library"
            className="font-hand text-sm text-ink-soft underline decoration-dotted hover:text-stamp"
          >
            your film library →
          </Link>
        )}
      </div>

      {!ready && (
        <div className="mt-12 text-center">
          <p className="font-hand text-xl text-ink-soft">
            {beats.length < 5
              ? "The film needs a story first."
              : `${beats.length - readyCount} scene${beats.length - readyCount > 1 ? "s" : ""} still need an approved frame.`}
          </p>
          <Link
            href={`/p/${place.slug}/${beats.length < 5 ? "story" : "storyboard"}`}
            className="mt-4 inline-block bg-ink px-4 py-2 font-typewriter text-sm text-paper hover:bg-ink-soft"
          >
            ← {beats.length < 5 ? "Write the story" : "Finish the storyboard"}
          </Link>
        </div>
      )}

      {ready && phase === "idle" && (
        <div className="mt-12 flex flex-col items-center gap-4">
          <p className="max-w-lg text-center font-hand text-xl text-ink-soft">
            Each scene becomes its own {secondsPerShot}s image-to-video clip, then they’re
            stitched with transitions into one ~{totalSeconds}s film.
          </p>

          {canRunReal ? (
            <div className="flex flex-wrap items-center justify-center gap-4 border border-ink/15 bg-paper-deep/20 px-4 py-3">
              <label className="flex items-center gap-2 font-typewriter text-xs text-ink-soft">
                Model
                <select
                  value={filmModel}
                  onChange={(e) => pickModel(e.target.value)}
                  className="border border-ink/20 bg-paper px-2 py-1"
                >
                  {Object.keys(I2V_MODELS).map((k) => (
                    <option key={k} value={k}>
                      {I2V_MODELS[k].displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 font-typewriter text-xs text-ink-soft">
                Seconds/scene
                <select
                  value={secondsPerShot}
                  onChange={(e) => setSecondsPerShot(Number(e.target.value))}
                  className="border border-ink/20 bg-paper px-2 py-1"
                >
                  {durOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}s
                    </option>
                  ))}
                </select>
              </label>
              <span className="font-typewriter text-xs text-ink-soft">
                {renderableShots.length} shots · est. ~${estCost.toFixed(2)}
              </span>
            </div>
          ) : (
            <p className="max-w-md text-center font-typewriter text-[11px] text-ink-soft">
              This environment can’t run image-to-video (no local pipeline / FAL key) — it will
              play the pre-rendered demonstration film instead.
            </p>
          )}

          <CollageButton onClick={() => void generate()} className="px-8 py-3 text-base">
            🎬 {canRunReal ? "Generate the film" : "Play the demo film"}
          </CollageButton>
          {canRunReal && (
            <p className="max-w-md text-center font-typewriter text-[11px] text-ink-soft">
              Real generation runs shot-by-shot and can take several minutes — keep this tab open.
            </p>
          )}
        </div>
      )}

      {/* Live per-scene view (real image-to-video run): status, the exact prompt
          each scene is animated with, and an inline preview the moment a clip lands. */}
      {phase === "running" && scenes.length > 0 && (
        <div className="mx-auto mt-12 max-w-2xl">
          <p className="mb-4 text-center font-typewriter text-xs text-ink-soft">
            {scenes.filter((s) => s.status === "done").length} of {scenes.length} scenes rendered
            {assembling ? " · stitching the film…" : ""}
          </p>
          <div className="flex flex-col gap-5">
            {scenes.map((s, i) => {
              const active = s.status === "queued" || s.status === "rendering";
              return (
                <div
                  key={s.beatId}
                  className={`border bg-paper-deep/20 p-3 ${
                    s.status === "done"
                      ? "border-accent/40"
                      : s.status === "failed"
                        ? "border-stamp/50"
                        : active
                          ? "border-ink/40"
                          : "border-ink/12"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-typewriter text-sm text-ink">
                      Scene {i + 1} · {s.act}
                    </span>
                    <span
                      className={`font-typewriter text-[11px] ${
                        s.status === "done"
                          ? "text-accent"
                          : s.status === "failed"
                            ? "text-stamp"
                            : "text-ink-soft"
                      }`}
                    >
                      {s.status === "done" ? "✓ " : s.status === "failed" ? "✕ " : ""}
                      {SCENE_STATUS_LABEL[s.status]}
                      {active && <span className="animate-pulse">…</span>}
                    </span>
                  </div>

                  {(s.model || typeof s.costUsd === "number") && (
                    <p className="mt-1 font-typewriter text-[10px] uppercase tracking-widest text-ink-soft/70">
                      {s.model ? I2V_MODELS[s.model]?.displayName ?? s.model : ""}
                      {typeof s.costUsd === "number" ? ` · ~$${s.costUsd.toFixed(2)}` : ""}
                    </p>
                  )}

                  {s.motionPrompt && (
                    <details className="mt-2" open={active}>
                      <summary className="cursor-pointer font-typewriter text-[11px] text-ink-soft hover:text-stamp">
                        motion prompt
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap border-l-2 border-ink/15 pl-2 font-mono text-[11px] leading-relaxed text-ink-soft">
                        {s.motionPrompt}
                      </p>
                    </details>
                  )}

                  {s.error && (
                    <p className="mt-2 font-typewriter text-[11px] text-stamp">{s.error}</p>
                  )}

                  {s.videoUrl && (
                    <video
                      src={s.videoUrl}
                      controls
                      loop
                      muted
                      className="mt-3 w-full border border-ink/10"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Simulated / demo run keeps the simple linear checklist. */}
      {phase === "running" && scenes.length === 0 && (
        <div className="mx-auto mt-12 max-w-md">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-3 py-2">
              <span
                className={`font-typewriter text-sm ${
                  i < stepIndex ? "text-accent" : i === stepIndex ? "text-ink" : "text-ink-soft/40"
                }`}
              >
                {i < stepIndex ? "✓" : i === stepIndex ? "▸" : "·"} {step.label}
                {i === stepIndex && <span className="animate-pulse">…</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {phase === "failed" && (
        <div className="mt-12 text-center">
          <p className="font-typewriter text-sm text-stamp">{error}</p>
          <CollageButton onClick={() => void generate()} className="mt-3">
            Try again
          </CollageButton>
        </div>
      )}

      {phase === "done" && (
        <div className="mt-8">
          <div className="paper-shadow bg-ink p-2">
            {filmUrl ? (
              <video src={filmUrl} controls autoPlay className="w-full" />
            ) : (
              <div className="flex aspect-video items-center justify-center">
                <p className="max-w-sm text-center font-typewriter text-sm text-paper/80">
                  No rendered film yet.
                </p>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="font-typewriter text-[11px] text-ink-soft">
              {mode === "local"
                ? "Live pipeline: each scene generated by image-to-video from its approved frame, then assembled with FFmpeg."
                : mode === "local-preview"
                  ? "Storyboard state saved locally."
                  : "Simulation mode: playing the pre-rendered demonstration film."}
            </p>
            {filmUrl && !saved && (
              <CollageButton variant="ghost" onClick={saveToLibrary}>
                + Save to library
              </CollageButton>
            )}
            {saved && <Stamp text="In your library" color="accent" animate />}
          </div>

          <div className="mt-8">
            <JourneyBook place={place} project={project} />
          </div>
        </div>
      )}
    </main>
  );
}
