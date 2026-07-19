"use client";

import { useState } from "react";
import type { StoryBeat, TransitionNote } from "@/lib/local-store";
import { TransitionNoteEditor } from "./TransitionNoteEditor";

const TYPE_ICON: Record<TransitionNote["type"], string> = {
  page_turn: "⤵",
  wipe: "⇥",
  match_cut: "⧉",
  push_dissolve: "◎",
  custom: "✎",
};

/** Horizontal beat selector with transition chips between neighbors. */
export function BeatStrip({
  beats,
  currentId,
  laidOut,
  transitions,
  onSelect,
  onSaveTransition,
}: {
  beats: StoryBeat[];
  currentId: string;
  laidOut: Set<string>;
  transitions: Record<string, TransitionNote>;
  onSelect: (beatId: string) => void;
  onSaveTransition: (key: string, note: TransitionNote) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {beats.map((beat, i) => {
        const active = beat.id === currentId;
        const key = i < beats.length - 1 ? `${beat.id}->${beats[i + 1].id}` : null;
        return (
          <span key={beat.id} className="flex items-center gap-1">
            <button
              onClick={() => onSelect(beat.id)}
              title={beat.text}
              className={`flex min-w-24 cursor-pointer flex-col gap-0.5 border px-2.5 py-1.5 text-left transition-colors ${
                active
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/20 bg-paper/70 text-ink hover:border-ink/50"
              }`}
            >
              <span className="font-typewriter text-[10px] uppercase tracking-widest opacity-70">
                Beat {i + 1} {laidOut.has(beat.id) ? "●" : "○"}
              </span>
              <span className="line-clamp-1 max-w-36 font-display text-xs">{beat.act}</span>
            </button>
            {key && (
              <span className="relative">
                <button
                  onClick={() => setOpenKey(openKey === key ? null : key)}
                  title={transitions[key]?.note || "Add a transition note"}
                  className={`cursor-pointer px-1 py-0.5 font-typewriter text-sm ${
                    transitions[key] ? "text-stamp" : "text-ink-soft/50 hover:text-ink"
                  }`}
                >
                  {transitions[key] ? TYPE_ICON[transitions[key].type] : "+"}
                </button>
                {openKey === key && (
                  <TransitionNoteEditor
                    from={beat}
                    to={beats[i + 1]}
                    value={transitions[key] ?? null}
                    onSave={(note) => onSaveTransition(key, note)}
                    onClose={() => setOpenKey(null)}
                  />
                )}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
