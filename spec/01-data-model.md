# 01 · Data Model

State is stored in JSON files rather than a database. `data/places/*.json` contains place archives (multiple files are supported for the map), while `data/project.json` contains the current creative project (a single project).

## 1. Place (Place Archive = Container for a Co-created Archive)

```jsonc
// data/places/roosevelt-island.json
{
  "slug": "roosevelt-island",
  "name": "Roosevelt Island",
  "region": "New York, USA",
  "status": "seeded",              // seeded (populated and accessible) | empty (awaiting co-creation; translucent on the map)
  "map_marker": { "x": 0.72, "y": 0.38 },   // Coordinates for the old stylized SVG map; AtlasMap.tsx remains in the repo for a possible rollback
  "coordinates": { "lat": 40.7601, "lng": -73.9500 },  // Real latitude and longitude, used to position markers on the Atlas paper-textured globe (react-globe.gl) since 2026-07-19
  "tagline": "An island the city built to hide people, now a place people choose to live.",
  "assets": [ /* Asset[]; see §3. Seed content and user contributions coexist */ ]
}
```

`data/places/` also contains `shaxi.json` and `camino.json`, with status `empty` (name and tagline only), for the map narrative.

## 2. Project

```jsonc
{
  "slug": "roosevelt-island",
  "selections": { "asset_012": "must_use" },
  "tuning": { "asset_012": { "tone": "mono", "edge": "torn" } },
  "uploads": [],
  "story": {
    "directions": [{ "id": "dir_1", "title": "…", "premise": "…" }],
    "chosenDirectionId": "dir_1",
    "beats": [{ "id": "beat_1", "act": "Stasis", "text": "…" }]
  },
  "frames": { "beat_1": { /* BeatFrame; see §4 */ } },
  "beatMode": { "beat_1": "generated | collage" },
  "layouts": { "beat_1": { "items": [], "brushDataUrl": null } },
  "transitions": { "beat_1->beat_2": { "type": "match_cut", "note": "…" } },
  "updatedAt": "2026-07-19T00:00:00Z"
}
```

Browser-side `localStorage` is the source of truth for project state. Before the Film workflow, the local development environment mirrors the same structure to `data/project.json`; Vercel does not write files.

## 3. Asset (Research Card / Asset / Community Contribution)

```jsonc
{
  "id": "asset_012",
  "title": "Smallpox Hospital, Blackwell's Island, ca. 1880s",
  "type": "photo | map | print | texture | user_upload",
  "era": "1880s",
  "source": "NYPL Digital Collections",
  "source_url": "https://...",
  "license": "Public Domain",
  "confidence": "high | medium | low",
  "fact_level": "documented | interpretation | creative",
  "contributor": "founder_seed | user",       // Co-creation mechanism: a user upload becomes a contribution
  "share_to_place": true,                      // Enters the place's public archive when selected by the user
  "upload_role": "bridge | protagonist_ref | texture | ending | inspiration | null",
  "status": "must_use | maybe | rejected",
  "file": "assets/archive/asset_012.jpg",
  "cutouts": [
    {
      "recipe_id": "asset_014_lighthouse1970_cutout",
      "file": "assets/cutouts/asset_014_lighthouse1970_cutout.png",
      "role": "card | cutout | bg",
      "tone": "source | mono | sepia",
      "edge": "scissor | torn | none",
      "source_hash": "sha256:…",
      "recipe_hash": "sha256:…",
      "output_hash": "sha256:…",
      "pixel_origin": {
        "rgb": "assets/archive/asset_014.tif",
        "alpha": "data/preprocess/masks/asset_014_lighthouse1970_cutout.png | opaque"
      },
      "operations": ["exif_rotate", "crop", "resize_without_enlargement", "mono", "apply_mask", "scissor", "border", "shadow"],
      "fal_calls": [
        {
          "purpose": "mask",
          "endpoint": "fal-ai/sam-3/image",
          "request_id": "…",
          "parameters": { "apply_mask": false },
          "price_checked_at": "2026-07-18T00:00:00Z",
          "cost_usd": 0.005
        }
      ],
      "warnings": ["low_resolution"],
      "review": {
        "source": "pending | approved | rejected",
        "visual": "pending | approved | rejected",
        "reviewedAt": null,
        "notes": null
      },
      "published": true
    }
  ]
}
```

`source` / `license` are required; unsourced assets must not be written. `cutouts` must be an array of objects and must not regress to a string array containing only paths. Each object must record its role, three hashes, pixel origins, operation chain, fal calls, and review status; paper cards / backgrounds with no fal calls use an empty array. `pixel_origin.rgb` must point to the local source asset. A fal mask may only be used as `pixel_origin.alpha` and must never become the RGB source. See spec/05 for caching and publishing rules.

## 4. Frame and Shot

```jsonc
{
  "beat_id": "beat_04",
  "frame": {
    "source": "generated | manual_collage",
    "imageUrl": "https://fal.media/... | data:image/png;base64,...",
    "model": "nano-banana-2 | manual",
    "prompt": "compiled frame prompt",
    "references": ["asset_012", "user_001"],
    "edits": [{ "kind": "prompt", "instruction": "…", "at": "…" }],
    "requestId": "…",
    "costUsd": 0.04,
    "attempts": 1,
    "approved": true
  },
  "shot": {
    "shot_id": "beat_04_shot_01",
    "engine": "fal_i2v",
    "duration_seconds": 5,
    "start_frame": "frame.imageUrl",
    "camera": { "movement": "dolly_in", "speed": "slow" },
    "object_motion": { "subject": "sits down slowly" },
    "preservation": ["preserve faces", "preserve architecture", "preserve printed text", "no new objects", "no morphing"],
    "style": ["handmade archival collage", "paper cutout", "stop-motion feeling"],
    "generation": {
      "model": "kling-v3-turbo-std",
      "request_id": null,
      "cost_usd": null,
      "attempts": 0,
      "max_attempts": 3,
      "status": "pending | queued | done | failed | approved | rejected",
      "output": null
    }
  },
  "transition_out": {
    "type": "cut | crossfade | page_turn | wipe | match_cut | custom",
    "note": "…",
    "engine": "ffmpeg"
  }
}
```

A generated frame can enter I2V directly; a manual collage must first be exported as a single 16:9 PNG. Prompts are always compiled by `lib/prompt-compiler.ts` from the beat, frame references, and motion data. Standard transitions are completed by FFmpeg after shot generation and do not require a second video-rendering engine.
