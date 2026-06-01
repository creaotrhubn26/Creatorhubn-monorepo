/**
 * mockupConfig.ts — én sentral, serialiserbar konfigurasjon for hele
 * mockup-video-pipelinen. ALLE funksjoner er på/av- eller verdi-styrt herfra,
 * slik at Post Agent kan eksponere dem som toggles i UI-et og sende samme
 * config til både preview (renderMockupFrame) og eksport (exportMockupVideo /
 * pro-pipelinen).
 *
 * Designprinsipp: ingen funksjon er hardkodet "på". Hver enkelt har et felt
 * her, og UI-et binder en bryter/slider til feltet.
 */

import type { DeviceVariant } from './deviceGeometry';
import type { FitMode } from './fitRect';

/** Visuelle valg som styrer hvordan hver frame komponeres. */
export interface MockupVisualConfig {
  device: DeviceVariant;
  fit: FitMode;
  /** Bakgrunns-preset-nøkkel (se BACKGROUND_PRESETS) eller 'transparent'. */
  background: string;
  /** Droppskygge under enheten. */
  shadow: boolean;
  /** Crop vekk iOS-statuslinjen øverst (andel av høyden, 0 = av). */
  statusBarCrop: number;
  /** Fade inn/ut på video (sekunder, 0 = av). */
  fadeSeconds: number;
}

/** Lyd-valg. Hver er en selvstendig på/av- eller verdi-bryter. */
export interface MockupAudioConfig {
  /** Ta med lyd i det hele tatt. */
  enabled: boolean;
  /** Noise gate: stille når ingen snakker. */
  noiseGate: boolean;
  /** Terskel for noise gate (lineær, ~0.02 ≈ -34 dB). */
  noiseGateThreshold: number;
  /** Post Agents apply_audio_polish (highpass/de-ess/voice-boost). */
  polish: boolean;
  /** Loudness-normalisering (two-pass mot målet under). */
  loudnessNormalize: boolean;
  /** LUFS-mål for normalisering. */
  loudnessTarget: number;
}

/** Bakgrunnsmusikk med automatisk ducking under tale. */
export interface MockupMusicConfig {
  /** Legg til bakgrunnsmusikk i det hele tatt. */
  enabled: boolean;
  /** Filsti/-referanse til sang (settes av Post Agent-klienten). */
  source: string | null;
  /** Musikkvolum (0..1) før ducking. */
  volume: number;
  /** Ducking: hvor mye musikken dempes under tale (negativ dB). */
  ducking: boolean;
  duckDb: number;
}

/** Eksport-valg (format/kvalitet). */
export interface MockupExportConfig {
  /** 'mp4' = H.264 (liten, ugjennomsiktig) | 'prores4444' = alfa .mov (stor). */
  format: 'mp4' | 'prores4444';
  /** Oppløsnings-multiplier på device-geometrien. */
  pixelRatio: number;
  frameRate: number;
}

export interface MockupConfig {
  visual: MockupVisualConfig;
  audio: MockupAudioConfig;
  music: MockupMusicConfig;
  export: MockupExportConfig;
}

/** Bakgrunns-presets. 'transparent' håndteres spesielt (alfa-eksport). */
export const BACKGROUND_PRESETS: Record<string, { from?: string; to?: string; direction?: 'vertical' | 'horizontal' | 'diagonal'; solid?: boolean; transparent?: boolean }> = {
  transparent: { transparent: true },
  midnight: { from: '#1e293b', to: '#0b1120', direction: 'vertical' },
  brand: { from: '#312e81', to: '#0b1120', direction: 'diagonal' },
  sunset: { from: '#7c2d12', to: '#1e1b4b', direction: 'diagonal' },
  ocean: { from: '#0e7490', to: '#0b1120', direction: 'vertical' },
  plum: { from: '#a030c0', to: '#0a0518', direction: 'diagonal' },
  light: { from: '#f1f5f9', to: '#cbd5e1', direction: 'vertical' },
  black: { from: '#000000', solid: true },
};

/** Fornuftige standardverdier — alt skrudd til en trygg, polert default. */
export const DEFAULT_MOCKUP_CONFIG: MockupConfig = {
  visual: {
    device: 'iphone',
    fit: 'cover',
    background: 'brand',
    shadow: true,
    statusBarCrop: 0.045,
    fadeSeconds: 0.5,
  },
  audio: {
    enabled: true,
    noiseGate: true,
    noiseGateThreshold: 0.02,
    polish: true,
    loudnessNormalize: true,
    loudnessTarget: -14,
  },
  music: {
    enabled: false,
    source: null,
    volume: 0.5,
    ducking: true,
    duckDb: -12,
  },
  export: {
    format: 'mp4',
    pixelRatio: 5,
    frameRate: 30,
  },
};

/**
 * Oversett en MockupConfig til render-options for renderMockupFrame /
 * exportMockupVideo. Holder UI-config og render-API frikoblet.
 */
export function toRenderOptions(cfg: MockupVisualConfig) {
  const preset = BACKGROUND_PRESETS[cfg.background] ?? BACKGROUND_PRESETS.brand;
  const background = preset.transparent
    ? { kind: 'none' as const }
    : preset.solid
      ? { kind: 'solid' as const, from: preset.from }
      : { kind: 'gradient' as const, from: preset.from, to: preset.to, direction: preset.direction };
  return {
    variant: cfg.device,
    fit: cfg.fit,
    background,
    padding: preset.transparent ? 0 : 0.08,
    shadow: cfg.shadow && !preset.transparent,
    sourceInset: cfg.statusBarCrop > 0 ? { top: cfg.statusBarCrop } : undefined,
  };
}
