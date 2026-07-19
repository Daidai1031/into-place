const FACT_LEVEL_STYLES: Record<string, string> = {
  documented: "bg-accent/15 text-accent",
  probable: "bg-tape/60 text-ink-soft",
  interpretive: "bg-stamp/15 text-stamp",
};

export function FactLevelBadge({ level }: { level: string }) {
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 font-typewriter text-[10px] uppercase tracking-wider ${FACT_LEVEL_STYLES[level] ?? "bg-paper-deep text-ink-soft"}`}
    >
      {level}
    </span>
  );
}

export function LicenseBadge({ license }: { license: string }) {
  return (
    <span className="rounded-sm bg-paper-deep px-1.5 py-0.5 font-typewriter text-[10px] tracking-wider text-ink-soft">
      {license}
    </span>
  );
}

export function ContributorBadge({ contributor }: { contributor: string }) {
  const isCommunity = contributor !== "founder_seed";
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 font-typewriter text-[10px] uppercase tracking-wider ${isCommunity ? "bg-stamp/15 text-stamp" : "bg-sky/40 text-ink-soft"}`}
    >
      {isCommunity ? "community" : "seed archive"}
    </span>
  );
}

export function EraBadge({ era }: { era: string }) {
  return <span className="font-hand text-sm text-ink-soft">{era}</span>;
}
