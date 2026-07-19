# 04 · Frame-to-video Router and Prompt Compilation

## Main path

Each beat first produces a user-approved 16:9 frame, then generates video:

```text
generated frame ─┐
                 ├→ approved start frame → prompt compiler → fal I2V queue → shot review
manual collage ──┘  (export PNG first)
```

We no longer maintain a standalone layered video renderer or headless-browser frame-capture fallback. The archival pixel fidelity of a manual collage happens during the static first-frame export stage; video output must be clearly marked as AI-generated.

## Frame routing

| frame source | input | processing before entering I2V |
|---|---|---|
| `generated` | fal-hosted `BeatFrame.imageUrl` | validate 16:9, review status, references and provenance |
| `manual_collage` | `BeatLayout.items` + brush overlay | browser Canvas exports a 1280×720 PNG; use server-side Sharp compositing when hitting CORS / stability issues |
| `placeholder` | SVG/data URL with a mock label | only allowed for demo preview; must not be submitted to paid I2V or passed off as a real shot |

## I2V model routing

Candidate models may only come from `lib/models.ts`. Endpoints and prices are volatile information; the schema and current-day price must be re-verified before the first paid call.

| purpose | default candidate | rule |
|---|---|---|
| normal shot | `kling-v3-turbo-std` | balances quality and cost, takes one start frame |
| budget comparison | `happy-horse` | use only after schema / price re-verification |
| Hero shot | `veo3.1-hero` | selectable only with an explicit hero flag, confirm manually before calling |

All tasks use queue submit + polling; must not synchronously wait for long video generation within an HTTP request. Each shot gets at most 3 attempts; on failure the frame, motion, or prompt must be modified.

Implementation: in-app goes through `/api/shot/generate` (submit) + `/api/shot/status` (poll); full-film assembly goes through the local `scripts/render-film.mts` (reads `data/scenes/generated/<slug>/film-manifest.json` → per-shot I2V → FFmpeg xfade → `final/<slug>.mp4`), a paid run requires `--yes`, hero / over $5 requires `--confirm`. Frames from a `placeholder` source are skipped and not submitted to paid I2V.

## Prompt compilation (`lib/prompt-compiler.ts`)

The prompt is compiled from the place, film premise, beat, frame references, and motion structure; free text is not concatenated in the route or UI:

1. scene intent: what the audience sees in the current beat;
2. camera: at most one primary camera movement;
3. subject / environment motion: at most one primary movement, described in a separate clause from the camera;
4. style: `handmade archival collage, paper cutout, stop-motion feeling`;
5. preservation: `no morphing, no new objects, no face changes, no costume changes, no architecture changes, preserve printed text, preserve collage layout`;
6. audio: `Diegetic sounds only. No music. No dialogue. No subtitles.`.

The preservation constraints prevent identity, material, architecture, and text from being rewritten, but do not forbid pose or positional movement that the user explicitly requests.

## Transitions

Normal transitions are done by FFmpeg after shot generation:

| type | post-production implementation |
|---|---|
| `cut` | direct cut |
| `crossfade` / `push_dissolve` | video crossfade |
| `wipe` | FFmpeg wipe transition |
| `page_turn` | prefer a simplified wipe / overlay to simulate a page turning |
| `match_cut` | align composition first in the Storyboard stage, then a direct cut or short crossfade in post |
| `custom` | save the user's note, confirm the implementation manually before assembly |

Generative transitions are not the default path. Only when ordinary post-production cannot express a necessary narrative movement do we separately evaluate an FLF model.

## Assembly post-production (FFmpeg, `xfadeConcat` in `lib/film-assemble.ts`)

Concatenation and unified post-production happen together; `/api/assemble` and `scripts/render-film.mts` share one piece of logic:

- **Unified grading**: the 5 separately generated shots all get the same `GRADE` (a shared grade, not per-shot histogram matching) before concatenation, keeping the whole film consistent—muted blue-gray shadows + warm sepia midtones, brightening and lifting the black point to counter the dark bias of i2v output (`eq brightness` + `curves 0/0.05` to lift blacks, `1/0.97` to protect highlights, `saturation 0.85` to desaturate). It is a single tunable constant; adjust dark/gray bias here in one place.
- **Ending fade-out**: at the end of the assembled timeline, `fadeOutDur` (default 1.0s) fades to black.
- Currently **no audio track** (i2v `generate_audio:false`, and assembly does not map audio either); narration / ambient sound is deferred to a separate later pass.

## Review and traceability

Each shot must save:

- beat ID, start frame URL / hash, and reference asset IDs;
- the compiled prompt, model, parameters, request ID, estimated and actual cost;
- attempt count, status, output URL;
- manual review result and failure reason.

Review focus: faces, architectural structure, printed text, collage layout, unexpected new objects, and source labeling. Shots that fail review cannot enter the final assembly.

## Budget discipline

- Confirm first when a single estimated cost exceeds $5, uses a hero model, or when cumulative cost is abnormal.
- When a price cannot be converted to US dollars, do not call automatically.
- Stop generating and analyze the cause after 3 attempts per shot.
- When the demo has no real-time generation result, play a clearly labeled pre-rendered film.
