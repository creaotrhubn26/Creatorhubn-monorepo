/**
 * Podcast Agent — domene-konfig for podkast-redigering: multi-host
 * samtaler, intervjuer, repurpose-til-video, og social-cutdowns for
 * IG/TikTok/YouTube Shorts.
 *
 * Forskjell fra andre agenter:
 *   - Chapters følger podkast-struktur (cold-open hook → intro → guest-
 *     bio → conversation-blocks → standout-moment → outro → social-
 *     clips), ikke narrative arc eller event-timeline
 *   - Signal-vekter: speaker_clarity (kritisk for talk-format),
 *     conversation_flow (cuts på taler-skifte uten å bryte momentum),
 *     laughter_moments, standout_quotes, audio_quality, silence_
 *     management (korte pauser OK, lange = trim)
 *   - Look-packs: Talking Head (klassisk podcast-video), Waveform
 *     Only (audio-først med bevegende waveform), Highlight Clip
 *     (sosial repurpose), Studio Polished (premium podcast)
 *   - Podcast Director-persona: kjenner Joe-Rogan/Lex-Fridman/SmartLess-
 *     stilen, multi-host-cuts, latter-emphasis, hook-extracts
 *   - Default 45 min full-episode + 30s/60s sosial-cutdowns, 16:9
 *     for video-podcast eller 1:1 for sosial-cut
 */

import type { AgentConfig } from "../types";

const PODCAST_CHAPTERS = [
  {
    id: "cold_open",
    label: "Cold open / hook-quote",
    pacingPct: 3,
    description: "10-30s av det sterkeste quote fra episoden — før intro starter. Pakker seer inn: 'jeg må høre resten av denne samtalen'. Klippes ofte fra midt-episode.",
    priorityHint: "high-energy" as const,
  },
  {
    id: "intro",
    label: "Intro / vert-velkomst",
    pacingPct: 5,
    description: "Vert presenterer episode, eventuell sponsor-roll, kort tema-etablering. Hold under 60s — folk vil til samtalen.",
    priorityHint: "transitional" as const,
  },
  {
    id: "guest_bio",
    label: "Guest-bio",
    pacingPct: 6,
    description: "Hvem er gjesten, hvorfor de er her. Kan være visuell B-roll av gjest med voice-over fra vert, eller en kort gjest-presentasjon.",
    priorityHint: "informational" as const,
  },
  {
    id: "warmup",
    label: "Warmup / småprat",
    pacingPct: 8,
    description: "Lett innledende prat før hoved-tema. Etablerer kjemi mellom vert + gjest. Trim aggressive silenser, men la noe naturlig flow.",
    priorityHint: "atmospheric" as const,
  },
  {
    id: "main_conversation",
    label: "Hoved-samtale",
    pacingPct: 50,
    description: "Kjernen av episoden. Multi-host: cut PÅ TALER-SKIFTE, ikke per linje. Hold på taler i lengre takes. Wide-shot eller two-shot under intense utvekslinger. La latter få plass.",
    priorityHint: "informational" as const,
  },
  {
    id: "standout_moment",
    label: "Standout moment",
    pacingPct: 10,
    description: "Det sterkeste sitatet, mest emosjonelle øyeblikket, eller mest delbare innsikten. Identifiser dette — det blir hoved-sosial-cuten + cold-open-kandidaten.",
    priorityHint: "emotional-peak" as const,
  },
  {
    id: "rapid_fire_q",
    label: "Rapid-fire / sluttspørsmål",
    pacingPct: 5,
    description: "Korte avsluttende spørsmål (favoritt-bok, beste råd, hvem du vil ha på showen, etc.). Bra for personlighet og memorable closing.",
    priorityHint: "transitional" as const,
  },
  {
    id: "outro",
    label: "Outro / sponsor + CTA",
    pacingPct: 5,
    description: "Takk gjest, sponsor-roll, abonner-CTA, hvor folk kan finne gjest (sosial-håndtak), neste-episode-teaser hvis aktuelt.",
    priorityHint: "atmospheric" as const,
  },
  {
    id: "social_cuts",
    label: "Social cutdowns (30s/60s)",
    pacingPct: 8,
    description: "Kort-versjoner for IG Reels, TikTok, YouTube Shorts. Bygges fra standout-moment + cold-open. Captions burnt in (85% ser uten lyd på sosial).",
    priorityHint: "high-energy" as const,
  },
];

const PODCAST_SIGNAL_WEIGHTS = {
  speaker_clarity: 0.95,        // Vokal-kvalitet er podcast #1
  conversation_flow: 0.88,      // Cut-rytme matcher samtale-rytme
  audio_quality: 0.85,          // Room tone, mic-balanse, brus
  standout_quotes: 0.80,        // Identifisere clipable-momenter
  laughter_moments: 0.72,       // Latter får plass, ikke kutt
  silence_management: 0.68,     // Korte pauser OK, lange trimmes
  visual_engagement: 0.55,      // For video-podcasts (talking-head)
  chemistry: 0.62,              // Vert + gjest-dynamikk
  // Wedding/music/screen-rec/event-signaler nullstilt
  rhythm_sync: 0.0,
  romantikk: 0.0,
  click_emphasis: 0.0,
  audience_engagement: 0.0,
};

const PODCAST_LOOK_PACKS = [
  {
    id: "talking-head-classic",
    label: "Talking Head Classic",
    description: "Standard podcast-video-stil: vert og gjest i splitscreen eller alternerende close-ups. Studio-belysning forutsatt.",
    tags: ["talking-head", "studio", "video-podcast", "classic", "default"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "natural" as const,
      temperature: "neutral" as const,
      blackPoint: "natural" as const,
      grain: "none" as const,
    },
  },
  {
    id: "studio-polished",
    label: "Studio Polished",
    description: "Premium podcast (Joe Rogan, Lex Fridman-stil). Lett løftede high-lights, kontrollert kontrast, broadcast-klar.",
    tags: ["premium", "studio", "joe-rogan", "lex-fridman", "broadcast"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "muted" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "none" as const,
    },
  },
  {
    id: "waveform-audio-first",
    label: "Waveform Audio-First",
    description: "Audio-først med bevegende waveform-visualisering. For audio-only-podkast som vises på YouTube som video. Brand-overlay i hjørnet.",
    tags: ["audio-first", "waveform", "youtube", "minimal", "brand-overlay"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "natural" as const,
      temperature: "neutral" as const,
      blackPoint: "crushed" as const,
      grain: "none" as const,
      specials: ["waveform-overlay", "brand-card"],
    },
  },
  {
    id: "highlight-clip-social",
    label: "Highlight Clip Social",
    description: "For 30s/60s sosial-cuts. Vertical 9:16, dramatisk kontrast, captions burnt in, intro-bumper. Hook MÅ levere i 3 sek.",
    tags: ["social", "tiktok", "reels", "shorts", "vertical", "captions"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "vibrant" as const,
      temperature: "neutral" as const,
      blackPoint: "crushed" as const,
      grain: "none" as const,
      specials: ["burnt-captions", "speaker-name-overlay"],
    },
  },
  {
    id: "remote-zoom",
    label: "Remote / Zoom-style",
    description: "For remote-podcaster med grid-layout (Riverside, Squadcast). Komprimer typiske webcam-artifakter. Talker-spotlight på aktiv taler.",
    tags: ["remote", "zoom", "riverside", "squadcast", "grid"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "natural" as const,
      temperature: "cool" as const,
      blackPoint: "natural" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "indie-warm",
    label: "Indie Warm",
    description: "Hjemmelaget intimat følelse (Marc Maron, Conan O'Brien Needs A Friend-stil). Lett gritty, varme, ikke for polert.",
    tags: ["indie", "warm", "intimate", "marc-maron", "homegrown"],
    colorDirection: {
      contrast: "low" as const,
      saturation: "muted" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "subtle" as const,
    },
  },
];

const PODCAST_AGENT_PERSONA = {
  name: "Podcast Director",
  tagline: "Cut på taler-skifte, latter får plass, hook-quotes for sosial",
  systemPrompt: `Du er Podcast Director, en AI Creative Director spesialisert på podkast-redigering: multi-host samtaler, intervjuer, video-podkast-repurpose og social-cutdowns. Du kjenner Joe Rogan, Lex Fridman, SmartLess, Marc Maron, Conan O'Brien-stilen og hvordan moderne podcast lever på sosial-media gjennom clips.

Du forstår at:
- SPEAKER CLARITY er #1. Vokal-kvalitet trumfer alt. Dårlig audio dreper podkast på 30 sek. Foreslå alltid mic-balansering + room-tone-cleanup.
- MULTI-HOST CUTS på taler-skifte, ikke per linje. Hold på person A når A snakker. Når B avbryter eller svarer, cut til B. Aldri i midten av en setning.
- LATTER FÅR PLASS. Latter mellom vert + gjest er gull — kjemi-bevis. Aldri kuttet kort. La en god latter løpe 5-8 sek.
- STANDOUT QUOTES er sosial-gull. Identifiser de 3-5 mest delbare sitatene per episode. Disse blir 30s/60s-sosial-cuts + cold-open-kandidater.
- COLD OPEN-stil: ta sterkeste quote fra midt-episode, klipp 15-25 sek av den, sett før intro. Folk MÅ ville høre resten.
- LANGE PAUSER trimmes. Korte pauser OK (tenkning, latter-buildup). >2 sek av stillhet uten grunn = trim.
- 'UMS' OG FILL-WORDS trimmes aggressivt for sosial-cuts, mer mildt for full-episode (autentisitet).
- HOOK i 3 SEK på sosial. TikTok/Reels: hooken må levere innen 3 sek eller folk swiper. Bygg cutten rundt det.
- CAPTIONS BURNT IN på sosial. 85% ser uten lyd. Speaker-name-overlay første gang noen snakker.
- BRAND-CONSISTENCY: intro-bumper, outro-CTA, sponsor-roll-plassering må være konsekvent fra episode til episode.

Du gir korte, konkrete forslag (1-3 setninger) om taler-cuts, latter-respekt, standout-quote-identifikasjon, hook-extracts, og sosial-cutdown-strategi. Skriv på norsk. Du er kreativ partner til podcast-vert og produsent, ikke chatbot.

Når du analyserer en sekvens, vurder alltid:
1. Er taler-cuts på naturlig skifte, eller bråkete linje-for-linje?
2. Får latter plass — eller kuttes den kort?
3. Hvor er de 3 mest sosial-clipable sitatene?
4. Trimmes lange pauser, men beholdes kort pauser med grunn?
5. Leverer hook-quote-en innen 3 sek hvis dette er sosial-cut?
6. Er captions burnt in for sosial-versjon?
7. Matcher intro/outro/sponsor-plassering det forrige episoder?`,
};

export const PODCAST_AGENT_CONFIG: AgentConfig = {
  kind: "podcast",
  name: "Podcast Agent",
  tagline: "Multi-host samtaler, sosial-cutdowns og video-podkast-repurpose",
  deliveryType: "Podcast Episode",
  defaultDurationSec: 2700, // 45 min full episode
  defaultAspect: "16:9",
  chapters: PODCAST_CHAPTERS,
  signalWeights: PODCAST_SIGNAL_WEIGHTS,
  lookPacks: PODCAST_LOOK_PACKS,
  primaryAgent: PODCAST_AGENT_PERSONA,
  clientWishesExamples: [
    "kortere intro",
    "behold all latter",
    "gi meg 3 sosial-cuts på 30 sek",
    "fjern alle ums",
    "vertical 9:16 for TikTok",
    "premium studio-look",
  ],
  onboarding: {
    title: "Podcast Agent",
    subtitle: "Multi-host samtaler og social-cutdowns med Podcast Director-AI",
    iconHint: "Podcasts",
  },
};

export default PODCAST_AGENT_CONFIG;
