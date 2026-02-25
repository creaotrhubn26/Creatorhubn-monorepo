/**
 * Client-side firmware knowledge base.
 *
 * Contains known latest firmware versions for popular cameras, lenses,
 * monitors, audio recorders and other production equipment commonly used
 * in the film & photography industry.
 *
 * Each entry is keyed by "brand::model" (lower-cased, trimmed).
 * Lookup helpers handle fuzzy matching so "Canon EOS C70" matches "c70".
 */

export interface FirmwareEntry {
  /** Canonical brand / manufacturer */
  brand: string;
  /** Canonical model */
  model: string;
  /** Latest known firmware version string */
  latestVersion: string;
  /** ISO date of the firmware release */
  releaseDate: string;
  /** Short description of key improvements */
  description: string;
  /** Importance: critical | important | recommended | optional */
  importance: 'critical' | 'important' | 'recommended' | 'optional';
  /** URL to manufacturer download page (may be region-neutral) */
  downloadUrl: string;
  /** Optional aliases that should also match */
  aliases?: string[];
  /** URL to release notes page */
  releaseNotesUrl?: string;
  /** How this entry was sourced: scrape | builtin | manual */
  sourceType?: 'scrape' | 'builtin' | 'manual';
  /** Whether scraping is blocked for this manufacturer (show direct link UX) */
  scrapeBlocked?: boolean;
}

/**
 * Firmware check status returned by the v2 API.
 */
export interface FirmwareCheckStatus {
  equipmentId?: string;
  status: 'up-to-date' | 'update-available' | 'unknown' | 'needs-mapping';
  currentVersion?: string;
  latestVersion?: string;
  downloadUrl?: string;
  releaseNotesUrl?: string;
  severity?: string;
  manufacturer?: string;
  model?: string;
  message?: string;
}

// ────────────────────────────────────────────────────────────────
// Firmware database – updated February 2026
// ────────────────────────────────────────────────────────────────

const FIRMWARE_DATABASE: FirmwareEntry[] = [
  // ── Canon Cinema EOS ──────────────────────────────────────────
  {
    brand: 'Canon',
    model: 'EOS C70',
    latestVersion: '1.0.9.1',
    releaseDate: '2025-07-10',
    importance: 'recommended',
    description:
      'Forbedret autofokus-sporing, stabilitetsfiks for HDMI-utgang og RF-objektivkompatibilitet.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-c70',
    aliases: ['C70', 'Cinema EOS C70'],
  },
  {
    brand: 'Canon',
    model: 'EOS C300 Mark III',
    latestVersion: '1.0.7.1',
    releaseDate: '2025-05-15',
    importance: 'recommended',
    description:
      'XF-AVC codec-forbedringer, forbedret Dual Pixel autofokus og kompatibilitet med nye RF-objektiver.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-c300-mark-iii',
    aliases: ['C300 Mark III', 'C300 III', 'C300MK3'],
  },
  {
    brand: 'Canon',
    model: 'EOS C500 Mark II',
    latestVersion: '1.0.5.1',
    releaseDate: '2025-03-20',
    importance: 'optional',
    description:
      'Mindre stabilitetsforbedringer og RAW-opptak-kompatibilitet.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-c500-mark-ii',
    aliases: ['C500 Mark II', 'C500 II', 'C500MK2'],
  },
  {
    brand: 'Canon',
    model: 'EOS C400',
    latestVersion: '1.0.2.1',
    releaseDate: '2025-09-01',
    importance: 'recommended',
    description:
      'Ny Cinema RAW Light LT-kodek, forbedringer i varmehåndtering.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-c400',
    aliases: ['C400'],
  },
  {
    brand: 'Canon',
    model: 'EOS C50',
    latestVersion: '1.0.1.1',
    releaseDate: '2025-11-15',
    importance: 'important',
    description:
      'Første fastvare for RF-mount Cinema EOS med 4K Super 35-sensor.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-c50',
    aliases: ['C50', 'Cinema EOS C50'],
  },
  {
    brand: 'Canon',
    model: 'EOS C80',
    latestVersion: '1.0.1.1',
    releaseDate: '2025-10-01',
    importance: 'important',
    description:
      'Første fastvare for fullformat 6K Cinema EOS med RF-fatning.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-c80',
    aliases: ['C80', 'Cinema EOS C80'],
  },
  {
    brand: 'Canon',
    model: 'EOS C200',
    latestVersion: '1.0.5.1',
    releaseDate: '2024-08-01',
    importance: 'optional',
    description:
      'Stabilitetsforbedringer for MP4-opptak og objektivkompatibilitet.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-c200',
    aliases: ['C200'],
  },

  // ── Canon Mirrorless (RF-mount) ────────────────────────────────
  {
    brand: 'Canon',
    model: 'EOS R5',
    latestVersion: '2.0.0',
    releaseDate: '2025-11-01',
    importance: 'important',
    description:
      'Forbedret overoppheting-håndtering, 8K RAW-stabilitet og Eye AF-oppdatering.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-r5',
    aliases: ['R5'],
  },
  {
    brand: 'Canon',
    model: 'EOS R5 Mark II',
    latestVersion: '1.1.0',
    releaseDate: '2025-12-10',
    importance: 'important',
    description:
      'Eye Control AF forbedringer, forbedret IBIS og C2PA-støtte.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-r5-mark-ii',
    aliases: ['R5 II', 'R5 Mark II', 'R5MK2'],
  },
  {
    brand: 'Canon',
    model: 'EOS R6 Mark II',
    latestVersion: '1.3.0',
    releaseDate: '2025-06-20',
    importance: 'recommended',
    description:
      'Forbedret dyresporings-AF, 6K oversampling-kvalitet og UVC-støtte.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-r6-mark-ii',
    aliases: ['R6 II', 'R6 Mark II', 'R6MK2'],
  },
  {
    brand: 'Canon',
    model: 'EOS R3',
    latestVersion: '1.7.1',
    releaseDate: '2025-08-01',
    importance: 'recommended',
    description:
      'Eye Control AF v2, forbedret IBIS og C-RAW burst-stabilitet.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-r3',
    aliases: ['R3'],
  },
  {
    brand: 'Canon',
    model: 'EOS R7',
    latestVersion: '1.4.0',
    releaseDate: '2025-04-15',
    importance: 'recommended',
    description:
      'Forbedret AF-ytelse med RF-S objektiver og overoppheting-forbedring.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-r7',
    aliases: ['R7'],
  },
  {
    brand: 'Canon',
    model: 'EOS R8',
    latestVersion: '1.2.0',
    releaseDate: '2025-05-01',
    importance: 'optional',
    description:
      'Mindre stabilitetsforbedringer og kompatibilitet med nye objektiver.',
    downloadUrl: 'https://www.usa.canon.com/support/p/eos-r8',
    aliases: ['R8'],
  },

  // ── Sony Cinema ──────────────────────────────────────────────
  {
    brand: 'Sony',
    model: 'FX6',
    latestVersion: '4.01',
    releaseDate: '2025-10-15',
    importance: 'important',
    description:
      'Ny Cine EI-modus, forbedret S-Cinetone og AF-sporings-forbedringer.',
    downloadUrl: 'https://www.sony.com/en/articles/support-for-ilme-fx6',
    aliases: ['ILME-FX6', 'Alpha FX6'],
  },
  {
    brand: 'Sony',
    model: 'FX3',
    latestVersion: '4.02',
    releaseDate: '2025-09-20',
    importance: 'important',
    description:
      'Forbedret S-Cinetone, AF-stabilitet og 4K 120p-forbedringer.',
    downloadUrl: 'https://www.sony.com/en/articles/support-for-ilme-fx3',
    aliases: ['ILME-FX3', 'Alpha FX3'],
  },
  {
    brand: 'Sony',
    model: 'FX30',
    latestVersion: '3.01',
    releaseDate: '2025-07-01',
    importance: 'recommended',
    description:
      'Forbedret AF-sporing og nye bildeprofil-funksjoner.',
    downloadUrl: 'https://www.sony.com/en/articles/support-for-ilme-fx30',
    aliases: ['ILME-FX30', 'Alpha FX30'],
  },
  {
    brand: 'Sony',
    model: 'FX9',
    latestVersion: '4.01',
    releaseDate: '2025-06-10',
    importance: 'important',
    description:
      'S700-protokollstøtte, forbedret 4K DCI og nye LUT-funksjoner.',
    downloadUrl: 'https://pro.sony/en_GB/products/handheld-camcorders/pxw-fx9',
    aliases: ['PXW-FX9'],
  },

  // ── Sony Mirrorless (E-mount) ────────────────────────────────
  {
    brand: 'Sony',
    model: 'A7 IV',
    latestVersion: '3.01',
    releaseDate: '2025-05-01',
    importance: 'recommended',
    description:
      'Forbedret AF-ytelse, stabilitet for 4K 60p og nye Creative Look-profiler.',
    downloadUrl: 'https://www.sony.com/en/articles/support-for-ilce-7m4',
    aliases: ['A7IV', 'A7M4', 'ILCE-7M4', 'Alpha 7 IV'],
  },
  {
    brand: 'Sony',
    model: 'A7S III',
    latestVersion: '3.00',
    releaseDate: '2025-03-15',
    importance: 'recommended',
    description:
      'Forbedret 4K 120p fargepresisjon, C2PA-støtte og Breathing Compensation.',
    downloadUrl: 'https://www.sony.com/en/articles/support-for-ilce-7sm3',
    aliases: ['A7SIII', 'A7SM3', 'ILCE-7SM3', 'Alpha 7S III'],
  },
  {
    brand: 'Sony',
    model: 'A7R V',
    latestVersion: '2.01',
    releaseDate: '2025-08-20',
    importance: 'recommended',
    description:
      'Forbedret AI-basert AF, Pixel Shift-stabilitet og nye bildeprofiler.',
    downloadUrl: 'https://www.sony.com/en/articles/support-for-ilce-7rm5',
    aliases: ['A7RV', 'A7RM5', 'ILCE-7RM5', 'Alpha 7R V'],
  },
  {
    brand: 'Sony',
    model: 'A9 III',
    latestVersion: '2.00',
    releaseDate: '2025-11-01',
    importance: 'important',
    description:
      'Global shutter-forbedringer, pre-capture burst og C2PA.',
    downloadUrl: 'https://www.sony.com/en/articles/support-for-ilce-9m3',
    aliases: ['A9III', 'A9M3', 'ILCE-9M3', 'Alpha 9 III'],
  },
  {
    brand: 'Sony',
    model: 'A1',
    latestVersion: '3.00',
    releaseDate: '2025-10-01',
    importance: 'important',
    description:
      'Forbedret 8K-stabilitet, AI AF v2 og forbedret IBIS-ytelse.',
    downloadUrl: 'https://www.sony.com/en/articles/support-for-ilce-1',
    aliases: ['A1', 'ILCE-1', 'Alpha 1'],
  },
  {
    brand: 'Sony',
    model: 'BURANO',
    latestVersion: '2.01',
    releaseDate: '2025-11-01',
    importance: 'important',
    description:
      'CineAlta fullformat 8.6K, forbedret autofokus og S-Cinetone.',
    downloadUrl: 'https://pro.sony/en_GB/products/cinema-line-cameras/burano',
    aliases: ['CineAlta BURANO'],
  },
  {
    brand: 'Sony',
    model: 'FR7',
    latestVersion: '3.01',
    releaseDate: '2025-08-15',
    importance: 'recommended',
    description:
      'PTZ Cinema Line-kamera, forbedret fjernkontroll og streaming.',
    downloadUrl: 'https://pro.sony/en_GB/products/ptz-network-cameras/ilme-fr7',
    aliases: ['ILME-FR7', 'PTZ FR7'],
  },

  // ── Blackmagic Design ─────────────────────────────────────────
  {
    brand: 'Blackmagic Design',
    model: 'Pocket Cinema Camera 6K G2',
    latestVersion: '9.6.1',
    releaseDate: '2025-12-01',
    importance: 'recommended',
    description:
      'BRAW 3:1 komprimeringsstøtte, forbedret gyro-stabilisering og nye LUT-verktøy.',
    downloadUrl: 'https://www.blackmagicdesign.com/support/family/camera-702',
    aliases: ['BMPCC 6K G2', 'Pocket 6K G2', 'BMPCC6KG2'],
  },
  {
    brand: 'Blackmagic Design',
    model: 'Pocket Cinema Camera 4K',
    latestVersion: '9.6.1',
    releaseDate: '2025-12-01',
    importance: 'recommended',
    description:
      'Forbedret BRAW-ytelse, nye fargestyringsverktøy og UI-forbedringer.',
    downloadUrl: 'https://www.blackmagicdesign.com/support/family/camera-702',
    aliases: ['BMPCC 4K', 'Pocket 4K', 'BMPCC4K'],
  },
  {
    brand: 'Blackmagic Design',
    model: 'URSA Mini Pro 12K',
    latestVersion: '9.6.1',
    releaseDate: '2025-12-01',
    importance: 'recommended',
    description:
      'Forbedret 12K sensor-avlesning, nye BRAW-komprimeringsnivåer.',
    downloadUrl: 'https://www.blackmagicdesign.com/support/family/camera-702',
    aliases: ['URSA 12K', 'URSA Mini 12K'],
  },
  {
    brand: 'Blackmagic Design',
    model: 'Cinema Camera 6K',
    latestVersion: '9.6.1',
    releaseDate: '2025-12-01',
    importance: 'recommended',
    description:
      'Blackmagic OS-oppdatering, nye funksjoner for DaVinci Resolve-integrasjon.',
    downloadUrl: 'https://www.blackmagicdesign.com/support/family/camera-702',
    aliases: ['BMCC 6K'],
  },
  {
    brand: 'Blackmagic Design',
    model: 'URSA Cine 12K',
    latestVersion: '1.2.0',
    releaseDate: '2025-12-01',
    importance: 'important',
    description:
      'URSA Cine-plattform, ny generasjon 12K-sensor med OLPF.',
    downloadUrl: 'https://www.blackmagicdesign.com/support/family/camera-702',
    aliases: ['URSA Cine', 'URSA Cine 12K'],
  },

  // ── Panasonic / Lumix ─────────────────────────────────────────
  {
    brand: 'Panasonic',
    model: 'Lumix S5 II',
    latestVersion: '3.0',
    releaseDate: '2025-08-15',
    importance: 'recommended',
    description:
      'Forbedret fase-AF, 6K Open Gate og nye V-Log-forbedringer.',
    downloadUrl: 'https://av.jpn.support.panasonic.com/support/global/cs/dsc/',
    aliases: ['S5II', 'DC-S5M2', 'Lumix S5II', 'S5 Mark II'],
  },
  {
    brand: 'Panasonic',
    model: 'Lumix S5 IIX',
    latestVersion: '3.0',
    releaseDate: '2025-08-15',
    importance: 'recommended',
    description:
      'Forbedret SRT/RTMP streaming, RAW-utgangsforbedringer.',
    downloadUrl: 'https://av.jpn.support.panasonic.com/support/global/cs/dsc/',
    aliases: ['S5IIX', 'DC-S5M2X', 'Lumix S5IIX'],
  },
  {
    brand: 'Panasonic',
    model: 'Lumix GH6',
    latestVersion: '2.7',
    releaseDate: '2025-06-01',
    importance: 'recommended',
    description:
      'Forbedret 5.7K ProRes-stabilitet, nye anamorfisk-moduser.',
    downloadUrl: 'https://av.jpn.support.panasonic.com/support/global/cs/dsc/',
    aliases: ['GH6', 'DC-GH6'],
  },
  {
    brand: 'Panasonic',
    model: 'Lumix GH7',
    latestVersion: '1.3',
    releaseDate: '2025-10-01',
    importance: 'important',
    description:
      'Ny Apple ProRes RAW-utgang via HDMI, forbedret AF og termisk styring.',
    downloadUrl: 'https://av.jpn.support.panasonic.com/support/global/cs/dsc/',
    aliases: ['GH7', 'DC-GH7'],
  },
  {
    brand: 'Panasonic',
    model: 'Lumix S1H',
    latestVersion: '2.8',
    releaseDate: '2025-04-01',
    importance: 'optional',
    description:
      'Stabilitetsforbedringer og kompatibilitet med nye L-mount-objektiver.',
    downloadUrl: 'https://av.jpn.support.panasonic.com/support/global/cs/dsc/',
    aliases: ['S1H', 'DC-S1H'],
  },

  // ── Nikon ─────────────────────────────────────────────────────
  {
    brand: 'Nikon',
    model: 'Z8',
    latestVersion: '2.10',
    releaseDate: '2025-09-01',
    importance: 'important',
    description:
      'Forbedret 8K RAW-utgang, N-RAW forbedringer og auto-capture.',
    downloadUrl: 'https://downloadcenter.nikonimglib.com/',
    aliases: ['Z 8'],
  },
  {
    brand: 'Nikon',
    model: 'Z9',
    latestVersion: '5.10',
    releaseDate: '2025-11-15',
    importance: 'important',
    description:
      'Forbedret 8K 60p-stabilitet, ny pre-release capture og N-RAW-oppdateringer.',
    downloadUrl: 'https://downloadcenter.nikonimglib.com/',
    aliases: ['Z 9'],
  },
  {
    brand: 'Nikon',
    model: 'Z6 III',
    latestVersion: '1.30',
    releaseDate: '2025-07-20',
    importance: 'recommended',
    description:
      'Forbedret AF-sporing, 6K oversampled 4K og Eye AF-forbedringer.',
    downloadUrl: 'https://downloadcenter.nikonimglib.com/',
    aliases: ['Z 6III', 'Z6III', 'Z 6 III'],
  },

  // ── Fujifilm ──────────────────────────────────────────────────
  {
    brand: 'Fujifilm',
    model: 'X-T5',
    latestVersion: '3.10',
    releaseDate: '2025-06-15',
    importance: 'recommended',
    description:
      'Forbedret AF-algoritme, nye filmsimuleringer og stabilitetsfiks.',
    downloadUrl: 'https://fujifilm-x.com/en-us/support/download/firmware/cameras/',
    aliases: ['XT5', 'X-T5'],
  },
  {
    brand: 'Fujifilm',
    model: 'X-H2S',
    latestVersion: '5.00',
    releaseDate: '2025-09-01',
    importance: 'important',
    description:
      'Forbedret 6.2K ProRes-opptak, nye AF-moduser og Blackmagic RAW-utgang.',
    downloadUrl: 'https://fujifilm-x.com/en-us/support/download/firmware/cameras/',
    aliases: ['XH2S', 'X-H2S'],
  },
  {
    brand: 'Fujifilm',
    model: 'GFX 100 II',
    latestVersion: '2.10',
    releaseDate: '2025-08-10',
    importance: 'recommended',
    description:
      'Forbedret 8K-stabilitet, nye filmsimuleringer og tethering-forbedringer.',
    downloadUrl: 'https://fujifilm-x.com/en-us/support/download/firmware/cameras/',
    aliases: ['GFX100II', 'GFX 100II'],
  },
  {
    brand: 'Fujifilm',
    model: 'X-H2',
    latestVersion: '4.10',
    releaseDate: '2025-07-01',
    importance: 'recommended',
    description:
      'Forbedret 8K-video, IBIS-forbedringer og nye filmsimuleringer.',
    downloadUrl: 'https://fujifilm-x.com/en-us/support/download/firmware/cameras/',
    aliases: ['XH2', 'X-H2'],
  },
  {
    brand: 'Fujifilm',
    model: 'X-T50',
    latestVersion: '1.20',
    releaseDate: '2025-10-15',
    importance: 'optional',
    description:
      'Filmsimuleringsskive-oppdateringer, forbedret motivgjenkjenning.',
    downloadUrl: 'https://fujifilm-x.com/en-us/support/download/firmware/cameras/',
    aliases: ['XT50', 'X-T50'],
  },

  // ── RED ─────────────────────────────────────────────────────
  {
    brand: 'RED',
    model: 'V-RAPTOR',
    latestVersion: '1.5.2',
    releaseDate: '2025-10-01',
    importance: 'important',
    description:
      'Nye REDCODE-komprimeringsnivåer, forbedret sensor-kalibrering.',
    downloadUrl: 'https://www.red.com/downloads',
    aliases: ['RAPTOR', 'DSMC3 V-RAPTOR'],
  },
  {
    brand: 'RED',
    model: 'KOMODO',
    latestVersion: '7.5.0',
    releaseDate: '2025-07-01',
    importance: 'recommended',
    description:
      'Forbedret R3D-ytelse og nye monitoring-funksjoner.',
    downloadUrl: 'https://www.red.com/downloads',
    aliases: ['KOMODO 6K'],
  },
  {
    brand: 'RED',
    model: 'KOMODO-X',
    latestVersion: '7.5.0',
    releaseDate: '2025-07-01',
    importance: 'recommended',
    description:
      'Ny global shutter-modus, forbedret REDCODE HQ.',
    downloadUrl: 'https://www.red.com/downloads',
    aliases: ['KOMODO X'],
  },

  // ── Audio – Zoom ──────────────────────────────────────────────
  {
    brand: 'Zoom',
    model: 'F6',
    latestVersion: '2.10',
    releaseDate: '2025-04-01',
    importance: 'recommended',
    description:
      'Forbedret 32-bit float-opptak og Bluetooth-timecode-synk.',
    downloadUrl: 'https://zoomcorp.com/en/us/field-recorders/field-recorders/f6/',
    aliases: ['Zoom F6'],
  },
  {
    brand: 'Zoom',
    model: 'F8n Pro',
    latestVersion: '2.50',
    releaseDate: '2025-06-01',
    importance: 'recommended',
    description:
      'Nye automiks-funksjoner og forbedret USB-grensesnitt.',
    downloadUrl: 'https://zoomcorp.com/en/us/field-recorders/multitrack-field-recorders/f8n-pro/',
    aliases: ['F8n Pro', 'Zoom F8n Pro'],
  },
  {
    brand: 'Zoom',
    model: 'H6essential',
    latestVersion: '1.20',
    releaseDate: '2025-05-01',
    importance: 'optional',
    description:
      'Forbedret 32-bit float-ytelse og SD-kompatibilitet.',
    downloadUrl: 'https://zoomcorp.com/en/us/handheld-recorders/',
    aliases: ['H6 essential', 'Zoom H6essential'],
  },

  // ── Audio – Sound Devices ─────────────────────────────────────
  {
    brand: 'Sound Devices',
    model: 'MixPre-6 II',
    latestVersion: '8.10',
    releaseDate: '2025-03-01',
    importance: 'recommended',
    description:
      'Forbedret USB-C grensesnitt og timecode-stabilitet.',
    downloadUrl: 'https://www.sounddevices.com/mixpre-6-ii/',
    aliases: ['MixPre-6II', 'MixPre 6 II'],
  },
  {
    brand: 'Sound Devices',
    model: '888',
    latestVersion: '6.00',
    releaseDate: '2025-07-01',
    importance: 'important',
    description:
      'Ny CL-16 fader-støtte, forbedret Dante-ytelse.',
    downloadUrl: 'https://www.sounddevices.com/888/',
    aliases: ['SD 888'],
  },

  // ── Monitors – Atomos ─────────────────────────────────────────
  {
    brand: 'Atomos',
    model: 'Ninja V+',
    latestVersion: '10.92',
    releaseDate: '2025-05-01',
    importance: 'recommended',
    description:
      'Forbedret 8K ProRes RAW-avspilling og nye eksponerings-verktøy.',
    downloadUrl: 'https://www.atomos.com/firmware',
    aliases: ['Ninja V Plus', 'NinjaV+'],
  },
  {
    brand: 'Atomos',
    model: 'Shogun Ultra',
    latestVersion: '11.10',
    releaseDate: '2025-10-01',
    importance: 'important',
    description:
      'Forbedret 8K ProRes-opptak, SDI-stabilitet og nye HDR-verktøy.',
    downloadUrl: 'https://www.atomos.com/firmware',
    aliases: ['Shogun Ultra'],
  },

  // ── Monitors – SmallHD ────────────────────────────────────────
  {
    brand: 'SmallHD',
    model: 'Indie 7',
    latestVersion: '5.4.0',
    releaseDate: '2025-04-01',
    importance: 'optional',
    description:
      'Nye page-builder-verktøy og 3D LUT-grensesnitt.',
    downloadUrl: 'https://www.smallhd.com/community/firmware-updates',
    aliases: ['Indie7'],
  },

  // ── Gimbals / Stabilizers – DJI ────────────────────────────────
  {
    brand: 'DJI',
    model: 'RS 5',
    latestVersion: '1.0.1.10',
    releaseDate: '2026-01-15',
    importance: 'important',
    description:
      'Neste generasjons stabilisator med AI-sporing og innebygd LiDAR-fokus.',
    downloadUrl: 'https://www.dji.com/downloads/products/dji-rs-5',
    aliases: ['RS5', 'Ronin RS5', 'DJI RS5'],
  },
  {
    brand: 'DJI',
    model: 'RS 5 Pro',
    latestVersion: '1.0.1.10',
    releaseDate: '2026-01-15',
    importance: 'important',
    description:
      'Pro-gimbal med utvidet nyttelast, AI ActiveTrack Pro.',
    downloadUrl: 'https://www.dji.com/downloads/products/dji-rs-5-pro',
    aliases: ['RS5 Pro', 'Ronin RS5 Pro', 'DJI RS5 Pro'],
  },
  {
    brand: 'DJI',
    model: 'RS 4 Pro',
    latestVersion: '2.1.0.20',
    releaseDate: '2025-08-01',
    importance: 'recommended',
    description:
      'Forbedret motorstyrke, nye ActiveTrack-profiler og LiDAR-integrasjon.',
    downloadUrl: 'https://www.dji.com/downloads/products/dji-rs-4-pro',
    aliases: ['RS4 Pro', 'Ronin RS4 Pro'],
  },
  {
    brand: 'DJI',
    model: 'RS 4',
    latestVersion: '1.2.0',
    releaseDate: '2025-09-20',
    importance: 'recommended',
    description:
      'Lettvekts gimbal, forbedret stabilisering og appstyring.',
    downloadUrl: 'https://www.dji.com/downloads/products/dji-rs-4',
    aliases: ['RS4', 'Ronin RS4'],
  },
  {
    brand: 'DJI',
    model: 'RS 3 Pro',
    latestVersion: '1.6.5.10',
    releaseDate: '2025-03-15',
    importance: 'optional',
    description:
      'Stabilitetsforbedringer og kompatibilitet med nye kameravekter.',
    downloadUrl: 'https://www.dji.com/downloads/products/dji-rs-3-pro',
    aliases: ['RS3 Pro', 'Ronin RS3 Pro'],
  },
  {
    brand: 'DJI',
    model: 'Ronin 4D',
    latestVersion: '3.1.0.10',
    releaseDate: '2025-12-01',
    importance: 'important',
    description:
      'LiDAR AF-forbedringer, 6K ProRes RAW, internopptak-oppdateringer.',
    downloadUrl: 'https://www.dji.com/downloads/products/ronin-4d',
    aliases: ['Ronin4D', 'DJI Ronin 4D'],
  },
  {
    brand: 'DJI',
    model: 'Ronin 4D-8K',
    latestVersion: '2.0.0.10',
    releaseDate: '2025-11-01',
    importance: 'important',
    description:
      'Fullformat 8K-opptak, forbedret LiDAR og stabilisering.',
    downloadUrl: 'https://www.dji.com/downloads/products/ronin-4d-8k',
    aliases: ['Ronin4D 8K', 'DJI Ronin 4D-8K'],
  },

  // ── Drones – DJI ──────────────────────────────────────────────
  {
    brand: 'DJI',
    model: 'Mavic 3 Pro Cine',
    latestVersion: '01.01.0600',
    releaseDate: '2025-09-01',
    importance: 'important',
    description:
      'Nye waypoint-funksjoner, forbedret ProRes-opptak og ADS-B.',
    downloadUrl: 'https://www.dji.com/downloads/products/mavic-3-pro',
    aliases: ['DJI Mavic 3 Pro Cine'],
  },
  {
    brand: 'DJI',
    model: 'Mavic 3 Pro',
    latestVersion: '01.01.0600',
    releaseDate: '2025-08-15',
    importance: 'recommended',
    description:
      'Trippelkamerasystem, forbedret APAS 5.0 hindringsunngåelse.',
    downloadUrl: 'https://www.dji.com/downloads/products/mavic-3-pro',
    aliases: ['DJI Mavic 3 Pro', 'Mavic3 Pro'],
  },
  {
    brand: 'DJI',
    model: 'Air 3',
    latestVersion: '1.4.0',
    releaseDate: '2025-10-01',
    importance: 'recommended',
    description:
      'Dobbeltkamerasystem, forbedret waypoint-oppdrag.',
    downloadUrl: 'https://www.dji.com/downloads/products/air-3',
    aliases: ['DJI Air 3', 'DJI Air3'],
  },
  {
    brand: 'DJI',
    model: 'Mini 4 Pro',
    latestVersion: '1.4.0',
    releaseDate: '2025-09-15',
    importance: 'recommended',
    description:
      'Forbedret ActiveTrack, forbedret 4K HDR-video.',
    downloadUrl: 'https://www.dji.com/downloads/products/mini-4-pro',
    aliases: ['DJI Mini 4 Pro', 'Mini4 Pro'],
  },
  {
    brand: 'DJI',
    model: 'Avata 2',
    latestVersion: '1.3.0',
    releaseDate: '2025-08-01',
    importance: 'recommended',
    description:
      'Forbedret acro-modus, forbedret videostabilisering.',
    downloadUrl: 'https://www.dji.com/downloads/products/avata-2',
    aliases: ['DJI Avata 2', 'Avata2'],
  },
  {
    brand: 'DJI',
    model: 'Inspire 3',
    latestVersion: '3.01.01.01',
    releaseDate: '2025-10-15',
    importance: 'important',
    description:
      'Forbedret CineCore-integrasjon, nye fotomoduser og ADS-B v2.',
    downloadUrl: 'https://www.dji.com/downloads/products/inspire-3',
    aliases: ['Inspire3'],
  },

  // ── Lighting – Aputure ────────────────────────────────────────
  {
    brand: 'Aputure',
    model: 'LS 600d Pro',
    latestVersion: '1.3.0',
    releaseDate: '2025-02-01',
    importance: 'optional',
    description:
      'Forbedret CRMX-stabilitet og nye effekt-moduser.',
    downloadUrl: 'https://www.aputure.com/products/ls-600d-pro/',
    aliases: ['600d Pro', 'Light Storm 600d Pro'],
  },
  {
    brand: 'Aputure',
    model: 'LS 600x Pro',
    latestVersion: '1.2.0',
    releaseDate: '2025-07-01',
    importance: 'optional',
    description:
      'Bi-color 600W COB, forbedret Sidus Link og DMX.',
    downloadUrl: 'https://www.aputure.com/products/ls-600x-pro/',
    aliases: ['600x Pro', 'Light Storm 600x Pro'],
  },
  {
    brand: 'Aputure',
    model: 'LS 300x II',
    latestVersion: '1.3.0',
    releaseDate: '2025-06-01',
    importance: 'optional',
    description:
      'Bi-color 300W, forbedret fargenøyaktighet og CRMX.',
    downloadUrl: 'https://www.aputure.com/products/ls-300x-ii/',
    aliases: ['300x II', 'Light Storm 300x II'],
  },
  {
    brand: 'Aputure',
    model: 'LS 1200d Pro',
    latestVersion: '1.1.0',
    releaseDate: '2025-09-01',
    importance: 'recommended',
    description:
      '1200W dagslys-LED, Sidus Link 2.0 og DMX-forbedringer.',
    downloadUrl: 'https://www.aputure.com/products/ls-1200d-pro/',
    aliases: ['1200d Pro', 'Light Storm 1200d Pro'],
  },
  {
    brand: 'Aputure',
    model: 'Nova P600c',
    latestVersion: '1.2.0',
    releaseDate: '2025-04-01',
    importance: 'optional',
    description:
      'RGBWW myk panel, forbedret fargevitenskap og DMX.',
    downloadUrl: 'https://www.aputure.com/products/nova-p600c/',
    aliases: ['Nova P600c', 'P600c'],
  },
  {
    brand: 'Aputure',
    model: 'MC Pro',
    latestVersion: '1.2.0',
    releaseDate: '2025-05-01',
    importance: 'optional',
    description:
      'Nye farge-effekter og forbedret Sidus Link-integrasjon.',
    downloadUrl: 'https://www.aputure.com/products/mc-pro/',
    aliases: ['MC Pro'],
  },

  // ── Lighting – Nanlite ────────────────────────────────────────
  {
    brand: 'Nanlite',
    model: 'Forza 720B',
    latestVersion: '1.3.0',
    releaseDate: '2025-10-15',
    importance: 'recommended',
    description:
      '720W bi-color COB, forbedret NANLINK-app og DMX.',
    downloadUrl: 'https://www.nanlite.com/downloads/',
    aliases: ['Forza720B'],
  },
  {
    brand: 'Nanlite',
    model: 'Forza 300B II',
    latestVersion: '1.2.0',
    releaseDate: '2025-08-01',
    importance: 'optional',
    description:
      'Bi-color 300W COB, forbedret fargenøyaktighet.',
    downloadUrl: 'https://www.nanlite.com/downloads/',
    aliases: ['Forza300B II', 'Forza 300B Mark II'],
  },
  {
    brand: 'Nanlite',
    model: 'Forza 500B II',
    latestVersion: '1.1.0',
    releaseDate: '2025-09-15',
    importance: 'optional',
    description:
      '500W bi-color, forbedret NANLINK og Bluetooth.',
    downloadUrl: 'https://www.nanlite.com/downloads/',
    aliases: ['Forza500B II'],
  },
  {
    brand: 'Nanlite',
    model: 'PavoTube II 30X',
    latestVersion: '2.0.0',
    releaseDate: '2025-06-01',
    importance: 'recommended',
    description:
      'RGBWW rørlampe, forbedret piksel-effekter og DMX.',
    downloadUrl: 'https://www.nanlite.com/downloads/',
    aliases: ['PavoTube 30X', 'PT30X'],
  },
  {
    brand: 'Nanlite',
    model: 'PavoTube II 15X',
    latestVersion: '2.0.0',
    releaseDate: '2025-06-01',
    importance: 'optional',
    description:
      'Kompakt RGBWW-rør, nye effekter og DMX-styring.',
    downloadUrl: 'https://www.nanlite.com/downloads/',
    aliases: ['PavoTube 15X', 'PT15X'],
  },

  // ── Lighting – Godox ──────────────────────────────────────────
  {
    brand: 'Godox',
    model: 'KNOWLED M600Bi',
    latestVersion: '1.4.0',
    releaseDate: '2025-11-01',
    importance: 'recommended',
    description:
      '600W bi-color LED, forbedret DMX og trådløs kontroll.',
    downloadUrl: 'https://www.godox.com/downloads/',
    aliases: ['M600Bi', 'KNOWLED M600'],
  },
  {
    brand: 'Godox',
    model: 'SL300III',
    latestVersion: '1.2.0',
    releaseDate: '2025-07-15',
    importance: 'optional',
    description:
      '300W dagslys COB, forbedret Bluetooth-app og DMX.',
    downloadUrl: 'https://www.godox.com/downloads/',
    aliases: ['SL300 III', 'SL-300III'],
  },
  {
    brand: 'Godox',
    model: 'ML60Bi',
    latestVersion: '1.1.0',
    releaseDate: '2025-05-01',
    importance: 'optional',
    description:
      'Kompakt 60W bi-color, forbedret batteridrift.',
    downloadUrl: 'https://www.godox.com/downloads/',
    aliases: ['ML-60Bi'],
  },
  {
    brand: 'Godox',
    model: 'TL60',
    latestVersion: '1.3.0',
    releaseDate: '2025-08-01',
    importance: 'optional',
    description:
      'RGB rørlampe, nye effekter og Light FX-app.',
    downloadUrl: 'https://www.godox.com/downloads/',
    aliases: ['Godox TL60', 'TL-60'],
  },

  // ── Stabilizers – Zhiyun ──────────────────────────────────────
  {
    brand: 'Zhiyun',
    model: 'Crane 4',
    latestVersion: '2.1.0',
    releaseDate: '2025-10-01',
    importance: 'recommended',
    description:
      'Innebygd AI-sporing, forbedret stabiliseringsalgoritme.',
    downloadUrl: 'https://www.zhiyun-tech.com/en/service/download',
    aliases: ['Crane4', 'Zhiyun Crane 4'],
  },
  {
    brand: 'Zhiyun',
    model: 'Crane 4E',
    latestVersion: '1.3.0',
    releaseDate: '2025-08-01',
    importance: 'optional',
    description:
      'Kompakt gimbal med sling-modus, forbedrede motorer.',
    downloadUrl: 'https://www.zhiyun-tech.com/en/service/download',
    aliases: ['Crane4E', 'Zhiyun Crane 4E'],
  },
  {
    brand: 'Zhiyun',
    model: 'Weebill 3S',
    latestVersion: '1.2.0',
    releaseDate: '2025-06-15',
    importance: 'optional',
    description:
      'Kompakt gimbal, innebygd fyllys og mikrofonsstøtte.',
    downloadUrl: 'https://www.zhiyun-tech.com/en/service/download',
    aliases: ['Weebill3S', 'Zhiyun Weebill 3S'],
  },

  // ── Wireless Audio – Rode ─────────────────────────────────────
  {
    brand: 'Rode',
    model: 'Wireless PRO',
    latestVersion: '2.4.0',
    releaseDate: '2025-11-01',
    importance: 'recommended',
    description:
      '32-bit float-opptak, forbedret tidskode og GainAssist.',
    downloadUrl: 'https://www.rode.com/wireless-pro',
    aliases: ['Wireless PRO', 'Rode WirelessPRO'],
  },
  {
    brand: 'Rode',
    model: 'Wireless GO II',
    latestVersion: '2.2.0',
    releaseDate: '2025-07-01',
    importance: 'optional',
    description:
      'Dobbeltkanals trådløs, forbedret internt opptak.',
    downloadUrl: 'https://www.rode.com/wireless-go-ii',
    aliases: ['Wireless GO 2', 'WirelessGO II'],
  },
  {
    brand: 'Rode',
    model: 'Wireless ME',
    latestVersion: '1.4.0',
    releaseDate: '2025-09-15',
    importance: 'optional',
    description:
      'Kompakt trådløs mikrofon, forbedret Bluetooth-paring.',
    downloadUrl: 'https://www.rode.com/wireless-me',
    aliases: ['WirelessME'],
  },
  {
    brand: 'Rode',
    model: 'Caster Pro II',
    latestVersion: '1.2.0',
    releaseDate: '2025-10-01',
    importance: 'optional',
    description:
      'Podcast-studio, forbedret APHEX-prosessering og streaming.',
    downloadUrl: 'https://www.rode.com/caster-pro-ii',
    aliases: ['CasterPro II', 'Caster Pro 2'],
  },

  // ── Wireless Audio – DJI ──────────────────────────────────────
  {
    brand: 'DJI',
    model: 'Mic 2',
    latestVersion: '1.3.0',
    releaseDate: '2025-09-01',
    importance: 'recommended',
    description:
      '32-bit float, forbedret støydemping, Bluetooth 5.3.',
    downloadUrl: 'https://www.dji.com/downloads/products/dji-mic-2',
    aliases: ['DJI Mic 2', 'DJI Mic2'],
  },

  // ── Monitors – Atomos (additional) ────────────────────────────
  {
    brand: 'Atomos',
    model: 'Ninja Ultra',
    latestVersion: '11.10',
    releaseDate: '2025-10-01',
    importance: 'important',
    description:
      '8K HDMI-opptak, AtomOS 11 med skysynkronisering.',
    downloadUrl: 'https://www.atomos.com/firmware',
    aliases: ['Ninja Ultra', 'AtomOS Ninja Ultra'],
  },

  // ── Wireless Video – Hollyland ────────────────────────────────
  {
    brand: 'Hollyland',
    model: 'Mars 4K',
    latestVersion: '1.5.0',
    releaseDate: '2025-09-01',
    importance: 'recommended',
    description:
      '4K trådløs video TX, forbedret 5GHz-stabilitet.',
    downloadUrl: 'https://www.hollyland.com/downloads',
    aliases: ['Mars4K', 'Hollyland Mars 4K'],
  },
  {
    brand: 'Hollyland',
    model: 'Pyro 7',
    latestVersion: '1.3.0',
    releaseDate: '2025-11-15',
    importance: 'recommended',
    description:
      '7-tommers skjerm med innebygd TX/RX, 4K trådløs.',
    downloadUrl: 'https://www.hollyland.com/downloads',
    aliases: ['Pyro7', 'Hollyland Pyro 7'],
  },

  // ── Wireless Video – Teradek ──────────────────────────────────
  {
    brand: 'Teradek',
    model: 'Bolt 6 LT 750',
    latestVersion: '1.2.4',
    releaseDate: '2025-06-01',
    importance: 'recommended',
    description:
      'Forbedret OFDM-ytelse og lavere latens.',
    downloadUrl: 'https://teradek.com/pages/downloads',
    aliases: ['Bolt 6 LT', 'Bolt6 LT 750'],
  },

  // ── Lenses (smart / firmware updatable) ───────────────────────
  {
    brand: 'Sigma',
    model: '24-70mm F2.8 DG DN Art',
    latestVersion: '1.3',
    releaseDate: '2025-04-01',
    importance: 'optional',
    description:
      'Forbedret AF-hastighet og kompatibilitet med nye kamerahus.',
    downloadUrl: 'https://www.sigma-global.com/en/download/',
    aliases: ['Sigma 24-70 Art'],
  },
  {
    brand: 'Tamron',
    model: '35-150mm F/2-2.8 Di III VXD',
    latestVersion: '3',
    releaseDate: '2025-03-01',
    importance: 'optional',
    description:
      'Forbedret VXD-motorstøy og AF-presisjon.',
    downloadUrl: 'https://www.tamron.com/support/firmware-update.html',
    aliases: ['Tamron 35-150'],
  },
];

// ────────────────────────────────────────────────────────────────
// Community firmware entries – synced with backend API
// ────────────────────────────────────────────────────────────────

const CUSTOM_STORAGE_KEY = 'firmware_custom_entries';

/** Load user-added entries from localStorage (offline fallback) */
function loadCustomEntries(): FirmwareEntry[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist entries to localStorage (offline fallback cache) */
function saveCustomEntries(entries: FirmwareEntry[]): void {
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    console.warn('Could not persist custom firmware entries');
  }
}

/** In-memory cache of community entries (synced with backend) */
let _customEntries: FirmwareEntry[] = loadCustomEntries();

/** Whether we have fetched from backend at least once this session */
let _backendSynced = false;

// ────────────────────────────────────────────────────────────────
// Backend API sync
// ────────────────────────────────────────────────────────────────

interface CatalogApiEntry {
  id?: string;
  /** v2 uses manufacturer, v1 uses brand */
  manufacturer?: string;
  brand?: string;
  model: string;
  /** v2 uses version, v1 uses latestVersion */
  version?: string;
  latestVersion?: string;
  releaseDate?: string;
  importance?: string;
  description?: string;
  downloadUrl?: string;
  releaseNotesUrl?: string;
  sourceType?: string;
  sourceUrl?: string;
  aliases?: string[];
}

function apiEntryToFirmware(e: CatalogApiEntry): FirmwareEntry {
  const mfr = e.manufacturer || e.brand || '';
  const ver = e.version || e.latestVersion || '';
  return {
    brand: mfr,
    model: e.model,
    latestVersion: ver,
    releaseDate: e.releaseDate || new Date().toISOString().slice(0, 10),
    importance: (['critical', 'important', 'recommended', 'optional'].includes(e.importance || '')
      ? e.importance as FirmwareEntry['importance']
      : 'optional'),
    description: e.description || '',
    downloadUrl: e.downloadUrl || '',
    releaseNotesUrl: e.releaseNotesUrl || '',
    sourceType: (['scrape', 'builtin', 'manual'].includes(e.sourceType || '')
      ? e.sourceType as FirmwareEntry['sourceType']
      : undefined),
    aliases: e.aliases || [],
  };
}

/**
 * Fetch all community firmware entries from the backend.
 * Merges results into in-memory + localStorage cache.
 * Returns the entries on success, or cached entries on failure.
 */
export async function syncFirmwareCatalog(): Promise<FirmwareEntry[]> {
  try {
    // Try v2 endpoint first, fallback to v1
    let res = await fetch('/api/firmware/v2/catalog');
    if (!res.ok) {
      res = await fetch('/api/firmware/catalog');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: CatalogApiEntry[] = await res.json();
    if (!Array.isArray(data)) throw new Error('Invalid response');

    _customEntries = data.map(apiEntryToFirmware);
    saveCustomEntries(_customEntries);
    invalidateIndex();
    _backendSynced = true;
    return _customEntries;
  } catch (err) {
    console.warn('Could not sync firmware catalog from backend, using local cache:', err);
    return _customEntries;
  }
}

/**
 * Add a firmware entry to the shared catalog (backend + local cache).
 * All users will see this entry after their next sync.
 */
export async function addCommunityFirmwareEntry(entry: FirmwareEntry): Promise<boolean> {
  try {
    const res = await fetch('/api/firmware/v2/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manufacturer: entry.brand,
        model: entry.model,
        version: entry.latestVersion,
        releaseDate: entry.releaseDate,
        importance: entry.importance,
        description: entry.description,
        downloadUrl: entry.downloadUrl,
        releaseNotesUrl: entry.releaseNotesUrl || '',
        sourceType: entry.sourceType || 'manual',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Update local cache immediately
    const key = `${normalize(entry.brand)}::${normalize(entry.model)}`;
    _customEntries = _customEntries.filter(
      e => `${normalize(e.brand)}::${normalize(e.model)}` !== key
    );
    _customEntries.push(entry);
    saveCustomEntries(_customEntries);
    invalidateIndex();
    return true;
  } catch (err) {
    console.error('Failed to save community firmware entry:', err);
    // Still save locally as fallback
    addCustomFirmwareEntryLocal(entry);
    return false;
  }
}

/**
 * Remove a firmware entry from the shared catalog.
 * Requires the backend entry ID.
 */
export async function removeCommunityFirmwareEntry(brand: string, model: string): Promise<boolean> {
  try {
    // First find the entry's backend ID from the v2 catalog
    const res = await fetch('/api/firmware/v2/catalog');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: CatalogApiEntry[] = await res.json();
    const match = data.find(
      e => normalize(e.manufacturer || e.brand || '') === normalize(brand) && normalize(e.model) === normalize(model)
    );
    if (match?.id) {
      const delRes = await fetch(`/api/firmware/v2/catalog/${match.id}`, { method: 'DELETE' });
      if (!delRes.ok) throw new Error(`DELETE HTTP ${delRes.status}`);
    }

    // Remove from local cache
    _customEntries = _customEntries.filter(
      e => `${normalize(e.brand)}::${normalize(e.model)}` !== `${normalize(brand)}::${normalize(model)}`
    );
    saveCustomEntries(_customEntries);
    invalidateIndex();
    return true;
  } catch (err) {
    console.error('Failed to remove community firmware entry:', err);
    // Still remove locally
    removeCustomFirmwareEntryLocal(brand, model);
    return false;
  }
}

/** Whether we have synced with the backend at least once */
export function isBackendSynced(): boolean {
  return _backendSynced;
}

// ────────────────────────────────────────────────────────────────
// Lookup helpers
// ────────────────────────────────────────────────────────────────

const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

/** Pre-built index for O(1) lookups – invalidated when custom entries change */
let _index: Map<string, FirmwareEntry> | null = null;

function buildIndexFrom(entries: FirmwareEntry[], target: Map<string, FirmwareEntry>) {
  for (const entry of entries) {
    const canonKey = `${normalize(entry.brand)}::${normalize(entry.model)}`;
    target.set(canonKey, entry);
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        target.set(`${normalize(entry.brand)}::${normalize(alias)}`, entry);
      }
    }
  }
}

function getIndex(): Map<string, FirmwareEntry> {
  if (_index) return _index;
  _index = new Map<string, FirmwareEntry>();
  // Built-in entries first, then custom (custom overrides built-in for same key)
  buildIndexFrom(FIRMWARE_DATABASE, _index);
  buildIndexFrom(_customEntries, _index);
  return _index;
}

/** Invalidate index so next lookup rebuilds it */
function invalidateIndex(): void {
  _index = null;
}

/**
 * Look up firmware for a given brand + model.
 * Uses exact match first, then tries substring matching.
 */
export function lookupFirmware(brand?: string, model?: string): FirmwareEntry | null {
  if (!brand?.trim() || !model?.trim()) return null;

  const idx = getIndex();
  const bNorm = normalize(brand);
  const mNorm = normalize(model);

  // 1. Exact match
  const exact = idx.get(`${bNorm}::${mNorm}`);
  if (exact) return exact;

  // 2. Check if model is contained in any entry's normalized model (or vice-versa)
  for (const [key, entry] of idx) {
    const [keyBrand, keyModel] = key.split('::');
    if (keyBrand !== bNorm) continue;
    if (mNorm.includes(keyModel) || keyModel.includes(mNorm)) {
      return entry;
    }
  }

  return null;
}

/**
 * Find firmware matches for a list of equipment items.
 * Returns a map of equipmentId → FirmwareEntry.
 */
export function findFirmwareForEquipment(
  items: Array<{ id: string; brand?: string; model?: string }>
): Record<string, FirmwareEntry> {
  const result: Record<string, FirmwareEntry> = {};
  for (const item of items) {
    const match = lookupFirmware(item.brand, item.model);
    if (match) {
      result[item.id] = match;
    }
  }
  return result;
}

/**
 * Find equipment items that have brand+model but NO firmware match.
 * Useful for prompting users to add missing firmware info.
 */
export function findUnmatchedEquipment(
  items: Array<{ id: string; brand?: string; model?: string }>
): Array<{ id: string; brand: string; model: string }> {
  return items
    .filter(it => it.brand?.trim() && it.model?.trim() && !lookupFirmware(it.brand, it.model))
    .map(it => ({ id: it.id, brand: it.brand!.trim(), model: it.model!.trim() }));
}

// ────────────────────────────────────────────────────────────────
// CRUD for custom firmware entries (local-only fallbacks)
// ────────────────────────────────────────────────────────────────

/**
 * Add a new custom firmware entry (local only, used as fallback).
 * Prefer addCommunityFirmwareEntry() for shared catalog.
 */
function addCustomFirmwareEntryLocal(entry: FirmwareEntry): void {
  const key = `${normalize(entry.brand)}::${normalize(entry.model)}`;
  _customEntries = _customEntries.filter(
    e => `${normalize(e.brand)}::${normalize(e.model)}` !== key
  );
  _customEntries.push(entry);
  saveCustomEntries(_customEntries);
  invalidateIndex();
}

/**
 * @deprecated Use addCommunityFirmwareEntry() instead for shared catalog.
 */
export function addCustomFirmwareEntry(entry: FirmwareEntry): void {
  addCustomFirmwareEntryLocal(entry);
}

/**
 * Remove a custom firmware entry locally (fallback).
 * Prefer removeCommunityFirmwareEntry() for shared catalog.
 */
function removeCustomFirmwareEntryLocal(brand: string, model: string): boolean {
  const key = `${normalize(brand)}::${normalize(model)}`;
  const before = _customEntries.length;
  _customEntries = _customEntries.filter(
    e => `${normalize(e.brand)}::${normalize(e.model)}` !== key
  );
  if (_customEntries.length !== before) {
    saveCustomEntries(_customEntries);
    invalidateIndex();
    return true;
  }
  return false;
}

/**
 * @deprecated Use removeCommunityFirmwareEntry() instead for shared catalog.
 */
export function removeCustomFirmwareEntry(brand: string, model: string): boolean {
  return removeCustomFirmwareEntryLocal(brand, model);
}

/** Get only user-added custom entries */
export function getCustomFirmwareEntries(): FirmwareEntry[] {
  return [..._customEntries];
}

/** Check if a given brand+model has a custom (user-added) entry */
export function isCustomEntry(brand: string, model: string): boolean {
  const key = `${normalize(brand)}::${normalize(model)}`;
  return _customEntries.some(e => `${normalize(e.brand)}::${normalize(e.model)}` === key);
}

/** Get ALL firmware entries (built-in + custom) */
export function getAllFirmwareEntries(): FirmwareEntry[] {
  return [...FIRMWARE_DATABASE, ..._customEntries];
}

/** Count of entries in the database (built-in + custom) */
export function getFirmwareDatabaseSize(): number {
  return FIRMWARE_DATABASE.length + _customEntries.length;
}

/** Count of built-in entries only */
export function getBuiltInFirmwareCount(): number {
  return FIRMWARE_DATABASE.length;
}

/** Count of custom entries only */
export function getCustomFirmwareCount(): number {
  return _customEntries.length;
}

// ────────────────────────────────────────────────────────────────
// V2 API helpers – firmware check, search, mapping
// ────────────────────────────────────────────────────────────────

/** Brands whose websites block automated scraping */
const SCRAPE_BLOCKED_BRANDS = new Set([
  'canon', 'sony', 'nikon', 'panasonic', 'blackmagic design',
  'red', 'dji', 'sigma', 'tamron', 'sound devices',
  'aputure', 'teradek', 'smallhd', 'zoom',
]);

/** Whether a brand blocks automated firmware scraping */
export function isScrapeBlocked(brand: string): boolean {
  return SCRAPE_BLOCKED_BRANDS.has(brand.trim().toLowerCase());
}

/**
 * Check firmware status for a single equipment item via v2 API.
 * Falls back to local KB lookup if the API is unavailable.
 */
export async function checkFirmwareV2(
  equipmentId: string,
  brand: string,
  model: string,
  currentVersion?: string
): Promise<FirmwareCheckStatus> {
  try {
    const res = await fetch('/api/firmware/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipmentId, brand, model, currentVersion }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data as FirmwareCheckStatus;
  } catch {
    // Fallback to local KB
    const entry = lookupFirmware(brand, model);
    if (!entry) {
      return { equipmentId, status: 'unknown', message: 'No firmware info available' };
    }
    if (!currentVersion) {
      return {
        equipmentId,
        status: 'unknown',
        latestVersion: entry.latestVersion,
        downloadUrl: entry.downloadUrl,
        message: 'Current firmware version not set',
      };
    }
    const isUpToDate = normalize(currentVersion) === normalize(entry.latestVersion)
      || currentVersion >= entry.latestVersion;
    return {
      equipmentId,
      status: isUpToDate ? 'up-to-date' : 'update-available',
      currentVersion,
      latestVersion: entry.latestVersion,
      downloadUrl: entry.downloadUrl,
      severity: entry.importance,
    };
  }
}

/**
 * Batch-check firmware status for multiple equipment items via v2 API.
 * Falls back to individual local checks if the API is unavailable.
 */
export async function checkFirmwareBatchV2(
  items: Array<{
    equipmentId: string;
    brand: string;
    model: string;
    currentVersion?: string;
  }>
): Promise<Record<string, FirmwareCheckStatus>> {
  try {
    const res = await fetch('/api/firmware/v2/check-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const results: FirmwareCheckStatus[] = await res.json();
    const map: Record<string, FirmwareCheckStatus> = {};
    for (const r of results) {
      if (r.equipmentId) map[r.equipmentId] = r;
    }
    return map;
  } catch {
    // Fallback to individual local checks
    const map: Record<string, FirmwareCheckStatus> = {};
    for (const item of items) {
      map[item.equipmentId] = await checkFirmwareV2(
        item.equipmentId, item.brand, item.model, item.currentVersion
      );
    }
    return map;
  }
}

/**
 * Search the firmware catalog for models matching a query.
 * Used by the "needs-mapping" UI to suggest catalog models.
 */
export async function searchCatalogModels(
  query: string
): Promise<Array<{ manufacturer: string; model: string; version: string }>> {
  try {
    const res = await fetch(`/api/firmware/v2/catalog/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data)
      ? data.map((e: CatalogApiEntry) => ({
          manufacturer: e.manufacturer || e.brand || '',
          model: e.model,
          version: e.version || e.latestVersion || '',
        }))
      : [];
  } catch {
    // Fallback: search local entries
    const q = normalize(query);
    return getAllFirmwareEntries()
      .filter(e => normalize(e.brand).includes(q) || normalize(e.model).includes(q))
      .slice(0, 20)
      .map(e => ({ manufacturer: e.brand, model: e.model, version: e.latestVersion }));
  }
}

/**
 * Map an equipment item to a specific catalog model (needs-mapping resolution).
 */
export async function mapEquipmentToModel(
  equipmentId: string,
  catalogManufacturer: string,
  catalogModel: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/firmware/v2/map-equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipmentId, catalogManufacturer, catalogModel }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get a firmware track key preview for a brand + model.
 * Useful for debugging matching.
 */
export async function getTrackKeyPreview(
  brand: string, model: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/firmware/v2/track-key?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.trackKey || null;
  } catch {
    return null;
  }
}
