/**
 * Caption-data-modeller for Post Agent. Role Room-brandet.
 *
 * Whisper-transkript-shape matcher transcribe_whisper.py-output direkte.
 * Style-presets bygger på samme Role Room brand-palett som Lower Thirds.
 */

import { ROLE_ROOM_BRAND } from "./lowerThirdTypes";

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WhisperWord[];
}

export interface WhisperTranscript {
  language: string;
  languageProbability: number;
  durationSec: number;
  segments: WhisperSegment[];
  fullText: string;
  method: "faster-whisper" | "whisper" | "openai-api";
  model: string;
  computeType?: string;
}

export type CaptionPosition =
  | "bottom-center" | "bottom-left" | "bottom-right"
  | "top-center" | "middle";

export type CaptionStylePresetId =
  | "role-room-default"
  | "tiktok-caps"
  | "youtube-standard"
  | "cinematic-serif"
  | "translation-top"
  | "asmr-minimal";

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;          // px @ 1920×1080 referanse
  fontWeight: 400 | 600 | 700 | 900;
  color: string;
  backgroundColor: string;   // "transparent" eller rgba
  strokeColor: string;       // outline-farge
  strokeWidth: number;       // 0 = ingen outline
  padding: number;
  borderRadius: number;
  position: CaptionPosition;
  maxLineWidthPct: number;   // 20-95
  maxLines: number;          // 1-3
  uppercase: boolean;
  letterSpacing: number;
  /** Antall sek caption skal pauses etter siste ord. */
  trailingHoldSec: number;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: "system-ui, -apple-system, 'Helvetica Neue', sans-serif",
  fontSize: 38,
  fontWeight: 700,
  color: "#ffffff",
  backgroundColor: "rgba(0, 0, 0, 0.55)",
  strokeColor: "rgba(0, 0, 0, 0.85)",
  strokeWidth: 0,
  padding: 14,
  borderRadius: 6,
  position: "bottom-center",
  maxLineWidthPct: 70,
  maxLines: 2,
  uppercase: false,
  letterSpacing: 0,
  trailingHoldSec: 0.4,
};

export const CAPTION_STYLE_PRESETS: Record<CaptionStylePresetId, {
  label: string;
  description: string;
  style: CaptionStyle;
}> = {
  "role-room-default": {
    label: "Role Room Default",
    description: "Role Room-brandet caption-stil: hvit på mørk-lilla strip, signature lilla accent på top-edge.",
    style: {
      ...DEFAULT_CAPTION_STYLE,
      backgroundColor: "rgba(20, 12, 40, 0.85)",
      color: ROLE_ROOM_BRAND.textPrimary,
      borderRadius: 4,
      fontSize: 36,
    },
  },
  "tiktok-caps": {
    label: "TikTok Caps",
    description: "Stor bold-versalt med tynn skygge. Trending sosial-stil for Reels/TikTok/Shorts.",
    style: {
      ...DEFAULT_CAPTION_STYLE,
      backgroundColor: "transparent",
      fontWeight: 900,
      fontSize: 44,
      uppercase: true,
      strokeColor: "rgba(0, 0, 0, 0.9)",
      strokeWidth: 3,
      padding: 0,
      borderRadius: 0,
      maxLineWidthPct: 80,
      maxLines: 2,
      letterSpacing: 0.5,
    },
  },
  "youtube-standard": {
    label: "YouTube Standard",
    description: "Klassisk semi-transparent svart boks. Trygg for langform YouTube-content.",
    style: {
      ...DEFAULT_CAPTION_STYLE,
      backgroundColor: "rgba(0, 0, 0, 0.78)",
      fontSize: 34,
      borderRadius: 4,
      padding: 10,
      maxLines: 2,
    },
  },
  "cinematic-serif": {
    label: "Cinematic Serif",
    description: "Større serif uten bakgrunn, festival/dokumentar-stil. Premium look.",
    style: {
      ...DEFAULT_CAPTION_STYLE,
      backgroundColor: "transparent",
      fontFamily: "'Times New Roman', Georgia, serif",
      fontSize: 38,
      fontWeight: 400,
      strokeColor: "rgba(0, 0, 0, 0.85)",
      strokeWidth: 1.5,
      padding: 0,
      borderRadius: 0,
      maxLines: 2,
    },
  },
  "translation-top": {
    label: "Translation (top)",
    description: "Gul tekst i topp av skjermen. For oversettelse-overlays når source-audio er på annet språk.",
    style: {
      ...DEFAULT_CAPTION_STYLE,
      backgroundColor: "rgba(0, 0, 0, 0.55)",
      color: "#ffd400",
      fontSize: 32,
      position: "top-center",
      borderRadius: 3,
      padding: 8,
      maxLines: 2,
    },
  },
  "asmr-minimal": {
    label: "ASMR / Whisper",
    description: "Minimal hvit med subtil outline, ingen bakgrunn. Perfekt for stille content.",
    style: {
      ...DEFAULT_CAPTION_STYLE,
      backgroundColor: "transparent",
      fontSize: 30,
      fontWeight: 400,
      strokeColor: "rgba(0, 0, 0, 0.6)",
      strokeWidth: 1,
      padding: 0,
      borderRadius: 0,
      maxLines: 1,
    },
  },
};

export const POSITION_LABELS: Record<CaptionPosition, string> = {
  "bottom-center": "Bottom Center",
  "bottom-left": "Bottom Left",
  "bottom-right": "Bottom Right",
  "top-center": "Top Center",
  "middle": "Middle",
};

/** Hent caption-segment som er aktiv ved en gitt tid. */
export function findActiveSegment(
  transcript: WhisperTranscript | null,
  timeSec: number,
  trailingHoldSec: number = 0,
): WhisperSegment | null {
  if (!transcript) return null;
  return transcript.segments.find(s =>
    timeSec >= s.start && timeSec < s.end + trailingHoldSec) ?? null;
}

/** SRT-export format. */
export function transcriptToSrt(t: WhisperTranscript): string {
  const lines: string[] = [];
  t.segments.forEach((s, i) => {
    lines.push(String(i + 1));
    lines.push(`${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}`);
    lines.push(s.text);
    lines.push("");
  });
  return lines.join("\n");
}

/** VTT-export (web-native). */
export function transcriptToVtt(t: WhisperTranscript): string {
  const lines: string[] = ["WEBVTT", ""];
  t.segments.forEach((s, i) => {
    lines.push(`${i + 1}`);
    lines.push(`${formatVttTime(s.start)} --> ${formatVttTime(s.end)}`);
    lines.push(s.text);
    lines.push("");
  });
  return lines.join("\n");
}

function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function formatVttTime(sec: number): string {
  return formatSrtTime(sec).replace(",", ".");
}
