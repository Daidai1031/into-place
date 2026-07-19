import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Into Place",
  description:
    "Step inside the layered stories of a place. Real archives, community memory, collage films.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
