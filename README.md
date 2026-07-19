# Into Place

> **Step inside the layered stories of a place.**
>
> The place determines the film. The user directs the journey.

Into Place is an AI co-creation video platform that starts from the real archives of a place. Users enter a location from a map, curate sourced historical materials, and can also contribute their own photos; then they choose a story direction, revise the narrative beats, direct each storyboard frame, and develop them into a creative short film about the place with a handcrafted collage texture.

**Track:** fal × Sequoia 72-Hour Video Hackathon — Developer Track

**First case:** Roosevelt Island（Blackwell's → Welfare → Roosevelt）

**Developer:** Solo developer + AI coding agents（Claude Code / Codex）

---

## Why build Into Place

General-purpose AI video tools tend to generate similar imagery for different places: fictional buildings, a uniform retro filter, and an untraceable "sense of history". Into Place takes four different principles:

- **Real archives first:** Historical photos, maps, and documents must retain their source, era, and license information.
- **Shared memory of a place:** Users can upload personal photos and choose whether to contribute them, with attribution, to the place's public archive.
- **Human-machine co-direction:** Users control the materials, story direction, every beat, storyboard frame, and transition, rather than entering a prompt just once.
- **Generated content is recognizable:** AI storyboards are always marked as generated content and never confused with the original archives; the final Journey Book records the materials used and the generative actions taken.

## Current status

| Module | Status | Current Implementation |
|---|---|---|
| Atlas | ✅ Done | Collage map, Roosevelt Island seed location, Shaxi / Camino co-creation entry points pending |
| Archive | ✅ Done | 20 archive records, 19 published layers, asset filtering, tone / edge adjustment, user upload and simulated review |
| Story | ✅ Done | Generate 3 story directions from the selected archives, and generate, edit, rewrite, or insert 5–8 narrative beats |
| Storyboard | ✅ Done | Each beat can choose an AI-generated frame or manual collage; supports reference assets, text edits, dragged-in assets, and transition notes |
| Per-shot video generation | ✅ Wired up locally | The Web client submits fal queue per shot, polls status, and previews immediately after each shot completes; supports Kling / Happy Horse / Veo 3.1 |
| Film / Journey Book | ✅ Wired up locally | Generate shots in order, display the actual model / prompt / estimated cost, invoke FFmpeg to assemble, save the film, and list sources and licenses |
| Sound | ✅ Wired up locally | I2V stays muted; the Film page has equal-level toggles for a Lyria 2 background score and LLM-written, Kokoro-voiced narration based on the user's current Story map, then mixes the selected layers with FFmpeg |
| Real-time archive retrieval | ⏳ To be implemented | Currently uses the Roosevelt Island pre-curated bundle; the Wikimedia real-time retrieval API is still a stub |

## End-to-end workflow

Shortest version: **archive materials → user curation → LLM writes the story → image model makes storyboards → user confirms → I2V model animates each shot → FFmpeg assembly → Film + Journey Book**. The system does not let a single model generate an entire film directly; the structured output of each step is the input to the next, and it waits for user choice or confirmation at key points.

```text
Place + archive metadata
  → [User] must use / maybe / reject + upload assets
  → [Claude Sonnet 4.5 via fal any-llm] 3 directions
  → [User] selects a direction
  → [Claude Sonnet 4.5 via fal any-llm] 5–8 beats
  → [User] edit / reroll / insert beat
  → [Image model] 16:9 frame for each beat, or [Manual] real-PNG collage
  → [User] edits the frame + confirms the transition
  → [Kling / Happy Horse / Veo 3.1] each confirmed frame → one I2V clip
  → [FFmpeg, no model] clips + transitions → final/<slug>.mp4
  → [Optional, user-confirmed] Lyria score and/or Story-map narration → Kokoro TTS → FFmpeg audio mix
  → Final Film + Journey Book
```

### What model each step uses, and its input / output

The table below reflects the current code. `endpoint` is the fal API path; the "model" is the model actually selected within the endpoint. All fal calls happen only in server routes or local scripts, and `FAL_KEY` never enters the browser.

| # | Stage | Model / Endpoint | Main Input | Main Output | How It Is Used Next |
|---|---|---|---|---|---|
| 0 | Archive preprocessing (offline) | **SAM 3** · `fal-ai/sam-3/image`; local `rembg:silueta` on failure; Sharp for cropping and compositing | Raw archive image, the subject prompt in the recipe, `apply_mask:false`, mask QA thresholds | Subject alpha mask, box / score; finally generates `*_card.png` / `*_cutout.png` / `*_bg.png` locally, plus a provenance JSON | Only PNGs that pass manual visual review enter the location manifest and the Archive asset shelf |
| 1 | Asset curation | **No model** | place JSON, archive metadata, user uploads; the user gives `must use / maybe / reject` | The selected `AssetBrief[]`: `id/title/era/type/description/contributor` | Serves as the factual boundary for the narrative LLM, and as the reference set for the subsequent image model |
| 2a | Generate story directions | **Claude Sonnet 4.5** · `fal-ai/any-llm` + `model=anthropic/claude-sonnet-4.5` | `PlaceBrief` + the user-curated `AssetBrief[]` | Strict JSON: 3 `{id,title,premise}` + `requestId` | The user selects one of the directions |
| 2b | Generate story beats | Same as above | `PlaceBrief` + `AssetBrief[]` + the chosen `{title,premise}` | Strict JSON: 5–8 `{id,act,text}` + `requestId` | Each beat corresponds to one storyboard and, finally, one video shot |
| 2c | Rewrite / insert beat | Same as above | Location, all assets, current beats, `targetId`, `reroll` or `insert_after` | A single `{act,text}` + `requestId` | Replaces the target beat or is inserted after it; the user can still edit it manually |
| 3a | AI-generated storyboard | Default **nano-banana 2 / Gemini 3.1 Flash Image** · `fal-ai/nano-banana-2/edit`; optionally FLUX.2 Pro, Seedream 4, Imagen 4 | The compiled frame prompt (place + premise + beat + style constraints) + a reference contact sheet of up to 7 source images; the same source asset is used in at most 2 scenes; fixed 16:9, 1 image | `{imageUrl,model,prompt,requestId,costUsd,source:"generated"}` | The user can regenerate, edit in natural language, or drag in a new archive; the confirmed `imageUrl` becomes the I2V first frame |
| 3b | Manual collage auto-layout | **nano-banana edit** · `fal-ai/nano-banana/edit` first generates a temporary composition reference; then **Claude Sonnet 4.5 Vision** · `fal-ai/any-llm/vision` | Beat text, a numbered cutout contact sheet, asset id / role / aspect ratio; Vision sees both the contact sheet and the temporary composition | `{layout:[{assetId,x,y,scale,rotation,z}],referenceUrl,requestIds,source}` | The Canvas arranges the **real, reviewed PNGs** according to the JSON; the temporary AI composition is only a reference and does not enter the final film |
| 3c | Transition suggestion | **Claude Sonnet 4.5** · `fal-ai/any-llm` | Adjacent `fromBeat`, `toBeat` | `{type,note}`, where type is `page_turn/wipe/match_cut/push_dissolve` | The user can edit it; it maps to an FFmpeg xfade during assembly |
| 4 | Per-shot image-to-video | Default **Kling v3 Turbo Standard** · `fal-ai/kling-video/v3/turbo/standard/image-to-video`; optionally Alibaba Happy Horse, Veo 3.1 | The confirmed generated `frameUrl` + the compiled motion prompt + duration; Kling / Veo force `generate_audio:false` | The queue submit returns `requestId`; after polling completes, you get `videoUrl` | The browser generates shots sequentially and previews immediately; assembly begins once all clips are done |
| 5 | Final assembly | **No generative model, FFmpeg** | `{videoUrl,transitionType}[]` in beat order | Normalized to 1280×720 / 30fps, unified color grade, 0.7s xfade, fade-out at the end; outputs `final/<slug>.mp4` and `/films/<slug>.mp4` | The Film page plays it; the Journey Book shows the story, sources, and generation records |
| 6 | Optional soundtrack | **Lyria 2** · `fal-ai/lyria2`; narration writer via **Claude Sonnet 4.5** · `fal-ai/any-llm`; voice via **Kokoro** · `fal-ai/kokoro/american-english`; FFmpeg | The current silent master plus the user's selected Background music / Narration toggles; narration receives the current direction, premise, and ordered Story beats | Selected music and/or concise spoken narration mixed into the current film; job status is polled through `/api/audio/status` | The Film player refreshes to the new mix and displays the generated narration text when complete |

> The current real I2V Web flow only handles storyboards with `source:"generated"`. Manual collage can be used for storyboarding and project saving, but is not yet automatically rasterized on the Film page into a first frame that can be submitted to I2V. Film assembly is silent by default; the Film page can add the optional soundtrack afterward in the local pipeline.

### Model routing and selection rules

#### Narrative and transitions

Story direction, beats, single-beat rewrite / insert, and transition suggestions are all invoked via `fal-ai/any-llm` calling `anthropic/claude-sonnet-4.5`. The input is not the entire raw file, but the location summary and the structured metadata of the user's selected archives; the output is required to be strict JSON, and is only written to project state after the server parses it.

#### Storyboard image models

| UI Key | fal Endpoint | Reference Image | Supports Editing | Purpose / Routing Rule |
|---|---|---:|---:|---|
| `nano-banana-2` (default) | `fal-ai/nano-banana-2/edit` | ✅ | ✅ | Available for initial storyboarding, natural-language edits, and dragged-in assets |
| `flux-2-pro` | `fal-ai/flux-2-pro` | ✅ | ❌ | Can generate 1280×720 storyboards; automatically switches back to nano-banana 2 when entering edit mode |
| `seedream-4` | `fal-ai/bytedance/seedream/v4/text-to-image` | ❌ | ❌ | Prompt-only generation; does not receive a reference contact sheet |
| `imagen-4` | `fal-ai/imagen4/preview` | ❌ | ❌ | Prompt-only generation; does not receive a reference contact sheet |

The `generate` mode composites the reference cutouts into a contact sheet and uploads it; `edit_prompt` inputs the current frame + the user instruction; `edit_add_asset` inputs the current frame + the new cutout + the drop position. All three modes return one 16:9 frame. Without a `FAL_KEY`, when running on Vercel, or when the model fails, the route returns an SVG placeholder explicitly labeled `AI-GENERATED FRAME — simulated`, and does not pass itself off as a real generation result.

#### I2V video models

| UI Key | fal Endpoint | Available Durations | Current Rule |
|---|---|---|---|
| `kling-v3-turbo-std` (default) | `fal-ai/kling-video/v3/turbo/standard/image-to-video` | 5s / 10s | The default balanced option; the input field is `image_url`, and model audio is disabled |
| `happy-horse` | `alibaba/happy-horse/image-to-video` | 3–8s in the Web UI; the route supports 3–15s | Currently fixed at 720p; the input field is `image_url` |
| `veo3.1-hero` | `fal-ai/veo3.1/image-to-video` | 4s / 6s / 8s | hero-only; requires explicit cost confirmation, and model audio is disabled |

Each I2V request generates only **one clip for one beat**. `/api/shot/generate` handles compiling the motion prompt, pricing, and the queue submit; `/api/shot/status` handles polling and returning `videoUrl`. This makes it possible to redo just one shot when it fails or is unsatisfactory, without overturning the entire film.

### How the key data objects are passed downward

```text
AssetBrief[]
  { id, title, era, type, description?, contributor? }
       ↓ narrative LLM
StoryDirection
  { id, title, premise }
       ↓ narrative LLM
StoryBeat[]
  { id, act, text }
       ↓ image model + user review
GeneratedFrame
  { imageUrl, model, prompt, requestId, costUsd, source }
       ↓ I2V queue
Shot
  { beatId, frameUrl, motionPrompt, model, requestId, videoUrl }
       ↓ FFmpeg
Film
  { filmUrl, clips }
```

The project's interaction state is held primarily in the browser's `localStorage`; the local environment also mirrors it to `data/project.json`. `/api/generate/start` additionally generates `data/scenes/generated/<slug>/film-manifest.json`, recording each beat's frame, model, motion prompt, and transition, for reuse by script-based rendering.

Core implementation entry points: Story uses `app/api/story/generate` and `app/api/story/reroll`; storyboarding uses `app/api/storyboard/frame` and `app/api/storyboard/layout`; I2V uses `app/api/shot/generate` and `app/api/shot/status`; final assembly uses `app/api/assemble`. The model registry is in `lib/models.ts`, the fal client is in `lib/fal-server.ts`, and all generation prompts are centralized in `lib/llm.ts` and `lib/prompt-compiler.ts`.

### Prompt compilation and archive protection

`lib/llm.ts` handles compiling narrative prompts, and `lib/prompt-compiler.ts` uniformly compiles frame, edit, and motion prompts. The I2V prompt restricts motion to one primary camera movement and one subject / environment movement, and appends a protection block:

```text
no morphing, no new objects, no face changes, no costume changes,
no architecture changes, preserve printed text, preserve collage layout
```

SAM 3 only decides the alpha mask (`apply_mask:false`); cropping, color grading, white borders, shadows, and alpha compositing are all done locally by Sharp. Generated frames and I2V clips are always marked as AI-generated, while the final Manual collage canvas uses only reviewed, real PNGs.

### Real runtime and fallback branches

| Environment | Story | Frame | I2V | Assembly |
|---|---|---|---|---|
| Local + `FAL_KEY` + FFmpeg | Real LLM | Real image model | Real queue submit + polling | Writes to `final/` and `public/films/` |
| Local but no `FAL_KEY` | Cannot initiate new LLM generation; can continue using a saved / seed story | Labeled placeholder; manual collage available | Does not submit tasks | Plays an existing pre-rendered film (if present) |
| Vercel | Can call the LLM when `FAL_KEY` is configured | Always uses a labeled placeholder / manual collage | Does not submit tasks | Plays the pre-rendered demo; does not write files |

Real-time Wikimedia retrieval (`/api/research`) and Place DNA (`/api/dna`) are currently still stubs that explicitly return 501, and are not part of the production workflow above.

## Asset preprocessing v2

Roosevelt Island's preprocessing is driven by the declarative recipe in `data/preprocess/roosevelt-island.json`:

- Historical materials use neutral black-and-white by default, while modern photos keep their original color; paper cards use a stable torn-paper edge, and transparent subjects use a scissor edge.
- fal SAM 3 only generates the subject mask (`apply_mask: false`); cropping, color grading, alpha compositing, white borders, and shadows are all done deterministically in local, and the raw RGB is not handed to the model to repaint.
- Enlarging the original image is forbidden during processing; low-resolution materials only record a quality warning and limit the usage size.
- Outputs use explicit role suffixes: `*_card.png`, `*_cutout.png`, `*_bg.png`.
- source review and visual review are recorded separately; outputs that do not pass visual review do not enter the manifest or scenes.
- `asset_013` is a PDF awaiting manual page selection and is currently explicitly skipped; `asset_020` is a reference video used only for historical context and does not enter the film's asset selection.

## Roosevelt Island story research

The current case has developed two main narrative directions; for the complete five-shot structure, narration, and historical framing, see [`spec/06-place-case.md`](spec/06-place-case.md).

| Direction | Protagonist / Visual Motif | Core Question |
|---|---|---|
| **The Island New York Used Twice** | A paper boat folded from a New York planning map | How does a city decide what to hide, and what to choose to show? |
| **The Women Who Crossed the Water** | A quill that becomes Nellie Bly's pen and a continuous ink line | Who holds the power to label women as "dangerous", and how does a voice cross the walls? |

Both directions use a five-part structure (Stasis → Peripeteia → Pathos → Anagnorisis → Katharsis), but the Narrative Agent in the product does not lock into the case script: it proposes 3 directions and 5–8 editable beats based on the archives the user actually selects.

## Tech stack

- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4
- fal: a unified generation layer for LLM, vision, image generation / editing, SAM 3, and image-to-video
- Sharp: local cropping, color grading, alpha, paper-edge processing, and the static-first-frame compositing for manual collage
- FFmpeg: video shot normalization, unified color grading, transition stitching, end fade-out, and the optional Web-triggered foley/music mix in the local flow
- localStorage: browser-side project state; JSON files are used to mirror the local I2V / assembly flow

## Running locally

### Requirements

- Node.js 20+
- npm
- Optional: a fal API key (you can also use simulated frames and manual collage without a key)
- FFmpeg / ffprobe are required for final film assembly
- Python rembg is only required when the SAM mask is unavailable and preprocessing needs a local cutout fallback

### Launch the app

```bash
npm install
```

For real AI calls, create `.env.local` in the root directory:

```bash
FAL_KEY=your_fal_key
```

Then start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Sync public assets and start the Next.js development server |
| `npm run build` | Sync public assets and build the production version |
| `npm run preprocess` | Batch-preprocess archive materials according to the recipe |
| `npm run preprocess:review` | Generate a preprocessing contact sheet for manual review |
| `npm run test:preprocess` | Run the preprocessing tests |
| `npm run experiment -- <args>` | Run fal video model experiments |

For the full arguments of the preprocessing and I2V experiment scripts, see [`scripts/README.md`](scripts/README.md).

## Project structure

```text
app/                    Next.js pages and server routes
components/             Atlas / Archive / Story / Storyboard / Film UI
lib/                    State, model configuration, LLM, and prompt compilation
data/places/            Place and archive metadata
data/preprocess/        Recipes, masks, provenance, and review records
assets/archive/         Original archive files
assets/cutouts/         Reviewed and published card / cutout / background layers
scripts/                Preprocessing, sync, and fal I2V experiment tools
spec/                   Product, data, API, generation, and case specifications
```

## Documentation index

- [`spec/00-index.md`](spec/00-index.md) — Implementation spec entry point
- [`spec/01-data-model.md`](spec/01-data-model.md) — Project / Place / Asset / Scene / Shot data structures
- [`spec/02-ui-pages.md`](spec/02-ui-pages.md) — Page and interaction specs
- [`spec/03-api.md`](spec/03-api.md) — Server routes and security conventions
- [`spec/04-shot-router.md`](spec/04-shot-router.md) — Shot routing and prompt compilation rules
- [`spec/05-assets-audio-files.md`](spec/05-assets-audio-files.md) — Asset, audio, and file conventions
- [`spec/06-place-case.md`](spec/06-place-case.md) — Roosevelt Island case study
- [`PLAN.md`](PLAN.md) — Feature list, verification gates, and risk register
- [`CLAUDE.md`](CLAUDE.md) — AI coding agent engineering conventions

---

**Into Place does not ask AI to invent a place. It asks people and archives how that place should be remembered.**
