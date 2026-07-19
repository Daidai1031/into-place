"use client";

import type { UserUpload } from "@/lib/local-store";
import { PaperCard } from "@/components/ui/PaperCard";
import { Stamp } from "@/components/ui/Stamp";
import { ContributorBadge, EraBadge } from "@/components/ui/Badges";
import type { ReactNode } from "react";

const STAGE_LABEL: Record<UserUpload["moderation"], string> = {
  uploading: "Uploading…",
  pending: "Pending review",
  checking: "Checking source & rights",
  approved: "Approved",
};

/** A community upload on the timeline, with its simulated review pass. */
export function UploadCard({
  upload,
  index = 0,
  footer,
}: {
  upload: UserUpload;
  index?: number;
  footer?: ReactNode;
}) {
  const approved = upload.moderation === "approved";
  return (
    <PaperCard seed={index + 1} rotate={index % 2 ? 1.4 : -1.2} className="w-60 p-3">
      <div className="relative flex h-36 items-center justify-center overflow-hidden bg-paper-deep/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={upload.dataUrl}
          alt={upload.title}
          className={`max-h-full max-w-full object-contain transition-all duration-500 ${approved ? "" : "opacity-60 grayscale"}`}
        />
        <div className="absolute inset-x-0 bottom-1 flex justify-center">
          {approved ? (
            <Stamp text="Approved" color="accent" animate />
          ) : (
            <span className="bg-ink/80 px-2 py-0.5 font-typewriter text-[10px] uppercase tracking-widest text-paper">
              {STAGE_LABEL[upload.moderation]}
              <span className="animate-pulse">…</span>
            </span>
          )}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 font-display text-sm leading-snug">{upload.title}</p>
      {upload.description && (
        <p className="mt-1 line-clamp-2 font-hand text-sm text-ink-soft">{upload.description}</p>
      )}
      <div className="mt-1 flex items-center justify-between">
        <EraBadge era={upload.era} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <ContributorBadge contributor="user" />
        {upload.shareToPlace && (
          <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 font-typewriter text-[10px] uppercase tracking-wider text-accent">
            shared to archive
          </span>
        )}
      </div>
      {approved && footer}
    </PaperCard>
  );
}
