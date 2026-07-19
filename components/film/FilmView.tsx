"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Place } from "@/lib/types";
import { useProject } from "@/lib/hooks/useProject";
import { useFilms } from "@/lib/hooks/useFilms";
import { CollageButton } from "@/components/ui/CollageButton";
import { Stamp } from "@/components/ui/Stamp";
import { JourneyBook } from "./JourneyBook";

interface GenStep {
  label: string;
  ms: number;
}

type Phase = "idle" | "running" | "done" | "failed";

export function FilmView({ place }: { place: Place }) {
  const { project, hydrated } = useProject(place.slug);
  const { films, update: updateFilms, hydrated: filmsHydrated } = useFilms();
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<GenStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState<string>("simulated");
  const [filmUrl, setFilmUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const beats = project.story?.beats ?? [];
  const laidOutCount = beats.filter((b) => (project.layouts[b.id]?.items.length ?? 0) > 0).length;
  const ready = beats.length >= 5 && laidOutCount === beats.length;

  async function generate() {
    setPhase("running");
    setError(null);
    setStepIndex(0);
    try {
      // Mirror browser state for the local pipeline, then start.
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
      setSteps(data.steps);
      setMode(data.mode);
      let acc = 0;
      (data.steps as GenStep[]).forEach((step, i) => {
        acc += step.ms;
        timers.current.push(
          setTimeout(() => setStepIndex(i + 1), acc),
        );
      });
      timers.current.push(
        setTimeout(() => {
          setFilmUrl(data.filmUrl);
          setPhase("done");
        }, acc + 400),
      );
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

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl">The film</h2>
          <p className="mt-1 font-typewriter text-sm text-ink-soft">
            {beats.length} scenes · {laidOutCount} collaged ·{" "}
            {mode === "local" ? "live pipeline" : "simulation mode"}
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
              : `${beats.length - laidOutCount} scene${beats.length - laidOutCount > 1 ? "s" : ""} still need a collage.`}
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
          <p className="max-w-md text-center font-hand text-xl text-ink-soft">
            Every scene is collaged from sourced archive pixels. Ready when you
            are.
          </p>
          <CollageButton onClick={() => void generate()} className="px-8 py-3 text-base">
            🎬 Generate the film
          </CollageButton>
        </div>
      )}

      {phase === "running" && (
        <div className="mx-auto mt-12 max-w-md">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-3 py-2">
              <span
                className={`font-typewriter text-sm ${
                  i < stepIndex
                    ? "text-accent"
                    : i === stepIndex
                      ? "text-ink"
                      : "text-ink-soft/40"
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
                  No rendered film yet — scene definitions were written for the
                  render pipeline. Run it locally, then refresh.
                </p>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="font-typewriter text-[11px] text-ink-soft">
              {mode === "local"
                ? "Scene definitions written to data/scenes/generated/ — deterministic render, archive pixels untouched."
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
