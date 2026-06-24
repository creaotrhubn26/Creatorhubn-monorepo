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
 *   8. Pricing — Starter 249 / Pro 799 / Team 1499
 *   9. Final CTA + Footer
 *
 * UI-bilder (iPad/iPhone/Mac) er device-rammer fra /public/leadgrid/device-*.png
 * — disse fylles med ekte app-skjermbilder når de er klare. Per nå brukes
 * backdrop-overlay som placeholder.
 */

import { useEffect, useState } from 'react';
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
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';

const PALETTE = {
  bg: '#0b0518',
  bgAlt: '#13082b',
  card: 'rgba(167, 139, 250, 0.06)',
  cardBorder: 'rgba(167, 139, 250, 0.18)',
  accent: '#A78BFA',
  accentBright: '#C084FC',
  text: '#F4F0FF',
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
    desc: 'Automatiser e-post, SMS og oppgaver — og få påminnelser som driver resultat.',
  },
  {
    n: '4', Icon: EventAvailableOutlined, title: 'Book møter',
    desc: 'Send møtelinker, se kalenderen og fyll opp agendaen din.',
  },
  {
    n: '5', Icon: EmojiEventsOutlined, title: 'Lukk avtaler',
    desc: 'Flytt leads i pipelinen og vinn flere kunder — igjen og igjen.',
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

const PRICING = [
  {
    name: 'Starter', price: 249, popular: false,
    blurb: 'For små team som vil komme i gang.',
    perks: ['Ubegrenset leads', 'Kart og filtre', 'E-post og oppgaver', 'Standard rapporter'],
  },
  {
    name: 'Pro', price: 799, popular: true,
    blurb: 'For team som vil skalere salget.',
    perks: ['Alt i Starter', 'AI-assistent', 'SMS og automatisering', 'Avanserte rapporter'],
  },
  {
    name: 'Team', price: 1499, popular: false,
    blurb: 'For større team med avanserte behov.',
    perks: ['Alt i Pro', 'Team-roller og tillatelser', 'Integrasjoner (CRM, kalender)', 'Dedikert onboarding'],
  },
];

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
  useEffect(() => {
    // GA4 page view (ekspl. tracket fordi SPA-routing ikke fyrer auto)
    trackPageView('/leadgrid', 'Leadgrid — Gjør kartet om til kunder');
    trackEvent('leadgrid_landing_view', {
      referrer: document.referrer || 'direct',
      utm_source: new URLSearchParams(window.location.search).get('utm_source') ?? null,
      utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') ?? null,
    });
    // Side-tittel + meta beskrivelse for SEO
    document.title = 'Leadgrid — Gjør kartet om til kunder';
    const desc = document.querySelector('meta[name="description"]');
    const content = 'Kartbasert CRM for lokale muligheter. Leadgrid hjelper team med å finne, organisere, følge opp og vinne lokale leads — alt i ett visuelt system.';
    if (desc) desc.setAttribute('content', content);
    else {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = content;
      document.head.appendChild(m);
    }
    // Canonical
    setMetaTagByAttr('link', 'rel', 'canonical', { href: 'https://theroleroom.com/leadgrid' });
    // Open Graph
    setMetaTagByAttr('meta', 'property', 'og:title', { content: 'Leadgrid — Gjør kartet om til kunder' });
    setMetaTagByAttr('meta', 'property', 'og:description', { content });
    setMetaTagByAttr('meta', 'property', 'og:type', { content: 'website' });
    setMetaTagByAttr('meta', 'property', 'og:url', { content: 'https://theroleroom.com/leadgrid' });
    setMetaTagByAttr('meta', 'property', 'og:image', { content: 'https://theroleroom.com/leadgrid/og-image.png' });
    setMetaTagByAttr('meta', 'property', 'og:site_name', { content: 'Leadgrid' });
    setMetaTagByAttr('meta', 'property', 'og:locale', { content: 'nb_NO' });
    // Twitter Cards
    setMetaTagByAttr('meta', 'name', 'twitter:card', { content: 'summary_large_image' });
    setMetaTagByAttr('meta', 'name', 'twitter:title', { content: 'Leadgrid — Gjør kartet om til kunder' });
    setMetaTagByAttr('meta', 'name', 'twitter:description', { content });
    setMetaTagByAttr('meta', 'name', 'twitter:image', { content: 'https://theroleroom.com/leadgrid/og-image.png' });

    // JSON-LD: SoftwareApplication + Organization + FAQPage
    injectJsonLd('leadgrid-software-app', {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Leadgrid',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'CRM',
      operatingSystem: 'Web, iOS',
      description: content,
      url: 'https://theroleroom.com/leadgrid',
      offers: [
        { '@type': 'Offer', name: 'Solo (gratis)', price: '0', priceCurrency: 'NOK' },
        { '@type': 'Offer', name: 'Solo Pro', price: '199', priceCurrency: 'NOK' },
        { '@type': 'Offer', name: 'Agency', price: '990', priceCurrency: 'NOK' },
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
      logo: 'https://theroleroom.com/leadgrid/logo.png',
      foundingDate: '2024',
      address: { '@type': 'PostalAddress', addressCountry: 'NO' },
      sameAs: ['https://theroleroom.com', 'https://theroleroom.com/leadgrid'],
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
          acceptedAnswer: { '@type': 'Answer', text: 'Solo er gratis (1 kunde, 3 auto-onboards/mnd). Solo Pro er 199 kr/mnd (10 kunder, 30 auto-onboards). Agency er 990 kr/mnd med ubegrensede kunder og white-label klient-portal.' },
        },
        {
          '@type': 'Question',
          name: 'Hvordan kommer jeg i gang?',
          acceptedAnswer: { '@type': 'Answer', text: 'Trykk Start gratis — du oppgir bare e-post og bedriftsnavn. Vi setter opp alt og du legger til din første kunde innen 2 minutter.' },
        },
        {
          '@type': 'Question',
          name: 'Trenger kunden min konto for å se sin portal?',
          acceptedAnswer: { '@type': 'Answer', text: 'Nei. Hver kunde får en unik lenke (/c/{token}) som åpner portal-en direkte. Ingen registrering, ingen passord — bare klikke på lenken i e-posten.' },
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
      overflowX: 'hidden',
    }}>
      <StickyHeader />
      <HeroSection />
      <TrustStrip />
      <HowItWorksSection />
      <FeatureGridSection />
      <EcosystemSection />
      <TestimonialsSection />
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
              src="/leadgrid/logo.png"
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
              href="/"
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
              href="#demo"
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
              og vinne lokale leads — alt i ett visuelt system.
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
          ? 'Sjekk e-posten din — vi sendte deg en magic link til Leadgrid.'
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
      {/* Hovedskjerm: stylized browser/desktop view av Lead Map */}
      <MockupBrowser />
      {/* iPad foran-venstre */}
      <MockupTablet />
      {/* iPhone foran-høyre */}
      <MockupPhone />
    </Box>
  );
}

/** Browser-window (sentral): Leadgrid Lead Map med kart-pins */
function MockupBrowser() {
  return (
    <Box
      sx={{
        position: 'relative',
        width: { xs: '90%', md: '85%' },
        maxWidth: 560,
        aspectRatio: '16 / 10',
        borderRadius: 3,
        bgcolor: '#0a0512',
        border: '1px solid rgba(167, 139, 250, 0.20)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
        overflow: 'hidden',
      }}
    >
      {/* Window-bar */}
      <Box sx={{
        height: 28, display: 'flex', alignItems: 'center', px: 1.5, gap: 0.8,
        bgcolor: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {['#ff6058', '#febc2e', '#28c941'].map((c) => (
          <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
        ))}
      </Box>
      {/* Map-area med "kart"-gradient + pins */}
      <Box sx={{
        position: 'relative', height: 'calc(100% - 28px)',
        background: `
          radial-gradient(ellipse 40% 30% at 30% 40%, rgba(167, 139, 250, 0.12) 0%, transparent 60%),
          radial-gradient(ellipse 30% 25% at 70% 60%, rgba(124, 58, 237, 0.10) 0%, transparent 60%),
          linear-gradient(135deg, #0d0719 0%, #1a0a2e 100%)
        `,
      }}>
        {/* Grid-lines for "kart"-følelse */}
        <Box sx={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(167, 139, 250, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167, 139, 250, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }} />
        {/* Pins */}
        {[
          { x: '20%', y: '30%', color: PALETTE.accent },
          { x: '45%', y: '55%', color: PALETTE.accentBright },
          { x: '65%', y: '35%', color: PALETTE.accent },
          { x: '78%', y: '70%', color: '#9be15d' },
          { x: '35%', y: '78%', color: PALETTE.accentBright },
        ].map((p, i) => (
          <Box key={i} sx={{
            position: 'absolute', left: p.x, top: p.y,
            width: 14, height: 14, borderRadius: '50% 50% 50% 0',
            bgcolor: p.color, transform: 'rotate(-45deg)',
            boxShadow: `0 0 16px ${p.color}aa, 0 0 0 3px ${p.color}33`,
          }} />
        ))}
      </Box>
    </Box>
  );
}

/** iPad — foran-venstre, lett vippet */
function MockupTablet() {
  return (
    <Box
      sx={{
        position: 'absolute',
        left: { xs: '0%', md: '-6%' },
        top: { xs: '8%', md: '10%' },
        width: { xs: '30%', md: '28%' },
        aspectRatio: '3 / 4',
        borderRadius: 2.5,
        bgcolor: '#0a0512',
        border: '1px solid rgba(167, 139, 250, 0.18)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
        transform: 'rotate(-4deg)',
        overflow: 'hidden',
        p: 0.5,
      }}
    >
      <Box sx={{
        width: '100%', height: '100%',
        borderRadius: 1.5,
        background: `
          radial-gradient(circle at 30% 25%, rgba(167, 139, 250, 0.18) 0%, transparent 50%),
          linear-gradient(180deg, #0d0719 0%, #050211 100%)
        `,
        display: 'flex', flexDirection: 'column', p: 1, gap: 0.6,
      }}>
        {/* Stilisert "Min dag"-header */}
        <Box sx={{ height: 6, width: '40%', bgcolor: PALETTE.accent, borderRadius: 2, opacity: 0.8 }} />
        <Box sx={{ height: 4, width: '70%', bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2 }} />
        {/* Lead-cards */}
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{
            mt: 0.4, p: 0.6, borderRadius: 0.8,
            bgcolor: 'rgba(167, 139, 250, 0.08)',
            border: '1px solid rgba(167, 139, 250, 0.10)',
            display: 'flex', gap: 0.5,
          }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: PALETTE.accent, opacity: 0.7 }} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ height: 3, width: '60%', bgcolor: 'rgba(255,255,255,0.14)', borderRadius: 1 }} />
              <Box sx={{ mt: 0.3, height: 2, width: '40%', bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** iPhone — foran-høyre, lett vippet motsatt */
function MockupPhone() {
  return (
    <Box
      sx={{
        position: 'absolute',
        right: { xs: '0%', md: '-4%' },
        bottom: { xs: '5%', md: '8%' },
        width: { xs: '22%', md: '20%' },
        aspectRatio: '1 / 2.05',
        borderRadius: 3,
        bgcolor: '#0a0512',
        border: '1px solid rgba(167, 139, 250, 0.18)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
        transform: 'rotate(6deg)',
        overflow: 'hidden',
        p: 0.4,
        // Notch
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 6, left: '50%', transform: 'translateX(-50%)',
          width: '40%', height: 10, borderRadius: 6, bgcolor: '#000', zIndex: 2,
        },
      }}
    >
      <Box sx={{
        width: '100%', height: '100%',
        borderRadius: 2,
        background: 'linear-gradient(180deg, #0d0719 0%, #050211 100%)',
        display: 'flex', flexDirection: 'column', p: 0.8, gap: 0.5, pt: 2,
      }}>
        {/* Lead-list */}
        {[1, 2, 3, 4].map((i) => (
          <Box key={i} sx={{
            p: 0.4, borderRadius: 0.6,
            bgcolor: 'rgba(167, 139, 250, 0.08)',
            display: 'flex', gap: 0.4, alignItems: 'center',
          }}>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50% 50% 50% 0',
              bgcolor: i === 1 ? '#9be15d' : PALETTE.accent,
              transform: 'rotate(-45deg)',
            }} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ height: 2.5, width: '70%', bgcolor: 'rgba(255,255,255,0.16)', borderRadius: 1 }} />
              <Box sx={{ mt: 0.2, height: 1.8, width: '45%', bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
            </Box>
          </Box>
        ))}
      </Box>
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
          desc="Få hjelp til å skrive personlige, førsteinntrykk og oppfølgings-e-poster som faktisk får svar."
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
          title="Alt du trenger — samlet på ett sted"
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

function TestimonialsSection() {
  // Ingen ekte testimonials ennå → render ikke seksjonen i det hele tatt
  if (TESTIMONIALS.length === 0) return null;
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
      <Grid container spacing={3}>
        {TESTIMONIALS.map((t) => (
          <Grid item xs={12} md={4} key={t.name}>
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

function PricingSection() {
  return (
    <Box id="priser" sx={{ py: { xs: 8, md: 12 }, bgcolor: PALETTE.bgAlt }}>
      <Container maxWidth="lg">
        <SectionTitle title="Enkel og transparent prising" />
        <Grid container spacing={3} alignItems="stretch">
          {PRICING.map((p) => (
            <Grid item xs={12} md={4} key={p.name}>
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
                  {p.blurb}
                </Typography>
                <Stack direction="row" alignItems="baseline" spacing={1} mb={1}>
                  <Typography sx={{ fontWeight: 700, fontSize: 40, lineHeight: 1 }}>
                    kr {p.price}
                  </Typography>
                  <Typography sx={{ color: PALETTE.textFaint, fontSize: 14 }}>
                    /mnd
                  </Typography>
                </Stack>
                <Typography sx={{ color: PALETTE.textFaint, fontSize: 12, mb: 3 }}>
                  Faktureres årlig, ingen binding.
                </Typography>
                <Stack spacing={1} mb={3} flexGrow={1}>
                  {p.perks.map((perk) => (
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
                  {p.name === 'Team' ? 'Kontakt oss' : 'Start gratis'}
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
            Start gratis i dag — og se forskjellen på kartet.
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
            onClick={() => trackEvent('leadgrid_book_demo_clicked', { cta_location: 'final' })}
            href="/"
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
                src="/leadgrid/logo.png"
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

          {[
            { title: 'Produkt', links: ['Funksjoner', { label: 'Integrasjoner', href: '/leadgrid/connectors' }, { label: 'Connector Marketplace', href: '/leadgrid/connectors' }, 'Sikkerhet', 'Oppdateringer'] },
            { title: 'Løsninger', links: ['Salgsteam', 'Markedsføring', 'Franchise', 'Eiendomsmegling'] },
            { title: 'Ressurser', links: ['Hjelpesenter', 'Blogg', 'Guides', 'Webinarer'] },
            {
              title: 'Selskap',
              links: ['Om oss', 'Karriere', 'Kontakt oss', { label: 'Personvern', href: '/leadgrid/personvern' }],
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
            Norsk selskap 🇳🇴
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
