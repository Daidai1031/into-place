import type { Metadata } from "next";
import { Chelsea_Market, Inria_Sans, Freckle_Face } from "next/font/google";
import "./globals.css";

// Type system, applied site-wide:
//   Freckle Face    — display / page titles
//   Chelsea Market  — body / reading copy
//   Inria Sans      — microcopy / UI labels (bold for buttons)
// Exposed as CSS vars, wired into @theme tokens in globals.css.
const freckle = Freckle_Face({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-freckle",
  display: "swap",
});

const chelsea = Chelsea_Market({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-chelsea",
  display: "swap",
});

const inria = Inria_Sans({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-inria",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Into Place",
  description:
    "Step inside the layered stories of a place. Real archives, community memory, collage films.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${freckle.variable} ${chelsea.variable} ${inria.variable}`}
    >
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
