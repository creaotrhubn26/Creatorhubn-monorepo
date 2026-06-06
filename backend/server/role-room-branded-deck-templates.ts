/**
 * role-room-branded-deck-templates.ts
 *
 * Visuelle deck-templates med Role Room-branding (lilla gradient, glow,
 * dashboard-mockups, trust-pillars). Hver template definerer en sekvens
 * av (section, layout, default-content). Brukes av POST /api/admin-room/decks
 * når caller spesifiserer ?templateId=...
 *
 * Layouts samsvarer med `frontend/.../pages/deck-editor/deckLayouts.ts`.
 * Hold de to filene i sync når nye layouts legges til.
 */

import type { InvestorSection } from "./role-room-investor-deck-template.js";

export interface BrandedSlideSeed {
  section: InvestorSection;
  position: number;
  layout: string;
  content: Record<string, unknown>;
}

export interface BrandedDeckTemplate {
  id: string;
  title: string;
  description: string;
  slides: BrandedSlideSeed[];
}

const INVESTOR_PITCH_V2_BRANDED: BrandedDeckTemplate = {
  id: "investor-pitch-v2-branded",
  title: "Investor pitch (Role Room-branded)",
  description:
    "8-slide investor-pitch i Role Room-stil med hero-mockup, trust-pillars, traction-stats og team-grid.",
  slides: [
    {
      section: "cover",
      position: 0,
      layout: "hero_pillars",
      content: {
        heading: "The professional casting platform",
        subheading: "for film, TV & theatre in Norway.",
        tagline: "Casting. Roles. Together.",
        pillars: [
          { icon: "verified", title: "Verified", subtitle: "professionals" },
          { icon: "team", title: "Smarter", subtitle: "casting" },
          { icon: "lock", title: "Secure &", subtitle: "trusted" },
        ],
        primaryCta: "Start casting",
        secondaryCta: "Book a demo",
        footer: "Made for Norway. Built for the industry.",
      },
    },
    {
      section: "problem",
      position: 1,
      layout: "problem_centered",
      content: {
        heading: "Casting i Norge er fragmentert",
        body:
          "Produsenter jonglerer Google Sheets, e-post-tråder og Facebook-grupper. Skuespillere mister oversikt over hvem de har søkt på. Resultatet: 6 uker fra brief til kontrakt — det burde være 6 dager.",
        points: [
          "Manuell shortlisting på tvers av 3-5 verktøy",
          "Ingen verifiserte profiler — duplikater + utdatert info",
          "Klient-godkjenning krever PowerPoint-eksport hver uke",
        ],
      },
    },
    {
      section: "solution",
      position: 2,
      layout: "solution_split",
      content: {
        heading: "Én plattform fra brief til kontrakt",
        body:
          "The Role Room samler hele casting-flyten: roller, talent, shortlister, klient-godkjenning og avtaler. Verifiserte profiler, smart matching, ende-til-ende sporing.",
        bullets: [
          "Verified talent-database (12K+)",
          "Smart shortlists med klient-godkjenning",
          "Avtaler signert direkte i plattformen",
        ],
        mockupCaption: "Talent-dashboard med shortlist og prosjekt-status",
      },
    },
    {
      section: "market",
      position: 3,
      layout: "problem_centered",
      content: {
        heading: "Marked",
        body:
          "Norsk produksjonsmarked: 850+ aktive produksjonsselskaper, 12K+ profesjonelle skuespillere, 1.2 mrd NOK årlig produksjonsbudsjett. Nordisk utvidelse i fase 2 (SE/DK/FI).",
        points: [
          "TAM Norden: 4-5 mrd NOK årlig",
          "SAM Norge: 1.2 mrd NOK årlig",
          "SOM år 1-2: produksjon + casting i Norge",
        ],
      },
    },
    {
      section: "traction",
      position: 4,
      layout: "traction_stats",
      content: {
        heading: "Tidlig traction",
        stats: [
          { value: "12K+", label: "Verified talent" },
          { value: "850+", label: "Active roles" },
          { value: "320+", label: "Productions" },
          { value: "98%", label: "Response rate" },
        ],
        footnote:
          "Tallene er foreløpig fra utvalgte beta-partnere; offentlig launch Q3 2026.",
      },
    },
    {
      section: "team",
      position: 5,
      layout: "team_grid",
      content: {
        heading: "Teamet",
        members: [
          {
            name: "Daniel Qazi",
            role: "Founder / Product",
            bio:
              "Solo-bygger med bakgrunn fra film og full-stack-utvikling. Bygget hele plattformen fra grunnen.",
          },
          {
            name: "Åpen rolle",
            role: "Casting Director Advisor",
            bio: "Erfaren CD som validerer workflows og åpner casting-partner-nettverk.",
          },
        ],
      },
    },
    {
      section: "funding",
      position: 6,
      layout: "ask_cta",
      content: {
        heading: "Vi søker 3 mNOK seed",
        useOfFunds: [
          { label: "Sales & onboarding", percent: 40 },
          { label: "Product / engineering", percent: 35 },
          { label: "Marketing & GTM", percent: 15 },
          { label: "Buffer / legal", percent: 10 },
        ],
        runway: "12 måneder runway",
        ctaPrimary: "Book a 30-min walkthrough",
        ctaSecondary: "daniel@creatorhubn.com",
      },
    },
    {
      section: "cta",
      position: 7,
      layout: "ask_cta",
      content: {
        heading: "Bli med å bygge profesjonell casting i Norge",
        useOfFunds: [],
        ctaPrimary: "Book a demo",
        ctaSecondary: "support@theroleroom.com",
      },
    },
  ],
};

const CUSTOMER_DEMO_V1: BrandedDeckTemplate = {
  id: "customer-demo-v1",
  title: "Kundedemo (Role Room-branded)",
  description:
    "5-slide demo for produksjons-kunder: problem, løsning, produkt-walkthrough, traction, neste steg.",
  slides: [
    {
      section: "cover",
      position: 0,
      layout: "hero_pillars",
      content: {
        heading: "The Role Room",
        subheading: "Hele casting-flyten på ett sted.",
        tagline: "Casting. Roles. Together.",
        pillars: [
          { icon: "verified", title: "Verified", subtitle: "professionals" },
          { icon: "team", title: "Smarter", subtitle: "casting" },
          { icon: "lock", title: "Secure &", subtitle: "trusted" },
        ],
        primaryCta: "Se demo",
        secondaryCta: "Kontakt oss",
        footer: "Made for Norway. Built for the industry.",
      },
    },
    {
      section: "problem",
      position: 1,
      layout: "problem_centered",
      content: {
        heading: "Hvor mye tid bruker du på casting-koordinering?",
        body: "Spørsmål til deg: hvor mange e-poster, sheets og DMs trengs for å gå fra brief til shortlist i dag?",
        points: [
          "Brief → e-post → talent-jakt → samtaler → shortlist → klient-godkjenning",
          "Hvert ledd skaper friksjon og mistet kontekst",
          "Klient-godkjenning er det største flaskeholden",
        ],
      },
    },
    {
      section: "solution",
      position: 2,
      layout: "solution_split",
      content: {
        heading: "Én flyt, fra brief til kontrakt",
        body:
          "Inviter talent, bygg shortlists, del med klient, signer avtaler — alt sporet og søkbart.",
        bullets: [
          "Verified talent-database",
          "Klient-portal med godkjenning i 1 klikk",
          "Avtale-signering integrert",
        ],
        mockupCaption: "Klient ser shortlist i sin egen portal",
      },
    },
    {
      section: "traction",
      position: 3,
      layout: "traction_stats",
      content: {
        heading: "Brukere som likner deg",
        stats: [
          { value: "6 dager", label: "Brief → kontrakt (snitt)" },
          { value: "3.2x", label: "Raskere shortlist" },
          { value: "98%", label: "Klient-godkjenning i 1 klikk" },
        ],
      },
    },
    {
      section: "cta",
      position: 4,
      layout: "ask_cta",
      content: {
        heading: "La oss starte din første casting",
        ctaPrimary: "Book onboarding-samtale",
        ctaSecondary: "support@theroleroom.com",
      },
    },
  ],
};

const PRESS_KIT_V1: BrandedDeckTemplate = {
  id: "press-kit-v1",
  title: "Pressekit (Role Room-branded)",
  description: "4-slide presse-pakke: hva er Role Room, hvem står bak, traction, kontakt.",
  slides: [
    {
      section: "cover",
      position: 0,
      layout: "hero_pillars",
      content: {
        heading: "Pressekit",
        subheading: "The Role Room — profesjonell casting i Norge.",
        tagline: "Casting. Roles. Together.",
        pillars: [
          { icon: "verified", title: "Verified", subtitle: "professionals" },
          { icon: "team", title: "Smarter", subtitle: "casting" },
          { icon: "lock", title: "Secure &", subtitle: "trusted" },
        ],
        primaryCta: "Last ned logo-pakke",
        secondaryCta: "presse@theroleroom.com",
        footer: "For journalister og bransjepublikasjoner",
      },
    },
    {
      section: "solution",
      position: 1,
      layout: "solution_split",
      content: {
        heading: "Hva er The Role Room?",
        body:
          "Norsk-utviklet casting-plattform for film, TV og teater. Samler talent-database, casting-pipeline, klient-godkjenning og avtale-signering på ett sted.",
        bullets: ["Lansert 2026", "Bygget i Norge", "Brukt av produksjons-team og talent"],
        mockupCaption: "Talent-dashboard med verifiserte profiler",
      },
    },
    {
      section: "traction",
      position: 2,
      layout: "traction_stats",
      content: {
        heading: "Nøkkeltall",
        stats: [
          { value: "12K+", label: "Verified talent" },
          { value: "850+", label: "Active roles" },
          { value: "320+", label: "Productions" },
          { value: "98%", label: "Response rate" },
        ],
      },
    },
    {
      section: "cta",
      position: 3,
      layout: "ask_cta",
      content: {
        heading: "Kontakt",
        ctaPrimary: "presse@theroleroom.com",
        ctaSecondary: "Daniel Qazi · Founder",
      },
    },
  ],
};

export const BRANDED_DECK_TEMPLATES: BrandedDeckTemplate[] = [
  INVESTOR_PITCH_V2_BRANDED,
  CUSTOMER_DEMO_V1,
  PRESS_KIT_V1,
];

export function getBrandedTemplate(id: string): BrandedDeckTemplate | undefined {
  return BRANDED_DECK_TEMPLATES.find((t) => t.id === id);
}
