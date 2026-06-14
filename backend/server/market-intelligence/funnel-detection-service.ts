/**
 * funnel-detection-service.ts
 *
 * Pattern-basert deteksjon av 11 funnel-stadier. For hver konkurrent
 * returnerer vi om stadiet er "detected" (HTML-mønster funnet) eller
 * "not detected" (= opportunity for produsenten å fylle hullet).
 */

import {
  ALL_FUNNEL_STAGES,
  FUNNEL_STAGE_EXPLAIN,
  FUNNEL_STAGE_LABELS,
  type FunnelStageKey,
  type ConfidenceLevel,
} from './types.js';

interface RawFunnelStageResult {
  stage: FunnelStageKey;
  label: string;
  explanation: string;
  detected: boolean;
  confidence: ConfidenceLevel;
  evidence: string | null;
  recommendedAction: string;
}

interface StagePattern {
  patterns: Array<{ rx: RegExp; weight: 'low' | 'medium' | 'high' }>;
  recommendation: string;
}

const STAGE_RULES: Record<FunnelStageKey, StagePattern> = {
  awareness: {
    // Awareness er vanskelig å verifisere fra HTML alene. Vi proxy-er det
    // via "har siden SEO-grunnlag" (meta description, OG-tags).
    patterns: [
      { rx: /<meta[^>]*name=["']description["']/i, weight: 'medium' },
      { rx: /<meta[^>]*property=["']og:title["']/i, weight: 'medium' },
    ],
    recommendation: 'Optimaliser landings-side for organisk søk + sosiale shares (OG-tags).',
  },
  landing_page: {
    patterns: [
      { rx: /<h1[^>]*>/i, weight: 'high' },
      { rx: /class=["'][^"']*(hero|landing|above[-_]?fold)/i, weight: 'high' },
    ],
    recommendation: 'Sett opp dedikerte landingssider per kampanje/annonse.',
  },
  lead_magnet: {
    patterns: [
      { rx: /(?:last ned|download)[\s\S]{0,30}(?:gratis|free|guide|pdf|sjekkliste|checklist)/i, weight: 'high' },
      { rx: /gated[-_]?content|opt[-_]?in[-_]?form/i, weight: 'high' },
    ],
    recommendation: 'Tilby en konkret lead magnet (sjekkliste/guide/quiz) på landingssiden.',
  },
  signup: {
    patterns: [
      { rx: /(?:sign\s?up|registrer|opprett konto|create account)/i, weight: 'high' },
      { rx: /<form[^>]*(?:signup|register|join)/i, weight: 'high' },
    ],
    recommendation: 'Gjør signup synlig i header og hero — uten å skjule den bak en undermeny.',
  },
  demo_booking: {
    patterns: [
      { rx: /book[\s-]+(?:a[\s-]+)?demo|book[\s-]+demo|book[\s-]+møte/i, weight: 'high' },
      { rx: /(?:calendly|cal\.com|savvycal|hubspot.*meeting)/i, weight: 'high' },
    ],
    recommendation: 'Embed en kalender-link slik at leads booker demo selv (uten ping-pong).',
  },
  email_nurture: {
    patterns: [
      { rx: /(?:newsletter|nyhetsbrev|e?-?mail[\s-]?serie)/i, weight: 'medium' },
      { rx: /mailchimp|convertkit|klaviyo|hubspot/i, weight: 'medium' },
    ],
    recommendation: 'Sett opp en 5-email automatisk serie etter signup som warmer opp leads.',
  },
  retargeting: {
    patterns: [
      { rx: /fbq\(['"]init|facebook.*fbevents|connect\.facebook\.net/i, weight: 'high' },
      { rx: /googleadservices\.com|AW-\d{6,}|snap\.licdn\.com/i, weight: 'high' },
    ],
    recommendation: 'Installer Meta Pixel + LinkedIn Insight Tag for å kunne retargetere besøkende.',
  },
  checkout: {
    patterns: [
      { rx: /(?:checkout|kasse|cart|handlekurv|kjøp nå)/i, weight: 'high' },
      { rx: /stripe\.com|js\.stripe|vipps|klarna/i, weight: 'high' },
    ],
    recommendation: 'Forenkle checkout — fjern alle felt som ikke er strengt nødvendige.',
  },
  upsell: {
    patterns: [
      { rx: /(?:upgrade|oppgrader|enterprise|pro plan|premium plan)/i, weight: 'medium' },
      { rx: /(?:bundle|pakke).*(?:rabatt|discount|spar)/i, weight: 'high' },
    ],
    recommendation: 'Tilby en oppgrade- eller bundle-mulighet umiddelbart etter første kjøp.',
  },
  community: {
    patterns: [
      { rx: /(?:discord|slack|circle\.so|community|forum)/i, weight: 'high' },
      { rx: /class=["'][^"']*(community|forum|members)/i, weight: 'medium' },
    ],
    recommendation: 'Bygg en privat community (Discord/Slack/Circle) der kunder snakker sammen.',
  },
  referral: {
    patterns: [
      { rx: /(?:referral|anbefal en venn|inviter venn|refer[\s-]a[\s-]friend)/i, weight: 'high' },
      { rx: /(?:referral[\s-]?bonus|kr per anbefaling)/i, weight: 'high' },
    ],
    recommendation: 'Sett opp en referral-belønning som gir både den som anbefaler og den nye en fordel.',
  },
};

function combineConfidence(hits: Array<'low' | 'medium' | 'high'>): ConfidenceLevel {
  if (hits.length === 0) return 'low';
  if (hits.some((h) => h === 'high')) return 'high';
  if (hits.some((h) => h === 'medium')) return 'medium';
  return 'low';
}

export function detectFunnelStages(html: string): RawFunnelStageResult[] {
  const out: RawFunnelStageResult[] = [];

  for (const stage of ALL_FUNNEL_STAGES) {
    const rule = STAGE_RULES[stage];
    const hits: Array<'low' | 'medium' | 'high'> = [];
    let evidence: string | null = null;

    for (const p of rule.patterns) {
      const m = html.match(p.rx);
      if (m) {
        hits.push(p.weight);
        if (!evidence && m[0].length < 200) {
          evidence = m[0].slice(0, 120);
        }
      }
    }

    const detected = hits.length > 0;

    out.push({
      stage,
      label: FUNNEL_STAGE_LABELS[stage],
      explanation: FUNNEL_STAGE_EXPLAIN[stage],
      detected,
      confidence: combineConfidence(hits),
      evidence,
      recommendedAction: rule.recommendation,
    });
  }

  return out;
}
