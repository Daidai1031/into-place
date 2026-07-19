"use client";

import Link from "next/link";

export function SelectionTray({
  slug,
  mustUse,
  maybe,
  community,
}: {
  slug: string;
  mustUse: number;
  maybe: number;
  community: number;
}) {
  const total = mustUse + maybe;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/15 bg-paper/95 px-6 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <p className="font-typewriter text-sm">
          <span className="text-accent">{mustUse} must-use</span>
          <span className="text-ink-soft"> · </span>
          <span>{maybe} maybe</span>
          {community > 0 && (
            <>
              <span className="text-ink-soft"> · </span>
              <span className="text-stamp">{community} yours</span>
            </>
          )}
          <span className="ml-2 font-hand text-base text-ink-soft">
            {total < 3 ? "pick at least 3 to build scenes" : "ready to write the story"}
          </span>
        </p>
        <Link
          href={`/p/${slug}/story`}
          aria-disabled={total < 3}
          className={`px-4 py-2 font-typewriter text-sm tracking-wide shadow-[2px_2px_0_rgb(43_38_32/0.25)] transition-colors ${
            total < 3
              ? "pointer-events-none bg-paper-deep text-ink-soft opacity-50"
              : "bg-ink text-paper hover:bg-ink-soft"
          }`}
        >
          Continue to Story →
        </Link>
      </div>
    </div>
  );
}
