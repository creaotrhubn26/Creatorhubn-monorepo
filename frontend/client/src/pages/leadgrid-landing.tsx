/**
 * leadgrid-landing.tsx — landing-side for Leadgrid på theroleroom.com/leadgrid
 *
 * Lever som sub-rute under theroleroom.com (ikke standalone) per Daniels
 * brief. Bruker pitch-spec-retningslinjene:
 *   - Mørkt/premium
 *   - Én idé per seksjon
 *   - Lite tekst, mye visuelt
 *   - Tydelige før/etter-kontraster
 *
 * Visuelt språk: warm-dark + lilla accent (#A78BFA / #8B5CF6) som
 * matcher app-ikonet + backdrops fra /public/leadgrid.
 *
 * Faste seksjoner (etter landingsside.png-mockup):
 *   1. Sticky header m/ Logo + nav (Produkt / Løsninger / Priser / Demo)
 *   2. Hero — "Gjør kartet om til kunder."
 *   3. Trust-strip — 6 kunde-logoer
 *   4. Slik fungerer det — 5 steg (Finn → Organiser → Følg opp → Book → Lukk)
 *   5. Feature-grid — Kartbasert + Smarte filtre + AI-pitch + Pipeline +
 *      Rapporter + "Alt du trenger samlet"
 *   6. Økosystem-visual — "Slik henger alt sammen i Leadgrid"
 *   7. Testimonials — 3 sitater
 *   8. Pricing — Solo Free 0 / Solo Pro 799 / Agency 2999 (matcher /leadgrid/pricing)
 *   9. Final CTA + Footer
 *
 * UI-bilder (iPad/iPhone/Mac) er device-rammer fra /public/leadgrid/device-*.png
 * — disse fylles med ekte app-skjermbilder når de er klare. Per nå brukes
 * backdrop-overlay som placeholder.
 */

import { useEffect, useState } from 'react';
import { useLandingBrand } from '@/hooks/useLandingAccent';
import { useElementEdits } from '@/components/workspace/elementEdits';
import WorkspaceDesignOverlay from '@/components/workspace/WorkspaceDesignOverlay';
import { fireGoogleAdsConversion } from '@/utils/google-ads-conversions';
import { trackEvent, trackPageView } from '@/utils/ga4-client-tracking';
import {
  Box, Container, Typography, Button, Grid, Stack, Chip,
  Card, CardContent, Divider, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Alert,
} from '@mui/material';
import {
  TravelExploreOutlined,
  FolderOutlined,
  SendOutlined,
  EventAvailableOutlined,
  EmojiEventsOutlined,
  AutoAwesomeMosaicOutlined,
  FilterAltOutlined,
  AutoGraphOutlined,
  HubOutlined,
  CheckCircleOutlineOutlined,
  StarRounded,
  MapOutlined,
  AutoFixHighOutlined,
  ViewKanbanOutlined,
  InsightsOutlined,
  WorkspacesOutlined,
  DoorFrontOutlined,
  DirectionsCarFilledOutlined,
  VerifiedOutlined,
  GavelOutlined,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import LeadgridExperience from '@/components/leadgrid/LeadgridExperience';
import { DEFAULT_PRICING_CONFIG, type LeadgridPricingConfig } from '@shared/leadgridPricingConfig';

const PALETTE = {
  bg: 'var(--lgl-bg, #0b0518)',
  bgAlt: '#13082b',
  card: 'rgba(167, 139, 250, 0.06)',
  cardBorder: 'rgba(167, 139, 250, 0.18)',
  // CreatorHub Design (landing-tokens): CSS-var-drevet fra design-tokens (ws=leadgrid,
  // nøkkel landingAccent). Literal-fallback = identisk (uavhengig av konnektor-blåen).
  accent: 'var(--lgl-accent, #A78BFA)',
  accentBright: 'var(--lgl-accent-bright, #C084FC)',
  text: 'var(--lgl-text, #F4F0FF)',
  textMuted: 'rgba(244, 240, 255, 0.72)',
  textFaint: 'rgba(244, 240, 255, 0.45)',
};

// ────────────────────────────────────────────────────────────
// Faste innholds-data — én idé per ting, lite tekst
// ────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: '1', Icon: TravelExploreOutlined, title: 'Finn leads',
    desc: 'Oppdag lokale bedrifter på kartet og identifiser de beste mulighetene.',
  },
  {
    n: '2', Icon: FolderOutlined, title: 'Organiser',
    desc: 'Lag lister, legg til notater og hold teamet oppdatert på ett sted.',
  },
  {
    n: '3', Icon: SendOutlined, title: 'Følg opp',
    desc: 'Automatiser e-post, SMS og oppgaver, og få påminnelser som driver resultat.',
  },
  {
    n: '4', Icon: EventAvailableOutlined, title: 'Book møter',
    desc: 'Send møtelinker, se kalenderen og fyll opp agendaen din.',
  },
  {
    n: '5', Icon: EmojiEventsOutlined, title: 'Lukk avtaler',
    desc: 'Flytt leads i pipelinen og vinn flere kunder, igjen og igjen.',
  },
];

// Partner-strip hentes utelukkende dynamisk fra DB-tabellen
// leadgrid_partners (mig 0316). Vi har INGEN hardkodet fallback —
// hvis vi ikke har ekte samarbeidspartnere, skjuler vi striper helt.
// Super-admin legger til reelle partnere via /superadmin Partnere-tab.

const ECOSYSTEM = [
  { Icon: TravelExploreOutlined,    title: 'Oppdag',       desc: 'Finn leads fra flere kilder.' },
  { Icon: FolderOutlined,           title: 'Organiser',    desc: 'Hold alle leads og notater samlet på ett sted.' },
  { Icon: AutoAwesomeMosaicOutlined, title: 'Automatiser', desc: 'Spar tid med smarte arbeidsflyter.' },
  { Icon: SendOutlined,             title: 'Engasjer',     desc: 'Ta kontakt med riktig budskap.' },
  { Icon: AutoGraphOutlined,        title: 'Følg opp',     desc: 'Overvåk aktivitet og oppfølginger.' },
  { Icon: HubOutlined,              title: 'Analyser',     desc: 'Se hva som fungerer og forbedre.' },
];

// Testimonials hentes også dynamisk fra DB (TBD: leadgrid_testimonials-
// tabell). Inntil videre — siden vi ikke har ekte testimonials —
// rendres seksjonen ikke i det hele tatt. Vi vil ikke ha falske sitater.
const TESTIMONIALS: { quote: string; name: string; role: string }[] = [];

// Pris-config-form + default: kanonisk kilde i @shared/leadgridPricingConfig
// (delt med admin-editoren). Landing leser fra /api/leadgrid/pricing-config;
// DEFAULT er kun fallback så siden aldri står tom om API-et er nede.

// Ikoner kan ikke ligge i JSON — mappes fra modul-key.
const MODULE_ICONS: Record<string, SvgIconComponent> = {
  dorsalg: DoorFrontOutlined,
  kvalitet: VerifiedOutlined,
  go: DirectionsCarFilledOutlined,
  anbud: GavelOutlined,
};

// ────────────────────────────────────────────────────────────
// Komponent
// ────────────────────────────────────────────────────────────
// SEO/JSON-LD helpers
// ────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────

export default function LeadgridLanding() {
  useLandingBrand('leadgrid', { landingAccent: '--lgl-accent', landingBg: '--lgl-bg', landingText: '--lgl-text' });
  // CreatorHub Design (per-element-lag): anvend lagrede edits + ?design=1 live-editor.
  useElementEdits('leadgrid');
  const [designMode, setDesignMode] = useState<boolean>(() => {
    try { return new URLSearchParams(window.location.search).get('design') === '1'; } catch { return false; }
  });
  const [expStartOpen, setExpStartOpen] = useState(false);
  // «Book demo» — én dialog, åpnes fra alle CTA-er via custom-event
  // (unngår prop-threading gjennom header/hero/final-seksjonene).
  const [demoOpen, setDemoOpen] = useState(false);
  useEffect(() => {
    const open = () => setDemoOpen(true);
    window.addEventListener('leadgrid:book-demo', open);
    return () => window.removeEventListener('leadgrid:book-demo', open);
  }, []);
  useEffect(() => {
    // GA4 page view (ekspl. tracket fordi SPA-routing ikke fyrer auto)
    trackPageView('/leadgrid', 'Leadgrid: Gjør kartet om til kunder');
    trackEvent('leadgrid_landing_view', {
      referrer: document.referrer || 'direct',
      utm_source: new URLSearchParams(window.location.search).get('utm_source') ?? null,
      utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') ?? null,
    });
    // Side-tittel + meta beskrivelse for SEO
    document.title = 'Leadgrid: Gjør kartet om til kunder';
    const desc = document.querySelector('meta[name="description"]');
    const content = 'Kartbasert CRM for lokale muligheter. Leadgrid hjelper team med å finne, organisere, følge opp og vinne lokale leads, alt i ett visuelt system.';
    if (desc) desc.setAttribute('content', content);
    else {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = content;
      document.head.appendChild(m);
    }
    // Canonical
    setMetaTagByAttr('link', 'rel', 'canonical', { href: 'https://leadgrid.no' });
    // Open Graph
    setMetaTagByAttr('meta', 'property', 'og:title', { content: 'Leadgrid: Gjør kartet om til kunder' });
    setMetaTagByAttr('meta', 'property', 'og:description', { content });
    setMetaTagByAttr('meta', 'property', 'og:type', { content: 'website' });
    setMetaTagByAttr('meta', 'property', 'og:url', { content: 'https://leadgrid.no' });
    setMetaTagByAttr('meta', 'property', 'og:image', { content: 'https://leadgrid.no/leadgrid/og-image.png' });
    setMetaTagByAttr('meta', 'property', 'og:site_name', { content: 'Leadgrid' });
    setMetaTagByAttr('meta', 'property', 'og:locale', { content: 'nb_NO' });
    // Twitter Cards
    setMetaTagByAttr('meta', 'name', 'twitter:card', { content: 'summary_large_image' });
    setMetaTagByAttr('meta', 'name', 'twitter:title', { content: 'Leadgrid: Gjør kartet om til kunder' });
    setMetaTagByAttr('meta', 'name', 'twitter:description', { content });
    setMetaTagByAttr('meta', 'name', 'twitter:image', { content: 'https://leadgrid.no/leadgrid/og-image.png' });

    // JSON-LD: SoftwareApplication + Organization + FAQPage
    injectJsonLd('leadgrid-software-app', {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Leadgrid',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'CRM',
      operatingSystem: 'Web, iOS',
      description: content,
      url: 'https://leadgrid.no',
      offers: [
        { '@type': 'Offer', name: 'Solo Free', price: '0', priceCurrency: 'NOK' },
        { '@type': 'Offer', name: 'Solo Pro', price: '799', priceCurrency: 'NOK' },
        { '@type': 'Offer', name: 'Agency', price: '2999', priceCurrency: 'NOK' },
      ],
      provider: {
        '@type': 'Organization',
        name: 'Creatorhub AS',
        url: 'https://creatorhubn.com',
      },
      featureList: [
        'Kartbasert leads-oversikt',
        'Auto-onboarding av kunder med BRREG-oppslag',
        'AI-skåring av behov og signaler',
        'Klient-portal (white-label på Agency)',
        'Steg-for-steg playbooks for Meta Pixel, GA4, Google Ads',
      ],
      inLanguage: 'nb-NO',
    });
    injectJsonLd('leadgrid-organization', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Creatorhub AS',
      legalName: 'Creatorhub AS',
      url: 'https://creatorhubn.com',
      logo: 'https://leadgrid.no/logo.png',
      foundingDate: '2024',
      address: { '@type': 'PostalAddress', addressCountry: 'NO' },
      sameAs: ['https://theroleroom.com', 'https://leadgrid.no'],
    });
    injectJsonLd('leadgrid-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Hva er Leadgrid?',
          acceptedAnswer: { '@type': 'Answer', text: 'Leadgrid er et kartbasert CRM-system for team som vil ha bedre oversikt over lokale leads, organisere oppfølging og levere målbare resultater til kundene sine.' },
        },
        {
          '@type': 'Question',
          name: 'Hvor mye koster Leadgrid?',
          acceptedAnswer: { '@type': 'Answer', text: 'Solo Free er gratis (1 kunde, 3 auto-onboards/mnd). Solo Pro er 799 kr/mnd (10 kunder, alle AI-features). Agency er 2 999 kr/mnd med multi-bruker, territorie-grids og white-label klient-portal.' },
        },
        {
          '@type': 'Question',
          name: 'Hvordan kommer jeg i gang?',
          acceptedAnswer: { '@type': 'Answer', text: 'Trykk Start gratis. Du oppgir bare e-post og bedriftsnavn. Vi setter opp alt, og du legger til din første kunde innen 2 minutter.' },
        },
        {
          '@type': 'Question',
          name: 'Trenger kunden min konto for å se sin portal?',
          acceptedAnswer: { '@type': 'Answer', text: 'Nei. Hver kunde får en unik lenke (/c/{token}) som åpner portal-en direkte. Ingen registrering, ingen passord, bare klikk på lenken i e-posten.' },
        },
        {
          '@type': 'Question',
          name: 'Kan jeg avslutte når som helst?',
          acceptedAnswer: { '@type': 'Answer', text: 'Ja. Alle planer kan kanselleres umiddelbart via Stripe Customer Portal. Data eksporteres på forespørsel.' },
        },
      ],
    });
  }, []);

  return (
    <Box sx={{
      bgcolor: PALETTE.bg,
      color: PALETTE.text,
      minHeight: '100vh',
      fontFamily: '-apple-system, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif',
      // 'clip' og IKKE 'hidden': overflow-x hidden gjør boksen til
      // scroll-container (overflow-y computes til auto) → position:sticky i
      // LeadgridExperience fester seg mot boksen i stedet for viewporten og
      // scroll-filmen blir svart. 'clip' klipper uten scroll-container.
      overflowX: 'clip',
    }}>
      {designMode && <WorkspaceDesignOverlay workspace="leadgrid" targetFile="frontend/client/src/pages/leadgrid-landing.tsx" onClose={() => setDesignMode(false)} />}
      <StickyHeader />
      <LeadgridExperience onStartFree={() => setExpStartOpen(true)} />
      <StartFreeDialog open={expStartOpen} onClose={() => setExpStartOpen(false)} />
      <BookDemoDialog open={demoOpen} onClose={() => setDemoOpen(false)} />
      <HeroSection />
      <TrustStrip />
      <HowItWorksSection />
      <FeatureGridSection />
      <EcosystemSection />
      <TestimonialsSection />
      <StackReplaceSection onStartFree={() => setExpStartOpen(true)} />
      <PricingSection />
      <FinalCtaSection />
      <Footer />
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Header
// ────────────────────────────────────────────────────────────

function StickyHeader() {
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(18px)',
        bgcolor: 'rgba(11, 5, 24, 0.78)',
        borderBottom: `1px solid ${PALETTE.cardBorder}`,
      }}
    >
      <Container maxWidth="lg" sx={{ py: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              component="img"
              src="/leadgrid/logo.webp"
              alt="Leadgrid"
              sx={{ width: 36, height: 36, borderRadius: 1 }}
            />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1 }}>
                Leadgrid
              </Typography>
              <Typography sx={{ fontSize: 11, color: PALETTE.textFaint, lineHeight: 1 }}>
                by The Role Room
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {([
              { label: 'Produkt', href: '#produkt' },
              { label: 'Løsninger', href: '#løsninger' },
              { label: 'Connectors', href: '/leadgrid/connectors' },
              { label: 'Importér', href: '/leadgrid/import' },
              { label: 'Priser', href: '#priser' },
              { label: 'Demo', href: '#demo' },
            ]).map((item) => (
              <Typography
                key={item.label}
                component="a"
                href={item.href}
                sx={{
                  color: PALETTE.textMuted, fontSize: 14, fontWeight: 500,
                  textDecoration: 'none',
                  '&:hover': { color: PALETTE.text },
                }}
              >
                {item.label}
              </Typography>
            ))}
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="text"
              sx={{ color: PALETTE.textMuted, fontWeight: 500, textTransform: 'none' }}
              href="https://creatorhubn.com"
            >
              Logg inn
            </Button>
            <Button
              variant="contained"
              sx={{
                bgcolor: PALETTE.accent,
                color: '#1a0535',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 999,
                px: 2.5,
                '&:hover': { bgcolor: PALETTE.accentBright },
              }}
              endIcon={<SendOutlined sx={{ fontSize: 16 }} />}
              onClick={() => window.dispatchEvent(new Event('leadgrid:book-demo'))}
            >
              Book demo
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Hero
// ────────────────────────────────────────────────────────────

function HeroSection() {
  const [startOpen, setStartOpen] = useState(false);
  return (
    <Box
      sx={{
        position: 'relative',
        pt: { xs: 8, md: 12 },
        pb: { xs: 6, md: 10 },
        // Ren mørk bakgrunn med subtil radial glow + grid-pattern.
        // Erstatter tidligere /leadgrid/backdrop3.png som rotet med
        // gjennomskinnelig tekst/ikoner og hvite mockup-border.
        bgcolor: PALETTE.bg,
        backgroundImage: `
          radial-gradient(ellipse 80% 60% at 50% 10%, rgba(167, 139, 250, 0.18) 0%, transparent 70%),
          radial-gradient(ellipse 60% 50% at 85% 70%, rgba(124, 58, 237, 0.12) 0%, transparent 65%),
          linear-gradient(180deg, ${PALETTE.bg} 0%, #050211 100%)
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        overflow: 'hidden',
        '&::before': {
          // Subtil grid-pattern for tekstur uten støy
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(167, 139, 250, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167, 139, 250, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Chip
              label="Kartbasert CRM for lokale muligheter"
              size="small"
              sx={{
                bgcolor: 'rgba(167, 139, 250, 0.15)',
                color: PALETTE.accent,
                fontWeight: 500,
                mb: 3,
                border: `1px solid ${PALETTE.cardBorder}`,
              }}
            />
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: 44, sm: 56, md: 72 },
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                mb: 3,
              }}
            >
              Gjør kartet<br />om til{' '}
              <Box component="span" sx={{ color: PALETTE.accent }}>
                kunder.
              </Box>
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: 17, md: 19 },
                color: PALETTE.textMuted,
                lineHeight: 1.55,
                mb: 4,
                maxWidth: 520,
              }}
            >
              Leadgrid hjelper team med å finne, organisere, følge opp
              og vinne lokale leads, alt i ett visuelt system.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3}>
              <Button
                variant="contained"
                size="large"
                endIcon={<SendOutlined />}
                sx={{
                  bgcolor: PALETTE.accent,
                  color: '#1a0535',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 999,
                  px: 4, py: 1.5,
                  fontSize: 16,
                  '&:hover': { bgcolor: PALETTE.accentBright },
                }}
                onClick={() => {
                  trackEvent('leadgrid_start_free_clicked', { cta_location: 'hero' });
                  setStartOpen(true);
                }}
              >
                Start gratis
              </Button>
              <StartFreeDialog open={startOpen} onClose={() => setStartOpen(false)} />
              <Button
                variant="outlined"
                size="large"
                sx={{
                  borderColor: PALETTE.cardBorder,
                  color: PALETTE.text,
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 999,
                  px: 4, py: 1.5,
                  fontSize: 16,
                  '&:hover': {
                    borderColor: PALETTE.accent,
                    bgcolor: 'rgba(167, 139, 250, 0.08)',
                  },
                }}
                href="#demo"
              >
                Se demo
              </Button>
            </Stack>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ color: PALETTE.textFaint, fontSize: 13 }}
            >
              {[
                'Kom i gang på 2 min',
                'Ingen kredittkort',
                'Avslutt når som helst',
              ].map((t) => (
                <Stack direction="row" spacing={0.7} alignItems="center" key={t}>
                  <CheckCircleOutlineOutlined sx={{ fontSize: 16, color: PALETTE.accent }} />
                  <span>{t}</span>
                </Stack>
              ))}
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <DeviceComposition />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Start gratis dialog — kobles direkte til Stripe Checkout
// ────────────────────────────────────────────────────────────

function StartFreeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [website, setWebsite] = useState('');
  const [contactName, setContactName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canStart = email.includes('@') && email.includes('.') && orgName.trim().length > 1;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/leadgrid/self-onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          orgName: orgName.trim(),
          templateKey: 'solo',
          website: website.trim() || undefined,
          contactName: contactName.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? 'Noe gikk galt');
        setSubmitting(false);
        return;
      }
      // Fyre Google Ads conversion + GA4 event for Leadgrid-signup.
      // value=0 for Free-tier — ekte MRR-verdi kommer ved oppgradering.
      try {
        await fireGoogleAdsConversion('signup', {
          value: 0,
          currency: 'NOK',
          transactionId: data.organization?.id,
        });
        trackEvent('leadgrid_signup_completed', {
          plan: 'solo_free',
          template: 'solo',
          organization_id: data.organization?.id,
          has_checkout_url: !!data.checkout_url,
          value: 0,
          currency: 'NOK',
        });
      } catch { /* swallow */ }

      // Hvis Stripe Checkout-URL kom tilbake — redirect dit. Hvis ikke,
      // vis fallback-melding.
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      // Ingen checkout-url — fortell brukeren sjekk e-post for magic link
      setError(null);
      alert(
        data.magic_link_sent
          ? 'Sjekk e-posten din. Vi sendte deg en magic link til Leadgrid.'
          : 'Klar! Gå til /leadgrid/welcome for å komme i gang.',
      );
      onClose();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
    setSubmitting(false);
  }

  return (
    <Dialog
      open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0a0512',
          color: '#fff',
          border: '1px solid rgba(167, 139, 250, 0.20)',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="overline" sx={{ color: PALETTE.accent, letterSpacing: 2 }}>
          Solo Free
        </Typography>
        <Typography variant="h5" fontWeight={700}>Start gratis</Typography>
        <Typography variant="body2" sx={{ color: PALETTE.textMuted, mt: 1 }}>
          1 kunde · 3 auto-onboards/mnd · Klient-portal · Ingen forpliktelse
        </Typography>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            fullWidth required label="E-post"
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="ola@bedrift.no"
            InputLabelProps={{ sx: { color: PALETTE.textMuted } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&:hover fieldset': { borderColor: PALETTE.accent },
                '&.Mui-focused fieldset': { borderColor: PALETTE.accent },
              },
            }}
          />
          <TextField
            fullWidth required label="Navn på din organisasjon"
            value={orgName} onChange={(e) => setOrgName(e.target.value)}
            placeholder="F.eks. Ola Markedsføring"
            InputLabelProps={{ sx: { color: PALETTE.textMuted } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&:hover fieldset': { borderColor: PALETTE.accent },
                '&.Mui-focused fieldset': { borderColor: PALETTE.accent },
              },
            }}
          />
          <TextField
            fullWidth label="Ditt navn (valgfritt)"
            value={contactName} onChange={(e) => setContactName(e.target.value)}
            InputLabelProps={{ sx: { color: PALETTE.textMuted } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&:hover fieldset': { borderColor: PALETTE.accent },
                '&.Mui-focused fieldset': { borderColor: PALETTE.accent },
              },
            }}
          />
          <TextField
            fullWidth label="Website (valgfritt)"
            value={website} onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://dinbedrift.no"
            InputLabelProps={{ sx: { color: PALETTE.textMuted } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&:hover fieldset': { borderColor: PALETTE.accent },
                '&.Mui-focused fieldset': { borderColor: PALETTE.accent },
              },
            }}
          />
          <Typography variant="caption" sx={{ color: PALETTE.textFaint }}>
            Vi tar betalingskortet ditt i neste steg via Stripe. Du blir
            ikke belastet før du oppgraderer. Avslutt når som helst.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={onClose} sx={{ color: PALETTE.textMuted }}>Avbryt</Button>
        <Button
          variant="contained"
          disabled={!canStart || submitting}
          onClick={submit}
          sx={{
            bgcolor: PALETTE.accent, color: '#1a0535', fontWeight: 700,
            px: 3, borderRadius: 999,
            '&:hover': { bgcolor: PALETTE.accentBright },
          }}
        >
          {submitting ? <CircularProgress size={20} sx={{ color: '#1a0535' }} /> : 'Fortsett til Stripe'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────
// Book demo dialog — fungerende booking (POST /api/leadgrid/demo-request)
// ────────────────────────────────────────────────────────────

const lgField = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
    '&:hover fieldset': { borderColor: PALETTE.accent },
    '&.Mui-focused fieldset': { borderColor: PALETTE.accent },
  },
} as const;

function BookDemoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [preferred, setPreferred] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSend = email.includes('@') && email.includes('.');

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/leadgrid/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(), company: company.trim(),
          preferred: preferred.trim(), note: note.trim(),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setError(data.error === 'invalid_email' ? 'Ugyldig e-post' : 'Noe gikk galt, prøv igjen'); setSubmitting(false); return; }
      try { trackEvent('leadgrid_demo_requested', { has_company: !!company.trim() }); } catch { /* */ }
      setDone(true);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
    setSubmitting(false);
  }

  function close() {
    setDone(false); setError(null); setSubmitting(false);
    setName(''); setEmail(''); setCompany(''); setPreferred(''); setNote('');
    onClose();
  }

  return (
    <Dialog
      open={open} onClose={close} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: '#0a0512', color: '#fff', border: '1px solid rgba(167, 139, 250, 0.20)', borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="overline" sx={{ color: PALETTE.accent, letterSpacing: 2 }}>Book demo</Typography>
        <Typography variant="h5" fontWeight={700}>{done ? 'Takk!' : 'Se Leadgrid i felten'}</Typography>
        {!done && (
          <Typography variant="body2" sx={{ color: PALETTE.textMuted, mt: 1 }}>
            15 minutter, tilpasset deres område. Vi tar kontakt for å avtale tidspunkt.
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {done ? (
          <Alert severity="success" sx={{ mb: 1 }}>
            Vi har mottatt forespørselen din og tar kontakt på <b>{email}</b> for å avtale demo.
          </Alert>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField fullWidth required label="E-post" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="ola@bedrift.no"
                InputLabelProps={{ sx: { color: PALETTE.textMuted } }} sx={lgField} />
              <TextField fullWidth label="Navn" value={name}
                onChange={(e) => setName(e.target.value)}
                InputLabelProps={{ sx: { color: PALETTE.textMuted } }} sx={lgField} />
              <TextField fullWidth label="Firma" value={company}
                onChange={(e) => setCompany(e.target.value)}
                InputLabelProps={{ sx: { color: PALETTE.textMuted } }} sx={lgField} />
              <TextField fullWidth label="Ønsket tidspunkt (valgfritt)" value={preferred}
                onChange={(e) => setPreferred(e.target.value)} placeholder="F.eks. torsdag formiddag"
                InputLabelProps={{ sx: { color: PALETTE.textMuted } }} sx={lgField} />
              <TextField fullWidth multiline minRows={2} label="Hva vil dere se? (valgfritt)" value={note}
                onChange={(e) => setNote(e.target.value)}
                InputLabelProps={{ sx: { color: PALETTE.textMuted } }} sx={lgField} />
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={close} sx={{ color: PALETTE.textMuted }}>{done ? 'Lukk' : 'Avbryt'}</Button>
        {!done && (
          <Button variant="contained" disabled={!canSend || submitting} onClick={submit}
            sx={{ bgcolor: PALETTE.accent, color: '#1a0535', fontWeight: 700, px: 3, borderRadius: 999, '&:hover': { bgcolor: PALETTE.accentBright } }}>
            {submitting ? <CircularProgress size={20} sx={{ color: '#1a0535' }} /> : 'Send forespørsel'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

/**
 * Device-mockup-komposisjon: CSS-baserte device-frames — INGEN PNG-er
 * med hvite border. iPad foran-venstre, iPhone foran-høyre, og en
 * stilisert browser-window i midten som viser Leadgrid Lead Map.
 *
 * Hvert device har:
 *  - Avrundet mørk skall (ingen hvit kant)
 *  - Tynn lys border (rgba — smelter med bg)
 *  - Skjerm-innhold rendert i CSS (kart-pins, lead-cards)
 *  - Drop-shadow for dybde
 */
function DeviceComposition() {
  return (
    <Box
      sx={{
        position: 'relative',
        height: { xs: 320, sm: 380, md: 480 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Subtil glow bak komposisjonen
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(167, 139, 250, 0.20) 0%, transparent 70%)',
          filter: 'blur(30px)',
        },
      }}
    >
      {/* Ekte app-skjermbilder i ekte Apple-rammer (frameit) — samme
          cardinal rule som ellers: aldri tegnede liksom-UI-er. */}
      <Box
        component="img"
        src="/leadgrid/hero/macbook.webp"
        alt="Leadgrid Salgsledelse på MacBook"
        sx={{
          position: 'relative',
          width: { xs: '96%', md: '100%' },
          maxWidth: 640,
          height: 'auto',
          filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.6))',
        }}
      />
      <Box
        component="img"
        src="/leadgrid/hero/ipad.webp"
        alt="Leadgrid-kartet på iPad"
        sx={{
          position: 'absolute',
          left: { xs: '-2%', md: '-6%' },
          bottom: { xs: '4%', md: '2%' },
          width: { xs: '44%', md: '42%' },
          height: 'auto',
          transform: 'rotate(-4deg)',
          filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.65))',
        }}
      />
      <Box
        component="img"
        src="/leadgrid/hero/iphone.webp"
        alt="Dagens agenda i Leadgrid på iPhone"
        sx={{
          position: 'absolute',
          right: { xs: '-1%', md: '-3%' },
          bottom: { xs: '2%', md: '0%' },
          width: { xs: '20%', md: '19%' },
          height: 'auto',
          transform: 'rotate(6deg)',
          filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.65))',
        }}
      />
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Trust-strip
// ────────────────────────────────────────────────────────────

interface LandingPartner {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  tagline: string | null;
  partner_type: string;
}

function TrustStrip() {
  const [partners, setPartners] = useState<LandingPartner[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/leadgrid/partners')
      .then((r) => (r.ok ? r.json() : { partners: [] }))
      .then((d) => { if (!cancelled) setPartners(d.partners ?? []); })
      .catch(() => { if (!cancelled) setPartners([]); });
    return () => { cancelled = true; };
  }, []);

  // Vises ikke før vi vet om vi har partnere eller fallback
  if (partners === null) return null;
  // Skjul hele striper hvis vi ikke har noen ekte partnere — vi vil
  // ikke lyve på landingssiden.
  if (partners.length === 0) return null;

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Typography
        sx={{
          textAlign: 'center', color: PALETTE.textFaint, fontSize: 13, mb: 3,
          letterSpacing: '0.02em',
        }}
      >
        Brukes av team som vil ha bedre oversikt og raskere oppfølging
      </Typography>
      <Stack
        direction="row"
        flexWrap="wrap"
        justifyContent="center"
        alignItems="center"
        spacing={{ xs: 2, sm: 4, md: 6 }}
        rowGap={2}
      >
        {partners.map((p) => (
          p.logo_url ? (
            <Box
              key={p.id}
              component={p.website ? 'a' : 'div'}
              href={p.website ?? undefined}
              target={p.website ? '_blank' : undefined}
              rel={p.website ? 'noopener noreferrer' : undefined}
              sx={{
                display: 'block',
                opacity: 0.7,
                transition: 'opacity 0.2s',
                '&:hover': { opacity: 1 },
              }}
            >
              <Box
                component="img"
                src={p.logo_url}
                alt={p.name}
                sx={{
                  maxHeight: 36,
                  maxWidth: 140,
                  objectFit: 'contain',
                  filter: 'grayscale(0.3) brightness(1.2)',
                }}
              />
            </Box>
          ) : (
            <Typography
              key={p.id}
              sx={{
                color: PALETTE.textMuted,
                fontWeight: 600,
                fontSize: { xs: 16, md: 18 },
                letterSpacing: '-0.01em',
                opacity: 0.7,
              }}
            >
              {p.name}
            </Typography>
          )
        ))}
      </Stack>
    </Container>
  );
}

// ────────────────────────────────────────────────────────────
// Slik fungerer det — 5 steg
// ────────────────────────────────────────────────────────────

function HowItWorksSection() {
  return (
    <Box id="produkt" sx={{ py: { xs: 8, md: 12 }, bgcolor: PALETTE.bgAlt }}>
      <Container maxWidth="lg">
        <SectionTitle title="Slik fungerer det" />
        <Grid container spacing={3} alignItems="stretch">
          {STEPS.map((s) => (
            <Grid item xs={12} sm={6} md={2.4} key={s.n}>
              <Card
                sx={{
                  height: '100%',
                  bgcolor: PALETTE.card,
                  border: `1px solid ${PALETTE.cardBorder}`,
                  borderRadius: 3,
                  boxShadow: 'none',
                  p: 0,
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      width: 38, height: 38, borderRadius: '50%',
                      bgcolor: PALETTE.accent, color: '#1a0535',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, mb: 2,
                    }}
                  >
                    {s.n}
                  </Box>
                  <s.Icon sx={{ fontSize: 28, color: PALETTE.accent, mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: 16, mb: 1 }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ color: PALETTE.textMuted, fontSize: 13.5, lineHeight: 1.55 }}>
                    {s.desc}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Feature-grid
// ────────────────────────────────────────────────────────────

function FeatureGridSection() {
  return (
    <Container maxWidth="lg" id="losninger" sx={{ py: { xs: 8, md: 12 } }}>
      <Grid container spacing={3}>
        <FeatureCard
          title="Kartbasert oversikt"
          desc="Se alle muligheter på kartet. Få umiddelbar visuell oversikt over områder med størst potensial."
          Icon={MapOutlined}
          accent="#a78bfa"
        />
        <FeatureCard
          title="Smarte filtre"
          desc="Filtrér på bransje, størrelse, rating, omsetning og mer for å finne de riktige leadsene, raskere."
          Icon={FilterAltOutlined}
          accent="#7ab8ff"
        />
        <FeatureCard
          title="AI-pitch og oppfølging"
          desc="Få hjelp til å skrive personlige førsteinntrykk og oppfølgings-e-poster som faktisk får svar."
          Icon={AutoFixHighOutlined}
          accent="#9be15d"
        />
        <FeatureCard
          title="Pipeline og aktiviteter"
          desc="Få full kontroll på fremdriften med en drag-and-drop pipeline og automatiske påminnelser."
          Icon={ViewKanbanOutlined}
          accent="#ffb86b"
        />
        <FeatureCard
          title="Rapporter og innsikt"
          desc="Se hva som fungerer. Spor teamets resultater og ta datadrevne beslutninger som gir vekst."
          Icon={InsightsOutlined}
          accent="#f472b6"
        />
        <FeatureCard
          title="Dørsalg & verving"
          desc="Egen dørsalg-modus: alle adressene i området på kartet, farget etter utfall. Registrer salget på døra med produkt, bidrag og kundebekreftelse, og kvalitetsavdelingen verifiserer hvert salg."
          Icon={DoorFrontOutlined}
          accent="#c084fc"
        />
        <FeatureCard
          title="Leadgrid Go: elektronisk kjørebok"
          desc="Automatisk trip-logg med kjøregodtgjørelse, ekte bomkostnad og Skatteetaten-klar rapport. Flåteoversikt, EU-kontroll og bilbooking for hele organisasjonen."
          Icon={DirectionsCarFilledOutlined}
          accent="#5eead4"
        />
        <FeatureCard
          title="Alt du trenger, samlet på ett sted"
          desc="Leadgrid samler kart, data, kommunikasjon og pipeline i én plattform som hjelper teamet ditt å jobbe smartere og vinne flere kunder."
          Icon={WorkspacesOutlined}
          accent="#a78bfa"
          highlight
        />
      </Grid>
    </Container>
  );
}

/**
 * CSS-basert feature-card. Ingen backdrop-bilder (de hadde innfelt
 * tekst som lekket gjennom overlay og rotet til UI-en). I stedet:
 *   - Mørk gradient bakgrunn
 *   - Stor dekorativ ikon i nedre høyre, lav opasitet
 *   - Radial glow i ikon-fargen for "tema" per kort
 *   - Lite ikon-chip i topp som signaliserer hva kortet er
 */
function FeatureCard({
  title, desc, Icon, accent, highlight = false,
}: {
  title: string; desc: string;
  Icon: SvgIconComponent; accent: string; highlight?: boolean;
}) {
  return (
    <Grid item xs={12} md={6}>
      <Card
        sx={{
          position: 'relative',
          minHeight: 220,
          bgcolor: highlight ? `${accent}1f` : PALETTE.card,
          border: `1px solid ${highlight ? accent : PALETTE.cardBorder}`,
          borderRadius: 3,
          boxShadow: highlight ? `0 0 40px ${accent}22` : 'none',
          overflow: 'hidden',
          transition: 'border-color 0.3s, box-shadow 0.3s',
          '&:hover': {
            borderColor: accent,
            boxShadow: `0 0 30px ${accent}22`,
          },
        }}
      >
        {/* Radial glow bak ikonet */}
        <Box sx={{
          position: 'absolute',
          right: -40, bottom: -40,
          width: 240, height: 240,
          background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }} />
        {/* Stor dekorativ ikon i bakgrunnen */}
        <Icon sx={{
          position: 'absolute',
          right: -20, bottom: -20,
          fontSize: 180,
          color: accent,
          opacity: 0.10,
          pointerEvents: 'none',
        }} />
        <CardContent sx={{ position: 'relative', p: 4 }}>
          {/* Lite ikon-chip i topp */}
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            bgcolor: `${accent}22`,
            border: `1px solid ${accent}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mb: 2,
          }}>
            <Icon sx={{ fontSize: 24, color: accent }} />
          </Box>
          <Typography sx={{ fontWeight: 600, fontSize: 22, mb: 1.5, color: PALETTE.text }}>
            {title}
          </Typography>
          <Typography sx={{ color: PALETTE.textMuted, fontSize: 15, lineHeight: 1.6, maxWidth: 440 }}>
            {desc}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}

// ────────────────────────────────────────────────────────────
// Økosystem
// ────────────────────────────────────────────────────────────

function EcosystemSection() {
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: PALETTE.bgAlt }}>
      <Container maxWidth="lg">
        <SectionTitle title="Slik henger alt sammen i Leadgrid" />
        <Grid container spacing={3}>
          {ECOSYSTEM.map((e) => (
            <Grid item xs={6} sm={4} md={2} key={e.title}>
              <Stack alignItems="center" spacing={1}>
                <Box
                  sx={{
                    width: 64, height: 64, borderRadius: 2.5,
                    bgcolor: PALETTE.card,
                    border: `1px solid ${PALETTE.cardBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <e.Icon sx={{ fontSize: 30, color: PALETTE.accent }} />
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14, mt: 1 }}>
                  {e.title}
                </Typography>
                <Typography sx={{
                  color: PALETTE.textMuted, fontSize: 12,
                  textAlign: 'center', lineHeight: 1.5, maxWidth: 140,
                }}>
                  {e.desc}
                </Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Testimonials
// ────────────────────────────────────────────────────────────

type LgTestimonial = { id?: string; quote: string; name: string; role: string; rating?: number };

function TestimonialsSection() {
  // Aktiverbart: henter GODKJENTE omtaler fra backend. Seksjonen er skjult til
  // minst én er godkjent (super-admin godkjenner innsendte kunde-omtaler).
  const [items, setItems] = useState<LgTestimonial[]>(TESTIMONIALS);
  useEffect(() => {
    let alive = true;
    fetch('/api/leadgrid/testimonials')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive && Array.isArray(d?.testimonials)) setItems(d.testimonials); })
      .catch(() => { /* behold (tom) fallback */ });
    return () => { alive = false; };
  }, []);
  if (items.length === 0) return null;
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
      <SectionTitle title="Hva kundene sier" />
      <Grid container spacing={3}>
        {items.map((t, i) => (
          <Grid item xs={12} md={4} key={t.id ?? `${t.name}-${i}`}>
            <Card sx={{
              height: '100%',
              bgcolor: PALETTE.card,
              border: `1px solid ${PALETTE.cardBorder}`,
              borderRadius: 3,
              boxShadow: 'none',
              p: 3,
            }}>
              <Stack direction="row" spacing={0.5} mb={2}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarRounded key={i} sx={{ color: PALETTE.accent, fontSize: 18 }} />
                ))}
              </Stack>
              <Typography sx={{
                fontSize: 16, lineHeight: 1.6, color: PALETTE.text, mb: 3,
                fontStyle: 'italic',
              }}>
                «{t.quote}»
              </Typography>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: PALETTE.accent, color: '#1a0535', fontWeight: 700 }}>
                  {t.name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                    {t.name}
                  </Typography>
                  <Typography sx={{ color: PALETTE.textMuted, fontSize: 12 }}>
                    {t.role}
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

// ────────────────────────────────────────────────────────────
// Pricing
// ────────────────────────────────────────────────────────────

// Kategori-priser = typiske markedspriser (2025) for tilsvarende frittstående
// verktøy, omregnet til NOK. Vist som KATEGORIER, ikke navngitte leverandører,
// for å være defensivt korrekt (mye enablement/SPM-prising er gated).
const STACK_TOOLS: { cat: string; price: string; note?: string }[] = [
  { cat: 'Felt-CRM (kart, pipeline, ruter)', price: '~440' },
  { cat: 'Salgs-coaching / playbook', price: '~500' },
  { cat: 'Opplæring (LMS) for egne selgere', price: '~90' },
  { cat: 'Provisjon / incentiv-styring', price: '~385', note: '+ plattform-avgift' },
  { cat: 'Konkurranser + premie-butikk', price: '~275' },
  { cat: 'Kjøregodtgjørelse', price: '~130' },
];

function StackReplaceSection({ onStartFree }: { onStartFree: () => void }) {
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: PALETTE.bg }}>
      <Container maxWidth="lg">
        <SectionTitle title="Ett verktøy, ikke fem" />
        <Typography sx={{
          color: PALETTE.textMuted, fontSize: { xs: 15, md: 17 }, textAlign: 'center',
          maxWidth: 680, mx: 'auto', mb: { xs: 5, md: 7 },
        }}>
          De fleste team stykker sammen felt-CRM, salgs-coaching, opplæring, provisjon
          og gamification av separate abonnementer. Leadgrid samler alt i én pris.
        </Typography>

        <Grid container spacing={3} alignItems="stretch">
          {/* Vanlig stabel */}
          <Grid item xs={12} md={6}>
            <Card sx={{
              height: '100%', bgcolor: PALETTE.card, border: `1px solid ${PALETTE.cardBorder}`,
              borderRadius: 3, boxShadow: 'none', p: 4, display: 'flex', flexDirection: 'column',
            }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 0.5 }}>
                Vanlig salgs-stabel
              </Typography>
              <Typography sx={{ color: PALETTE.textFaint, fontSize: 13, mb: 3 }}>
                5–6 separate abonnementer
              </Typography>
              <Stack spacing={1.5} flexGrow={1}>
                {STACK_TOOLS.map((t) => (
                  <Stack key={t.cat} direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
                    <Typography sx={{ color: PALETTE.textMuted, fontSize: 14 }}>
                      {t.cat}
                      {t.note && (
                        <Box component="span" sx={{ color: PALETTE.textFaint, fontSize: 12, ml: 0.5 }}>
                          {t.note}
                        </Box>
                      )}
                    </Typography>
                    <Typography sx={{ color: PALETTE.textFaint, fontSize: 14, whiteSpace: 'nowrap' }}>
                      {t.price} kr
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ my: 2.5, borderColor: PALETTE.cardBorder }} />
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Til sammen</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 22 }}>1 300–1 800 kr</Typography>
              </Stack>
              <Typography sx={{ color: PALETTE.textFaint, fontSize: 12.5, mt: 0.5 }}>
                per bruker/mnd, pluss oppsett og integrasjoner
              </Typography>
            </Card>
          </Grid>

          {/* Med Leadgrid */}
          <Grid item xs={12} md={6}>
            <Card sx={{
              height: '100%', bgcolor: 'rgba(167, 139, 250, 0.10)', border: `1px solid ${PALETTE.accent}`,
              borderRadius: 3, boxShadow: 'none', p: 4, display: 'flex', flexDirection: 'column',
            }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 0.5 }}>Med Leadgrid</Typography>
              <Typography sx={{ color: PALETTE.accentBright, fontSize: 13, mb: 3 }}>
                Alt i ett, én norsk pris
              </Typography>
              <Stack spacing={1.5} flexGrow={1}>
                {[
                  'Alt over innebygd, ingen tillegg',
                  'Pondus-coaching med per-manus-score',
                  'Akademi: lær opp dine egne selgere',
                  'Salgsledelse: provisjon, konkurranser & premier',
                  'Native iPad, Apple Watch & Mac',
                ].map((f) => (
                  <Stack key={f} direction="row" spacing={1.2} alignItems="flex-start">
                    <CheckCircleOutlineOutlined sx={{ fontSize: 18, color: PALETTE.accentBright, mt: 0.2 }} />
                    <Typography sx={{ color: PALETTE.text, fontSize: 14 }}>{f}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ my: 2.5, borderColor: PALETTE.cardBorder }} />
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography sx={{ fontWeight: 700, fontSize: 22 }}>fra 799 kr</Typography>
                <Typography sx={{ color: PALETTE.textFaint, fontSize: 14 }}>/ bruker / mnd</Typography>
              </Stack>
              <Button
                onClick={onStartFree}
                variant="contained"
                sx={{
                  mt: 2.5, alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700,
                  bgcolor: PALETTE.accent, color: '#1a0535', px: 3, py: 1.1, borderRadius: 999,
                  '&:hover': { bgcolor: PALETTE.accentBright },
                }}
              >
                Start gratis
              </Button>
            </Card>
          </Grid>
        </Grid>

        <Typography sx={{ color: PALETTE.textFaint, fontSize: 12, textAlign: 'center', mt: 3, maxWidth: 760, mx: 'auto' }}>
          Prisene til venstre er typiske markedspriser (2025) for tilsvarende frittstående verktøy,
          vist som kategorier, ikke navngitte leverandører. Faktisk stabel-kostnad varierer med
          sete-minimum, oppsett og integrasjoner.
        </Typography>
      </Container>
    </Box>
  );
}

function PricingSection() {
  // Én sannhetskilde: super-admin redigerer, landing leser. Fallback til
  // lokal default så seksjonen aldri står tom om API-et svikter.
  const [config, setConfig] = useState<LeadgridPricingConfig>(DEFAULT_PRICING_CONFIG);
  useEffect(() => {
    let alive = true;
    fetch('/api/leadgrid/pricing-config')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: LeadgridPricingConfig) => {
        if (alive && data?.tiers?.length) setConfig(data);
      })
      .catch(() => { /* behold default */ });
    return () => { alive = false; };
  }, []);

  const activeModules = config.modules.filter((m) => m.active);

  return (
    <Box id="priser" sx={{ py: { xs: 8, md: 12 }, bgcolor: PALETTE.bgAlt }}>
      <Container maxWidth="lg">
        <SectionTitle title="Enkel og transparent prising" />
        <Grid container spacing={3} alignItems="stretch">
          {config.tiers.map((p) => (
            <Grid item xs={12} md={4} key={p.key}>
              <Card sx={{
                height: '100%',
                bgcolor: p.popular ? 'rgba(167, 139, 250, 0.10)' : PALETTE.card,
                border: `1px solid ${p.popular ? PALETTE.accent : PALETTE.cardBorder}`,
                borderRadius: 3,
                boxShadow: 'none',
                position: 'relative',
                p: 4,
                display: 'flex',
                flexDirection: 'column',
              }}>
                {p.popular && (
                  <Chip
                    label="Mest populær"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: -12, right: 24,
                      bgcolor: PALETTE.accent,
                      color: '#1a0535',
                      fontWeight: 700,
                    }}
                  />
                )}
                <Typography sx={{ fontWeight: 600, fontSize: 18, mb: 0.5 }}>
                  {p.name}
                </Typography>
                <Typography sx={{ color: PALETTE.textMuted, fontSize: 13.5, mb: 3 }}>
                  {p.tagline}
                </Typography>
                <Stack direction="row" alignItems="baseline" spacing={1} mb={1}>
                  <Typography sx={{ fontWeight: 700, fontSize: 40, lineHeight: 1 }}>
                    {p.price === 0 ? 'Gratis' : `kr ${p.price}`}
                  </Typography>
                  {p.price !== 0 && (
                    <Typography sx={{ color: PALETTE.textFaint, fontSize: 14 }}>
                      /mnd
                    </Typography>
                  )}
                </Stack>
                <Typography sx={{ color: PALETTE.textFaint, fontSize: 12, mb: 3 }}>
                  {p.priceNote}
                </Typography>
                <Stack spacing={1} mb={3} flexGrow={1}>
                  {p.features.map((perk) => (
                    <Stack direction="row" spacing={1} key={perk} alignItems="flex-start">
                      <CheckCircleOutlineOutlined sx={{ fontSize: 18, color: PALETTE.accent, mt: 0.2 }} />
                      <Typography sx={{ fontSize: 14, color: PALETTE.text }}>
                        {perk}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
                <Button
                  variant={p.popular ? 'contained' : 'outlined'}
                  fullWidth
                  sx={{
                    bgcolor: p.popular ? PALETTE.accent : 'transparent',
                    color: p.popular ? '#1a0535' : PALETTE.text,
                    borderColor: PALETTE.cardBorder,
                    fontWeight: 600,
                    textTransform: 'none',
                    borderRadius: 999,
                    py: 1.25,
                    '&:hover': {
                      bgcolor: p.popular ? PALETTE.accentBright : 'rgba(167, 139, 250, 0.10)',
                      borderColor: PALETTE.accent,
                    },
                  }}
                  href="/"
                >
                  {p.cta}
                </Button>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={2} sx={{ mt: 4, color: PALETTE.textMuted }}>
          {[
            '14 dagers gratis prøveperiode',
            'Avslutt når som helst',
            'Norsk support',
            'Sikker og GDPR-vennlig',
          ].map((t) => (
            <Grid item xs={12} sm={6} md={3} key={t}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleOutlineOutlined sx={{ fontSize: 18, color: PALETTE.accent }} />
                <Typography sx={{ fontSize: 14 }}>{t}</Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
        {/* Tilleggsmoduler — feltsalg-spesifikke produkter som slås på
            oppå en plan. Speiler entitlement-matrisen (addOn Starter/Pro). */}
        <Box sx={{ mt: 7 }}>
          <Typography sx={{
            textAlign: 'center', fontSize: 13, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: PALETTE.textFaint, mb: 3,
          }}>
            Tillegg for feltsalg
          </Typography>
          <Grid container spacing={2}>
            {activeModules.map((a) => {
              const Icon = MODULE_ICONS[a.key] ?? VerifiedOutlined;
              return (
              <Grid item xs={12} md={4} key={a.key}>
                <Card sx={{
                  height: '100%', bgcolor: PALETTE.card,
                  border: `1px solid ${PALETTE.cardBorder}`, borderRadius: 3,
                  boxShadow: 'none',
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
                      <Box sx={{
                        width: 40, height: 40, borderRadius: 2,
                        bgcolor: `${a.accent}22`, border: `1px solid ${a.accent}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon sx={{ fontSize: 22, color: a.accent }} />
                      </Box>
                      <Typography sx={{ fontWeight: 600, fontSize: 17, color: PALETTE.text }}>
                        {a.title}
                      </Typography>
                    </Stack>
                    <Typography sx={{ color: PALETTE.textMuted, fontSize: 14, lineHeight: 1.55, mb: 2 }}>
                      {a.desc}
                    </Typography>
                    <Stack direction="row" alignItems="baseline" spacing={1}>
                      <Typography sx={{ fontWeight: 700, fontSize: 24, color: a.accent, lineHeight: 1 }}>
                        kr {a.priceSoloPro}
                      </Typography>
                      <Typography sx={{ color: PALETTE.textFaint, fontSize: 13 }}>
                        /mnd på Solo Pro
                      </Typography>
                    </Stack>
                    <Typography sx={{ color: PALETTE.textFaint, fontSize: 12.5, mt: 0.5 }}>
                      kr {a.priceAgency}/mnd på Agency
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              );
            })}
          </Grid>
          {config.bundle.active && (
            <Typography sx={{
              textAlign: 'center', fontSize: 13.5, color: PALETTE.textMuted, mt: 2.5,
            }}>
              {config.bundle.label}: <Box component="span" sx={{ fontWeight: 700, color: PALETTE.text }}>kr {config.bundle.priceAgency}/mnd</Box>. Spar mot enkeltmoduler.
            </Typography>
          )}
          <Typography sx={{
            textAlign: 'center', fontSize: 13, color: PALETTE.textFaint, mt: 1,
          }}>
            Tilleggsmoduler aktiveres på Solo Pro og Agency.
          </Typography>
        </Box>
        <Box sx={{ mt: 5, textAlign: 'center' }}>
          <Button
            href="/leadgrid/pricing"
            variant="text"
            sx={{
              color: PALETTE.accentBright,
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': { bgcolor: 'rgba(167, 139, 250, 0.10)' },
            }}
          >
            Se full pris-sammenligning, kalkulator og FAQ →
          </Button>
        </Box>
      </Container>
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Final CTA
// ────────────────────────────────────────────────────────────

function FinalCtaSection() {
  return (
    <Container maxWidth="lg" id="demo" sx={{ py: { xs: 8, md: 10 } }}>
      <Box sx={{
        position: 'relative',
        borderRadius: 4,
        overflow: 'hidden',
        py: { xs: 6, md: 8 },
        px: { xs: 4, md: 6 },
        textAlign: 'center',
        // CSS-basert hero-bakgrunn (ingen backdrop med innfelt tekst)
        bgcolor: '#0d0719',
        backgroundImage: `
          radial-gradient(ellipse 80% 60% at 50% 30%, rgba(167, 139, 250, 0.22) 0%, transparent 70%),
          radial-gradient(ellipse 60% 50% at 30% 80%, rgba(124, 58, 237, 0.18) 0%, transparent 60%),
          linear-gradient(135deg, #0d0719 0%, #1a0a2e 50%, #0d0719 100%)
        `,
        '&::before': {
          // Grid-pattern for dybde
          content: '""',
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(167, 139, 250, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167, 139, 250, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        },
      }}>
        <Box sx={{ position: 'relative' }}>
          <Typography sx={{
            fontWeight: 700,
            fontSize: { xs: 28, md: 40 },
            lineHeight: 1.15,
            mb: 2,
          }}>
            Klar for å få bedre oversikt over leads?
          </Typography>
          <Typography sx={{
            color: PALETTE.textMuted,
            fontSize: { xs: 15, md: 17 },
            mb: 4, maxWidth: 600, mx: 'auto',
          }}>
            Se Leadgrid på ditt eget område. Vi tar en kort demo — så ser du forskjellen på kartet.
          </Typography>
          <Button
            variant="contained"
            size="large"
            endIcon={<SendOutlined />}
            sx={{
              bgcolor: PALETTE.accent,
              color: '#1a0535',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 999,
              px: 5, py: 1.5,
              fontSize: 16,
              '&:hover': { bgcolor: PALETTE.accentBright },
            }}
            onClick={() => {
              trackEvent('leadgrid_book_demo_clicked', { cta_location: 'final' });
              window.dispatchEvent(new Event('leadgrid:book-demo'));
            }}
          >
            Book demo
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

// ────────────────────────────────────────────────────────────
// Footer
// ────────────────────────────────────────────────────────────

function Footer() {
  return (
    <Box component="footer" sx={{
      borderTop: `1px solid ${PALETTE.cardBorder}`,
      py: 6, bgcolor: PALETTE.bg,
    }}>
      <Container maxWidth="lg">
        <Grid container spacing={5}>
          <Grid item xs={12} md={4}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
              <Box
                component="img"
                src="/leadgrid/logo.webp"
                alt="Leadgrid"
                sx={{ width: 36, height: 36, borderRadius: 1 }}
              />
              <Box>
                <Typography sx={{ fontWeight: 700, lineHeight: 1 }}>Leadgrid</Typography>
                <Typography sx={{ fontSize: 11, color: PALETTE.textFaint, lineHeight: 1 }}>
                  by The Role Room
                </Typography>
              </Box>
            </Stack>
            <Typography sx={{ color: PALETTE.textMuted, fontSize: 13, maxWidth: 320 }}>
              Kartbasert CRM som hjelper team med å finne, følge opp og vinne lokale kunder.
            </Typography>
          </Grid>

          {/* Kun lenker som faktisk går et sted — døde «#»-lenker fjernet. */}
          {[
            {
              title: 'Produkt',
              links: [
                { label: 'Funksjoner', href: '#losninger' },
                { label: 'Priser', href: '#priser' },
                { label: 'Integrasjoner', href: '/leadgrid/connectors' },
                { label: 'For utviklere', href: '/leadgrid/developers' },
              ],
            },
            {
              title: 'Løsninger',
              links: [
                { label: 'Feltsalg & salgsteam', href: '/leadgrid/feltsalg-for-salgsteam' },
                { label: 'Dørsalg & verving', href: '#losninger' },
                { label: 'Import fra annet CRM', href: '/leadgrid/import' },
              ],
            },
            {
              title: 'Ressurser',
              links: [
                { label: 'Leadgrid Akademi', href: '/leadgrid/akademi' },
                { label: 'Slik skaffer du leads', href: '/leadgrid/skaffe-leads-guide' },
              ],
            },
            {
              title: 'Selskap',
              links: [
                { label: 'Kontakt oss', href: '#demo' },
                { label: 'Personvern', href: '/leadgrid/personvern' },
              ],
            },
          ].map((col) => (
            <Grid item xs={6} md={2} key={col.title}>
              <Typography sx={{
                fontSize: 12,
                color: PALETTE.textFaint,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                mb: 2, fontWeight: 600,
              }}>
                {col.title}
              </Typography>
              <Stack spacing={1.2}>
                {col.links.map((link) => {
                  const { label, href } = typeof link === 'string'
                    ? { label: link, href: '#' }
                    : link;
                  return (
                    <Typography
                      key={label}
                      component="a"
                      href={href}
                      sx={{
                        color: PALETTE.textMuted,
                        fontSize: 13.5,
                        textDecoration: 'none',
                        '&:hover': { color: PALETTE.text },
                      }}
                    >
                      {label}
                    </Typography>
                  );
                })}
              </Stack>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ borderColor: PALETTE.cardBorder, my: 4 }} />

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Typography sx={{ color: PALETTE.textFaint, fontSize: 12 }}>
            © {new Date().getFullYear()} Leadgrid · Et The Role Room-produkt
          </Typography>
          <Typography sx={{ color: PALETTE.textFaint, fontSize: 12 }}>
            Bygget i Norge
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Felles hjelpe-komponent
// ────────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Box sx={{ textAlign: 'center', mb: 6 }}>
      <Typography sx={{
        fontSize: { xs: 28, md: 36 },
        fontWeight: 700,
        letterSpacing: '-0.02em',
        mb: subtitle ? 1.5 : 0,
      }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ color: PALETTE.textMuted, fontSize: 16, maxWidth: 600, mx: 'auto' }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}
