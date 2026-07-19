import type { ReactNode } from "react";
import type { PlaceAsset } from "@/lib/types";
import { assetThumb, isPdfAsset } from "@/lib/types";
import { PaperCard } from "@/components/ui/PaperCard";
import {
  ContributorBadge,
  EraBadge,
  FactLevelBadge,
  LicenseBadge,
} from "@/components/ui/Badges";

/**
 * One archive item on the timeline. `footer` is the P2 slot for selection
 * controls and the preprocess tuner trigger; `thumbOverride` lets user
 * uploads (dataURL) reuse the same card.
 */
export function AssetCard({
  asset,
  index = 0,
  footer,
  thumbOverride,
  thumbStyle,
}: {
  asset: PlaceAsset;
  index?: number;
  footer?: ReactNode;
  thumbOverride?: string;
  thumbStyle?: React.CSSProperties;
}) {
  const thumb = thumbOverride ?? assetThumb(asset);
  const pdf = isPdfAsset(asset) || !thumb;
  const referenceOnly = asset.reference_only === true;
  const rotate = [(index % 3) - 1, 1.5, -1.5][index % 3] * 0.9;

  return (
    <PaperCard seed={index} rotate={rotate} className="w-60 p-3">
      <div className="flex h-36 items-center justify-center overflow-hidden bg-paper-deep/40">
        {referenceOnly ? (
          <div className="flex flex-col items-center gap-1 p-4 text-center">
            <span className="font-display text-3xl text-ink-soft">▶</span>
            <span className="font-typewriter text-[10px] uppercase tracking-widest text-ink-soft">
              Reference film · not used in video
            </span>
            <a
              href={asset.source_url}
              target="_blank"
              rel="noreferrer"
              className="font-typewriter text-[11px] underline decoration-dotted hover:text-stamp"
            >
              Watch at source
            </a>
          </div>
        ) : pdf ? (
          <div className="flex flex-col items-center gap-1 p-4 text-center">
            <span className="font-display text-3xl text-ink-soft">¶</span>
            <span className="font-typewriter text-[10px] uppercase tracking-widest text-ink-soft">
              Scanned document
            </span>
            <a
              href={asset.source_url}
              target="_blank"
              rel="noreferrer"
              className="font-typewriter text-[11px] underline decoration-dotted hover:text-stamp"
            >
              Open PDF source
            </a>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={asset.title}
            className="max-h-full max-w-full object-contain"
            style={thumbStyle}
            loading="lazy"
          />
        )}
      </div>
      <p className="mt-2 line-clamp-2 font-display text-sm leading-snug" title={asset.title}>
        {asset.title}
      </p>
      {referenceOnly && asset.description && (
        <p className="mt-1 line-clamp-3 font-typewriter text-[10px] leading-relaxed text-ink-soft">
          {asset.description}
        </p>
      )}
      <div className="mt-1 flex items-center justify-between">
        <EraBadge era={asset.era} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <FactLevelBadge level={asset.fact_level} />
        <ContributorBadge contributor={asset.contributor} />
        <LicenseBadge license={asset.license.split("(")[0].trim()} />
      </div>
      <a
        href={asset.source_url}
        target="_blank"
        rel="noreferrer"
        className="mt-1.5 block truncate font-typewriter text-[11px] text-ink-soft underline decoration-dotted hover:text-stamp"
      >
        {asset.source}
      </a>
      {footer}
    </PaperCard>
  );
}
