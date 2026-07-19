import Link from "next/link";
import type { PlaceSummary } from "@/lib/types";
import { Stamp } from "@/components/ui/Stamp";

/**
 * Collage overlay card — top-left of the globe. Frames the atlas as a
 * living archive and routes into the map.
 */
export function ArchiveCTACard() {
  return (
    <div className="w-[248px] bg-card p-5 shadow-[0_6px_20px_rgb(30_26_22/0.14)]">
      <p className="font-body text-base leading-snug text-ink">
        A living archive of memories, photos, voices and film.
      </p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center gap-2 font-ui text-xs font-bold uppercase tracking-[0.12em] text-orange transition-colors hover:text-ink"
      >
        Explore the map
        <span aria-hidden>↳</span>
      </Link>
    </div>
  );
}

/**
 * Collage overlay card — bottom-right of the globe. Shows the most recent
 * seeded place as the "latest contribution", stamped IN PLACE.
 */
export function LatestContributionCard({ place }: { place: PlaceSummary }) {
  return (
    <div className="relative w-[288px] bg-card p-5 shadow-[0_6px_20px_rgb(30_26_22/0.14)]">
      <p className="font-ui text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        Latest contribution
      </p>
      <Link
        href={`/p/${place.slug}/archive`}
        className="mt-1 block font-display text-xl leading-tight text-ink transition-colors hover:text-orange"
      >
        {place.name}
      </Link>
      <p className="mt-2 font-body text-sm text-ink-soft">{place.region}</p>
      <p className="font-body text-sm text-ink-soft">
        {place.assetCount} contributions
      </p>
      <Stamp
        text="in place"
        color="accent"
        className="absolute -bottom-2 right-3"
      />
    </div>
  );
}
