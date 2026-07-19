# 素材预处理与 I2V 实验工具

这里的脚本负责两件事：把有来源的档案处理成审核后的 collage 图层，以及用一张审核后的 storyboard frame 运行 fal image-to-video 实验。视频主路径不依赖独立的分层渲染器或 headless browser。

## 0. 一次性准备

```bash
npm install
cp .env.local.example .env.local # 填 FAL_KEY；不要提交该文件
```

fal mask 不可用时会回退本地 rembg / silueta，开发机可选安装：

```bash
pip install rembg[cli] onnxruntime
```

## 1. 预处理核心：`cutout.mjs`

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

固定顺序：EXIF 摆正 → recipe crop → resize（只缩小）→ tone → 应用缓存 mask → edge → 白边 / 阴影 → QA。RGB 始终来自本地原图；fal mask 只替换 alpha。

- `role:card`：保留 crop 内整幅内容，默认 `torn`。
- `role:cutout`：使用主体 alpha，默认 `scissor`。
- `role:bg`：默认 `none`，无边缘和阴影。
- `source` 保留本地颜色；`mono` 做中性黑白；`sepia` 在 mono 上加固定暖调。
- `maxSize` 只是长边上限，始终禁止放大。

## 2. 批量处理：`batch-cutout.mjs`

```bash
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --dry-run
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --only asset_001,asset_014
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --force
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --only asset_014 --refresh-mask
node --env-file-if-exists=.env.local scripts/batch-cutout.mjs --tone sepia --edge scissor
node scripts/preprocess-contact-sheet.mjs
```

分流统一定义在 `data/preprocess/roosevelt-island.json`：

- `--dry-run` 只校验，不写文件、不调用 fal。
- `--force` 只重做本地像素阶段；只有 `--refresh-mask` 会重新请求付费 mask。
- fal SAM 请求必须设置 `apply_mask:false`，失败顺序为 SAM → silueta/rembg → 裁剪纸卡。
- 输出统一使用 `*_card.png`、`*_cutout.png`、`*_bg.png`。
- contact sheet 拒绝的 recipe 必须设置 `review.visual: rejected`、`publish:false` 和 `fallbackRecipeId`。
- mask、provenance、hash、request ID、参数与成本分别保存在 `data/preprocess/` 对应目录。

## 3. Manual collage 静态导出

Manual collage 在进入视频生成前必须导出为一张 1280×720 PNG：

1. 首选在浏览器中从 `CollageCanvas` 导出；
2. 如果外部图片 CORS 或浏览器差异导致导出不稳定，使用服务端 Sharp 按 `BeatLayout.items` 合成；
3. 只允许使用已通过视觉审核的 cutout 和用户笔迹；
4. 导出结果是 I2V start frame，不得再送回抠图 / 分割模型反向找层。

对应导出脚本 / route 尚待实现，见 `PLAN.md`。

## 4. I2V 实验：`run-experiment.mjs`

实验输入是一张已经审核的 generated frame 或 manual collage PNG。模型只能从 `lib/models.ts` 的 `I2V_MODELS` 选择；付费前必须重新核实 schema 和当日价格。

```bash
npm run experiment -- \
  --model kling-v3-turbo-std \
  --start renders/beat_01.png \
  --prompt "slow camera push in. the paper boat moves gently across the river. preserve printed text, preserve collage layout, no new objects, no morphing" \
  --duration 5 \
  --tag beat_01_kling_a
```

可用模型 key 以 `lib/models.ts` 为准。Hero 模型、无法自动换算价格的模型或单次预估超过 $5 的调用需要先确认，再显式添加 `--yes-i-know-the-cost`。

输出：

- `clips/{tag}.mp4`：模型返回的视频；
- `data/experiments/{tag}.json`：模型、request ID、参数、预估成本与输出路径。

每个正式镜头最多尝试 3 次。之后应修改 storyboard frame、动作或 prompt，而不是继续重 roll。
