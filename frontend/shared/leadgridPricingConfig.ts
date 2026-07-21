/**
 * leadgridPricingConfig.ts — KANONISK form + default for Leadgrid pris-config.
 *
 * Én sannhetskilde for typen og fallback-verdiene. Importeres av:
 *   • frontend/client/src/pages/leadgrid-landing.tsx       (leser + fallback)
 *   • frontend/client/src/components/admin/LeadgridPricingConfigPanel.tsx (editor)
 *
 * ⚠️ SPEIL-KOPIER som IKKE kan importere denne fila (andre build-targets),
 *    og som MÅ oppdateres manuelt hvis formen her endres:
 *   • backend/server/leadgrid-pricing-config-routes.ts  (PricingConfig +
 *     DEFAULT_PRICING_CONFIG + validate()) — runtime-kilde. Dekket av
 *     kontrakttesten leadgrid-pricing-config.contract.test.ts (feiler ved drift).
 *   • ipad/LeadMapApp/LeadMapApp/Core/APIClient+LeadgridPricing.swift (Codable-DTO-er)
 *
 * Nøklene er camelCase (priceNote/priceSoloPro/priceAgency) — backend serverer
 * og validerer nøyaktig disse; ikke bytt til snake_case.
 */

export interface PricingTier {
  key: string;
  name: string;
  price: number;
  tagline: string;
  priceNote: string;
  popular: boolean;
  cta: string;
  features: string[];
}

export interface PricingModule {
  key: string;
  title: string;
  desc: string;
  priceSoloPro: number;
  priceAgency: number;
  accent: string;
  active: boolean;
}

export interface LeadgridPricingConfig {
  tiers: PricingTier[];
  modules: PricingModule[];
  bundle: { active: boolean; priceAgency: number; label: string };
}

// Default = dagens tiers + research-forankrede modul-priser (2026).
// Super-admin kan overstyre alt via editoren; dette er kun fallback/seed.
export const DEFAULT_PRICING_CONFIG: LeadgridPricingConfig = {
  tiers: [
    {
      key: 'free', name: 'Solo Free', price: 0, popular: false, cta: 'Start gratis',
      tagline: 'Gratis for solo-selgere. Kom i gang på 2 min.',
      priceNote: 'Ingen kortkrav, ingen binding.',
      features: ['1 kunde · 3 auto-onboards/mnd', 'Kart, Kanban og filtre', 'Native iPad-app', 'Intelligence + Momentum Engine'],
    },
    {
      key: 'pro', name: 'Solo Pro', price: 799, popular: true, cta: 'Start gratis',
      tagline: 'Full Leadgrid for én selger — alle AI-features.',
      priceNote: 'Rimeligere ved årlig fakturering. Ingen binding.',
      features: ['Alt i Solo Free', 'Forecasting + Market Scan', 'Voice Memo + AI-møtenotater', '1 000 AI-kall/mnd'],
    },
    {
      key: 'agency', name: 'Agency', price: 2999, popular: false, cta: 'Kontakt oss',
      tagline: 'For salgs-team med flere selgere.',
      priceNote: 'Rimeligere ved årlig fakturering. Ingen binding.',
      features: ['Alt i Solo Pro', 'Multi-bruker (5 inkl.) + team-roller', 'Territorie-grids m/ geofence', 'White-label klient-portal'],
    },
  ],
  modules: [
    { key: 'dorsalg', title: 'Dørsalg & verving', desc: 'Adressekart, salg på døra med kundebekreftelse, dagsmål og team-oppfølging.', priceSoloPro: 490, priceAgency: 990, accent: '#c084fc', active: true },
    { key: 'kvalitet', title: 'Kvalitet', desc: 'Verifiseringskø, samtale-maler og kvalitetsgrad per selger — stol på tallene.', priceSoloPro: 390, priceAgency: 790, accent: '#5eead4', active: true },
    { key: 'go', title: 'Leadgrid Go', desc: 'Automatisk kjørebok, kjøregodtgjørelse, flåte og bilbooking for hele teamet.', priceSoloPro: 249, priceAgency: 690, accent: '#7ab8ff', active: true },
  ],
  bundle: { active: true, priceAgency: 1490, label: 'Alle tre moduler på Agency' },
};
