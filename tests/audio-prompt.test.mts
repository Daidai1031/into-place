import assert from "node:assert/strict";
import test from "node:test";

import { compileNarrationWriterPrompt } from "../lib/prompt-compiler.ts";

test("narration writer prompt is grounded in the ordered Story map", () => {
  const prompt = compileNarrationWriterPrompt({
    place: { name: "Roosevelt Island", region: "New York, USA" },
    direction: {
      title: "The Women Who Crossed the Water",
      premise: "The island held their bodies, but not their voices.",
    },
    beats: [
      { act: "Stasis", text: "Women enter the island's records without names." },
      { act: "Recognition", text: "Nellie Bly carries evidence back across the river." },
    ],
    durationSeconds: 27.1,
  });

  assert.match(prompt, /1\. \(Stasis\).*2\. \(Recognition\)/s);
  assert.match(prompt, /about 45 words total/);
  assert.match(prompt, /Use only facts and ideas present|Include dates only when they appear/);
  assert.match(prompt, /JSON schema: \{"text":"the complete narration"\}/);
});

test("narration target stays within short-film bounds", () => {
  const short = compileNarrationWriterPrompt({
    place: { name: "A", region: "B" },
    beats: [{ act: "One", text: "A story." }],
    durationSeconds: 10,
  });
  const long = compileNarrationWriterPrompt({
    place: { name: "A", region: "B" },
    beats: [{ act: "One", text: "A story." }],
    durationSeconds: 120,
  });

  assert.match(short, /about 35 words total/);
  assert.match(long, /about 65 words total/);
});
