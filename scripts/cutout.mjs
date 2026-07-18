#!/usr/bin/env node
// 从一张原始档案图裁出一个可用于拼贴的图层:抠图(rembg)+ 撕纸毛边 + 投影 + 纸张白边。
// 输出是透明背景 PNG,写到 assets/cutouts/{asset_id}_{part}.png —— 这张 PNG 之后就是这一层的
// 唯一源文件,场景渲染(render-scene.mjs)只读它。不要为了"调效果"而去改渲染出来的截图,
// 永远回来改这张 PNG 或调这里的参数、重新跑 cutout。
//
// 用法:
//   node scripts/cutout.mjs --in assets/archive/asset_002.jpg --out assets/cutouts/asset_002_asylum.png
//   如果输入已经是手工抠好的透明 PNG(比如 Figma 导出),会自动跳过 rembg 这一步。
//
// 依赖:本地要能跑 `rembg` 命令(仅当输入还没有 alpha 通道时才需要):
//   pip install rembg[cli] onnxruntime
// 第一次跑会自动下载一个分割模型(几十 MB),之后离线可用。

import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const args = {
    tornEdge: true,
    shadow: true,
    whiteBorder: true,
    shadowOffsetX: 6,
    shadowOffsetY: 10,
    shadowBlur: 14,
    shadowOpacity: 0.35,
    borderWidth: 2,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") args.input = argv[++i];
    else if (a === "--out") args.output = argv[++i];
    else if (a === "--no-torn-edge") args.tornEdge = false;
    else if (a === "--no-shadow") args.shadow = false;
    else if (a === "--no-border") args.whiteBorder = false;
  }
  return args;
}

async function hasAlpha(inputPath) {
  const meta = await sharp(inputPath).metadata();
  return meta.hasAlpha === true;
}

async function runRembg(inputPath, outputPath) {
  try {
    await execFileAsync("rembg", ["i", inputPath, outputPath]);
  } catch (err) {
    throw new Error(
      "本地找不到 rembg 命令,或执行失败。\n" +
        "先跑一次: pip install rembg[cli] onnxruntime\n" +
        "如果你已经在 Figma/Photoshop 里手工抠好透明背景的 PNG,把 --in 换成那张图就行,脚本会自动跳过这一步。\n" +
        "原始错误: " +
        err.message
    );
  }
}

/**
 * 用"缩小再放大 + 阈值化"给 alpha 通道边缘制造粗糙的撕纸感:
 * 把 alpha 缩到一个很小的网格再放大回原尺寸(丢失细节,边界变成粗糙的方块状轮廓),
 * 跟原始 alpha 做逐像素取交集,只有内部保持实心,边界因为两者错位而变得参差不齐。
 * 全部用 sharp 内置操作,没有手写像素循环。
 */
async function applyTornEdge(alphaPngBuffer, width, height, jitterCell = 22) {
  const gridW = Math.max(6, Math.round(width / jitterCell));
  const gridH = Math.max(6, Math.round(height / jitterCell));

  const original = await sharp(alphaPngBuffer).threshold(140).png().toBuffer();
  const jittered = await sharp(alphaPngBuffer)
    .resize(gridW, gridH, { fit: "fill" })
    .resize(width, height, { fit: "fill", kernel: "nearest" })
    .blur(Math.max(1, Math.round(jitterCell / 4)))
    .threshold(140)
    .png()
    .toBuffer();

  // multiply: 两边都是 255 的地方才保留 255,制造锯齿边缘
  return sharp(original).composite([{ input: jittered, blend: "multiply" }]).png().toBuffer();
}

export async function cutout({
  input,
  output,
  tornEdge = true,
  shadow = true,
  whiteBorder = true,
  shadowOffsetX = 6,
  shadowOffsetY = 10,
  shadowBlur = 14,
  shadowOpacity = 0.35,
  borderWidth = 2,
}) {
  if (!input || !output) throw new Error("cutout() 需要 input 和 output 路径");

  let mattedPath = input;
  if (!(await hasAlpha(input))) {
    const tmpDir = path.join(os.tmpdir(), "into-place-cutout");
    await mkdir(tmpDir, { recursive: true });
    mattedPath = path.join(tmpDir, `${path.parse(input).name}_matted.png`);
    await runRembg(input, mattedPath);
  }

  const { width, height } = await sharp(mattedPath).metadata();
  // 全程用 PNG 编码的 buffer 传来传去,不手写 raw 字节/通道数——那是上一版做出满屏噪点花纹的原因。
  const originalRgba = await sharp(mattedPath).ensureAlpha().png().toBuffer();

  const alphaMask = await sharp(originalRgba).extractChannel("alpha").png().toBuffer();
  const finalMask = tornEdge ? await applyTornEdge(alphaMask, width, height) : alphaMask;

  // 把裁切结果的 alpha 换成毛边版:去掉原 alpha,再拿新蒙版当唯一新增通道 join 回去
  const cutoutBuf = await sharp(originalRgba).removeAlpha().joinChannel(finalMask).png().toBuffer();

  const pad = shadow || whiteBorder ? shadowBlur + Math.max(shadowOffsetX, shadowOffsetY) + borderWidth + 6 : 0;
  const canvasW = width + pad * 2;
  const canvasH = height + pad * 2;

  if (pad === 0) {
    await mkdir(path.dirname(output), { recursive: true });
    await sharp(cutoutBuf).toFile(output);
    console.log(`✓ ${output}(无投影/白边,${width}x${height})`);
    return output;
  }

  const composites = [];

  if (whiteBorder) {
    // 把蒙版稍微膨胀一点(模糊再阈值化=近似膨胀),填白,垫在裁切图下面当纸边。
    // 注意:用 joinChannel 把蒙版的灰度值直接当 alpha 通道装上去,不要用 composite(blend:"dest-in")——
    // dest-in 认的是输入图自己的 alpha 通道,而蒙版是没有 alpha 的纯灰度图,会被当成"处处不透明",
    // 结果是整块方形都被保留下来,不会呈现蒙版的实际形状(这是调试时真正踩到的坑)。
    const dilatedMask = await sharp(finalMask).blur(borderWidth * 1.5).threshold(30).png().toBuffer();
    const whiteSilhouette = await sharp({
      create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .joinChannel(dilatedMask)
      .png()
      .toBuffer();
    composites.push({ input: whiteSilhouette, left: pad, top: pad });
  }

  if (shadow) {
    // 黑色剪影(同样用 joinChannel 把蒙版当 alpha 装上,理由同上)
    const blackSilhouette = await sharp({
      create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .joinChannel(finalMask)
      .png()
      .toBuffer();

    // 非对称扩边:把黑色剪影在自己的画布里就先挪到 (offsetX, offsetY) 的位置,
    // 这样最后把这张和最终画布一样大的图直接叠在 (0,0),视觉上就等于投影偏移了 offsetX/offsetY,
    // 不需要再用负数坐标去 composite(sharp 不允许负偏移)。
    const expandedShadowPng = await sharp(blackSilhouette)
      .extend({
        top: pad + shadowOffsetY,
        bottom: pad - shadowOffsetY,
        left: pad + shadowOffsetX,
        right: pad - shadowOffsetX,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .blur(shadowBlur)
      .png()
      .toBuffer();

    // alpha 通道整体乘 shadowOpacity,降低投影浓度
    const dimmedAlpha = await sharp(expandedShadowPng)
      .extractChannel("alpha")
      .linear(shadowOpacity, 0)
      .png()
      .toBuffer();
    const dimmedShadow = await sharp(expandedShadowPng).removeAlpha().joinChannel(dimmedAlpha).png().toBuffer();

    composites.push({ input: dimmedShadow, left: 0, top: 0 });
  }

  composites.push({ input: cutoutBuf, left: pad, top: pad });

  await mkdir(path.dirname(output), { recursive: true });
  await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toFile(output);

  console.log(`✓ ${output}(${canvasW}x${canvasH},含 ${pad}px 边距用于投影/白边)`);
  return output;
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output) {
    console.error("用法: node scripts/cutout.mjs --in assets/archive/xxx.jpg --out assets/cutouts/xxx_part.png [--no-torn-edge] [--no-shadow] [--no-border]");
    process.exit(1);
  }
  cutout(args).catch((err) => {
    console.error("抠图失败:", err.message);
    process.exit(1);
  });
}
