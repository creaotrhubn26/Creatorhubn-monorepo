/**
 * theroleroom-landing.tsx — root-landing for theroleroom.com
 *
 * Vises når host = theroleroom.com (eller localhost-flag).
 * For creatorhubn.com og andre domener: behold CreatorHubInvestorLanding.
 *
 * Sentral målgruppe: 3 brukersegmenter
 *   1. Skuespillere — talent-portfolio, self-tape-opptaker, audition-tilgang
 *   2. Byråer — talent-administrasjon, casting-flow, fakturering
 *   3. Produksjonsteam — casting-brief, shortlist, kontrakter, call-sheets
 *
 * Branding-konsistens: samme purple-gradient som /for-byraer + blog.
 */

import {
  Box, Button, Chip, Container, Stack, Typography, useTheme, useMediaQuery,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import MovieFilterOutlinedIcon from '@mui/icons-material/MovieFilterOutlined';
import { useEffect } from 'react';

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
  hero: 'https://v3b.fal.media/files/b/0a9d5de3/Ax4Sdyk0B4ROd_cxUpB7k_e9456626ba614512a36c699df12b9915.jpg',
  actor: 'https://v3b.fal.media/files/b/0a9d5de3/KQxFhVBZeCOi04xjqXcNO_ff5233da016b4e0d9787db15db5edc8e.jpg',
  agency: 'https://v3b.fal.media/files/b/0a9d5de3/X9VbGN_iDFd_4g52tXmly_68411e3ab8aa4486a93e8c767d28c30e.jpg',
  production: 'https://v3b.fal.media/files/b/0a9d5de3/CrJBGnwM89kTTYxehgzkg_a76b243c56624951bead4b307f5b1e17.jpg',
};

const SEGMENTS: Array<{
  id: 'actor' | 'agency' | 'production';
  Icon: React.ComponentType<{ sx?: object; fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>;
  label: string;
  title: string;
  body: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  photo: string;
}> = [
  {
    id: 'actor',
    Icon: VideocamOutlinedIcon,
    label: 'For skuespillere',
    title: 'Én profil. Alle audition-ene dine. Ingen WeTransfer.',
    body: 'Lag profesjonelle self-tapes rett fra telefonen, hold all audition-historikken samlet, og bli funnet av byrå og produsenter som faktisk leter etter deg.',
    bullets: [
      'Innebygget self-tape-opptaker med format-presets',
      'AI-feedback fra Claude på lyd, lys og takt',
      'Talent-portfolio som deles via lenke',
      'Granulær GDPR-kontroll over hvem som ser hva',
    ],
    ctaLabel: 'Opprett talent-profil',
    ctaHref: '/auth?role=actor',
    photo: PHOTOS.actor,
  },
  {
    id: 'agency',
    Icon: BusinessCenterOutlinedIcon,
    label: 'For skuespillerbyråer',
    title: 'Hele drift på én skjerm — talent, casting, fakturering.',
    body: 'CRM bygd for casting, ikke en Excel-erstatning. Per-prosjekt-tilgang til produsenter, automatisk fakturering via PowerOffice, GDPR-trygt fra dag 1.',
    bullets: [
      'Talent-registry med audit-trail per visning',
      'Per-prosjekt-tilgang for produsenter (ikke hele katalogen)',
      'Self-tape-håndtering uten WeTransfer-omveier',
      'PowerOffice-bro for automatisk fakturering',
    ],
    ctaLabel: 'Se byrå-pakken',
    ctaHref: '/for-byraer',
    photo: PHOTOS.agency,
  },
  {
    id: 'production',
    Icon: MovieFilterOutlinedIcon,
    label: 'For produksjonsteam',
    title: 'Casting-brief inn. Shortlist + signerte kontrakter ut.',
    body: 'Send brief til relevante byråer, motta forslag i ett dashboard, gjør callbacks og signer kontrakter — alt på samme sted, integrert med call-sheets.',
    bullets: [
      'Brief-templates som castere faktisk svarer på',
      'Shortlist + callbacks med innebygget self-tape-visning',
      'Kontraktssignering + call-sheet-integrasjon',
      'Budsjettsporing per rolle og dag',
    ],
    ctaLabel: 'Send casting-brief',
    ctaHref: '/auth?role=production',
    photo: PHOTOS.production,
  },
];

const TRUST_POINTS = [
  { Icon: PublicOutlinedIcon, label: 'EU-hostet (Schrems-trygt)' },
  { Icon: LockOutlinedIcon, label: 'GDPR Artikkel 30 + 17 ferdig' },
  { Icon: CheckCircleOutlineIcon, label: 'Norsk språk + norsk support' },
];

const PILLARS = [
  {
    title: 'Talent-portfolio',
    body: 'Headshots, showreel, audition-historikk, tilgjengelighet — alt på ett sted med granulær consent-kontroll.',
  },
  {
    title: 'Self-tape-opptaker',
    body: 'Innebygget opptaker med format-presets, AI-feedback fra Claude på takt, lys og lyd. Ingen WeTransfer.',
  },
  {
    title: 'Casting-flow',
    body: 'Brief → shortlist → callbacks → kontrakter → fakturering. Alt i ett dashboard, alt logget for GDPR.',
  },
  {
    title: 'Audit-trail',
    body: 'Hver visning av talent-data logges. Talenter kan se hvem som har sett deres profil og når.',
  },
];

const BLOG_TEASERS = [
  { slug: 'gdpr-sjekkliste-skuespillerbyraer', title: '12-punkts GDPR-sjekkliste for skuespillerbyråer', pillar: 'GDPR' },
  { slug: 'self-tape-praksis-norsk-skuespiller', title: 'Self-tape-praksis: hva castere ser etter i 2026', pillar: 'Self-tape' },
  { slug: 'crm-vs-excel-norske-casting-byraer', title: 'CRM vs Excel: hva regnearket faktisk koster byrået', pillar: 'CRM' },
];

export default function TheRoleRoomLanding() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // SEO + JSON-LD SoftwareApplication
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'The Role Room — Casting-plattform for norske skuespillere, byråer og produksjonsteam';

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
      'Casting-plattform for norske skuespillere, skuespillerbyråer og produksjonsteam. Self-tape-opptaker, talent-portfolio, casting-flow og GDPR-trygg administrasjon på ett sted.';
    const tags = [
      upsertMeta('description', description),
      upsertMeta('og:title', 'The Role Room — Casting-plattform for Norge', true),
      upsertMeta('og:description', description, true),
      upsertMeta('og:type', 'website', true),
      upsertMeta('og:url', 'https://theroleroom.com', true),
      upsertMeta('og:image', PHOTOS.hero, true),
      upsertMeta('og:locale', 'nb_NO', true),
      upsertMeta('twitter:card', 'summary_large_image'),
      upsertMeta('twitter:title', 'The Role Room — Casting-plattform for Norge'),
      upsertMeta('twitter:description', description),
    ];

    const ld = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'The Role Room',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', priceCurrency: 'NOK' },
      description,
      url: 'https://theroleroom.com',
      image: PHOTOS.hero,
      publisher: {
        '@type': 'Organization',
        name: 'Creatorhub AS',
        url: 'https://creatorhubn.com',
      },
      audience: [
        { '@type': 'Audience', audienceType: 'Actor' },
        { '@type': 'Audience', audienceType: 'Casting Agency' },
        { '@type': 'Audience', audienceType: 'Production Team' },
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
      <TopNav />
      <Hero isMobile={isMobile} />
      <SegmentsSection isMobile={isMobile} />
      <PillarsSection />
      <TrustStripFull />
      <BlogTeaserSection />
      <FinalCTASection />
      <Footer />
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// TopNav
// ──────────────────────────────────────────────────────────────────
function TopNav() {
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
            <Box sx={{ width: 28, height: 28, borderRadius: 1.2, background: palette.accentGradient }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.04rem', letterSpacing: -0.3 }}>
              The Role Room
            </Typography>
          </Box>
          <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {[
              { label: 'For skuespillere', href: '#segment-actor' },
              { label: 'For byråer', href: '/for-byraer' },
              { label: 'For produksjonsteam', href: '#segment-production' },
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
              href="/talents/registry"
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
              href="/auth"
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
// Hero
// ──────────────────────────────────────────────────────────────────
function Hero({ isMobile }: { isMobile: boolean }) {
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
              label="Norsk casting-plattform · pre-launch"
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
              Hele norsk casting{' '}
              <Box component="span" sx={{
                background: palette.accentGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                på ett sted
              </Box>
              .
            </Typography>
            <Typography
              sx={{
                color: palette.textSecondary,
                fontSize: { xs: '1rem', md: '1.18rem' },
                lineHeight: 1.55,
                mb: 3.6,
                maxWidth: 580,
              }}
            >
              Plattformen som kobler norske skuespillere, skuespillerbyråer og produksjonsteam — uten WeTransfer, uten Excel og uten amerikansk hosting.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.6} sx={{ mb: 3, justifyContent: { xs: 'center', md: 'flex-start' } }}>
              <Button
                href="#segments"
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
                Se hvordan det fungerer
              </Button>
              <Button
                href="/for-byraer#book-demo"
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
// SegmentsSection — 3 brukersegmenter med foto + tekst
// ──────────────────────────────────────────────────────────────────
function SegmentsSection({ isMobile }: { isMobile: boolean }) {
  return (
    <Container id="segments" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
          Bygd for tre roller
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
          Velg din vei inn
        </Typography>
        <Typography sx={{ color: palette.textSecondary, maxWidth: 640, mx: 'auto', fontSize: '1rem', lineHeight: 1.55 }}>
          Skuespiller? Byrå? Produsent? The Role Room gir hver av dere sin del av plattformen — bygd for hvordan dere faktisk jobber.
        </Typography>
      </Box>

      <Stack spacing={{ xs: 4, md: 6 }}>
        {SEGMENTS.map((seg, idx) => (
          <Stack
            key={seg.id}
            id={`segment-${seg.id}`}
            direction={{ xs: 'column', md: idx % 2 === 0 ? 'row' : 'row-reverse' }}
            spacing={{ xs: 3, md: 5 }}
            alignItems="center"
            sx={{
              bgcolor: palette.bgCard,
              border: `1px solid ${palette.borderSubtle}`,
              borderRadius: 3,
              p: { xs: 2.4, md: 4 },
              scrollMarginTop: 80,
            }}
          >
            <Box
              component="img"
              src={seg.photo}
              alt={`${seg.label} — illustrasjon`}
              loading="lazy"
              sx={{
                width: { xs: '100%', md: '40%' },
                aspectRatio: '4 / 3',
                objectFit: 'cover',
                borderRadius: 2,
                display: 'block',
              }}
            />
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.6 }}>
                <seg.Icon sx={{ color: palette.accentBright, fontSize: 22 }} />
                <Typography sx={{ color: palette.accentBright, fontSize: '0.84rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  {seg.label}
                </Typography>
              </Stack>
              <Typography
                component="h3"
                sx={{
                  fontSize: { xs: '1.4rem', md: '1.8rem' },
                  fontWeight: 800,
                  lineHeight: 1.2,
                  mb: 1.6,
                }}
              >
                {seg.title}
              </Typography>
              <Typography sx={{ color: palette.textSecondary, fontSize: '1rem', lineHeight: 1.6, mb: 2.4 }}>
                {seg.body}
              </Typography>
              <Stack component="ul" spacing={1.2} sx={{ pl: 0, listStyle: 'none', m: 0, mb: 3 }}>
                {seg.bullets.map((b) => (
                  <Stack key={b} component="li" direction="row" spacing={1} alignItems="flex-start">
                    <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 18, mt: 0.4, flexShrink: 0 }} />
                    <Typography sx={{ color: palette.textSecondary, fontSize: '0.95rem', lineHeight: 1.5 }}>
                      {b}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Button
                href={seg.ctaHref}
                endIcon={<ArrowForwardIcon />}
                sx={{
                  background: palette.accentGradient,
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 2.6,
                  py: 1.2,
                  borderRadius: 2,
                  '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                }}
              >
                {seg.ctaLabel}
              </Button>
            </Box>
          </Stack>
        ))}
      </Stack>
    </Container>
  );
}

// ──────────────────────────────────────────────────────────────────
// PillarsSection — produkt-funksjoner
// ──────────────────────────────────────────────────────────────────
function PillarsSection() {
  return (
    <Box sx={{ bgcolor: palette.bgShell, py: { xs: 6, md: 10 } }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
            Hva du faktisk får
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
            Produktet i fire deler
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: { xs: 2, md: 2.4 },
          }}
        >
          {PILLARS.map((p) => (
            <Box
              key={p.title}
              sx={{
                bgcolor: palette.bgCard,
                border: `1px solid ${palette.borderSubtle}`,
                borderRadius: 3,
                p: 2.8,
                transition: 'border-color 0.18s',
                '&:hover': { borderColor: palette.borderStrong },
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: '1.04rem', mb: 1, color: palette.textPrimary }}>
                {p.title}
              </Typography>
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem', lineHeight: 1.55 }}>
                {p.body}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// TrustStripFull — full-bredde trust-bånd
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
            { Icon: CheckCircleOutlineIcon, t: '2 ukers gratis', s: 'Ingen kortinfo, full tilgang' },
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
            Innsikt og praksis
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
function FinalCTASection() {
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
          Klar for å se hvordan din arbeidsdag ser ut?
        </Typography>
        <Typography sx={{ color: palette.textSecondary, fontSize: '1rem', mb: 3, maxWidth: 540, mx: 'auto' }}>
          30-min demo skreddersydd for din rolle — skuespiller, byrå eller produsent. Ingen forpliktelse, ingen salgs-pitch.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.6} justifyContent="center">
          <Button
            href="/for-byraer#book-demo"
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
            href="/auth"
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
            Opprett gratis konto
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}

// ──────────────────────────────────────────────────────────────────
// Footer
// ──────────────────────────────────────────────────────────────────
function Footer() {
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
            <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: palette.textPrimary, mb: 0.4 }}>
              The Role Room
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem' }}>
              Et produkt fra Creatorhub AS · Oslo, Norge
            </Typography>
          </Box>
          <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', gap: 1.2 }}>
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
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
