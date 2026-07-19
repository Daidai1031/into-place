# 01 · 数据模型

状态存 JSON 文件,不上数据库。`data/places/*.json` 为地方档案(可多个,支撑地图),`data/project.json` 为当前创作项目(单项目)。

## 1. Place(地方档案 = 共创档案的容器)

```jsonc
// data/places/roosevelt-island.json
{
  "slug": "roosevelt-island",
  "name": "Roosevelt Island",
  "region": "New York, USA",
  "status": "seeded",              // seeded(已播种,可进入)| empty(待共创,地图上半透明)
  "map_marker": { "x": 0.72, "y": 0.38 },   // 风格化 SVG 地图上的归一化坐标
  "tagline": "An island the city built to hide people, now a place people choose to live.",
  "assets": [ /* Asset[],见 §3。种子内容 + 用户贡献共存 */ ]
}
```

`data/places/` 同时放 `shaxi.json`、`camino.json`,status 为 `empty`(仅名称与 tagline),用于地图叙事。

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
  "frames": { "beat_1": { /* BeatFrame,见 §4 */ } },
  "beatMode": { "beat_1": "generated | collage" },
  "layouts": { "beat_1": { "items": [], "brushDataUrl": null } },
  "transitions": { "beat_1->beat_2": { "type": "match_cut", "note": "…" } },
  "updatedAt": "2026-07-19T00:00:00Z"
}
```

浏览器端 `localStorage` 是项目状态真值。本地开发环境在 Film 流程前将同一结构镜像到 `data/project.json`;Vercel 不写文件。

## 3. Asset(研究卡片 / 素材 / 社区贡献)

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
  "contributor": "founder_seed | user",       // 共创机制:用户上传即成为贡献
  "share_to_place": true,                      // 用户勾选后进入该地方公共档案
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

`source` / `license` 为必填;无来源素材不允许写入。`cutouts` 必须是对象数组,不得退回仅含路径的字符串数组。每个对象都要记录角色、三组 hash、像素来源、操作链、fal 调用和审核状态;没有 fal 调用的纸卡/背景写空数组。`pixel_origin.rgb` 必须指向本地原始素材,fal mask 只能作为 `pixel_origin.alpha`,不能成为 RGB 来源。缓存与发布规则见 spec/05。

## 4. Frame 与 Shot

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

Generated frame 可以直接进入 I2V;manual collage 必须先导出为单张 16:9 PNG。Prompt 一律由 `lib/prompt-compiler.ts` 从 beat、frame references 和 motion 数据编译。常规转场由 FFmpeg 在镜头生成后完成,不要求第二套视频渲染引擎。
