import type { PlaceSummary } from "@/lib/types";
import { PlaceMarker } from "./PlaceMarker";

/**
 * Stylized collage atlas: torn-paper landmasses over a sea-toned sheet,
 * hand-dashed travel lines, markers absolutely positioned from map_marker.
 * Not a real projection — an illustration of a world still being pieced
 * together, which is the co-creation story itself.
 */
export function AtlasMap({ places }: { places: PlaceSummary[] }) {
  return (
    <div className="paper-shadow relative mx-auto aspect-[16/9] w-full max-w-4xl overflow-hidden bg-sky/60 torn-1">
      <svg
        viewBox="0 0 1600 900"
        className="absolute inset-0 h-full w-full"
        aria-hidden
        preserveAspectRatio="none"
      >
        {/* sea texture lines */}
        <g stroke="#8fa6b0" strokeWidth="1.5" opacity="0.35" fill="none">
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d={`M0 ${70 + i * 75} q 200 ${i % 2 ? 18 : -18} 400 0 t 400 0 t 400 0 t 400 0`}
            />
          ))}
        </g>
        {/* torn-paper landmasses */}
        <g fill="#efe6d0" stroke="#d8cbae" strokeWidth="3">
          <path d="M110 240 L230 180 L340 210 L420 160 L470 260 L430 380 L470 470 L380 560 L260 530 L180 590 L90 500 L130 380 Z" />
          <path d="M560 180 L700 130 L820 170 L860 120 L980 160 L940 260 L1000 330 L900 420 L780 380 L660 430 L590 330 Z" />
          <path d="M1040 260 L1180 200 L1330 250 L1460 220 L1520 340 L1440 460 L1320 430 L1230 520 L1100 470 L1060 360 Z" />
          <path d="M300 640 L460 610 L560 680 L520 790 L380 820 L280 750 Z" />
          <path d="M1150 600 L1300 570 L1420 640 L1380 760 L1220 790 L1130 700 Z" />
        </g>
        {/* hand-dashed routes between marker positions */}
        <g stroke="#5b5348" strokeWidth="2.5" strokeDasharray="4 10" fill="none" opacity="0.5">
          <path d="M320 504 q 220 -160 384 -198 q 240 -60 448 36" />
        </g>
      </svg>
      {places.map((place) => (
        <PlaceMarker key={place.slug} place={place} />
      ))}
      <p className="absolute bottom-3 right-4 font-hand text-sm text-ink-soft/70">
        an atlas still being pieced together
      </p>
    </div>
  );
}
