import { PaperCard } from "@/components/ui/PaperCard";

/** Reserved slot: audio memories join the archive in a later release. */
export function AudioSlotCard() {
  return (
    <PaperCard seed={2} rotate={1.2} className="w-60 p-3 opacity-60">
      <div className="flex h-36 flex-col items-center justify-center gap-2 border-2 border-dashed border-ink/20 bg-paper-deep/20 text-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"
            fill="currentColor"
            className="text-ink-soft"
          />
        </svg>
        <span className="font-typewriter text-[10px] uppercase tracking-widest text-ink-soft">
          Audio memories
        </span>
      </div>
      <p className="mt-2 font-hand text-sm text-ink-soft">
        Oral histories and street sounds — coming soon.
      </p>
    </PaperCard>
  );
}
