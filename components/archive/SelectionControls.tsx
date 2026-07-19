"use client";

import type { AssetStatus } from "@/lib/types";

const OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: "must_use", label: "Must use" },
  { value: "maybe", label: "Maybe" },
  { value: "rejected", label: "Skip" },
];

export function SelectionControls({
  status,
  onChange,
  onTune,
}: {
  status: AssetStatus;
  onChange: (status: AssetStatus) => void;
  onTune?: () => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-1 border-t border-dashed border-ink/15 pt-2">
      {OPTIONS.map((opt) => {
        const active = status === opt.value;
        const activeStyle =
          opt.value === "must_use"
            ? "bg-accent text-paper"
            : opt.value === "maybe"
              ? "bg-tape text-ink"
              : "bg-stamp/80 text-paper";
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer px-1.5 py-1 font-typewriter text-[10px] uppercase tracking-wider transition-colors ${
              active ? activeStyle : "text-ink-soft hover:bg-paper-deep"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
      {onTune && (
        <button
          onClick={onTune}
          className="ml-auto cursor-pointer px-1.5 py-1 font-hand text-sm text-ink-soft underline decoration-dotted hover:text-stamp"
          title="Tune tone & edges"
        >
          tune
        </button>
      )}
    </div>
  );
}
