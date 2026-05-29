/**
 * Music Video Agent — domene-konfig for musikkvideo-leveranser.
 *
 * Kjernen i forskjell fra Wedding Agent:
 *   - Chapter-taxonomi følger sang-struktur (intro/verse/chorus/bridge/outro)
 *     i stedet for vielse-seremoni-flow
 *   - Signal-vekter prioriterer rhythm-sync, performance-energi, atmosfære
 *   - Look-packs er stylized for genre (cinematic film, neon night, gritty
 *     doc, stadium broadcast, lo-fi VHS, minimal modern, sun-bleached, club)
 *   - Claude-persona er Music Video Director som kjenner MTV-cuts,
 *     beat-sync, hook-emphasis, lip-sync-awareness, genre-aestetikk
 *   - Default-varighet 3:30 (typisk single-lengde) i stedet for 4-5 min
 *     wedding-highlight
 *   - Aspect default 9:16 for hyper-pop/TikTok-først, men 16:9 for
 *     concert-broadcast
 */

import type { AgentConfig } from "../types";

const MUSIC_VIDEO_CHAPTERS = [
  {
    id: "intro",
    label: "Intro",
    pacingPct: 8,
    description: "Establishing shot, mood-setting, atmosfære før første vokal-linje. Kan være atmospheric eller energetic avhengig av genre.",
    priorityHint: "atmospheric" as const,
  },
  {
    id: "verse_1",
    label: "Verse 1",
    pacingPct: 16,
    description: "Først vers — etablerer artist-tilstedeværelse og narrativ. Klipping bør være middels tempo, kamera-fokus på artist + B-roll.",
    priorityHint: "informational" as const,
  },
  {
    id: "pre_chorus",
    label: "Pre-chorus",
    pacingPct: 6,
    description: "Bygger spenning før chorus. Klipping akselerer, kamera-bevegelse intensiveres, vinkel-variasjon øker.",
    priorityHint: "transitional" as const,
  },
  {
    id: "chorus",
    label: "Chorus / Hook",
    pacingPct: 22,
    description: "Hovedhook-en. Maks energi, mest cuts pr bar, mest dynamiske kamera-bevegelser. Lip-sync er kritisk — Bjarne MÅ ha vokal-fokus på hver chorus-linje.",
    priorityHint: "high-energy" as const,
  },
  {
    id: "verse_2",
    label: "Verse 2",
    pacingPct: 14,
    description: "Andre vers — variasjon fra Verse 1. Ny lokasjon, ny outfit eller ny kamera-style for å holde interesse.",
    priorityHint: "informational" as const,
  },
  {
    id: "bridge",
    label: "Bridge / Breakdown",
    pacingPct: 10,
    description: "Atmosfærisk break, ofte stilskifte. Slower cuts, mer komposisjon, kunstnerisk frihet. Kan brukes til narrative beats.",
    priorityHint: "atmospheric" as const,
  },
  {
    id: "drop",
    label: "Drop",
    pacingPct: 8,
    description: "Hvis sangen har en drop (EDM/hyperpop): maksimal kinetisk energi, hurtigste cuts, visual effects velkomne. Synkroniser med kick.",
    priorityHint: "high-energy" as const,
  },
  {
    id: "outro",
    label: "Outro",
    pacingPct: 8,
    description: "Resolution. Slower pace, returner til mood-establishing, eventuell tekst-overlay med credits. Bør føles 'complete'.",
    priorityHint: "emotional-peak" as const,
  },
];

const MUSIC_VIDEO_SIGNAL_WEIGHTS = {
  // Rhythm-sync: hvor godt cuts ligger på beat
  rhythm_sync: 0.95,
  // Performance-energy: hvor "på" artisten er — vokal-intensitet, kroppspråk
  performance_energy: 0.85,
  // Visual-atmosphere: hvor stemningsfull/iøynefallende komposisjonen er
  visual_atmosphere: 0.70,
  // Movement: kamera + subject-movement (statisk vs dynamisk)
  movement: 0.60,
  // Clarity/focus: er fokus på riktig sted (artist vs background)
  focus_clarity: 0.55,
  // Lip-sync: vokal-linje matcher leppe-bevegelse (kritisk for performance-shots)
  lip_sync: 0.80,
  // Artist-charisma: face-time med artist + uttrykksfullhet
  artist_charisma: 0.65,
  // Wedding-signaler nullstilles (de gir ikke mening i music video)
  wedding_events: 0.0,
  romantikk: 0.0,
  familie: 0.0,
};

const MUSIC_VIDEO_LOOK_PACKS = [
  {
    id: "cinematic-film",
    label: "Cinematic Film",
    description: "Høy kontrast, dyp skygge, anamorf-følelse. Egnet for storyline-narrativ.",
    tags: ["cinematic", "narrative", "high-contrast", "anamorphic"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "muted" as const,
      temperature: "cool" as const,
      blackPoint: "crushed" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "neon-night",
    label: "Neon Night",
    description: "Saturert magenta/cyan, klubb-estetikk. For hyperpop/trap/EDM.",
    tags: ["club", "hyperpop", "edm", "neon", "saturated"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "vibrant" as const,
      temperature: "cool" as const,
      blackPoint: "crushed" as const,
      grain: "none" as const,
      specials: ["chromatic-aberration", "glow"],
    },
  },
  {
    id: "gritty-documentary",
    label: "Gritty Documentary",
    description: "Desaturert, film-grain, rå. For hip-hop/punk/raw indie.",
    tags: ["hip-hop", "punk", "indie", "raw", "documentary"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "muted" as const,
      temperature: "neutral" as const,
      blackPoint: "lifted" as const,
      grain: "noticeable" as const,
      specials: ["halation"],
    },
  },
  {
    id: "stadium-performance",
    label: "Stadium Performance",
    description: "Broadcast-clean, vibrant, kontrollerte highlights. For konsert/live-show.",
    tags: ["concert", "live", "broadcast", "performance"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "vibrant" as const,
      temperature: "neutral" as const,
      blackPoint: "natural" as const,
      grain: "none" as const,
    },
  },
  {
    id: "lo-fi-vhs",
    label: "Lo-fi VHS",
    description: "Analog støy, color-bleeding, retro. For nostalgi/dream-pop/lo-fi.",
    tags: ["lo-fi", "retro", "vhs", "dream-pop", "nostalgic"],
    colorDirection: {
      contrast: "low" as const,
      saturation: "muted" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "noticeable" as const,
      specials: ["chromatic-aberration", "scan-lines"],
    },
  },
  {
    id: "minimal-modern",
    label: "Minimal Modern",
    description: "Flat, dempet, kontrollert palett. For art-pop/alternative/indie.",
    tags: ["alternative", "indie", "art-pop", "minimal"],
    colorDirection: {
      contrast: "low" as const,
      saturation: "muted" as const,
      temperature: "neutral" as const,
      blackPoint: "natural" as const,
      grain: "none" as const,
    },
  },
  {
    id: "sun-bleached",
    label: "Sun-bleached",
    description: "Varm, løftet skygge, sommer-følelse. For folk/country/indie-rock outdoor.",
    tags: ["summer", "outdoor", "folk", "warm", "nostalgic"],
    colorDirection: {
      contrast: "low" as const,
      saturation: "natural" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "underground-club",
    label: "Underground Club",
    description: "Høy saturasjon, røyk, low-key. For techno/house/dance.",
    tags: ["techno", "house", "club", "dance", "low-key"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "vibrant" as const,
      temperature: "cool" as const,
      blackPoint: "crushed" as const,
      grain: "subtle" as const,
    },
  },
];

const MUSIC_VIDEO_AGENT_PERSONA = {
  name: "Music Video Director",
  tagline: "Beat-sync, hook-emphasis, genre-aware editing",
  systemPrompt: `Du er Music Video Director, en AI Creative Director spesialisert på musikkvideo-redigering. Du kjenner moderne music-video-konvensjoner: MTV-cuts, hook-emphasis, beat-synkroniserte transitions, lip-sync-presisjon, performance-energi-mapping, og genre-aestetikk.

Du forstår at:
- En musikkvideo er BEAT-FIRST: hver cut bør falle på et meningsfullt rytmisk øyeblikk (downbeat, snare-hit, vokal-attack).
- CHORUS er hellig: maks energi, mest cuts pr bar, mest dynamiske kamera-bevegelser. Lip-sync MÅ være presis.
- Verse-strukturen tillater variasjon: bytt lokasjon, outfit eller kamera-style mellom Verse 1 og Verse 2.
- Genre bestemmer estetikk: hip-hop = gritty documentary, hyperpop = neon night, indie = sun-bleached, EDM = underground club, art-pop = minimal modern.
- Bridge/breakdown er det narrative pusterommet — slow pace, kunstnerisk komposisjon.

Du gir korte, konkrete forslag (1-3 setninger) om beat-sync, hook-emphasis, performance-energi, og narrativ struktur per chapter. Skriv på norsk. Du er kreativ partner til artisten og videograf, ikke chatbot.

Når du analyserer en sekvens, vurder alltid:
1. Faller cuts på beat? Hvor mange "wasted cuts" som ligger mellom beats?
2. Har chorus nok energi og cut-density?
3. Har Verse 1 og Verse 2 nok visuell variasjon?
4. Er lip-sync presis i performance-shots?
5. Matcher look-pack-en genre?`,
};

export const MUSIC_VIDEO_AGENT_CONFIG: AgentConfig = {
  kind: "music_video",
  name: "Music Video Agent",
  tagline: "Beat-synkronisert redigering for artister og labels",
  deliveryType: "Music Video",
  defaultDurationSec: 210, // 3:30 typisk single-lengde
  defaultAspect: "16:9",
  chapters: MUSIC_VIDEO_CHAPTERS,
  signalWeights: MUSIC_VIDEO_SIGNAL_WEIGHTS,
  lookPacks: MUSIC_VIDEO_LOOK_PACKS,
  primaryAgent: MUSIC_VIDEO_AGENT_PERSONA,
  clientWishesExamples: [
    "mer energi i chorus",
    "lengre intro",
    "fokus på artistens leveringskraft",
    "klipp på hver snare",
    "bytt lokasjon mellom versene",
    "dempere look — mer cinematic",
  ],
  onboarding: {
    title: "Music Video Agent",
    subtitle: "Beat-synkronisert, genre-bevisst redigering for artister",
    iconHint: "MusicNote",
  },
};

export default MUSIC_VIDEO_AGENT_CONFIG;
