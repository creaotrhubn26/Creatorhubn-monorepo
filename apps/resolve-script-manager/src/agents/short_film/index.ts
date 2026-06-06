/**
 * Short Film Agent — domene-konfig for narrativ fiction-short (5-20 min):
 * scripted shorts, film-festival-entries, music-video-narratives,
 * commercial spec-shorts, student-film-prosjekter.
 *
 * Forskjell fra Documentary (non-fiction narrativ):
 *   - Chapters følger three-act-struktur for scripted fiction
 *     (cold-open → setup → inciting → rising → climax → resolution
 *     → coda), ikke dokumentar-investigasjon
 *   - Signal-vekter: dialogue_clarity, performance_authenticity,
 *     match_cuts (continuity), eyeline_matches (180-degree-rule),
 *     visual_motif, composition_strength, color_consistency
 *   - Look-packs: Cinematic Anamorphic, Indie Naturalistic,
 *     Festival Polished, Music Video Hybrid, Noir, Coming-of-Age
 *   - Short Film Director-persona: kjenner 180-degree-rule,
 *     match-cuts, eyeline-matches, beat-by-beat-pacing, visual-
 *     motifs, Wes-Anderson/Edgar-Wright/Sofia-Coppola/Spike-Jonze
 *     referanser
 *   - Default 10 min standard short, 16:9 cinematisk eller 2.39:1
 *     anamorphic — vi defaulter til 16:9 men persona-en kjenner
 *     when-to-go-wider
 */

import type { AgentConfig } from "../types";

const SHORT_FILM_CHAPTERS = [
  {
    id: "cold_open",
    label: "Cold open",
    pacingPct: 6,
    description: "Pre-title hook. Et visuelt eller dialog-moment som gir tonen og spørsmål-vekteren. I korte shorts kan dette være filmens første scene; i lengre shorts er det noe atypisk som kommer før Akt 1.",
    priorityHint: "high-energy" as const,
    narrativeBeat: "hook" as const,
  },
  {
    id: "act1_setup",
    label: "Akt 1: Setup",
    pacingPct: 18,
    description: "Etablering. Hvem er hovedpersonen, hva er deres ordinære verden, hva mangler de. Pacing skal være kontemplativt mer enn dramatisk. Visuell etablering > eksposisjon.",
    priorityHint: "informational" as const,
    narrativeBeat: "setup" as const,
  },
  {
    id: "inciting_incident",
    label: "Inciting incident",
    pacingPct: 6,
    description: "Det øyeblikket alt endres. En oppdagelse, et møte, en beslutning. Skal være TYDELIG — ikke gli umerkbart inn. Cut + sound-design bør forsterke skiftet.",
    priorityHint: "emotional-peak" as const,
    narrativeBeat: "build" as const,
  },
  {
    id: "act2_rising",
    label: "Akt 2: Rising action",
    pacingPct: 28,
    description: "Hovedpersonen møter motgang, lærer, prøver, feiler. Pacing øker gradvis. Midt i akt 2 ofte 'all is lost'-øyeblikk. Hold visuell motif fra setup, men varier komposisjon.",
    priorityHint: "informational" as const,
    narrativeBeat: "build" as const,
  },
  {
    id: "climax",
    label: "Climax",
    pacingPct: 14,
    description: "Det høyeste følelsesmessige eller fysiske punktet. Den store konfrontasjonen, valget, oppdagelsen. Cuts kan være raskere her hvis action; eller LANGE takes hvis emosjonell vekt.",
    priorityHint: "emotional-peak" as const,
    narrativeBeat: "peak" as const,
  },
  {
    id: "act3_resolution",
    label: "Akt 3: Resolution",
    pacingPct: 14,
    description: "Konsekvensene. Hva som har endret seg. Pacing roer ned. Hovedperson-en er ikke samme som ved start — vis det visuelt.",
    priorityHint: "atmospheric" as const,
    narrativeBeat: "celebration" as const,
  },
  {
    id: "coda",
    label: "Coda / siste shot",
    pacingPct: 4,
    description: "Det aller siste øyeblikket. Ofte et stillesittende shot, en motif-callback, eller en åpen-slutt-detalj. Skal føles uunngåelig. Hold lengre enn du tror du må.",
    priorityHint: "atmospheric" as const,
    narrativeBeat: "outro" as const,
  },
  {
    id: "credits",
    label: "Credits",
    pacingPct: 10,
    description: "Cast + crew-roll. Kan være tekst-only mot sort, eller spill over en kontekst-shot. Hvis filmen vises på festival: følg festival-template-en.",
    priorityHint: "atmospheric" as const,
    narrativeBeat: "outro" as const,
  },
];

const SHORT_FILM_SIGNAL_WEIGHTS = {
  dialogue_clarity: 0.92,         // Hvert ord skal høres
  performance_authenticity: 0.88, // Skuespill som ikke føles falsk
  match_cuts: 0.85,               // Continuity mellom shots
  eyeline_matches: 0.80,          // 180-degree-rule respektert
  visual_motif: 0.75,             // Gjentagende visuelle elementer
  composition_strength: 0.78,     // Frame-balanse, leading-lines
  color_consistency: 0.72,        // Look-pack konsekvent gjennom hele
  ambient_sound: 0.65,            // Room tone, place-establishing
  emotional_subtext: 0.85,        // Det som ikke sies
  // Wedding/music/screen-rec-signaler nullstilt
  rhythm_sync: 0.0,
  romantikk: 0.0,
  click_emphasis: 0.0,
  speaker_clarity: 0.0,
};

const SHORT_FILM_LOOK_PACKS = [
  {
    id: "cinematic-anamorphic",
    label: "Cinematic Anamorphic",
    description: "Anamorphic-følelse: blue-lens-flares, oval bokeh, 2.39:1 letterboxed inne i 16:9. Premium cinema-look. For high-end shorts og spec-commercials.",
    tags: ["anamorphic", "cinematic", "premium", "spec", "festival"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "muted" as const,
      temperature: "cool" as const,
      blackPoint: "crushed" as const,
      grain: "subtle" as const,
      specials: ["anamorphic-letterbox", "lens-flares", "halation"],
    },
  },
  {
    id: "indie-naturalistic",
    label: "Indie Naturalistic",
    description: "Natural-light-følelse, lav-budget-indie-stil. Hand-held, intim, ikke for polert. For Sundance-koble student-arbeid.",
    tags: ["indie", "sundance", "naturalistic", "student", "low-budget"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "natural" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "festival-polished",
    label: "Festival Polished",
    description: "Festival-klar broadcast-finish. Kontrollert kontrast, balansert palett. Trygg for Cannes-shorts, Tribeca, Berlinale-submissions.",
    tags: ["festival", "cannes", "tribeca", "berlinale", "polished"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "natural" as const,
      temperature: "neutral" as const,
      blackPoint: "natural" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "noir",
    label: "Noir",
    description: "Høy kontrast, dyp skygge, dramatisk lys. For thriller, mysterium, crime-shorts. Sammenligning: Sin City, Drive-følelse.",
    tags: ["noir", "thriller", "crime", "drama", "shadow"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "muted" as const,
      temperature: "cool" as const,
      blackPoint: "crushed" as const,
      grain: "noticeable" as const,
      specials: ["high-contrast-shadows", "vignette"],
    },
  },
  {
    id: "coming-of-age",
    label: "Coming-of-Age",
    description: "Varme nostalgi-tones, lett løftet skygge, sommer-følelse. Sammenligning: Lady Bird, Eighth Grade, Moonlight (i scener).",
    tags: ["coming-of-age", "nostalgic", "youth", "summer", "warm"],
    colorDirection: {
      contrast: "low" as const,
      saturation: "muted" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "music-video-hybrid",
    label: "Music Video Hybrid",
    description: "For shorts med performance-elementer eller hybride music-video/short-formater. Sterk visuell identitet, kreativ frihet med color.",
    tags: ["music-video-hybrid", "performance", "experimental", "visual"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "vibrant" as const,
      temperature: "neutral" as const,
      blackPoint: "crushed" as const,
      grain: "none" as const,
      specials: ["stylized-color"],
    },
  },
];

const SHORT_FILM_AGENT_PERSONA = {
  name: "Short Film Director",
  tagline: "Three-act-pacing, 180-degree-respekt, motif-callbacks",
  systemPrompt: `Du er Short Film Director, en AI Creative Director spesialisert på scripted narrative shorts (5-20 min): film-festival-entries, spec-commercials, music-video-narratives, og student-shorts. Du kjenner Wes Anderson, Edgar Wright, Sofia Coppola, Spike Jonze, Damien Chazelle, og short-film-tradisjonen fra Sundance/Cannes Court Métrage/Vimeo Staff Picks.

Du forstår at:
- KORTE SHORTS HAR INGEN FETT. Hver scene må bidra til protagonist eller premiss. Hvis du kan kutte en scene uten å miste filmen, har du for mye.
- AKT 1 ER 18 % AV TIDEN. I en 10-min short = 108 sek. Inciting incident MÅ komme inne i 2 min.
- 180-DEGREE-RULE er ikke valgfri. Hvis to karakterer snakker, hold dem på riktig side. Crossing the line uten grunn = amatør-mistake.
- EYELINE MATCHES bygger continuity. Hvis A ser til venstre på B, må B se til høyre på A. Selv hvis det krever subtil flip i post.
- MATCH CUTS skaper visuell satisfaction. Sykkel-hjul → hjul som spinner. Hand som åpner dør → hand som plukker frukt. Bruk når mulig.
- VISUELL MOTIF som gjentas (en farge, et objekt, et komposisjons-prinsipp) gir filmen identitet. Etabler tidlig, payoff sent.
- DIALOG: hver linje må tjene karakter ELLER plot — helst begge. Hvis en linje gjør ingen av delene, kutt.
- PERFORMANCE: hvis tekanten føles fake, FÅR du den ikke til å føles ekte i edit. Bruk dialog-trimming + B-cuts for å gjemme svakheter, men aksepter at noen takes ikke kan reddes.
- PACING-VARIASJON: alt-er-spennende = ingenting-er-spennende. Bygg slow inn så raske scener føles raske.
- SISTE SHOT skal være uunngåelig. Det skal føles som filmen alltid skulle ende slik. Hold lengre enn instinkt sier.

Du gir korte, konkrete forslag (1-3 setninger) om beat-pacing, continuity, match-cuts, motif-bruk, og dialog-trim. Skriv på norsk. Du er kreativ partner til regissør og redaktør, ikke chatbot.

Når du analyserer en sekvens, vurder alltid:
1. Kommer inciting incident innen 2 min (eller riktig prosentpoeng)?
2. Er 180-degree-rule respektert i hver dialog-scene?
3. Match-cuts mellom akt-skifter?
4. Er det en gjenkjennelig visuell motif som etableres + payoffes?
5. Tjener hver linje karakter ELLER plot?
6. Varierer pacing-en mellom slow + tense?
7. Har siste shot fått fred — eller kuttes til credits for tidlig?
8. Hvis dialog-linje føles svak: kan B-roll redde den?`,
};

export const SHORT_FILM_AGENT_CONFIG: AgentConfig = {
  kind: "short_film",
  name: "Short Film Agent",
  tagline: "Three-act-pacing for 5-20 min fiction-shorts",
  deliveryType: "Short Film",
  defaultDurationSec: 600, // 10 min standard
  defaultAspect: "16:9",
  chapters: SHORT_FILM_CHAPTERS,
  signalWeights: SHORT_FILM_SIGNAL_WEIGHTS,
  lookPacks: SHORT_FILM_LOOK_PACKS,
  primaryAgent: SHORT_FILM_AGENT_PERSONA,
  clientWishesExamples: [
    "kortere setup",
    "hold siste shot 8 sek lengre",
    "Sundance-look",
    "fix 180-degree-line i scene 4",
    "match-cut mellom akt 1 og 2",
    "2.39:1 anamorphic letterbox",
  ],
  onboarding: {
    title: "Short Film Agent",
    subtitle: "Three-act-fiction-short med Short Film Director-AI",
    iconHint: "Theaters",
  },
};

export default SHORT_FILM_AGENT_CONFIG;
