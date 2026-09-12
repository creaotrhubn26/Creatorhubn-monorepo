import type {
  Keyframe,
  MockupFigureCompositing,
  MockupFigureExpressionId,
  MockupFigurePixelAudit,
  MockupFigurePoseId,
  MockupFigureVariant,
  PersonRigPose,
} from "./mockupStudioModel";

export const FIGURE_POSE_PRESETS: Array<{
  id: MockupFigurePoseId;
  label: string;
  prompt: string;
  rig: Partial<PersonRigPose>;
}> = [
  { id: "neutral", label: "Nøytral", prompt: "relaxed neutral standing pose, arms naturally at the sides", rig: { armSwing: -1, headTilt: 0, leanX: 0, bodyBob: 0 } },
  { id: "presenting", label: "Presenterer", prompt: "confident presenter pose, one open hand indicating content beside the character", rig: { armSwing: 0.72, headTilt: -2, leanX: -1 } },
  { id: "listening", label: "Lytter", prompt: "attentive listening pose with calm open posture", rig: { armSwing: -0.55, headTilt: 5, leanX: 2 } },
  { id: "pointing", label: "Peker", prompt: "clear pointing gesture toward the right, natural shoulder and five-finger hand anatomy", rig: { armSwing: 0.92, headTilt: -4, leanX: -2 } },
  { id: "walking", label: "Går", prompt: "mid-step walking pose with balanced natural gait and readable silhouette", rig: { armSwing: 0.35, legSwing: 0.28, bodyBob: -2, leanX: 3 } },
];

export const FIGURE_EXPRESSION_PRESETS: Array<{
  id: MockupFigureExpressionId;
  label: string;
  prompt: string;
  rig: Partial<PersonRigPose>;
}> = [
  { id: "calm", label: "Rolig", prompt: "calm reassuring expression with a subtle closed-mouth smile", rig: { mouthCurve: 0.45, browRaise: 0.1, eyeSize: 1 } },
  { id: "warm", label: "Varm", prompt: "warm genuine smile and engaged eyes", rig: { mouthCurve: 1, browRaise: 0.25, eyeSize: 1.08 } },
  { id: "focused", label: "Fokusert", prompt: "focused intelligent expression, relaxed jaw and attentive eyes", rig: { mouthCurve: 0.08, browRaise: -0.22, eyeSize: 0.92 } },
  { id: "surprised", label: "Overrasket", prompt: "positive surprised expression with lifted brows, natural facial symmetry", rig: { mouthCurve: 0.25, browRaise: 0.78, eyeSize: 1.35 } },
];

export const DEFAULT_FIGURE_COMPOSITING: MockupFigureCompositing = {
  contactShadow: 0.72,
  rimLight: 0.36,
  ambientMatch: 0.28,
  depthBlur: 0,
  perspective: 0,
  groundOffset: 0.93,
};

export const FIGURE_LAYER_MANIFEST = [
  { id: "contact-shadow", label: "Kontaktskygge", z: 0 },
  { id: "legs-body", label: "Kropp og bein", z: 10 },
  { id: "left-arm-hand", label: "Venstre arm og hånd", z: 20 },
  { id: "right-arm-hand", label: "Høyre arm og hånd", z: 30 },
  { id: "head-face", label: "Hode og ansikt", z: 40 },
  { id: "eyes-mouth", label: "Øyne og munn", z: 50 },
  { id: "hair", label: "Hår", z: 60 },
  { id: "prop", label: "Rekvisitt", z: 70 },
] as const;

export const FIGURE_MOTION_PRESETS: Array<{
  id: string;
  label: string;
  keyframes: Partial<Record<keyof PersonRigPose, Keyframe[]>>;
}> = [
  {
    id: "calm-idle",
    label: "Rolig pust",
    keyframes: {
      bodyBob: [{ t: 0, v: 0 }, { t: 0.5, v: -2, e: "smooth" }, { t: 1, v: 0, e: "smooth" }],
      headTilt: [{ t: 0, v: 0 }, { t: 0.52, v: 1.8, e: "smooth" }, { t: 1, v: 0, e: "smooth" }],
      blink: [{ t: 0, v: 0, e: "hold" }, { t: 0.48, v: 0, e: "hold" }, { t: 0.5, v: 1, e: "hold" }, { t: 0.54, v: 0, e: "hold" }, { t: 1, v: 0 }],
    },
  },
  {
    id: "friendly-wave",
    label: "Vennlig vink",
    keyframes: {
      armSwing: [{ t: 0, v: -0.4 }, { t: 0.28, v: 0.86, e: "out" }, { t: 0.52, v: 0.58, e: "smooth" }, { t: 0.72, v: 0.9, e: "smooth" }, { t: 1, v: -0.4, e: "in" }],
      headTilt: [{ t: 0, v: 0 }, { t: 0.42, v: -5, e: "smooth" }, { t: 1, v: 0, e: "smooth" }],
      mouthCurve: [{ t: 0, v: 0.55 }, { t: 0.35, v: 1, e: "out" }, { t: 1, v: 0.65, e: "smooth" }],
    },
  },
  {
    id: "present-proof",
    label: "Presenter bevis",
    keyframes: {
      leanX: [{ t: 0, v: 2 }, { t: 0.35, v: -2, e: "out" }, { t: 1, v: 0, e: "smooth" }],
      armSwing: [{ t: 0, v: -0.2 }, { t: 0.34, v: 0.82, e: "out" }, { t: 0.82, v: 0.75, e: "hold" }, { t: 1, v: 0.1, e: "in" }],
      browRaise: [{ t: 0, v: 0 }, { t: 0.34, v: 0.28, e: "out" }, { t: 1, v: 0.08, e: "smooth" }],
    },
  },
];

export function appendUniqueFigureVariant(
  variants: MockupFigureVariant[] | undefined,
  next: MockupFigureVariant,
  cap = 8,
): MockupFigureVariant[] {
  const prior = variants ?? [];
  const filtered = prior.filter((item) =>
    next.assetHash ? item.assetHash !== next.assetHash : item.id !== next.id,
  );
  return [...filtered, next].slice(-cap);
}
function rgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000";
  return [1, 3, 5].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as [number, number, number];
}

export function evaluateFigurePixelBuffer(input: {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  primary: string;
  accent: string;
}): MockupFigurePixelAudit {
  const { width, height, data } = input;
  const targets = [rgb(input.primary), rgb(input.accent)];
  let transparent = 0, visible = 0, brand = 0;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    const pixel = i / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (alpha < 12) { transparent += 1; continue; }
    visible += 1;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    if (targets.some(([r, g, b]) => Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b) < 78)) brand += 1;
  }
  const total = Math.max(1, width * height);
  const transparentRatio = transparent / total;
  const visibleRatio = visible / total;
  const edgeMargin = Math.max(2, Math.round(Math.min(width, height) * 0.012));
  const touchesEdge = visible > 0 && (minX <= edgeMargin || minY <= edgeMargin || maxX >= width - 1 - edgeMargin || maxY >= height - 1 - edgeMargin);
  const checks = [
    { id: "resolution", passed: width >= 1024 && height >= 1024, detail: `${width}×${height}px` },
    { id: "alpha", passed: transparentRatio >= 0.02 && visibleRatio >= 0.02, detail: `${Math.round(transparentRatio * 100)} % transparent bakgrunn` },
    { id: "silhouette", passed: visibleRatio >= 0.05 && visibleRatio <= 0.88, detail: `${Math.round(visibleRatio * 100)} % synlig motivflate` },
    { id: "safe-crop", passed: !touchesEdge, detail: touchesEdge ? "Motivet berører sikker kant" : "Motivet har fri sikker kant" },
    { id: "brand-colour", passed: visible > 0 && brand / visible >= 0.002, detail: `${(visible ? (brand / visible) * 100 : 0).toFixed(1)} % brandnære motivpiksler` },
  ];
  return {
    width, height, transparentRatio, visibleRatio,
    brandPixelRatio: visible ? brand / visible : 0,
    touchesEdge,
    passed: checks.every((check) => check.passed),
    checks,
  };
}
