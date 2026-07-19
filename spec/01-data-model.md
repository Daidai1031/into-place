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
  "id": "ri-001",
  "place_slug": "roosevelt-island",
  "theme": "功能四次转变的小岛",
  "stage": "research | dna | story | storyboard | direct | film",
  "protagonist": { "name": "一块片麻岩", "reason": "囚犯开采的石头砌成了关押他们自己的墙" },
  "place_dna": { "colors": [], "materials": [], "symbols": [] },
  "scenes": [ /* Scene[],见 §4 */ ]
}
```

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

## 4. Scene 与 Shot

```jsonc
{
  "scene_id": "scene_04",
  "act": "anagnorisis",             // stasis|peripeteia|pathos|anagnorisis|katharsis
  "title": "The Ruin Today",
  "narration": "……",
  "assets": ["asset_012", "user_001"],
  "transition": {                    // 与前一场景之间的转场,默认确定性,fal 是可选升级
    "type": "push_dissolve | page_turn | wipe | match_cut | torn_reveal",
    "engine": "deterministic | fal_flf",
    "duration_seconds": 1.5
  },
  "shot": {
    "shot_id": "scene_04_shot_01",
    "shot_type": "push_through",    // 路由见 04-shot-router.md
    "engine": "fal_flf",            // 路由器写入:deterministic | fal_i2v | fal_flf
    "duration_seconds": 6,
    "start_frame": "renders/scene_04_start.png",
    "end_frame": "renders/scene_04_end.png",
    "camera": { "movement": "dolly_in", "speed": "slow", "path": "straight",
                "parallax_strength": "strong", "end_focus": "user_photo" },
    "layers": { "foreground": "torn paper edges",
                "midground": "1880s hospital photograph with doorway",
                "background": "user's photo of the Renwick ruin (revealed)" },
    "object_motion": { "archival_people": "sits down slowly on bench", "vehicle": "tram car moves left to right", "paper": "subtle jitter" },
    // 允许具体的主体/环境动作描述,但一个镜头只挑一个主体/环境主动作,不与 camera 动作叠成 "everything moves"
    "preservation": ["preserve all faces", "preserve architecture",
                     "preserve printed text", "do not add objects", "no morphing"],
    "style": ["handmade archival collage", "paper cutout", "8 fps stop-motion feeling"],
    "generation": { "model": null, "request_id": null, "cost_usd": null,
                    "attempts": 0, "max_attempts": 3,
                    "status": "pending | queued | done | failed",
                    "output": "clips/scene_04.mp4" }
  },
  "spatial": {                       // HyperFrames 确定性渲染的场景定义
    "planes": [
      { "asset": "assets/cutouts/....png", "z": 0.9, "x": 0, "y": 0, "scale": 1.2, "shadow": true },
      { "asset": "...", "z": 0.5 },
      { "asset": "...", "z": 0.1 }
    ],
    "camera_path": { "from": {"z": 0, "x": 0}, "to": {"z": 0.4, "x": 0.05}, "easing": "ease-in-out" }
  }
}
```

两种引擎共用 `spatial`:确定性镜头直接渲染它;fal 镜头把它拍平截帧作为 start/end frame。Prompt 一律由 `lib/prompt-compiler.ts` 从 shot JSON 编译,不手写。

`transition` 同理:deterministic 版本用 HyperFrames 关键帧动画实现(翻页 = plane 的 `rotateY` 3D 翻转,擦除 = `clip-path` 动画,匹配剪辑 = 同位置同缩放交叉切),fal 版本把 `transition.type` 编译进 FLF prompt——确定性优先,fal 是可选升级,细节见 04-shot-router.md。
