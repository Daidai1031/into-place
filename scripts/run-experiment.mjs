#!/usr/bin/env node
// Phase 0 实验 A/B 的最小跑法:拿 render-scene.mjs 截出来的 start/end frame,
// 提交给 lib/models.ts 里已经用 fal MCP 核实过 schema/价格的候选模型,不自己现造端点名。
//
// 强制走 queue 模式(fal.subscribe 内部就是 submit + 轮询,不是同步等待),
// 5s/720p 上限、每次调用成本上限检查、request_id/模型/成本全部记进 data/experiments/ 下的日志 —— 这些是
// CLAUDE.md「fal 使用纪律」的硬要求,不是这个脚本自己加的可选项。
//
// 运行前(只需一次):
//   1. 在项目根目录建 .env.local,写一行 FAL_KEY=你的key(不要提交到 git,.gitignore 已经排除)。
//   2. npm install(如果还没装依赖)。
//
// 用法——实验 A:同一 collage,FLF 模型 vs 纯 I2V 模型对比:
//   node --env-file-if-exists=.env.local --import tsx scripts/run-experiment.mjs \
//     --model kling_flf_standard \
//     --start renders/test_start.png --end renders/test_end.png \
//     --prompt "camera dolly forward, gneiss stone blocks assembling into a wall, no morphing, no new objects" \
//     --tag expA_flf
//
//   node --env-file-if-exists=.env.local --import tsx scripts/run-experiment.mjs \
//     --model kling_i2v_weak \
//     --start renders/test_start.png \
//     --prompt "camera dolly forward, gneiss stone blocks assembling into a wall, no morphing, no new objects" \
//     --tag expA_i2v
//
// 用法——实验 B:同一对 start/end frame,同一模型,只改 prompt 里的运动强度描述,对比弱/强运动:
//   ...--tag expB_weak / --tag expB_strong,自己在 --prompt 里改措辞,脚本不替你editorialize prompt。
//
// --model 可选值见下面 MODEL_REGISTRY(直接对应 lib/models.ts 里已核实的常量,不在这里新增未核实的端点)。

import { fal } from "@fal-ai/client";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  KLING_FLF_STANDARD,
  KLING_FLF_PRO,
  KLING_FLF_V25_TURBO_PRO,
  KLING_I2V_WEAK,
  VIDU_Q1_SMALL,
  TEST_PARAM_CAP,
  COST_CONFIRMATION_THRESHOLD_USD,
} from "../lib/models.ts";

const MODEL_REGISTRY = {
  kling_flf_standard: KLING_FLF_STANDARD,
  kling_flf_pro: KLING_FLF_PRO,
  kling_flf_v25turbo: KLING_FLF_V25_TURBO_PRO,
  kling_i2v_weak: KLING_I2V_WEAK,
  vidu_q1_small: VIDU_Q1_SMALL,
};

function parseArgs(argv) {
  const args = { duration: TEST_PARAM_CAP.maxDurationSeconds };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--model") args.model = argv[++i];
    else if (a === "--start") args.start = argv[++i];
    else if (a === "--end") args.end = argv[++i];
    else if (a === "--prompt") args.prompt = argv[++i];
    else if (a === "--tag") args.tag = argv[++i];
    else if (a === "--duration") args.duration = Number(argv[++i]);
    else if (a === "--yes-i-know-the-cost") args.confirmed = true;
  }
  return args;
}

function estimateCostUsd(model, durationSeconds) {
  if (model.unit === "seconds") return model.unitPrice * durationSeconds;
  if (model.unit === "videos") return model.unitPrice;
  return null; // credits / units / 1m tokens: 单价单位不是秒,不能简单相乘,交给人工核实
}

async function uploadLocalImage(filePath) {
  const buf = await readFile(filePath);
  const ext = path.extname(filePath).slice(1) || "png";
  const file = new File([buf], path.basename(filePath), { type: `image/${ext === "jpg" ? "jpeg" : ext}` });
  return fal.storage.upload(file);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.model || !MODEL_REGISTRY[args.model]) {
    console.error(
      `--model 必须是: ${Object.keys(MODEL_REGISTRY).join(", ")}\n` +
        "(这些都是 lib/models.ts 里已经用 fal MCP 核实过 schema/价格的候选,不在这里现造新端点)"
    );
    process.exit(1);
  }
  if (!args.start || !args.prompt || !args.tag) {
    console.error("必须传 --start --prompt --tag(--end 可选,只有 FLF 模型需要)");
    process.exit(1);
  }

  const model = MODEL_REGISTRY[args.model];
  const duration = args.duration;

  // 预算纪律(spec/04):测试参数上限 5s/720p/16:9,不接受更大的
  if (duration > TEST_PARAM_CAP.maxDurationSeconds) {
    console.error(
      `--duration ${duration}s 超过测试上限 ${TEST_PARAM_CAP.maxDurationSeconds}s。hero shot 才允许更长,这个脚本不做 hero shot。`
    );
    process.exit(1);
  }

  const estCost = estimateCostUsd(model, duration);
  if (estCost === null) {
    console.warn(
      `⚠ ${model.endpointId} 的计费单位是 "${model.unit}",不是按秒计价,脚本没法自动估算这次调用的美元成本。\n` +
        "先去 fal 控制台或用 fal MCP 的 get_pricing 手动核实一次,确认不会超过 $2,再加 --yes-i-know-the-cost 继续。"
    );
    if (!args.confirmed) process.exit(1);
  } else if (estCost > COST_CONFIRMATION_THRESHOLD_USD) {
    console.error(
      `⚠ 预估成本 $${estCost.toFixed(2)} 超过 $${COST_CONFIRMATION_THRESHOLD_USD} 阈值(CLAUDE.md 规则:单次 >$2 必须先问开发者)。\n` +
        "这个脚本不会替你确认——如果你已经确认过了,加 --yes-i-know-the-cost 再跑一次。"
    );
    if (!args.confirmed) process.exit(1);
  } else {
    console.log(`预估成本: $${estCost.toFixed(3)}(${model.endpointId}, ${duration}s)`);
  }

  if (!process.env.FAL_KEY) {
    console.error("没读到 FAL_KEY。检查 .env.local 是否存在、是否有一行 FAL_KEY=...,并且用 --env-file-if-exists=.env.local 启动。");
    process.exit(1);
  }
  fal.config({ credentials: process.env.FAL_KEY });

  console.log(`上传 start frame: ${args.start}`);
  const startUrl = await uploadLocalImage(args.start);

  let endUrl;
  if (args.end) {
    console.log(`上传 end frame: ${args.end}`);
    endUrl = await uploadLocalImage(args.end);
  }
  if (model.endFrameParam && !endUrl) {
    console.error(`${model.endpointId} 是首尾帧模型(${model.endFrameParam}),必须传 --end`);
    process.exit(1);
  }

  const input = {
    [model.startFrameParam]: startUrl,
    prompt: args.prompt,
    duration: String(duration),
  };
  if (model.endFrameParam && endUrl) input[model.endFrameParam] = endUrl;

  console.log(`提交到 ${model.endpointId} ...(queue 模式,轮询状态)`);
  const result = await fal.subscribe(model.endpointId, {
    input,
    logs: true,
    onQueueUpdate: (update) => {
      console.log(`  [${update.status}]`, update.logs?.map((l) => l.message).join(" | ") ?? "");
    },
  });

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) {
    console.error("没有拿到 video URL,完整返回结构:", JSON.stringify(result.data, null, 2));
    process.exit(1);
  }

  const outDir = "clips";
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${args.tag}.mp4`);
  const videoRes = await fetch(videoUrl);
  const videoBuf = Buffer.from(await videoRes.arrayBuffer());
  await writeFile(outPath, videoBuf);
  console.log(`✓ 下载完成: ${outPath}`);

  // 可追溯性(CLAUDE.md:request_id、模型、参数、成本必须记下来)
  await mkdir("data/experiments", { recursive: true });
  const logPath = path.join("data/experiments", `${args.tag}.json`);
  await writeFile(
    logPath,
    JSON.stringify(
      {
        tag: args.tag,
        model: model.endpointId,
        request_id: result.requestId ?? null,
        input: { ...input, [model.startFrameParam]: "(uploaded)", ...(model.endFrameParam ? { [model.endFrameParam]: "(uploaded)" } : {}) },
        duration_seconds: duration,
        estimated_cost_usd: estCost,
        output: outPath,
        created_at: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`✓ 实验记录: ${logPath}`);
}

main().catch((err) => {
  console.error("实验失败:", err.message);
  process.exit(1);
});
