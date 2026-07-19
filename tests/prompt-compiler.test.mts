import assert from "node:assert/strict";
import test from "node:test";

import { compileFramePrompt, extractBeatTimePoints } from "../lib/prompt-compiler.ts";

const place = {
  name: "Roosevelt Island",
  region: "New York, USA",
  tagline: "A narrow island with a long memory.",
};

test("adds an explicit year from the storyboard as visible frame text", () => {
  const beat = {
    id: "beat_1",
    act: "Nellie Brown Enters",
    text: "The feather writes NELLIE BROWN, 1887, before the door closes.",
  };

  const prompt = compileFramePrompt({ place, beat });

  assert.deepEqual(extractBeatTimePoints(beat), ["1887"]);
  assert.match(prompt, /Visible time marker:[\s\S]*"1887"/);
  assert.match(prompt, /clearly legible text inside the frame/);
});

test("keeps multiple explicit time points in storyboard order", () => {
  const beat = {
    id: "beat_2",
    act: "From the 1850s to the present day",
    text: "The institution opened in the 1850s and the doorway becomes its present-day entrance.",
  };

  assert.deepEqual(extractBeatTimePoints(beat), ["1850s", "PRESENT DAY"]);
});

test("keeps circa years and date ranges as single labels", () => {
  const beat = {
    id: "beat_2b",
    act: "Archive",
    text: "A portrait from ca. 1890 opens a record spanning 1973–2021.",
  };

  assert.deepEqual(extractBeatTimePoints(beat), ["ca. 1890", "1973–2021"]);
});

test("does not request a time marker when the storyboard has none", () => {
  const prompt = compileFramePrompt({
    place,
    beat: {
      id: "beat_3",
      act: "Release",
      text: "The ink line crosses the river and reaches the city.",
    },
  });

  assert.doesNotMatch(prompt, /Visible time marker:/);
  assert.doesNotMatch(prompt, /date or time label/);
});
