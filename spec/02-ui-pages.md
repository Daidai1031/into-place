# 02 · Page Specifications (Synced with Implementation on 2026-07-19: Map Landing Page + 4 Workflow Pages + Film Library)

English-only interface. Workflow: **Atlas → Archive → Story → Storyboard → Film → Library**, with `StepNav` breadcrumbs in the top bar (Archive → Story → Storyboard → Film). Plain Tailwind v4 with no component library; collage aesthetic = paper-textured background (inline SVG turbulence) + torn-paper edges (three stable clip-path variants) + tape / stamp / handwritten accents. All user state (asset selection, parameter tuning, uploads, story, frames, layouts, and film library) is stored in localStorage. See spec/03 for details of the environment split.

## Page 0 — Atlas (`/`)

As of 2026-07-19, the spatial navigation entry point on the map landing page has changed from a stylized SVG collage map to a `react-globe.gl` paper-textured globe (`components/atlas/AtlasHero.tsx` + `PaperGlobe.tsx`; the old `AtlasMap.tsx` / `PlaceMarker.tsx` remain in the repository for rollback). The left column contains the heading “EVERY PLACE HAS A HIDDEN LAYER / Turn local history into spatial collage stories.” + `NewPlaceInput`; the right column contains the globe:

- The globe uses a solid-color material (`THREE.MeshLambertMaterial`, not a texture). The ocean uses a faded blue-gray such as `--color-sky`; land comes from `polygonsData` (Natural Earth 110m admin-0 countries, vendored from the `three-globe` example data and stored at `public/world/ne-110m-countries.geojson`, public domain), with several sepia / paper colors selected by a hash of the country name. `polygonStrokeColor` adds ink outlines; `showGraticules` enables latitude and longitude grid lines; `showAtmosphere:false` avoids a technological blue glow.
- Marker data comes from `PlaceSummary.coordinates{lat,lng}` (real latitude and longitude, a new field; see `lib/types.ts`) and is rendered as plain DOM through `htmlElementsData` (styles are defined in the `.globe-marker*` rules in `app/globals.css`, outside Tailwind scanning). A `seeded` place (Roosevelt Island) uses a red diamond + ping animation, with a paper-card label (name / region) on hover or focus; an `empty` place (Shaxi, Camino) uses a dashed “?” circle.
- The home page renders only `listPlaces().slice(0, 3)`—currently all three example places. The entry point remains concise as more places are added later.
- The globe slowly `autoRotate`s, pauses while dragging / clicking, and resumes a few seconds after release. Clicking a `seeded` marker → `pointOfView` flies to and zooms into the place, enlarges the marker, and reveals an “Explore the hidden history →” link after ~1.5s (pointing to Archive). It also passes `active` to `CollageParallax`, triggering a one-time “awakening” displacement of the background collage fragments (an old map fragment, torn-edge cutouts of Nellie Bly / the lighthouse / the Girl Puzzle monument, and a vintage television prop looping found footage).
- `NewPlaceInput`: entering a new place name → “new places open soon” notice (not implemented).
- Bottom platform statement: everyone can contribute, and sources and attribution are always preserved.

## Page 1 — Archive (`/p/[slug]/archive`, Extended from the Original Research Page)

**Historical timeline + co-created asset library + upload + preprocessing controls**:

- Timeline: horizontally scrolling buckets (`lib/era.ts` parses free-text eras into period buckets rather than a proportional year scale), with a hand-drawn track line and era ticks; asset cards hang below their corresponding eras. The far-right “Today” bucket contains user uploads + `AudioSlotCard` (audio memories, coming-soon placeholder).
- Asset card: thumbnail (cutout `*_card.png`) / title / era / source link / license / fact_level / contributor badge. The PDF entry (`asset_013`) displays a document placeholder + “Open PDF source.”
- `FoundCounter`: “Found: N archival photographs, M prints & maps, K community contributions.”
- Upload (`UploadModal`): drag / select an image (client compresses it to a ≤1600px JPEG stored in localStorage) + title / description / era / purpose (texture / protagonist_ref / bridge / ending / inspiration) + “share to public archive” checkbox.
- **Simulated review** (`ModerationFlow`): uploading → pending review → checking source & rights → APPROVED stamp animation. Every step is persisted and does not regress after refresh. The asset can be selected only after approval.
- Asset selection: Must use · Maybe · Skip on each card. The `SelectionTray` bottom bar shows live counts and allows “Continue to Story” only when at least 3 assets are selected.
- **Preprocessing controls** (`PreprocessTuner`): “tune” on each card → tone (source / mono / sepia, CSS-filter live preview) + edge (torn / scissor / none, clip-path / white-border preview). Recipe defaults are marked with · and can be reset with one click. The source of truth maps to recipe `defaultTone/defaultEdge`, while overrides are written locally as well (spec/03). The preview is approximate; real pixels are processed only by the local deterministic pipeline.
- The “Search more” (Wikimedia) button remains, marked experimental, and is currently a stub.

## Page 2 — Story (`/p/[slug]/story`)

- If fewer than 3 assets have been curated, prompt the user to return to Archive.
- Step one: `Draft story directions` → the LLM returns **3 alternative story directions** (title + a one- or two-sentence premise), or the user writes a custom direction.
- Step two: select a direction → the LLM generates **5–8 beats** (count determined by the narrative), each with 1–2 sentences + an act label.
- Beat card: click for inline editing / `re-roll` (AI rewrites that beat) / `delete` (allowed only when at least 5 remain) / “+ add a beat here” between beats (AI inserts one, maximum 8).
- “start over” resets the process; when everything is ready → “Continue to Storyboard.”

## Page 3 — Storyboard (`/p/[slug]/direct`, Former Direct Page Rebuilt as `/p/[slug]/storyboard`)

**Two storyboard paths per beat**:

- `BeatStrip`: horizontal strip of beat thumbnails (● = an approved frame exists), with transition chips between beats (page_turn / wipe / match_cut / push_dissolve / custom + note, with “Suggest with AI”).
- Default `Generated frame`: compile a prompt from the beat, film premise, and selected archive references to generate a 16:9 frame. Supports model selection, natural-language editing, and dragging a cutout to a specified position for continued editing. Every result is labeled AI-generated and records its request ID / prompt / cost / references.
- Switchable `Manual collage`: the 16:9 `CollageCanvas` uses real cutouts and supports drag, rotation, scaling, layer ordering, brush, and undo. Export it as a static PNG before entering I2V.
- 16:9 canvas (`CollageCanvas`): plain pointer events + CSS transforms for drag movement, single-corner-handle rotation + scaling, move forward / backward, and removal. Normalized coordinates are stored as `{assetId,x,y,scale,rotation,z}`.
- `AssetShelf`: click curated assets to place them on the canvas, 3–8 per beat (5 recommended).
- **AI initial layout (manual collage)**: the client assembles a contact sheet → an image model produces a composition reference → a vision LLM returns layout JSON → real cutout pixels are arranged according to the JSON. The reference is shown only in a collapsed section labeled “AI-generated reference — not archive, not the output.” If AI is unavailable, fall back to a deterministic layout and never block the workflow.
- **Brush** (`BrushOverlay`): top-layer canvas drawing (5 colors + stroke widths), with strokes serialized as a persistent PNG. The undo snapshot stack includes both layout and strokes.
- Once every beat has a generated frame or manual collage → “Continue to Film.”

## Page 4 — Film (`/p/[slug]/film`)

- Preconditions: the story has at least 5 beats, and every beat has an approved generated frame or manual collage. Otherwise, direct the user back to the corresponding page.
- `Generate the film` → first mirror state through `/api/project/save`, then call `/api/generate/start` (writes `film-manifest.json` + plays the preview). The real final film is produced by local `scripts/render-film.mts`, which consumes the manifest, generates each I2V shot through `/api/shot/*` (or the fal queue directly), assembles FFmpeg xfade transitions → `final/<slug>.mp4` → `scripts/sync-public.mjs`. Paid runs require an explicit `--yes`.
- Real I2V runtime view by shot: each shot displays status (submitting / animating / ready), the motion prompt actually compiled for that shot, and an embedded preview as soon as the shot is ready (without waiting for the batch). Simulation / demo environments still use the linear checklist.
- Assembly applies a unified grade to all shots (muted blue-gray / sepia, brighter with lifted blacks) and fades the ending to black. See “Assembly post-production” in `spec/04-shot-router.md`; there is currently no audio track.
- Player + mode description (local preview / simulation); `+ Save to library`.
- **Journey Book**: archival sources used (title / era / source link / license) + community contributor attribution + a “What the models did” list of generation actions. Generated material must never be presented as archival material—this is the authenticity red line.

## Library (`/library`)

- localStorage film library: paper-card grid + tape, with embedded playback. ❤ like / ⭐ favorite / remove are all persisted. The empty state points back to Atlas.

## Shared UI

The collage UI component set in `components/ui/` includes `PaperCard` (the seed selects the torn-edge variant), `TapeStrip`, `Stamp`, `CollageButton`, `StepNav`, fact_level / license / contributor / era badges, and `Modal`. Fonts use the system stack (Georgia serif / Segoe Print handwriting / Courier New typewriter) to avoid fetching external fonts during the build.
