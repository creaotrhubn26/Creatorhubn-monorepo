/**
 * Pure-frontend hint-generators for marketing-plan posts.
 *   #159 — auto-foreslå publiseringstid per platform
 *   #160 — crosspost-plan med faktiske datoer (utleder fra delayDays)
 *   #164 — hashtag-forslag basert på plattform + bransje
 *   #166 — auto-foreslå CTA-link basert på hook-intent
 *
 * Alle deterministiske, ingen Claude-calls. Heuristikkene er bevisst
 * konservative — bedre å gi 3 sikre treff enn 12 spekulative.
 */

import type { MarketingPlanPost } from '../services/roleRoomAgentService';

// ─────────────────────────────────────────────────────────────────────
// #159 — best publiseringstid per platform
// Tider er hardkodet basert på publicly available creator-bench reports
// (Sprout Social 2026, Later 2026). Norsk tidssone (Europa/Oslo).
// ─────────────────────────────────────────────────────────────────────
interface OptimalTimeSlot {
  /** 0-6 (søn-lør) — som JS Date.getDay() */
  dayOfWeek: number;
  /** 0-23 */
  hour: number;
  /** 0-59 */
  minute: number;
  /** Hvorfor — brukes som tooltip-tekst i UI. */
  reason: string;
}

const OPTIMAL_TIMES: Record<NonNullable<MarketingPlanPost['primaryPlatform']>, OptimalTimeSlot[]> = {
  instagram: [
    { dayOfWeek: 2, hour: 11, minute: 0, reason: 'Tirsdager 11:00 — høyest engagement på IG i Norge.' },
    { dayOfWeek: 4, hour: 12, minute: 30, reason: 'Torsdager lunsj — algoritmen prioriterer aktive feeder.' },
    { dayOfWeek: 6, hour: 10, minute: 0, reason: 'Lørdag morgen — feed-scrolling-topp.' },
  ],
  tiktok: [
    { dayOfWeek: 1, hour: 19, minute: 0, reason: 'Hverdager 19-21 — primær TT-bruk i Norge.' },
    { dayOfWeek: 3, hour: 20, minute: 0, reason: 'Onsdag kveld — høy completion rate.' },
    { dayOfWeek: 5, hour: 18, minute: 0, reason: 'Fredag — pre-helg-scrolling.' },
  ],
  linkedin: [
    { dayOfWeek: 2, hour: 8, minute: 30, reason: 'Tirsdag morgenkaffe — pre-arbeid LinkedIn-sjekk.' },
    { dayOfWeek: 3, hour: 11, minute: 0, reason: 'Onsdag formiddag — peak-tid B2B-feed.' },
    { dayOfWeek: 4, hour: 16, minute: 0, reason: 'Torsdag før hjemreise — siste sjekk.' },
  ],
  youtube: [
    { dayOfWeek: 6, hour: 14, minute: 0, reason: 'Lørdag ettermiddag — helgekonsum.' },
    { dayOfWeek: 0, hour: 19, minute: 0, reason: 'Søndag kveld — pre-uke-relaxing.' },
    { dayOfWeek: 3, hour: 17, minute: 0, reason: 'Onsdag kveld — mid-week binge.' },
  ],
  facebook: [
    { dayOfWeek: 3, hour: 9, minute: 0, reason: 'Onsdag morgenscroll — Facebook peak NO.' },
    { dayOfWeek: 5, hour: 12, minute: 0, reason: 'Fredag lunsj — helgevalg-mode.' },
  ],
};

/** Returner neste optimale tid fra og med en gitt baseDate. Returnerer
 *  ISO-string i UTC for å være kompatibel med scheduledFor-feltet. */
export function suggestPublishTime(
  platform: MarketingPlanPost['primaryPlatform'],
  baseDate: Date = new Date(),
): { isoTimestamp: string; reason: string } | null {
  if (!platform) return null;
  const slots = OPTIMAL_TIMES[platform];
  if (!slots || slots.length === 0) return null;
  // Finn den nærmeste fremtidige slot.
  const now = baseDate.getTime();
  const candidates = slots.map((slot) => {
    // Bygg en kandidat for hver av de neste 14 dagene som matcher
    // dayOfWeek; ta den første som er strikt fremover i tid.
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const candidate = new Date(baseDate);
      candidate.setDate(baseDate.getDate() + dayOffset);
      if (candidate.getDay() !== slot.dayOfWeek) continue;
      candidate.setHours(slot.hour, slot.minute, 0, 0);
      if (candidate.getTime() > now) return { time: candidate, reason: slot.reason };
    }
    return null;
  }).filter((c): c is { time: Date; reason: string } => c !== null);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.time.getTime() - b.time.getTime());
  return {
    isoTimestamp: candidates[0].time.toISOString(),
    reason: candidates[0].reason,
  };
}

// ─────────────────────────────────────────────────────────────────────
// #160 — crosspost-plan med faktiske datoer
// Utleder reelle datoer fra primaryScheduledFor + delayDays per
// crosspost-entry. Tar høyde for at brukeren kan ha endret start-tid.
// ─────────────────────────────────────────────────────────────────────
export interface CrosspostScheduleEntry {
  platform: string;
  isoTimestamp: string;
  delayDays: number;
  adaptationNote?: string;
}

export function resolveCrosspostSchedule(
  primaryScheduledFor: string | null,
  crossPostPlan: MarketingPlanPost['crossPostPlan'],
): CrosspostScheduleEntry[] {
  if (!primaryScheduledFor || !Array.isArray(crossPostPlan)) return [];
  const baseTime = new Date(primaryScheduledFor).getTime();
  if (!Number.isFinite(baseTime)) return [];
  return crossPostPlan.map((entry) => {
    const offsetMs = (entry.delayDays ?? 0) * 24 * 60 * 60 * 1000;
    return {
      platform: entry.platform,
      delayDays: entry.delayDays ?? 0,
      isoTimestamp: new Date(baseTime + offsetMs).toISOString(),
      adaptationNote: entry.adaptationNote,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────
// #164 — hashtag-forslag
// Per-bransje + per-plattform. Begrenset til 5-7 hashtags fordi mer
// ikke gir algoritmisk løft (Meta sa det selv i 2024).
// ─────────────────────────────────────────────────────────────────────
const INDUSTRY_HASHTAGS: Record<string, string[]> = {
  'Restaurant og servering': ['#mat', '#oslomat', '#restaurant', '#foodie', '#middag', '#takeaway'],
  'Frisør og skjønnhet': ['#hår', '#frisør', '#beauty', '#hårinspirasjon', '#balayage'],
  'Trening og fitness': ['#trening', '#fitness', '#workout', '#norskefitfam', '#gym'],
  'Retail og handel': ['#shopping', '#nytt', '#tilbud', '#norsknetthandel', '#design'],
};

const PLATFORM_HASHTAGS: Record<NonNullable<MarketingPlanPost['primaryPlatform']>, string[]> = {
  instagram: ['#reels', '#instagood'],
  tiktok: ['#fyp', '#fypnorge', '#norsktiktok'],
  linkedin: [],   // LinkedIn-algoritme straffer hashtags
  youtube: ['#shorts'],
  facebook: [],
};

export function suggestHashtags(
  platform: MarketingPlanPost['primaryPlatform'],
  industry: string | null | undefined,
): string[] {
  const industryTags = (industry && INDUSTRY_HASHTAGS[industry]) ?? [];
  const platformTags = platform ? PLATFORM_HASHTAGS[platform] ?? [] : [];
  // Dedupe + cap at 7
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of [...industryTags, ...platformTags]) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 7) break;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// #166 — auto-foreslå CTA-link basert på hook-intent
// ─────────────────────────────────────────────────────────────────────
interface CtaTemplate {
  intent: string;
  pattern: RegExp;
  cta: string;
  linkMacro: string;
}

const CTA_TEMPLATES: CtaTemplate[] = [
  {
    intent: 'book',
    pattern: /\b(book|bestill bord|reserver|booking)\b/i,
    cta: 'Book ditt bord →',
    linkMacro: '{{bookingUrl}}',
  },
  {
    intent: 'kjøp',
    pattern: /\b(kjøp|tilbud|shop|handle|order|bestill nå)\b/i,
    cta: 'Bestill nå →',
    linkMacro: '{{shopUrl}}',
  },
  {
    intent: 'abonner',
    pattern: /\b(abonner|følg|subscribe|nyhetsbrev)\b/i,
    cta: 'Få oppdateringer →',
    linkMacro: '{{newsletterUrl}}',
  },
  {
    intent: 'kontakt',
    pattern: /\b(kontakt|spør|hjelp|konsultasjon|demo)\b/i,
    cta: 'Snakk med oss →',
    linkMacro: '{{contactUrl}}',
  },
  {
    intent: 'lær',
    pattern: /\b(lær|tips|guide|hvordan|slik)\b/i,
    cta: 'Les mer →',
    linkMacro: '{{blogUrl}}',
  },
];

export function suggestCtaTemplate(post: MarketingPlanPost): CtaTemplate | null {
  const text = `${post.hook ?? ''} ${post.callToAction ?? ''} ${post.captionDraft ?? ''}`.toLowerCase();
  for (const template of CTA_TEMPLATES) {
    if (template.pattern.test(text)) return template;
  }
  return null;
}
