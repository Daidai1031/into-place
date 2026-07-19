import { notFound } from "next/navigation";
import { getPlace } from "@/lib/places";
import { FilmView } from "@/components/film/FilmView";

export default async function FilmPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = getPlace(slug);
  if (!place) notFound();
  return <FilmView place={place} />;
}
