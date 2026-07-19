import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Place, PlaceSummary } from "./types";

const PLACES_DIR = path.join(process.cwd(), "data", "places");

export function listPlaces(): PlaceSummary[] {
  return readdirSync(PLACES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const p = JSON.parse(readFileSync(path.join(PLACES_DIR, f), "utf8")) as Place;
      return {
        slug: p.slug,
        name: p.name,
        region: p.region,
        status: p.status,
        map_marker: p.map_marker,
        coordinates: p.coordinates,
        tagline: p.tagline,
        assetCount: p.assets?.length ?? 0,
      };
    });
}

export function getPlace(slug: string): Place | null {
  // slug comes from the URL — never let it escape data/places/
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    return JSON.parse(
      readFileSync(path.join(PLACES_DIR, `${slug}.json`), "utf8"),
    ) as Place;
  } catch {
    return null;
  }
}
