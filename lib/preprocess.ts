export type TonePreset = "source" | "mono" | "sepia";

export type EdgeStyle = "scissor" | "torn" | "none";

export type PreprocessOverride = {
  tone?: TonePreset;
  edge?: EdgeStyle;
};

export type PreprocessSelection = {
  tone?: "defaults" | TonePreset;
  edge?: "defaults" | EdgeStyle;
  overrides?: Record<string, PreprocessOverride>;
};
