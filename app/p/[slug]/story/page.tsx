import { notFound } from "next/navigation";
import { getPlace } from "@/lib/places";
import { getPreset } from "@/lib/presets";
import { StoryView } from "@/components/story/StoryView";

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = getPlace(slug);
  if (!place) notFound();
  return <StoryView place={place} preset={getPreset(slug)} />;
}
