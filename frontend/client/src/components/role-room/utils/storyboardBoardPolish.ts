import type {
  StoryboardDocumentBoardPolishEffectLayerId,
  StoryboardDocumentBoardPolishEffectLayerState,
  StoryboardDocumentBoardPolishEffectRegion,
  StoryboardDocumentBoardPolishFinish,
  StoryboardDocumentBoardPolishState,
  StoryboardDocumentBoardPolishTone,
  StoryboardDocumentBoardPolishWeather,
} from '../state/storyboardDrawingDocument';

export type BoardPolishDraftState = Omit<StoryboardDocumentBoardPolishState, 'updatedAt'>;
export type BoardPolishEffectLayerId = StoryboardDocumentBoardPolishEffectLayerId;
export type BoardPolishEffectRegion = StoryboardDocumentBoardPolishEffectRegion;

export interface BoardPolishEffectLayer {
  id: BoardPolishEffectLayerId;
  label: string;
  summary: string;
  background: string;
  mixBlendMode: 'screen' | 'soft-light' | 'multiply';
  opacity: number;
  enabled: boolean;
  region: BoardPolishEffectRegion;
}

export interface BoardPolishEffectRegionPreset {
  id: 'full' | 'focus' | 'lower' | 'wide';
  label: string;
  description: string;
  region: Omit<BoardPolishEffectRegion, 'id'>;
}

const BOARD_POLISH_EFFECT_LAYER_IDS: BoardPolishEffectLayerId[] = ['atmosphere', 'weather', 'finish', 'vignette'];
const BOARD_POLISH_EFFECT_REGION_DEFAULTS: BoardPolishEffectRegion[] = [
  { id: 'atmosphere', xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1, feather: 0.34 },
  { id: 'weather', xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1, feather: 0.24 },
  { id: 'finish', xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1, feather: 0.12 },
  { id: 'vignette', xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1, feather: 0.08 },
];

export const BOARD_POLISH_EFFECT_REGION_PRESETS: BoardPolishEffectRegionPreset[] = [
  {
    id: 'full',
    label: 'Full',
    description: 'Uses the full board frame.',
    region: { xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1, feather: 0.18 },
  },
  {
    id: 'focus',
    label: 'Focus',
    description: 'Concentrates the pass around the central read.',
    region: { xRatio: 0.18, yRatio: 0.12, widthRatio: 0.64, heightRatio: 0.56, feather: 0.22 },
  },
  {
    id: 'lower',
    label: 'Lower',
    description: 'Biases the pass toward the ground and lower depth.',
    region: { xRatio: 0.08, yRatio: 0.46, widthRatio: 0.84, heightRatio: 0.42, feather: 0.18 },
  },
  {
    id: 'wide',
    label: 'Wide',
    description: 'Stages a long horizontal band for beams, haze, or rain.',
    region: { xRatio: 0.08, yRatio: 0.24, widthRatio: 0.84, heightRatio: 0.34, feather: 0.18 },
  },
];

const clampUnit = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, value));
};

export function createBoardPolishEffectLayerStates(
  value: Partial<StoryboardDocumentBoardPolishEffectLayerState>[] = [],
): StoryboardDocumentBoardPolishEffectLayerState[] {
  return BOARD_POLISH_EFFECT_LAYER_IDS.map((id) => {
    const matchedValue = value.find((entry) => entry?.id === id);
    return {
      id,
      enabled: matchedValue?.enabled ?? true,
      opacity: clampUnit(matchedValue?.opacity ?? 1, 1),
    };
  });
}

export function createBoardPolishEffectRegions(
  value: Partial<StoryboardDocumentBoardPolishEffectRegion>[] = [],
): StoryboardDocumentBoardPolishEffectRegion[] {
  return BOARD_POLISH_EFFECT_REGION_DEFAULTS.map((fallbackRegion) => {
    const matchedValue = value.find((entry) => entry?.id === fallbackRegion.id);
    const widthRatio = typeof matchedValue?.widthRatio === 'number'
      ? Math.max(0.08, Math.min(1, matchedValue.widthRatio))
      : fallbackRegion.widthRatio;
    const heightRatio = typeof matchedValue?.heightRatio === 'number'
      ? Math.max(0.08, Math.min(1, matchedValue.heightRatio))
      : fallbackRegion.heightRatio;
    const xRatio = typeof matchedValue?.xRatio === 'number'
      ? Math.max(0, Math.min(1 - widthRatio, matchedValue.xRatio))
      : fallbackRegion.xRatio;
    const yRatio = typeof matchedValue?.yRatio === 'number'
      ? Math.max(0, Math.min(1 - heightRatio, matchedValue.yRatio))
      : fallbackRegion.yRatio;
    return {
      id: fallbackRegion.id,
      xRatio,
      yRatio,
      widthRatio,
      heightRatio,
      feather:
        typeof matchedValue?.feather === 'number'
          ? Math.max(0, Math.min(0.48, matchedValue.feather))
          : fallbackRegion.feather,
    };
  });
}

export const STUDIO_BOARD_POLISH_TONES: StoryboardDocumentBoardPolishTone[] = ['neutral', 'noir', 'amber'];
export const STUDIO_BOARD_POLISH_FINISHES: StoryboardDocumentBoardPolishFinish[] = ['clean', 'hatch', 'marker'];
export const STUDIO_BOARD_POLISH_WEATHER_OPTIONS: StoryboardDocumentBoardPolishWeather[] = ['none', 'mist', 'rain'];

export const STUDIO_BOARD_POLISH_DEFAULTS: BoardPolishDraftState = {
  mode: 'edit',
  tone: 'noir',
  finish: 'clean',
  weather: 'none',
  atmosphere: 0.36,
  lineBoost: 0.42,
  vignette: 0.54,
  effectLayers: createBoardPolishEffectLayerStates(),
  effectRegions: createBoardPolishEffectRegions(),
};

export const STUDIO_BOARD_POLISH_TONE_CONFIG: Record<StoryboardDocumentBoardPolishTone, {
  label: string;
  shellBackground: string;
  canvasFilter: string;
  vignetteColor: string;
  grainOpacity: number;
}> = {
  neutral: {
    label: 'Neutral',
    shellBackground: 'radial-gradient(circle at top, rgba(255,255,255,0.03), transparent 42%), linear-gradient(180deg, rgba(3,7,18,0.98), rgba(2,4,9,0.98))',
    canvasFilter: 'contrast(1.06) brightness(1.02)',
    vignetteColor: 'rgba(2,6,23,0.68)',
    grainOpacity: 0.12,
  },
  noir: {
    label: 'Noir',
    shellBackground: 'radial-gradient(circle at top, rgba(245,158,11,0.04), transparent 38%), linear-gradient(180deg, rgba(3,6,16,0.99), rgba(1,3,8,1))',
    canvasFilter: 'contrast(1.16) brightness(1.03) saturate(0.88) drop-shadow(0 0 1px rgba(248,250,252,0.36))',
    vignetteColor: 'rgba(2,6,23,0.82)',
    grainOpacity: 0.16,
  },
  amber: {
    label: 'Amber',
    shellBackground: 'radial-gradient(circle at top, rgba(251,191,36,0.06), transparent 40%), linear-gradient(180deg, rgba(12,10,7,0.98), rgba(4,4,6,1))',
    canvasFilter: 'contrast(1.12) brightness(1.04) saturate(1.06) sepia(0.08) drop-shadow(0 0 1px rgba(251,191,36,0.22))',
    vignetteColor: 'rgba(22,16,7,0.76)',
    grainOpacity: 0.18,
  },
};

export const STUDIO_BOARD_POLISH_FINISH_CONFIG: Record<StoryboardDocumentBoardPolishFinish, {
  label: string;
  summary: string;
}> = {
  clean: {
    label: 'Clean',
    summary: 'Tight grain with a cleaner presentation read.',
  },
  hatch: {
    label: 'Hatch',
    summary: 'Crosshatch finish that pushes value structure and noir texture.',
  },
  marker: {
    label: 'Marker',
    summary: 'Broad wash bands that mimic marker passes and dry-brush buildup.',
  },
};

export const STUDIO_BOARD_POLISH_WEATHER_CONFIG: Record<StoryboardDocumentBoardPolishWeather, {
  label: string;
  summary: string;
}> = {
  none: {
    label: 'Clear',
    summary: 'Keeps the board read clean and dry.',
  },
  mist: {
    label: 'Mist',
    summary: 'Adds a suspended haze layer for depth and light bloom.',
  },
  rain: {
    label: 'Rain',
    summary: 'Adds a rain pass that strengthens glare, silhouette, and pavement read.',
  },
};

const withOpacity = (input: string, opacity: number): string => {
  const clampedOpacity = clampUnit(opacity, 1);
  const rgbaMatch = input.match(/rgba?\(([^)]+)\)/i);
  if (rgbaMatch) {
    const [r = '255', g = '255', b = '255'] = rgbaMatch[1].split(',').map((segment) => segment.trim());
    return `rgba(${r}, ${g}, ${b}, ${clampedOpacity.toFixed(3)})`;
  }

  if (input.startsWith('#')) {
    const hex = input.slice(1);
    const normalized = hex.length === 3
      ? hex.split('').map((part) => `${part}${part}`).join('')
      : hex.padEnd(6, '0').slice(0, 6);
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${clampedOpacity.toFixed(3)})`;
  }

  return input;
};

const loadImage = (src: string): Promise<HTMLImageElement> => (
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load board polish source image'));
    image.src = src;
  })
);

export function createBoardPolishDraftState(
  value: Partial<BoardPolishDraftState> = {},
): BoardPolishDraftState {
  return {
    ...STUDIO_BOARD_POLISH_DEFAULTS,
    ...value,
    mode: value.mode === 'present' ? 'present' : value.mode === 'edit' ? 'edit' : STUDIO_BOARD_POLISH_DEFAULTS.mode,
    tone: value.tone && STUDIO_BOARD_POLISH_TONES.includes(value.tone) ? value.tone : STUDIO_BOARD_POLISH_DEFAULTS.tone,
    finish: value.finish && STUDIO_BOARD_POLISH_FINISHES.includes(value.finish) ? value.finish : STUDIO_BOARD_POLISH_DEFAULTS.finish,
    weather: value.weather && STUDIO_BOARD_POLISH_WEATHER_OPTIONS.includes(value.weather) ? value.weather : STUDIO_BOARD_POLISH_DEFAULTS.weather,
    atmosphere: clampUnit(value.atmosphere ?? STUDIO_BOARD_POLISH_DEFAULTS.atmosphere, STUDIO_BOARD_POLISH_DEFAULTS.atmosphere),
    lineBoost: clampUnit(value.lineBoost ?? STUDIO_BOARD_POLISH_DEFAULTS.lineBoost, STUDIO_BOARD_POLISH_DEFAULTS.lineBoost),
    vignette: clampUnit(value.vignette ?? STUDIO_BOARD_POLISH_DEFAULTS.vignette, STUDIO_BOARD_POLISH_DEFAULTS.vignette),
    effectLayers: createBoardPolishEffectLayerStates(value.effectLayers),
    effectRegions: createBoardPolishEffectRegions(value.effectRegions),
  };
}

export function getBoardPolishCanvasFilter(state: BoardPolishDraftState, presentationActive: boolean): string {
  if (!presentationActive) {
    return 'none';
  }

  const toneConfig = STUDIO_BOARD_POLISH_TONE_CONFIG[state.tone];
  return `${toneConfig.canvasFilter} contrast(${(
    1.04
    + (state.lineBoost * 0.28)
    + (state.finish === 'hatch' ? 0.06 : state.finish === 'marker' ? 0.02 : 0)
    + (state.atmosphere * 0.05)
  ).toFixed(2)}) brightness(${(
    1.01
    + (state.lineBoost * 0.06)
    + (state.atmosphere * 0.03)
    - (state.finish === 'hatch' ? 0.01 : 0)
  ).toFixed(2)})`;
}

export function getBoardPolishStyleSummary(state: BoardPolishDraftState): string {
  const effectLayerStateMap = getBoardPolishEffectLayerStateMap(state);
  const mutedCount = Object.values(effectLayerStateMap).filter((layer) => !layer.enabled).length;
  const customMix = Object.values(effectLayerStateMap).some((layer) => Math.abs(layer.opacity - 1) >= 0.001);
  const weatherLabel = effectLayerStateMap.weather.enabled
    ? STUDIO_BOARD_POLISH_WEATHER_CONFIG[state.weather].label
    : `${STUDIO_BOARD_POLISH_WEATHER_CONFIG[state.weather].label} muted`;
  const segments = [
    `${STUDIO_BOARD_POLISH_FINISH_CONFIG[state.finish].label} finish`,
    `${weatherLabel} weather`,
    `${Math.round(state.atmosphere * 100)}% atmosphere`,
  ];
  if (mutedCount > 0) {
    segments.push(`${mutedCount} muted`);
  }
  if (customMix) {
    segments.push('custom FX mix');
  }
  return segments.join(' · ');
}

function getBoardPolishEffectLayerStateMap(
  state: BoardPolishDraftState,
): Record<BoardPolishEffectLayerId, StoryboardDocumentBoardPolishEffectLayerState> {
  const normalizedLayers = createBoardPolishEffectLayerStates(state.effectLayers);
  return normalizedLayers.reduce<Record<BoardPolishEffectLayerId, StoryboardDocumentBoardPolishEffectLayerState>>((result, layer) => {
    result[layer.id] = layer;
    return result;
  }, {
    atmosphere: normalizedLayers[0],
    weather: normalizedLayers[1],
    finish: normalizedLayers[2],
    vignette: normalizedLayers[3],
  });
}

export function getBoardPolishEffectRegionMap(
  state: BoardPolishDraftState,
): Record<BoardPolishEffectLayerId, StoryboardDocumentBoardPolishEffectRegion> {
  const normalizedRegions = createBoardPolishEffectRegions(state.effectRegions);
  return normalizedRegions.reduce<Record<BoardPolishEffectLayerId, StoryboardDocumentBoardPolishEffectRegion>>((result, region) => {
    result[region.id] = region;
    return result;
  }, {
    atmosphere: normalizedRegions[0],
    weather: normalizedRegions[1],
    finish: normalizedRegions[2],
    vignette: normalizedRegions[3],
  });
}

export function getBoardPolishEffectLayers(
  state: BoardPolishDraftState,
  presentationActive: boolean,
  options: {
    includeDisabled?: boolean;
  } = {},
): BoardPolishEffectLayer[] {
  if (!presentationActive) {
    return [];
  }

  const toneConfig = STUDIO_BOARD_POLISH_TONE_CONFIG[state.tone];
  const effectLayerStateMap = getBoardPolishEffectLayerStateMap(state);
  const effectRegionMap = getBoardPolishEffectRegionMap(state);
  const atmosphereOpacity = 0.06 + (state.atmosphere * 0.18);
  const finishOpacity = state.finish === 'marker'
    ? 0.08 + (state.atmosphere * 0.12)
    : 0.06 + (state.atmosphere * 0.14);
  const weatherOpacity = state.weather === 'none'
    ? 0
    : state.weather === 'mist'
      ? 0.1 + (state.atmosphere * 0.18)
      : 0.14 + (state.atmosphere * 0.22);
  const vignetteOpacity = 0.18 + (state.vignette * 0.5);

  const atmosphereLayer: BoardPolishEffectLayer = {
    id: 'atmosphere',
    label: 'Atmosphere',
    summary: `${Math.round(state.atmosphere * 100)}% haze and bloom depth.`,
    background: [
      `radial-gradient(circle at 50% 28%, rgba(255,255,255,${atmosphereOpacity.toFixed(3)}) 0%, rgba(255,255,255,${(atmosphereOpacity * 0.42).toFixed(3)}) 20%, transparent 56%)`,
      `linear-gradient(180deg, rgba(255,255,255,${(atmosphereOpacity * 0.34).toFixed(3)}) 0%, transparent 46%, rgba(2,6,23,${(0.08 + (state.atmosphere * 0.08)).toFixed(3)}) 100%)`,
    ].join(','),
    mixBlendMode: 'screen',
    opacity: atmosphereOpacity * effectLayerStateMap.atmosphere.opacity,
    enabled: effectLayerStateMap.atmosphere.enabled,
    region: effectRegionMap.atmosphere,
  };

  const weatherLayer: BoardPolishEffectLayer = {
    id: 'weather',
    label: 'Weather',
    summary: state.weather === 'none'
      ? 'No weather pass armed.'
      : state.weather === 'mist'
        ? 'Mist banks soften depth and carry the light.'
        : 'Rain streaks sharpen glare and silhouette.',
    background: state.weather === 'mist'
      ? [
          `radial-gradient(circle at 20% 62%, rgba(255,255,255,${weatherOpacity.toFixed(3)}) 0%, transparent 32%)`,
          `radial-gradient(circle at 76% 42%, rgba(255,255,255,${(weatherOpacity * 0.78).toFixed(3)}) 0%, transparent 34%)`,
          `radial-gradient(circle at 54% 72%, rgba(255,255,255,${(weatherOpacity * 0.56).toFixed(3)}) 0%, transparent 28%)`,
        ].join(',')
      : state.weather === 'rain'
        ? [
            `repeating-linear-gradient(102deg, rgba(255,255,255,${weatherOpacity.toFixed(3)}) 0 2px, transparent 2px 26px)`,
            `repeating-linear-gradient(99deg, rgba(255,255,255,${(weatherOpacity * 0.45).toFixed(3)}) 0 1px, transparent 1px 18px)`,
            `linear-gradient(180deg, rgba(255,255,255,${(weatherOpacity * 0.18).toFixed(3)}) 0%, transparent 32%, rgba(255,255,255,${(weatherOpacity * 0.08).toFixed(3)}) 100%)`,
          ].join(',')
        : 'none',
    mixBlendMode: 'screen',
    opacity: weatherOpacity * effectLayerStateMap.weather.opacity,
    enabled: effectLayerStateMap.weather.enabled,
    region: effectRegionMap.weather,
  };

  const finishLayer: BoardPolishEffectLayer = {
    id: 'finish',
    label: 'Finish',
    summary: STUDIO_BOARD_POLISH_FINISH_CONFIG[state.finish].summary,
    background: state.finish === 'hatch'
      ? [
          `repeating-linear-gradient(125deg, rgba(255,255,255,${(finishOpacity * 0.82).toFixed(3)}) 0 1px, transparent 1px 13px)`,
          `repeating-linear-gradient(55deg, rgba(255,255,255,${(finishOpacity * 0.56).toFixed(3)}) 0 1px, transparent 1px 19px)`,
        ].join(',')
      : state.finish === 'marker'
        ? [
            `linear-gradient(180deg, rgba(255,255,255,${(finishOpacity * 0.5).toFixed(3)}) 0%, transparent 20%, rgba(255,255,255,${(finishOpacity * 0.18).toFixed(3)}) 48%, transparent 78%)`,
            `repeating-linear-gradient(0deg, rgba(255,255,255,${(finishOpacity * 0.34).toFixed(3)}) 0 10px, transparent 10px 36px)`,
            `repeating-linear-gradient(90deg, rgba(255,255,255,${(finishOpacity * 0.12).toFixed(3)}) 0 1px, transparent 1px 28px)`,
          ].join(',')
        : [
            `repeating-linear-gradient(90deg, rgba(255,255,255,${toneConfig.grainOpacity.toFixed(3)}) 0 1px, transparent 1px 22px)`,
            `repeating-linear-gradient(0deg, rgba(255,255,255,${(toneConfig.grainOpacity * 0.7).toFixed(3)}) 0 1px, transparent 1px 18px)`,
          ].join(','),
    mixBlendMode: state.finish === 'marker' ? 'soft-light' : 'screen',
    opacity: finishOpacity * effectLayerStateMap.finish.opacity,
    enabled: effectLayerStateMap.finish.enabled,
    region: effectRegionMap.finish,
  };

  const vignetteLayer: BoardPolishEffectLayer = {
    id: 'vignette',
    label: 'Vignette',
    summary: `${Math.round(state.vignette * 100)}% edge falloff.`,
    background: `radial-gradient(circle at center, transparent ${Math.max(42, 64 - (state.vignette * 18))}%, ${withOpacity(toneConfig.vignetteColor, vignetteOpacity)} 100%)`,
    mixBlendMode: 'multiply',
    opacity: vignetteOpacity * effectLayerStateMap.vignette.opacity,
    enabled: effectLayerStateMap.vignette.enabled,
    region: effectRegionMap.vignette,
  };

  const layers = [atmosphereLayer, weatherLayer, finishLayer, vignetteLayer];
  if (options.includeDisabled) {
    return layers;
  }
  return layers.filter((layer) => layer.enabled && layer.opacity > 0.001);
}

function drawGradientCircle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  inner: string,
  outer: string,
): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function createWorkingCanvas(
  width: number,
  height: number,
): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
}

function getWorkingCanvasContext(
  width: number,
  height: number,
): {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  context: CanvasRenderingContext2D;
} | null {
  const canvas = createWorkingCanvas(width, height);
  if (!canvas) {
    return null;
  }
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  return { canvas, context };
}

function drawEffectRegionMask(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  region: BoardPolishEffectRegion,
): void {
  const left = region.xRatio * width;
  const top = region.yRatio * height;
  const regionWidth = Math.max(1, region.widthRatio * width);
  const regionHeight = Math.max(1, region.heightRatio * height);
  const right = left + regionWidth;
  const bottom = top + regionHeight;
  const featherPx = Math.min(
    Math.max(0, Math.min(regionWidth, regionHeight) * region.feather),
    Math.max(0, (Math.min(regionWidth, regionHeight) / 2) - 1),
  );

  if (featherPx <= 1) {
    context.fillStyle = 'rgba(255,255,255,1)';
    context.fillRect(left, top, regionWidth, regionHeight);
    return;
  }

  const innerLeft = left + featherPx;
  const innerTop = top + featherPx;
  const innerRight = right - featherPx;
  const innerBottom = bottom - featherPx;
  const innerWidth = Math.max(0, innerRight - innerLeft);
  const innerHeight = Math.max(0, innerBottom - innerTop);

  context.fillStyle = 'rgba(255,255,255,1)';
  context.fillRect(innerLeft, innerTop, innerWidth, innerHeight);
  context.fillRect(innerLeft, top, innerWidth, featherPx);
  context.fillRect(innerLeft, innerBottom, innerWidth, featherPx);
  context.fillRect(left, innerTop, featherPx, innerHeight);
  context.fillRect(innerRight, innerTop, featherPx, innerHeight);

  const topGradient = context.createLinearGradient(0, top, 0, innerTop);
  topGradient.addColorStop(0, 'rgba(255,255,255,0)');
  topGradient.addColorStop(1, 'rgba(255,255,255,1)');
  context.fillStyle = topGradient;
  context.fillRect(innerLeft, top, innerWidth, featherPx);

  const bottomGradient = context.createLinearGradient(0, innerBottom, 0, bottom);
  bottomGradient.addColorStop(0, 'rgba(255,255,255,1)');
  bottomGradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = bottomGradient;
  context.fillRect(innerLeft, innerBottom, innerWidth, featherPx);

  const leftGradient = context.createLinearGradient(left, 0, innerLeft, 0);
  leftGradient.addColorStop(0, 'rgba(255,255,255,0)');
  leftGradient.addColorStop(1, 'rgba(255,255,255,1)');
  context.fillStyle = leftGradient;
  context.fillRect(left, innerTop, featherPx, innerHeight);

  const rightGradient = context.createLinearGradient(innerRight, 0, right, 0);
  rightGradient.addColorStop(0, 'rgba(255,255,255,1)');
  rightGradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = rightGradient;
  context.fillRect(innerRight, innerTop, featherPx, innerHeight);

  const drawCornerMask = (
    centerX: number,
    centerY: number,
    x: number,
    y: number,
  ) => {
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, featherPx);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(x, y, featherPx, featherPx);
  };

  drawCornerMask(innerLeft, innerTop, left, top);
  drawCornerMask(innerRight, innerTop, innerRight, top);
  drawCornerMask(innerLeft, innerBottom, left, innerBottom);
  drawCornerMask(innerRight, innerBottom, innerRight, innerBottom);
}

function renderMaskedEffectLayer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  mixBlendMode: GlobalCompositeOperation,
  region: BoardPolishEffectRegion,
  draw: (effectContext: CanvasRenderingContext2D) => void,
): void {
  const effectSurface = getWorkingCanvasContext(width, height);
  const maskSurface = getWorkingCanvasContext(width, height);
  if (!effectSurface || !maskSurface) {
    context.save();
    context.globalCompositeOperation = mixBlendMode;
    draw(context);
    context.restore();
    return;
  }

  draw(effectSurface.context);
  drawEffectRegionMask(maskSurface.context, width, height, region);
  effectSurface.context.save();
  effectSurface.context.globalCompositeOperation = 'destination-in';
  effectSurface.context.drawImage(maskSurface.canvas as CanvasImageSource, 0, 0);
  effectSurface.context.restore();

  context.save();
  context.globalCompositeOperation = mixBlendMode;
  context.drawImage(effectSurface.canvas as CanvasImageSource, 0, 0);
  context.restore();
}

function drawAtmosphereLayer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: BoardPolishDraftState,
  opacityScale: number,
): void {
  if (opacityScale <= 0) {
    return;
  }

  const atmosphereOpacity = (0.06 + (state.atmosphere * 0.18)) * opacityScale;
  drawGradientCircle(context, width * 0.5, height * 0.28, width * 0.42, `rgba(255,255,255,${atmosphereOpacity.toFixed(3)})`, 'rgba(255,255,255,0)');
  const atmosphereGradient = context.createLinearGradient(0, 0, 0, height);
  atmosphereGradient.addColorStop(0, `rgba(255,255,255,${(atmosphereOpacity * 0.34).toFixed(3)})`);
  atmosphereGradient.addColorStop(0.46, 'rgba(255,255,255,0)');
  atmosphereGradient.addColorStop(1, `rgba(2,6,23,${((0.08 + (state.atmosphere * 0.08)) * opacityScale).toFixed(3)})`);
  context.fillStyle = atmosphereGradient;
  context.fillRect(0, 0, width, height);
}

function drawWeatherLayer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: BoardPolishDraftState,
  opacityScale: number,
): void {
  if (state.weather === 'none' || opacityScale <= 0) {
    return;
  }

  const weatherOpacity = state.weather === 'mist'
    ? 0.1 + (state.atmosphere * 0.18)
    : 0.14 + (state.atmosphere * 0.22);
  const resolvedWeatherOpacity = weatherOpacity * opacityScale;

  if (state.weather === 'mist') {
    drawGradientCircle(context, width * 0.2, height * 0.62, width * 0.18, `rgba(255,255,255,${resolvedWeatherOpacity.toFixed(3)})`, 'rgba(255,255,255,0)');
    drawGradientCircle(context, width * 0.76, height * 0.42, width * 0.2, `rgba(255,255,255,${(resolvedWeatherOpacity * 0.78).toFixed(3)})`, 'rgba(255,255,255,0)');
    drawGradientCircle(context, width * 0.54, height * 0.72, width * 0.16, `rgba(255,255,255,${(resolvedWeatherOpacity * 0.56).toFixed(3)})`, 'rgba(255,255,255,0)');
    return;
  }

  context.strokeStyle = `rgba(255,255,255,${resolvedWeatherOpacity.toFixed(3)})`;
  context.lineWidth = Math.max(1, width * 0.0014);
  const spacing = Math.max(16, Math.round(width * 0.018));
  for (let x = -height; x < width + height; x += spacing) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x - (height * 0.22), height);
    context.stroke();
  }
  context.strokeStyle = `rgba(255,255,255,${(resolvedWeatherOpacity * 0.45).toFixed(3)})`;
  context.lineWidth = Math.max(0.8, width * 0.0009);
  for (let x = -height * 0.6; x < width + height; x += Math.max(12, Math.round(width * 0.012))) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x - (height * 0.18), height);
    context.stroke();
  }
}

function drawFinishLayer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: BoardPolishDraftState,
  opacityScale: number,
): void {
  if (opacityScale <= 0) {
    return;
  }

  const toneConfig = STUDIO_BOARD_POLISH_TONE_CONFIG[state.tone];
  const finishOpacity = state.finish === 'marker'
    ? 0.08 + (state.atmosphere * 0.12)
    : 0.06 + (state.atmosphere * 0.14);
  const resolvedFinishOpacity = finishOpacity * opacityScale;

  if (state.finish === 'hatch') {
    context.strokeStyle = `rgba(255,255,255,${(resolvedFinishOpacity * 0.82).toFixed(3)})`;
    context.lineWidth = Math.max(0.8, width * 0.0009);
    const spacingA = Math.max(12, Math.round(width * 0.013));
    for (let x = -height; x < width + height; x += spacingA) {
      context.beginPath();
      context.moveTo(x, height);
      context.lineTo(x + height * 0.7, 0);
      context.stroke();
    }
    context.strokeStyle = `rgba(255,255,255,${(resolvedFinishOpacity * 0.56).toFixed(3)})`;
    const spacingB = Math.max(18, Math.round(width * 0.018));
    for (let x = -height; x < width + height; x += spacingB) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + height * 0.7, height);
      context.stroke();
    }
    return;
  }

  if (state.finish === 'marker') {
    context.fillStyle = `rgba(255,255,255,${(resolvedFinishOpacity * 0.5).toFixed(3)})`;
    for (let y = 0; y < height; y += Math.max(32, Math.round(height * 0.18))) {
      context.fillRect(0, y, width, Math.max(18, Math.round(height * 0.05)));
    }
    context.strokeStyle = `rgba(255,255,255,${(resolvedFinishOpacity * 0.12).toFixed(3)})`;
    context.lineWidth = 1;
    for (let x = 0; x < width; x += Math.max(24, Math.round(width * 0.025))) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    return;
  }

  context.strokeStyle = `rgba(255,255,255,${toneConfig.grainOpacity.toFixed(3)})`;
  context.lineWidth = 1;
  for (let x = 0; x < width; x += Math.max(16, Math.round(width * 0.014))) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  context.strokeStyle = `rgba(255,255,255,${(toneConfig.grainOpacity * 0.7).toFixed(3)})`;
  for (let y = 0; y < height; y += Math.max(14, Math.round(height * 0.016))) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawVignetteLayer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: BoardPolishDraftState,
  opacityScale: number,
): void {
  if (opacityScale <= 0) {
    return;
  }

  const toneConfig = STUDIO_BOARD_POLISH_TONE_CONFIG[state.tone];
  const vignetteGradient = context.createRadialGradient(
    width / 2,
    height / 2,
    Math.max(width, height) * Math.max(0.42, 0.64 - (state.vignette * 0.18)),
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  );
  vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
  vignetteGradient.addColorStop(1, withOpacity(toneConfig.vignetteColor, (0.18 + (state.vignette * 0.5)) * opacityScale));
  context.fillStyle = vignetteGradient;
  context.fillRect(0, 0, width, height);
}

export function renderBoardPolishEffectsToCanvas(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: BoardPolishDraftState,
  presentationActive: boolean,
  previewEffectId?: BoardPolishEffectLayerId,
): void {
  if (!presentationActive && !previewEffectId) {
    return;
  }

  const effectLayerStateMap = getBoardPolishEffectLayerStateMap(state);
  const effectRegionMap = getBoardPolishEffectRegionMap(state);
  const effectIds = previewEffectId ? [previewEffectId] : BOARD_POLISH_EFFECT_LAYER_IDS;

  effectIds.forEach((effectId) => {
    const effectLayerState = effectLayerStateMap[effectId];
    if (!effectLayerState.enabled || effectLayerState.opacity <= 0.001) {
      return;
    }

    if (effectId === 'atmosphere') {
      renderMaskedEffectLayer(context, width, height, 'screen', effectRegionMap.atmosphere, (effectContext) => {
        drawAtmosphereLayer(effectContext, width, height, state, effectLayerState.opacity);
      });
      return;
    }

    if (effectId === 'weather') {
      renderMaskedEffectLayer(context, width, height, 'screen', effectRegionMap.weather, (effectContext) => {
        drawWeatherLayer(effectContext, width, height, state, effectLayerState.opacity);
      });
      return;
    }

    if (effectId === 'finish') {
      renderMaskedEffectLayer(
        context,
        width,
        height,
        state.finish === 'marker' ? 'soft-light' : 'screen',
        effectRegionMap.finish,
        (effectContext) => {
          drawFinishLayer(effectContext, width, height, state, effectLayerState.opacity);
        },
      );
      return;
    }

    renderMaskedEffectLayer(context, width, height, 'multiply', effectRegionMap.vignette, (effectContext) => {
      drawVignetteLayer(effectContext, width, height, state, effectLayerState.opacity);
    });
  });
}

export async function renderBoardPolishCompositeDataUrl(
  baseImageDataUrl: string,
  state: BoardPolishDraftState,
  presentationActive: boolean,
): Promise<string | null> {
  if (typeof document === 'undefined' || !baseImageDataUrl) {
    return null;
  }

  try {
    const image = await loadImage(baseImageDataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.drawImage(image, 0, 0, width, height);
    renderBoardPolishEffectsToCanvas(context, width, height, state, presentationActive);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
