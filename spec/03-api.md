# 03 · API Routes (Synced with Implementation on 2026-07-19)

All routes are server-side. `FAL_KEY` exists only in environment variables and never enters the client bundle, logs, or git (verify by grepping `.next/static` after every build). Video tasks always use a queue (submit + polling), with no webhooks.

**Environment split**: `lib/capabilities.ts` determines `isLocal / canRunPipeline / canWriteFs` using `!process.env.VERCEL`; `GET /api/capabilities` exposes booleans only. Vercel is currently treated as a simulated / read-only demo environment, while local development can write the project mirror. **localStorage is the sole source of truth for user state** (asset selection / parameter tuning / uploads / story / frames / layouts / film library); `data/project.json` is only a local mirror consumed by the I2V and assembly pipeline.

## Implemented

| Route | Purpose | Vercel Behavior |
|---|---|---|
| `GET  /api/places` | Map data: slug / status / marker / tagline for every place | Same as local |
| `GET  /api/place/[slug]` | Complete archive for one place | Same as local |
| `GET  /api/capabilities` | Environment capability booleans (no secrets) | Same as local |
| `POST /api/preprocess` | Record the tone / edge override for one asset | Locally writes `data/preprocess/overrides.json`; online it echoes the input (the CSS preview is the experience) |
| `POST /api/story/generate` | `phase=directions`: 3 story directions; `phase=beats`: 5–8 beats (fal `any-llm`, `anthropic/claude-sonnet-4.5`, $0.001–0.01/request) | Same as local (serverless text calls work) |
| `POST /api/story/reroll` | Rewrite one beat (`mode=reroll`) or insert a new beat (`mode=insert_after`) | Same as local |
| `POST /api/storyboard/layout` | Layout: client contact sheet → `nano-banana/edit` reference image ($0.0398/image, for reference only, collapsed display, clearly labeled) → `any-llm/vision` layout JSON → sanitize. Any failure falls back to deterministic layout in `lib/layout-fallback.ts` | Same as local |
| `POST /api/storyboard/frame` | **Generative main path**: generate or edit one 16:9 storyboard frame; `generate / edit_add_asset / edit_prompt`. The prompt is compiled by `lib/prompt-compiler.ts`; archival cutouts are reference images; T2I choices come from `T2I_MODELS` in `lib/models.ts` (`nano-banana-2` default / `flux-2-pro`). Returns prompt / model / requestId / cost / source | Without `FAL_KEY` / online, returns a clearly labeled simulated frame and never blocks |
| `POST /api/shot/generate` | **Implemented**: queue-submit an image-to-video shot; approved frame as first frame + `compileMotionPrompt`; `I2V_MODELS` (`kling-v3-turbo-std` default / `happy-horse` / `veo3.1-hero`). An estimate over $5 or a hero model requires `confirmed:true`; otherwise returns `needs_confirmation` | Runs for real locally; returns simulated online |
| `GET  /api/shot/status` | **Implemented**: polls the fal queue with `?endpointId=&requestId=` and returns `videoUrl` when COMPLETED | Runs for real locally; returns done online |
| `POST /api/transition/suggest` | Transition type + one-sentence intent between adjacent beats (LLM) | Same as local |
| `POST /api/generate/start` | Returns the preview progress-step plan + pre-rendered filmUrl; does not synchronously submit I2V (see `scripts/render-film.mts`) | Locally also atomically writes `data/project.json` + `data/scenes/generated/<slug>/film-manifest.json` (frame URL + compiled motion prompt + transition for every beat); online it returns only the pre-rendered film URL |
| `POST /api/project/save` | Mirror browser project state to `data/project.json` | No-op online |

## Stubs (501, Spec Names Retained)

`POST /api/research` (Wikimedia search) · `POST /api/dna` · `POST /api/contribute` (uploads currently use browser storage) · `POST /api/assemble` (assembly uses `scripts/render-film.mts`) · `GET /api/generate/status` (progress is client-driven and always returns done). The legacy `/api/render-frame` compatibility stub may be deleted and is no longer part of the target architecture. `/api/shot/generate` and `/api/shot/status` have been upgraded from stubs to implemented routes (see the table above).

Convention: local file writes are always atomic (temporary file + rename). LLM calls are wrapped in `lib/llm.ts` (structured prompt construction + JSON extraction repair), and the fal client is wrapped in `lib/fal-server.ts` (`import "server-only"`). The requestId for LLM / image calls is returned with the response for traceability.
