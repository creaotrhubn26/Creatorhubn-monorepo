/**
 * theroleroom-landing.tsx — root-landing for theroleroom.com
 *
 * Bygget med strikt tro mot THE-ROLE-ROOM-PRODUKTDOKUMENTASJON.md.
 *
 * Sentralt poeng (1.1 + 1.3):
 *   TheRoleRoom er IKKE en castingplattform. Det er operativsystemet for
 *   film- og innholdsproduksjon — fra idé via casting og gjennomføring
 *   til produksjonen er distribuert og sett av publikum.
 *
 * Manifest (6.4):
 *   "Hver god fortelling starter med de rette menneskene i de rette rollene."
 *
 * Vises når host = theroleroom.com (jf. LandingResponsive.tsx).
 */

import {
  Box, Button, Chip, Container, Stack, Typography, useTheme, useMediaQuery,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import MovieFilterOutlinedIcon from '@mui/icons-material/MovieFilterOutlined';
import CameraOutlinedIcon from '@mui/icons-material/CameraOutlined';
import MusicNoteOutlinedIcon from '@mui/icons-material/MusicNoteOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import { useEffect, useState } from 'react';
import LoginDialog from '@/components/role-room/components/LoginDialog';
import BookDemoModal from '@/components/role-room/BookDemoModal';
import {
  trackPageView,
  trackModalOpen,
  trackEvent,
} from '@/utils/ga4-client-tracking';
import { fireGoogleAdsConversion } from '@/utils/google-ads-conversions';

const palette = {
  bgRoot: '#0a0118',
  bgShell: '#0f0721',
  bgCard: '#150b2e',
  bgElevated: '#1a0f3a',
  border: 'rgba(168, 85, 247, 0.18)',
  borderStrong: 'rgba(168, 85, 247, 0.32)',
  borderSubtle: 'rgba(168, 85, 247, 0.08)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accentBright: '#c084fc',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

const PHOTOS = {
  // Atmospheric hero: empty casting room, MacBook with dashboard, no people
  hero: 'https://v3b.fal.media/files/b/0a9d5de3/Ax4Sdyk0B4ROd_cxUpB7k_e9456626ba614512a36c699df12b9915.jpg',
  // Production room
  production: 'https://v3b.fal.media/files/b/0a9d5de3/CrJBGnwM89kTTYxehgzkg_a76b243c56624951bead4b307f5b1e17.jpg',
  // Agency-side (talent registry context)
  agency: 'https://v3b.fal.media/files/b/0a9d5de3/X9VbGN_iDFd_4g52tXmly_68411e3ab8aa4486a93e8c767d28c30e.jpg',
  // Content producer
  contentProducer: 'https://v3b.fal.media/files/b/0a9d5cad/pY3EZ9l4TvCjg9mPpB6Xr_f7423f5ba38c458e88b2e27269c00008.jpg',
};

// 4 LIVE vertikaler + 1 AI-lag i beta (2.1)
// Talents-personaen dekker BÅDE agency-brukere (Talent Registry-flate) og
// skuespillere/talents (Talents-app/Self-tape Studio). LoginDialog viser
// fellesinngang som lar brukeren velge rolle inne i dialogen.
type VerticalPersona = 'production_team' | 'content_producer' | 'dance_studio' | 'talents' | '';

const VERTICALS: Array<{
  id: string;
  Icon: React.ComponentType<{ sx?: object; fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>;
  title: string;
  audience: string;
  priceNote: string;
  body: string;
  bullets: string[];
  status: 'live' | 'beta';
  /**
   * persona pre-velger riktig variant i LoginDialog. Talents har ingen egen persona
   * (login → vanlig landing-flow med fri valg).
   */
  persona: VerticalPersona;
}> = [
  {
    id: 'production-os',
    Icon: MovieFilterOutlinedIcon,
    title: 'Produksjons-OS',
    audience: 'Produksjonsteam (regissør, produsent, casting director, foto, manus)',
    priceNote: '795 kr/sete · min. 3 seter',
    body:
      'Eier produksjonen fra rollebesetning til ferdig levert, med transparent økonomi- og godkjenningsflyt mellom leverandør og kunde. Casting er inngangsdøra; men plattformen tar produksjonen videre — gjennom manus, crew, lokasjoner, produksjonsdager, budsjett og klientgodkjenning.',
    bullets: [
      'Casting & talent med dokumentert samtykke',
      'Produksjonsledelse (crew, lokasjoner, props, shot lists)',
      'Manus med versjonering + scene-breakdown',
      'Klient-samarbeid + budsjett (estimat vs. faktisk, NOK)',
    ],
    status: 'live',
    persona: 'production_team',
  },
  {
    id: 'content-producer',
    Icon: CameraOutlinedIcon,
    title: 'Innholdsprodusent-løsning',
    audience: 'Frilans/individuell innholdsprodusent',
    priceNote: '495 kr/sete · min. 1',
    body:
      'Tre jobber: digital markedsføring, innholdsplanlegging, og samarbeidssystem mellom innholdsprodusent og klient med transparent oversikt mellom partene. Alt utenom Agenten er live.',
    bullets: [
      'Marketing-plan + carousel-generator',
      'Feed-strategi + social publishing',
      'Klient-kommunikasjon med transparent oversikt',
      'Flere løpende klienter samtidig',
    ],
    status: 'live',
    persona: 'content_producer',
  },
  {
    id: 'dance',
    Icon: MusicNoteOutlinedIcon,
    title: 'Dansestudio-vertikal',
    audience: 'Profesjonelle dansere + dansestudio',
    priceNote: '149–2 490 kr/mnd · frilanser → studio enterprise',
    body:
      'Egen vertikal for profesjonelle dansere og dansestudio. Booking, koreografi-/produksjons-planlegging, casting til danseoppdrag, medlemshåndtering, formasjonstrening og event-dashboard.',
    bullets: [
      'Booking av timer + medlemshåndtering',
      'Koreografi + formasjonstrening',
      'Casting til danseoppdrag + auditions',
      'Skadelogg + øvingslogg',
    ],
    status: 'live',
    persona: 'dance_studio',
  },
  {
    id: 'talents',
    Icon: PeopleAltOutlinedIcon,
    title: 'Talents-app + Talent Registry',
    audience: 'Skuespillere + casting-byrå + produsenter',
    priceNote: 'Ny vertikal · skuespillere bor i byrå-host',
    body:
      'Den talent-vendte halvdelen — der Produksjons-OS handler om prosjektet, handler Talents-app om menneskene som besetter rollene. Talent Registry er agency-flate med 7-regions UI: KUN consent-filtrerte søk, audit-trail per visning, og reverse-consent ved foreslag.',
    bullets: [
      'Talent Registry — consent-filtrert agency-søk',
      'Self-tape Studio + AI-feedback',
      'Audit-trail: «hvem har sett meg?»',
      'BankID + per-org B2-storage i pipeline',
    ],
    status: 'live',
    persona: 'talents',
  },
];

const PILLARS = [
  {
    Icon: LayersOutlinedIcon,
    title: 'Eier hele flyten — idé til sett',
    body: 'De fleste verktøy stopper ved «ferdig produsert». The Role Room fortsetter til «sett av publikum». Annonsering, content marketing og publisering er bygd inn — ikke påheng.',
  },
  {
    Icon: LightbulbOutlinedIcon,
    title: 'Eier starten — idéen',
    body: 'Idé-pipeline gjør bruken kontinuerlig, ikke episodisk. Idéer forsvinner ikke; gode idéer som ellers ville gått tapt mellom produksjoner blir tatt vare på og modnet til klar-til-å-søke-finansiering.',
  },
  {
    Icon: HandshakeOutlinedIcon,
    title: 'Integrer, ikke angrip',
    body: 'NSF, NFI, NRK, TV2 og talent-databaser er partnere — ikke konkurrenter. Vi bygger systemet de selv vil bruke. Konkurrenten er fragmenteringen (Excel + e-post + WhatsApp), ikke en SaaS.',
  },
  {
    Icon: PublicOutlinedIcon,
    title: 'Norsk- og EU-native',
    body: 'EU-datalagring fra dag 1 (Render Frankfurt + Neon eu-west). EHF-faktura, NAV-rapport, BRREG, norsk juridisk data. BankID på vei. Internasjonale verktøy treffer ikke dette markedet på samme måte.',
  },
  {
    Icon: VisibilityOutlinedIcon,
    title: 'Transparens — «alle i loop»',
    body: 'Delt sannhet mellom leverandør og kunde, gjennom hele produksjonen. Klient ser fremdrift, budsjett-status og godkjenninger i samme system som produsenten — ingen e-post-tråder som dør.',
  },
  {
    Icon: AutoAwesomeOutlinedIcon,
    title: 'AI-lag på toppen',
    body: 'The Role Room Agent (beta) — drevet av Claude — planlegger, lager content, gir innsikt. Bygd særlig for innholdsprodusenter, med transparent oversikt mellom partene. Skipes når den er reell-trygg.',
  },
];

// Stages from idea → seen (1.1 + 1.2)
const FLOW_STAGES = [
  { label: 'Idé', detail: 'Modnes til klar-til-å-søke-finansiering' },
  { label: 'Manus', detail: 'Ett kontrollert manus, ikke 12 e-postversjoner' },
  { label: 'Casting', detail: 'Inngangsdøra: rollebesetning med dokumentert consent' },
  { label: 'Produksjon', detail: 'Crew, lokasjoner, dager, budsjett — i ett system' },
  { label: 'Post', detail: 'Post Agent som on-ramp, sømløst videre til Resolve' },
  { label: 'Distribusjon', detail: 'Meta, Google, LinkedIn, TikTok — i samme grensesnitt' },
  { label: 'Sett', detail: 'Produksjonen når publikum — løftet er ikke ferdig før dette' },
];

const TRUST_POINTS = [
  { Icon: PublicOutlinedIcon, label: 'EU-hostet (Schrems-trygt)' },
  { Icon: LockOutlinedIcon, label: 'GDPR Artikkel 30 + 17 ferdig' },
  { Icon: CheckCircleOutlineIcon, label: 'Norsk team, norsk språk' },
];

const BLOG_TEASERS = [
  { slug: 'gdpr-sjekkliste-skuespillerbyraer', title: '12-punkts GDPR-sjekkliste for skuespillerbyråer', pillar: 'GDPR + Talents' },
  { slug: 'self-tape-praksis-norsk-skuespiller', title: 'Self-tape-praksis: hva castere ser etter i 2026', pillar: 'Casting-prosess' },
  { slug: 'crm-vs-excel-norske-casting-byraer', title: 'Hvorfor regnearket koster byrået 250.000 kr i året', pillar: 'Operativ effektivisering' },
];

interface TheRoleRoomLandingProps {
  /** Kall etter vellykket innlogging — typisk window.location.reload(). */
  onEnter?: () => void;
}

export default function TheRoleRoomLanding({ onEnter }: TheRoleRoomLandingProps = {}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Login modal — gjenbruker LoginDialog fra casting-main shell.
  // Variant 'landing' = vanlig brukerlogg-inn, 'admin' = backoffice-tilgang.
  type LoginVariant = 'landing' | 'admin';
  type LoginPersonaPrefill = '' | 'production_team' | 'content_producer' | 'education_institution' | 'dance_studio' | 'talents';
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginVariant, setLoginVariant] = useState<LoginVariant>('landing');
  const [loginPersona, setLoginPersona] = useState<LoginPersonaPrefill>('');
  const openLogin = (variant: LoginVariant = 'landing', persona: LoginPersonaPrefill = '') => {
    setLoginVariant(variant);
    setLoginPersona(persona);
    setLoginOpen(true);
    trackModalOpen({
      modalName: 'login_dialog',
      trigger: variant === 'admin' ? 'admin_footer' : (persona || 'login_button'),
      profession: persona || undefined,
    });
  };
  const closeLogin = () => setLoginOpen(false);

  // Book demo-modal — dedikert B2B-intake (erstatter /for-byraer#book-demo-anker).
  const [bookDemoOpen, setBookDemoOpen] = useState(false);
  const [bookDemoTrigger, setBookDemoTrigger] = useState('book_demo');
  const openBookDemo = (trigger = 'book_demo') => {
    setBookDemoTrigger(trigger);
    setBookDemoOpen(true);
    trackModalOpen({ modalName: 'book_demo', trigger });
  };
  const closeBookDemo = () => setBookDemoOpen(false);

  // Dyplenking: ?signup=<persona> åpner commercial-onboarding (brukt av demo-
  // konverterings-lenken fra Admin Room CRM), ?book_demo=1 åpner Book demo-modalen.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const signup = params.get('signup');
      const validPersonas: LoginPersonaPrefill[] = [
        'production_team', 'content_producer', 'education_institution', 'dance_studio', 'talents',
      ];
      if (signup && (validPersonas as string[]).includes(signup)) {
        openLogin('landing', signup as LoginPersonaPrefill);
      } else if (params.get('book_demo') || params.has('demo')) {
        openBookDemo('deep_link');
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleLoginSuccess = () => {
    trackEvent('login_success', {
      login_variant: loginVariant,
      persona: loginPersona || undefined,
      surface: 'theroleroom_landing',
    });
    void fireGoogleAdsConversion('signup');
    closeLogin();
    if (onEnter) {
      onEnter();
    } else {
      window.location.reload();
    }
  };

  // GA4 page-view ved mount.
  useEffect(() => {
    trackPageView('/', 'The Role Room — Operativsystem for film- og innholdsproduksjon');
    trackEvent('landing_view', { landing: 'theroleroom_root', surface: 'theroleroom.com' });
  }, []);

  // SEO + JSON-LD SoftwareApplication
  useEffect(() => {
    const previousTitle = document.title;
    document.title =
      'The Role Room — Operativsystemet for film- og innholdsproduksjon';

    const upsertMeta = (name: string, content: string, isProp = false) => {
      const attr = isProp ? 'property' : 'name';
      let tag = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
      return tag;
    };

    const description =
      'Operativsystemet som tar en norsk produksjon fra idé via casting og gjennomføring til den er distribuert og sett av publikum. Fire live vertikaler: Produksjons-OS, Innholdsprodusent, Dansestudio og Talent Registry. AI-Agent i beta. Pre-revenue, EU-hostet, bygget i Norge.';
    const tags = [
      upsertMeta('description', description),
      upsertMeta('og:title', 'The Role Room — Operativsystem for film- og innholdsproduksjon', true),
      upsertMeta('og:description', description, true),
      upsertMeta('og:type', 'website', true),
      upsertMeta('og:url', 'https://theroleroom.com', true),
      upsertMeta('og:image', PHOTOS.hero, true),
      upsertMeta('og:locale', 'nb_NO', true),
      upsertMeta('twitter:card', 'summary_large_image'),
      upsertMeta('twitter:title', 'The Role Room — Operativsystem for film- og innholdsproduksjon'),
      upsertMeta('twitter:description', description),
    ];

    const ld = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'The Role Room',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: [
        { '@type': 'Offer', name: 'Produksjonsteam', priceCurrency: 'NOK', price: '795', description: 'per sete/mnd, min. 3 seter' },
        { '@type': 'Offer', name: 'Innholdsprodusent', priceCurrency: 'NOK', price: '495', description: 'per sete/mnd, min. 1' },
        { '@type': 'Offer', name: 'Dansestudio', priceCurrency: 'NOK', description: '149–2 490 kr/mnd' },
      ],
      description,
      url: 'https://theroleroom.com',
      image: PHOTOS.hero,
      publisher: {
        '@type': 'Organization',
        name: 'Creatorhub AS',
        url: 'https://creatorhubn.com',
      },
      audience: [
        { '@type': 'Audience', audienceType: 'Production Team' },
        { '@type': 'Audience', audienceType: 'Content Producer' },
        { '@type': 'Audience', audienceType: 'Dance Studio' },
        { '@type': 'Audience', audienceType: 'Casting Agency' },
        { '@type': 'Audience', audienceType: 'Actor / Talent' },
      ],
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'trr-jsonld';
    script.textContent = JSON.stringify(ld);
    document.head.appendChild(script);

    return () => {
      document.title = previousTitle;
      tags.forEach((t) => t.remove?.());
      document.getElementById('trr-jsonld')?.remove();
    };
  }, []);

  return (
    <Box sx={{ bgcolor: palette.bgRoot, color: palette.textPrimary, minHeight: '100vh' }}>
      <TopNav
        onLogin={() => openLogin('landing')}
        onTalentsLogin={() => openLogin('landing', 'talents')}
      />
      <Hero
        isMobile={isMobile}
        onLogin={() => openLogin('landing')}
        onBookDemo={() => openBookDemo('hero')}
      />
      <ManifestoStrip />
      <FlowSection />
      <VerticalsSection onLogin={(persona) => openLogin('landing', persona)} />
      <PillarsSection />
      <TrustStripFull />
      <BlogTeaserSection />
      <FinalCTASection
        onLogin={() => openLogin('landing')}
        onBookDemo={() => openBookDemo('final_cta')}
      />
      <Footer onAdminLogin={() => openLogin('admin')} />
      <LoginDialog
        open={loginOpen}
        onClose={closeLogin}
        onLoginSuccess={handleLoginSuccess}
        isLandingPage={loginVariant === 'landing'}
        initialPersona={loginPersona}
      />
      <BookDemoModal open={bookDemoOpen} onClose={closeBookDemo} trigger={bookDemoTrigger} />
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// TopNav
// ──────────────────────────────────────────────────────────────────
function TopNav({ onLogin, onTalentsLogin }: { onLogin: () => void; onTalentsLogin: () => void }) {
  return (
    <Box
      component="nav"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: 'rgba(10, 1, 24, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${palette.borderSubtle}`,
      }}
    >
      <Container maxWidth="lg">
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 2 }}>
          <Box
            component="a"
            href="/"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: palette.textPrimary, textDecoration: 'none' }}
          >
            <Box
              component="img"
              src="/role-room-assets/TheRoleRoom_Logo.webp"
              alt="The Role Room"
              sx={{ height: 32, width: 'auto', objectFit: 'contain', display: 'block' }}
            />
            <Typography sx={{ fontWeight: 800, fontSize: '1.04rem', letterSpacing: -0.3 }}>
              The Role Room
            </Typography>
          </Box>
          <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {[
              { label: 'Produksjons-OS', href: '#vertical-production-os' },
              { label: 'Innholdsprodusent', href: '#vertical-content-producer' },
              { label: 'Dans', href: '#vertical-dance' },
              { label: 'Talents', href: '#vertical-talents' },
              { label: 'Blog', href: '/blog' },
            ].map((it) => (
              <Box
                key={it.href}
                component="a"
                href={it.href}
                sx={{
                  color: palette.textSecondary,
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  '&:hover': { color: palette.accentBright },
                }}
              >
                {it.label}
              </Box>
            ))}
          </Stack>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Button
              onClick={onTalentsLogin}
              sx={{
                bgcolor: 'transparent',
                color: palette.accentBright,
                textTransform: 'none',
                fontWeight: 700,
                px: 2,
                py: 1,
                borderRadius: 2,
                border: `1px solid ${palette.borderStrong}`,
                display: { xs: 'none', sm: 'inline-flex' },
                '&:hover': { bgcolor: 'rgba(168,85,247,0.08)', borderColor: palette.accentBright },
              }}
            >
              Talent Registry
            </Button>
            <Button
              onClick={onLogin}
              sx={{
                background: palette.accentGradient,
                color: '#fff',
                textTransform: 'none',
                fontWeight: 700,
                px: 2.4,
                py: 1,
                borderRadius: 2,
                '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
              }}
            >
              Logg inn
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// Hero — positioneringen dok seksjon 1.1 + 1.2
// ──────────────────────────────────────────────────────────────────
function Hero({ isMobile, onLogin, onBookDemo }: { isMobile: boolean; onLogin: () => void; onBookDemo: () => void }) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        background: `
          radial-gradient(ellipse at top right, rgba(168, 85, 247, 0.16), transparent 60%),
          radial-gradient(ellipse at bottom left, rgba(217, 70, 239, 0.10), transparent 60%),
          ${palette.bgRoot}
        `,
        pt: { xs: 6, md: 10 },
        pb: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 4, md: 6 }}
          alignItems="center"
        >
          <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
            <Chip
              label="Pre-launch · norsk · pre-revenue"
              sx={{
                bgcolor: 'rgba(168,85,247,0.12)',
                color: palette.accentBright,
                fontWeight: 700,
                fontSize: '0.76rem',
                mb: 3,
              }}
            />
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: '2.2rem', sm: '2.8rem', md: '3.6rem' },
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -0.6,
                mb: 2.4,
              }}
            >
              Operativsystemet for{' '}
              <Box component="span" sx={{
                background: palette.accentGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                film- og innholdsproduksjon
              </Box>
              .
            </Typography>
            <Typography
              sx={{
                color: palette.textSecondary,
                fontSize: { xs: '1rem', md: '1.18rem' },
                lineHeight: 1.55,
                mb: 3.6,
                maxWidth: 600,
              }}
            >
              Fra idé og planlegging, gjennom casting og gjennomføring, helt til produksjonen er distribuert og sett av publikum. Casting er inngangsdøra — men reisen videre er det produktet eier.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.6} sx={{ mb: 3, justifyContent: { xs: 'center', md: 'flex-start' } }}>
              <Button
                href="#flow"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  background: palette.accentGradient,
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 3,
                  py: 1.4,
                  borderRadius: 2,
                  fontSize: '1rem',
                  '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                }}
              >
                Se hele flyten
              </Button>
              <Button
                onClick={onBookDemo}
                sx={{
                  bgcolor: 'transparent',
                  color: palette.textPrimary,
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 3,
                  py: 1.4,
                  borderRadius: 2,
                  fontSize: '1rem',
                  border: `1px solid ${palette.borderStrong}`,
                  '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
                }}
              >
                Book demo
              </Button>
            </Stack>
            <Stack direction="row" spacing={2.4} sx={{ flexWrap: 'wrap', gap: 1.2, justifyContent: { xs: 'center', md: 'flex-start' } }}>
              {TRUST_POINTS.map((p) => (
                <Stack key={p.label} direction="row" alignItems="center" spacing={0.6}>
                  <p.Icon sx={{ color: '#34d399', fontSize: 16 }} />
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem', fontWeight: 600 }}>
                    {p.label}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          {!isMobile ? (
            <Box sx={{ flex: 1, position: 'relative' }}>
              <Box
                component="img"
                src={PHOTOS.hero}
                alt="Modernt skandinavisk casting-rom — director's chair, MacBook med dashboard, golden hour-lys."
                loading="eager"
                sx={{
                  width: '100%',
                  aspectRatio: '4 / 3',
                  objectFit: 'cover',
                  borderRadius: 3,
                  border: `1px solid ${palette.border}`,
                  boxShadow: '0 24px 80px rgba(168,85,247,0.28)',
                  display: 'block',
                }}
              />
            </Box>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// ManifestoStrip — den definerende setningen (6.4)
// ──────────────────────────────────────────────────────────────────
function ManifestoStrip() {
  return (
    <Box sx={{ bgcolor: palette.bgShell, py: { xs: 5, md: 7 }, borderTop: `1px solid ${palette.borderSubtle}`, borderBottom: `1px solid ${palette.borderSubtle}` }}>
      <Container maxWidth="md" sx={{ textAlign: 'center' }}>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 2, mb: 2, textTransform: 'uppercase' }}>
          Manifest
        </Typography>
        <Typography
          component="blockquote"
          sx={{
            fontSize: { xs: '1.4rem', sm: '1.8rem', md: '2.2rem' },
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: -0.3,
            fontStyle: 'italic',
            color: palette.textPrimary,
            m: 0,
            mb: 2,
            '&::before': { content: '"\\201C"', color: palette.accentBright, fontSize: '1.4em', verticalAlign: '-0.2em', mr: 1 },
            '&::after': { content: '"\\201D"', color: palette.accentBright, fontSize: '1.4em', verticalAlign: '-0.2em', ml: 1 },
          }}
        >
          Hver god fortelling starter med de rette menneskene i de rette rollene.
        </Typography>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem' }}>
          The Role Room — kategori-manifestet
        </Typography>
      </Container>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// FlowSection — idé → sett (1.1, 1.2)
// ──────────────────────────────────────────────────────────────────
function FlowSection() {
  return (
    <Container id="flow" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
          Den røde tråden
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: '1.8rem', md: '2.4rem' },
            fontWeight: 800,
            lineHeight: 1.15,
            mb: 1.6,
          }}
        >
          Fra idé til sett
        </Typography>
        <Typography sx={{ color: palette.textSecondary, maxWidth: 720, mx: 'auto', fontSize: '1rem', lineHeight: 1.6 }}>
          De fleste verktøy dekker bare ett trinn. The Role Room samler hele produksjonens livsløp i ett system, organisert rundt <strong>produksjonen</strong> som enhet — ikke rundt en person eller en isolert oppgave.
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(7, 1fr)' },
          gap: { xs: 1.4, md: 1 },
          position: 'relative',
        }}
      >
        {FLOW_STAGES.map((s, idx) => (
          <Box
            key={s.label}
            sx={{
              position: 'relative',
              bgcolor: palette.bgCard,
              border: `1px solid ${palette.borderSubtle}`,
              borderRadius: 2,
              p: { xs: 1.8, md: 1.6 },
              minHeight: { md: 130 },
              display: 'flex',
              flexDirection: 'column',
              transition: 'border-color 0.18s, transform 0.18s',
              '&:hover': { borderColor: palette.borderStrong, transform: 'translateY(-2px)' },
            }}
          >
            <Typography
              sx={{
                color: palette.accentBright,
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: 'uppercase',
                mb: 0.6,
              }}
            >
              {idx + 1}
            </Typography>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '1rem',
                color: palette.textPrimary,
                mb: 0.8,
                lineHeight: 1.25,
              }}
            >
              {s.label}
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.78rem', lineHeight: 1.4, flex: 1 }}>
              {s.detail}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography
        sx={{
          color: palette.textMuted,
          fontSize: '0.84rem',
          textAlign: 'center',
          mt: 3,
          maxWidth: 640,
          mx: 'auto',
          lineHeight: 1.55,
        }}
      >
        Konkurrenten er <strong style={{ color: palette.textSecondary }}>fragmenteringen</strong> — Excel + e-post + WhatsApp + Facebook. Ikke en SaaS. Vi vinner ved å eie alle 7 trinnene som ett system.
      </Typography>
    </Container>
  );
}

// ──────────────────────────────────────────────────────────────────
// VerticalsSection — 4 live + Agent beta (2.1)
// ──────────────────────────────────────────────────────────────────
function VerticalsSection({ onLogin }: { onLogin: (persona: VerticalPersona) => void }) {
  return (
    <Box sx={{ bgcolor: palette.bgShell, py: { xs: 6, md: 10 } }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
            Fire live vertikaler + ett AI-lag i beta
          </Typography>
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              fontWeight: 800,
              lineHeight: 1.15,
              mb: 1.6,
            }}
          >
            Bygget for hvordan dere faktisk jobber
          </Typography>
          <Typography sx={{ color: palette.textSecondary, maxWidth: 700, mx: 'auto', fontSize: '1rem', lineHeight: 1.6 }}>
            Hver vertikal har sin egen flate, sine egne workflows og sin egen pris-tier. Talents-app er den nyeste — bygget for å koble byrå og skuespiller med GDPR-trygg consent fra dag 1.
          </Typography>
        </Box>

        <Stack spacing={{ xs: 3, md: 4 }}>
          {VERTICALS.map((v, idx) => (
            <Box
              key={v.id}
              id={`vertical-${v.id}`}
              sx={{
                bgcolor: palette.bgCard,
                border: `1px solid ${palette.borderSubtle}`,
                borderRadius: 3,
                p: { xs: 2.4, md: 3.6 },
                scrollMarginTop: 80,
                transition: 'border-color 0.18s',
                '&:hover': { borderColor: palette.borderStrong },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2.4 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    bgcolor: 'rgba(168,85,247,0.14)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <v.Icon sx={{ color: palette.accentBright, fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 0.6, flexWrap: 'wrap', gap: 0.6 }}>
                    <Typography sx={{ color: palette.textPrimary, fontSize: { xs: '1.3rem', md: '1.5rem' }, fontWeight: 800, lineHeight: 1.2 }}>
                      {v.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={v.status === 'live' ? 'LIVE' : 'BETA'}
                      sx={{
                        bgcolor: v.status === 'live' ? 'rgba(52,211,153,0.18)' : 'rgba(251,191,36,0.18)',
                        color: v.status === 'live' ? '#34d399' : '#fbbf24',
                        fontWeight: 800,
                        fontSize: '0.7rem',
                        height: 20,
                      }}
                    />
                    {idx === 3 ? (
                      <Chip
                        size="small"
                        label="NY"
                        sx={{
                          bgcolor: 'rgba(192,132,252,0.18)',
                          color: palette.accentBright,
                          fontWeight: 800,
                          fontSize: '0.7rem',
                          height: 20,
                        }}
                      />
                    ) : null}
                  </Stack>
                  <Typography sx={{ color: palette.textSecondary, fontSize: '0.94rem', mb: 0.4 }}>
                    {v.audience}
                  </Typography>
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                    {v.priceNote}
                  </Typography>
                </Box>
                <Button
                  onClick={() => onLogin(v.persona)}
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    background: palette.accentGradient,
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 2.4,
                    py: 1.2,
                    borderRadius: 2,
                    flexShrink: 0,
                    '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                  }}
                >
                  Utforsk
                </Button>
              </Stack>
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.96rem', lineHeight: 1.6, mb: 2 }}>
                {v.body}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  gap: 1.4,
                }}
              >
                {v.bullets.map((b) => (
                  <Stack key={b} direction="row" spacing={1} alignItems="flex-start">
                    <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 18, mt: 0.3, flexShrink: 0 }} />
                    <Typography sx={{ color: palette.textSecondary, fontSize: '0.9rem', lineHeight: 1.5 }}>
                      {b}
                    </Typography>
                  </Stack>
                ))}
              </Box>
            </Box>
          ))}

          {/* The Role Room Agent — beta */}
          <Box
            sx={{
              bgcolor: 'rgba(251,191,36,0.04)',
              border: `1px dashed rgba(251,191,36,0.32)`,
              borderRadius: 3,
              p: { xs: 2.4, md: 3.6 },
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', md: 'center' }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  bgcolor: 'rgba(251,191,36,0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AutoAwesomeOutlinedIcon sx={{ color: '#fbbf24', fontSize: 28 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 0.6 }}>
                  <Typography sx={{ color: palette.textPrimary, fontSize: { xs: '1.2rem', md: '1.4rem' }, fontWeight: 800 }}>
                    The Role Room Agent
                  </Typography>
                  <Chip
                    size="small"
                    label="BETA · ikke skipet"
                    sx={{
                      bgcolor: 'rgba(251,191,36,0.18)',
                      color: '#fbbf24',
                      fontWeight: 800,
                      fontSize: '0.7rem',
                      height: 20,
                    }}
                  />
                </Stack>
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.94rem', lineHeight: 1.55 }}>
                  AI-lag drevet av Claude. Konkurrentanalyse, partner-discovery, merch-kobling, ads & markedsføring — alt med transparent oversikt mellom partene. Skipes når den er reell-trygg for kunder.
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// PillarsSection — 6 unike posisjoner (6.5)
// ──────────────────────────────────────────────────────────────────
function PillarsSection() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
          Det ingen andre har
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: '1.8rem', md: '2.4rem' },
            fontWeight: 800,
            lineHeight: 1.15,
            mb: 1.6,
          }}
        >
          Seks unike posisjoner
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: { xs: 2, md: 2.8 },
        }}
      >
        {PILLARS.map((p) => (
          <Box
            key={p.title}
            sx={{
              bgcolor: palette.bgCard,
              border: `1px solid ${palette.borderSubtle}`,
              borderRadius: 3,
              p: 3,
              transition: 'border-color 0.18s',
              '&:hover': { borderColor: palette.borderStrong },
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 1.6,
                bgcolor: 'rgba(168,85,247,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <p.Icon sx={{ color: palette.accentBright, fontSize: 22 }} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.06rem', mb: 1.2, color: palette.textPrimary, lineHeight: 1.25 }}>
              {p.title}
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem', lineHeight: 1.6 }}>
              {p.body}
            </Typography>
          </Box>
        ))}
      </Box>
    </Container>
  );
}

// ──────────────────────────────────────────────────────────────────
// TrustStripFull
// ──────────────────────────────────────────────────────────────────
function TrustStripFull() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Box
        sx={{
          bgcolor: 'rgba(168,85,247,0.06)',
          border: `1px solid ${palette.borderSubtle}`,
          borderRadius: 3,
          px: { xs: 2.4, md: 4 },
          py: { xs: 2.8, md: 3.4 },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          justifyContent="space-around"
          alignItems="center"
          sx={{ gap: 2 }}
        >
          {[
            { Icon: PublicOutlinedIcon, t: 'EU-hostet', s: 'Render Frankfurt + Neon eu-west' },
            { Icon: LockOutlinedIcon, t: 'GDPR-trygt', s: 'Artikkel 30, 17 + audit-trail' },
            { Icon: PeopleAltOutlinedIcon, t: 'Norsk team', s: 'Oslo-basert, norsk support' },
            { Icon: CheckCircleOutlineIcon, t: 'Pre-revenue', s: 'Modellen er klar; kunder kommer' },
          ].map((p) => (
            <Stack key={p.t} direction="row" alignItems="center" spacing={1.4}>
              <p.Icon sx={{ color: palette.accentBright, fontSize: 28 }} />
              <Box>
                <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '0.94rem' }}>
                  {p.t}
                </Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                  {p.s}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Container>
  );
}

// ──────────────────────────────────────────────────────────────────
// BlogTeaserSection
// ──────────────────────────────────────────────────────────────────
function BlogTeaserSection() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} sx={{ mb: { xs: 3, md: 4 }, gap: 2 }}>
        <Box>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
            Innsikt for hele produksjons-flyten
          </Typography>
          <Typography
            component="h2"
            sx={{ fontSize: { xs: '1.6rem', md: '2.2rem' }, fontWeight: 800, lineHeight: 1.15 }}
          >
            Fra blog-en vår
          </Typography>
        </Box>
        <Button
          href="/blog"
          endIcon={<ArrowForwardIcon />}
          sx={{
            color: palette.accentBright,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.94rem',
            '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
          }}
        >
          Se alle artikler
        </Button>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 2.4,
        }}
      >
        {BLOG_TEASERS.map((t) => (
          <Box
            key={t.slug}
            component="a"
            href={`/blog/${t.slug}`}
            sx={{
              bgcolor: palette.bgCard,
              border: `1px solid ${palette.borderSubtle}`,
              borderRadius: 3,
              p: 2.8,
              textDecoration: 'none',
              color: 'inherit',
              transition: 'border-color 0.18s, transform 0.18s',
              '&:hover': { borderColor: palette.borderStrong, transform: 'translateY(-2px)' },
            }}
          >
            <Chip
              label={t.pillar}
              size="small"
              sx={{
                bgcolor: 'rgba(168,85,247,0.16)',
                color: palette.accentBright,
                fontWeight: 700,
                mb: 1.6,
              }}
            />
            <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.04rem', lineHeight: 1.3 }}>
              {t.title}
            </Typography>
          </Box>
        ))}
      </Box>
    </Container>
  );
}

// ──────────────────────────────────────────────────────────────────
// FinalCTASection
// ──────────────────────────────────────────────────────────────────
function FinalCTASection({ onLogin, onBookDemo }: { onLogin: () => void; onBookDemo: () => void }) {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
      <Box
        sx={{
          textAlign: 'center',
          p: { xs: 4, md: 6 },
          bgcolor: 'rgba(168,85,247,0.08)',
          border: `1px solid ${palette.borderStrong}`,
          borderRadius: 4,
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', md: '2.2rem' }, mb: 1.6, lineHeight: 1.2 }}>
          Klar for å se hvordan din produksjon flyter?
        </Typography>
        <Typography sx={{ color: palette.textSecondary, fontSize: '1rem', mb: 3, maxWidth: 540, mx: 'auto' }}>
          30-min demo skreddersydd for din vertikal — produksjonsteam, innholdsprodusent, dansestudio eller byrå. Ingen forpliktelse.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.6} justifyContent="center">
          <Button
            onClick={onBookDemo}
            endIcon={<ArrowForwardIcon />}
            sx={{
              background: palette.accentGradient,
              color: '#fff',
              textTransform: 'none',
              fontWeight: 700,
              px: 3.2,
              py: 1.4,
              borderRadius: 2,
              fontSize: '1rem',
              '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
            }}
          >
            Book demo
          </Button>
          <Button
            onClick={onLogin}
            sx={{
              bgcolor: 'transparent',
              color: palette.textPrimary,
              textTransform: 'none',
              fontWeight: 700,
              px: 3.2,
              py: 1.4,
              borderRadius: 2,
              fontSize: '1rem',
              border: `1px solid ${palette.borderStrong}`,
              '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
            }}
          >
            Opprett konto
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}

// ──────────────────────────────────────────────────────────────────
// Footer
// ──────────────────────────────────────────────────────────────────
function Footer({ onAdminLogin }: { onAdminLogin: () => void }) {
  return (
    <Box sx={{ borderTop: `1px solid ${palette.borderSubtle}`, mt: 6 }}>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={3}
        >
          <Box>
            <Box
              component="img"
              src="/role-room-assets/TheRoleRoom_Logo_Tagline.webp"
              alt="The Role Room — Casting. Roles. Together."
              sx={{ height: 44, width: 'auto', objectFit: 'contain', display: 'block', mb: 1 }}
            />
            <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem' }}>
              Operativsystemet for film- og innholdsproduksjon · Et produkt fra Creatorhub AS · Oslo, Norge
            </Typography>
          </Box>
          <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', gap: 1.2, alignItems: 'center' }}>
            {[
              { label: 'For byråer', href: '/for-byraer' },
              { label: 'Blog', href: '/blog' },
              { label: 'FAQ', href: '/faq' },
              { label: 'Pitch', href: '/pitch' },
              { label: 'Creatorhub AS', href: 'https://creatorhubn.com' },
            ].map((it) => (
              <Box
                key={it.href}
                component="a"
                href={it.href}
                sx={{
                  color: palette.textMuted,
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  '&:hover': { color: palette.accentBright },
                }}
              >
                {it.label}
              </Box>
            ))}
            {/* Admin-login — egen variant av LoginDialog (isLandingPage=false). */}
            <Box
              component="button"
              onClick={onAdminLogin}
              sx={{
                color: palette.textMuted,
                fontSize: '0.86rem',
                fontWeight: 600,
                textDecoration: 'none',
                bgcolor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                p: 0,
                '&:hover': { color: palette.accentBright },
              }}
            >
              Admin
            </Box>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
