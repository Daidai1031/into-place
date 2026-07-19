"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { CollageButton } from "@/components/ui/CollageButton";
import type { Edge, Tone } from "@/lib/types";

export const TONE_FILTER: Record<Tone, string> = {
  source: "none",
  mono: "grayscale(1) contrast(1.05)",
  sepia: "sepia(0.8) contrast(0.95)",
};

const TONES: Tone[] = ["source", "mono", "sepia"];
const EDGES: Edge[] = ["torn", "scissor", "none"];

const TONE_HINT: Record<Tone, string> = {
  source: "Keep original colors (modern photographs)",
  mono: "Neutral black & white (historical default)",
  sepia: "Warm archival wash",
};
const EDGE_HINT: Record<Edge, string> = {
  torn: "Hand-torn paper edge (stable seed)",
  scissor: "Crisp scissor cut with white mat",
  none: "No edge treatment (backgrounds)",
};

/**
 * Per-asset preprocess tuning. The preview approximates tone with CSS
 * filters and edge with the same clip-path/mat classes the pipeline mimics;
 * the actual pixels are re-processed locally by the deterministic pipeline —
 * never by a generative model.
 */
export function PreprocessTuner({
  open,
  onClose,
  title,
  imageUrl,
  defaults,
  value,
  warnings,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  imageUrl: string;
  defaults: { tone: Tone; edge: Edge };
  value: { tone?: Tone; edge?: Edge };
  warnings?: string[];
  onSave: (tuning: { tone: Tone; edge: Edge }) => void;
}) {
  const [tone, setTone] = useState<Tone>(value.tone ?? defaults.tone);
  const [edge, setEdge] = useState<Edge>(value.edge ?? defaults.edge);

  const edgeClass = edge === "torn" ? "torn-1" : edge === "scissor" ? "scissor-edge" : "";

  return (
    <Modal open={open} onClose={onClose} className="w-[30rem] max-w-full">
      <h3 className="text-xl">Tune preprocessing</h3>
      <p className="mt-0.5 font-typewriter text-xs text-ink-soft">{title}</p>

      <div className="mt-4 flex justify-center bg-sky/30 p-6">
        <div className={`bg-[#faf6ec] p-1.5 ${edgeClass}`} style={{ maxWidth: "70%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title}
            className="max-h-48 w-full object-contain"
            style={{ filter: TONE_FILTER[tone] }}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="font-typewriter text-xs uppercase tracking-wider text-ink-soft">Tone</p>
        <div className="mt-1 flex gap-1">
          {TONES.map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              title={TONE_HINT[t]}
              className={`cursor-pointer px-3 py-1.5 font-typewriter text-xs uppercase tracking-wider transition-colors ${
                tone === t ? "bg-ink text-paper" : "bg-paper-deep/50 text-ink-soft hover:bg-paper-deep"
              }`}
            >
              {t}
              {t === defaults.tone && " ·"}
            </button>
          ))}
        </div>
        <p className="mt-1 font-hand text-sm text-ink-soft">{TONE_HINT[tone]}</p>
      </div>

      <div className="mt-3">
        <p className="font-typewriter text-xs uppercase tracking-wider text-ink-soft">Edge</p>
        <div className="mt-1 flex gap-1">
          {EDGES.map((e) => (
            <button
              key={e}
              onClick={() => setEdge(e)}
              title={EDGE_HINT[e]}
              className={`cursor-pointer px-3 py-1.5 font-typewriter text-xs uppercase tracking-wider transition-colors ${
                edge === e ? "bg-ink text-paper" : "bg-paper-deep/50 text-ink-soft hover:bg-paper-deep"
              }`}
            >
              {e}
              {e === defaults.edge && " ·"}
            </button>
          ))}
        </div>
        <p className="mt-1 font-hand text-sm text-ink-soft">{EDGE_HINT[edge]}</p>
      </div>

      {warnings && warnings.length > 0 && (
        <p className="mt-3 bg-stamp/10 px-2 py-1.5 font-typewriter text-[11px] text-stamp">
          ⚠ {warnings.includes("low_source_resolution_no_upscale")
            ? "Low source resolution — no upscaling will be applied; scene scale is limited."
            : warnings.join(", ")}
        </p>
      )}

      <p className="mt-3 font-typewriter text-[10px] leading-relaxed text-ink-soft">
        Dot (·) marks the recipe default. Previews are CSS approximations — the
        real pixels are re-processed by the local deterministic pipeline, never
        repainted by a model.
      </p>

      <div className="mt-4 flex justify-between">
        <CollageButton
          variant="ghost"
          onClick={() => {
            setTone(defaults.tone);
            setEdge(defaults.edge);
          }}
        >
          Reset to recipe default
        </CollageButton>
        <div className="flex gap-2">
          <CollageButton variant="ghost" onClick={onClose}>
            Cancel
          </CollageButton>
          <CollageButton
            onClick={() => {
              onSave({ tone, edge });
              onClose();
            }}
          >
            Apply
          </CollageButton>
        </div>
      </div>
    </Modal>
  );
}
