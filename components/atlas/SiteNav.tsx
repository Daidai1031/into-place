"use client";

import Link from "next/link";
import { useState } from "react";

const MENU_LINKS = [
  { label: "Explore the Map", href: "/" },
  { label: "Browse Archives", href: "/p/roosevelt-island/archive" },
  { label: "Collage Films", href: "/library" },
];

/**
 * Top navigation — 80px tall, wordmark left, a Menu disclosure right.
 * Matches the Figma frame's nav; the menu is a real accessible disclosure
 * so keyboard/screen-reader users reach the same destinations.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-40">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 lg:px-16"
      >
        <Link
          href="/"
          className="font-display text-2xl leading-none tracking-tight text-ink"
        >
          Into Place
        </Link>

        <div className="relative">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 font-ui text-sm text-ink transition-colors hover:text-orange"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden
            >
              <path d="M2 5h14M2 9h14M2 13h14" strokeLinecap="round" />
            </svg>
            Menu
          </button>

          {open && (
            <ul
              id="site-menu"
              className="absolute right-0 top-full z-50 mt-2 min-w-[200px] border border-ink/10 bg-card py-2 shadow-[0_8px_24px_rgb(30_26_22/0.16)]"
            >
              {MENU_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 font-ui text-sm text-ink-soft transition-colors hover:bg-paper-deep/60 hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>
    </header>
  );
}
