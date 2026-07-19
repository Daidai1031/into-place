import { notFound } from "next/navigation";
import { getPlace } from "@/lib/places";
import { StoryView } from "@/components/story/StoryView";

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = getPlace(slug);
  if (!place) notFound();
  return <StoryView place={place} />;
}
