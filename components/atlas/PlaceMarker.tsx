import Link from "next/link";
import type { PlaceSummary } from "@/lib/types";

export function PlaceMarker({ place }: { place: PlaceSummary }) {
  const style = {
    left: `${place.map_marker.x * 100}%`,
    top: `${place.map_marker.y * 100}%`,
  };

  if (place.status === "empty") {
    return (
      <div
        className="group absolute -translate-x-1/2 -translate-y-1/2"
        style={style}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-ink-soft/50 bg-paper/60 opacity-60 transition-opacity group-hover:opacity-100">
          <span className="font-typewriter text-xs text-ink-soft">?</span>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-44 -translate-x-1/2 bg-ink px-3 py-2 text-center opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          <p className="font-display text-sm text-paper">{place.name}</p>
          <p className="mt-1 font-hand text-xs text-tape">
            Be the first to contribute
          </p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/p/${place.slug}/archive`}
      className="group absolute -translate-x-1/2 -translate-y-1/2"
      style={style}
    >
      <div className="relative flex h-8 w-8 items-center justify-center">
        <span className="absolute h-8 w-8 animate-ping rounded-full bg-stamp/30 [animation-duration:2.5s]" />
        <span className="relative h-4 w-4 rotate-45 bg-stamp shadow-[1px_1px_0_rgb(43_38_32/0.4)] transition-transform group-hover:scale-125" />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-56 -translate-x-1/2 -rotate-1 bg-[#faf6ec] p-3 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        <p className="font-display text-base leading-tight">{place.name}</p>
        <p className="mt-1 font-typewriter text-[11px] leading-snug text-ink-soft">
          {place.tagline}
        </p>
        <p className="mt-1.5 font-typewriter text-[10px] uppercase tracking-wider text-accent">
          {place.assetCount} archive items · enter →
        </p>
      </div>
    </Link>
  );
}
