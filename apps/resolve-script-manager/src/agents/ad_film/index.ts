/**
 * Ad Film Agent — domene-konfig for premium cinematisk PRODUKT-reklame
 * (15–90 sek): app/SaaS-promo, produkt-launch, brand-film. Bygger på den
 * gjenbrukbare pipelinen i python/scripts/cinematic_adfilm_engine.py
 * (dokumentert i docs/cinematic-adfilm-pipeline.md).
 *
 * Forskjell fra Short Film (fiction) og Corporate (talking-head):
 *   - KARDINALREGEL: produktets grensesnitt genereres ALDRI — ekte app-opptak
 *     keyes pixel-perfekt inn på en generert plate (ui_key-shots). AI lager kun
 *     omgivelsene (person, gate, café, enhet-skall).
 *   - Flyt: én setning → Shot Plan (produksjonsark) → fal-stills m/ Claude-
 *     Vision-QC → Seedance-animasjon → key ekte UI → montér + VO + undertekst.
 *   - Produktet er helten; mennesket kun bruker (ofte silhuett).
 *   - Kvalitetsnivå Apple/Tesla/Stripe/DJI; ingen sci-fi/neon/HUD/emoji.
 */

import type { AgentConfig } from "../types";

const AD_FILM_CHAPTERS = [
  {
    id: "hook",
    label: "Hook",
    pacingPct: 12,
    description: "Cinematisk cold-open som setter tonen — helst produktet i bruk i en vakker setting. Skaper begjær før noe forklares.",
    priorityHint: "high-energy" as const,
    narrativeBeat: "hook" as const,
  },
  {
    id: "problem",
    label: "Behov / verden",
    pacingPct: 15,
    description: "Etabler brukerens hverdag / behovet produktet løser. Atmosfærisk, ikke selgende. VO antyder muligheten.",
    priorityHint: "atmospheric" as const,
    narrativeBeat: "setup" as const,
  },
  {
    id: "product_reveal",
    label: "Produkt-reveal",
    pacingPct: 22,
    description: "Kjerne-beaten: ekte produkt-UI avsløres (ui_key). Map→UX pull-back, hånd som holder enheten, skjermen leselig. Dette er der helten trer fram.",
    priorityHint: "high-energy" as const,
    narrativeBeat: "build" as const,
  },
  {
    id: "in_use",
    label: "I bruk",
    pacingPct: 24,
    description: "Produktet brukt i felten — flere ekte-UI-shots (navigasjon, handling, resultat). Vis, ikke fortell.",
    priorityHint: "informational" as const,
    narrativeBeat: "build" as const,
  },
  {
    id: "proof",
    label: "Resultat / momentum",
    pacingPct: 15,
    description: "Payoff: momentum, resultater, tall som bygger seg (ekte UI). Følelsen av gevinst.",
    priorityHint: "emotional-peak" as const,
    narrativeBeat: "peak" as const,
  },
  {
    id: "tag",
    label: "Outro / tag",
    pacingPct: 12,
    description: "Rolig sluttbilde (golden-hour silhuett) + wordmark + tagline. Siste undertekst-linje lander. Hold lengre enn instinkt.",
    priorityHint: "transitional" as const,
    narrativeBeat: "outro" as const,
  },
];

const AD_FILM_SIGNAL_WEIGHTS = {
  ui_legibility: 0.95,          // er den EKTE UI-en skarp og lesbar?
  screen_key_quality: 0.92,     // ren chroma-key, ingen grønn-spill / warping
  character_consistency: 0.88,  // samme person/klær i hvert shot
  cinematic_premium: 0.86,      // Apple/Tesla-nivå lys/komposisjon/farge
  vo_sub_sync: 0.85,            // VO ↔ undertekst 1:1 (per-linje-TTS)
  grade_consistency: 0.78,      // look-pack konsekvent gjennom hele
  composition_strength: 0.76,   // produktet er helten i framen
  ambient_sound: 0.55,
  // signaler fra andre agenter nullstilt
  dialogue_clarity: 0.0,
  rhythm_sync: 0.0,
  romantikk: 0.0,
};

const AD_FILM_LOOK_PACKS = [
  {
    id: "golden-hour-premium",
    label: "Golden Hour Premium",
    description: "Varm soloppgang/solnedgang, myk halation, silhuett-brukere, gyllen rim-light. Apple-keynote-premium. Standard for produkt-hero-film.",
    tags: ["golden-hour", "warm", "premium", "apple", "hero"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "vibrant" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "subtle" as const,
      specials: ["halation", "rim-light", "soft-bloom"],
    },
  },
  {
    id: "blue-hour-tech",
    label: "Blue Hour Tech",
    description: "Kjølig blåtime, våt asfalt-refleksjoner, skjerm-glød som eneste varme. Moderne tech-look for SaaS/app.",
    tags: ["blue-hour", "cool", "tech", "saas", "night"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "muted" as const,
      temperature: "cool" as const,
      blackPoint: "crushed" as const,
      grain: "subtle" as const,
      specials: ["screen-glow", "wet-reflections"],
    },
  },
  {
    id: "rain-noir",
    label: "Rain Noir",
    description: "Regn, lavt lys, høy kontrast, dramatiske silhuetter. For premium-B2B med alvor/tyngde.",
    tags: ["rain", "noir", "dramatic", "b2b", "moody"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "muted" as const,
      temperature: "cool" as const,
      blackPoint: "crushed" as const,
      grain: "noticeable" as const,
      specials: ["rain", "hard-key", "deep-shadows"],
    },
  },
];

const AD_FILM_AGENT_PERSONA = {
  name: "Ad Film Director",
  tagline: "Produkt som helt, ekte UI keyet, Apple-keynote-tone",
  systemPrompt: `Du er Ad Film Director, en AI Creative Director spesialisert på premium cinematisk produkt-reklame (15–90 sek): app/SaaS-promo, produkt-launch, brand-film. Referanser: Apple, Tesla, Stripe, Linear, Arc, DJI. Du lager reklame som selger uten å rope.

UFRAVIKELIGE REGLER:
- PRODUKTETS UI GENERERES ALDRI. Alt skjerm-innhold er EKTE app-opptak keyet pixel-perfekt inn på en generert plate (grønn skjerm). AI lager kun omgivelsene: person, gate, café, enhet-skall, lys. Oppfunnet/AI-hallucinert UI = diskvalifiserende feil.
- PRODUKTET ER HELTEN, mennesket er kun bruker — ofte i silhuett/skygge. Kamera og lys tjener skjermen og handlingen.
- KVALITET: Apple/Tesla/Stripe/DJI. Ingen sci-fi, neon, HUD-overlays, emoji. Rolig, selvsikker Apple-keynote-tone.
- KARAKTER-LÅS: samme person, klær og look i ALLE shots. Alle avledes fra ÉN referanse (continuity-motoren).
- SETTING konsistent (golden hour / blåtime / regn), ekte lokasjon-følelse.

Du forstår produksjonsflyten:
1. Én setning → Shot Plan (produksjonsark): karakter, miljø, per-shot storyboard + kamera (push-in/orbit/dolly/pan) + shot-type (wide/close-up/tracking) + mood.
2. Marker hvilke shots som er ui_key (ekte app-opptak keyes) vs ren atmosfære.
3. VO på engelsk (tale) + norsk undertekst, ~3–4s/linje, keynote-tone. Per-linje-TTS gir perfekt undertekst-sync.
4. Kvalitet håndheves av Claude Vision QC: svake stills regenereres til premium-terskel.

Når du vurderer et shot eller en sekvens, sjekk alltid:
1. Er den ekte UI-en skarp, leselig og korrekt keyet (ingen grønn-spill/warping)?
2. Er karakteren konsistent (samme person/klær) fra forrige shot?
3. Er produktet helten i komposisjonen — eller stjeler mennesket fokus?
4. Er look-en (golden/blue/rain) konsekvent gjennom hele?
5. Lander VO ↔ undertekst 1:1 og i keynote-tempo?
6. Har outroen fått fred (wordmark + tagline holdt lenge nok)?
7. Er det noe som bryter premium-følelsen (sci-fi/neon/HUD/emoji)? Fjern det.

Gi korte, konkrete forslag (1–3 setninger) på norsk. Du er kreativ partner til regissør og redaktør.`,
};

export const AD_FILM_AGENT_CONFIG: AgentConfig = {
  kind: "ad_film",
  name: "Ad Film Agent",
  tagline: "Premium produkt-reklame med ekte UI keyet + Shot Plan → film",
  deliveryType: "Ad Film",
  defaultDurationSec: 60,
  defaultAspect: "16:9",
  chapters: AD_FILM_CHAPTERS,
  signalWeights: AD_FILM_SIGNAL_WEIGHTS,
  lookPacks: AD_FILM_LOOK_PACKS,
  primaryAgent: AD_FILM_AGENT_PERSONA,
  clientWishesExamples: [
    "golden-hour-look",
    "hold produkt-reveal 2 sek lengre",
    "bytt s04 til close-up på skjermen",
    "blåtime-tech-grade",
    "engelsk VO, norsk undertekst",
    "sterkere hook",
  ],
  onboarding: {
    title: "Ad Film Agent",
    subtitle: "Premium produkt-reklame: én setning → produksjonsark → film med ekte UI keyet",
    iconHint: "Movie",
  },
};

export default AD_FILM_AGENT_CONFIG;
