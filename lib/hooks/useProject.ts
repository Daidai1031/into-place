"use client";

import { useCallback, useEffect, useState } from "react";
import {
  emptyProject,
  loadProject,
  saveProject,
  type ProjectState,
} from "@/lib/local-store";

/**
 * Project state hook: hydrates from localStorage after mount (SSR-safe) and
 * persists every update synchronously.
 */
export function useProject(slug: string) {
  const [project, setProject] = useState<ProjectState>(() => emptyProject(slug));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProject(loadProject(slug));
    setHydrated(true);
  }, [slug]);

  const update = useCallback(
    (updater: (prev: ProjectState) => ProjectState) => {
      setProject((prev) => {
        const next = updater(prev);
        saveProject(next);
        return next;
      });
    },
    [],
  );

  return { project, update, hydrated };
}
