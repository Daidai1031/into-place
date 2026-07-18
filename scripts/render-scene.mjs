#!/usr/bin/env node
// spec/04 "确定性引擎(HyperFrames)" 的 Puppeteer 回退实现。
// CLAUDE.md 回退路径:HyperFrames 不可用/太慢 → Puppeteer 截帧 + FFmpeg,场景定义格式不变。
// 这里先只做“单帧渲染”(renderFrame):够用来给 fal FLF 实验截 start/end frame。
// 完整 MP4 合成(多帧 + ffmpeg)留到 Phase 1 真正需要时再补——当前环境没装 ffmpeg,先不強行做。
//
// 用法:
//   node scripts/render-scene.mjs --scene data/scenes/test-collage.json --t 0 --out renders/test_start.png
//   node scripts/render-scene.mjs --scene data/scenes/test-collage.json --t 1 --out renders/test_end.png
//   加 --preview 会打开一个可见的浏览器窗口,方便肉眼检查构图,不会自动退出(Ctrl+C 结束)。

import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { buildSceneHtml, interpolateCamera } from "./lib/scene-template.mjs";

function parseArgs(argv) {
  const args = { width: 1280, height: 720, t: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scene") args.scene = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--t") args.t = Number(argv[++i]);
    else if (a === "--width") args.width = Number(argv[++i]);
    else if (a === "--height") args.height = Number(argv[++i]);
    else if (a === "--preview") args.preview = true;
  }
  return args;
}

/**
 * scene.json 结构(与 spec/01 的 `spatial` 字段一致):
 * {
 *   "planes": [{ "asset": "assets/cutouts/xxx.png", "z": 0.9, "x": 0, "y": 0, "scale": 1.2, "shadow": true }, ...],
 *   "camera_path": { "from": {"z":0,"x":0}, "to": {"z":0.4,"x":0.05}, "easing": "ease-in-out" }
 * }
 * plane.asset 路径按项目根目录(process.cwd() 应该就是仓库根)解析。
 */
export async function renderFrame({ scene: scenePath, out: outPath, t, width = 1280, height = 720, preview = false }) {
  const raw = await readFile(scenePath, "utf-8");
  const scene = JSON.parse(raw);

  if (!Array.isArray(scene.planes) || scene.planes.length === 0) {
    throw new Error(`${scenePath} 里没有 planes,场景至少要有一层`);
  }

  const projectRoot = process.cwd();
  const planes = scene.planes.map((p) => {
    const abs = path.resolve(projectRoot, p.asset);
    // 必须转成 file:// URL 再传给 Chromium,并且必须用 page.goto() 加载(见下)——
    // page.setContent() 生成的文档 origin 是 about:blank,Chromium 会拒绝它引用本地 file:// 图片,
    // 截屏出来全是"图片加载失败"占位符。用 goto() 打开一个真正 file:// 起源的临时 HTML 文件就没有这个限制。
    return { ...p, asset: pathToFileURL(abs).href };
  });

  const camera = interpolateCamera(scene.camera_path ?? { from: {}, to: {} }, t);
  const html = buildSceneHtml({ planes, camera, width, height });

  const tmpHtmlPath = path.join(os.tmpdir(), `into-place-scene-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  await writeFile(tmpHtmlPath, html, "utf-8");

  // 云端容器以 root 运行时 Chromium 拒绝带沙箱启动;只在这种情况下关沙箱(本机开发不受影响)
  const browser = await puppeteer.launch({
    headless: !preview,
    args: typeof process.getuid === "function" && process.getuid() === 0 ? ["--no-sandbox"] : [],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(tmpHtmlPath).href, { waitUntil: "networkidle0" });

    if (preview) {
      console.log("Preview 模式:窗口已打开,肉眼检查构图,Ctrl+C 结束进程。");
      await new Promise(() => {});
    }

    await mkdir(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath });
    console.log(`✓ t=${t} → ${outPath}`);
    return outPath;
  } finally {
    if (!preview) {
      await browser.close();
      await rm(tmpHtmlPath, { force: true });
    }
  }
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.scene || !args.out) {
    console.error(
      "用法: node scripts/render-scene.mjs --scene data/scenes/test-collage.json --t 0 --out renders/test_start.png [--preview]"
    );
    process.exit(1);
  }
  renderFrame(args).catch((err) => {
    console.error("渲染失败:", err.message);
    process.exit(1);
  });
}
