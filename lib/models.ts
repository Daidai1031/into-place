/**
 * fal 端点常量 —— Phase 0 核实结果(spec/04-shot-router.md 路由表)。
 * 核实方式:fal MCP `search_models` / `get_model_schema` / `get_pricing`,未执行任何生成任务。
 * 核实时间:2026-07-18。价格随时变动,单次真正生成前按 CLAUDE.md 规则 1 重新核价。
 * 详细调研记录见 `data/day0-findings.md`。
 */

export type ShotType =
  | "archive_hold"
  | "parallax_walk"
  | "dolly"
  | "crane_out"
  | "material_transformation"
  | "push_through"
  | "breathing_photo";

export type Engine = "deterministic" | "fal_flf" | "fal_i2v";

export interface FalModel {
  /** fal 端点 ID,已用 get_model_schema 确认存在 */
  endpointId: string;
  displayName: string;
  /** get_pricing 返回的单价 */
  unitPrice: number;
  /** 单价的计费单位:seconds / videos / credits / units / 1m tokens */
  unit: "seconds" | "videos" | "credits" | "units" | "1m tokens";
  /** 首尾帧参数名(fal_flf 引擎必填两者;fal_i2v 只有起始帧) */
  startFrameParam: string;
  endFrameParam?: string;
  maxDurationSeconds: number;
  resolutions: string[];
  /** 是否仅限 hero shot(scene_04 push_through 正片)使用 */
  heroOnly?: boolean;
  /** 单价单位非"seconds"/"videos"时,成本估算前必须先查换算关系,不能直接乘时长 */
  costNeedsConversion?: boolean;
  notes?: string;
}

/** material_transformation / push_through(测试)—— 首尾帧候选,按单价从低到高排列 */
export const KLING_FLF_STANDARD: FalModel = {
  endpointId: "fal-ai/kling-video/o1/standard/image-to-video",
  displayName: "Kling O1 FLF [Standard]",
  unitPrice: 0.084,
  unit: "seconds",
  startFrameParam: "start_image_url",
  endFrameParam: "end_image_url",
  maxDurationSeconds: 10,
  resolutions: [], // 未在 schema 暴露,模型固定输出
  notes: "material_transformation 首选;end_image_url 选填,不填退化为普通 i2v",
};

export const KLING_FLF_PRO: FalModel = {
  endpointId: "fal-ai/kling-video/o1/image-to-video",
  displayName: "Kling O1 FLF [Pro]",
  unitPrice: 0.112,
  unit: "seconds",
  startFrameParam: "start_image_url",
  endFrameParam: "end_image_url",
  maxDurationSeconds: 10,
  resolutions: [],
  notes: "Standard 效果不够时的升级候选",
};

export const KLING_FLF_V25_TURBO_PRO: FalModel = {
  endpointId: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
  displayName: "Kling v2.5 Turbo Pro (image_url + tail_image_url)",
  unitPrice: 0.07,
  unit: "seconds",
  startFrameParam: "image_url",
  endFrameParam: "tail_image_url",
  maxDurationSeconds: 10, // enum: "5" | "10"
  resolutions: [],
  notes: "备用候选;tail_image_url 选填",
};

/** push_through(hero shot 正片)—— 仅当 shot.hero === true 时使用,单次预估需过 $2 阈值检查 */
export const VEO31_FLF_HERO: FalModel = {
  endpointId: "fal-ai/veo3.1/first-last-frame-to-video",
  displayName: "Veo 3.1 (first_frame_url + last_frame_url)",
  unitPrice: 0.4,
  unit: "seconds",
  startFrameParam: "first_frame_url",
  endFrameParam: "last_frame_url",
  maxDurationSeconds: 8, // enum: "4s" | "6s" | "8s"
  resolutions: ["720p", "1080p", "4k"],
  heroOnly: true,
  notes:
    "CLAUDE.md 规则:仅 scene_04 hero shot 可用。8s×720p ≈ $3.2,已超 $2 阈值,生成前必须先向开发者确认。",
};

export const VEO31_FAST_FLF_HERO: FalModel = {
  endpointId: "fal-ai/veo3.1/fast/first-last-frame-to-video",
  displayName: "Veo 3.1 Fast FLF",
  unitPrice: 0.15,
  unit: "seconds",
  startFrameParam: "first_frame_url", // 推断:未逐字段核实 schema,与 Veo3.1 主档同族
  endFrameParam: "last_frame_url",
  maxDurationSeconds: 8,
  resolutions: ["720p", "1080p", "4k"],
  heroOnly: true,
  notes: "8s×720p ≈ $1.2;字段名推断自 Veo3.1 主档,正式调用前应重新跑一次 get_model_schema 确认",
};

/** breathing_photo —— 历史照片微动,弱运动,单帧输入(无 end frame) */
export const KLING_I2V_WEAK: FalModel = {
  endpointId: "fal-ai/kling-video/v2.5-turbo/standard/image-to-video",
  displayName: "Kling v2.5 Turbo Standard (plain i2v)",
  unitPrice: 0.042,
  unit: "seconds",
  startFrameParam: "image_url",
  maxDurationSeconds: 10, // enum: "5" | "10"
  resolutions: [],
  notes: "不传 tail_image_url 即为纯 i2v;弱运动靠 prompt/cfg_scale 控制",
};

export const VIDU_Q1_SMALL: FalModel = {
  endpointId: "fal-ai/vidu/q1/image-to-video",
  displayName: "Vidu Q1 Image to Video (movement_amplitude: small)",
  unitPrice: 0.05,
  unit: "credits",
  startFrameParam: "image_url",
  maxDurationSeconds: 4, // schema 未暴露时长参数,按 Vidu Q1 默认档估算
  resolutions: ["1080p"],
  costNeedsConversion: true,
  notes:
    "计费单位是 credits 不是秒,schema 里没有独立 duration 参数,正式估算成本前需查 credits→USD 换算关系。movement_amplitude 设为 small 以贴近 breathing_photo 弱运动需求。",
};

/** fal_flf 引擎的候选池,router 按顺序尝试,超过 max_attempts(3)即停止改用确定性/换 prompt */
export const FAL_FLF_CANDIDATES: FalModel[] = [
  KLING_FLF_STANDARD,
  KLING_FLF_PRO,
  KLING_FLF_V25_TURBO_PRO,
];

/** fal_i2v 引擎候选池 */
export const FAL_I2V_CANDIDATES: FalModel[] = [KLING_I2V_WEAK, VIDU_Q1_SMALL];

/** push_through 专用:hero(Veo)与测试(Kling FLF)分流 */
export const PUSH_THROUGH_HERO_CANDIDATES: FalModel[] = [
  VEO31_FLF_HERO,
  VEO31_FAST_FLF_HERO,
];
export const PUSH_THROUGH_TEST_CANDIDATES: FalModel[] = FAL_FLF_CANDIDATES;

/**
 * shot_type → 引擎与候选模型池。
 * deterministic 引擎无 fal 模型,models 为空数组。
 */
export const SHOT_ROUTER: Record<
  ShotType,
  { engine: Engine; models: FalModel[] }
> = {
  archive_hold: { engine: "deterministic", models: [] },
  parallax_walk: { engine: "deterministic", models: [] },
  dolly: { engine: "deterministic", models: [] },
  crane_out: { engine: "deterministic", models: [] },
  material_transformation: { engine: "fal_flf", models: FAL_FLF_CANDIDATES },
  push_through: {
    engine: "fal_flf",
    models: [...PUSH_THROUGH_TEST_CANDIDATES, ...PUSH_THROUGH_HERO_CANDIDATES],
  },
  breathing_photo: { engine: "fal_i2v", models: FAL_I2V_CANDIDATES },
};

/** 预算纪律(spec/04):测试参数上限 */
export const TEST_PARAM_CAP = {
  maxDurationSeconds: 5,
  resolution: "720p",
  aspectRatio: "16:9",
} as const;

export const MAX_ATTEMPTS_PER_SHOT = 3;

/** 单次预估成本超过此值必须先询问开发者,不得自动执行(CLAUDE.md 规则 2) */
export const COST_CONFIRMATION_THRESHOLD_USD = 2;
