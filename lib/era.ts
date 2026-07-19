/**
 * Parse free-text `era` strings ("ca. 1850s-1870s (stereoview)", "1838-05-01",
 * "HABS documentation photograph (uploaded 2014)") into a sortable year and a
 * display bucket. Timeline uses buckets (decades), not a proportional scale —
 * archival data has 60-year gaps that would wreck a pixel-per-year axis.
 */
export interface EraInfo {
  sortYear: number; // 9999 when unknown → sorts last
  bucket: string; // e.g. "1850s", "1990s", "Undated"
}

export function parseEra(era: string | null | undefined): EraInfo {
  if (!era) return { sortYear: 9999, bucket: "Undated" };
  const match = era.match(/(1[6-9]\d{2}|20\d{2})/);
  if (!match) return { sortYear: 9999, bucket: "Undated" };
  const year = parseInt(match[1], 10);
  return { sortYear: year, bucket: `${Math.floor(year / 10) * 10}s` };
}

/** Group items into ordered era buckets for the timeline rail. */
export function bucketByEra<T>(
  items: T[],
  getEra: (item: T) => string | null | undefined,
): { bucket: string; sortYear: number; items: T[] }[] {
  const map = new Map<string, { bucket: string; sortYear: number; items: T[] }>();
  for (const item of items) {
    const { sortYear, bucket } = parseEra(getEra(item));
    const existing = map.get(bucket);
    if (existing) {
      existing.items.push(item);
      existing.sortYear = Math.min(existing.sortYear, sortYear);
    } else {
      map.set(bucket, { bucket, sortYear, items: [item] });
    }
  }
  return [...map.values()].sort((a, b) => a.sortYear - b.sortYear);
}
