import { listPlaces } from "@/lib/places";
import { SiteNav } from "@/components/atlas/SiteNav";
import { FeatureBar } from "@/components/atlas/FeatureBar";
import { AtlasHero } from "@/components/atlas/AtlasHero";
import { AtlasFinder } from "@/components/atlas/AtlasFinder";
import {
  ArchiveCTACard,
  LatestContributionCard,
} from "@/components/atlas/HeroCards";

export default function AtlasPage() {
  const allPlaces = listPlaces();
  // The homepage globe only opens a few example places — the rest of the
  // atlas fills in over time, but the entry point stays deliberately small.
  const places = allPlaces.slice(0, 3);
  const latest = allPlaces.find((p) => p.status === "seeded") ?? allPlaces[0];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />

      <main className="flex-1">
        <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-6 py-10 lg:grid-cols-[minmax(0,600px)_minmax(0,720px)] lg:justify-center lg:gap-16 lg:px-16 lg:py-16">
          {/* Editorial column */}
          <section className="flex flex-col gap-6">
            <h1 className="text-6xl leading-[1.02] text-ink lg:text-[88px]">
              Into Place
            </h1>

            <span aria-hidden className="block h-px w-16 bg-orange" />

            <p className="max-w-md font-body text-lg leading-relaxed text-ink-soft">
              An interactive map of stories and archives, gathered with
              communities and layered over the places that hold them.
            </p>

            <p className="max-w-md font-body text-lg leading-relaxed text-ink">
              Explore. Remember. Add your voice. Keep the stories in place.
            </p>

            <AtlasFinder places={allPlaces} />
          </section>

          {/* Collage / globe column */}
          <section className="relative flex flex-col gap-6 lg:block">
            <div className="z-30 lg:absolute lg:left-0 lg:top-0">
              <ArchiveCTACard />
            </div>

            <AtlasHero places={places} />

            <div className="z-30 lg:absolute lg:bottom-2 lg:right-0">
              {latest && <LatestContributionCard place={latest} />}
            </div>
          </section>
        </div>
      </main>

      <FeatureBar />
    </div>
  );
}
