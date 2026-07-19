import { notFound } from "next/navigation";
import { getPlace } from "@/lib/places";
import { ArchiveView } from "@/components/archive/ArchiveView";

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = getPlace(slug);
  if (!place) notFound();
  return <ArchiveView place={place} />;
}
