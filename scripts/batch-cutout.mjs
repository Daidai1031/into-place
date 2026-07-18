#!/usr/bin/env node
// 批量素材处理:assets/archive/* → assets/cutouts/*,并把处理记录写回
// data/places/roosevelt-island.json 每个 asset 的 cutouts 字段(溯源链)。
//
// 分流规则(PLAN.md Step 1):
//   - 版画/地图/整张照片 → mode:paper(撕纸卡,不抠形状)
//   - 建筑/物体需要独立图层 → mode:auto(rembg 抠形)
//   - 黑白档案一律 tone:mono(灰度+对比度归一,统一底色);现代彩色照片 tone:none
//   - asset_013(PDF)跳过,等人工给页码;TIFF 由 cutout.mjs 自动转码
//
// 用法: node scripts/batch-cutout.mjs [--only asset_001,asset_014] [--force]
//   默认跳过已存在的输出;--force 全部重做。

import { cutout } from "./cutout.mjs";
import { readFile, writeFile, rename, access } from "node:fs/promises";
import path from "node:path";

const PLACE_JSON = "data/places/roosevelt-island.json";

// 每一项: { asset, out, part, 以及传给 cutout() 的参数 }
// crop 是 "x,y,w,h" 0..1 比例。asset_001 的 crop 取立体照片左幅(去掉扫描黑底/灰度校准条/黄色卡纸边)。
const JOBS = [
  // —— 立体照片:左幅裁出来做纸卡 + rembg 抠建筑 ——
  { asset: "asset_001", part: "smallpox_card", mode: "paper", tone: "mono", crop: "0.138,0.120,0.358,0.654" },
  { asset: "asset_001", part: "smallpox", mode: "auto", tone: "mono", crop: "0.138,0.120,0.358,0.654" },
  // —— 1853 石版画:重做带统一底色的抠建筑版 + 整张纸卡 ——
  { asset: "asset_002", part: "asylum", mode: "auto", tone: "mono", maxSize: 3840 },
  { asset: "asset_002", part: "asylum_card", mode: "paper", tone: "mono", maxSize: 3840 },
  // —— 1886 地图:远景整张纸,保留手工上色,不加投影(远景层不需要) ——
  { asset: "asset_003", part: "map_bg", mode: "paper", tone: "none", maxSize: 3840, shadow: false, whiteBorder: false },
  // —— 版画/印刷品:统一做撕纸卡 ——
  { asset: "asset_004", part: "asylum1866_card", mode: "paper", tone: "mono", maxSize: 2400 },
  { asset: "asset_005", part: "workhouse_card", mode: "paper", tone: "mono", maxSize: 2400 },
  // 线刻版画不做 mode:auto——试过 asset_006:模型对线刻没有图底概念,输出是一团晕影,
  // 不可用(半调印刷 asset_012 反而可以)。版画一律只走纸卡。
  { asset: "asset_006", part: "penitentiary_card", mode: "paper", tone: "mono", maxSize: 2400 },
  { asset: "asset_007", part: "almshouse_card", mode: "paper", tone: "mono", maxSize: 2400 },
  { asset: "asset_008", part: "darkcell_card", mode: "paper", tone: "mono", maxSize: 2400 },
  { asset: "asset_009", part: "bridgeplan_card", mode: "paper", tone: "mono", maxSize: 2400 },
  { asset: "asset_010", part: "prison_card", mode: "paper", tone: "mono", maxSize: 2400 },
  { asset: "asset_011", part: "penitentiary1834_card", mode: "paper", tone: "mono", maxSize: 2400 },
  { asset: "asset_012", part: "asylum1893_card", mode: "paper", tone: "mono", maxSize: 2400 },
  { asset: "asset_012", part: "asylum1893", mode: "auto", tone: "mono", maxSize: 2400 },
  // asset_013 (PDF) 跳过:等人工给页码,见 data/day0-ri-archive-notes.md
  // —— HABS 黑白照片(asset_014 是 TIFF,自动转码) ——
  { asset: "asset_014", part: "lighthouse1970", mode: "auto", tone: "mono", maxSize: 2400 },
  { asset: "asset_014", part: "lighthouse1970_card", mode: "paper", tone: "mono", maxSize: 2400 },
  { asset: "asset_015", part: "asylum1999_card", mode: "paper", tone: "mono", maxSize: 2400 },
  { asset: "asset_015", part: "asylum1999", mode: "auto", tone: "mono", maxSize: 2400 },
  { asset: "asset_016", part: "farmhouse_card", mode: "paper", tone: "mono", maxSize: 2400 },
  // —— 现代彩色照片:保留彩色,只抠形状(与档案 B&W 形成"现在 vs 过去"对比) ——
  { asset: "asset_017", part: "lighthouse_modern", mode: "auto", tone: "none", maxSize: 2400 },
  { asset: "asset_018", part: "octagon_modern", mode: "auto", tone: "none", maxSize: 2400 },
];

function parseArgs(argv) {
  const args = { force: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--force") args.force = true;
    else if (argv[i] === "--only") args.only = new Set(argv[++i].split(","));
  }
  return args;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

const { force, only } = parseArgs(process.argv.slice(2));
const place = JSON.parse(await readFile(PLACE_JSON, "utf8"));
const byId = new Map(place.assets.map((a) => [a.id, a]));

let ok = 0,
  skipped = 0,
  failed = 0;

for (const job of JOBS) {
  if (only && !only.has(job.asset)) continue;
  const rec = byId.get(job.asset);
  if (!rec) {
    console.error(`✗ ${job.asset}: 不在 ${PLACE_JSON} 里`);
    failed++;
    continue;
  }
  const out = `assets/cutouts/${job.asset}_${job.part}.png`;
  if (!force && (await exists(out))) {
    skipped++;
    continue;
  }
  try {
    await cutout({ input: rec.file, output: out, ...job });
    const entry = {
      file: out,
      mode: job.mode,
      tone: job.tone,
      ...(job.crop ? { crop: job.crop } : {}),
      processing: "deterministic only (crop/resize/grayscale-normalise/torn-edge/shadow); no generative model touched pixels" +
        (job.mode === "auto" ? " except rembg segmentation mask (mask decides transparency, never repaints pixels)" : ""),
    };
    const i = rec.cutouts.findIndex((c) => c.file === out);
    if (i >= 0) rec.cutouts[i] = entry;
    else rec.cutouts.push(entry);
    ok++;
  } catch (err) {
    console.error(`✗ ${out}: ${err.message}`);
    failed++;
  }
}

// 原子写回 manifest
const tmp = PLACE_JSON + ".tmp";
await writeFile(tmp, JSON.stringify(place, null, 2) + "\n");
await rename(tmp, PLACE_JSON);

console.log(`\n完成: ${ok} 成功, ${skipped} 已存在跳过, ${failed} 失败(manifest 已写回 ${PLACE_JSON})`);
if (failed > 0) process.exit(1);
