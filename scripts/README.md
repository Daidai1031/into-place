# 拼贴渲染工具链(Phase 0 提前写好,Phase 1 会直接复用)

这里的工具对应 spec/05 的预处理约定 + spec/04 的确定性引擎(Puppeteer 回退实现,格式和真正接 HyperFrames CLI 时一致)。

**硬规则:分层文件(`assets/cutouts/*.png` + `data/scenes/*.json`)永远是场景的唯一源文件。**
`render-scene.mjs` 只做单向渲染(层 → 拍平的帧),渲染出来的截图只能喂给 fal 当 start/end frame,或剪进最终成片——
不允许把渲染结果再拿去给任何抠图/分割模型往回找层。要改构图就去改 `.json` 里的 `z/x/y/scale`,或者换一张 `cutouts/*.png`,重新渲染。

## 0. 一次性准备

```bash
npm install                      # 装 sharp / puppeteer / tsx / @fal-ai/client
cp .env.local.example .env.local # 填 FAL_KEY=你的key,这个文件已在 .gitignore 里
```

fal mask 不可用时会回退本地 `rembg`/silueta,因此开发机建议准备:
```bash
pip install rembg[cli] onnxruntime   # 第一次会下一个几十 MB 的分割模型,之后离线可用
```
手工透明 PNG 也可作为已审核 mask 输入;不得从拍平渲染帧反向分层。

## 1. 预处理核心:`cutout.mjs`

```ts
type TonePreset = "source" | "mono" | "sepia";
type EdgeStyle = "scissor" | "torn" | "none";

type PreprocessSelection = {
  tone?: "defaults" | TonePreset;
  edge?: "defaults" | EdgeStyle;
  overrides?: Record<string, { tone?: TonePreset; edge?: EdgeStyle }>;
};

materializeCutout(recipeIdOrRecipe, selection = {}, context = {});
```

固定顺序:EXIF 摆正 → recipe crop → resize(只缩小)→ tone → 应用缓存 mask → edge → 白边/阴影 → QA。RGB 始终来自本地原图;fal mask 只替换 alpha。

- `role:card`:保留 crop 内整幅内容,默认 `torn`;`role:cutout`:使用主体 alpha,默认 `scissor`;`role:bg`:默认 `none`,无边缘和阴影。
- `source` 保留本地颜色;`mono` 做中性黑白和对比度归一;`sepia` 在 mono 上加固定暖调。历史素材默认 mono,现代照片默认 source。
- `scissor` 是阈值化硬边加轻微抗锯齿;`torn` 用 recipe seed 产生可重复的多尺度撕裂边;`none` 不改边缘。
- `maxSize` 只是长边上限,内部始终使用 `withoutEnlargement:true`;001、008、012 等低分辨率素材只报警,禁止超分。
- 核心同时保留旧 `cutout()` 调用兼容层:`tone:none` 等价 `source`,`paper/auto` 对应 `card/cutout`,`--no-torn-edge` 对应 `scissor`;新代码一律使用 v2 名称。

## 1.5 批量处理:`batch-cutout.mjs`

```bash
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --dry-run
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --only asset_001,asset_014
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --force
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --only asset_014 --refresh-mask
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --tone sepia --edge scissor
node scripts/preprocess-contact-sheet.mjs
```

分流计划统一放在 `data/preprocess/roosevelt-island.json`,不得在 batch 中另写 `JOBS`。recipe 记录素材定位、保留/排除内容、crop、role、默认 tone/edge、mask prompt/ROI、fallback、稳定 seed、source/recipe SHA-256 与审核状态。`asset_013` 是待人工选页的 PDF,明确 skip 且不产生输出。

- `--dry-run` 只校验 recipe、源文件和预计动作,不写文件、不调用 fal。
- `--only` 可按 asset id 或 recipe id 过滤;`--tone`/`--edge` 是本次全局选择,单素材 override 仍可由 `PreprocessSelection.overrides` 提供。CLI 的 `--edge` 接受 `scissor | torn`;`none` 由 bg recipe 或编程接口选择。
- `--force` 只重做本地像素阶段,不会重新收费;只有 `--refresh-mask` 会重新请求 fal mask。
- 缓存命中必须同时匹配 source hash、recipe hash、工具版本和 mask 配置。所有新输出先进入 staging,通过 QA 后原子发布。
- fal SAM 请求显式 `apply_mask:false`,每个 mask 最多两次提示/ROI 尝试;失败回退 SAM → silueta/rembg → 裁剪纸卡。调用前必须用 fal MCP 核对 schema 和当日价格。
- `data/places/roosevelt-island.json` 的 `cutouts` 是对象数组,记录 role、source/recipe/output hash、RGB/alpha 来源、操作链、fal request/model/parameters/price/cost、警告与 review 状态。逐 recipe provenance 写入 `data/preprocess/provenance/{recipeId}.json`;mask 与调用元数据写入 `data/preprocess/masks/{recipeId}.png` 和同 basename `.json`。
- 输出统一为 `*_card.png`、`*_cutout.png`、`*_bg.png`;不再用无角色后缀的透明主体名。
- 人工 contact sheet 拒绝的 recipe 使用 `review.visual: rejected` + `publish:false` + `fallbackRecipeId`;mask 与 provenance 留在 `data/preprocess/` 供追溯,正式 cutouts、manifest 和场景只包含通过审核的输出。review/publish 字段从 recipe hash 中规范化排除,因此审核决定不会导致重复付费。
- `preprocess-contact-sheet.mjs` 默认写 `renders/preprocess-review/contact-sheet.png`,六栏展示 source/crop/mask/hard/torn/final;支持 `--only asset_id,recipe_id` 与 `--out path`,且绝不调用 fal/rembg。

**云端容器跑 rembg 的办法**(网络策略只放行包管理源,GitHub/HF 的模型直链都被 403):
npm 上 `@rmbg/model-*` 系列包把 rembg 官方权重按 4MB 分块打进了 npm 包,拼回去 md5 与 rembg 期望值完全一致:

```bash
# @rmbg/model-u2netp(4.6MB)与 @rmbg/model-silueta(43MB,质量接近 u2net 全量版,推荐)
cd /tmp && npm pack @rmbg/model-silueta && tar xzf rmbg-model-silueta-*.tgz
mkdir -p ~/.u2net && cat package/silueta-*.onnx > ~/.u2net/silueta.onnx   # 按 1..N 顺序拼接
REMBG_MODEL=silueta node scripts/batch-cutout.mjs
```

`REMBG_MODEL` 环境变量选 rembg 模型(默认 `u2net`,本机已有缓存的话不用管)。
抠形质量结论(2026-07-18 实测):**照片(含 1970/1999 HABS、现代照片)和半调印刷 → silueta 可作为 fallback;
线刻版画 → 不可用**(模型对线刻无图底概念,输出晕影),版画按 recipe 使用 `role:card`。

## 2. 拼场景:手写 `data/scenes/*.json`

跟 spec/01 的 `spatial` 字段是同一个结构,例子:

```jsonc
{
  "planes": [
    { "asset": "assets/cutouts/asset_010_prison_card.png", "z": 0.9, "x": 0, "y": 0.1, "scale": 1.2, "shadow": true },
    { "asset": "assets/cutouts/asset_014_lighthouse1970_cutout.png", "z": 0.5, "x": 0, "y": 0, "scale": 1.0, "shadow": true },
    { "asset": "assets/cutouts/asset_003_map_bg.png", "z": 0.1, "x": -0.1, "y": -0.1, "scale": 0.9, "shadow": false }
  ],
  "camera_path": { "from": { "z": 0, "x": 0, "y": 0 }, "to": { "z": 0.4, "x": 0.05, "y": 0 }, "easing": "ease-in-out" }
}
```

`z`:0=远景,1=近景(跟 spec/01 例子一致)。`asset` 路径相对项目根目录写。视差不用手调——渲染器用真的 CSS 3D
`perspective` + `translateZ`,浏览器自己算透视,不需要给每层单独配"速度系数"。

## 3. 渲染 start/end frame:`render-scene.mjs`

```bash
node scripts/render-scene.mjs --scene data/scenes/test-collage.json --t 0 --out renders/test_start.png
node scripts/render-scene.mjs --scene data/scenes/test-collage.json --t 1 --out renders/test_end.png
```

`--t` 是 0..1 的相机时间,0=`camera_path.from`,1=`camera_path.to`。加 `--preview` 会打开一个可见浏览器窗口,
方便肉眼检查构图对不对,再去正式截图(Preview 模式会挂起进程,Ctrl+C 结束)。

## 4. 跑 fal 实验:`run-experiment.mjs`

对应 PLAN.md Phase 0 的实验 A(首尾帧 vs 纯 prompt)和实验 B(弱运动 vs 强运动)。
模型只能从 `lib/models.ts` 里选(那些是已经用 fal MCP 核实过 schema/价格的候选,脚本不允许现造端点名)。

**实验 A**——同一对 start/end frame,分别喂给 FLF 模型和纯 I2V 模型:

```bash
npm run experiment -- --model kling_flf_standard \
  --start renders/test_start.png --end renders/test_end.png \
  --prompt "camera dolly forward, gneiss stone blocks assembling into a wall, no morphing, no new objects, no architecture changes, preserve printed text, preserve collage layout" \
  --tag expA_flf

npm run experiment -- --model kling_i2v_weak \
  --start renders/test_start.png \
  --prompt "camera dolly forward, gneiss stone blocks assembling into a wall, no morphing, no new objects, no architecture changes, preserve printed text, preserve collage layout" \
  --tag expA_i2v
```

**实验 B**——同一模型、同一对 frame,只改 prompt 里运动强度的措辞,对比弱/强运动谁更保住档案内容:

```bash
npm run experiment -- --model kling_flf_standard --start renders/test_start.png --end renders/test_end.png \
  --prompt "very subtle camera dolly, minimal parallax, ..." --tag expB_weak

npm run experiment -- --model kling_flf_standard --start renders/test_start.png --end renders/test_end.png \
  --prompt "strong camera dolly, pronounced parallax, ..." --tag expB_strong
```

跑完检查 `clips/{tag}.mp4`:人物/建筑有没有漂移、纸边有没有扭曲、印刷文字是否还能读、视差是否成立——这就是
PLAN.md 里实验 A/B 要看的东西。每次调用会在 `data/experiments/{tag}.json` 留一条记录(模型、request_id、
预估成本、参数),方便回头比较。

脚本自带的护栏(都是 CLAUDE.md 里的硬规则,不是这里额外加的):
- `--duration` 超过 5s 直接拒绝跑(hero shot 才允许更长,这个脚本不做 hero shot);
- 预估成本 > $2 会拒绝,除非你确认过了再加 `--yes-i-know-the-cost`;
- 模型计费单位不是"秒"(比如 Vidu 的 credits)时脚本没法自动估算美元成本,会先警告,同样需要 `--yes-i-know-the-cost` 手动确认过。

**没做的事**(故意的,不是漏了):完整 MP4 的多帧确定性合成(`spatial → mp4`)要用到 ffmpeg,当前环境没装,
留到 Phase 1 真正要出全片的时候再补;这不影响现在跑实验,因为 fal 只需要 start/end 两张静帧。
