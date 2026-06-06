/**
 * Resolve settings-catalog — known Project + Timeline + Clip setting-
 * keys with valid value formats. Brukes både av:
 *
 *   1. photoshop_resolve_settings_reference Claude-tool — returnerer
 *      katalog så Director vet hva den kan sette.
 *   2. Validering på setSetting-dispatcherne — advarer hvis verdi
 *      ikke matcher kjent format (men avviser ikke; Resolve har flere
 *      keys enn vi katalogiserer).
 *
 * Resolve godtar KUN string-verdier på Set* — vi katalogiserer hvilke
 * strings som er gyldige. Validerer aldri "ukjente" keys.
 */

export type SettingScope = "project" | "timeline" | "clip";

export interface SettingEntry {
  key: string;
  scope: SettingScope;
  category: string;
  description: string;
  /** Format-hint som vises til Claude. */
  valueFormat: string;
  /** Hvis satt — kun disse string-verdiene aksepteres. */
  enum?: readonly string[];
  /** Hvis satt — verdien tolkes som number med disse grensene. */
  numberRange?: { min: number; max: number; integer?: boolean };
  /** Eksempel-bruk Claude kan kopiere. */
  example?: string;
}

export const RESOLVE_SETTINGS_CATALOG: readonly SettingEntry[] = [
  // ─────────── Timeline / frame rate / resolution ───────────
  {
    key: "timelineFrameRate",
    scope: "project",
    category: "timeline",
    description:
      "Timeline frame rate. Settes på prosjekt-nivå, gjelder alle nye timelines. Ikke alle verdier støttes overalt — sjekk current først.",
    valueFormat: "string-tall: '23.976', '24', '25', '29.97', '30', '50', '59.94', '60'",
    enum: ["23.976", "24", "25", "29.97", "30", "47.952", "48", "50", "59.94", "60"],
    example: 'setSetting({ key: "timelineFrameRate", value: "24" })',
  },
  {
    key: "timelinePlaybackFrameRate",
    scope: "project",
    category: "timeline",
    description: "Playback frame rate — separat fra recording-rate. Brukes for drop-frame-tilfeller.",
    valueFormat: "string-tall: '23.976', '24', '25', '29.97', '30', '50', '59.94', '60'",
    enum: ["23.976", "24", "25", "29.97", "30", "47.952", "48", "50", "59.94", "60"],
  },
  {
    key: "timelineResolutionWidth",
    scope: "project",
    category: "timeline",
    description: "Output resolution width.",
    valueFormat: "string-tall: '1920', '3840', '7680', etc.",
    example: 'setSetting({ key: "timelineResolutionWidth", value: "3840" })',
  },
  {
    key: "timelineResolutionHeight",
    scope: "project",
    category: "timeline",
    description: "Output resolution height.",
    valueFormat: "string-tall: '1080', '2160', '4320', etc.",
  },
  {
    key: "videoMonitorFormat",
    scope: "project",
    category: "monitoring",
    description: "Video monitor format mapping.",
    valueFormat: "string-format-id",
  },
  // ─────────── Color science ───────────
  {
    key: "colorScienceMode",
    scope: "project",
    category: "colorScience",
    description: "Color science mode for prosjektet (klassisk vs YRGB Color Managed vs ACES).",
    valueFormat: "string-id",
    enum: [
      "davinciYRGB",
      "davinciYRGBColorManagedv2",
      "acescct",
      "acescc",
    ],
    example:
      'setSetting({ key: "colorScienceMode", value: "davinciYRGBColorManagedv2" })',
  },
  {
    key: "colorSpaceInput",
    scope: "project",
    category: "colorScience",
    description: "Default Input color space for managed mode.",
    valueFormat: "string-id (Rec.709, Rec.2020, S-Log3, V-Log, etc.)",
  },
  {
    key: "colorSpaceTimeline",
    scope: "project",
    category: "colorScience",
    description: "Timeline working color space.",
    valueFormat: "string-id (DaVinci WG/Intermediate, ACEScct, Rec.709, etc.)",
  },
  {
    key: "colorSpaceOutput",
    scope: "project",
    category: "colorScience",
    description: "Output color space for delivery.",
    valueFormat: "string-id (Rec.709, Rec.2020, P3 D65, etc.)",
  },
  {
    key: "colorAcesIDT",
    scope: "project",
    category: "colorScience",
    description: "ACES Input Device Transform (aktivt kun i ACES-modus).",
    valueFormat: "string-id",
  },
  {
    key: "colorAcesODT",
    scope: "project",
    category: "colorScience",
    description: "ACES Output Device Transform (aktivt kun i ACES-modus).",
    valueFormat: "string-id (sRGB, Rec.709, P3, Rec.2020, etc.)",
  },
  {
    key: "colorAcesNodeLUTProcessingSpace",
    scope: "project",
    category: "colorScience",
    description: "ACES node LUT processing space.",
    valueFormat: "string-id",
  },
  // ─────────── SuperScale / AI-upscale ───────────
  {
    key: "superScale",
    scope: "project",
    category: "ai",
    description:
      "AI upscale-modus for prosjektet. 0=Auto, 1=No scaling, 2=2x, 3=3x, 4=4x. Krever Studio.",
    valueFormat: "string-int: '0' (auto), '1', '2', '3', '4'",
    enum: ["0", "1", "2", "3", "4"],
    example: 'setSetting({ key: "superScale", value: "2" })',
  },
  // ─────────── Performance / proxy ───────────
  {
    key: "perfProxyMediaMode",
    scope: "project",
    category: "performance",
    description:
      "Proxy media håndtering. 0=disabled, 1=when available, 2=when source not available.",
    valueFormat: "string-int: '0', '1', '2'",
    enum: ["0", "1", "2"],
  },
  {
    key: "useStabilizationSmoothCam",
    scope: "project",
    category: "performance",
    description: "Aktiver SmoothCam stabilization for prosjektet.",
    valueFormat: "string-bool: '0' eller '1'",
    enum: ["0", "1"],
  },
  // ─────────── Audio ───────────
  {
    key: "audioCaptureBitDepth",
    scope: "project",
    category: "audio",
    description: "Audio capture bit depth.",
    valueFormat: "string-int: '16', '24', '32'",
    enum: ["16", "24", "32"],
  },
  {
    key: "audioCaptureSampleRate",
    scope: "project",
    category: "audio",
    description: "Audio capture sample rate (Hz).",
    valueFormat: "string-int: '44100', '48000', '96000'",
    enum: ["44100", "48000", "96000"],
  },
  {
    key: "audioRecordChannelFormat",
    scope: "project",
    category: "audio",
    description: "Audio record channel format.",
    valueFormat: "string-id (Stereo, 5.1, 7.1, etc.)",
  },
  // ─────────── Camera RAW ───────────
  {
    key: "cameraRawMode",
    scope: "project",
    category: "cameraRaw",
    description:
      "Camera RAW decode mode. Påvirker hvordan RAW-filer leses inn.",
    valueFormat: "string-id",
  },
  {
    key: "cameraRawDecodeQuality",
    scope: "project",
    category: "cameraRaw",
    description: "RAW decode kvalitet — påvirker playback-ytelse vs kvalitet.",
    valueFormat: "string-id (Full, Half, Quarter, etc.)",
  },
  // ─────────── Render / delivery ───────────
  {
    key: "exportPanelEnable",
    scope: "project",
    category: "delivery",
    description: "Aktiver export-panel.",
    valueFormat: "string-bool: '0' eller '1'",
    enum: ["0", "1"],
  },
  // ─────────── Clip-property eksempler ───────────
  {
    key: "Super Scale",
    scope: "clip",
    category: "ai",
    description:
      "Per-clip Super Scale. Samme verdiområde som project-level superScale.",
    valueFormat: "string-int: '0', '1', '2', '3', '4'",
    enum: ["0", "1", "2", "3", "4"],
    example:
      'clipSetProperty({ clip_id: "mp_1", key: "Super Scale", value: "2" })',
  },
  {
    key: "Resolution",
    scope: "clip",
    category: "metadata",
    description: "Clip-resolution som string (read-only ofte).",
    valueFormat: "string '1920x1080'",
  },
  {
    key: "FPS",
    scope: "clip",
    category: "metadata",
    description: "Clip frame rate (ofte read-only).",
    valueFormat: "string-tall",
  },
  {
    key: "Reel Name",
    scope: "clip",
    category: "metadata",
    description: "Reel Name brukt for EDL/conformat.",
    valueFormat: "string",
    example:
      'clipSetProperty({ clip_id: "mp_1", key: "Reel Name", value: "A001" })',
  },
  // ─────────── Timeline-scope ───────────
  {
    key: "timelineFrameRate",
    scope: "timeline",
    category: "timeline",
    description:
      "Per-timeline frame rate. Settes via timeline.setSetting. Allikevel bør den matche project.",
    valueFormat: "string-tall: '23.976', '24', '25', '29.97', '30', '50', '59.94', '60'",
    enum: ["23.976", "24", "25", "29.97", "30", "47.952", "48", "50", "59.94", "60"],
  },
  {
    key: "videoResWidth",
    scope: "timeline",
    category: "timeline",
    description: "Per-timeline output width (kan avvike fra project).",
    valueFormat: "string-tall",
  },
  {
    key: "videoResHeight",
    scope: "timeline",
    category: "timeline",
    description: "Per-timeline output height (kan avvike fra project).",
    valueFormat: "string-tall",
  },
] as const;

export type SettingCategory =
  | "timeline"
  | "monitoring"
  | "colorScience"
  | "ai"
  | "performance"
  | "audio"
  | "cameraRaw"
  | "delivery"
  | "metadata";

export const SETTING_CATEGORIES: readonly SettingCategory[] = [
  "timeline",
  "monitoring",
  "colorScience",
  "ai",
  "performance",
  "audio",
  "cameraRaw",
  "delivery",
  "metadata",
] as const;

export interface ValidationResult {
  ok: boolean;
  warning?: string;
}

/**
 * Sjekker setSetting/clipSetProperty mot katalogen. Returnerer alltid
 * `ok: true` for ukjente keys (Resolve har flere keys enn vi har
 * katalogisert) — vi advarer aldri på det. Kjente keys validerer
 * mot enum hvis satt.
 */
export function validateSetting(
  scope: SettingScope,
  key: string,
  value: string,
): ValidationResult {
  const entry = RESOLVE_SETTINGS_CATALOG.find(
    (e) => e.key === key && e.scope === scope,
  );
  if (!entry) return { ok: true };
  if (entry.enum && !entry.enum.includes(value)) {
    return {
      ok: false,
      warning: `'${key}' (${scope}) forventer en av: ${entry.enum.join(", ")} — fikk '${value}'`,
    };
  }
  return { ok: true };
}

/**
 * Hent katalogen filtrert på scope og/eller kategori.
 */
export function getCatalog(filter?: {
  scope?: SettingScope;
  category?: string;
}): SettingEntry[] {
  return RESOLVE_SETTINGS_CATALOG.filter((e) => {
    if (filter?.scope && e.scope !== filter.scope) return false;
    if (filter?.category && e.category !== filter.category) return false;
    return true;
  });
}
