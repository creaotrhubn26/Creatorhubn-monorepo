/**
 * Corporate Agent — domene-konfig for B2B/promo/interview-leveranser.
 *
 * Forskjell fra Wedding og Music Video:
 *   - Chapters: hook/problem/solution/proof/cta — sales-funnel-flow
 *   - Signal-vekter: brand-fit, message-clarity, speaker-presence,
 *     production-polish (alt nullsatt for rom-anlitik som romantikk)
 *   - Look-packs: stylized for B2B-credibility — clean broadcast,
 *     editorial, premium, technical/diagram-heavy, friendly
 *   - Claude-persona: Corporate Director som kjenner
 *     hook-bygging, sosial-bevis, CTA-konvertering, varemerke-konsistens
 *   - Default-varighet: 60s (LinkedIn/Reels-promo) eller 180s
 *     (case-study/explainer). Aspect 16:9 for LinkedIn, 9:16 for sosial
 */

import type { AgentConfig } from "../types";

const CORPORATE_CHAPTERS = [
  {
    id: "hook",
    label: "Hook (0–5s)",
    pacingPct: 6,
    description: "Fang oppmerksomhet de første 5 sekunder. Pattern interrupt, sterk visuell, eller direkte spørsmål. Hvis hooken svikter, faller alt etterpå.",
    priorityHint: "high-energy" as const,
  },
  {
    id: "problem",
    label: "Problem-statement",
    pacingPct: 18,
    description: "Etabler smerten kunden kjenner igjen. Konkret, spesifikk, ikke generisk. Bruk B-roll som visualiserer problemet (frustrert kunde, manuelle prosesser, kø).",
    priorityHint: "informational" as const,
  },
  {
    id: "solution",
    label: "Løsning / produkt",
    pacingPct: 28,
    description: "Vis hvordan produktet/tjenesten løser problemet. Demo, screen-recording, hands-on-shots. Hovedkjernen i video-en.",
    priorityHint: "informational" as const,
  },
  {
    id: "proof",
    label: "Bevis / case",
    pacingPct: 20,
    description: "Sosial bevis: testimonial, case-tall, før/etter, kunde-logoer, eksperter. Bygger troverdighet før CTA.",
    priorityHint: "emotional-peak" as const,
  },
  {
    id: "differentiation",
    label: "Differensiering",
    pacingPct: 12,
    description: "Hva som skiller oss fra konkurrentene. Kort sammenligning, unique value prop. Bør ikke dvele her — én klar setning er ofte nok.",
    priorityHint: "transitional" as const,
  },
  {
    id: "cta",
    label: "Call-to-action",
    pacingPct: 10,
    description: "Klar handling: 'Bestill demo', 'Last ned guide', 'Følg lenken'. Skjerm-tekst pluss verbal CTA. Skap urgency hvis det passer.",
    priorityHint: "high-energy" as const,
  },
  {
    id: "outro",
    label: "Outro / brand-mark",
    pacingPct: 6,
    description: "Logo-reveal, varemerke-bumper, kontaktinfo. Slutt-følelse av polert produksjon — det signaliserer at hele leveransen er kvalitetssikret.",
    priorityHint: "atmospheric" as const,
  },
];

const CORPORATE_SIGNAL_WEIGHTS = {
  brand_fit: 0.90,
  message_clarity: 0.85,
  speaker_presence: 0.80,
  production_polish: 0.75,
  visual_information_density: 0.70,
  pacing_alignment: 0.65,
  cta_visibility: 0.60,
  // Wedding-signaler nullstilles
  wedding_events: 0.0,
  romantikk: 0.0,
  familie: 0.0,
};

const CORPORATE_LOOK_PACKS = [
  {
    id: "clean-broadcast",
    label: "Clean Broadcast",
    description: "Nøytral hvit-balanse, kontrollert kontrast, broadcast-standard. Trygt for de fleste B2B-content.",
    tags: ["broadcast", "neutral", "trygg", "default"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "natural" as const,
      temperature: "neutral" as const,
      blackPoint: "natural" as const,
      grain: "none" as const,
    },
  },
  {
    id: "premium-editorial",
    label: "Premium Editorial",
    description: "Lett løftet midt-tones, varme high-lights, magasin-følelse. For high-end produkter og premium service.",
    tags: ["premium", "editorial", "luxury", "warm"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "muted" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "tech-precision",
    label: "Tech Precision",
    description: "Kjølig palett, høy clarity, presis kontrast. Egnet for SaaS, technical demos, dashboards.",
    tags: ["tech", "saas", "dashboard", "precise", "cool"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "natural" as const,
      temperature: "cool" as const,
      blackPoint: "natural" as const,
      grain: "none" as const,
    },
  },
  {
    id: "friendly-conversation",
    label: "Friendly Conversation",
    description: "Lette, varme, kontaktende. For interview, podcast-klipp, kunde-historier.",
    tags: ["interview", "podcast", "friendly", "approachable", "soft"],
    colorDirection: {
      contrast: "low" as const,
      saturation: "natural" as const,
      temperature: "warm" as const,
      blackPoint: "lifted" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "documentary-credible",
    label: "Documentary Credible",
    description: "Lett desaturert, dokumentar-følelse, troverdighets-tone. For case-studies, mission-driven content.",
    tags: ["documentary", "credible", "mission", "case-study"],
    colorDirection: {
      contrast: "medium" as const,
      saturation: "muted" as const,
      temperature: "neutral" as const,
      blackPoint: "natural" as const,
      grain: "subtle" as const,
    },
  },
  {
    id: "bold-startup",
    label: "Bold Startup",
    description: "Mettet, dynamisk, energisk. For startup-pitcher, growth-content, vekst-fortelling.",
    tags: ["startup", "growth", "energi", "vibrant"],
    colorDirection: {
      contrast: "high" as const,
      saturation: "vibrant" as const,
      temperature: "neutral" as const,
      blackPoint: "crushed" as const,
      grain: "none" as const,
    },
  },
];

const CORPORATE_AGENT_PERSONA = {
  name: "Corporate Director",
  tagline: "Hook → problem → løsning → bevis → CTA",
  systemPrompt: `Du er Corporate Director, en AI Creative Director spesialisert på B2B-video, promo og produktinnhold. Du kjenner sales-funnel-strukturen (hook → problem → solution → proof → CTA), hvordan man bygger troverdighet for varemerker, og hvordan man konverterer seere til handling.

Du forstår at:
- HOOK-en (0–5s) bestemmer alt. Hvis 80 % faller fra her, er resten irrelevant. Krev pattern-interrupt, sterk visuell, eller direkte spørsmål.
- PROBLEM-statement må være konkret. "Vi gjør prosesser smartere" er ikke et problem — "din IT-avdeling drukner i tickets" er.
- SOLUTION-segmentet skal vise, ikke fortelle. Demo > description.
- PROOF (testimonial, tall, kunde-logoer) plasseres ETTER solution, ikke før. Først engasjer, så troverdig-gjør.
- CTA må være SÉN: én handling, klar tekst-overlay, verbal repetisjon.
- BRAND-fit er kritisk. Look-pack, font, farger MÅ matche klientens varemerke. Ingen tvil. Hvis du er usikker, foreslå Clean Broadcast som trygg default.
- LinkedIn-promo: 16:9 eller 1:1, captions må være på (85% ser uten lyd). 60s ideelt.
- Sosial-promo: 9:16 vertical, hook MÅ levere i de første 3 sekundene, captions overstilt.

Du gir korte, konkrete forslag (1-3 setninger) om hook-strategi, message-clarity, sosial-bevis-plassering, CTA-konvertering og varemerke-konsistens. Skriv på norsk. Du er kreativ partner til markedsføring og videograf, ikke chatbot.

Når du analyserer en sekvens, vurder alltid:
1. Leverer hook-en i de første 5 sekundene?
2. Er problem-statement konkret og kundens språk, ikke vårt?
3. Er solution vist (demo/screen-recording) eller bare fortalt?
4. Er proof plassert riktig — etter engagement, før CTA?
5. Er CTA klar, sén og synlig som tekst-overlay?
6. Matcher look og typografi varemerkets visuelle identitet?`,
};

export const CORPORATE_AGENT_CONFIG: AgentConfig = {
  kind: "corporate",
  name: "Corporate Agent",
  tagline: "B2B-promo og produktvideo med konverterings-fokus",
  deliveryType: "Corporate Promo",
  defaultDurationSec: 60, // Sosial-først; case-study kan strekkes til 180
  defaultAspect: "16:9",
  chapters: CORPORATE_CHAPTERS,
  signalWeights: CORPORATE_SIGNAL_WEIGHTS,
  lookPacks: CORPORATE_LOOK_PACKS,
  primaryAgent: CORPORATE_AGENT_PERSONA,
  clientWishesExamples: [
    "kortere hook",
    "mer fokus på produktet, mindre på taler",
    "legg til kunde-logoer",
    "CTA tydeligere",
    "premium-look",
    "60s-versjon for LinkedIn",
  ],
  onboarding: {
    title: "Corporate Agent",
    subtitle: "B2B-promo, case-study og produkt-video med konverterings-fokus",
    iconHint: "BusinessCenter",
  },
};

export default CORPORATE_AGENT_CONFIG;
