/**
 * Lower-thirds-data-modeller for Post Agent — Role Room-branded.
 *
 * Inspirert av academy-systemets LowerThirdItem-shape (academy-versjonen
 * forblir uendret), men dette er en separat, Role Room-brandet variant
 * for video-editor-konteksten (event/podcast/doc/short-film/corporate).
 *
 * Brand-identitet: mørk-lilla palett med signature #a030c0 som hoved-
 * accent + #6e3fc7 som sekundær. Alle presets respekterer eller hinter
 * til denne paletten — selv "Broadcast Classic" har Role Room-lilla
 * som accent-linje, og signature-preset-en er ren Role Room.
 */

export type LowerThirdPosition =
  | "bottom-left" | "bottom-center" | "bottom-right"
  | "top-left" | "top-center" | "top-right"
  | "left-center" | "right-center";

export type LowerThirdAnimation =
  | "slide-up" | "slide-down" | "slide-left" | "slide-right"
  | "fade-in" | "zoom-in" | "typewriter";

export type StylePresetId =
  | "role-room-signature"
  | "broadcast-classic"
  | "studio-polished"
  | "festival-minimal"
  | "bold-news"
  | "documentary-subtle"
  | "sponsor-tier";

/** Role Room's signature-palett — brukt på tvers av alle Role Room-
 * brandede surfaces (Lower Thirds, Thumbnail Creator-defaults, agent-
 * editors). Hold denne i sync med Tauri-app's CSS-variabler. */
export const ROLE_ROOM_BRAND = {
  primaryLila: "#a030c0",       // Hoved-accent
  secondaryLila: "#6e3fc7",     // Sekundær
  deepNavy: "#0a0518",           // Dypeste bakgrunn
  panelNavy: "#14081f",          // Panel-bakgrunn
  signatureGradient: "linear-gradient(135deg, #6e3fc7, #a030c0)",
  surfaceGradient: "linear-gradient(135deg, rgba(20,12,40,0.95), rgba(10,5,24,0.95))",
  textPrimary: "#e8e0f0",
  textSecondary: "#c8bcd8",
  textTertiary: "#a89cb8",
} as const;

export interface LowerThirdStyle {
  /** Bakgrunns-farge (hex eller rgba). */
  background: string;
  /** Tekst-farge for hovedtittel. */
  text: string;
  /** Aksent-farge (subtittel + accent-linje). */
  accent: string;
  /** 0-1 opacity for hele cardet. */
  opacity: number;
  /** Width som prosent av container (typisk 25-50). */
  widthPercent: number;
  /** Border-radius i px. */
  borderRadius: number;
  /** Padding i px. */
  padding: number;
  /** Font-størrelse i px (skalerer via container). */
  fontSize: number;
  /** Subtittel-font-størrelse i px. */
  subtitleFontSize: number;
  /** Aksent-linje-tykkelse i px (0 = ingen). */
  accentBarWidth: number;
}

export interface LowerThirdItem {
  id: string;
  /** Hoved-tittel — typisk taler-navn. */
  title: string;
  /** Sub-tittel — typisk rolle/firma. */
  subtitle: string;
  /** Optional avatar/logo URL. */
  avatarUrl?: string;

  /** Sekunder fra video-start når item skal vises. */
  startTime: number;
  /** Varighet i sekunder. */
  duration: number;
  /** Forsinkelse før animasjon (sek). */
  delay: number;
  /** Animasjons-varighet (sek). */
  animationDuration: number;

  position: LowerThirdPosition;
  animation: LowerThirdAnimation;
  style: LowerThirdStyle;

  /** Hvilken style-preset dette ble laget fra. */
  stylePresetId?: StylePresetId;

  enabled: boolean;
}

export const DEFAULT_LOWER_THIRD_STYLE: LowerThirdStyle = {
  background: "rgba(20, 25, 38, 0.92)",
  text: "#ffffff",
  accent: "#a030c0",
  opacity: 1,
  widthPercent: 38,
  borderRadius: 4,
  padding: 14,
  fontSize: 24,
  subtitleFontSize: 14,
  accentBarWidth: 4,
};

export const STYLE_PRESETS: Record<StylePresetId, {
  label: string;
  description: string;
  style: LowerThirdStyle;
  animation: LowerThirdAnimation;
  position: LowerThirdPosition;
}> = {
  "role-room-signature": {
    label: "Role Room Signature",
    description: "Role Room's egen brand-stil: mørk-lilla gradient med signature #a030c0 accent-linje. Default for Role Room-produserte leveranser.",
    style: {
      background: ROLE_ROOM_BRAND.surfaceGradient,
      text: ROLE_ROOM_BRAND.textPrimary,
      accent: ROLE_ROOM_BRAND.primaryLila,
      opacity: 1,
      widthPercent: 42,
      borderRadius: 6,
      padding: 16,
      fontSize: 26,
      subtitleFontSize: 14,
      accentBarWidth: 4,
    },
    animation: "slide-up",
    position: "bottom-left",
  },
  "broadcast-classic": {
    label: "Broadcast Classic",
    description: "Hvitt card, mørk tekst, accent-linje. Standard TV-conference-stil.",
    style: {
      background: "rgba(255, 255, 255, 0.96)",
      text: "#14141e",
      accent: "#a030c0",
      opacity: 1,
      widthPercent: 38,
      borderRadius: 3,
      padding: 14,
      fontSize: 26,
      subtitleFontSize: 14,
      accentBarWidth: 4,
    },
    animation: "slide-up",
    position: "bottom-left",
  },
  "studio-polished": {
    label: "Studio Polished",
    description: "Premium gradient, lett blur-bg, Joe-Rogan-stil. Fungerer godt for video-podkaster.",
    style: {
      background: "linear-gradient(135deg, rgba(20,12,40,0.95), rgba(10,5,24,0.95))",
      text: "#ffffff",
      accent: "#a030c0",
      opacity: 1,
      widthPercent: 42,
      borderRadius: 6,
      padding: 16,
      fontSize: 26,
      subtitleFontSize: 14,
      accentBarWidth: 3,
    },
    animation: "fade-in",
    position: "bottom-left",
  },
  "festival-minimal": {
    label: "Festival Minimal",
    description: "Kun typografi, ingen bakgrunn. For Sundance/Cannes-shorts.",
    style: {
      background: "transparent",
      text: "#ffffff",
      accent: "#ffffff",
      opacity: 1,
      widthPercent: 40,
      borderRadius: 0,
      padding: 0,
      fontSize: 28,
      subtitleFontSize: 14,
      accentBarWidth: 0,
    },
    animation: "fade-in",
    position: "bottom-left",
  },
  "bold-news": {
    label: "Bold News",
    description: "Stor blokk-bakgrunn, hvitt på rødt, breaking-news-feel.",
    style: {
      background: "#c20000",
      text: "#ffffff",
      accent: "#ffd400",
      opacity: 1,
      widthPercent: 50,
      borderRadius: 0,
      padding: 16,
      fontSize: 32,
      subtitleFontSize: 14,
      accentBarWidth: 0,
    },
    animation: "slide-left",
    position: "bottom-left",
  },
  "documentary-subtle": {
    label: "Documentary Subtle",
    description: "Tynn linje, sparsom typografi. For PBS/BBC-dokumentar.",
    style: {
      background: "rgba(0, 0, 0, 0.55)",
      text: "#f0f0f0",
      accent: "#d4af7a",
      opacity: 1,
      widthPercent: 36,
      borderRadius: 0,
      padding: 12,
      fontSize: 22,
      subtitleFontSize: 13,
      accentBarWidth: 1,
    },
    animation: "fade-in",
    position: "bottom-left",
  },
  "sponsor-tier": {
    label: "Sponsor Tier",
    description: "Gull-badge for sponsor-roll. Gold/silver-tier-merket.",
    style: {
      background: "linear-gradient(135deg, #ffd700, #f0a500)",
      text: "#14141e",
      accent: "#14141e",
      opacity: 1,
      widthPercent: 36,
      borderRadius: 8,
      padding: 12,
      fontSize: 22,
      subtitleFontSize: 12,
      accentBarWidth: 0,
    },
    animation: "slide-right",
    position: "bottom-right",
  },
};

export const ANIMATION_LABELS: Record<LowerThirdAnimation, string> = {
  "slide-up": "Slide Up",
  "slide-down": "Slide Down",
  "slide-left": "Slide Left",
  "slide-right": "Slide Right",
  "fade-in": "Fade In",
  "zoom-in": "Zoom In",
  typewriter: "Typewriter",
};

export const POSITION_LABELS: Record<LowerThirdPosition, string> = {
  "bottom-left": "Bottom Left",
  "bottom-center": "Bottom Center",
  "bottom-right": "Bottom Right",
  "top-left": "Top Left",
  "top-center": "Top Center",
  "top-right": "Top Right",
  "left-center": "Left Center",
  "right-center": "Right Center",
};

export function newLowerThirdItem(presetId: StylePresetId = "role-room-signature"): LowerThirdItem {
  const preset = STYLE_PRESETS[presetId];
  return {
    id: `lt-${Math.random().toString(36).slice(2, 11)}`,
    title: "Taler-navn",
    subtitle: "Rolle, firma",
    startTime: 0,
    duration: 6,
    delay: 0,
    animationDuration: 0.5,
    position: preset.position,
    animation: preset.animation,
    style: { ...preset.style },
    stylePresetId: presetId,
    enabled: true,
  };
}
