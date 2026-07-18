# 拼贴渲染工具链(Phase 0 提前写好,Phase 1 会直接复用)

三个脚本,对应 spec/05 的预处理约定 + spec/04 的确定性引擎(Puppeteer 回退实现,格式和真正接 HyperFrames CLI 时一致)。

**硬规则:分层文件(`assets/cutouts/*.png` + `data/scenes/*.json`)永远是场景的唯一源文件。**
`render-scene.mjs` 只做单向渲染(层 → 拍平的帧),渲染出来的截图只能喂给 fal 当 start/end frame,或剪进最终成片——
不允许把渲染结果再拿去给任何抠图/分割模型往回找层。要改构图就去改 `.json` 里的 `z/x/y/scale`,或者换一张 `cutouts/*.png`,重新渲染。

## 0. 一次性准备

```bash
npm install                      # 装 sharp / puppeteer / tsx / @fal-ai/client
cp .env.local.example .env.local # 填 FAL_KEY=你的key,这个文件已在 .gitignore 里
```

`assets/cutouts/*.png` 抠图如果输入还没有透明背景,需要本地能跑 `rembg`:
```bash
pip install rembg[cli] onnxruntime   # 第一次会下一个几十 MB 的分割模型,之后离线可用
```
如果你已经在 Figma/Photoshop 里手工抠好透明 PNG,直接把那张图当 `--in` 传进去,脚本会自动跳过 rembg。

## 1. 抠图:`cutout.mjs`

```bash
node scripts/cutout.mjs --in assets/archive/asset_002.jpg --out assets/cutouts/asset_002_asylum.png
```

做的事:预处理(可选 `--crop`/`--max-size`)→ 抠图(必要时)→ 统一底色(可选 `--tone`)→ 撕纸毛边(缩放阈值化制造锯齿,不是简单裁矩形)→ 投影 → 1-2px 白边(纸张厚度感)。
默认参数是给中等大小图层调的,效果太糊/太碎用 `--no-torn-edge` / `--no-shadow` / `--no-border` 关掉某一步单独看。

新增参数:
- `--mode paper`:整张纸片化(版画/地图/整幅照片),不跑 rembg,alpha 全不透明,毛边/白边/投影照常;
- `--tone mono|sepia`:**统一底色**。档案扫描件纸色从亮黄(立体照片卡)到中性灰差异很大,`mono` = 灰度 + 对比度归一;`sepia` = 在 mono 基础上加同一组暖调 tint。全部是确定性像素操作,不碰"档案零生成式处理"红线;
- `--crop x,y,w,h`(0..1 比例):预裁剪,去扫描黑底/灰度校准条,或立体照片取单幅;
- `--max-size N`:长边上限,35–41MB 的超大扫描先缩到可用尺寸。TIFF 输入自动转码。

## 1.5 批量处理:`batch-cutout.mjs`

```bash
node scripts/batch-cutout.mjs            # 跳过已存在的输出(幂等,断点续跑)
node scripts/batch-cutout.mjs --force    # 全部重做
node scripts/batch-cutout.mjs --only asset_001,asset_014
```

分流计划写在脚本顶部的 `JOBS` 表里(哪个素材做纸卡、哪个 rembg 抠建筑、用什么 tone)。每个成功的输出会写回
`data/places/roosevelt-island.json` 对应 asset 的 `cutouts` 字段(文件、mode、tone、处理说明),保住溯源链。
asset_013(PDF)故意不在表里——等人工给页码。

**已知环境限制**:云端容器的网络策略只放行包管理源(npm/pypi),rembg 首次运行要从 GitHub 下载 u2net.onnx
会被 403 拦截——`mode:paper` 的任务不受影响,`mode:auto`(抠形)的任务需要在本机跑一次
`node scripts/batch-cutout.mjs`(幂等,只会补做缺的那几张),或在环境设置里放行 `github.com` 后重跑。

## 2. 拼场景:手写 `data/scenes/*.json`

跟 spec/01 的 `spatial` 字段是同一个结构,例子:

```jsonc
{
  "planes": [
    { "asset": "assets/cutouts/asset_010_torn_paper_fg.png", "z": 0.9, "x": 0, "y": 0.1, "scale": 1.2, "shadow": true },
    { "asset": "assets/cutouts/asset_002_asylum.png", "z": 0.5, "x": 0, "y": 0, "scale": 1.0, "shadow": true },
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
