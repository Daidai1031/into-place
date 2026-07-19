import type { PlaceAsset } from "@/lib/types";

export function FoundCounter({
  assets,
  uploads = 0,
}: {
  assets: PlaceAsset[];
  uploads?: number;
}) {
  const photos = assets.filter((a) => a.type === "photo").length;
  const printsAndMaps = assets.filter((a) => a.type === "print" || a.type === "map").length;
  const community =
    assets.filter((a) => a.contributor !== "founder_seed").length + uploads;
  return (
    <p className="font-typewriter text-sm text-ink-soft">
      Found:{" "}
      <span className="text-ink">{photos} archival photographs</span>,{" "}
      <span className="text-ink">{printsAndMaps} prints &amp; maps</span>,{" "}
      <span className={community > 0 ? "text-stamp" : "text-ink"}>
        {community} community contribution{community === 1 ? "" : "s"}
      </span>
    </p>
  );
}
