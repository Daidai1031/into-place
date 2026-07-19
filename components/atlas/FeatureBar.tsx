import Link from "next/link";
import type { ReactNode } from "react";

type Feature = {
  title: string;
  blurb: string;
  href: string;
  icon: ReactNode;
};

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const FEATURES: Feature[] = [
  {
    title: "Explore the Map",
    blurb: "Navigate places and uncover stories tied to country.",
    href: "/",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 6v14l5-2 6 2 5-2V4l-5 2-6-2-5 2Z" />
        <path d="M9 4v14M15 6v14" />
      </svg>
    ),
  },
  {
    title: "Browse Archives",
    blurb: "Photos, documents, audio and objects from the past.",
    href: "/p/roosevelt-island/archive",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 6h18v4H3zM5 10v10h14V10" />
        <path d="M9 14h6" />
      </svg>
    ),
  },
  {
    title: "Community Memory",
    blurb: "Contribute your story and connect with others.",
    href: "/",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M16 6a3 3 0 0 1 0 6M18 20a6 6 0 0 0-3-5.2" />
      </svg>
    ),
  },
  {
    title: "Collage Films",
    blurb: "Watch films woven from stories and place.",
    href: "/library",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      </svg>
    ),
  },
];

/** Dark four-column feature bar anchoring the page (Figma #15130F). */
export function FeatureBar() {
  return (
    <footer className="bg-footer text-paper">
      <div className="mx-auto max-w-[1440px] px-6 py-12 lg:px-16">
        <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <Link href={f.href} className="group block">
                <span className="text-paper/90">{f.icon}</span>
                <h3 className="mt-4 font-ui text-base font-bold tracking-tight text-paper">
                  {f.title}
                </h3>
                <p className="mt-2 max-w-[15rem] font-body text-sm leading-relaxed text-paper/60">
                  {f.blurb}
                </p>
                <svg
                  width="20"
                  height="12"
                  viewBox="0 0 20 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="mt-3 block text-orange transition-transform group-hover:translate-x-1"
                >
                  <path d="M1 6h16M12 1l5.5 5-5.5 5" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
