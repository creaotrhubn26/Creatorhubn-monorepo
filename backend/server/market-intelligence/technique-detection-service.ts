/**
 * technique-detection-service.ts
 *
 * Pattern-basert deteksjon av 26 markedsføringsteknikker fra HTML.
 *
 * Filosofi: bare presenter høy-konfidens treff som "detected: true". Lav
 * konfidens = detected: false med forklaring. Aldri gjett.
 *
 * For hver teknikk har vi en eller flere regex/substring-mønstre. Hvis ≥1
 * mønster treffer → 'detected = true' med confidence basert på antall treff
 * og pattern-spesifisitet.
 */

import { TECHNIQUE_CATALOG, type TechniqueKey, type ConfidenceLevel } from './types.js';

interface RawTechniqueResult {
  technique: TechniqueKey;
  label: string;
  simpleExplanation: string;
  whyItMatters: string;
  detected: boolean;
  confidence: ConfidenceLevel;
  evidence: string | null;
  recommendedNextStep: string;
}

/** Pattern-bibliotek. Hver teknikk har patterns + en "recommended next step"
 *  som brukes ved 'detected: false' (= dette mangler hos konkurrenten,
 *  potensielt opportunity for produsenten). */
const PATTERNS: Record<TechniqueKey, {
  patterns: Array<{ rx: RegExp; weight: 'low' | 'medium' | 'high' }>;
  recommendation: string;
}> = {
  testimonials: {
    patterns: [
      { rx: /testimonial[s]?["'\s>]/i, weight: 'high' },
      { rx: /class=["'][^"']*(testimonial|customer-quote|reviews?-card)/i, weight: 'high' },
      { rx: /<blockquote[^>]*>/i, weight: 'low' },
    ],
    recommendation: 'Legg til 3–5 konkrete testimonials med navn + bilde nær kjøps-CTA.',
  },
  logo_wall: {
    patterns: [
      { rx: /(?:trusted by|som brukes av|våre kunder|as featured in|featured in)/i, weight: 'high' },
      { rx: /class=["'][^"']*(logo[-_]?wall|client[-_]?logos?|partners?[-_]?grid)/i, weight: 'high' },
    ],
    recommendation: 'Vis logoer fra 4–8 anerkjente kunder eller medie-omtaler over folden.',
  },
  reviews: {
    patterns: [
      { rx: /(\d+(?:[.,]\d)?)\s*(?:av|out of|\/)\s*5/i, weight: 'high' },
      { rx: /(\d+(?:[.,]\d)?)\s*\*\s*(?:rating|stars|stjerner)/i, weight: 'high' },
      { rx: /class=["'][^"']*(stars?|rating)[^"']*["']/i, weight: 'medium' },
    ],
    recommendation: 'Samle minst 50 verifiserte anmeldelser før du fremhever stjerne-score.',
  },
  case_studies: {
    patterns: [
      { rx: /case[-_\s]stud(?:y|ies)/i, weight: 'high' },
      { rx: /(?:kundehistori|suksesshistori|customer[-_\s]stor)/i, weight: 'high' },
    ],
    recommendation: 'Publiser 1–3 detaljerte case-studier med kvantitative resultater.',
  },
  limited_time_offer: {
    patterns: [
      { rx: /limited[-_\s]time|tids[-_\s]?begrenset|nå til (?:fre|fredag|31\.|kun)/i, weight: 'high' },
      { rx: /(?:rabatt|discount|spar)\s+\d+\s*%/i, weight: 'medium' },
    ],
    recommendation: 'Test en tidsbegrenset rabatt med klar dato — fjern den når den utløper.',
  },
  scarcity: {
    patterns: [
      { rx: /(?:bare|kun)\s+\d+\s+(?:plasser|igjen|på lager|sete)/i, weight: 'high' },
      { rx: /(?:only|last)\s+\d+\s+(?:left|seats|spots)/i, weight: 'high' },
    ],
    recommendation: 'Vis "X plasser igjen" når det er reelt — aldri jukse.',
  },
  urgency: {
    patterns: [
      { rx: /countdown|nedtelling|tilbudet (?:utløper|går ut)/i, weight: 'high' },
      { rx: /<[^>]*data-countdown/i, weight: 'high' },
    ],
    recommendation: 'Legg til nedtellingsklokke på pris/checkout-side ved kampanjer.',
  },
  sticky_cta: {
    patterns: [
      { rx: /position\s*:\s*sticky/i, weight: 'medium' },
      { rx: /class=["'][^"']*(sticky[-_]?cta|floating[-_]?cta|bottom[-_]?bar)/i, weight: 'high' },
    ],
    recommendation: 'Mount en sticky CTA-knapp som følger med ved scrolling.',
  },
  exit_intent_popup: {
    patterns: [
      { rx: /exit[-_]?intent/i, weight: 'high' },
      { rx: /mouseleave[\s]*=>|mouseout.*popup/i, weight: 'medium' },
    ],
    recommendation: 'Vurder en exit-intent popup med lead magnet (ikke for invasiv).',
  },
  newsletter_capture: {
    patterns: [
      { rx: /newsletter|nyhetsbrev/i, weight: 'high' },
      { rx: /<input[^>]*type=["']email["'][^>]*newsletter/i, weight: 'high' },
    ],
    recommendation: 'Tilby tydelig newsletter-form med konkret nytte (ikke "abonner").',
  },
  quiz_funnel: {
    patterns: [
      { rx: /(?:start[\s-]+quiz|take the quiz|ta quizen)/i, weight: 'high' },
      { rx: /class=["'][^"']*quiz[-_]/i, weight: 'medium' },
    ],
    recommendation: 'Test en 5-spørsmåls-quiz som anbefaler riktig plan/produkt.',
  },
  calculator_funnel: {
    patterns: [
      { rx: /(?:calculator|kalkulator|ROI[-\s]?calculator|pris[-\s]?kalk)/i, weight: 'high' },
    ],
    recommendation: 'Bygg en kalkulator som viser sparing/ROI med kundens egne tall.',
  },
  free_audit: {
    patterns: [
      { rx: /(?:gratis|free)\s+(?:audit|analyse|sjekk|review)/i, weight: 'high' },
    ],
    recommendation: 'Tilby en gratis sjekk/audit som lead magnet — leveres innen 48 timer.',
  },
  free_trial: {
    patterns: [
      { rx: /(?:gratis|free)[\s-]+(?:tri[al|el]|prøveperiode|prøve)/i, weight: 'high' },
      { rx: /start[\s-]+(?:14|7|30)[\s-]?day/i, weight: 'high' },
    ],
    recommendation: 'Tilby 14 dagers gratis prøveperiode uten kortkrav.',
  },
  demo_booking: {
    patterns: [
      { rx: /book[\s-]+(?:a[\s-]+)?demo|book[\s-]+demo/i, weight: 'high' },
      { rx: /(?:calendly|cal\.com|savvycal|hubspot.*meetings)/i, weight: 'high' },
    ],
    recommendation: 'Embed en Calendly/Cal.com-link så besøkende booker demo selv.',
  },
  checklist_download: {
    patterns: [
      { rx: /(?:gratis|free|last ned)[\s\S]{0,30}(?:sjekkliste|checklist|guide|pdf)/i, weight: 'high' },
    ],
    recommendation: 'Lag en konkret 1-siders sjekkliste som gates bak e-post.',
  },
  webinar_signup: {
    patterns: [
      { rx: /(?:webinar|webinarpåmelding)/i, weight: 'high' },
    ],
    recommendation: 'Test et månedlig webinar med både live + on-demand-versjon.',
  },
  comparison_page: {
    patterns: [
      { rx: /\bvs\.?\s+[A-Z][a-z]+/i, weight: 'medium' },
      { rx: /sammenligning|comparison/i, weight: 'medium' },
    ],
    recommendation: 'Bygg "X vs Y"-sider for de 2–3 viktigste konkurrentene.',
  },
  alternative_to_page: {
    patterns: [
      { rx: /alternativ(?:er)? til|alternative to/i, weight: 'high' },
    ],
    recommendation: 'Bygg "alternativ til [konkurrent]"-sider for SEO på frustrerte kunder.',
  },
  pricing_anchor: {
    patterns: [
      { rx: /enterprise[\s\S]{0,30}(?:kontakt|contact|custom)/i, weight: 'medium' },
      { rx: /(?:most popular|mest populær|anbefalt)/i, weight: 'high' },
    ],
    recommendation: 'Legg til en "Enterprise"-plan eller fremhev en plan som "Mest populær".',
  },
  guarantee: {
    patterns: [
      { rx: /(?:pengene[\s-]+tilbake|money[\s-]+back|garantee|garanti)/i, weight: 'high' },
      { rx: /\b(?:14|30|60|90)[\s-]?dager?[\s-]+(?:garanti|refund)/i, weight: 'high' },
    ],
    recommendation: 'Legg til en 30-dagers pengene-tilbake-garanti der det er mulig.',
  },
  faq: {
    patterns: [
      { rx: /<(?:h[1-6]|div|section)[^>]*>\s*(?:faq|vanlige spørsmål|spørsmål og svar|frequently asked)/i, weight: 'high' },
    ],
    recommendation: 'Adresser de 6–10 vanligste innvendingene i en FAQ-seksjon.',
  },
  social_proof: {
    patterns: [
      { rx: /(\d+[,.]?\d*\+?)\s*(?:kunder|customers|aktive brukere|active users|brands?)/i, weight: 'high' },
    ],
    recommendation: 'Vis konkrete tall ("X kunder", "Y omtaler") — uten tall blir det fluff.',
  },
  local_seo_pages: {
    patterns: [
      { rx: /\/(?:oslo|bergen|trondheim|stavanger|tromsø)/i, weight: 'high' },
    ],
    recommendation: 'Bygg dedikerte sider per by der du opererer for lokal SEO.',
  },
  founder_content: {
    patterns: [
      { rx: /(?:from the founder|fra grunderen|founder['']s note|mvh gründer)/i, weight: 'high' },
    ],
    recommendation: 'La grunderen være synlig — video-intro, signert nyhetsbrev, eller "om oss".',
  },
  customer_stories: {
    patterns: [
      { rx: /(?:customer stor(?:y|ies)|kundehistorie|hvordan .{1,30} (?:doblet|tjente|spart))/i, weight: 'high' },
    ],
    recommendation: 'Publiser 3 detaljerte kundehistorier med tall + sitater.',
  },
  tutorials: {
    patterns: [
      { rx: /(?:tutorial|guide|how[\s-]to|hvordan)/i, weight: 'low' },
      { rx: /class=["'][^"']*(tutorial|guide|lesson)/i, weight: 'medium' },
    ],
    recommendation: 'Bygg ut en tutorial-seksjon for SEO + on-boarding-verdi.',
  },
};

function combineConfidence(hits: Array<'low' | 'medium' | 'high'>): ConfidenceLevel {
  if (hits.length === 0) return 'low';
  const highCount = hits.filter((h) => h === 'high').length;
  const medCount = hits.filter((h) => h === 'medium').length;
  if (highCount >= 2 || (highCount >= 1 && medCount >= 1)) return 'high';
  if (highCount >= 1 || medCount >= 2) return 'medium';
  return 'low';
}

/** Detekter alle 26 teknikker i en gitt HTML-streng. */
export function detectTechniques(html: string): RawTechniqueResult[] {
  const results: RawTechniqueResult[] = [];

  for (const spec of TECHNIQUE_CATALOG) {
    const entry = PATTERNS[spec.key];
    const hits: Array<'low' | 'medium' | 'high'> = [];
    const evidenceSnippets: string[] = [];

    for (const p of entry.patterns) {
      const m = html.match(p.rx);
      if (m) {
        hits.push(p.weight);
        if (evidenceSnippets.length < 2 && m[0].length < 200) {
          evidenceSnippets.push(m[0].slice(0, 120));
        }
      }
    }

    const detected = hits.length > 0;
    const confidence = combineConfidence(hits);

    results.push({
      technique: spec.key,
      label: spec.label,
      simpleExplanation: spec.simpleExplanation,
      whyItMatters: spec.whyItMatters,
      detected,
      confidence,
      evidence: evidenceSnippets.length > 0 ? evidenceSnippets.join(' · ') : null,
      recommendedNextStep: entry.recommendation,
    });
  }

  return results;
}
