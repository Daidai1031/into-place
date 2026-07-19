"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Place } from "@/lib/types";
import { assetThumb, cutoutUrl } from "@/lib/types";
import type { StoryPreset } from "@/lib/presets";
import { useProject } from "@/lib/hooks/useProject";
import type {
  BeatFrame,
  BeatLayout,
  BeatMode,
  LayoutItem,
  TransitionNote,
} from "@/lib/local-store";
import { fallbackLayout, type LayoutAssetInput } from "@/lib/layout-fallback";
import { buildContactSheet } from "@/lib/contact-sheet";
import { CollageCanvas } from "./CollageCanvas";
import { BrushOverlay } from "./BrushOverlay";
import { CanvasToolbar } from "./CanvasToolbar";
import { AssetShelf } from "./AssetShelf";
import { BeatStrip } from "./BeatStrip";
import { CollageButton } from "@/components/ui/CollageButton";

const MAX_PIECES = 7;
const MIN_PIECES = 1;
const MAX_REFERENCE_IMAGES = 7;
const SOFT_ATTEMPT_WARN = 3; // gentle nudge; hard cap is reserved for paid video

const T2I_OPTIONS = [
  { key: "nano-banana-2", label: "nano-banana 2" },
  { key: "flux-2-pro", label: "FLUX.2 pro" },
  { key: "seedream-4", label: "Seedream 4.0" },
  { key: "imagen-4", label: "Imagen 4" },
];

type LayoutPhase = "idle" | "sheet" | "generating" | "done";

interface AssetBriefLite {
  id: string;
  title: string;
  era: string;
  type: string;
}

export function StoryboardView({ place, preset }: { place: Place; preset?: StoryPreset | null }) {
  const { project, update, hydrated } = useProject(place.slug);
  const beats = project.story?.beats ?? [];
  const [currentId, setCurrentId] = useState<string | null>(null);

  const beat = beats.find((b) => b.id === currentId) ?? beats[0] ?? null;
  const mode: BeatMode = beat ? (project.beatMode[beat.id] ?? "generated") : "generated";

  useEffect(() => {
    if (!currentId && beats.length > 0) setCurrentId(beats[0].id);
  }, [beats, currentId]);

  // Everything curated (not rejected, approved uploads) that has real pixels.
  const shelfAssets: LayoutAssetInput[] = useMemo(() => {
    const seeds = place.assets
      .filter((a) => (project.selections[a.id] ?? a.status) !== "rejected")
      .map((a) => {
        const preferredCutout = a.cutouts?.find((cutout) => cutout.role === "cutout");
        const url = preferredCutout ? cutoutUrl(preferredCutout.file) : assetThumb(a);
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

  // id → title/era/type, for compiling reference lines into the prompt.
  const briefById = useMemo(() => {
    const m = new Map<string, AssetBriefLite>();
    for (const a of place.assets) m.set(a.id, { id: a.id, title: a.title, era: a.era, type: a.type });
    for (const u of project.uploads)
      m.set(u.id, { id: u.id, title: u.title, era: u.era || "today", type: "user_upload" });
    return m;
  }, [place.assets, project.uploads]);

  const mustUseIds = useMemo(
    () => shelfAssets.filter((a) => project.selections[a.id] === "must_use").map((a) => a.id),
    [shelfAssets, project.selections],
  );

  // Per-beat reference set from the preset (intersected with available pieces).
  const presetRefsById = useMemo(
    () => new Map((preset?.beats ?? []).map((b) => [b.id, b.references ?? []])),
    [preset],
  );
  function defaultRefsFor(beatId: string): string[] {
    const shelfIds = new Set(shelfAssets.map((a) => a.id));
    const fromPreset = (presetRefsById.get(beatId) ?? []).filter((id) => shelfIds.has(id));
    if (fromPreset.length) return fromPreset.slice(0, MAX_REFERENCE_IMAGES);
    return (mustUseIds.length ? mustUseIds : shelfAssets.map((a) => a.id)).slice(
      0,
      MAX_REFERENCE_IMAGES,
    );
  }

  // Count scenes, not copies within a scene. A source may support at most two
  // different beats across generated frames and manual collages.
  const sourceSceneUseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const storyBeat of beats) {
      const storyBeatMode = project.beatMode[storyBeat.id] ?? "generated";
      const ids =
        storyBeatMode === "collage"
          ? (project.layouts[storyBeat.id]?.items ?? []).map((item) => item.assetId)
          : (project.frames[storyBeat.id]?.references ?? presetRefsById.get(storyBeat.id) ?? []);
      for (const id of new Set(ids)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [beats, project.beatMode, project.frames, project.layouts, presetRefsById]);

  function setBeatMode(beatId: string, next: BeatMode) {
    update((p) => ({ ...p, beatMode: { ...p.beatMode, [beatId]: next } }));
  }

  function beatReady(beatId: string): boolean {
    const m = project.beatMode[beatId] ?? "generated";
    if (m === "generated") return Boolean(project.frames[beatId]?.imageUrl);
    return (project.layouts[beatId]?.items.length ?? 0) > 0;
  }

  if (!hydrated) return null;

  if (beats.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="font-hand text-xl text-ink-soft">The storyboard needs a story first.</p>
        <Link
          href={`/p/${place.slug}/story`}
          className="mt-4 inline-block bg-ink px-4 py-2 font-typewriter text-sm text-paper hover:bg-ink-soft"
        >
          ← Write the story
        </Link>
      </main>
    );
  }

  const laidOut = new Set(beats.filter((b) => beatReady(b.id)).map((b) => b.id));
  const allReady = laidOut.size >= beats.length;

  return (
    <main className="mx-auto max-w-7xl px-6 pb-16 pt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">Direct the storyboard</h2>
        <Link
          href={`/p/${place.slug}/film`}
          className={`px-4 py-2 font-typewriter text-sm tracking-wide shadow-[2px_2px_0_rgb(43_38_32/0.25)] ${
            allReady
              ? "bg-ink text-paper hover:bg-ink-soft"
              : "pointer-events-none bg-paper-deep text-ink-soft opacity-50"
          }`}
          aria-disabled={!allReady}
        >
          Continue to Film →
        </Link>
      </div>

      <BeatStrip
        beats={beats}
        currentId={beat!.id}
        laidOut={laidOut}
        transitions={project.transitions}
        onSelect={(id) => setCurrentId(id)}
        onSaveTransition={(key, note: TransitionNote) =>
          update((p) => ({ ...p, transitions: { ...p.transitions, [key]: note } }))
        }
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="border-l-4 border-stamp/50 bg-paper-deep/30 px-3 py-1.5 font-display text-sm">
          {beat!.text}
        </p>
        <div className="flex overflow-hidden rounded-sm border border-ink/20 font-typewriter text-xs">
          {(["generated", "collage"] as BeatMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setBeatMode(beat!.id, m)}
              className={`cursor-pointer px-3 py-1.5 ${
                mode === m ? "bg-ink text-paper" : "bg-paper text-ink-soft hover:bg-paper-deep/50"
              }`}
            >
              {m === "generated" ? "Generated frame" : "Manual collage"}
            </button>
          ))}
        </div>
      </div>

      {mode === "generated" ? (
        <GeneratedFrameEditor
          key={beat!.id}
          place={place}
          beat={beat!}
          filmPremise={project.story?.directions.find((d) => d.id === project.story?.chosenDirectionId)?.premise}
          shelfAssets={shelfAssets}
          briefById={briefById}
          defaultRefIds={defaultRefsFor(beat!.id)}
          sourceSceneUseCounts={sourceSceneUseCounts}
          frame={project.frames[beat!.id] ?? null}
          onFrame={(f) => update((p) => ({ ...p, frames: { ...p.frames, [beat!.id]: f } }))}
        />
      ) : (
        <CollageEditor
          place={place}
          beat={beat!}
          shelfAssets={shelfAssets}
          sourceSceneUseCounts={sourceSceneUseCounts}
          layout={project.layouts[beat!.id] ?? null}
          onLayout={(next) => update((p) => ({ ...p, layouts: { ...p.layouts, [beat!.id]: next } }))}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Generated-frame editor (primary path)                               */
/* ------------------------------------------------------------------ */

function GeneratedFrameEditor({
  place,
  beat,
  filmPremise,
  shelfAssets,
  briefById,
  defaultRefIds,
  sourceSceneUseCounts,
  frame,
  onFrame,
}: {
  place: Place;
  beat: { id: string; act: string; text: string };
  filmPremise?: string;
  shelfAssets: LayoutAssetInput[];
  briefById: Map<string, AssetBriefLite>;
  defaultRefIds: string[];
  sourceSceneUseCounts: Map<string, number>;
  frame: BeatFrame | null;
  onFrame: (f: BeatFrame) => void;
}) {
  const [model, setModel] = useState<string>(frame?.model ?? "nano-banana-2");
  const [refIds, setRefIds] = useState<string[]>(
    (frame?.references ?? defaultRefIds).slice(0, MAX_REFERENCE_IMAGES),
  );
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState<null | string>(null);
  const [dragOver, setDragOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const attempts = frame?.attempts ?? 0;
  const hasRealFrame = frame?.source === "generated";

  const shelfById = useMemo(() => new Map(shelfAssets.map((a) => [a.id, a])), [shelfAssets]);

  const post = useCallback(
    async (
      payload: Record<string, unknown>,
      edits: BeatFrame["edits"],
      usedRefIds: string[] = refIds,
    ) => {
      const res = await fetch("/api/storyboard/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        imageUrl: string;
        model: string;
        prompt: string;
        requestId: string | null;
        costUsd: number | null;
        source: BeatFrame["source"];
        error?: string;
      };
      onFrame({
        imageUrl: data.imageUrl,
        model: data.model,
        prompt: data.prompt,
        references: usedRefIds.slice(0, MAX_REFERENCE_IMAGES),
        edits,
        requestId: data.requestId,
        costUsd: data.costUsd,
        source: data.source,
        attempts: attempts + 1,
      });
      setNote(
        data.source === "placeholder"
          ? data.error
            ? "Generation unavailable — showing a labeled placeholder."
            : "Simulated environment — showing a labeled placeholder frame."
          : null,
      );
    },
    [attempts, onFrame, refIds],
  );

  const references = useMemo(
    () => refIds.map((id) => briefById.get(id)).filter((b): b is AssetBriefLite => Boolean(b)),
    [refIds, briefById],
  );

  async function generate(ids: string[]) {
    setBusy("Composing frame…");
    setNote(null);
    try {
      const cappedIds = ids.slice(0, MAX_REFERENCE_IMAGES);
      setRefIds(cappedIds);
      const chosen = cappedIds
        .map((id) => shelfById.get(id))
        .filter((a): a is LayoutAssetInput => Boolean(a));
      const chosenReferences = cappedIds
        .map((id) => briefById.get(id))
        .filter((b): b is AssetBriefLite => Boolean(b));
      let sheet: string | undefined;
      if (chosen.length) {
        await Promise.all(chosen.map(measure));
        sheet = await buildContactSheet(chosen);
      }
      await post(
        {
          mode: "generate",
          place: { name: place.name, region: place.region, tagline: place.tagline },
          beat,
          references: chosenReferences,
          filmPremise,
          model,
          referenceSheetDataUrl: sheet,
        },
        frame?.edits ?? [],
        cappedIds,
      );
    } finally {
      setBusy(null);
    }
  }

  async function addAsset(assetId: string, dropHint: { x: number; y: number }) {
    const asset = shelfById.get(assetId);
    if (!asset) return;
    if (!refIds.includes(assetId) && (sourceSceneUseCounts.get(assetId) ?? 0) >= 2) {
      setNote("This archive piece already appears in two scenes. Choose a different piece.");
      return;
    }
    const nextRefs = refIds.includes(assetId)
      ? refIds
      : [...refIds, assetId].slice(-MAX_REFERENCE_IMAGES);
    setRefIds(nextRefs);
    const brief = briefById.get(assetId);
    const edits = [...(frame?.edits ?? []), { kind: "add_asset" as const, assetId, at: new Date().toISOString() }];

    if (!hasRealFrame) {
      // No real base frame yet — fold the piece into the reference set + regenerate.
      await generate(nextRefs);
      return;
    }
    setBusy("Placing piece…");
    setNote(null);
    try {
      const addAssetDataUrl = await toDataUrl(asset.cutout);
      await post(
        {
          mode: "edit_add_asset",
          place: { name: place.name, region: place.region, tagline: place.tagline },
          beat,
          references: nextRefs
            .map((id) => briefById.get(id))
            .filter((b): b is AssetBriefLite => Boolean(b)),
          model,
          currentImageUrl: frame!.imageUrl,
          addAssetDataUrl,
          addAssetTitle: brief?.title ?? assetId,
          dropHint,
        },
        edits,
        nextRefs,
      );
    } finally {
      setBusy(null);
    }
  }

  async function applyPromptEdit() {
    const instruction = editText.trim();
    if (!instruction || !hasRealFrame) return;
    setBusy("Applying edit…");
    setNote(null);
    try {
      await post(
        {
          mode: "edit_prompt",
          place: { name: place.name, region: place.region, tagline: place.tagline },
          beat,
          references,
          model,
          currentImageUrl: frame!.imageUrl,
          instruction,
        },
        [...(frame?.edits ?? []), { kind: "prompt" as const, instruction, at: new Date().toISOString() }],
      );
      setEditText("");
    } finally {
      setBusy(null);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const assetId = e.dataTransfer.getData("text/plain");
    if (!assetId || busy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01((e.clientY - rect.top) / rect.height);
    void addAsset(assetId, { x, y });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative aspect-video w-full overflow-hidden border bg-paper-deep/40 ${
            dragOver ? "border-stamp ring-2 ring-stamp/40" : "border-ink/20"
          }`}
        >
          {frame?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frame.imageUrl} alt={`Generated frame — ${beat.act}`} className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
              <p className="font-hand text-xl text-ink-soft/70">
                Generate a storyboard frame for this beat, then drag pieces onto it or describe changes.
              </p>
            </div>
          )}
          {frame?.imageUrl && (
            <span className="absolute left-2 top-2 bg-stamp/90 px-2 py-0.5 font-typewriter text-[10px] uppercase tracking-wider text-paper">
              AI-generated {frame.source === "placeholder" ? "· simulated" : ""}
            </span>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-paper/70">
              <p className="font-typewriter text-sm text-ink">{busy}</p>
            </div>
          )}
          {dragOver && !busy && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stamp/10">
              <p className="font-hand text-lg text-stamp">drop to add this piece</p>
            </div>
          )}
        </div>

        {/* Prompt edit */}
        <div className="mt-2 flex gap-2">
          <input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPromptEdit()}
            placeholder={hasRealFrame ? "Describe a change (e.g. 'move the lighthouse to the left, darker sky')" : "Generate a frame first, then edit it in words"}
            disabled={!hasRealFrame || Boolean(busy)}
            className="flex-1 border border-ink/20 bg-paper px-3 py-2 font-display text-sm outline-none focus:border-stamp/60 disabled:opacity-50"
          />
          <button
            onClick={() => void applyPromptEdit()}
            disabled={!hasRealFrame || !editText.trim() || Boolean(busy)}
            className="cursor-pointer border border-ink/30 bg-paper px-3 py-2 font-typewriter text-xs hover:bg-paper-deep/50 disabled:opacity-40"
          >
            Apply edit
          </button>
        </div>
        <p className="mt-1.5 font-typewriter text-[10px] leading-relaxed text-ink-soft">
          Every frame is AI-generated and labeled as such. Archive pieces are used as visual
          references and keep their own source & license in the Journey Book.
        </p>
        {note && <p className="mt-1 font-typewriter text-[11px] text-stamp">{note}</p>}
        {attempts >= SOFT_ATTEMPT_WARN && (
          <p className="mt-1 font-typewriter text-[11px] text-ink-soft">
            {attempts} tries on this frame — if it keeps missing, try changing the pieces or the beat text.
          </p>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <div>
          <label className="font-typewriter text-[10px] uppercase tracking-wider text-ink-soft">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 w-full border border-ink/20 bg-paper px-2 py-1.5 font-typewriter text-xs"
          >
            {T2I_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <CollageButton onClick={() => void generate(refIds)} disabled={Boolean(busy)} className="mt-2 w-full">
            {busy ? busy : frame?.imageUrl ? "Re-generate frame" : "✨ Generate frame"}
          </CollageButton>
        </div>

        <div>
          <p className="font-typewriter text-xs uppercase tracking-wider text-ink-soft">
            Archive pieces{" "}
            <span className="normal-case tracking-normal">· drag onto the frame</span>
          </p>
          <div className="mt-2 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1">
            {shelfAssets.map((asset) => {
              const inRefs = refIds.includes(asset.id);
              return (
                <div
                  key={asset.id}
                  draggable={!busy}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", asset.id)}
                  title={inRefs ? "In the reference set — drag to place on the frame" : "Drag onto the frame"}
                  className={`group relative flex h-16 cursor-grab items-center justify-center border bg-paper-deep/30 p-1 active:cursor-grabbing ${
                    inRefs ? "border-accent/60" : "border-ink/15 hover:border-stamp/60"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.cutout} alt={asset.id} className="max-h-full max-w-full object-contain" loading="lazy" />
                  {inRefs && (
                    <span className="absolute right-0.5 top-0.5 font-typewriter text-[10px] text-accent">ref</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-1 font-typewriter text-[10px] text-ink-soft">
            Pieces marked “ref” are fed to the model on the next generate. Each frame keeps at
            most {MAX_REFERENCE_IMAGES}; dragging a new piece replaces the oldest reference.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Manual collage editor (fallback path — unchanged behavior)          */
/* ------------------------------------------------------------------ */

function CollageEditor({
  place,
  beat,
  shelfAssets,
  sourceSceneUseCounts,
  layout,
  onLayout,
}: {
  place: Place;
  beat: { id: string; text: string };
  shelfAssets: LayoutAssetInput[];
  sourceSceneUseCounts: Map<string, number>;
  layout: BeatLayout | null;
  onLayout: (next: BeatLayout) => void;
}) {
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "brush">("select");
  const [brushColor, setBrushColor] = useState("#a5432c");
  const [brushSize, setBrushSize] = useState(6);
  const [phase, setPhase] = useState<LayoutPhase>("idle");
  const [layoutSource, setLayoutSource] = useState<string | null>(null);
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [showRef, setShowRef] = useState(false);
  const history = useRef<BeatLayout[]>([]);
  const [, forceRender] = useState(0);

  // Old saved layouts may predate the current source-image limit; never render
  // or resubmit more than seven pieces.
  const items = (layout?.items ?? []).slice(0, MAX_PIECES);

  function setLayout(next: BeatLayout, recordHistory = true) {
    if (recordHistory) {
      const prev = layout ?? { items: [], brushDataUrl: null };
      history.current.push(JSON.parse(JSON.stringify(prev)) as BeatLayout);
      if (history.current.length > 30) history.current.shift();
      forceRender((v) => v + 1);
    }
    onLayout(next);
  }

  function undo() {
    const prev = history.current.pop();
    if (!prev) return;
    onLayout(prev);
    forceRender((v) => v + 1);
  }

  async function generateLayout() {
    const chosen =
      items.length >= MIN_PIECES
        ? shelfAssets.filter((a) => items.some((i) => i.assetId === a.id))
        : shelfAssets
            .filter((asset) => (sourceSceneUseCounts.get(asset.id) ?? 0) < 2)
            .slice(0, MAX_PIECES);
    if (chosen.length < MIN_PIECES) return;
    setPhase("sheet");
    setLayoutSource(null);
    try {
      await Promise.all(chosen.map(measure));
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
      const restored = data.layout.map((it) => ({
        ...it,
        cutout: it.cutout || chosen.find((a) => a.id === it.assetId)?.cutout || it.cutout,
      }));
      setLayout({ items: restored, brushDataUrl: layout?.brushDataUrl ?? null });
      setLayoutSource(data.source);
      setRefUrl(data.referenceUrl);
    } catch {
      setLayout({ items: fallbackLayout(chosen), brushDataUrl: layout?.brushDataUrl ?? null });
      setLayoutSource("fallback");
    } finally {
      setPhase("done");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div>
        <CollageCanvas
          items={items}
          selectedId={selectedAsset}
          interactive={tool === "select"}
          onSelect={setSelectedAsset}
          onCommit={(next) => setLayout({ ...(layout ?? { brushDataUrl: null }), items: next })}
        >
          <BrushOverlay
            active={tool === "brush"}
            color={brushColor}
            size={brushSize}
            dataUrl={layout?.brushDataUrl ?? null}
            onChange={(url) => setLayout({ items, brushDataUrl: url }, true)}
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
            canUndo={history.current.length > 0}
            onUndo={undo}
            hasSelection={selectedAsset !== null}
            onLayerOrder={(dir) => {
              if (!selectedAsset) return;
              const sorted = [...items].sort((a, b) => a.z - b.z);
              const idx = sorted.findIndex((i) => i.assetId === selectedAsset);
              const swap = idx + dir;
              if (swap < 0 || swap >= sorted.length) return;
              [sorted[idx].z, sorted[swap].z] = [sorted[swap].z, sorted[idx].z];
              setLayout({ ...(layout ?? { brushDataUrl: null }), items: sorted });
            }}
            onRemove={() => {
              if (!selectedAsset) return;
              setLayout({
                ...(layout ?? { brushDataUrl: null }),
                items: items.filter((i) => i.assetId !== selectedAsset),
              });
              setSelectedAsset(null);
            }}
            onClearBrush={() => setLayout({ items, brushDataUrl: null })}
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
            Fallback path: the AI draft is reference only — the canvas always shows the real archive
            pixels, untouched.
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
          disabledIds={new Set(
            shelfAssets
              .filter(
                (asset) =>
                  !items.some((item) => item.assetId === asset.id) &&
                  (sourceSceneUseCounts.get(asset.id) ?? 0) >= 2,
              )
              .map((asset) => asset.id),
          )}
          max={MAX_PIECES}
          onAdd={(asset) => {
            const nextZ = items.length ? Math.max(...items.map((i) => i.z)) + 1 : 0;
            setLayout({
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
  );
}

/* ------------------------------------------------------------------ */

function measure(a: LayoutAssetInput): Promise<void> {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      a.width = img.naturalWidth;
      a.height = img.naturalHeight;
      resolve();
    };
    img.onerror = () => resolve();
    img.src = a.cutout;
  });
}

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
