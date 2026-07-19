"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Place } from "@/lib/types";
import type { StoryPreset } from "@/lib/presets";
import { useProject } from "@/lib/hooks/useProject";
import type { StoryBeat, TransitionNote } from "@/lib/local-store";
import { CollageButton } from "@/components/ui/CollageButton";
import { StoryLoadingState } from "./StoryLoadingState";
import { DirectionPicker, type Direction } from "./DirectionPicker";
import { BeatCard } from "./BeatCard";
import { AristotelianArc } from "./AristotelianArc";

const MIN_BEATS = 5;
const MAX_BEATS = 8;

export function StoryView({ place, preset }: { place: Place; preset?: StoryPreset | null }) {
  const { project, update, hydrated } = useProject(place.slug);

  function loadBuiltInStory() {
    if (!preset) return;
    const transitions: Record<string, TransitionNote> = {};
    preset.beats.forEach((b, i) => {
      const next = preset.beats[i + 1];
      if (next && b.transitionType) {
        transitions[`${b.id}->${next.id}`] = { type: b.transitionType, note: b.transition ?? "" };
      }
    });
    update((prev) => ({
      ...prev,
      story: {
        directions: [preset.direction],
        chosenDirectionId: preset.direction.id,
        beats: preset.beats.map((b) => ({ id: b.id, act: b.act, text: b.text })),
      },
      transitions: { ...prev.transitions, ...transitions },
    }));
  }

  // On a fresh project, load the built-in default story once so /story reflects
  // the preset without a manual click. "start over" then still lets you draft.
  const autoSeeded = useRef(false);
  useEffect(() => {
    if (hydrated && preset && !project.story && !autoSeeded.current) {
      autoSeeded.current = true;
      loadBuiltInStory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, preset, project.story]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Curated selection → compact briefs for the LLM (titles/eras only, no pixels).
  const assetBriefs = useMemo(() => {
    const seeds = place.assets
      .filter((a) => (project.selections[a.id] ?? a.status) !== "rejected")
      .map((a) => ({ id: a.id, title: a.title, era: a.era, type: a.type }));
    const uploads = project.uploads
      .filter(
        (u) => u.moderation === "approved" && (project.selections[u.id] ?? "maybe") !== "rejected",
      )
      .map((u) => ({
        id: u.id,
        title: u.title,
        era: u.era,
        type: "photo",
        description: u.description,
        contributor: "user",
      }));
    return [...seeds, ...uploads];
  }, [place.assets, project.selections, project.uploads]);

  const story = project.story;

  async function callApi<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data as T;
  }

  async function draftDirections() {
    setBusy("directions");
    setError(null);
    try {
      const { directions } = await callApi<{ directions: Direction[] }>(
        "/api/story/generate",
        { slug: place.slug, phase: "directions", assets: assetBriefs },
      );
      update((prev) => ({
        ...prev,
        story: { directions, chosenDirectionId: null, beats: [] },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function pickDirection(direction: Direction) {
    setBusy("beats");
    setError(null);
    try {
      const { beats } = await callApi<{ beats: StoryBeat[] }>("/api/story/generate", {
        slug: place.slug,
        phase: "beats",
        assets: assetBriefs,
        direction: { title: direction.title, premise: direction.premise },
      });
      update((prev) => ({
        ...prev,
        story: {
          directions:
            direction.id === "dir_custom"
              ? [...(prev.story?.directions ?? []), direction]
              : (prev.story?.directions ?? []),
          chosenDirectionId: direction.id,
          beats,
        },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function reroll(targetId: string, mode: "reroll" | "insert_after") {
    if (!story) return;
    setBusy(targetId + mode);
    setError(null);
    try {
      const { beat } = await callApi<{ beat: { act: string; text: string } }>(
        "/api/story/reroll",
        { slug: place.slug, assets: assetBriefs, beats: story.beats, targetId, mode },
      );
      update((prev) => {
        if (!prev.story) return prev;
        const beats = [...prev.story.beats];
        const idx = beats.findIndex((b) => b.id === targetId);
        if (idx === -1) return prev;
        if (mode === "reroll") {
          beats[idx] = { ...beats[idx], act: beat.act, text: beat.text };
        } else {
          beats.splice(idx + 1, 0, {
            id: `beat_${Date.now()}`,
            act: beat.act,
            text: beat.text,
          });
        }
        return { ...prev, story: { ...prev.story, beats } };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const chosen = story?.directions.find((d) => d.id === story.chosenDirectionId);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-[0.22em] text-stamp">
            Step 02 / Story
          </p>
          <h1 className="mt-1 text-3xl">Shape the narrative</h1>
          <p className="mt-1 max-w-xl font-typewriter text-xs leading-relaxed text-ink-soft">
            {assetBriefs.length} curated archive items feed the narrative. AI drafts the material;
            you decide its emotional shape.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {preset && (
            <button
              onClick={loadBuiltInStory}
              title={`Load “${preset.direction.title}”`}
              className="cursor-pointer font-hand text-sm text-ink-soft underline decoration-dotted hover:text-stamp"
            >
              load built-in story
            </button>
          )}
          {story && (
            <button
              onClick={() => update((prev) => ({ ...prev, story: null }))}
              className="cursor-pointer font-hand text-sm text-ink-soft underline decoration-dotted hover:text-stamp"
            >
              start over
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 bg-stamp/10 px-3 py-2 font-typewriter text-sm text-stamp">
          {error}
        </p>
      )}

      {!hydrated ? null : !story ? (
        busy === "directions" ? (
          <StoryLoadingState />
        ) : (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <p className="max-w-md font-hand text-xl text-ink-soft">
              The archive is curated. Ask the narrative agent for ways this
              place's story could continue.
            </p>
            <CollageButton onClick={() => void draftDirections()} disabled={assetBriefs.length < 3}>
              Draft story directions
            </CollageButton>
            {preset && (
              <button
                onClick={loadBuiltInStory}
                className="cursor-pointer font-hand text-sm text-ink-soft underline decoration-dotted hover:text-stamp"
              >
                or use the built-in “{preset.direction.title}” story
              </button>
            )}
            {assetBriefs.length < 3 && (
              <p className="font-typewriter text-xs text-stamp">
                Select at least 3 archive items first.
              </p>
            )}
          </div>
        )
      ) : !chosen || story.beats.length === 0 ? (
        busy === "beats" ? (
          <StoryLoadingState label="Writing the beats…" />
        ) : (
          <div className="mt-8">
            <DirectionPicker
              directions={story.directions}
              onPick={(d) => void pickDirection(d)}
              busy={busy !== null}
            />
          </div>
        )
      ) : (
        <section className="mt-10">
          <div className="mb-8 border-l-2 border-stamp bg-paper-deep/25 px-4 py-3">
            <span className="font-typewriter text-[10px] uppercase tracking-widest text-ink-soft">
              Chosen direction
            </span>
            <p className="font-display text-base">
              {chosen.title} — <span className="text-ink-soft">{chosen.premise}</span>
            </p>
          </div>

          <AristotelianArc
            beats={story.beats}
            preset={preset}
            assets={place.assets.filter(
              (asset) => (project.selections[asset.id] ?? asset.status) !== "rejected",
            )}
          />

          <details className="group mx-auto mt-10 max-w-4xl" open>
            <summary className="flex cursor-pointer list-none items-center justify-between border-b border-ink/25 pb-3">
              <div>
                <p className="font-typewriter text-[10px] uppercase tracking-[0.2em] text-stamp">
                  Story workbench
                </p>
                <h2 className="mt-1 text-2xl">Refine the five beats</h2>
              </div>
              <span className="font-hand text-sm text-ink-soft group-open:hidden">open notes +</span>
              <span className="hidden font-hand text-sm text-ink-soft group-open:inline">hide notes &minus;</span>
            </summary>

            <div className="mt-5 flex flex-col gap-4">
              {story.beats.map((beat, i) => (
                <div key={beat.id}>
                  <BeatCard
                    beat={beat}
                    index={i}
                    canDelete={story.beats.length > MIN_BEATS}
                    busy={busy !== null}
                    onEdit={(text) =>
                      update((prev) => ({
                        ...prev,
                        story: prev.story && {
                          ...prev.story,
                          beats: prev.story.beats.map((b) =>
                            b.id === beat.id ? { ...b, text } : b,
                          ),
                        },
                      }))
                    }
                    onReroll={() => void reroll(beat.id, "reroll")}
                    onDelete={() =>
                      update((prev) => ({
                        ...prev,
                        story: prev.story && {
                          ...prev.story,
                          beats: prev.story.beats.filter((b) => b.id !== beat.id),
                        },
                      }))
                    }
                  />
                  {i < story.beats.length - 1 && story.beats.length < MAX_BEATS && (
                    <div className="flex justify-center py-1">
                      <button
                        onClick={() => void reroll(beat.id, "insert_after")}
                        disabled={busy !== null}
                        className="cursor-pointer font-hand text-sm text-ink-soft/60 hover:text-accent disabled:opacity-30"
                        title="Ask AI to add a beat here"
                      >
                        + add a beat here
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-3 text-center font-typewriter text-[11px] text-ink-soft">
              {story.beats.length} of {MAX_BEATS} beats · a story needs {MIN_BEATS}–{MAX_BEATS}
            </p>
          </details>

          <div className="mt-8 flex justify-end">
            <Link
              href={`/p/${place.slug}/storyboard`}
              className="bg-ink px-4 py-2 font-typewriter text-sm tracking-wide text-paper shadow-[2px_2px_0_rgb(43_38_32/0.25)] hover:bg-ink-soft"
            >
              Continue to Storyboard →
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
