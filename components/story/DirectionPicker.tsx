"use client";

import { useState } from "react";
import { PaperCard } from "@/components/ui/PaperCard";
import { CollageButton } from "@/components/ui/CollageButton";

export interface Direction {
  id: string;
  title: string;
  premise: string;
}

export function DirectionPicker({
  directions,
  onPick,
  busy,
}: {
  directions: Direction[];
  onPick: (direction: Direction) => void;
  busy: boolean;
}) {
  const [custom, setCustom] = useState("");
  return (
    <section>
      <h3 className="text-xl">Where could the story go next?</h3>
      <p className="mt-1 font-typewriter text-sm text-ink-soft">
        Three directions drawn from the archive — pick one, or write your own.
      </p>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {directions.map((dir, i) => (
          <button
            key={dir.id}
            disabled={busy}
            onClick={() => onPick(dir)}
            className="cursor-pointer text-left disabled:cursor-wait disabled:opacity-60"
          >
            <PaperCard
              seed={i}
              rotate={[(i - 1) * 1.2, 1.4, -1][i % 3]}
              className="flex h-full flex-col p-5 transition-transform hover:-translate-y-1"
            >
              <span className="font-typewriter text-[10px] uppercase tracking-widest text-stamp">
                Direction {i + 1}
              </span>
              <h4 className="mt-1 font-display text-lg leading-snug">{dir.title}</h4>
              <p className="mt-2 font-typewriter text-sm leading-relaxed text-ink-soft">
                {dir.premise}
              </p>
            </PaperCard>
          </button>
        ))}
      </div>
      <form
        className="mt-6 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!custom.trim()) return;
          onPick({ id: "dir_custom", title: "Your direction", premise: custom.trim() });
        }}
      >
        <label className="flex-1 font-typewriter text-xs uppercase tracking-wider text-ink-soft">
          Or write your own direction
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            disabled={busy}
            placeholder="e.g. The island's ruins learn to speak to its newest residents…"
            className="mt-1 w-full border-b-2 border-dashed border-ink/30 bg-transparent py-1.5 font-hand text-lg outline-none placeholder:text-ink-soft/40 focus:border-ink"
          />
        </label>
        <CollageButton type="submit" disabled={busy || !custom.trim()}>
          Use this
        </CollageButton>
      </form>
    </section>
  );
}
