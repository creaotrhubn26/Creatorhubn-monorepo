/**
 * "Honest scaffolding" for features som krever ekstern infra vi ikke
 * eier (creator-databaser, stock-image-APIs, bildegenerering, social
 * insights-data). I stedet for å fake data:
 *
 *   #165 Influencer-forslag → build link til Klear/HypeAuditor-søk
 *   #167 B-roll/stock → build Unsplash/Pexels-søkeURL
 *   #168 Thumbnail-konsept → generer beskrivende tekst (ingen bilde)
 *   #169 Estimert reach → return null + "krever connected account"-state
 *
 * Brukeren får handlingsrettet output uten at vi later som vi har data
 * vi ikke har.
 */

import type { MarketingPlanPost } from '../services/roleRoomAgentService';

// ─────────────────────────────────────────────────────────────────────
// #165 — influencer-søkelink
// Klear og HypeAuditor er to av de største creator-discovery-plattformene.
// Vi konstruerer søke-URL basert på post-emne + bransje.
// ─────────────────────────────────────────────────────────────────────
export interface InfluencerSearchLink {
  platform: 'klear' | 'modash' | 'norwegian_manual';
  url: string;
  label: string;
  rationale: string;
}

export function buildInfluencerSearchLinks(
  post: MarketingPlanPost,
  industry: string | null,
): InfluencerSearchLink[] {
  const keywords = [post.hook, industry]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .join(' ')
    .toLowerCase()
    .replace(/[^\w\s]+/g, ' ')
    .trim();
  const query = encodeURIComponent(keywords);
  const platform = post.primaryPlatform === 'tiktok' ? 'tiktok' : 'instagram';

  return [
    {
      platform: 'klear',
      url: `https://klear.com/search?q=${query}&platform=${platform}&country=Norway`,
      label: 'Søk i Klear (paid)',
      rationale: 'Klear: norsk-spesifikk filtrering + audit-data per influencer.',
    },
    {
      platform: 'modash',
      url: `https://modash.io/search?q=${query}&platform=${platform}&location=NO`,
      label: 'Søk i Modash',
      rationale: 'Modash: 250M+ creators, gratis tier for små søk.',
    },
    {
      platform: 'norwegian_manual',
      url: `https://www.${platform === 'instagram' ? 'instagram' : 'tiktok'}.com/explore/tags/${keywords.split(/\s+/)[0] ?? 'norge'}/`,
      label: `Manuell ${platform}-hashtag-utforsk`,
      rationale: 'Direkte-utforsk relevante hashtags for å finne ekte norske skapere.',
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────
// #167 — stock-image-søk
// Unsplash og Pexels har gratis APIs men også gratis web-søk uten API-key.
// ─────────────────────────────────────────────────────────────────────
export interface StockSearchLink {
  platform: 'unsplash' | 'pexels' | 'pixabay';
  url: string;
  label: string;
}

export function buildStockSearchLinks(post: MarketingPlanPost): StockSearchLink[] {
  // Bruk hook-keywords som søk. Vi prøver å trekke ut substantiver
  // ved å filtrere bort vanlige norske stoppord — uperfekt men nyttig.
  const stopwords = new Set([
    'og', 'i', 'på', 'for', 'med', 'er', 'å', 'av', 'til', 'som', 'den',
    'det', 'en', 'et', 'vi', 'du', 'ikke', 'har', 'kan', 'vil', 'skal',
    'fra', 'om', 'før', 'etter', 'over', 'under',
  ]);
  const words = (post.hook ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopwords.has(w))
    .slice(0, 3);
  const query = encodeURIComponent(words.join(' ') || 'norway business');
  return [
    {
      platform: 'unsplash',
      url: `https://unsplash.com/s/photos/${query}`,
      label: 'Søk på Unsplash (gratis)',
    },
    {
      platform: 'pexels',
      url: `https://www.pexels.com/search/${query}/`,
      label: 'Søk på Pexels (gratis)',
    },
    {
      platform: 'pixabay',
      url: `https://pixabay.com/images/search/${query}/`,
      label: 'Søk på Pixabay (gratis)',
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────
// #168 — thumbnail-konsept (tekstbeskrivelse, ikke faktisk bilde)
// Vi har ikke bildegenerering, men en konkret konsept-beskrivelse for
// designer er ofte mer verdt enn et middelmådig auto-generert bilde.
// ─────────────────────────────────────────────────────────────────────
export interface ThumbnailConcept {
  composition: string;
  textOverlay: string;
  moodKeywords: string[];
  colorHints: string[];
}

export function buildThumbnailConcept(
  post: MarketingPlanPost,
  brandPrimaryHex: string | null,
  brandAccentHex: string | null,
): ThumbnailConcept | null {
  if (post.format !== 'reel' && post.format !== 'tiktok' && post.format !== 'youtube_short') {
    return null; // bare relevant for video-thumbnails
  }
  const isQuestion = /\?/.test(post.hook ?? '');
  const isAction = /\b(slik|hvordan|test|prøv)\b/i.test(post.hook ?? '');
  return {
    composition: isQuestion
      ? 'Person ser direkte i kamera, ansikt 60% av bilderute, åpen-munn-uttrykk for å signalisere spørsmål.'
      : isAction
        ? 'Hands-only shot eller over-the-shoulder, fokus på handlingen som beskrives i hooken.'
        : 'Closeup på produkt/situasjon med tydelig kontrast mot bakgrunn.',
    textOverlay: post.hook?.slice(0, 40) ?? 'Tekst-overlay basert på hook',
    moodKeywords: post.format === 'tiktok'
      ? ['dynamisk', 'kjapp', 'autentisk']
      : ['polert', 'klar-fokus', 'profesjonell'],
    colorHints: [brandPrimaryHex, brandAccentHex].filter((c): c is string => c !== null && c.length > 0),
  };
}

// ─────────────────────────────────────────────────────────────────────
// #169 — estimert reach
// Vi har ikke historisk data per konto. Returnerer honest CTA-state.
// ─────────────────────────────────────────────────────────────────────
export interface ReachEstimate {
  available: false;
  reason: string;
  ctaLabel: string;
  ctaHref: string;
}

export function getReachEstimate(post: MarketingPlanPost): ReachEstimate {
  const platform = post.primaryPlatform ?? 'instagram';
  const connectMessages: Record<string, { reason: string; ctaLabel: string; ctaHref: string }> = {
    instagram: {
      reason: 'Krever koblet Instagram Business-konto for å hente historiske impressions.',
      ctaLabel: 'Koble Instagram',
      ctaHref: '/api/role-room/instagram/oauth/start',
    },
    facebook: {
      reason: 'Krever koblet Facebook Page for å hente historiske impressions.',
      ctaLabel: 'Koble Facebook',
      ctaHref: '/api/role-room/instagram/oauth/start',
    },
    linkedin: {
      reason: 'Krever koblet LinkedIn-side for å hente historiske impressions.',
      ctaLabel: 'Koble LinkedIn',
      ctaHref: '/api/role-room/linkedin/oauth/start',
    },
    tiktok: {
      reason: 'TikTok Business API ikke ennå koblet for dette prosjektet.',
      ctaLabel: 'TikTok-tilkobling kommer',
      ctaHref: '#',
    },
    youtube: {
      reason: 'YouTube Analytics ikke koblet for dette prosjektet.',
      ctaLabel: 'YouTube-tilkobling kommer',
      ctaHref: '#',
    },
  };
  const cfg = connectMessages[platform] ?? connectMessages.instagram;
  return {
    available: false,
    reason: cfg.reason,
    ctaLabel: cfg.ctaLabel,
    ctaHref: cfg.ctaHref,
  };
}
