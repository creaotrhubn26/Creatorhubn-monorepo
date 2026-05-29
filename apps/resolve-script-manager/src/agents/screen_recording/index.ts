/**
 * Screen Recording Agent — domene-konfig for screen-capture-leveranser
 * (tutorials, walkthroughs, product-demos, dev-screencasts, bug-rapporter).
 *
 * Hull i markedet: ingen kombinerer screen-capture + voice + AI-direktør
 * som forstår klikk-emphasis, cursor-following crop, click-zoom (Screen
 * Studio-stil) og auto-chapter fra transkript. Descript er nærmest med
 * transcript-redigering, Tella/Loom har basis-features. Vi dekker dette
 * med en egen Director-persona som vet hva en god screencast krever.
 *
 * Forskjell fra andre agenter:
 *   - Chapters: setup/intro → problem-demo → walkthrough → key-feature
 *     → recap → cta. Lineær tutorial-flyt, ikke narrative arc.
 *   - Signal-vekter: voice_clarity, click_emphasis, cursor_visibility,
 *     screen_density, narration_pacing
 *   - Look-packs: minimalistisk (Clean Recording, Tutorial Polished,
 *     Behind-the-scenes Raw, Promo Polished). Lite stylized color —
 *     content er konge.
 *   - Screen Recording Director-persona: kjenner Loom/Tella/Tella-
 *     konvensjoner, anbefaler click-zoom, auto-trim av "ums", chapter-
 *     detection fra voice-content.
 *   - Default 5-15 min varighet, 16:9 aspect (screen-native)
 */

import type { AgentConfig } from "../types";

const SCREEN_REC_CHAPTERS = [
  {
    id: "setup_intro",
    label: "Setup / Intro",
    pacingPct: 8,
    description: "Hva vi skal lære, hvem dette er for, hva resultatet blir. Vis sluttresultatet kort først hvis mulig (pattern fra moderne tutorials: 'her er hva du får til etter denne videoen'). Max 15-20s.",
    priorityHint: "high-energy" as const,
  },
  {
    id: "problem_demo",
    label: "Problem-demo",
    pacingPct: 14,
    description: "Vis problemet i kontekst. Demo den friksjonen folk møter. Konkret, ikke abstrakt. Bygger 'aha, det er sånn for meg også'-følelse.",
    priorityHint: "informational" as const,
  },
  {
    id: "walkthrough",
    label: "Walkthrough",
    pacingPct: 38,
    description: "Hovedkjernen — steg for steg. Klikk-zoom på hver kritiske handling. Auto-trim 'ums' og lange pauser. Hver UI-action bør ha verbal narration som forklarer HVORFOR (ikke bare HVA).",
    priorityHint: "informational" as const,
  },
  {
    id: "key_feature",
    label: "Hoved-feature / aha-moment",
    pacingPct: 16,
    description: "Det viktigste øyeblikket — hvor magien skjer. Pakk det inn med tekst-overlay, slowmo eller pause-effekt så seeren skjønner: 'dette er poenget'.",
    priorityHint: "emotional-peak" as const,
  },
  {
    id: "tips_gotchas",
    label: "Tips / gotchas",
    pacingPct: 10,
    description: "Edge-cases, common pitfalls, pro-tips. Korte segment-er på 5-15s hver. Kan presenteres med tekst-overlay som 'PRO TIP' eller liste-format.",
    priorityHint: "informational" as const,
  },
  {
    id: "recap",
    label: "Recap",
    pacingPct: 6,
    description: "Oppsummer det vi lærte i 3-4 punkter med tekst-overlay. Sluttbruker husker bedre når de hører + ser oppsummeringen.",
    priorityHint: "atmospheric" as const,
  },
  {
    id: "cta",
    label: "Call-to-action",
    pacingPct: 8,
    description: "Konkret neste-steg: prøv selv, abonner, sjekk docs, kontakt oss. Skjerm-tekst + verbal CTA. Slutt med brand-bumper.",
    priorityHint: "high-energy" as const,
  },
];

const SCREEN_REC_SIGNAL_WEIGHTS = {
  voice_clarity: 0.95,        // Klar tale uten "ums" eller mumling
  click_emphasis: 0.85,       // Klikk på riktig sted, synlig cursor
  cursor_visibility: 0.80,    // Cursor er synlig + følger handling
  narration_pacing: 0.75,     // Tale matcher handling
  screen_density: 0.60,       // Ikke for mye på skjermen samtidig
  zoom_when_relevant: 0.70,   // Zoom inn på UI-element når relevant
  silence_tolerance: 0.50,    // Korte pauser OK, ikke lange
  // Wedding/music-signaler nullstilles
  rhythm_sync: 0.0,
  romantikk: 0.0,
  performance_energy: 0.0,
};

const SCREEN_REC_LOOK_PACKS = [
  {
    id: "clean-recording",
    label: "Clean Recording",
    description: "Nøytral, ingen styling. Pure screen-capture — innholdet er konge. Default for tutorials og dev-screencasts.",
    tags: ["tutorial", "default", "minimal", "pure"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "natural" as const,
      temperature: "neutral" as const,
      blackPoint: "natural" as const,
      grain: "none" as const,
    },
  },
  {
    id: "tutorial-polished",
    label: "Tutorial Polished",
    description: "Subtil drop-shadow på vinduer, rounded corners på screen-area, gradient-bakgrunn. Premium tutorial-følelse (Screen Studio-stil).",
    tags: ["tutorial", "polished", "premium", "screen-studio"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "natural" as const,
      temperature: "cool" as const,
      blackPoint: "natural" as const,
      grain: "none" as const,
      specials: ["rounded-screen", "soft-shadow", "gradient-bg"],
    },
  },
  {
    id: "behind-the-scenes-raw",
    label: "Behind-the-scenes Raw",
    description: "Ingen polering, rå opptak-stil. For Loom-typer 'her er hva jeg jobber med'-meldinger. Webcam-overlay velkommen.",
    tags: ["loom", "raw", "casual", "internal", "webcam"],
    colorDirection: {
      contrast: "low" as const,
      saturation: "natural" as const,
      temperature: "neutral" as const,
      blackPoint: "natural" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "promo-polished",
    label: "Promo Polished",
    description: "Markedsfør-content som viser produkt. Animerte overlays, motion-graphic-elementer, premium look. For sosial-promo eller landing-page-video.",
    tags: ["promo", "marketing", "product", "polished", "social"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "vibrant" as const,
      temperature: "neutral" as const,
      blackPoint: "crushed" as const,
      grain: "none" as const,
      specials: ["motion-graphics", "title-cards"],
    },
  },
  {
    id: "code-focused",
    label: "Code-focused",
    description: "Dark theme, monospace-friendly kontrast, syntax-highlighting-bevarende. For dev-screencasts hvor IDE/editor er hovedfokus.",
    tags: ["dev", "code", "ide", "terminal", "dark"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "natural" as const,
      temperature: "neutral" as const,
      blackPoint: "crushed" as const,
      grain: "none" as const,
    },
  },
  {
    id: "bug-report",
    label: "Bug Report",
    description: "Strippet ned, ingen styling — bare problem dokumentert. Annotation-overlays (røde piler, sirkler) for å peke på issues.",
    tags: ["bug", "issue", "report", "diagnostic", "annotation"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "natural" as const,
      temperature: "neutral" as const,
      blackPoint: "natural" as const,
      grain: "none" as const,
      specials: ["red-annotations"],
    },
  },
];

const SCREEN_RECORDING_AGENT_PERSONA = {
  name: "Screen Recording Director",
  tagline: "Click-zoom, silence-trim, voice-aware editing",
  systemPrompt: `Du er Screen Recording Director, en AI Creative Director spesialisert på screen-recording-redigering (tutorials, product-demos, walkthroughs, dev-screencasts, bug-rapporter). Du kjenner Loom, Tella, Screen Studio og Descript-konvensjoner, og du forstår hva som skiller en kjedelig screencast fra en som faktisk lærer.

Du forstår at:
- VOICE er primær. Hvis voice-narration er svak (mumling, "ums", lange pauser), faller alt. Anbefal alltid auto-trim av >0.6s silenser og fil-words ("um", "uh", "like", "you know").
- CLICK-ZOOM er kraftig. Når et klikk skjer på et lite UI-element, zoom inn 1.2-1.5x rundt cursor-en under klikket. Screen Studio-stilen. Holder seerens fokus.
- CURSOR må være SYNLIG. Anbefal cursor-highlighting (gult sirkel rundt cursor) hvis videoen er for tutorials.
- NARRATION-PACING må matche handling. Hvis stemmen forklarer X mens cursor klikker Y, blir det forvirrende. Cuts på narration-grenser (setningsslutt), ikke midt i.
- CHAPTER-DETECTION fra voice: "først skal vi …", "neste steg …", "OK, nå skal vi …" er chapter-grenser. Bruk transkript til å auto-foreslå kapittelmarkører.
- TEKST-OVERLAYS hjelper hukommelse. Recap-kapittelet bør ha bullet-list-overlay. Pro-tips bør ha "PRO TIP"-badge.
- LENGDE skal være ærlig — ikke strekk innholdet. En 3-min tutorial er bedre enn en 10-min med samme info.

Du gir korte, konkrete forslag (1-3 setninger) om voice-trim, click-zoom-plassering, narration-pacing, chapter-grenser, og overlay-bruk. Skriv på norsk. Du er kreativ partner til content-skaper og videograf, ikke chatbot.

Når du analyserer en sekvens, vurder alltid:
1. Er voice-narration klar? Hvor mange "ums" og pauser >0.6s?
2. Hvor faller klikk uten cursor-emphasis eller zoom?
3. Matcher narration handlingen (eller forklarer den noe annet)?
4. Er chapter-grensene tydelige i voice ("nå skal vi …")?
5. Hvor kan tekst-overlay forsterke huskbarheten?
6. Er videoen lengre enn den trenger å være?`,
};

export const SCREEN_RECORDING_AGENT_CONFIG: AgentConfig = {
  kind: "screen_recording",
  name: "Screen Recording Agent",
  tagline: "Voice-aware editor for tutorials, walkthroughs og dev-screencasts",
  deliveryType: "Screen Recording",
  defaultDurationSec: 300, // 5 min tutorial-default
  defaultAspect: "16:9",
  chapters: SCREEN_REC_CHAPTERS,
  signalWeights: SCREEN_REC_SIGNAL_WEIGHTS,
  lookPacks: SCREEN_REC_LOOK_PACKS,
  primaryAgent: SCREEN_RECORDING_AGENT_PERSONA,
  clientWishesExamples: [
    "fjern alle ums og pauser",
    "zoom på klikk-handlinger",
    "kortere — under 3 minutter",
    "tekst-overlay på pro-tips",
    "Screen Studio-stil polish",
    "cursor-highlight på tutorials",
  ],
  onboarding: {
    title: "Screen Recording Agent",
    subtitle: "Tutorials, walkthroughs og dev-screencasts med Director-AI",
    iconHint: "ScreenShare",
  },
};

export default SCREEN_RECORDING_AGENT_CONFIG;
