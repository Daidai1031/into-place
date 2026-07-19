"use client";

import { useCallback, useEffect, useState } from "react";
import { loadFilms, saveFilms, type FilmEntry } from "@/lib/local-store";

export function useFilms() {
  const [films, setFilms] = useState<FilmEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFilms(loadFilms());
    setHydrated(true);
  }, []);

  const update = useCallback((updater: (prev: FilmEntry[]) => FilmEntry[]) => {
    setFilms((prev) => {
      const next = updater(prev);
      saveFilms(next);
      return next;
    });
  }, []);

  return { films, update, hydrated };
}
