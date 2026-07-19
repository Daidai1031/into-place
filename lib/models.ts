/**
 * Model registry for the active generated-frame → image-to-video pipeline.
 * Endpoint schemas and pricing must be rechecked with fal before paid calls.
 */

export interface FalModel {
  endpointId: string;
  displayName: string;
  unitPrice: number;
  unit: "seconds" | "videos" | "credits" | "units" | "1m tokens";
  startFrameParam: string;
  maxDurationSeconds: number;
  resolutions: string[];
  heroOnly?: boolean;
  costNeedsConversion?: boolean;
  notes?: string;
}

/** Storyboard frame generation and editing. */
export interface ImageModel {
  endpointId: string;
  displayName: string;
  priceNote: string;
  promptParam: string;
  imageRefsParam?: string;
  /** Param name for aspect ratio / size. */
  aspectRatioParam?: string;
  /**
   * Value to send for a 16:9 frame. Formats differ per family:
   *  - Gemini/Imagen accept the string "16:9".
   *  - FLUX / Seedream accept an { width, height } object (or an enum preset).
   * Defaults to the string "16:9" when omitted.
   */
  aspectRatioValue?: string | { width: number; height: number };
  /** Fixed model-specific params merged into every call (after num_images). */
  extraInput?: Record<string, unknown>;
  supportsEdit: boolean;
  verifyBeforeCall: boolean;
  notes?: string;
}

export const NANO_BANANA_2: ImageModel = {
  endpointId: "fal-ai/nano-banana-2/edit", // verified 2026-07-19: Gemini 3.1 Flash Image, up to 14 image_urls refs. Pure text-to-image sibling: fal-ai/nano-banana-2
  displayName: "nano-banana 2 (edit / reference)",
  priceNote: "~$0.04/image (captured estimate; recheck before use)",
  promptParam: "prompt",
  imageRefsParam: "image_urls",
  aspectRatioParam: "aspect_ratio",
  aspectRatioValue: "16:9",
  supportsEdit: true,
  verifyBeforeCall: true,
  notes: "Primary model for initial frames, dragged assets, and language edits.",
};

export const FLUX_2_PRO: ImageModel = {
  endpointId: "fal-ai/flux-2-pro",
  displayName: "FLUX.2 [pro]",
  priceNote: "$0.03/first MP + $0.015/extra MP (captured estimate)",
  promptParam: "prompt",
  imageRefsParam: "image_urls",
  aspectRatioParam: "image_size",
  // FLUX rejects "16:9" — needs an explicit size (or an enum like landscape_16_9).
  aspectRatioValue: { width: 1280, height: 720 },
  supportsEdit: false,
  verifyBeforeCall: true,
  notes: "High-quality generation candidate; edits fall back to nano-banana 2.",
};

export const SEEDREAM_4: ImageModel = {
  endpointId: "fal-ai/bytedance/seedream/v4/text-to-image",
  displayName: "Seedream 4.0",
  priceNote: "~$0.03/image (captured estimate; recheck via fal MCP before use)",
  promptParam: "prompt",
  // Seedream text-to-image is prompt-only here (no reference sheet).
  aspectRatioParam: "image_size",
  aspectRatioValue: { width: 1280, height: 720 },
  supportsEdit: false,
  verifyBeforeCall: true,
  notes: "ByteDance Seedream 4 candidate; strong photoreal/print look.",
};

export const IMAGEN_4: ImageModel = {
  endpointId: "fal-ai/imagen4/preview",
  displayName: "Imagen 4",
  priceNote: "~$0.04/image (captured estimate; recheck via fal MCP before use)",
  promptParam: "prompt",
  aspectRatioParam: "aspect_ratio",
  aspectRatioValue: "16:9",
  supportsEdit: false,
  verifyBeforeCall: true,
  notes: "Google Imagen 4 candidate; clean text, prompt-only (no reference sheet).",
};

export const T2I_MODELS: Record<string, ImageModel> = {
  "nano-banana-2": NANO_BANANA_2,
  "flux-2-pro": FLUX_2_PRO,
  "seedream-4": SEEDREAM_4,
  "imagen-4": IMAGEN_4,
};
export const T2I_DEFAULT = "nano-banana-2";

/** Video shots: every model receives one approved storyboard frame. */
export const KLING_V3_TURBO_STD_I2V: FalModel = {
  endpointId: "fal-ai/kling-video/v3/turbo/standard/image-to-video",
  displayName: "Kling v3 Turbo Standard (image-to-video)",
  unitPrice: 0.112,
  unit: "seconds",
  startFrameParam: "image_url",
  maxDurationSeconds: 10,
  resolutions: [],
  notes: "Balanced default; five 5-second shots cost about $2.80 at the captured rate.",
};

export const HAPPY_HORSE_I2V: FalModel = {
  endpointId: "alibaba/happy-horse/image-to-video",
  displayName: "Alibaba Happy Horse (image-to-video)",
  unitPrice: 0.14,
  unit: "seconds",
  startFrameParam: "image_url",
  maxDurationSeconds: 15,
  resolutions: ["720p", "1080p"],
  notes: "Budget candidate; captured rate is $0.14/s at 720p.",
};

export const VEO31_I2V_HERO: FalModel = {
  endpointId: "fal-ai/veo3.1/image-to-video",
  displayName: "Veo 3.1 (image-to-video)",
  unitPrice: 0.2,
  unit: "seconds",
  startFrameParam: "image_url",
  maxDurationSeconds: 8,
  resolutions: ["720p", "1080p", "4k"],
  heroOnly: true,
  notes: "Hero-only candidate; requires explicit confirmation before generation.",
};

export const I2V_MODELS: Record<string, FalModel> = {
  "kling-v3-turbo-std": KLING_V3_TURBO_STD_I2V,
  "happy-horse": HAPPY_HORSE_I2V,
  "veo3.1-hero": VEO31_I2V_HERO,
};
export const I2V_DEFAULT = "kling-v3-turbo-std";
export const I2V_BUDGET = "happy-horse";
export const I2V_HERO = "veo3.1-hero";

export const MAX_ATTEMPTS_PER_SHOT = 3;
export const COST_CONFIRMATION_THRESHOLD_USD = 5;
