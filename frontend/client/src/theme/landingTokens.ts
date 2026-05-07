/**
 * landingTokens — design-tokens trukket ut fra landing-page
 * (CreatorHubInvestorLanding) så dashboards og BI-flater kan dele
 * samme språk: warm cream/orange aksent på dyp navy/charcoal.
 *
 * Brukes i UniversalDashboard hero, BusinessIntelligenceHub-kort, og
 * andre top-level surfaces hvor vi vil signalisere "samme produkt
 * som landing-siden". Resten av appen beholder sin lyse arbeidsflate
 * (cream/peach) — kontrasten er bevisst.
 */

export const landingTokens = {
  // Hovedfarger — direkte fra CreatorHubInvestorLanding.tsx
  surfaceDeep: '#05060a',
  surfaceMid: 'rgba(5,6,10,0.94)',
  surfaceSoft: 'rgba(5,6,10,0.58)',
  ink: '#f6f2ea',
  inkSoft: '#fbf5ee',
  inkMuted: 'rgba(246,242,234,0.66)',
  inkSubtle: 'rgba(246,242,234,0.42)',

  // Aksent (warm orange — CreatorHub-investor-feel)
  accent: '#ffba6c',
  accentBright: '#fff5e8',
  accentDeep: '#da7831',

  // Gradient som driver hero-overlays (radial + linear-stack)
  heroGradient:
    'radial-gradient(circle at top right, rgba(255,163,72,0.22), transparent 32%), ' +
    'radial-gradient(circle at left 20%, rgba(218,120,49,0.14), transparent 36%), ' +
    '#05060a',

  // Mer subtil variant for kort på lys bakgrunn — bruker samme aksent
  // men med transparent-overlay over hvit/krem for å bevare lesbarhet.
  accentOverlay: 'rgba(255,186,108,0.12)',
  accentBorder: 'rgba(255,186,108,0.28)',

  // Typografi-tokens
  letterSpacingLabel: '0.06em',
  fontWeightDisplay: 700,
  fontWeightLabel: 600,

  // Border-radius — landing bruker 12-16px-skala
  radiusCard: 16,
  radiusButton: 12,
  radiusChip: 999, // pill
} as const;

/**
 * Stil-blokk for "hero card" — den vannrette toppstripen som
 * UniversalDashboard kan bruke som velkomst/branding-bånd. Mørk
 * navy med warm orange aksent. Funker både inline-spread og som
 * sx-prop:  `<Box sx={landingHeroSx}>...`
 */
export const landingHeroSx = {
  borderRadius: `${landingTokens.radiusCard}px`,
  background: landingTokens.heroGradient,
  color: landingTokens.ink,
  px: { xs: 3, md: 4 },
  py: { xs: 3, md: 4 },
  position: 'relative' as const,
  overflow: 'hidden' as const,
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    right: 0,
    width: 200,
    height: '100%',
    background:
      'linear-gradient(120deg, transparent 0%, rgba(255,186,108,0.06) 60%, transparent 100%)',
    pointerEvents: 'none',
  },
};

/**
 * KPI-kort-stil for "premium" varianten — bruker samme aksentpalett
 * men på mørk overflate. Brukbar for BI-hub når vi vil signalisere
 * "investor-rapport-feel" istedenfor standard arbeidsflate.
 */
export const landingKpiCardSx = {
  borderRadius: `${landingTokens.radiusCard}px`,
  bgcolor: landingTokens.surfaceDeep,
  color: landingTokens.ink,
  border: `1px solid ${landingTokens.accentBorder}`,
  p: 2.5,
  position: 'relative' as const,
  overflow: 'hidden' as const,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    background: `radial-gradient(circle, ${landingTokens.accent}20 0%, transparent 70%)`,
    pointerEvents: 'none',
  },
};
