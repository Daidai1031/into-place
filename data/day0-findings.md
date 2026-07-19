# Day 0 Research: Image-to-Video Models on fal That Support Start and End Frames

Source: fal MCP `search_models` / `get_model_schema` / `get_pricing`, queried on 2026-07-18. Prices were checked, but no generation task was run. Prices may change at any time; recheck them before a production call according to rule 1 in CLAUDE.md.

> **Historical research record:** This table no longer serves as the runtime model registry or budget policy. See `lib/models.ts` for the current single-start-frame I2V candidates, and CLAUDE.md for confirmation thresholds.

| Endpoint ID | Model | Price | Maximum Duration | Resolution Options | Start / End Frame Parameter Names | Notes |
|---|---|---|---|---|---|---|
| `fal-ai/kling-video/o1/image-to-video` | Kling O1 FLF [Pro] | $0.112/s | 3–10s | Not exposed in the schema (fixed by the model) | `start_image_url` (required) / `end_image_url` (optional) | Without `end_image_url`, it falls back to ordinary I2V |
| `fal-ai/kling-video/o1/standard/image-to-video` | Kling O1 FLF [Standard] | $0.084/s | 3–10s | Not exposed | `start_image_url` / `end_image_url` (optional) | Same as above, at a cheaper tier |
| `fal-ai/kling-video/o3/pro/image-to-video` | Kling O3 [Pro] | $0.14/s | 3–15s | Not exposed | `image_url` / `end_image_url` (optional) | Supports `multi_prompt` multi-shot generation and `generate_audio` |
| `fal-ai/kling-video/o3/standard/image-to-video` | Kling O3 [Standard] | $0.14/s | 3–15s (inferred from the same schema family as Pro) | Not exposed | `image_url` / `end_image_url` (optional) | Same price as Pro; recheck whether a Standard discount exists before calling |
| `fal-ai/kling-video/v3/turbo/standard/image-to-video` | Kling v3.0 Turbo Standard | $0.112/s | 3–15s | Fixed 720p | `image_url` (start frame required; the description says end frames are supported, but the schema exposes no explicit end-image parameter, so this needs confirmation) | Native audio; **end-frame support is uncertain. Confirm the parameter name in the fal dashboard or docs before calling** |
| `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | Kling v2.5 Turbo Pro | $0.07/s | 5s / 10s | Not exposed | `image_url` / `tail_image_url` (optional) | Affordable candidate suitable for routine testing |
| `fal-ai/wan-flf2v` | Wan-2.1 First-Last-Frame-to-Video | $0.40/video (full 720p amount; 480p uses half-price units) | Inferred from `num_frames` (81–100) + `frames_per_second` (5–24); default 81 frames @16fps ≈ 5s | 480p / 720p | `start_image_url` / `end_image_url` (both required) | One of the cheapest open-source candidates, within the routine testing budget |
| `fal-ai/framepack/flf2v` | Framepack FLF2V | $0.0333/s (480p; 720p ×1.5) | Inferred from `num_frames` (default 240); no explicit duration limit field | 480p / 720p | `image_url` / `end_image_url` (both required) | Cheapest candidate; `strength` adjusts the end frame's influence |
| `fal-ai/pixverse/v6/transition` | PixVerse V6 Transition | $0.005/s | 1–15s | 360p / 540p / 720p / 1080p | `first_image_url` / `end_image_url` (both required) | Lowest unit price; supports audio and a multi-shot switch |
| `fal-ai/pixverse/c1/transition` | PixVerse C1 Transition | $0.005/s | 1–15s | 360p / 540p / 720p / 1080p | `first_image_url` / `end_image_url` (both required) | Positioned for cinematic transitions; same price as V6 |
| `bytedance/seedance-2.0/image-to-video` | Seedance 2.0 | $0.014/unit (billing unit is not seconds; verify conversion in fal documentation) | 4–15s (or auto) | 480p / 720p / 1080p / 4k | `image_url` / `end_image_url` (optional) | Supports synchronized audio; **the unit price is in “units,” not seconds. Verify the conversion before estimating cost** |
| `bytedance/seedance-2.0/fast/image-to-video` | Seedance 2.0 Fast | $0.0112/unit (same caveat; verify units) | 4–15s (or auto) | Not separately confirmed; inferred to match the main 2.0 tier | `image_url` / `end_image_url` (optional) | Faster and cheaper; prefer it over the standard 2.0 tier for routine testing |
| `fal-ai/bytedance/seedance/v1.5/pro/image-to-video` | Seedance 1.5 Pro | $1.20 / 1M tokens (not priced per second; verify the token consumption of a typical 5s 720p video before estimating actual cost) | 4–12s | 480p / 720p / 1080p | `image_url` / `end_image_url` (optional) | Billing unit is tokens; **estimate the actual USD cost before ordering** because it may exceed the $2 threshold |
| `fal-ai/veo3.1/first-last-frame-to-video` | Veo 3.1 | $0.40/s | 4s / 6s / 8s | 720p / 1080p / 4k | `first_frame_url` / `last_frame_url` (both required) | Per CLAUDE.md, use only for the hero shot (`scene_04`); 8s × 720p is already ≈$3.20. **This exceeds the $2 threshold, so ask the developer before use** |
| `fal-ai/veo3.1/fast/first-last-frame-to-video` | Veo 3.1 Fast | $0.15/s | Inferred to match Veo 3.1 (4 / 6 / 8s) | Inferred to match Veo 3.1 | Inferred to use `first_frame_url` / `last_frame_url` | 8s × 720p ≈ $1.20; still recheck the schema details first |
| `fal-ai/veo3.1/lite/first-last-frame-to-video` | Veo 3.1 Lite FLF | API rate-limited during the query (429); price unavailable | Unconfirmed | Unconfirmed | Inferred to match the Veo 3.1 family | **Price pending; query again before use** |

## Related Items Found but Not Included in the Table (Recorded Only; First / Last Frame Requirements Not Verified)

- `fal-ai/ltx23-trainer-v2/interpolate` — a training endpoint for a keyframe-interpolation LoRA, not a direct-inference I2V model, so it is not a candidate.
- `fal-ai/ffmpeg-api/extract-frame` — a tool endpoint for extracting the first / middle / last frame from a video, not a generative model.

## Routine Test Candidates Recommended at the Time (Historical Record)

At the time, PixVerse Transition, Framepack FLF2V, Kling v2.5, and Wan FLF2V were compared by unit price. That ranking and the old $2 threshold are now obsolete and must not be used to initiate calls directly.

## Early Layered-Parallax Spike (Retired)

On Day 0, a standalone layered-parallax video approach was validated: real archival images could produce an MP4 with multi-layer camera motion without being redrawn by a model at that stage. The experiment completed its technical validation, but the product later moved to **approved storyboard frame → fal I2V → FFmpeg assembly**. The related CLI, headless-browser frame-capture scripts, and npm dependencies were therefore removed on 2026-07-19.

This note is retained only to explain the origin of early `data/scenes/` fixtures in the repository. They are not part of the current runtime path and should not be reintroduced as dependencies. The still-relevant experience with Sharp alpha compositing has been retained in the asset-processing conventions in `CLAUDE.md`.

## Generative Main-Path Endpoint Verification (2026-07-19, fal MCP Not Connected in This Session)

The **fal MCP was not connected** in this session, so the endpoints below were checked on fal model pages + documentation for “existence + approximate price”; **`get_model_schema` / `get_pricing` were not run**. Endpoints with `verifyBeforeCall:true` in `lib/models.ts` must still have their parameter names and current-day prices rechecked through the fal MCP before the first paid call.

| Purpose | Endpoint | Observed Price | Key Parameters |
|---|---|---|---|
| T2I default | `fal-ai/nano-banana-2/edit` | ~$0.04/image | `prompt` + `image_urls` (≤14 reference images, Gemini 3.1 Flash Image) + `aspect_ratio` |
| T2I alternative | `fal-ai/flux-2-pro` | $0.03/first MP + $0.015/additional MP | `prompt`, `image_size`; reference-image field name pending re-verification |
| I2V default | `fal-ai/kling-video/v3/turbo/standard/image-to-video` | $0.112/s | `image_url` + `prompt` + `duration` (enum string) + `generate_audio` (forced false) |
| I2V budget | `alibaba/happy-horse/image-to-video` | $0.14/s @720p, $0.28 @1080p | `image_url` + `prompt` (optional, ≤2500 characters) + `duration` (numeric 3–15) + `resolution` |
| I2V hero | `fal-ai/veo3.1/image-to-video` | $0.20/s @720p without audio, $0.40 with audio | `image_url` + `prompt` + `duration` (such as `"8s"`) |

**Verified with a real run:** `fal-ai/nano-banana-2/edit` + real cutout reference images + a style anchor chain generated five storyboard frames for Roosevelt Island Direction One (`data/storyboard-preview/`). They are stylistically consistent, match the narrative, and cost far less than $5. I2V has not yet had a paid real run; `scripts/render-film.mts --yes` awaits developer approval.
