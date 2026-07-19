import type { ReactNode } from "react";

/**
 * Horizontal timeline: a hand-drawn rail across the top, one era column per
 * bucket. Bucketed columns, not a proportional year scale — archival data has
 * decade-wide gaps that would wreck a pixel-per-year axis.
 */
export function TimelineRail({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-x-auto pb-6">
      <div className="relative flex min-w-max gap-10 px-8 pt-2">
        {/* rail line */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-[38px] h-[3px] bg-ink/60"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 2px, rgb(243 236 221 / 0.6) 2px 3px)",
          }}
        />
        {children}
      </div>
    </div>
  );
}

export function TimelineEraColumn({
  label,
  children,
  accent = false,
}: {
  label: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center gap-5">
      <div className="flex flex-col items-center">
        <span
          className={`font-hand text-xl leading-none ${accent ? "text-stamp" : "text-ink"}`}
        >
          {label}
        </span>
        {/* tick */}
        <span aria-hidden className="mt-1 h-4 w-[3px] bg-ink/60" />
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
