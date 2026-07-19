"use client";

import { useState } from "react";
import type { StoryBeat, TransitionNote } from "@/lib/local-store";
import { CollageButton } from "@/components/ui/CollageButton";

const TYPES: { value: TransitionNote["type"]; label: string }[] = [
  { value: "page_turn", label: "Page turn" },
  { value: "wipe", label: "Wipe" },
  { value: "match_cut", label: "Match cut" },
  { value: "push_dissolve", label: "Push dissolve" },
  { value: "custom", label: "Custom" },
];

/** Popover between two beats: pick a transition type + steering note. */
export function TransitionNoteEditor({
  from,
  to,
  value,
  onSave,
  onClose,
}: {
  from: StoryBeat;
  to: StoryBeat;
  value: TransitionNote | null;
  onSave: (note: TransitionNote) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<TransitionNote["type"]>(value?.type ?? "push_dissolve");
  const [note, setNote] = useState(value?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/transition/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Suggestion failed");
      const t = data.transition as { type: string; note: string };
      if (TYPES.some((x) => x.value === t.type)) setType(t.type as TransitionNote["type"]);
      setNote(t.note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suggestion failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute left-1/2 top-full z-30 mt-2 w-80 -translate-x-1/2 border border-ink/20 bg-[#faf6ec] p-4 shadow-xl">
      <p className="font-typewriter text-[10px] uppercase tracking-widest text-ink-soft">
        Transition · beat {from.id.replace(/\D/g, "")} → {to.id.replace(/\D/g, "")}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`cursor-pointer px-2 py-1 font-typewriter text-[10px] uppercase tracking-wider ${
              type === t.value ? "bg-ink text-paper" : "bg-paper-deep/50 text-ink-soft hover:bg-paper-deep"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="How should one scene become the next?"
        className="mt-2 w-full resize-none border border-dashed border-ink/25 bg-paper/60 p-2 font-hand text-base outline-none"
      />
      {error && <p className="mt-1 font-typewriter text-[11px] text-stamp">{error}</p>}
      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={() => void suggest()}
          disabled={busy}
          className="cursor-pointer font-hand text-sm text-accent underline decoration-dotted disabled:opacity-40"
        >
          {busy ? "thinking…" : "✨ Suggest with AI"}
        </button>
        <div className="flex gap-2">
          <CollageButton variant="ghost" onClick={onClose} className="!px-2.5 !py-1 text-xs">
            Close
          </CollageButton>
          <CollageButton
            onClick={() => {
              onSave({ type, note: note.trim() });
              onClose();
            }}
            className="!px-2.5 !py-1 text-xs"
          >
            Save
          </CollageButton>
        </div>
      </div>
    </div>
  );
}
