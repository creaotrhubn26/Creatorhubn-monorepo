/**
 * devicePresets — virkelige dimensjoner for moderne telefoner og
 * sosial-plattformers UI-safe-zones. Brukes av Thumbnail Creator's
 * telefon-mockup for å vise editor hvordan en design ser ut på faktisk
 * device, inkludert hvilke områder som dekkes av plattform-UI.
 *
 * Logical points (pt) = CSS pixels @1x. Apple HIG og Material Design.
 * Status bar/home indicator-tall kommer fra Apple HIG og Google ADL.
 *
 * Export-dimensions er separate — de matcher hva plattformene faktisk
 * server (1080-wide for IG/TikTok content, 1920-wide for YouTube).
 */

export type DeviceId =
  | "iphone-15-pro"
  | "iphone-15-pro-max"
  | "iphone-se-3"
  | "samsung-galaxy-s24"
  | "pixel-8";

export interface DeviceSpec {
  id: DeviceId;
  name: string;
  /** Logical points (CSS px @1x) — bredde × høyde. */
  pointSize: { w: number; h: number };
  /** Faktiske piksler (for export-skala-ref). */
  pixelSize: { w: number; h: number };
  /** Apple HIG-safe-areas i punkter. Bottom = home indicator. */
  safeArea: { top: number; bottom: number; left: number; right: number };
  /** Notch/dynamic-island/hole-punch i punkter. null hvis ingen. */
  cutout: {
    type: "dynamic-island" | "notch" | "hole-punch" | "none";
    /** Sentrert horisontalt med mindre x er gitt. */
    x?: number; y: number; w: number; h: number;
  };
  /** Hjørne-radius på skjermen i punkter (visning). */
  cornerRadius: number;
  /** Bezel-tykkelse i punkter (ramme rundt skjermen). */
  bezel: number;
}

export const DEVICES: Record<DeviceId, DeviceSpec> = {
  // Apple iPhone 15 Pro — dynamic island, 19.5:9
  "iphone-15-pro": {
    id: "iphone-15-pro",
    name: "iPhone 15 Pro",
    pointSize: { w: 393, h: 852 },
    pixelSize: { w: 1179, h: 2556 },
    safeArea: { top: 59, bottom: 34, left: 0, right: 0 },
    cutout: { type: "dynamic-island", y: 11, w: 126, h: 37 },
    cornerRadius: 55,
    bezel: 10,
  },
  // iPhone 15 Pro Max — same design language, større
  "iphone-15-pro-max": {
    id: "iphone-15-pro-max",
    name: "iPhone 15 Pro Max",
    pointSize: { w: 430, h: 932 },
    pixelSize: { w: 1290, h: 2796 },
    safeArea: { top: 59, bottom: 34, left: 0, right: 0 },
    cutout: { type: "dynamic-island", y: 11, w: 126, h: 37 },
    cornerRadius: 55,
    bezel: 10,
  },
  // iPhone SE 3 — touch-ID, ingen notch, 16:9
  "iphone-se-3": {
    id: "iphone-se-3",
    name: "iPhone SE (3. gen)",
    pointSize: { w: 375, h: 667 },
    pixelSize: { w: 750, h: 1334 },
    safeArea: { top: 20, bottom: 0, left: 0, right: 0 },
    cutout: { type: "none", y: 0, w: 0, h: 0 },
    cornerRadius: 0,
    bezel: 24,
  },
  // Samsung Galaxy S24 — center hole-punch, 20:9 ish
  "samsung-galaxy-s24": {
    id: "samsung-galaxy-s24",
    name: "Galaxy S24",
    pointSize: { w: 360, h: 780 },
    pixelSize: { w: 1080, h: 2340 },
    safeArea: { top: 32, bottom: 16, left: 0, right: 0 },
    cutout: { type: "hole-punch", y: 14, w: 14, h: 14 },
    cornerRadius: 28,
    bezel: 8,
  },
  // Google Pixel 8 — center hole-punch
  "pixel-8": {
    id: "pixel-8",
    name: "Pixel 8",
    pointSize: { w: 412, h: 892 },
    pixelSize: { w: 1080, h: 2400 },
    safeArea: { top: 32, bottom: 24, left: 0, right: 0 },
    cutout: { type: "hole-punch", y: 16, w: 16, h: 16 },
    cornerRadius: 32,
    bezel: 9,
  },
};

export type PlatformId =
  | "instagram-feed-1x1"
  | "instagram-feed-4x5"
  | "instagram-reels"
  | "instagram-story"
  | "tiktok"
  | "linkedin-feed"
  | "youtube-shorts"
  | "youtube-thumbnail";

export interface PlatformSpec {
  id: PlatformId;
  name: string;
  /** Eksport-dimensjoner (faktiske piksler) som plattformen serverer. */
  exportPx: { w: number; h: number };
  /** Aspect-ratio som streng for CSS aspectRatio. */
  cssAspect: string;
  /** Hvor mye av skjermen tar plattform-UI? Pixel-prosent fra hvert kant. */
  uiOverlay: {
    /** Top: status bar + profile/nav. Prosent av skjerm-høyde. */
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  /** Hvordan vises innholdet — fyller hele skjermen eller i feed-card? */
  presentation: "fullscreen" | "feed-card";
  /** Beskrivelse av hva UI-overlay dekker. */
  uiDescription: string;
}

export const PLATFORMS: Record<PlatformId, PlatformSpec> = {
  // IG Feed-post 1:1 — vises i scroll-feed med caption under
  "instagram-feed-1x1": {
    id: "instagram-feed-1x1",
    name: "Instagram Feed (1:1)",
    exportPx: { w: 1080, h: 1080 },
    cssAspect: "1 / 1",
    uiOverlay: { top: 0, bottom: 0, left: 0, right: 0 },
    presentation: "feed-card",
    uiDescription: "Post vises i scroll-feed med caption + UI under (ingen overlay over selve bildet)",
  },
  // IG Feed-post 4:5 — portrait i scroll-feed (max høyde)
  "instagram-feed-4x5": {
    id: "instagram-feed-4x5",
    name: "Instagram Feed (4:5)",
    exportPx: { w: 1080, h: 1350 },
    cssAspect: "4 / 5",
    uiOverlay: { top: 0, bottom: 0, left: 0, right: 0 },
    presentation: "feed-card",
    uiDescription: "Portrait-format gir maks footprint i scroll-feed",
  },
  // IG Reels — full-screen player
  "instagram-reels": {
    id: "instagram-reels",
    name: "Instagram Reels",
    exportPx: { w: 1080, h: 1920 },
    cssAspect: "9 / 16",
    uiOverlay: {
      // iPhone 15 Pro 393×852: bottom UI ~165pt = 19.4%, top profile bar ~110pt = 12.9%
      top: 0.13,
      bottom: 0.22,
      left: 0,
      right: 0.18,
    },
    presentation: "fullscreen",
    uiDescription:
      "Profil + caption på bunn (22%), action-knapper høyre (18%), nav-bar topp (13%)",
  },
  // IG Story — full-screen, progress bars top
  "instagram-story": {
    id: "instagram-story",
    name: "Instagram Story",
    exportPx: { w: 1080, h: 1920 },
    cssAspect: "9 / 16",
    uiOverlay: {
      top: 0.09,
      bottom: 0.11,
      left: 0,
      right: 0,
    },
    presentation: "fullscreen",
    uiDescription:
      "Progress-bars + profil top (9%), Send message + home indicator bottom (11%)",
  },
  // TikTok — full-screen
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    exportPx: { w: 1080, h: 1920 },
    cssAspect: "9 / 16",
    uiOverlay: {
      top: 0.12,
      bottom: 0.22,
      left: 0,
      right: 0.17,
    },
    presentation: "fullscreen",
    uiDescription:
      "For-deg/Følger top (12%), caption + nav bottom (22%), like/share høyre (17%)",
  },
  // LinkedIn feed post
  "linkedin-feed": {
    id: "linkedin-feed",
    name: "LinkedIn Feed (1:1)",
    exportPx: { w: 1080, h: 1080 },
    cssAspect: "1 / 1",
    uiOverlay: { top: 0, bottom: 0, left: 0, right: 0 },
    presentation: "feed-card",
    uiDescription: "Post vises i feed-card med navn/tid over og engagement under",
  },
  "youtube-shorts": {
    id: "youtube-shorts",
    name: "YouTube Shorts",
    exportPx: { w: 1080, h: 1920 },
    cssAspect: "9 / 16",
    uiOverlay: {
      top: 0.06,
      bottom: 0.18,
      left: 0,
      right: 0.14,
    },
    presentation: "fullscreen",
    uiDescription:
      "Søk-bar top (6%), nav + caption bottom (18%), like/share høyre (14%)",
  },
  "youtube-thumbnail": {
    id: "youtube-thumbnail",
    name: "YouTube Thumbnail (16:9)",
    exportPx: { w: 1920, h: 1080 },
    cssAspect: "16 / 9",
    uiOverlay: { top: 0, bottom: 0.18, left: 0, right: 0 },
    presentation: "feed-card",
    uiDescription:
      "Thumbnail-format. Vises i YouTube-feed/search; bottom-right hjørne dekkes av varighet-pill (~10×4%)",
  },
};

/** Mapper aspect-ratio til de mest typiske plattformene. */
export function platformsForAspect(aspect: string): PlatformId[] {
  switch (aspect) {
    case "1:1": return ["instagram-feed-1x1", "linkedin-feed"];
    case "4:5": return ["instagram-feed-4x5"];
    case "9:16": return ["instagram-reels", "instagram-story", "tiktok", "youtube-shorts"];
    case "16:9": return ["youtube-thumbnail"];
    default: return ["instagram-feed-1x1"];
  }
}

/**
 * Returnerer "tegne-flate"-størrelse for telefon-skjermen i en gitt
 * containerstørrelse, slik at telefonen + sin aspect-ratio + bezel
 * passer.
 */
export function fitDeviceInContainer(
  device: DeviceSpec,
  containerW: number,
  containerH: number,
): { deviceW: number; deviceH: number; scale: number } {
  const deviceAspect = device.pointSize.w / device.pointSize.h;
  const containerAspect = containerW / containerH;
  let deviceW: number, deviceH: number;
  if (containerAspect > deviceAspect) {
    deviceH = containerH;
    deviceW = deviceH * deviceAspect;
  } else {
    deviceW = containerW;
    deviceH = deviceW / deviceAspect;
  }
  const scale = deviceW / device.pointSize.w;
  return { deviceW, deviceH, scale };
}
