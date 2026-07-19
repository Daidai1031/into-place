"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlaceSummary } from "@/lib/types";
import { NewPlaceInput } from "@/components/atlas/NewPlaceInput";

/**
 * Hero search card — "Find a place or propose a new one". Searches the
 * seeded atlas as you type; the propose action reveals the existing
 * NewPlaceInput (its behaviour is preserved, just tucked behind a toggle).
 */
export function AtlasFinder({ places }: { places: PlaceSummary[] }) {
  const [query, setQuery] = useState("");
  const [proposing, setProposing] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return places
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.region.toLowerCase().includes(q),
      )
      .slice(0, 4);
  }, [places, query]);

  return (
    <div className="max-w-[440px] border border-ink/10 bg-card p-6 shadow-[0_2px_16px_rgb(30_26_22/0.06)]">
      <h2 className="font-body text-base text-ink">
        Find a place or propose a new one
      </h2>

      <div className="relative mt-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Little Bay, Sydney"
          aria-label="Search places"
          className="w-full border-b border-ink/25 bg-transparent py-2 pr-8 font-body text-base text-ink outline-none placeholder:text-ink-soft/60 focus:border-orange"
        />
        <svg
          aria-hidden
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-ink-soft"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>

        {matches.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 border border-ink/10 bg-card shadow-[0_8px_24px_rgb(30_26_22/0.14)]">
            {matches.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/p/${p.slug}/archive`}
                  className="block px-3 py-2 font-body text-sm text-ink transition-colors hover:bg-paper-deep/60"
                >
                  {p.name}
                  <span className="ml-2 font-ui text-xs text-ink-soft">
                    {p.region}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3 text-ink-soft/70">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="font-ui text-xs lowercase">or</span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      {proposing ? (
        <div className="mt-4">
          <NewPlaceInput />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setProposing(true)}
          className="mt-4 flex items-center gap-2 font-ui text-sm font-bold uppercase tracking-wide text-orange transition-colors hover:text-ink"
        >
          <span aria-hidden className="text-lg leading-none">
            +
          </span>
          Propose a place
        </button>
      )}
    </div>
  );
}
