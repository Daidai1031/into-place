"use client";

import { useCallback, useState } from "react";
import type { PlaceSummary } from "@/lib/types";
import { CollageParallax } from "@/components/atlas/CollageParallax";
import { PaperGlobe } from "@/components/atlas/PaperGlobe";
import { TapeStrip } from "@/components/ui/TapeStrip";

/**
 * The map column: a paper-styled react-globe.gl globe as the spatial nav
 * entry point, layered over scissor-cut archive fragments (not square
 * cards) plus a looping "found footage" prop. Owns the "focus" moment —
 * clicking a lit place on the globe wakes the background parallax.
 */
export function AtlasHero({ places }: { places: PlaceSummary[] }) {
  const [activated, setActivated] = useState(false);
  const handlePlaceFocus = useCallback(() => setActivated(true), []);

  return (
    <CollageParallax className="relative" active={activated}>
      {/* background layer: quiet, real survey map, bleeding off the corner */}
      <div
        data-depth="0.15"
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-16 z-0 w-[85%] max-w-none opacity-[0.1] grayscale transition-transform duration-300 ease-out"
        style={{
          maskImage:
            "radial-gradient(ellipse 60% 60% at 30% 30%, black 0%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 60% at 30% 30%, black 0%, transparent 72%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cutouts/asset_003_map_bg.png"
          alt=""
          className="w-full -rotate-2"
        />
      </div>

      <div className="relative z-10">
        <PaperGlobe places={places} onPlaceFocus={handlePlaceFocus} />
      </div>

      {/* foreground: a scissor-cut archival photograph, tucked in like a find */}
      <div
        data-depth="0.4"
        className="pointer-events-none absolute -top-6 right-0 z-20 w-24 rotate-3 transition-transform duration-300 ease-out sm:-top-8 sm:right-2 sm:w-28 lg:-top-10 lg:right-0 lg:w-32"
      >
        <div className="animate-float-in pointer-events-auto transition-transform duration-300 hover:-translate-y-1">
          <TapeStrip className="-top-2 left-1/2 z-10 -translate-x-1/2" rotate={-5} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cutouts/asset_017_lighthouse_modern_cutout.png"
            alt="Blackwell Island Light, Roosevelt Island (contemporary photo)"
            className="paper-shadow block w-full"
          />
        </div>
      </div>

      {/* foreground: Nellie Bly, scissor-cut portrait */}
      <div
        data-depth="0.3"
        className="pointer-events-none absolute top-[36%] -left-4 z-20 w-16 -rotate-6 transition-transform duration-300 ease-out sm:left-0 sm:w-20 lg:w-24"
      >
        <div className="animate-float-in pointer-events-auto transition-transform duration-300 hover:-translate-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cutouts/asset_019_nellie_bly_cutout.png"
            alt="Nellie Bly, ca. 1890"
            className="paper-shadow block w-full"
          />
        </div>
      </div>

      {/* foreground: the Girl Puzzle memorial, scissor-cut */}
      <div
        data-depth="0.25"
        className="pointer-events-none absolute bottom-8 right-6 z-20 w-12 rotate-2 transition-transform duration-300 ease-out sm:w-14 lg:right-10 lg:w-16"
      >
        <div className="animate-float-in pointer-events-auto transition-transform duration-300 hover:-translate-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cutouts/asset_031_girl_puzzle_statue_cutout.png"
            alt="The Girl Puzzle memorial to Nellie Bly, Roosevelt Island"
            className="paper-shadow block w-full"
          />
        </div>
      </div>

      {/* prop: a vintage TV playing looped found footage */}
      <div
        data-depth="0.2"
        className="pointer-events-none absolute -bottom-10 left-[8%] z-20 w-36 -rotate-3 transition-transform duration-300 ease-out sm:-bottom-14 sm:w-44 lg:w-52"
      >
        <div className="animate-float-in pointer-events-auto transition-transform duration-300 hover:-translate-y-1">
          <TapeStrip className="-top-2 left-1/2 z-10 -translate-x-1/2" rotate={4} />
          <div className="paper-shadow relative rounded-[16px] border-[6px] border-ink bg-ink p-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[8px] bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src="/decor/sample.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="block h-full w-full object-cover"
                style={{ filter: "grayscale(0.35) sepia(0.3) contrast(1.05) brightness(0.9)" }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-25 mix-blend-multiply"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, rgb(0 0 0 / 0.6) 0px, rgb(0 0 0 / 0.6) 1px, transparent 1px, transparent 3px)",
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between px-3">
              <span className="block h-2 w-3 rounded-b bg-ink-soft" />
              <span className="block h-2 w-3 rounded-b bg-ink-soft" />
            </div>
          </div>
          <p className="mt-1 text-center font-typewriter text-[9px] uppercase tracking-wide text-ink-soft/80">
            found footage · looped
          </p>
        </div>
      </div>

    </CollageParallax>
  );
}
