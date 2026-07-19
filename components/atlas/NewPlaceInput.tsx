"use client";

import { useState } from "react";
import { CollageButton } from "@/components/ui/CollageButton";

export function NewPlaceInput() {
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        setNotice(
          `"${value.trim()}" — new places open soon. Every place starts with one contribution.`,
        );
        setValue("");
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Name a place you carry with you…"
        className="min-w-0 flex-1 border-b-2 border-dashed border-ink/40 bg-transparent px-1 py-1.5 font-hand text-base outline-none placeholder:text-ink-soft/50 focus:border-ink"
      />
      <CollageButton variant="ghost" type="submit">
        Propose
      </CollageButton>
      {notice && (
        <span className="max-w-xs font-hand text-sm text-accent">{notice}</span>
      )}
    </form>
  );
}
