import type { PlaceAsset } from "@/lib/types";
import { assetThumb } from "@/lib/types";
import type { StoryPreset } from "@/lib/presets";
import type { StoryBeat } from "@/lib/local-store";

const STAGES = [
  {
    number: "01",
    term: "STASIS",
    function: "The world as it is",
    explanation: "Establish the place, its rules and the quiet imbalance the audience has not yet questioned.",
    emotion: "unease",
    cue: "Set the world",
  },
  {
    number: "02",
    term: "PERIPETEIA",
    function: "A reversal of fortune",
    explanation: "An arrival, decision or discovery breaks the pattern and sends the story in a new direction.",
    emotion: "rupture",
    cue: "Introduce change",
  },
  {
    number: "03",
    term: "PATHOS",
    function: "The cost is felt",
    explanation: "Pressure, struggle and setbacks deepen. The consequences become personal and impossible to ignore.",
    emotion: "pressure",
    cue: "Make us feel it",
  },
  {
    number: "04",
    term: "ANAGNORISIS",
    function: "Recognition changes meaning",
    explanation: "A truth is finally seen. What felt isolated is revealed as part of a larger pattern.",
    emotion: "recognition",
    cue: "Reveal the pattern",
  },
  {
    number: "05",
    term: "KATHARSIS",
    function: "Emotion becomes meaning",
    explanation: "Tension releases through a changed future, a transformed understanding or a resonant final image.",
    emotion: "release",
    cue: "Leave an echo",
  },
] as const;

function referencesForStage({
  beat,
  index,
  preset,
  assets,
}: {
  beat?: StoryBeat;
  index: number;
  preset?: StoryPreset | null;
  assets: PlaceAsset[];
}) {
  const referenceIds = preset?.beats.find((item) => item.id === beat?.id)?.references;
  const referenced = referenceIds
    ?.map((id) => assets.find((asset) => asset.id === id))
    .filter((asset): asset is PlaceAsset => Boolean(asset && assetThumb(asset)));

  if (referenced?.length) return referenced.slice(0, 3);

  const withImages = assets.filter((asset) => assetThumb(asset));
  if (!withImages.length) return [];
  return [withImages[index % withImages.length], withImages[(index * 2 + 1) % withImages.length]]
    .filter((asset, assetIndex, list) => list.findIndex((item) => item.id === asset.id) === assetIndex)
    .slice(0, 3);
}

export function AristotelianArc({
  beats,
  preset,
  assets,
}: {
  beats: StoryBeat[];
  preset?: StoryPreset | null;
  assets: PlaceAsset[];
}) {
  const fiveBeats = beats.slice(0, 5);

  return (
    <section aria-labelledby="aristotelian-arc-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="font-typewriter text-[10px] uppercase tracking-[0.24em] text-stamp">
            Narrative anatomy / Aristotle&apos;s Poetics
          </p>
          <h2 id="aristotelian-arc-title" className="mt-1 text-4xl leading-tight sm:text-5xl">
            A story moves by changing what we feel.
          </h2>
          <p className="mt-3 max-w-2xl font-display text-base leading-relaxed text-ink-soft">
            Read from left to right. Each act gives the audience a different emotional job;
            the line traces that movement, while the archive fragments suggest how to make it visible.
          </p>
        </div>
        <div className="border-l border-ink/25 pl-4 font-hand text-sm leading-relaxed text-ink-soft">
          <span className="block text-stamp">hand-drawn line</span>
          emotional pressure over time
        </div>
      </div>

      <p className="mb-2 font-typewriter text-[10px] uppercase tracking-[0.18em] text-ink-soft md:hidden">
        Scroll to follow the story &rarr;
      </p>

      <div className="overflow-x-auto border-y border-ink/20 bg-[#eee7d8] shadow-[0_12px_30px_rgb(43_38_32/0.08)]">
        <div className="min-w-[1120px]">
          <div className="grid grid-cols-5">
            {STAGES.map((stage, index) => {
              const beat = fiveBeats[index];
              return (
                <article
                  key={stage.term}
                  className={`min-h-[292px] px-5 pb-5 pt-6 ${index ? "border-l border-dashed border-ink/25" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-typewriter text-[10px] tracking-[0.2em] text-stamp">
                        {stage.number} / {stage.cue}
                      </p>
                      <h3 className="mt-2 font-typewriter text-lg tracking-[0.04em]">{stage.term}</h3>
                    </div>
                    <span className="font-hand text-xl text-stamp/70">{index + 1}</span>
                  </div>
                  <p className="mt-2 font-display text-base italic text-ink">{stage.function}</p>
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">{stage.explanation}</p>
                  {beat && (
                    <div className="mt-4 border-t border-ink/15 pt-3">
                      <p className="font-typewriter text-[9px] uppercase tracking-[0.18em] text-ink-soft">Your beat</p>
                      <p className="mt-1 line-clamp-4 font-display text-sm leading-relaxed text-ink">{beat.text}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="relative h-[205px] border-y border-ink/10 bg-paper/45" aria-label="Emotional arc">
            <div className="absolute left-5 top-4 z-10 font-typewriter text-[9px] uppercase tracking-[0.2em] text-ink-soft">
              Emotional pressure
            </div>
            <svg
              className="absolute inset-x-0 bottom-0 h-[184px] w-full overflow-visible"
              viewBox="0 0 1400 205"
              preserveAspectRatio="none"
              role="img"
              aria-label="A hand-drawn emotional line moves from unease through rupture and pressure, rises at recognition, and resolves in release."
            >
              <defs>
                <filter id="story-line-rough" x="-2%" y="-8%" width="104%" height="116%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.01 0.12" numOctaves="2" seed="11" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" />
                </filter>
                <marker id="story-line-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#2b2620" />
                </marker>
              </defs>
              <path
                d="M 18 105 C 55 96, 96 74, 140 73 C 230 45, 330 85, 420 137 C 520 186, 620 184, 700 163 C 800 135, 880 50, 980 84 C 1040 104, 1075 195, 1140 160 C 1190 122, 1200 88, 1260 67 C 1320 52, 1360 46, 1380 42"
                fill="none"
                stroke="#2b2620"
                strokeWidth="1.45"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                filter="url(#story-line-rough)"
                markerEnd="url(#story-line-arrow)"
              />
              <path
                d="M 18 107 C 55 98, 96 76, 140 75 C 230 47, 330 87, 420 139 C 520 188, 620 186, 700 165 C 800 137, 880 52, 980 86 C 1040 106, 1075 197, 1140 162 C 1190 124, 1200 90, 1260 69 C 1320 54, 1360 48, 1380 44"
                fill="none"
                stroke="#2b2620"
                strokeWidth="0.55"
                strokeLinecap="round"
                opacity="0.45"
                vectorEffect="non-scaling-stroke"
              />
              {[
                [140, 73],
                [420, 137],
                [700, 163],
                [980, 84],
                [1260, 67],
              ].map(([x, y], index) => (
                <g key={STAGES[index].term}>
                  <circle cx={x} cy={y} r="7.5" fill="#a5432c" />
                  <circle cx={x} cy={y} r="11" fill="none" stroke="#a5432c" strokeWidth="0.75" opacity="0.35" />
                  <text x={x} y={Math.max(15, y - 18)} textAnchor="middle" fill="#5b5348" fontSize="10" fontFamily="var(--font-ui)" letterSpacing="1.5">
                    {STAGES[index].emotion.toUpperCase()}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="grid grid-cols-5">
            {STAGES.map((stage, index) => {
              const references = referencesForStage({ beat: fiveBeats[index], index, preset, assets });
              return (
                <div
                  key={stage.term}
                  className={`min-h-[154px] px-5 py-4 ${index ? "border-l border-dashed border-ink/25" : ""}`}
                >
                  <p className="font-typewriter text-[9px] uppercase tracking-[0.18em] text-stamp">Collage cues</p>
                  <div className="mt-3 flex items-end gap-2">
                    {references.map((asset, assetIndex) => {
                      const thumb = assetThumb(asset);
                      if (!thumb) return null;
                      return (
                        <div key={asset.id} className="group relative" style={{ transform: `rotate(${assetIndex % 2 ? 2 : -2}deg)` }}>
                          <img
                            src={thumb}
                            alt=""
                            className="h-14 w-14 border-2 border-[#faf6ec] object-cover shadow-[1px_2px_4px_rgb(43_38_32/0.25)] transition-transform group-hover:-translate-y-1"
                          />
                          <span className="sr-only">{asset.title}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 line-clamp-2 font-hand text-xs leading-snug text-ink-soft">
                    {references.length ? references.map((asset) => asset.title).join(" + ") : "Pair evidence with a visual metaphor."}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
