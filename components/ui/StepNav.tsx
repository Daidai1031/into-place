"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STEPS = [
  { slug: "archive", label: "Archive" },
  { slug: "story", label: "Story" },
  { slug: "storyboard", label: "Storyboard" },
  { slug: "film", label: "Film" },
];

/** Workflow breadcrumb: Archive → Story → Storyboard → Film. */
export function StepNav({ placeSlug }: { placeSlug: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 font-typewriter text-xs uppercase tracking-widest">
      {STEPS.map((step, i) => {
        const href = `/p/${placeSlug}/${step.slug}`;
        const active = pathname?.startsWith(href);
        return (
          <span key={step.slug} className="flex items-center gap-1">
            {i > 0 && <span className="text-ink/30">→</span>}
            <Link
              href={href}
              className={`px-2 py-1 transition-colors ${
                active
                  ? "bg-ink text-paper"
                  : "text-ink-soft hover:bg-paper-deep hover:text-ink"
              }`}
            >
              {i + 1}. {step.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
