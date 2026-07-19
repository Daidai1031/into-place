"use client";

import { useEffect, useRef, useState } from "react";
import type { Place, PlaceAsset, Tone, Edge, AssetStatus } from "@/lib/types";
import type { StoryPreset } from "@/lib/presets";
import { assetThumb } from "@/lib/types";
import { bucketByEra } from "@/lib/era";
import { useProject } from "@/lib/hooks/useProject";
import type { ModerationStage, UserUpload } from "@/lib/local-store";
import { FoundCounter } from "./FoundCounter";
import { TimelineRail, TimelineEraColumn } from "./TimelineRail";
import { AssetCard } from "./AssetCard";
import { AudioSlotCard } from "./AudioSlotCard";
import { UploadModal } from "./UploadModal";
import { UploadCard } from "./UploadCard";
import { SelectionControls } from "./SelectionControls";
import { SelectionTray } from "./SelectionTray";
import { PreprocessTuner, TONE_FILTER } from "./PreprocessTuner";
import { PaperCard } from "@/components/ui/PaperCard";

const NEXT_STAGE: Partial<Record<ModerationStage, { next: ModerationStage; after: number }>> = {
  uploading: { next: "pending", after: 900 },
  pending: { next: "checking", after: 2000 },
  checking: { next: "approved", after: 2200 },
};

function assetDefaults(asset: PlaceAsset): { tone: Tone; edge: Edge } {
  const first = asset.cutouts?.[0];
  return { tone: first?.tone ?? "mono", edge: first?.edge ?? "torn" };
}

export function ArchiveView({ place, preset }: { place: Place; preset?: StoryPreset | null }) {
  const { project, update, hydrated } = useProject(place.slug);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [tunerTarget, setTunerTarget] = useState<
    | { kind: "asset"; asset: PlaceAsset }
    | { kind: "upload"; upload: UserUpload }
    | null
  >(null);

  // Simulated moderation: advance every non-approved upload through the
  // review stages, persisting each transition so a reload never regresses.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const upload of project.uploads) {
      const step = NEXT_STAGE[upload.moderation];
      if (!step) continue;
      timers.push(
        setTimeout(() => {
          update((prev) => ({
            ...prev,
            uploads: prev.uploads.map((u) =>
              u.id === upload.id && u.moderation === upload.moderation
                ? { ...u, moderation: step.next }
                : u,
            ),
          }));
        }, step.after),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [project.uploads, update]);

  const statusOf = (id: string, fallback: AssetStatus): AssetStatus =>
    project.selections[id] ?? fallback;

  const setStatus = (id: string, status: AssetStatus) =>
    update((prev) => ({ ...prev, selections: { ...prev.selections, [id]: status } }));

  const saveTuning = (id: string, tuning: { tone: Tone; edge: Edge }) => {
    update((prev) => ({ ...prev, tuning: { ...prev.tuning, [id]: tuning } }));
    // Local mirror for the pipeline; a no-op echo on Vercel.
    void fetch("/api/preprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: place.slug, assetId: id, ...tuning }),
    }).catch(() => {});
  };

  // Demo convenience: on a fresh project, pre-curate the archive to match the
  // built-in default story. Every asset the preset's beats reference becomes
  // "must use"; the rest of the usable (non reference-only, non-rejected)
  // archive becomes "maybe", so Archive → Story → Storyboard opens already
  // selected and the storyboard shelf highlights the must-use set. Runs once,
  // and only while the user has made no selections of their own — so it never
  // clobbers real curation.
  const autoSeeded = useRef(false);
  useEffect(() => {
    if (!hydrated || !preset || autoSeeded.current) return;
    if (Object.keys(project.selections).length > 0) return;
    autoSeeded.current = true;
    const referenced = new Set(preset.beats.flatMap((b) => b.references ?? []));
    const seeded: Record<string, AssetStatus> = {};
    for (const a of place.assets) {
      if (a.reference_only || a.status === "rejected") continue;
      seeded[a.id] = referenced.has(a.id) ? "must_use" : "maybe";
    }
    if (Object.keys(seeded).length === 0) return;
    update((prev) => ({ ...prev, selections: { ...seeded, ...prev.selections } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, preset, project.selections]);

  const buckets = bucketByEra(place.assets, (a) => a.era);
  const approvedUploads = project.uploads.filter((u) => u.moderation === "approved");
  const mustUse =
    place.assets.filter((a) => !a.reference_only && statusOf(a.id, a.status) === "must_use").length +
    approvedUploads.filter((u) => statusOf(u.id, "maybe") === "must_use").length;
  const maybe =
    place.assets.filter((a) => !a.reference_only && statusOf(a.id, a.status) === "maybe").length +
    approvedUploads.filter((u) => statusOf(u.id, "maybe") === "maybe").length;

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl">The archive of {place.name}</h2>
          <p className="mt-1 max-w-2xl font-typewriter text-sm text-ink-soft">
            {place.tagline}
          </p>
        </div>
        <FoundCounter assets={place.assets} uploads={approvedUploads.length} />
      </div>

      <TimelineRail>
        {buckets.map((bucket) => (
          <TimelineEraColumn key={bucket.bucket} label={bucket.bucket}>
            {bucket.items.map((asset, i) => {
              const tuning = project.tuning[asset.id];
              const toneFilter = tuning?.tone ? TONE_FILTER[tuning.tone] : undefined;
              return (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  index={i}
                  thumbStyle={toneFilter && toneFilter !== "none" ? { filter: toneFilter } : undefined}
                  footer={
                    hydrated && !asset.reference_only ? (
                      <SelectionControls
                        status={statusOf(asset.id, asset.status)}
                        onChange={(s) => setStatus(asset.id, s)}
                        onTune={
                          assetThumb(asset)
                            ? () => setTunerTarget({ kind: "asset", asset })
                            : undefined
                        }
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </TimelineEraColumn>
        ))}
        <TimelineEraColumn label="Today" accent>
          {project.uploads.map((upload, i) => (
            <UploadCard
              key={upload.id}
              upload={upload}
              index={i}
              footer={
                <SelectionControls
                  status={statusOf(upload.id, "maybe")}
                  onChange={(s) => setStatus(upload.id, s)}
                  onTune={() => setTunerTarget({ kind: "upload", upload })}
                />
              }
            />
          ))}
          <button type="button" onClick={() => setUploadOpen(true)} className="cursor-pointer text-left">
            <PaperCard seed={1} rotate={-1} className="w-60 p-3 transition-transform hover:-translate-y-1">
              <div className="flex h-36 flex-col items-center justify-center gap-2 border-2 border-dashed border-stamp/40 bg-paper-deep/20 text-center">
                <span className="font-display text-3xl text-stamp">+</span>
                <span className="font-typewriter text-[10px] uppercase tracking-widest text-ink-soft">
                  Your photograph
                </span>
              </div>
              <p className="mt-2 font-hand text-sm text-ink-soft">
                The timeline continues with you — add an image to the archive.
              </p>
            </PaperCard>
          </button>
          <AudioSlotCard />
        </TimelineEraColumn>
      </TimelineRail>

      {hydrated && (
        <SelectionTray
          slug={place.slug}
          mustUse={mustUse}
          maybe={maybe}
          community={approvedUploads.length}
        />
      )}

      <UploadModal
        open={uploadOpen}
        placeName={place.name}
        onClose={() => setUploadOpen(false)}
        onSubmit={(upload) =>
          update((prev) => ({ ...prev, uploads: [...prev.uploads, upload] }))
        }
      />

      {tunerTarget?.kind === "asset" && (
        <PreprocessTuner
          open
          onClose={() => setTunerTarget(null)}
          title={tunerTarget.asset.title}
          imageUrl={assetThumb(tunerTarget.asset)!}
          defaults={assetDefaults(tunerTarget.asset)}
          value={project.tuning[tunerTarget.asset.id] ?? {}}
          warnings={tunerTarget.asset.cutouts?.flatMap((c) => c.quality_warnings ?? [])}
          onSave={(t) => saveTuning(tunerTarget.asset.id, t)}
        />
      )}
      {tunerTarget?.kind === "upload" && (
        <PreprocessTuner
          open
          onClose={() => setTunerTarget(null)}
          title={tunerTarget.upload.title}
          imageUrl={tunerTarget.upload.dataUrl}
          defaults={{ tone: "source", edge: "scissor" }}
          value={project.tuning[tunerTarget.upload.id] ?? {}}
          onSave={(t) => saveTuning(tunerTarget.upload.id, t)}
        />
      )}
    </main>
  );
}
