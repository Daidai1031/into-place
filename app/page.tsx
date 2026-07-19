import { listPlaces } from "@/lib/places";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { NewPlaceInput } from "@/components/atlas/NewPlaceInput";

export default function AtlasPage() {
  const places = listPlaces();
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center gap-8 px-6 py-12">
      <header className="text-center">
        <h1 className="text-5xl tracking-tight">Into Place</h1>
        <p className="mx-auto mt-3 max-w-xl font-typewriter text-sm text-ink-soft">
          Step inside the layered stories of a place. Real archives, community
          memory, collage films. The place determines the film — you direct the
          journey.
        </p>
      </header>

      <AtlasMap places={places} />

      <section className="flex flex-col items-center gap-3 text-center">
        <p className="font-typewriter text-xs uppercase tracking-widest text-ink-soft">
          Lit places hold archives. Faded ones are waiting for you.
        </p>
        <NewPlaceInput />
        <p className="mt-2 max-w-lg font-hand text-base text-ink-soft">
          Anyone can contribute images and understanding to a place — every
          photograph keeps its source, and every contributor keeps their name.
        </p>
      </section>
    </main>
  );
}
