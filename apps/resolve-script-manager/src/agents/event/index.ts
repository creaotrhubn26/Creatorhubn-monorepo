/**
 * Event Agent — domene-konfig for konferanser, keynotes, paneler,
 * live-shows og workshops.
 *
 * Forskjell fra andre agenter:
 *   - Chapters følger event-tidslinje (arrival/opening/keynote/panel/
 *     networking/workshop/closing/highlights) — multi-fase struktur
 *     i motsetning til lineær funnel eller sang-form
 *   - Signal-vekter: speaker_clarity (vokal-presisjon), audience_
 *     engagement (latter, nikking, oppmerksomhet), sponsor_visibility,
 *     moment_capture (håndtrykk, applaus, premier), venue_context
 *   - Look-packs: broadcast/documentary/premium-conference/energetic-
 *     live/corporate-summit/workshop-friendly
 *   - Event Director-persona: kjenner keynote-first-priority, panel-
 *     diskusjon-cuts (på taler-skifte, ikke linje-for-linje), applaus-
 *     ekspansjon, sponsor-kontrakt-coverage, highlight-reel-pacing
 *   - Default 8 min (highlight-reel), 16:9 broadcast-aspect
 */

import type { AgentConfig } from "../types";

const EVENT_CHAPTERS = [
  {
    id: "arrival",
    label: "Arrival / pre-event",
    pacingPct: 6,
    description: "Setup-stemning, deltagere som strømmer inn, registreringsbord, lobby-buzz. Etablerer scale + atmosfære før innholdet starter. Bra for B-roll, sponsor-skilt, branding-overlays.",
    priorityHint: "atmospheric" as const,
  },
  {
    id: "opening",
    label: "Opening / welcome",
    pacingPct: 8,
    description: "Vert/MC introduserer event, takker sponsorer, setter tonen. Korte cuts for å holde energi — ikke la velkomsten føles lang. Sponsor-logoer skal ha synlighet her.",
    priorityHint: "high-energy" as const,
  },
  {
    id: "keynote",
    label: "Keynote(s)",
    pacingPct: 28,
    description: "Hovedinnholdet. Speaker-fokus prioriteres alltid — close-up + wide-shot rotasjon, slides når relevant. Audience-reaction-cuts brukes til å forsterke punkter (laughter, nikking, intens fokus).",
    priorityHint: "informational" as const,
  },
  {
    id: "panel",
    label: "Panel-diskusjon",
    pacingPct: 16,
    description: "Multi-speaker. Cut PÅ TALER-SKIFTE, ikke hver linje. Wide-shot mellom intens utveksling så seeren henger med på hvem som snakker. B-roll av modarator når noen tenker. Q&A inkluderes hvis publikum-spørsmål er klare.",
    priorityHint: "informational" as const,
  },
  {
    id: "networking",
    label: "Networking / breaks",
    pacingPct: 10,
    description: "Pause-stemning. Håndtrykk, kaffe, småprat, smil. Brukes som transitional-bro mellom kapittel-segmentene. Sponsor-skilt og branding skal vises naturlig her.",
    priorityHint: "transitional" as const,
  },
  {
    id: "workshop",
    label: "Workshops / breakouts",
    pacingPct: 10,
    description: "Parallelle sessioner. Korte montage-cuts av hver workshop med caption som identifiserer tema. Hands-on-shots (folk skriver, jobber sammen) > talking-head her.",
    priorityHint: "informational" as const,
  },
  {
    id: "closing",
    label: "Closing / outro",
    pacingPct: 10,
    description: "Avsluttende ord, takk-til, premier-utdeling, gruppe-foto. Emosjonell topp før utro. Standing-ovation alltid full lengde — aldri kuttet kort.",
    priorityHint: "emotional-peak" as const,
  },
  {
    id: "highlights",
    label: "Highlights montage",
    pacingPct: 12,
    description: "3-min recap av hele eventet til slutt. Bygges som music-driven montasje av sterkeste momenter. Sponsor-logo-roll på slutten. Brukes ofte alene som sosial-promo-versjon.",
    priorityHint: "high-energy" as const,
  },
];

const EVENT_SIGNAL_WEIGHTS = {
  speaker_clarity: 0.92,        // Klar tale, ingen mumling, fanget på lyd
  audience_engagement: 0.78,    // Latter, nikking, oppmerksomhet
  sponsor_visibility: 0.70,     // Logoer, skilt, branding (kontrakt-krav)
  presentation_quality: 0.72,   // Slides lesbare, scenografi i orden
  moment_capture: 0.85,         // Håndtrykk, applaus, premier, big reveals
  emotional_peak: 0.80,         // Standing ovation, awards, dedications
  venue_context: 0.55,          // Sense of scale + place
  speaker_close_up_balance: 0.65, // Riktig miks av close-up + wide
  // Wedding/music/screen-recording-signaler nullstilt
  rhythm_sync: 0.0,
  romantikk: 0.0,
  click_emphasis: 0.0,
};

const EVENT_LOOK_PACKS = [
  {
    id: "clean-broadcast",
    label: "Clean Broadcast",
    description: "TV-conference-stil, broadcast-standard. Nøytral, kontrollert kontrast, professional. Default for de fleste corporate events.",
    tags: ["broadcast", "conference", "tv", "neutral", "default"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "natural" as const,
      temperature: "neutral" as const,
      blackPoint: "natural" as const,
      grain: "none" as const,
    },
  },
  {
    id: "documentary-storytelling",
    label: "Documentary Storytelling",
    description: "Narrativ-drevet, dokumentar-følelse. Lett desaturert, filmic. Egnet for mission-driven konferanser og foundation-events.",
    tags: ["documentary", "narrative", "mission", "filmic"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "muted" as const,
      temperature: "neutral" as const,
      blackPoint: "lifted" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "premium-conference",
    label: "Premium Conference",
    description: "Luksuriøs følelse, varme high-lights, magasin-tone. For high-end summits, ledelse-events, gala-dinners.",
    tags: ["premium", "luxury", "summit", "gala", "executive"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "muted" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "energetic-live",
    label: "Energetic Live",
    description: "Høy energi, mettede farger, dynamisk. For festivaler, store live-shows, awards og high-energy product-launches.",
    tags: ["festival", "live", "launch", "awards", "high-energy"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "vibrant" as const,
      temperature: "neutral" as const,
      blackPoint: "crushed" as const,
      grain: "none" as const,
    },
  },
  {
    id: "corporate-summit",
    label: "Corporate Summit",
    description: "Formell B2B, executive-tone, kjølig palett. Trygg, kontrollert, troverdig. For shareholder-meetings og industri-summits.",
    tags: ["corporate", "executive", "formal", "cool", "trusted"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "muted" as const,
      temperature: "cool" as const,
      blackPoint: "natural" as const,
      grain: "none" as const,
    },
  },
  {
    id: "workshop-friendly",
    label: "Workshop Friendly",
    description: "Varm, tilgjengelig, naturlig. For workshops, læring-sessioner, hackathons. Folk skal føle 'jeg vil bli med på dette'.",
    tags: ["workshop", "learning", "approachable", "warm", "casual"],
    colorDirection: {
      contrast: "low" as const,
      saturation: "natural" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "subtle" as const,
    },
  },
];

const EVENT_AGENT_PERSONA = {
  name: "Event Director",
  tagline: "Keynote-fokus, panel-cuts på taler-skifte, applaus aldri kuttet",
  systemPrompt: `Du er Event Director, en AI Creative Director spesialisert på event-redigering (konferanser, keynotes, paneler, live-shows, workshops, premier-events). Du kjenner broadcast-konvensjoner og hvordan man strukturerer en flertimers event-dag til en sterk highlight-reel.

Du forstår at:
- KEYNOTE er hellig. Speaker-close-up + wide-shot rotasjon, slides når relevant. Aldri kuttet midt i en pointe — finn naturlig setningsslutt.
- PANEL-CUTS skal være PÅ TALER-SKIFTE, ikke per linje. Hvis person A snakker i 30 sek, hold på A. Når B svarer, cut til B. Wide-shot mellom intense utvekslinger så seer henger med på hvem som snakker.
- AUDIENCE-REACTION er kraftig forsterker. Latter, nikking, intens fokus, smil — cut til disse for å bygge "dette var bra"-følelsen. Men ikke overdriv.
- APPLAUS aldri kuttet kort. Standing ovation full lengde. Selv vanlig klapping bør gå minst 3 sek så det føles ærlig.
- SPONSOR-COVERAGE er kontrakt-arbeid. Logoer, skilt, banneren bak speaker — du må sikre at synlighet matcher sponsor-tier. Hvis en gold-tier sponsor ikke vises, har vi et problem.
- HIGHLIGHTS-MONTAGE bygges som music-driven recap. Sterke openers, emosjonell topp midtveis, premier/awards mot slutten, sponsor-roll til sist.
- LENGDE: 3-min sosial-versjon, 8-min standard-recap, 20-min full-replay. Hver av disse trenger sin egen pacing.
- VENUE-shots gir sense of scale. Wide etablerings-shots i begynnelsen, drone-shots hvis tilgjengelig, gjør at seeren føler "dette var et stort event".

Du gir korte, konkrete forslag (1-3 setninger) om speaker-cuts, audience-reaction-plassering, applaus-timing, sponsor-coverage, og highlight-reel-pacing. Skriv på norsk. Du er kreativ partner til event-organisator og videograf, ikke chatbot.

Når du analyserer en sekvens, vurder alltid:
1. Er keynote-cuts på naturlig setningsslutt eller midt i en pointe?
2. Cuts panel-cuts på taler-skifte, eller bråkete linje-for-linje?
3. Får audience-reactions plass — og brukes de strategisk?
4. Er applaus respektert (full lengde, aldri brå-kuttet)?
5. Matcher sponsor-coverage avtalen (hvilke tier vises hvor)?
6. Har highlights-montage tydelig narrativ bue (åpne → bygge → topp → resolve)?`,
};

export const EVENT_AGENT_CONFIG: AgentConfig = {
  kind: "event",
  name: "Event Agent",
  tagline: "Konferanse, keynote, panel og highlight-reel-leveranser",
  deliveryType: "Event Highlight",
  defaultDurationSec: 480, // 8 min standard recap
  defaultAspect: "16:9",
  chapters: EVENT_CHAPTERS,
  signalWeights: EVENT_SIGNAL_WEIGHTS,
  lookPacks: EVENT_LOOK_PACKS,
  primaryAgent: EVENT_AGENT_PERSONA,
  clientWishesExamples: [
    "lengre highlights-segment",
    "mer sponsor-coverage på gold-tier",
    "kortere panel-diskusjon",
    "behold hele applausen etter keynote",
    "audience-reaction etter Q&A",
    "3-min sosial-versjon",
  ],
  onboarding: {
    title: "Event Agent",
    subtitle: "Konferanse, keynote, panel og live-show med Event Director-AI",
    iconHint: "Event",
  },
};

export default EVENT_AGENT_CONFIG;
