"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Place } from "@/lib/types";
import { assetThumb } from "@/lib/types";
import { useProject } from "@/lib/hooks/useProject";
import type { BeatLayout, LayoutItem, TransitionNote } from "@/lib/local-store";
import { fallbackLayout, type LayoutAssetInput } from "@/lib/layout-fallback";
import { buildContactSheet } from "@/lib/contact-sheet";
import { CollageCanvas } from "./CollageCanvas";
import { BrushOverlay } from "./BrushOverlay";
import { CanvasToolbar } from "./CanvasToolbar";
import { AssetShelf } from "./AssetShelf";
import { BeatStrip } from "./BeatStrip";
import { CollageButton } from "@/components/ui/CollageButton";

const MAX_PIECES = 8;
const MIN_PIECES = 3;

type LayoutPhase = "idle" | "sheet" | "generating" | "done";

export function StoryboardView({ place }: { place: Place }) {
  const { project, update, hydrated } = useProject(place.slug);
  const beats = project.story?.beats ?? [];
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "brush">("select");
  const [brushColor, setBrushColor] = useState("#a5432c");
  const [brushSize, setBrushSize] = useState(6);
  const [phase, setPhase] = useState<LayoutPhase>("idle");
  const [layoutSource, setLayoutSource] = useState<string | null>(null);
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [showRef, setShowRef] = useState(false);
  const history = useRef<Map<string, BeatLayout[]>>(new Map());
  const [, forceRender] = useState(0);

  const beat = beats.find((b) => b.id === currentId) ?? beats[0] ?? null;

  useEffect(() => {
    if (!currentId && beats.length > 0) setCurrentId(beats[0].id);
  }, [beats, currentId]);

  // Everything curated (not rejected, approved uploads) that has real pixels.
  const shelfAssets: LayoutAssetInput[] = useMemo(() => {
    const seeds = place.assets
      .filter((a) => (project.selections[a.id] ?? a.status) !== "rejected")
      .map((a) => {
        const url = assetThumb(a);
        if (!url) return null;
        const roles = a.cutouts?.map((c) => c.role) ?? [];
        const role = roles.includes("bg") ? "bg" : roles.includes("cutout") ? "cutout" : "card";
        return { id: a.id, cutout: url, role, width: 800, height: 600 } as LayoutAssetInput;
      })
      .filter((x): x is LayoutAssetInput => x !== null);
    const uploads = project.uploads
      .filter(
        (u) => u.moderation === "approved" && (project.selections[u.id] ?? "maybe") !== "rejected",
      )
      .map((u) => ({ id: u.id, cutout: u.dataUrl, role: "card" as const, width: 800, height: 600 }));
    return [...seeds, ...uploads];
  }, [place.assets, project.selections, project.uploads]);

  const layout: BeatLayout | null = beat ? (project.layouts[beat.id] ?? null) : null;
  const items = layout?.items ?? [];

  function pushHistory(beatId: string, snapshot: BeatLayout) {
    const stack = history.current.get(beatId) ?? [];
    stack.push(JSON.parse(JSON.stringify(snapshot)) as BeatLayout);
    if (stack.length > 30) stack.shift();
    history.current.set(beatId, stack);
    forceRender((v) => v + 1);
  }

  function setLayout(beatId: string, next: BeatLayout, recordHistory = true) {
    if (recordHistory) {
      const prev = project.layouts[beatId] ?? { items: [], brushDataUrl: null };
      pushHistory(beatId, prev);
    }
    update((p) => ({ ...p, layouts: { ...p.layouts, [beatId]: next } }));
  }

  function undo() {
    if (!beat) return;
    const stack = history.current.get(beat.id);
    const prev = stack?.pop();
    if (!prev) return;
    update((p) => ({ ...p, layouts: { ...p.layouts, [beat.id]: prev } }));
    forceRender((v) => v + 1);
  }

  async function generateLayout() {
    if (!beat) return;
    const chosen = items.length >= MIN_PIECES
      ? shelfAssets.filter((a) => items.some((i) => i.assetId === a.id))
      : shelfAssets.slice(0, 5);
    if (chosen.length < MIN_PIECES) return;
    setPhase("sheet");
    setLayoutSource(null);
    try {
      // Measure real image sizes for correct aspect hints.
      await Promise.all(
        chosen.map(
          (a) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                a.width = img.naturalWidth;
                a.height = img.naturalHeight;
                resolve();
              };
              img.onerror = () => resolve();
              img.src = a.cutout;
            }),
        ),
      );
      const sheet = await buildContactSheet(chosen);
      setPhase("generating");
      const res = await fetch("/api/storyboard/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beatText: beat.text,
          contactSheetDataUrl: sheet,
          assets: chosen.map((a) => ({ ...a, cutout: a.cutout.startsWith("data:") ? "" : a.cutout })),
        }),
      });
      const data = (await res.json()) as {
        layout: LayoutItem[];
        referenceUrl: string | null;
        source: string;
      };
      if (!res.ok) throw new Error("layout request failed");
      // Server echoes empty cutout for dataURL uploads — restore locally.
      const restored = data.layout.map((it) => ({
        ...it,
        cutout: it.cutout || chosen.find((a) => a.id === it.assetId)?.cutout || it.cutout,
      }));
      setLayout(beat.id, { items: restored, brushDataUrl: layout?.brushDataUrl ?? null });
      setLayoutSource(data.source);
      setRefUrl(data.referenceUrl);
    } catch {
      setLayout(beat.id, {
        items: fallbackLayout(chosen),
        brushDataUrl: layout?.brushDataUrl ?? null,
      });
      setLayoutSource("fallback");
    } finally {
      setPhase("done");
    }
  }

  if (!hydrated) return null;

  if (beats.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="font-hand text-xl text-ink-soft">
          The storyboard needs a story first.
        </p>
        <Link
          href={`/p/${place.slug}/story`}
          className="mt-4 inline-block bg-ink px-4 py-2 font-typewriter text-sm text-paper hover:bg-ink-soft"
        >
          ← Write the story
        </Link>
      </main>
    );
  }

  const laidOut = new Set(
    Object.entries(project.layouts)
      .filter(([, l]) => l.items.length > 0)
      .map(([id]) => id),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 pb-16 pt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">Collage the storyboard</h2>
        <Link
          href={`/p/${place.slug}/film`}
          className={`px-4 py-2 font-typewriter text-sm tracking-wide shadow-[2px_2px_0_rgb(43_38_32/0.25)] ${
            laidOut.size >= beats.length
              ? "bg-ink text-paper hover:bg-ink-soft"
              : "pointer-events-none bg-paper-deep text-ink-soft opacity-50"
          }`}
          aria-disabled={laidOut.size < beats.length}
        >
          Continue to Film →
        </Link>
      </div>

      <BeatStrip
        beats={beats}
        currentId={beat!.id}
        laidOut={laidOut}
        transitions={project.transitions}
        onSelect={(id) => {
          setCurrentId(id);
          setSelectedAsset(null);
          setPhase("idle");
          setRefUrl(null);
        }}
        onSaveTransition={(key, note: TransitionNote) =>
          update((p) => ({ ...p, transitions: { ...p.transitions, [key]: note } }))
        }
      />

      <p className="mb-3 border-l-4 border-stamp/50 bg-paper-deep/30 px-3 py-1.5 font-display text-sm">
        {beat!.text}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div>
          <CollageCanvas
            items={items}
            selectedId={selectedAsset}
            interactive={tool === "select"}
            onSelect={setSelectedAsset}
            onCommit={(next) =>
              setLayout(beat!.id, { ...(layout ?? { brushDataUrl: null }), items: next })
            }
          >
            <BrushOverlay
              active={tool === "brush"}
              color={brushColor}
              size={brushSize}
              dataUrl={layout?.brushDataUrl ?? null}
              onChange={(url) =>
                setLayout(beat!.id, { items, brushDataUrl: url }, true)
              }
            />
            {items.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="font-hand text-xl text-ink-soft/60">
                  Ask AI for a first layout, or add pieces from the shelf →
                </p>
              </div>
            )}
          </CollageCanvas>
          <div className="mt-2">
            <CanvasToolbar
              tool={tool}
              onTool={setTool}
              brushColor={brushColor}
              onBrushColor={setBrushColor}
              brushSize={brushSize}
              onBrushSize={setBrushSize}
              canUndo={(history.current.get(beat!.id)?.length ?? 0) > 0}
              onUndo={undo}
              hasSelection={selectedAsset !== null}
              onLayerOrder={(dir) => {
                if (!selectedAsset) return;
                const sorted = [...items].sort((a, b) => a.z - b.z);
                const idx = sorted.findIndex((i) => i.assetId === selectedAsset);
                const swap = idx + dir;
                if (swap < 0 || swap >= sorted.length) return;
                [sorted[idx].z, sorted[swap].z] = [sorted[swap].z, sorted[idx].z];
                setLayout(beat!.id, { ...(layout ?? { brushDataUrl: null }), items: sorted });
              }}
              onRemove={() => {
                if (!selectedAsset) return;
                setLayout(beat!.id, {
                  ...(layout ?? { brushDataUrl: null }),
                  items: items.filter((i) => i.assetId !== selectedAsset),
                });
                setSelectedAsset(null);
              }}
              onClearBrush={() => setLayout(beat!.id, { items, brushDataUrl: null })}
            />
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div>
            <CollageButton
              onClick={() => void generateLayout()}
              disabled={phase === "sheet" || phase === "generating" || shelfAssets.length < MIN_PIECES}
              className="w-full"
            >
              {phase === "sheet"
                ? "Preparing contact sheet…"
                : phase === "generating"
                  ? "Composing draft…"
                  : items.length > 0
                    ? "Re-generate layout"
                    : "✨ Generate first layout"}
            </CollageButton>
            <p className="mt-1.5 font-typewriter text-[10px] leading-relaxed text-ink-soft">
              AI draft is reference only — the canvas always shows the real
              archive pixels, untouched.
            </p>
            {layoutSource === "fallback" && phase === "done" && (
              <p className="mt-1 font-typewriter text-[11px] text-stamp">
                AI unavailable — used the deterministic layout instead.
              </p>
            )}
            {refUrl && (
              <div className="mt-2">
                <button
                  onClick={() => setShowRef((v) => !v)}
                  className="cursor-pointer font-hand text-sm text-ink-soft underline decoration-dotted"
                >
                  {showRef ? "hide" : "show"} AI reference draft
                </button>
                {showRef && (
                  <div className="mt-1 border-2 border-dashed border-stamp/50 p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={refUrl} alt="AI reference draft" className="w-full" />
                    <p className="bg-stamp/10 px-1 py-0.5 font-typewriter text-[10px] uppercase tracking-wider text-stamp">
                      AI-generated reference — not archive, not the output
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <AssetShelf
            assets={shelfAssets}
            usedIds={new Set(items.map((i) => i.assetId))}
            max={MAX_PIECES}
            onAdd={(asset) => {
              const nextZ = items.length ? Math.max(...items.map((i) => i.z)) + 1 : 0;
              setLayout(beat!.id, {
                ...(layout ?? { brushDataUrl: null }),
                items: [
                  ...items,
                  {
                    assetId: asset.id,
                    cutout: asset.cutout,
                    x: 0.5,
                    y: 0.5,
                    scale: asset.role === "bg" ? 3 : 1,
                    rotation: 0,
                    z: nextZ,
                  },
                ],
              });
            }}
          />
          {items.length > 0 && items.length < MIN_PIECES && (
            <p className="font-typewriter text-[11px] text-stamp">
              A collage needs at least {MIN_PIECES} pieces.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
