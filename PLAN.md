# PLAN — Feature Checklist (v4, Frame-to-Video Main Path)

Principle: status must be clear at a glance. First ensure that a playable demo is always available, then proceed with real paid generation. The only current video path is **approved storyboard frame → fal I2V → FFmpeg assembly**.

---

## Asset Processing Pipeline

Goal: sourced archival materials → reviewed card / cutout / background layers.

- [x] Process JPG / TIFF files in batches using declarative recipes
- [x] Default historical assets to `tone:mono`; retain `source` for modern photos, with `sepia` as an alternative
- [x] Use fal SAM 3 / local rembg only to generate alpha; RGB always comes from the local source image
- [x] Persist source review, visual review, QA, and provenance
- [x] Make 19 published layers available to Storyboard
- [ ] Send the `asset_013` PDF through preprocessing after manual page selection—does not block the demo

## App Workflow

- [x] Atlas: Roosevelt Island seed location + Shaxi / Camino co-creation entry points pending
- [x] Archive: timeline, asset curation, tone / edge adjustment, user upload, and simulated review
- [x] Story: 3 story directions, 5–8 beats, inline editing, rewriting, insertion, and deletion
- [x] Storyboard: choose a generated frame or manual collage for each beat
- [x] Generated frame: archival references, model selection, text editing, drag-in assets, and provenance
- [x] Manual collage: real cutout layout, brush, layer ordering, and undo
- [x] Film / Journey Book: pre-rendered sample film, sources, licenses, contributors, and a generation-action list
- [x] Library: save, like, favorite, and remove, persisted in localStorage
- [ ] Place DNA: optional enhancement; `/api/dna` currently remains a stub

## Frame-to-Video Main Path

- [x] `lib/prompt-compiler.ts`: compile a structured prompt from place / beat / references / motion
- [x] `lib/models.ts`: retain only the current T2I / image-edit / I2V model registry
- [x] Remove the old layered-parallax video framework and headless-browser frame-capture dependency
- [ ] Export manual collages as 1280×720 PNGs: prefer browser Canvas, use server-side Sharp when necessary
- [ ] `/api/shot/generate`: accept a reviewed frame and queue-submit an I2V task
- [ ] `/api/shot/status`: poll task status and save the request ID, cost, and output URL
- [ ] Allow no more than 3 generation attempts per shot; after that, the frame or prompt must be changed
- [ ] Review each shot for identity, architecture, printed text, collage layout, and newly introduced objects
- [ ] Write approved shots to project state

## Assembly and Sound

- [ ] Use FFmpeg to concatenate all approved shots
- [ ] Complete page turn / wipe / match cut / crossfade transitions in post-production
- [ ] Add ambient sound
- [x] Add optional Story-map narration (LLM writer + Kokoro TTS; self-recording remains future work)
- [x] Add optional music and balance its loudness under narration
- [ ] Output the final MP4, replacing `public/films/roosevelt-island.mp4`

## Demo and Submission

- [ ] Rehearse the full flow twice and confirm the pre-rendered film still plays without fal
- [ ] Record a 3-minute demo
- [ ] Clean up the repo: screenshots, architecture diagram, `.env.local.example`, and no traces of secrets
- [ ] Freeze new features for the final 6 hours and fix only issues that block the demo

### Demo Video Script (3:00)

| Time | Content | Scoring Category |
|---|---|---|
| 0:00–0:15 | Hook: AI video flattens the character of places; real archives and community memory need a different approach | Creativity |
| 0:15–1:15 | Atlas → Archive curation / upload → choose a story direction → edit a beat | User Value |
| 1:15–2:00 | Generate or handcraft storyboard frames → drag in archival assets → regenerate only one shot | Technical |
| 2:00–2:35 | Play the approximately 31-second finished film | Demo |
| 2:35–3:00 | Journey Book: sources, licenses, community attribution, and generation records | Trust |

## Budget Discipline

- Recheck the fal schema and current-day price before every paid call.
- Confirm first when a single estimated cost exceeds $5, a hero model is used, or cumulative cost is abnormal.
- Allow no more than 3 attempts per shot; the request ID, model, parameters, cost, and output must be written to project state.
- If video generation fails, play the pre-rendered demo and do not present it as a real-time generation result.

## Risk Register

| Risk | Trigger Signal | Response |
|---|---|---|
| I2V rewrites the subject or architecture | Faces, text, or structures drift | Stop rerolling; simplify the frame / prompt or switch models |
| Manual collage cannot be exported reliably | CORS, font, or dimension differences | Use server-side Sharp to composite the reviewed local layers |
| fal queue times out | Film page remains pending for a long time | Save the job ID and allow polling to resume after refresh; play the pre-rendered film in the demo |
| Assembly fails | FFmpeg parameters or input formats are inconsistent | Standardize 16:9, frame rate, codec, and audio sample rate, then retry |
| Insufficient time | I2V / assembly is not yet connected | Freeze enhancements and ensure Storyboard + pre-rendered film + Journey Book remain demonstrable |
