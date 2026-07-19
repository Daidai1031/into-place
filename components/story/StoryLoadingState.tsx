"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  "Reading the archive…",
  "Listening to the place…",
  "Following the stone from quarry to wall…",
  "Writing in the margins…",
];

export function StoryLoadingState({ label }: { label?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % PHRASES.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center gap-3 py-16">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((d) => (
          <span
            key={d}
            className="h-2 w-2 animate-bounce rounded-full bg-ink-soft"
            style={{ animationDelay: `${d * 0.15}s` }}
          />
        ))}
      </div>
      <p className="font-hand text-xl text-ink-soft">{label ?? PHRASES[i]}</p>
    </div>
  );
}
