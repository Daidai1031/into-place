# 05 · Asset Preprocessing, Audio, and File Conventions

## Asset Preprocessing

### Fixed Processing Order

```text
source review → EXIF orientation → semantic crop → no-upscale size gate → local tone
→ fal/local mask → local edge → white border/shadow → automated QA
→ manual contact-sheet review → atomic staging publication
```

- Every output is driven by a declarative recipe. The recipe must specify asset identity, content to preserve and exclude, normalized crop after orientation, `card | cutout | bg` role, default tone / edge, mask prompt / ROI, fallback strategy, output path, `sourceSha256`, `recipeSha256`, and review status. Do not create a separate implicit routing table in the batch-processing script.
- All resizing must prohibit upscaling. The default maximum long edge is 2400px; a recipe for a large image may explicitly increase it. For low-resolution assets, record only a quality warning and limit their enlargement in the scene; **do not call an upscaling model**.
- fal is used only for subject masks. Before calling, use the fal MCP to verify the endpoint schema and current-day price. SAM requests must explicitly set `apply_mask:false`; archival RGB must never be sent to a model for redrawing. Scale the returned mask to the local working dimensions and write it only to alpha.
- Allow no more than two prompt / ROI attempts per mask. The fixed fallback order is fal SAM → local silueta / rembg → cropped paper card. Outputs that fail automated QA must not be silently published. The request_id, model, parameters, price-check time, and cost must enter provenance; never record secrets.
- `source | mono | sepia` color treatment, `scissor | torn | none` edges, 1–2px white borders, and subtle shadows are all local deterministic pixel operations. `scissor` uses a thresholded hard edge with slight antialiasing; `torn` uses a stable seed to apply multi-scale irregular erosion to the alpha boundary with transparent padding. Rerunning the same input and recipe must produce the same result.
- Defaults: historical assets use `mono`; modern photos use `source`; `card` uses `torn`; `cutout` uses `scissor`; `bg` uses `none`. A future UI may provide global selections and per-asset overrides, but it must not rewrite recipe defaults.
- Filenames must include role suffixes: `assets/cutouts/{asset_id}_{part}_card.png`, `..._cutout.png`, or `..._bg.png`. Do not omit the suffix when the role already has semantic meaning. A `card` may have a transparent torn-paper outer edge; a `cutout` must be a transparent subject; a `bg` has no edge or shadow.
- A cache hit must match the source hash, recipe hash, tool version, and mask configuration. Ordinary `--force` reruns only the local pixel stages; only an explicit `--refresh-mask` may submit to fal again. Before publication, generate in staging and complete QA, then atomically replace the formal output.
- Automated QA must check at least non-empty alpha, coverage, bounding box, connected regions, dimensions, and original RGB source. The manual contact sheet compares the source image, crop, mask, hard-edge result, and torn-edge result side by side.
- Record source / crop review separately from output visual review. A visual rejection must set `review.visual: rejected`, `publish:false`, and `fallbackRecipeId`. Rejected masks / provenance remain only in `data/preprocess/` for traceability and must not enter formal cutouts, manifests, or scenes. Review / publication status does not participate in the pixel recipe hash, preventing a review action from invalidating a paid mask.
- `asset_013` is a scanned PDF. Skip it and produce no output until a target page number has been manually specified.

Public interface for preprocessing selections:

```ts
type TonePreset = "source" | "mono" | "sepia";
type EdgeStyle = "scissor" | "torn" | "none";

type PreprocessSelection = {
  tone?: "defaults" | TonePreset;
  edge?: "defaults" | EdgeStyle;
  overrides?: Record<string, {
    tone?: TonePreset;
    edge?: EdgeStyle;
  }>;
};
```

`materializeCutout(recipeIdOrRecipe, selection = {}, context = {})` must read only local source assets, declarative recipes, and cached masks, and return deterministic outputs plus QA / provenance. When passed a recipe ID, it resolves from `data/preprocess/roosevelt-island.json` by default. A visually rejected recipe must refuse materialization except for contact-sheet preview. This interface is intended for later UI / API reuse; the selection page is not implemented at this stage.

## Audio

Generated shots (`fal_i2v`) always contain no sound / subtitles. This allows TTS narration wording and subtitle proofreading to be revised repeatedly without rerunning video generation (cheaper and more stable), while ensuring subtitles match archival text exactly. This is an established strategy, not a temporary limitation.

- Narration: a fal TTS endpoint (verified on Day 0), with self-recording as fallback; one or two sentences for each of the five acts.
- Ambient sound (Roosevelt Island): tram motor hum, East River water and wind, seagulls, spacious reverberation inside the ruins, and distant Manhattan traffic—**prefer recording it on the island**, supplemented with public Freesound assets.
- Mix with FFmpeg; align sound with scenes (switch ambience near the ruins), without implementing full spatial audio.
- No music by default; always disable model-native audio tracks (fixed prompt block).

## Directory Conventions

```text
data/places/{slug}.json        data/project.json        data/day0-findings.md
assets/archive/   assets/user/   assets/cutouts/
frames/{beat}.png
clips/{beat}.mp4
audio/narration.mp3   audio/ambient/*.wav
final/final.mp4
```

`frames/{beat}.png` stores the static first frame exported from a manual collage or a generated frame that needs local caching. Every file must be traceable to its beat, references, prompt, and review status in the project. `clips/{beat}.mp4` stores only approved I2V outputs.
