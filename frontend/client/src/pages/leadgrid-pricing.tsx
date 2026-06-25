/**
 * leadgrid-pricing.tsx — dedikert pricing-side for Leadgrid
 *
 * 3 tiers (Solo Free / Solo Pro 799 / Agency 2999) + yearly/monthly
 * toggle (−19% rabatt på årlig), feature-matrise, pricing-calculator,
 * competitor-matrix og FAQ.
 *
 * Visuelt språk: samme warm-dark + lilla accent som leadgrid-landing
 * (PALETTE), bruker MUI for konsistens med resten av prosjektet.
 *
 * Stripe-keys (allerede satt på Render):
 *   STRIPE_LEADGRID_SOLO_PRO_MONTHLY / _YEARLY
 *   STRIPE_LEADGRID_AGENCY_MONTHLY / _YEARLY
 *
 * Checkout går via /api/leadgrid/self-onboard (paid plans) eller
 * /leadgrid?signup=solo_free (gratis-plan).
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { trackEvent, trackPageView } from '@/utils/ga4-client-tracking';
import {
  Box, Container, Typography, Button, Grid, Stack, Chip, Card,
  CardContent, Divider, ToggleButton, ToggleButtonGroup,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Slider, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  CheckCircleOutlineOutlined,
  HighlightOffOutlined,
  AutoAwesomeOutlined,
  CalculateOutlined,
  ExpandMoreOutlined,
  ArrowForwardOutlined,
  WorkspacesOutlined,
} from '@mui/icons-material';

// ─── PALETTE (matcher leadgrid-landing.tsx) ────────────────────────
const PALETTE = {
  bg: '#0b0518',
  bgAlt: '#13082b',
  card: 'rgba(167, 139, 250, 0.06)',
  cardBorder: 'rgba(167, 139, 250, 0.18)',
  cardHi: 'rgba(167, 139, 250, 0.12)',
  accent: '#A78BFA',
  accentBright: '#C084FC',
  accentSoft: 'rgba(167, 139, 250, 0.25)',
  text: '#F4F0FF',
  textMuted: 'rgba(244, 240, 255, 0.72)',
  textFaint: 'rgba(244, 240, 255, 0.45)',
  success: '#34D399',
  successSoft: 'rgba(52, 211, 153, 0.18)',
};

// ─── Tier-data ────────────────────────────────────────────────────
type TierId = 'solo_free' | 'solo_pro' | 'agency';

interface Tier {
  id: TierId;
  name: string;
  tagline: string;
  priceMonthly: number;  // NOK
  priceYearly: number;   // NOK / måned ved årlig fakturering
  badge?: string;
  highlighted?: boolean;
  description: string;
  bestFor: string;
  ai_quota: string;
  features: { label: string; included: boolean; note?: string }[];
  cta: { label: string; href?: string; stripeId?: string };
}

const TIERS: Tier[] = [
  {
    id: 'solo_free',
    name: 'Solo Free',
    tagline: 'Kom i gang',
    priceMonthly: 0,
    priceYearly: 0,
    description: 'Gratis for solo-selgere. Få Momentum, Intelligence Engine og iPad-app.',
    bestFor: '1 selger som vil teste',
    ai_quota: '100 AI-kall/mnd',
    features: [
      { label: 'Lead Map + Kanban', included: true },
      { label: 'Native iPad-app', included: true },
      { label: 'Intelligence Engine (NBA)', included: true },
      { label: 'Momentum Engine + sales-goal', included: true },
      { label: 'Voice Memo Recorder + Whisper', included: true, note: '100 min/mnd' },
      { label: 'Forecasting (Claude)', included: false },
      { label: 'Market Scan', included: false },
      { label: 'Public API v1', included: false },
      { label: 'Webhooks', included: false },
      { label: 'Multi-bruker / team', included: false },
      { label: 'Salesforce/HubSpot connectors', included: false },
      { label: 'AI Meeting Notes (Claude analyse)', included: false },
      { label: 'Analytics Dashboard', included: false },
      { label: 'Territory-grids m/ geofence', included: false },
      { label: 'Route Planner', included: false },
      { label: 'Prioritert support', included: false },
    ],
    cta: { label: 'Start gratis', href: '/leadgrid?signup=solo_free' },
  },
  {
    id: 'solo_pro',
    name: 'Solo Pro',
    tagline: 'For aktive selgere',
    priceMonthly: 799,
    priceYearly: 649,
    badge: 'Mest populær',
    highlighted: true,
    description: 'Full Leadgrid for 1 selger. Inkluderer alle AI-features.',
    bestFor: 'Individuell selger som vil skalere',
    ai_quota: '1 000 AI-kall/mnd + 500 min Whisper',
    features: [
      { label: 'Lead Map + Kanban', included: true },
      { label: 'Native iPad-app', included: true },
      { label: 'Intelligence Engine (NBA)', included: true },
      { label: 'Momentum Engine + sales-goal', included: true },
      { label: 'Voice Memo Recorder + Whisper', included: true, note: '500 min/mnd' },
      { label: 'Forecasting (Claude)', included: true },
      { label: 'Market Scan', included: true, note: '10 scans/mnd' },
      { label: 'Public API v1', included: true, note: '60 req/min' },
      { label: 'Webhooks', included: true },
      { label: 'Multi-bruker / team', included: false },
      { label: 'Salesforce/HubSpot connectors', included: false, note: 'Coming Q3 2026' },
      { label: 'AI Meeting Notes (Claude analyse)', included: true },
      { label: 'Analytics Dashboard', included: true },
      { label: 'Territory-grids m/ geofence', included: false },
      { label: 'Route Planner', included: true },
      { label: 'E-post support', included: true },
    ],
    cta: { label: 'Velg Solo Pro', stripeId: 'STRIPE_LEADGRID_SOLO_PRO_MONTHLY' },
  },
  {
    id: 'agency',
    name: 'Agency',
    tagline: 'For salgs-team',
    priceMonthly: 2999,
    priceYearly: 2499,
    badge: 'Bedrift',
    description: 'For salgs-team. Multi-bruker, territory-grids, leder-dashboards.',
    bestFor: 'Salgsbyrå / B2B-team m/ 3+ selgere',
    ai_quota: '10 000 AI-kall/mnd + 5 000 min Whisper',
    features: [
      { label: 'Lead Map + Kanban', included: true },
      { label: 'Native iPad-app', included: true },
      { label: 'Intelligence Engine (NBA)', included: true },
      { label: 'Momentum Engine + sales-goal', included: true },
      { label: 'Voice Memo Recorder + Whisper', included: true, note: '5 000 min/mnd' },
      { label: 'Forecasting (Claude)', included: true },
      { label: 'Market Scan', included: true, note: 'ubegrenset' },
      { label: 'Public API v1', included: true, note: '600 req/min' },
      { label: 'Webhooks', included: true },
      { label: 'Multi-bruker / team', included: true, note: '5 brukere inkl.' },
      { label: 'Salesforce/HubSpot connectors', included: false, note: 'Coming Q3 2026' },
      { label: 'AI Meeting Notes (Claude analyse)', included: true },
      { label: 'Analytics Dashboard', included: true },
      { label: 'Territory-grids m/ geofence', included: true },
      { label: 'Route Planner', included: true },
      { label: 'Prioritert support + dedicated CSM', included: true },
    ],
    cta: { label: 'Velg Agency', stripeId: 'STRIPE_LEADGRID_AGENCY_MONTHLY' },
  },
];

// ─── Competitor matrix ────────────────────────────────────────────
type CellValue = boolean | string;
const COMPETITOR_MATRIX: { feature: string; leadgrid: CellValue; pipedrive: CellValue; hubspot: CellValue; salesforce: CellValue }[] = [
  { feature: 'Native iPad-app',                       leadgrid: true,   pipedrive: false,   hubspot: false,    salesforce: false   },
  { feature: 'Momentum Engine (daglig score)',        leadgrid: true,   pipedrive: false,   hubspot: false,    salesforce: false   },
  { feature: 'Voice Memo → Claude action items',      leadgrid: true,   pipedrive: false,   hubspot: false,    salesforce: false   },
  { feature: 'AI-research per lead (Claude)',         leadgrid: true,   pipedrive: false,   hubspot: false,    salesforce: true    },
  { feature: 'Lead-temperature (Hot/Warm/Cold)',      leadgrid: true,   pipedrive: true,    hubspot: true,     salesforce: true    },
  { feature: 'Forecasting m/ p10/p50/p90',            leadgrid: true,   pipedrive: true,    hubspot: true,     salesforce: true    },
  { feature: 'Webhook-signering (HMAC)',              leadgrid: true,   pipedrive: true,    hubspot: true,     salesforce: true    },
  { feature: 'Pris fra (NOK/mnd)',                    leadgrid: '799',  pipedrive: '1 290', hubspot: '1 850',  salesforce: '3 200' },
];

// ─── FAQ ──────────────────────────────────────────────────────────
const FAQS: { q: string; a: string }[] = [
  { q: 'Får jeg iPad-app gratis?', a: 'Ja. Native iPad-app er inkludert i ALLE planer, inkludert Solo Free. Last ned fra App Store etter onboarding.' },
  { q: 'Hva er en AI-kall?', a: 'Hver Claude-prompt, Whisper-transkripsjon eller AI-research teller som én kall. Solo Free har 100/mnd, Pro har 1000, Agency har 10 000.' },
  { q: 'Kan jeg bytte plan?', a: 'Ja, når som helst. Du betaler bare differansen for resten av perioden.' },
  { q: 'Hva med GDPR / data?', a: 'All data lagres i EU (Neon/AWS Frankfurt). Vi er GDPR-compliant og kan eksportere/slette alt på 24t.' },
  { q: 'Hvor mye sparer jeg vs HubSpot?', a: 'Sammenlignet med HubSpot Sales Hub Professional (1 850 kr/mnd) sparer du 1 051 kr/mnd på Solo Pro — og du får Momentum Engine, Voice Memo og native iPad-app som de ikke har.' },
  { q: "Hva betyr 'Coming Q3 2026' på Salesforce/HubSpot-connectors?", a: 'Vi har bygget Public API v1 (OpenAPI 3.1) og forberedt arkitekturen. Connectors lanseres i juli-september 2026.' },
];

// ─── SEO helpers ──────────────────────────────────────────────────
function setMetaTagByAttr(
  tagName: 'meta' | 'link',
  attrName: 'property' | 'name' | 'rel',
  attrValue: string,
  setAttrs: Record<string, string>,
) {
  let el = document.querySelector(`${tagName}[${attrName}="${attrValue}"]`) as HTMLElement | null;
  if (!el) {
    el = document.createElement(tagName);
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  Object.entries(setAttrs).forEach(([k, v]) => el!.setAttribute(k, v));
}

function injectJsonLd(id: string, schema: Record<string, unknown>) {
  let s = document.querySelector(`script[data-jsonld-id="${id}"]`) as HTMLScriptElement | null;
  if (!s) {
    s = document.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-jsonld-id', id);
    document.head.appendChild(s);
  }
  s.textContent = JSON.stringify(schema);
}

// ─── Hovedkomponent ───────────────────────────────────────────────
export default function LeadgridPricingPage() {
  const [yearly, setYearly] = useState(true);
  const [calculatorLeads, setCalculatorLeads] = useState(50);

  useEffect(() => {
    trackPageView('/leadgrid/pricing', 'Leadgrid Priser — Solo Free, Solo Pro 799, Agency 2999');
    trackEvent('leadgrid_pricing_view', {
      referrer: document.referrer || 'direct',
      utm_source: new URLSearchParams(window.location.search).get('utm_source') ?? null,
      utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') ?? null,
    });
    document.title = 'Leadgrid Priser — Solo Free, Solo Pro 799, Agency 2999 NOK/mnd';
    const desc = document.querySelector('meta[name="description"]');
    const content = 'Velg ditt nivå: Solo Free (gratis), Solo Pro 799 kr/mnd eller Agency 2999 kr/mnd. Native iPad-app, Momentum Engine, Voice Memo og AI inkludert.';
    if (desc) desc.setAttribute('content', content);
    else {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = content;
      document.head.appendChild(m);
    }
    setMetaTagByAttr('link', 'rel', 'canonical', { href: 'https://theroleroom.com/leadgrid/pricing' });
    setMetaTagByAttr('meta', 'property', 'og:title', { content: 'Leadgrid Priser — fra 799 NOK/mnd' });
    setMetaTagByAttr('meta', 'property', 'og:description', { content });
    setMetaTagByAttr('meta', 'property', 'og:type', { content: 'website' });
    setMetaTagByAttr('meta', 'property', 'og:url', { content: 'https://theroleroom.com/leadgrid/pricing' });
    setMetaTagByAttr('meta', 'property', 'og:image', { content: 'https://theroleroom.com/leadgrid/og-image.png' });

    injectJsonLd('leadgrid-pricing-offers', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Leadgrid',
      description: content,
      offers: [
        { '@type': 'Offer', name: 'Solo Free',   price: '0',    priceCurrency: 'NOK' },
        { '@type': 'Offer', name: 'Solo Pro',    price: '799',  priceCurrency: 'NOK' },
        { '@type': 'Offer', name: 'Agency',      price: '2999', priceCurrency: 'NOK' },
      ],
    });
    injectJsonLd('leadgrid-pricing-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }, []);

  const handleTierCtaClick = (tier: Tier) => {
    trackEvent('leadgrid_pricing_cta_click', {
      tier: tier.id,
      yearly,
      price: yearly ? tier.priceYearly : tier.priceMonthly,
    });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: PALETTE.bg, color: PALETTE.text }}>
      {/* ─── Hero ─── */}
      <Box
        sx={{
          background: `radial-gradient(1200px 600px at 50% -100px, ${PALETTE.cardHi}, transparent), ${PALETTE.bg}`,
          py: { xs: 8, md: 12 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Chip
            icon={<AutoAwesomeOutlined sx={{ color: `${PALETTE.accent} !important` }} />}
            label="AI-drevet lead-system fra Norge"
            sx={{
              bgcolor: PALETTE.cardHi,
              color: PALETTE.accentBright,
              border: `1px solid ${PALETTE.cardBorder}`,
              mb: 4,
            }}
          />
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', md: '3.75rem' },
              fontWeight: 700,
              mb: 2,
              background: `linear-gradient(90deg, ${PALETTE.accentBright}, #F472B6)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1,
            }}
          >
            Velg ditt nivå
          </Typography>
          <Typography sx={{ fontSize: '1.25rem', color: PALETTE.textMuted, mb: 5, maxWidth: 640, mx: 'auto' }}>
            Fra solo-selger til agency. Alle planer inkluderer Intelligence Engine,
            Momentum og iPad-app.
          </Typography>

          {/* Yearly / monthly toggle */}
          <ToggleButtonGroup
            value={yearly ? 'yearly' : 'monthly'}
            exclusive
            onChange={(_, v) => v && setYearly(v === 'yearly')}
            sx={{
              bgcolor: PALETTE.card,
              border: `1px solid ${PALETTE.cardBorder}`,
              borderRadius: 999,
              p: 0.5,
              '& .MuiToggleButton-root': {
                border: 'none',
                color: PALETTE.textMuted,
                borderRadius: 999,
                px: 3,
                py: 1,
                textTransform: 'none',
                fontWeight: 600,
                '&.Mui-selected': {
                  bgcolor: PALETTE.accent,
                  color: PALETTE.bg,
                  '&:hover': { bgcolor: PALETTE.accentBright },
                },
              },
            }}
          >
            <ToggleButton value="monthly">Månedlig</ToggleButton>
            <ToggleButton value="yearly">
              Årlig&nbsp;<span style={{ color: PALETTE.success, fontWeight: 800 }}>−19%</span>
            </ToggleButton>
          </ToggleButtonGroup>
        </Container>
      </Box>

      {/* ─── Tier-cards ─── */}
      <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 12 } }}>
        <Grid container spacing={3}>
          {TIERS.map((tier) => (
            <Grid key={tier.id} item xs={12} md={4}>
              <TierCard tier={tier} yearly={yearly} onCtaClick={handleTierCtaClick} />
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ─── Pricing-calculator ─── */}
      <Box sx={{ bgcolor: PALETTE.bgAlt, py: { xs: 8, md: 10 } }}>
        <Container maxWidth="sm">
          <Card
            sx={{
              bgcolor: PALETTE.card,
              border: `1px solid ${PALETTE.cardBorder}`,
              borderRadius: 4,
              p: { xs: 3, md: 4 },
            }}
          >
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <CalculateOutlined sx={{ color: PALETTE.accent, fontSize: 28 }} />
                <Typography variant="h5" sx={{ color: PALETTE.text, fontWeight: 700 }}>
                  Hva koster det for meg?
                </Typography>
              </Stack>

              <Typography sx={{ color: PALETTE.textMuted, mb: 1.5 }}>
                Hvor mange leads kontakter du per uke?{' '}
                <strong style={{ color: PALETTE.accentBright }}>
                  {calculatorLeads}
                </strong>
              </Typography>
              <Slider
                value={calculatorLeads}
                min={10}
                max={500}
                step={10}
                onChange={(_, v) => setCalculatorLeads(v as number)}
                sx={{
                  color: PALETTE.accent,
                  '& .MuiSlider-thumb': {
                    boxShadow: `0 0 0 8px ${PALETTE.accentSoft}`,
                  },
                }}
              />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" sx={{ color: PALETTE.textFaint }}>10</Typography>
                <Typography variant="caption" sx={{ color: PALETTE.textFaint }}>500+</Typography>
              </Stack>

              <CalculatorResult leads={calculatorLeads} yearly={yearly} />
            </CardContent>
          </Card>
        </Container>
      </Box>

      {/* ─── Competitor matrix ─── */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: '2rem', md: '2.5rem' },
              fontWeight: 700,
              textAlign: 'center',
              color: PALETTE.text,
              mb: 6,
            }}
          >
            Hvordan stiller vi opp vs konkurrentene?
          </Typography>

          <TableContainer
            component={Paper}
            sx={{
              bgcolor: PALETTE.card,
              border: `1px solid ${PALETTE.cardBorder}`,
              borderRadius: 4,
              boxShadow: 'none',
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: PALETTE.text, fontWeight: 700, borderBottomColor: PALETTE.cardBorder }}>
                    Feature
                  </TableCell>
                  <TableCell align="center" sx={{ color: PALETTE.accentBright, fontWeight: 700, borderBottomColor: PALETTE.cardBorder }}>
                    Leadgrid
                  </TableCell>
                  <TableCell align="center" sx={{ color: PALETTE.textMuted, fontWeight: 700, borderBottomColor: PALETTE.cardBorder }}>
                    Pipedrive
                  </TableCell>
                  <TableCell align="center" sx={{ color: PALETTE.textMuted, fontWeight: 700, borderBottomColor: PALETTE.cardBorder }}>
                    HubSpot
                  </TableCell>
                  <TableCell align="center" sx={{ color: PALETTE.textMuted, fontWeight: 700, borderBottomColor: PALETTE.cardBorder }}>
                    Salesforce
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {COMPETITOR_MATRIX.map((row, i) => {
                  const isLast = i === COMPETITOR_MATRIX.length - 1;
                  return (
                    <TableRow
                      key={row.feature}
                      sx={{
                        bgcolor: isLast ? PALETTE.cardHi : 'transparent',
                        '& td': {
                          borderBottomColor: PALETTE.cardBorder,
                          color: PALETTE.text,
                          fontWeight: isLast ? 700 : 400,
                        },
                      }}
                    >
                      <TableCell>{row.feature}</TableCell>
                      <TableCell align="center">{renderCell(row.leadgrid)}</TableCell>
                      <TableCell align="center">{renderCell(row.pipedrive)}</TableCell>
                      <TableCell align="center">{renderCell(row.hubspot)}</TableCell>
                      <TableCell align="center">{renderCell(row.salesforce)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Container>
      </Box>

      {/* ─── FAQ ─── */}
      <Box sx={{ bgcolor: PALETTE.bgAlt, py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">
          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: '2rem', md: '2.5rem' },
              fontWeight: 700,
              textAlign: 'center',
              color: PALETTE.text,
              mb: 6,
            }}
          >
            Vanlige spørsmål
          </Typography>
          <Stack spacing={2}>
            {FAQS.map((faq) => (
              <Accordion
                key={faq.q}
                sx={{
                  bgcolor: PALETTE.card,
                  border: `1px solid ${PALETTE.cardBorder}`,
                  borderRadius: '12px !important',
                  color: PALETTE.text,
                  boxShadow: 'none',
                  '&:before': { display: 'none' },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreOutlined sx={{ color: PALETTE.accent }} />}
                  sx={{ '& .MuiAccordionSummary-content': { fontWeight: 600 } }}
                >
                  {faq.q}
                </AccordionSummary>
                <AccordionDetails sx={{ color: PALETTE.textMuted, pt: 0 }}>
                  {faq.a}
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ─── Final CTA ─── */}
      <Box
        sx={{
          py: { xs: 10, md: 14 },
          background: `linear-gradient(135deg, ${PALETTE.accent}, #EC4899)`,
          color: '#FFF',
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h2" sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, fontWeight: 700, mb: 2 }}>
            Klar til å fyre opp pipelinen?
          </Typography>
          <Typography sx={{ fontSize: '1.25rem', opacity: 0.92, mb: 5 }}>
            Gratis å starte. Ingen kortkrav. iPad-app inkludert.
          </Typography>
          <Link href="/leadgrid?signup=solo_free">
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardOutlined />}
              onClick={() => trackEvent('leadgrid_pricing_final_cta', { tier: 'solo_free' })}
              sx={{
                bgcolor: '#FFF',
                color: PALETTE.accent,
                fontWeight: 700,
                px: 5,
                py: 1.75,
                borderRadius: 999,
                fontSize: '1.05rem',
                textTransform: 'none',
                boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
                '&:hover': { bgcolor: '#F8F4FF', transform: 'translateY(-2px)' },
                transition: 'all 0.2s',
              }}
            >
              Start gratis
            </Button>
          </Link>
        </Container>
      </Box>
    </Box>
  );
}

// ─── TierCard ─────────────────────────────────────────────────────
function TierCard({
  tier,
  yearly,
  onCtaClick,
}: {
  tier: Tier;
  yearly: boolean;
  onCtaClick: (tier: Tier) => void;
}) {
  const price = yearly ? tier.priceYearly : tier.priceMonthly;

  // Bygg checkout-URL
  // - Gratis-plan: /leadgrid?signup=solo_free
  // - Paid: /api/leadgrid/self-onboard backed by Stripe Checkout. Frontend
  //   sender bruker til signup-flow m/ tier + billing-periode i query.
  const ctaHref = tier.cta.href
    ? tier.cta.href
    : `/leadgrid?signup=${tier.id}&billing=${yearly ? 'yearly' : 'monthly'}`;

  return (
    <Card
      sx={{
        position: 'relative',
        bgcolor: tier.highlighted ? PALETTE.cardHi : PALETTE.card,
        border: tier.highlighted
          ? `2px solid ${PALETTE.accent}`
          : `1px solid ${PALETTE.cardBorder}`,
        borderRadius: 4,
        p: { xs: 3, md: 4 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: tier.highlighted
          ? `0 24px 60px rgba(167, 139, 250, 0.25)`
          : 'none',
        transform: tier.highlighted ? { md: 'translateY(-8px)' } : 'none',
        transition: 'all 0.3s',
      }}
    >
      {tier.badge && (
        <Chip
          label={tier.badge}
          size="small"
          sx={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: tier.highlighted ? PALETTE.accent : PALETTE.cardBorder,
            color: tier.highlighted ? PALETTE.bg : PALETTE.text,
            fontWeight: 700,
            px: 1.5,
          }}
        />
      )}

      <Typography variant="h4" sx={{ color: PALETTE.text, fontWeight: 700 }}>
        {tier.name}
      </Typography>
      <Typography variant="caption" sx={{ color: PALETTE.textFaint, mb: 3 }}>
        {tier.tagline}
      </Typography>

      <Box sx={{ mb: 3 }}>
        {price === 0 ? (
          <Typography sx={{ fontSize: '3rem', fontWeight: 800, color: PALETTE.accentBright }}>
            Gratis
          </Typography>
        ) : (
          <>
            <Stack direction="row" alignItems="baseline" spacing={1}>
              <Typography sx={{ fontSize: '3rem', fontWeight: 800, color: PALETTE.text }}>
                {price}
              </Typography>
              <Typography sx={{ color: PALETTE.textMuted }}>NOK/mnd</Typography>
            </Stack>
            {yearly && tier.priceMonthly > tier.priceYearly && (
              <Typography variant="caption" sx={{ color: PALETTE.success, mt: 0.5, display: 'block' }}>
                Spar {(tier.priceMonthly - tier.priceYearly) * 12} kr/år
              </Typography>
            )}
          </>
        )}
      </Box>

      <Typography sx={{ color: PALETTE.textMuted, mb: 2, fontSize: 14 }}>
        {tier.description}
      </Typography>

      <Box
        sx={{
          bgcolor: PALETTE.cardHi,
          border: `1px solid ${PALETTE.cardBorder}`,
          borderRadius: 2,
          p: 1.5,
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <AutoAwesomeOutlined sx={{ color: PALETTE.accent, fontSize: 18 }} />
        <Typography sx={{ color: PALETTE.text, fontWeight: 600, fontSize: 14 }}>
          {tier.ai_quota}
        </Typography>
      </Box>

      <Button
        component="a"
        href={ctaHref}
        variant="contained"
        fullWidth
        onClick={() => onCtaClick(tier)}
        sx={{
          mb: 3,
          py: 1.5,
          textTransform: 'none',
          fontWeight: 700,
          fontSize: 16,
          borderRadius: 2,
          bgcolor: tier.highlighted ? PALETTE.accent : PALETTE.text,
          color: tier.highlighted ? PALETTE.bg : PALETTE.bg,
          '&:hover': {
            bgcolor: tier.highlighted ? PALETTE.accentBright : '#FFF',
          },
        }}
      >
        {tier.cta.label}
      </Button>

      <Typography
        variant="caption"
        sx={{ color: PALETTE.textFaint, fontWeight: 700, letterSpacing: 0.5, mb: 1.5 }}
      >
        INKLUDERER
      </Typography>
      <Divider sx={{ bgcolor: PALETTE.cardBorder, mb: 2 }} />
      <Stack spacing={1.25}>
        {tier.features.map((f) => (
          <Stack key={f.label} direction="row" spacing={1} alignItems="flex-start">
            {f.included ? (
              <CheckCircleOutlineOutlined sx={{ color: PALETTE.success, fontSize: 20, mt: 0.25 }} />
            ) : (
              <HighlightOffOutlined sx={{ color: PALETTE.textFaint, fontSize: 20, mt: 0.25 }} />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography
                sx={{
                  fontSize: 14,
                  color: f.included ? PALETTE.text : PALETTE.textFaint,
                  textDecoration: f.included ? 'none' : 'line-through',
                }}
              >
                {f.label}
              </Typography>
              {f.note && (
                <Typography variant="caption" sx={{ color: PALETTE.textFaint, fontSize: 12 }}>
                  ({f.note})
                </Typography>
              )}
            </Box>
          </Stack>
        ))}
      </Stack>

      <Box sx={{ mt: 'auto', pt: 3 }}>
        <Typography variant="caption" sx={{ color: PALETTE.textFaint }}>
          <WorkspacesOutlined sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
          {tier.bestFor}
        </Typography>
      </Box>
    </Card>
  );
}

// ─── Calculator-resultat ──────────────────────────────────────────
function CalculatorResult({ leads, yearly }: { leads: number; yearly: boolean }) {
  // 5 AI-kall per lead-touch, 4 uker per måned
  const aiCallsPerMonth = leads * 4 * 5;
  let recommended: Tier;
  if (aiCallsPerMonth <= 100) recommended = TIERS[0];
  else if (aiCallsPerMonth <= 1000) recommended = TIERS[1];
  else recommended = TIERS[2];
  const price = yearly ? recommended.priceYearly : recommended.priceMonthly;

  return (
    <Box
      sx={{
        mt: 3,
        bgcolor: PALETTE.cardHi,
        border: `1px solid ${PALETTE.cardBorder}`,
        borderRadius: 2,
        p: 2.5,
      }}
    >
      <Typography sx={{ color: PALETTE.textMuted, fontSize: 14, mb: 0.5 }}>
        Anbefalt plan:
      </Typography>
      <Stack direction="row" alignItems="baseline" spacing={1}>
        <Typography sx={{ color: PALETTE.accentBright, fontSize: 24, fontWeight: 800 }}>
          {recommended.name}
        </Typography>
        <Typography sx={{ color: PALETTE.text, fontSize: 18 }}>
          — {price === 0 ? 'Gratis' : `${price} kr/mnd`}
        </Typography>
      </Stack>
      <Typography variant="caption" sx={{ color: PALETTE.textFaint, display: 'block', mt: 1 }}>
        Ca. {aiCallsPerMonth.toLocaleString('nb-NO')} AI-kall/mnd ({leads} leads × 5 touch × 4 uker)
      </Typography>
    </Box>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────
function renderCell(v: CellValue): React.ReactNode {
  if (typeof v === 'string') {
    return <span style={{ fontFamily: 'ui-monospace, monospace' }}>{v}</span>;
  }
  return v ? (
    <CheckCircleOutlineOutlined sx={{ color: PALETTE.success, fontSize: 22 }} />
  ) : (
    <HighlightOffOutlined sx={{ color: PALETTE.textFaint, fontSize: 22 }} />
  );
}
