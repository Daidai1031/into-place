"use client";

import { useState } from "react";
import type { StoryBeat } from "@/lib/local-store";
import { PaperCard } from "@/components/ui/PaperCard";

export function BeatCard({
  beat,
  index,
  canDelete,
  busy,
  onEdit,
  onReroll,
  onDelete,
}: {
  beat: StoryBeat;
  index: number;
  canDelete: boolean;
  busy: boolean;
  onEdit: (text: string) => void;
  onReroll: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(beat.text);

  return (
    <PaperCard seed={index} rotate={index % 2 ? 0.8 : -0.8} className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-typewriter text-[10px] uppercase tracking-widest text-stamp">
          Beat {index + 1} · {beat.act}
        </span>
        <div className="flex gap-2 font-hand text-sm">
          <button
            onClick={onReroll}
            disabled={busy}
            className="cursor-pointer text-ink-soft underline decoration-dotted hover:text-accent disabled:cursor-wait disabled:opacity-40"
            title="Ask AI for a fresh take on this beat"
          >
            re-roll
          </button>
          <button
            onClick={onDelete}
            disabled={busy || !canDelete}
            className="cursor-pointer text-ink-soft underline decoration-dotted hover:text-stamp disabled:cursor-not-allowed disabled:opacity-40"
            title={canDelete ? "Remove this beat" : "A story needs at least 5 beats"}
          >
            delete
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft.trim() && draft !== beat.text) onEdit(draft.trim());
          }}
          rows={3}
          className="mt-2 w-full resize-none border border-dashed border-ink/30 bg-paper/60 p-2 font-display text-base leading-relaxed outline-none"
        />
      ) : (
        <p
          onClick={() => {
            setDraft(beat.text);
            setEditing(true);
          }}
          className="mt-2 cursor-text font-display text-base leading-relaxed decoration-ink/20 hover:underline"
          title="Click to edit"
        >
          {beat.text}
        </p>
      )}
    </PaperCard>
  );
}
