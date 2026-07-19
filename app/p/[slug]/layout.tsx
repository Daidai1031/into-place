import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlace } from "@/lib/places";
import { StepNav } from "@/components/ui/StepNav";

export default async function PlaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = getPlace(slug);
  if (!place) notFound();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/95 px-6 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="font-hand text-sm text-ink-soft hover:text-stamp">
              ← Atlas
            </Link>
            <h1 className="text-2xl leading-none">{place.name}</h1>
            <span className="hidden font-typewriter text-xs text-ink-soft sm:inline">
              {place.region}
            </span>
          </div>
          <StepNav placeSlug={slug} />
        </div>
      </header>
      {children}
    </div>
  );
}
