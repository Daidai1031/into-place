"use client";

import Link from "next/link";
import { useFilms } from "@/lib/hooks/useFilms";
import { PaperCard } from "@/components/ui/PaperCard";
import { TapeStrip } from "@/components/ui/TapeStrip";

export function LibraryView() {
  const { films, update, hydrated } = useFilms();

  if (!hydrated) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">Film library</h1>
          <p className="mt-1 font-typewriter text-sm text-ink-soft">
            The films you kept, saved on this device.
          </p>
        </div>
        <Link href="/" className="font-hand text-sm text-ink-soft underline decoration-dotted hover:text-stamp">
          ← back to the atlas
        </Link>
      </div>

      {films.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-4 text-center">
          <p className="font-hand text-2xl text-ink-soft">No films yet.</p>
          <p className="max-w-md font-typewriter text-sm text-ink-soft">
            Walk into a place on the atlas, curate its archive, write its next
            chapter, and the film you generate can live here.
          </p>
          <Link href="/" className="bg-ink px-4 py-2 font-typewriter text-sm text-paper hover:bg-ink-soft">
            Open the atlas
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {films.map((film, i) => (
            <PaperCard key={film.id} seed={i} rotate={(i % 3) - 1} className="p-3">
              <TapeStrip className="-top-3 left-1/2 -translate-x-1/2" rotate={i % 2 ? 4 : -3} />
              <video src={film.url} className="w-full bg-ink" preload="metadata" controls />
              <p className="mt-2 line-clamp-2 font-display text-sm leading-snug">{film.title}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-typewriter text-[10px] text-ink-soft">
                  {new Date(film.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      update((prev) =>
                        prev.map((f) => (f.id === film.id ? { ...f, liked: !f.liked } : f)),
                      )
                    }
                    className="cursor-pointer text-base transition-transform hover:scale-125"
                    title={film.liked ? "Unlike" : "Like"}
                  >
                    {film.liked ? "❤️" : "🤍"}
                  </button>
                  <button
                    onClick={() =>
                      update((prev) =>
                        prev.map((f) => (f.id === film.id ? { ...f, favorite: !f.favorite } : f)),
                      )
                    }
                    className={`cursor-pointer text-base transition-transform hover:scale-125 ${film.favorite ? "" : "opacity-40 grayscale"}`}
                    title={film.favorite ? "Unfavorite" : "Favorite"}
                  >
                    ⭐
                  </button>
                  <button
                    onClick={() => update((prev) => prev.filter((f) => f.id !== film.id))}
                    className="cursor-pointer font-hand text-sm text-ink-soft underline decoration-dotted hover:text-stamp"
                    title="Remove from library"
                  >
                    remove
                  </button>
                </span>
              </div>
            </PaperCard>
          ))}
        </div>
      )}
    </main>
  );
}
