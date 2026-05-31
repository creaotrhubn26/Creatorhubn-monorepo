/**
 * Documentary Agent — domene-konfig for narrativ long-form-content:
 * dokumentarer, mini-docs, brand-films, case-studies, personlige
 * profiler, investigative pieces.
 *
 * Forskjell fra Event (live-events) og Corporate (sales-funnel):
 *   - Chapters følger narrativ struktur (cold-open → setup → konflikt
 *     → reise → klimaks → resolution → coda) — story-arc, ikke
 *     event-timeline eller funnel
 *   - Signal-vekter: narrative_clarity (story henger sammen),
 *     character_emotion (sårbarhet, dybde), visual_storytelling
 *     (B-roll med mening), interview_clarity, pacing_variation,
 *     ambient_sound, archival_integration
 *   - Look-packs: Cinema Verité (rå/intim), Classic Documentary
 *     (broadcast-vennlig), Investigative (kontrast-tung
 *     journalistisk), Brand Story (premium corporate-doc), Personal
 *     Profile (varm/narrativ), Historical Retrospective (arkiv-feel)
 *   - Documentary Director-persona: kjenner show-don't-tell, B-roll-
 *     over-talking-head, ambient room-tone, Ken Burns på arkiv,
 *     voiceover som tjener historien
 *   - Default 12 min (mini-doc), 16:9 cinematisk-aspect
 */

import type { AgentConfig } from "../types";

const DOCUMENTARY_CHAPTERS = [
  {
    id: "cold_open",
    label: "Cold open",
    pacingPct: 5,
    description: "3-30 sek pre-title hook. Et sterkt visuelt øyeblikk, en provoserende setning, eller en uventet detalj som tvinger seer å spørre: 'hva er dette?'. Aldri en eksposisjon — la den komme etterpå.",
    priorityHint: "high-energy" as const,
  },
  {
    id: "titles",
    label: "Title sequence",
    pacingPct: 3,
    description: "Tittel + tema-etablering. Kan være musikk-drevet, foto-kollasj, eller en stillesittende komposisjon. Setter tonen for hele filmen.",
    priorityHint: "atmospheric" as const,
  },
  {
    id: "setup",
    label: "Setup / kontekst",
    pacingPct: 12,
    description: "Hvem, hvor, hva står på spill. Etabler verden seeren skal være i. Bruk wide-shots av sted, ambient sound, og kort voiceover ELLER interview-snutt. IKKE eksposisjon-dump.",
    priorityHint: "informational" as const,
  },
  {
    id: "character",
    label: "Character introduksjon",
    pacingPct: 14,
    description: "Vi blir kjent med hovedpersonen(e). Interview-snutter, hverdag-B-roll, et småtimt øyeblikk som viser hvem de er — ikke bare hva de sier. Show-don't-tell.",
    priorityHint: "informational" as const,
  },
  {
    id: "conflict",
    label: "Inciting incident / konflikt",
    pacingPct: 14,
    description: "Hva endrer seg. Hva utfordrer. Hva er problemet/spørsmålet filmen skal undersøke. Dette er punktet der seeren commitser seg.",
    priorityHint: "emotional-peak" as const,
  },
  {
    id: "investigation",
    label: "Investigation / reise",
    pacingPct: 24,
    description: "Hovedkjernen. Hovedpersonen møter motgang, lærer, snakker med andre, beveger seg gjennom historien. Veksle mellom interview, B-roll, archival, ambient. Pacing-variasjon er kritisk her — ikke alt skal være intens.",
    priorityHint: "informational" as const,
  },
  {
    id: "turning_point",
    label: "Turning point",
    pacingPct: 6,
    description: "Et moment der ting endrer seg fundamentalt. Realisering, beslutning, oppdagelse. Ofte slow-pace, longer takes, mer reflektivt enn handling.",
    priorityHint: "emotional-peak" as const,
  },
  {
    id: "climax",
    label: "Climax / revelation",
    pacingPct: 12,
    description: "Filmen-s høyeste følelsesmessige eller informasjonelle punkt. Den store revealen, konfrontasjonen, eller forløsningen. Aldri rushet.",
    priorityHint: "emotional-peak" as const,
  },
  {
    id: "resolution",
    label: "Resolution",
    pacingPct: 7,
    description: "Konsekvensene. Hva skjedde etter. Karakteren har endret seg — vis hvordan. Pacing slower, mer kontemplativt.",
    priorityHint: "atmospheric" as const,
  },
  {
    id: "coda",
    label: "Coda / where they are now",
    pacingPct: 3,
    description: "Kort epilog. Tekst-overlay eller stillesittende komposisjon: 'Et år senere …'. Eller bare et symbolsk siste shot. Føles uunngåelig.",
    priorityHint: "atmospheric" as const,
  },
];

const DOCUMENTARY_SIGNAL_WEIGHTS = {
  narrative_clarity: 0.95,        // Henger historien sammen?
  character_emotion: 0.88,        // Sårbare, dype, autentiske øyeblikk
  visual_storytelling: 0.85,      // B-roll som forteller, ikke pynter
  interview_clarity: 0.80,        // Klar audio, god framing, intim
  pacing_variation: 0.78,         // Miks av slow + fast moments
  ambient_sound: 0.65,            // Room tone, sense of place
  archival_integration: 0.55,     // Foto/footage/dokumenter — Ken Burns
  silence_for_weight: 0.50,       // Pauser brukt narrativt, ikke bare cuts
  // Wedding/music/screen-rec/event-signaler nullstilt
  rhythm_sync: 0.0,
  romantikk: 0.0,
  click_emphasis: 0.0,
  speaker_clarity: 0.0,
};

const DOCUMENTARY_LOOK_PACKS = [
  {
    id: "cinema-verite",
    label: "Cinema Verité",
    description: "Rå, intim, hand-held estetikk. For personlige docs hvor autentisitet trumfer polish. Sammenligning: Errol Morris, RBG-stil.",
    tags: ["intimate", "raw", "hand-held", "verite", "authentic"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "muted" as const,
      temperature: "neutral" as const,
      blackPoint: "lifted" as const,
      grain: "noticeable" as const,
    },
  },
  {
    id: "classic-documentary",
    label: "Classic Documentary",
    description: "Broadcast-vennlig, nøytral, polished. Default for de fleste prosjekter. PBS/BBC-stil. Trygg, ikke kjedelig.",
    tags: ["broadcast", "classic", "neutral", "pbs", "default"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "natural" as const,
      temperature: "neutral" as const,
      blackPoint: "natural" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "investigative",
    label: "Investigative",
    description: "Kontrast-tung, kjølig, journalistisk. For exposés, true crime, investigative journalism. Sammenligning: Netflix-investigative-stil.",
    tags: ["investigative", "true-crime", "exposé", "journalism", "high-contrast"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "muted" as const,
      temperature: "cool" as const,
      blackPoint: "crushed" as const,
      grain: "subtle" as const,
      specials: ["lower-third-gradient"],
    },
  },
  {
    id: "brand-story",
    label: "Brand Story",
    description: "Premium polert, corporate-doc-stil. For brand-films, case-studies, founder-stories. Hver shot er kvalitets-kontrollert.",
    tags: ["brand", "corporate", "case-study", "founder", "premium"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "muted" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "none" as const,
    },
  },
  {
    id: "personal-profile",
    label: "Personal Profile",
    description: "Varm, intim, narrativ-drevet. For personprofiler, biografisk-content, kunstner-portretter.",
    tags: ["profile", "personal", "biography", "portrait", "warm"],
    colorDirection: {
      contrast: "low" as const,
      saturation: "natural" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "historical-retrospective",
    label: "Historical Retrospective",
    description: "Sepia/desaturert, arkiv-følelse. For historisk content, retrospektiver, fortidens-fortellinger. Lett bleached high-lights.",
    tags: ["historical", "archival", "retrospective", "vintage", "sepia"],
    colorDirection: {
      contrast: "low" as const,
      saturation: "muted" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "noticeable" as const,
      specials: ["sepia-tone", "vignette"],
    },
  },
];

const DOCUMENTARY_AGENT_PERSONA = {
  name: "Documentary Director",
  tagline: "Show don't tell, B-roll over talking-head, ambient sound respekteres",
  systemPrompt: `Du er Documentary Director, en AI Creative Director spesialisert på narrativ long-form-redigering (dokumentarer, mini-docs, brand-films, case-studies, personlige profiler, investigative pieces). Du kjenner Errol Morris, Werner Herzog, Ezra Edelman, Netflix-investigative, og PBS-tradisjonen.

Du forstår at:
- SHOW DON'T TELL er kjernen. Hvis hovedpersonen sier 'jeg var ensom', vis et tomt rom, et middag-bord for én, vinduet på en regnværsdag. Aldri vis det de SIER — vis det de er.
- B-ROLL OVER TALKING-HEAD når mulig. Hold interview-audio mens du viser hva de snakker om. Talking-head bryter immersjon hvis det er for lenge.
- AMBIENT SOUND er ofte viktigere enn musikk. Stillhet med room-tone er kraftigere enn dramatisk score. La steder snakke.
- KEN BURNS på arkiv. Photos må bevege seg — pan + zoom. Statisk arkiv-foto føles død.
- PACING VARIATION er ALT. Hvis alt er intens, blir ingenting intens. Bygg slow moments inn så de raske føles raske.
- VOICEOVER skal SERVE historien, ikke EKSPONERE den. Hvis du må forklare med VO, har du ikke vist nok først.
- INTERVIEW-SETUP avgjør alt. Hvis person ikke åpner seg, er materialet uøvelig. Hold tilbake "the question that matters" til de er warm.
- PROTAGONIST + STAKES må være KRYSTALL-KLART. Hvem er hovedpersonen? Hva risikerer de? Hvis du ikke kan svare i én setning, mangler filmen sentral.
- STILLHET FOR VEKT. Etter et stort revelation, hold på pause-shot i 3-5 sek. La det puste. Det er respekt for materiale.

Du gir korte, konkrete forslag (1-3 setninger) om B-roll-bruk, interview-trimming, voiceover-vurdering, arkiv-integrasjon, pacing-balanse, og narrativ struktur. Skriv på norsk. Du er kreativ partner til dokumentarist og redaktør, ikke chatbot.

Når du analyserer en sekvens, vurder alltid:
1. Er protagonist + stakes tydelige innen 2 minutter?
2. Brukes B-roll til å vise det interview-en sier — eller er talking-head dominant?
3. Får ambient sound og stillhet plass — eller druknes alt i musikk?
4. Varierer pacing-en, eller er alt samme tempo?
5. Tjener voiceover historien, eller forklarer den noe vi burde se?
6. Beveger arkiv-fotos seg (Ken Burns), eller er de statiske?
7. Har klimaks fått tid til å puste etterpå?`,
};

export const DOCUMENTARY_AGENT_CONFIG: AgentConfig = {
  kind: "documentary",
  name: "Documentary Agent",
  tagline: "Narrativ long-form — dokumentarer, brand-films, profiler",
  deliveryType: "Documentary",
  defaultDurationSec: 720, // 12 min mini-doc
  defaultAspect: "16:9",
  chapters: DOCUMENTARY_CHAPTERS,
  signalWeights: DOCUMENTARY_SIGNAL_WEIGHTS,
  lookPacks: DOCUMENTARY_LOOK_PACKS,
  primaryAgent: DOCUMENTARY_AGENT_PERSONA,
  clientWishesExamples: [
    "lengre cold open",
    "mer B-roll i investigation",
    "behold stillheten etter klimaks",
    "kortere voiceover",
    "Ken Burns på alle arkiv-fotos",
    "60-min lang-versjon i tillegg til 12-min",
  ],
  onboarding: {
    title: "Documentary Agent",
    subtitle: "Narrativ long-form med Documentary Director-AI som kjenner show-don't-tell",
    iconHint: "Movie",
  },
};

export default DOCUMENTARY_AGENT_CONFIG;
