import { notFound } from "next/navigation";
import { getPlace } from "@/lib/places";
import { StoryboardView } from "@/components/storyboard/StoryboardView";

export default async function StoryboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = getPlace(slug);
  if (!place) notFound();
  return <StoryboardView place={place} />;
}
