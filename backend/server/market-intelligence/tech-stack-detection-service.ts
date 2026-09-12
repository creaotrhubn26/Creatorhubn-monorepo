/**
 * tech-stack-detection-service.ts
 *
 * Wappalyzer-light: detekterer 17 kategorier av tech-stack-signaler i HTML
 * via pattern-matching på script-tags, meta-tags, og kjente CDN-URL-er.
 *
 * Hver detection har:
 *   - category (en av TechStackCategory)
 *   - toolName (lesbart navn)
 *   - confidence (basert på pattern-spesifisitet)
 *   - evidence (snippet fra HTML der treffet ble funnet)
 */

import type { ConfidenceLevel, TechStackCategory } from './types.js';

interface TechStackRule {
  category: TechStackCategory;
  toolName: string;
  patterns: Array<{ rx: RegExp; weight: 'low' | 'medium' | 'high' }>;
}

const RULES: TechStackRule[] = [
  // ── CMS ────────────────────────────────────────────────
  { category: 'cms', toolName: 'WordPress',
    patterns: [
      { rx: /wp-content\/|wp-includes\/|<meta[^>]*generator[^>]*wordpress/i, weight: 'high' },
    ]},
  { category: 'cms', toolName: 'Shopify',
    patterns: [
      { rx: /cdn\.shopify\.com|shopify\.theme/i, weight: 'high' },
    ]},
  { category: 'cms', toolName: 'Webflow',
    patterns: [
      { rx: /webflow\.com|data-wf-domain/i, weight: 'high' },
    ]},
  { category: 'cms', toolName: 'Squarespace',
    patterns: [
      { rx: /squarespace\.com|static1\.squarespace/i, weight: 'high' },
    ]},
  { category: 'cms', toolName: 'Framer',
    patterns: [
      { rx: /framerstatic\.com|framerusercontent/i, weight: 'high' },
    ]},
  { category: 'cms', toolName: 'Wix',
    patterns: [
      { rx: /static\.wixstatic|wix-engineering/i, weight: 'high' },
    ]},
  { category: 'cms', toolName: 'HubSpot CMS',
    patterns: [
      { rx: /hs-scripts\.com|hubspotusercontent/i, weight: 'high' },
    ]},
  { category: 'cms', toolName: 'Sanity',
    patterns: [
      { rx: /cdn\.sanity\.io/i, weight: 'high' },
    ]},

  // ── Frontend frameworks ────────────────────────────────
  { category: 'frontend', toolName: 'Next.js',
    patterns: [
      { rx: /_next\/static\/|<meta[^>]*next-head-count/i, weight: 'high' },
    ]},
  { category: 'frontend', toolName: 'React',
    patterns: [
      { rx: /id=["']root["']|data-react-/i, weight: 'medium' },
    ]},
  { category: 'frontend', toolName: 'Vue',
    patterns: [
      { rx: /data-v-app|<div[^>]*id=["']app["']/i, weight: 'medium' },
    ]},
  { category: 'frontend', toolName: 'Svelte/SvelteKit',
    patterns: [
      { rx: /svelte-|data-sveltekit/i, weight: 'high' },
    ]},

  // ── Analytics ──────────────────────────────────────────
  { category: 'analytics', toolName: 'Google Analytics 4',
    patterns: [
      { rx: /googletagmanager\.com\/gtag\/js\?id=G-/i, weight: 'high' },
      { rx: /G-[A-Z0-9]{6,}/i, weight: 'medium' },
    ]},
  { category: 'analytics', toolName: 'Universal Analytics (legacy)',
    patterns: [
      { rx: /UA-\d{4,}-\d/i, weight: 'high' },
    ]},
  { category: 'analytics', toolName: 'Plausible',
    patterns: [
      { rx: /plausible\.io\/js|data-domain=["'][^"']+["'][^>]*plausible/i, weight: 'high' },
    ]},
  { category: 'analytics', toolName: 'Fathom',
    patterns: [
      { rx: /usefathom\.com|cdn\.usefathom/i, weight: 'high' },
    ]},
  { category: 'analytics', toolName: 'Matomo',
    patterns: [
      { rx: /matomo\.js|_paq\.push/i, weight: 'high' },
    ]},
  { category: 'analytics', toolName: 'Mixpanel',
    patterns: [
      { rx: /cdn\.mxpnl\.com|mixpanel\.init/i, weight: 'high' },
    ]},

  // ── Tag manager ────────────────────────────────────────
  { category: 'tag_manager', toolName: 'Google Tag Manager',
    patterns: [
      { rx: /GTM-[A-Z0-9]+/i, weight: 'high' },
      { rx: /googletagmanager\.com\/gtm\.js/i, weight: 'high' },
    ]},
  { category: 'tag_manager', toolName: 'Segment',
    patterns: [
      { rx: /analytics\.js|cdn\.segment\.com/i, weight: 'high' },
    ]},

  // ── CRM ────────────────────────────────────────────────
  { category: 'crm', toolName: 'HubSpot',
    patterns: [
      { rx: /js\.hs-scripts\.com|hubspot\.com\/forms/i, weight: 'high' },
    ]},
  { category: 'crm', toolName: 'Salesforce Pardot',
    patterns: [
      { rx: /pi\.pardot\.com|pardot\.com\/pd\.js/i, weight: 'high' },
    ]},
  { category: 'crm', toolName: 'Pipedrive',
    patterns: [
      { rx: /pipedrive\.com\/web-form/i, weight: 'high' },
    ]},

  // ── Email ──────────────────────────────────────────────
  { category: 'email', toolName: 'Mailchimp',
    patterns: [
      { rx: /chimpstatic\.com|list-manage\.com/i, weight: 'high' },
    ]},
  { category: 'email', toolName: 'ConvertKit',
    patterns: [
      { rx: /convertkit\.com|ck\.js/i, weight: 'high' },
    ]},
  { category: 'email', toolName: 'Klaviyo',
    patterns: [
      { rx: /klaviyo\.com\/onsite|static\.klaviyo/i, weight: 'high' },
    ]},

  // ── Ad pixels ──────────────────────────────────────────
  { category: 'ad_pixels', toolName: 'Meta Pixel (Facebook)',
    patterns: [
      { rx: /connect\.facebook\.net.*fbevents\.js|fbq\(['"]init/i, weight: 'high' },
    ]},
  { category: 'ad_pixels', toolName: 'LinkedIn Insight Tag',
    patterns: [
      { rx: /snap\.licdn\.com|_linkedin_data_partner_id/i, weight: 'high' },
    ]},
  { category: 'ad_pixels', toolName: 'TikTok Pixel',
    patterns: [
      { rx: /analytics\.tiktok\.com|ttq\.load/i, weight: 'high' },
    ]},
  { category: 'ad_pixels', toolName: 'Google Ads Conversion',
    patterns: [
      { rx: /googleadservices\.com\/pagead|AW-\d{6,}/i, weight: 'high' },
    ]},
  { category: 'ad_pixels', toolName: 'Snapchat Pixel',
    patterns: [
      { rx: /sc-static\.net\/scevent|snaptr\(/i, weight: 'high' },
    ]},

  // ── Chat ───────────────────────────────────────────────
  { category: 'chat_widget', toolName: 'Intercom',
    patterns: [
      { rx: /widget\.intercom\.io|Intercom\(['"]boot/i, weight: 'high' },
    ]},
  { category: 'chat_widget', toolName: 'Crisp',
    patterns: [
      { rx: /client\.crisp\.chat|\$crisp\.push/i, weight: 'high' },
    ]},
  { category: 'chat_widget', toolName: 'Drift',
    patterns: [
      { rx: /js\.driftt\.com|drift\.load/i, weight: 'high' },
    ]},
  { category: 'chat_widget', toolName: 'Tawk.to',
    patterns: [
      { rx: /embed\.tawk\.to/i, weight: 'high' },
    ]},

  // ── Booking ────────────────────────────────────────────
  { category: 'booking', toolName: 'Calendly',
    patterns: [
      { rx: /assets\.calendly\.com|calendly\.com\/\w+/i, weight: 'high' },
    ]},
  { category: 'booking', toolName: 'Cal.com',
    patterns: [
      { rx: /cal\.com\/\w+|app\.cal\.com\/embed/i, weight: 'high' },
    ]},
  { category: 'booking', toolName: 'SavvyCal',
    patterns: [
      { rx: /savvycal\.com\/\w+/i, weight: 'high' },
    ]},

  // ── Payment ────────────────────────────────────────────
  { category: 'payment', toolName: 'Stripe',
    patterns: [
      { rx: /js\.stripe\.com\/v\d|stripe\.com\/checkout/i, weight: 'high' },
    ]},
  { category: 'payment', toolName: 'Vipps',
    patterns: [
      { rx: /vipps\.no\/checkout|api\.vipps\.no/i, weight: 'high' },
    ]},
  { category: 'payment', toolName: 'Klarna',
    patterns: [
      { rx: /js\.klarna\.com|klarna-payments/i, weight: 'high' },
    ]},
  { category: 'payment', toolName: 'PayPal',
    patterns: [
      { rx: /paypal\.com\/sdk\/js/i, weight: 'high' },
    ]},

  // ── Form builder ───────────────────────────────────────
  { category: 'form_builder', toolName: 'Typeform',
    patterns: [
      { rx: /typeform\.com\/embed|tally\.so/i, weight: 'high' },
    ]},
  { category: 'form_builder', toolName: 'Jotform',
    patterns: [
      { rx: /form\.jotform\.com|jotform\.com\/jsform/i, weight: 'high' },
    ]},

  // ── Automation ─────────────────────────────────────────
  { category: 'automation', toolName: 'Zapier (embedded)',
    patterns: [
      { rx: /zapier\.com\/widget/i, weight: 'high' },
    ]},
  { category: 'automation', toolName: 'Make (Integromat)',
    patterns: [
      { rx: /make\.com\/integromat/i, weight: 'medium' },
    ]},

  // ── CDN ────────────────────────────────────────────────
  { category: 'cdn', toolName: 'Cloudflare',
    patterns: [
      { rx: /cdnjs\.cloudflare\.com|cdn\.cloudflare/i, weight: 'medium' },
    ]},
  { category: 'cdn', toolName: 'jsDelivr',
    patterns: [
      { rx: /cdn\.jsdelivr\.net/i, weight: 'medium' },
    ]},

  // ── Hosting (from response headers ideally; via HTML kun ledetråder) ─
  { category: 'hosting', toolName: 'Vercel',
    patterns: [
      { rx: /<meta[^>]*vercel|x-vercel-/i, weight: 'medium' },
    ]},
  { category: 'hosting', toolName: 'Netlify',
    patterns: [
      { rx: /netlify\.app|<meta[^>]*netlify/i, weight: 'medium' },
    ]},

  // ── SEO tools ──────────────────────────────────────────
  { category: 'seo_tools', toolName: 'Yoast SEO',
    patterns: [
      { rx: /Yoast SEO|yoast_wpseo/i, weight: 'high' },
    ]},
  { category: 'seo_tools', toolName: 'RankMath',
    patterns: [
      { rx: /rank[\s-]?math/i, weight: 'high' },
    ]},

  // ── A/B testing ────────────────────────────────────────
  { category: 'ab_testing', toolName: 'Optimizely',
    patterns: [
      { rx: /optimizely\.com\/optimizely/i, weight: 'high' },
    ]},
  { category: 'ab_testing', toolName: 'VWO',
    patterns: [
      { rx: /vwo\.com|dev\.visualwebsiteoptimizer/i, weight: 'high' },
    ]},

  // ── Heatmap ────────────────────────────────────────────
  { category: 'heatmap', toolName: 'Hotjar',
    patterns: [
      { rx: /static\.hotjar\.com|hj\.q/i, weight: 'high' },
    ]},
  { category: 'heatmap', toolName: 'Microsoft Clarity',
    patterns: [
      { rx: /clarity\.ms|microsoft.*clarity/i, weight: 'high' },
    ]},
];

export interface DetectedTechStackTool {
  category: TechStackCategory;
  toolName: string;
  confidence: ConfidenceLevel;
  evidence: string | null;
}

function weightToConfidence(
  hits: Array<'low' | 'medium' | 'high'>,
): ConfidenceLevel {
  if (hits.length === 0) return 'low';
  if (hits.some((h) => h === 'high')) {
    return hits.length >= 2 ? 'high' : 'high';
  }
  if (hits.some((h) => h === 'medium')) return 'medium';
  return 'low';
}

/** Skann HTML for kjente tech-stack-signaler. Returnerer kun treff. */
export function detectTechStack(html: string): DetectedTechStackTool[] {
  const out: DetectedTechStackTool[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
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

    if (hits.length > 0) {
      const key = `${rule.category}:${rule.toolName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        category: rule.category,
        toolName: rule.toolName,
        confidence: weightToConfidence(hits),
        evidence,
      });
    }
  }

  return out;
}
