export type Tone = "source" | "mono" | "sepia";
export type Edge = "torn" | "scissor" | "none";
export type AssetStatus = "must_use" | "maybe" | "rejected";

export interface CutoutRecord {
  recipe_id: string;
  file: string; // repo path, e.g. assets/cutouts/asset_001_smallpox_card.png
  role: "card" | "cutout" | "bg";
  tone: Tone;
  edge: Edge;
  quality_warnings?: string[];
}

export interface PlaceAsset {
  id: string;
  title: string;
  type: "photo" | "print" | "map" | "pdf" | "audio" | "video";
  era: string;
  source: string;
  source_url: string;
  license: string;
  confidence: string;
  fact_level: string;
  contributor: string;
  share_to_place: boolean;
  upload_role: string | null;
  status: AssetStatus;
  file: string;
  cutouts: CutoutRecord[];
  /** Reference-only records are visible in the archive but never selectable for a film. */
  reference_only?: boolean;
  description?: string;
}

export interface Place {
  slug: string;
  name: string;
  region: string;
  status: "seeded" | "empty";
  map_marker: { x: number; y: number };
  coordinates: { lat: number; lng: number };
  tagline: string;
  assets: PlaceAsset[];
}

export interface PlaceSummary {
  slug: string;
  name: string;
  region: string;
  status: "seeded" | "empty";
  map_marker: { x: number; y: number };
  coordinates: { lat: number; lng: number };
  tagline: string;
  assetCount: number;
}

/** Public URL for a cutout file synced into public/cutouts. */
export function cutoutUrl(repoPath: string): string {
  const name = repoPath.split("/").pop();
  return `/cutouts/${name}`;
}

/** Preferred display thumbnail for an asset: card > cutout > bg > none. */
export function assetThumb(asset: PlaceAsset): string | null {
  const byRole = (role: string) => asset.cutouts?.find((c) => c.role === role);
  const pick = byRole("card") ?? byRole("cutout") ?? byRole("bg");
  return pick ? cutoutUrl(pick.file) : null;
}

export function isPdfAsset(asset: PlaceAsset): boolean {
  return asset.file?.toLowerCase().endsWith(".pdf") ?? false;
}
