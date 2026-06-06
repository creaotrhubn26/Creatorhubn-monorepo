/**
 * agency-landing.tsx — /for-byraer
 *
 * Dedikert landingsside for skuespillerbyråer på theroleroom.com.
 * Designet uavhengig av eksisterende landings-pages.
 *
 * Strategi:
 *   1. Hero med tydelig verdi-pitch (ikke teknisk)
 *   2. Smerte-bevisstgjøring (det Excel-arket de bruker i dag)
 *   3. Løsning med 4 emosjonelle knagger (risiko / tid / status / eierskap)
 *   4. Sosial bevis (Stella + Skuespillersenter logoer)
 *   5. En vanlig casting-dag — fortelling
 *   6. Pricing-teaser (link til full pricing)
 *   7. Lead-form (POST /api/public/agency-lead)
 *   8. FAQ-teaser
 */

import {
  Alert, Box, Button, Container, IconButton, Stack, TextField, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useEffect, useState } from 'react';

// ── Design-tokens (samme palett som Talents-app) ──────────────────
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
  accent: '#a855f7',
  accentBright: '#c084fc',
  accentDeep: '#7c3aed',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
  glow: '0 0 32px rgba(168, 85, 247, 0.18)',
};

export default function AgencyLandingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // SEO + GEO: meta-tags + JSON-LD structured data
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'The Role Room — Casting-CRM for norske skuespillerbyråer';

    const upsertMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let tag = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
      return tag;
    };

    const description = 'Operativsystemet for norske skuespillerbyråer. Talent-register, self-tape-studio, casting-partnerships og GDPR-audit på ett sted. 2 ukers gratis prøvetid.';

    const tags = [
      upsertMeta('description', description),
      upsertMeta('keywords', 'casting CRM, skuespillerbyrå, self-tape, talent register, casting Norge, agencies, byrå-software, GDPR talent-administrasjon'),
      upsertMeta('og:title', 'The Role Room — Casting-CRM for byråer', true),
      upsertMeta('og:description', description, true),
      upsertMeta('og:type', 'website', true),
      upsertMeta('og:url', 'https://theroleroom.com/for-byraer', true),
      upsertMeta('og:locale', 'nb_NO', true),
      upsertMeta('twitter:card', 'summary_large_image'),
      upsertMeta('twitter:title', 'The Role Room — Casting-CRM for byråer'),
      upsertMeta('twitter:description', description),
    ];

    // JSON-LD: SoftwareApplication + Organization
    const ldJson = [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'The Role Room',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, iOS, Android',
        description,
        url: 'https://theroleroom.com/for-byraer',
        offers: [
          { '@type': 'Offer', name: 'Solo Agent', price: '495', priceCurrency: 'NOK', priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M' } },
          { '@type': 'Offer', name: 'Boutique', price: '1495', priceCurrency: 'NOK', priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M' } },
          { '@type': 'Offer', name: 'Professional', price: '3495', priceCurrency: 'NOK', priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M' } },
        ],
        featureList: [
          'Talent-register med BankID-verifisering',
          'Self-tape-studio i nettleseren',
          'AI-feedback fra Claude Opus 4.7',
          'Casting-partnership med produksjonsteam',
          'GDPR-audit-trail per visning',
          'Mobile-first iPad og iPhone',
        ],
        provider: {
          '@type': 'Organization',
          name: 'CreatorHub',
          url: 'https://creatorhubn.com',
          email: 'daniel@creatorhubn.com',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'The Role Room',
        url: 'https://theroleroom.com',
        logo: 'https://theroleroom.com/og-image.png',
        sameAs: ['https://creatorhubn.com'],
      },
    ];

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'agency-landing-jsonld';
    script.textContent = JSON.stringify(ldJson);
    document.head.appendChild(script);

    return () => {
      document.title = previousTitle;
      tags.forEach((t) => t.remove?.());
      document.getElementById('agency-landing-jsonld')?.remove();
    };
  }, []);

  return (
    <Box
      sx={{
        bgcolor: palette.bgRoot,
        color: palette.textPrimary,
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
      }}
    >
      <TopNav />
      <Hero isMobile={isMobile} />
      <PainSection />
      <ValueSection />
      <TrustStrip />
      <ProductPeekSection isMobile={isMobile} />
      <DayInLifeSection />
      <PricingTeaser />
      <LeadForm />
      <FAQTeaser />
      <FooterCTA />
      <Footer />
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// Top-nav (sticky)
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
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ py: { xs: 1.4, md: 2 } }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 28, height: 28, borderRadius: 1,
                background: palette.accentGradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, color: '#fff', fontSize: '0.92rem',
              }}
            >
              RR
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
              The Role Room
            </Typography>
          </Stack>
          <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="center">
            <Button
              href="/pricing"
              sx={{
                color: palette.textSecondary, textTransform: 'none',
                fontWeight: 600, fontSize: { xs: '0.82rem', md: '0.88rem' },
                '&:hover': { color: palette.accentBright },
              }}
            >
              Priser
            </Button>
            <Button
              href="/faq"
              sx={{
                color: palette.textSecondary, textTransform: 'none',
                fontWeight: 600, fontSize: { xs: '0.82rem', md: '0.88rem' },
                display: { xs: 'none', sm: 'inline-flex' },
                '&:hover': { color: palette.accentBright },
              }}
            >
              FAQ
            </Button>
            <Button
              href="/login"
              variant="outlined"
              sx={{
                color: palette.textPrimary,
                borderColor: palette.borderStrong,
                textTransform: 'none', fontWeight: 700,
                fontSize: { xs: '0.82rem', md: '0.88rem' },
                px: { xs: 1.4, md: 2 },
                '&:hover': { borderColor: palette.accentBright, bgcolor: 'rgba(168,85,247,0.06)' },
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
        pt: { xs: 6, md: 12 },
        pb: { xs: 8, md: 14 },
        background: `
          radial-gradient(ellipse at top left, rgba(168, 85, 247, 0.18), transparent 60%),
          radial-gradient(ellipse at bottom right, rgba(217, 70, 239, 0.12), transparent 50%),
          ${palette.bgRoot}
        `,
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 4, md: 8 }}
          alignItems="center"
        >
          <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                display: 'inline-flex',
                bgcolor: 'rgba(168,85,247,0.14)',
                border: `1px solid ${palette.borderStrong}`,
                px: 1.4, py: 0.5,
                borderRadius: 999,
                mb: 3,
              }}
            >
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#34d399' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.74rem', color: palette.accentBright, letterSpacing: 0.4 }}>
                FOR SKUESPILLERBYRÅER
              </Typography>
            </Stack>

            <Typography
              component="h1"
              sx={{
                fontSize: { xs: '2.2rem', sm: '2.8rem', md: '3.4rem', lg: '4rem' },
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -0.5,
                mb: 2,
              }}
            >
              Slutt å lete etter{' '}
              <Box component="span" sx={{
                background: palette.accentGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                self-tapes i Dropbox.
              </Box>
            </Typography>

            <Typography
              sx={{
                color: palette.textSecondary,
                fontSize: { xs: '1.05rem', md: '1.2rem' },
                lineHeight: 1.55,
                mb: 4,
                maxWidth: 560,
                mx: { xs: 'auto', md: 0 },
              }}
            >
              The Role Room er operativsystemet for norske skuespillerbyråer.
              Talent-register, self-tape-studio, casting-partnerships og GDPR-audit
              — alt på ett sted. Talentene er fortsatt dine.
            </Typography>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.6}
              sx={{ justifyContent: { xs: 'center', md: 'flex-start' } }}
            >
              <Button
                href="#book-demo"
                sx={{
                  background: palette.accentGradient,
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '1rem',
                  px: 3.2, py: 1.6,
                  minHeight: 48,
                  borderRadius: 2,
                  boxShadow: '0 8px 24px rgba(168,85,247,0.45)',
                  '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                }}
                endIcon={<ArrowForwardIcon />}
              >
                Book 30-min demo
              </Button>
              <Button
                href="/pricing"
                variant="outlined"
                sx={{
                  color: palette.textPrimary,
                  borderColor: palette.borderStrong,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '1rem',
                  px: 3.2, py: 1.6,
                  minHeight: 48,
                  borderRadius: 2,
                  '&:hover': { borderColor: palette.accentBright, bgcolor: 'rgba(168,85,247,0.08)' },
                }}
              >
                Se priser
              </Button>
            </Stack>

            <Stack
              direction="row"
              spacing={3}
              sx={{
                mt: 5,
                justifyContent: { xs: 'center', md: 'flex-start' },
                flexWrap: 'wrap',
                gap: 1.6,
              }}
            >
              <TrustPoint Icon={ShieldOutlinedIcon} label="GDPR-trygt" />
              <TrustPoint Icon={LockOutlinedIcon} label="EU-hostet" />
              <TrustPoint Icon={CheckCircleOutlineIcon} label="2 ukers gratis" />
            </Stack>
          </Box>

          {/* Hero-visual: stylized "product peek" */}
          {!isMobile ? (
            <Box sx={{ flex: 1, position: 'relative' }}>
              <HeroProductPeek />
            </Box>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}

function TrustPoint({
  Icon, label,
}: {
  Icon: React.ComponentType<{ sx?: object; fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>;
  label: string;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.6}>
      <Icon sx={{ color: '#34d399', fontSize: 16 }} />
      <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 600 }}>
        {label}
      </Typography>
    </Stack>
  );
}

function HeroProductPeek() {
  // Stylized "Kanban-of-talents" card stack — gir produkt-følelse uten å lekke ekte UI
  return (
    <Box
      sx={{
        position: 'relative',
        aspectRatio: '4 / 3',
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.border}`,
        borderRadius: 3,
        p: 2,
        boxShadow: '0 24px 80px rgba(168,85,247,0.28), inset 0 0 0 1px rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* Topbar */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 0.6 }}>
          {['#f87171', '#fbbf24', '#34d399'].map((c) => (
            <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
          ))}
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box
          sx={{
            bgcolor: 'rgba(168,85,247,0.16)',
            color: palette.accentBright,
            fontWeight: 700, fontSize: '0.7rem',
            px: 1, py: 0.3, borderRadius: 999,
          }}
        >
          Demo · TROLL
        </Box>
      </Stack>

      {/* Mock Kanban-columns */}
      <Stack direction="row" spacing={1.4} sx={{ overflow: 'hidden' }}>
        {[
          { title: 'Forespurt', n: 3, color: '#60a5fa' },
          { title: 'Vurderes', n: 5, color: '#fbbf24' },
          { title: 'Shortlistet', n: 2, color: '#34d399' },
        ].map((col) => (
          <Box
            key={col.title}
            sx={{
              flex: 1,
              minWidth: 0,
              bgcolor: palette.bgElevated,
              border: `1px solid ${palette.borderSubtle}`,
              borderRadius: 2,
              p: 1.2,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 1.2 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: col.color }} />
              <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                {col.title}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem' }}>
                {col.n}
              </Typography>
            </Stack>
            <Stack spacing={0.8}>
              {Array.from({ length: 2 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    bgcolor: palette.bgCard,
                    border: `1px solid ${palette.borderSubtle}`,
                    borderRadius: 1,
                    p: 1,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={0.8}>
                    <Box
                      sx={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: `linear-gradient(135deg, ${col.color}88, ${palette.accentBright}88)`,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ height: 6, bgcolor: 'rgba(255,255,255,0.16)', borderRadius: 1, mb: 0.4 }} />
                      <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 1, width: '60%' }} />
                    </Box>
                  </Stack>
                  {/* 📹 self-tape-badge mock */}
                  {col.title !== 'Forespurt' ? (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.3,
                        mt: 0.8,
                        px: 0.8, py: 0.2,
                        borderRadius: 999,
                        bgcolor: 'rgba(52,211,153,0.18)',
                        color: '#34d399',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                      }}
                    >
                      <PlayCircleOutlineIcon sx={{ fontSize: 10 }} />
                      Video
                    </Box>
                  ) : null}
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// Pain-section
// ──────────────────────────────────────────────────────────────────
function PainSection() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
          Du kjenner kanskje igjen dette
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: '1.8rem', md: '2.4rem' },
            fontWeight: 800,
            lineHeight: 1.15,
            maxWidth: 760,
            mx: 'auto',
          }}
        >
          Du administrerer et byrå.{' '}
          <Box component="span" sx={{ color: palette.textMuted }}>
            Verktøyene dine er bygget for noen andre.
          </Box>
        </Typography>
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 2, md: 3 }}
        useFlexGap
      >
        {[
          {
            quote: 'Hvor ligger den self-tapen fra Anna for Nora-rollen igjen? I Dropbox? På Drive? På privat-Vimeo?',
            who: 'Casting-direktør, anonym',
          },
          {
            quote: 'Jeg sendte 30 e-poster i forrige uke for å spørre om talentene fortsatt var ledige. Jeg bruker dagene mine på det.',
            who: 'Booker, modellbyrå',
          },
          {
            quote: 'Produksjonsteamet ber om GDPR-audit på hvem som har sett portfolioen. Jeg har ikke svar.',
            who: 'Daglig leder, skuespillerbyrå',
          },
        ].map((p) => (
          <Box
            key={p.who}
            sx={{
              flex: 1,
              bgcolor: palette.bgCard,
              border: `1px solid ${palette.borderSubtle}`,
              borderRadius: 3,
              p: { xs: 2.4, md: 3.2 },
              position: 'relative',
            }}
          >
            <Typography
              sx={{
                color: palette.accentBright,
                fontSize: '3rem',
                lineHeight: 0.6,
                fontFamily: 'serif',
                mb: 1,
                userSelect: 'none',
              }}
            >
              "
            </Typography>
            <Typography sx={{ color: palette.textPrimary, fontSize: '1rem', lineHeight: 1.55, mb: 2.4 }}>
              {p.quote}
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', fontWeight: 600 }}>
              — {p.who}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Container>
  );
}

// ──────────────────────────────────────────────────────────────────
// Value-section (4 emosjonelle knagger)
// ──────────────────────────────────────────────────────────────────
function ValueSection() {
  const values = [
    {
      Icon: ShieldOutlinedIcon,
      title: 'GDPR-trygg fra dag én',
      body: 'Audit-trail på hver visning, eksplisitt consent per scope, automatisk revoke ved utløp. Du kan svare på enhver Schrems II-spørsmål uten å lete.',
      color: '#34d399',
    },
    {
      Icon: AccessTimeOutlinedIcon,
      title: 'Spar 8 timer per casting',
      body: 'Self-tapes, kommentarer og bookingstatus i én tråd. Ingen e-post-ping-pong, ingen Excel-rader.',
      color: '#60a5fa',
    },
    {
      Icon: HandshakeOutlinedIcon,
      title: 'Eieren beholder kundene',
      body: 'Vi tar ikke over relasjonen. Talentene står i ditt byrå. Du styrer all consent. Vi er infrastrukturen som lar deg fokusere på relasjonsarbeidet.',
      color: '#fbbf24',
    },
    {
      Icon: AutoAwesomeOutlinedIcon,
      title: 'Tech-byrå-status mot kunden',
      body: 'AI-feedback på self-tapes, signed links, profesjonelle pitches. Produksjonsteamet ser byrået som en teknologi-partner.',
      color: '#c084fc',
    },
  ];

  return (
    <Box sx={{ bgcolor: palette.bgShell, py: { xs: 6, md: 10 } }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
            Hvorfor byråer velger oss
          </Typography>
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              fontWeight: 800,
              lineHeight: 1.15,
              maxWidth: 720,
              mx: 'auto',
            }}
          >
            Fire ting du kanskje bryr deg om
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            gap: { xs: 2, md: 3 },
          }}
        >
          {values.map((v) => (
            <Box
              key={v.title}
              sx={{
                bgcolor: palette.bgCard,
                border: `1px solid ${palette.borderSubtle}`,
                borderRadius: 3,
                p: { xs: 2.4, md: 3.2 },
                transition: 'transform 0.18s, border-color 0.18s',
                '&:hover': {
                  borderColor: palette.borderStrong,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Box
                sx={{
                  width: 44, height: 44,
                  borderRadius: 2,
                  bgcolor: `${v.color}28`,
                  display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  mb: 2,
                }}
              >
                <v.Icon sx={{ color: v.color, fontSize: 24 }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', mb: 1 }}>
                {v.title}
              </Typography>
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.96rem', lineHeight: 1.55 }}>
                {v.body}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// Trust-strip (logo-rad, demo-partnere)
// ──────────────────────────────────────────────────────────────────
function TrustStrip() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography
        sx={{
          textAlign: 'center',
          color: palette.textMuted,
          fontSize: '0.84rem',
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          mb: 3,
        }}
      >
        Bygget med noen av Norges fremste casting-partnere
      </Typography>
      <Stack
        direction="row"
        spacing={{ xs: 3, md: 6 }}
        useFlexGap
        sx={{
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          opacity: 0.7,
        }}
      >
        {[
          'Stella Casting',
          'Skuespillersenter',
          'Sirius Casting',
          'Heartbreak Models',
        ].map((name) => (
          <Typography
            key={name}
            sx={{
              fontWeight: 800,
              fontSize: { xs: '0.92rem', md: '1.08rem' },
              color: palette.textSecondary,
              fontStyle: 'italic',
              letterSpacing: 0.3,
            }}
          >
            {name}
          </Typography>
        ))}
      </Stack>
      <Typography sx={{ textAlign: 'center', color: palette.textMuted, fontSize: '0.72rem', mt: 2, fontStyle: 'italic' }}>
        Demo-partnere på utviklingsstadiet. Henvendelser fra ekte byråer mottas løpende.
      </Typography>
    </Container>
  );
}

// ──────────────────────────────────────────────────────────────────
// Product-peek-section — viser 3 features uten å vise faktisk UI
// ──────────────────────────────────────────────────────────────────
function ProductPeekSection({ isMobile: _isMobile }: { isMobile: boolean }) {
  const features = [
    {
      Icon: FolderOpenOutlinedIcon,
      title: 'Talent-register',
      body: 'Full portfolio + skills + tilgjengelighet + samtykke-historikk. Talentene vedlikeholder selv via egen app.',
      bullets: ['Headshots med focal-point', 'Showreel + CV', 'BankID-verifisert identitet (planlagt)'],
    },
    {
      Icon: PlayCircleOutlineIcon,
      title: 'Self-tape-studio',
      body: 'Skuespillere spiller inn direkte i nettleseren. Cloudflare Stream + watermark + AI-feedback fra Claude Opus 4.7.',
      bullets: ['Påminnelser ved deadline', 'Kommentar-loop tilbake til talent', 'Signed URLs med 3 timers TTL'],
    },
    {
      Icon: GroupsOutlinedIcon,
      title: 'Casting-partnership',
      body: 'Foreslå talent til produksjonsteam med ett klikk. Auto-link til deres Kanban. Du beholder consent-kontroll.',
      bullets: ['Per-prosjekt-tilgang', 'Audit-trail per visning', 'Revoke når som helst'],
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
          Hva du får
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: '1.8rem', md: '2.4rem' },
            fontWeight: 800,
            lineHeight: 1.15,
          }}
        >
          Tre moduler som henger sammen
        </Typography>
      </Box>

      <Stack spacing={{ xs: 3, md: 4 }}>
        {features.map((f, i) => (
          <Stack
            key={f.title}
            direction={{ xs: 'column', md: i % 2 === 0 ? 'row' : 'row-reverse' }}
            spacing={{ xs: 2, md: 5 }}
            alignItems="center"
          >
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
                <Box
                  sx={{
                    width: 44, height: 44, borderRadius: 2,
                    bgcolor: 'rgba(168,85,247,0.18)',
                    display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <f.Icon sx={{ color: palette.accentBright, fontSize: 24 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' } }}>
                  {f.title}
                </Typography>
              </Stack>
              <Typography sx={{ color: palette.textSecondary, fontSize: '1.02rem', lineHeight: 1.6, mb: 2.4 }}>
                {f.body}
              </Typography>
              <Stack spacing={1.2}>
                {f.bullets.map((b) => (
                  <Stack key={b} direction="row" alignItems="center" spacing={1}>
                    <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 18 }} />
                    <Typography sx={{ color: palette.textPrimary, fontSize: '0.94rem' }}>
                      {b}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            {/* Visualization placeholder — solid card, ikke ekte product-leak */}
            <Box
              sx={{
                flex: 1,
                aspectRatio: '4 / 3',
                bgcolor: palette.bgCard,
                border: `1px solid ${palette.border}`,
                borderRadius: 3,
                p: 2,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(168,85,247,0.18)',
                background: `
                  radial-gradient(ellipse at ${i % 2 === 0 ? 'top right' : 'top left'},
                    rgba(168,85,247,0.18), transparent 60%),
                  ${palette.bgCard}
                `,
              }}
            >
              <Stack
                alignItems="center"
                justifyContent="center"
                sx={{ height: '100%' }}
              >
                <f.Icon
                  sx={{
                    color: palette.accentBright,
                    fontSize: { xs: 80, md: 120 },
                    opacity: 0.6,
                  }}
                />
              </Stack>
            </Box>
          </Stack>
        ))}
      </Stack>
    </Container>
  );
}

// ──────────────────────────────────────────────────────────────────
// "En vanlig casting-dag" — fortelling
// ──────────────────────────────────────────────────────────────────
function DayInLifeSection() {
  const moments = [
    { time: '08:14', body: 'Produksjonsteamet ber om 5 self-tapes til Nora-rollen i TROLL. Du sender én partnership-invitasjon.' },
    { time: '08:38', body: 'Anna, Eric og 3 andre talenter får varsel. De spiller inn på telefonen i kveld.' },
    { time: '21:02', body: 'Anna laster opp self-tape direkte i appen. Claude Opus 4.7 gir umiddelbar tilbakemelding.' },
    { time: '07:15', body: 'Neste dag: produksjonsteamet ser 5 self-tapes med 📹-badge på Kanban-kortene. De shortliste 2 på 4 minutter.' },
    { time: '09:30', body: 'Anna får automatisk varsel: «Du er shortlistet for Nora-rollen». Du ser deal-flowen i ditt CRM.' },
  ];

  return (
    <Box sx={{ bgcolor: palette.bgShell, py: { xs: 6, md: 10 } }}>
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
            En vanlig casting-dag
          </Typography>
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              fontWeight: 800,
              lineHeight: 1.15,
            }}
          >
            Fra brief til shortlist på 18 timer
          </Typography>
        </Box>

        <Stack spacing={2.4}>
          {moments.map((m, i) => (
            <Stack
              key={i}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 1, sm: 3 }}
              alignItems={{ sm: 'flex-start' }}
            >
              <Box
                sx={{
                  minWidth: 88,
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  color: palette.accentBright,
                  fontSize: '1.4rem',
                }}
              >
                {m.time}
              </Box>
              <Box
                sx={{
                  flex: 1,
                  bgcolor: palette.bgCard,
                  border: `1px solid ${palette.borderSubtle}`,
                  borderRadius: 2,
                  px: 2.4,
                  py: 1.8,
                  position: 'relative',
                }}
              >
                <Typography sx={{ color: palette.textPrimary, fontSize: '0.98rem', lineHeight: 1.55 }}>
                  {m.body}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// Pricing teaser
// ──────────────────────────────────────────────────────────────────
function PricingTeaser() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
          Pris
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: '1.8rem', md: '2.4rem' },
            fontWeight: 800,
            lineHeight: 1.15,
            mb: 1,
          }}
        >
          Fra 495 kr per måned
        </Typography>
        <Typography sx={{ color: palette.textSecondary, fontSize: '1.04rem' }}>
          Inkluderer 2 ukers gratis prøvetid. Ingen oppsigelsestid.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: { xs: 2, md: 2.4 },
        }}
      >
        {[
          { name: 'Solo Agent', price: '495', desc: '1 bruker · 25 talents' },
          { name: 'Boutique', price: '1 495', desc: '5 brukere · 100 talents', highlighted: true },
          { name: 'Professional', price: '3 495', desc: '20 brukere · ubegrenset' },
          { name: 'Enterprise', price: 'Kontakt oss', desc: 'White-label · SLA' },
        ].map((tier) => (
          <Box
            key={tier.name}
            sx={{
              bgcolor: tier.highlighted ? 'rgba(168,85,247,0.10)' : palette.bgCard,
              border: `1px solid ${tier.highlighted ? palette.accentBright : palette.borderSubtle}`,
              borderRadius: 3,
              p: 3,
              position: 'relative',
            }}
          >
            {tier.highlighted ? (
              <Box
                sx={{
                  position: 'absolute',
                  top: -10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: palette.accentGradient,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.7rem',
                  px: 1.2, py: 0.4,
                  borderRadius: 999,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                Mest populær
              </Box>
            ) : null}
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', mb: 1.4 }}>
              {tier.name}
            </Typography>
            <Stack direction="row" alignItems="baseline" spacing={0.6} sx={{ mb: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.8rem' }}>
                {tier.price === 'Kontakt oss' ? tier.price : `${tier.price} kr`}
              </Typography>
              {tier.price !== 'Kontakt oss' ? (
                <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem' }}>
                  / mnd
                </Typography>
              ) : null}
            </Stack>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem' }}>
              {tier.desc}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack direction="row" justifyContent="center" sx={{ mt: 4 }}>
        <Button
          href="/pricing"
          variant="outlined"
          sx={{
            color: palette.textPrimary,
            borderColor: palette.borderStrong,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.94rem',
            px: 3, py: 1.4,
            borderRadius: 2,
            '&:hover': { borderColor: palette.accentBright, bgcolor: 'rgba(168,85,247,0.08)' },
          }}
        >
          Se hele prismodellen
        </Button>
      </Stack>
    </Container>
  );
}

// ──────────────────────────────────────────────────────────────────
// Lead-form (book demo)
// ──────────────────────────────────────────────────────────────────
function LeadForm() {
  const [agency, setAgency] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [talents, setTalents] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const r = await fetch('/api/public/agency-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agency_name: agency.trim(),
          contact_name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          roster_size: talents.trim() || null,
          message: message.trim() || null,
          source: 'agency_landing',
          segment: 'skuespillerbyrå',
        }),
      });
      if (!r.ok) {
        const payload = await r.json().catch(() => ({}));
        throw new Error(payload.error ?? `HTTP ${r.status}`);
      }
      setStatus('success');
      // Clear felter
      setAgency(''); setName(''); setEmail(''); setPhone(''); setTalents(''); setMessage('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box id="book-demo" sx={{ bgcolor: palette.bgShell, py: { xs: 6, md: 10 } }}>
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 4 } }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
            Book demo
          </Typography>
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              fontWeight: 800,
              lineHeight: 1.15,
              mb: 1,
            }}
          >
            30 minutter, vi viser deg din egen casting-dag
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '1.04rem' }}>
            Vi tar med en levende demo med ditt navn på. Du bestemmer om du vil prøve.
          </Typography>
        </Box>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            bgcolor: palette.bgCard,
            border: `1px solid ${palette.border}`,
            borderRadius: 3,
            p: { xs: 2.4, md: 4 },
          }}
        >
          {status === 'success' ? (
            <Alert
              severity="success"
              icon={<CheckCircleOutlineIcon />}
              sx={{
                bgcolor: 'rgba(52,211,153,0.10)',
                color: '#34d399',
                border: `1px solid rgba(52,211,153,0.32)`,
                '& .MuiAlert-icon': { color: '#34d399' },
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: '0.96rem', mb: 0.4 }}>
                Mottatt — vi tar kontakt innen 24 timer
              </Typography>
              <Typography sx={{ fontSize: '0.86rem', opacity: 0.92 }}>
                Du får e-post med 3 demo-tider å velge mellom.
              </Typography>
            </Alert>
          ) : (
            <Stack spacing={2}>
              {status === 'error' ? (
                <Alert severity="error">{errorMsg ?? 'Noe gikk galt'}</Alert>
              ) : null}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Byrå *"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  required
                  fullWidth
                  sx={leadFieldSx}
                  InputLabelProps={{ sx: { color: palette.textMuted } }}
                />
                <TextField
                  label="Navn *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  fullWidth
                  sx={leadFieldSx}
                  InputLabelProps={{ sx: { color: palette.textMuted } }}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="E-post *"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                  sx={leadFieldSx}
                  InputLabelProps={{ sx: { color: palette.textMuted } }}
                />
                <TextField
                  label="Telefon"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  fullWidth
                  sx={leadFieldSx}
                  InputLabelProps={{ sx: { color: palette.textMuted } }}
                />
              </Stack>
              <TextField
                label="Antall talents i registeret"
                value={talents}
                onChange={(e) => setTalents(e.target.value)}
                fullWidth
                placeholder="f.eks. ~120"
                sx={leadFieldSx}
                InputLabelProps={{ sx: { color: palette.textMuted } }}
              />
              <TextField
                label="Hva er din største utfordring i dag?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                fullWidth
                multiline
                minRows={3}
                maxRows={6}
                sx={leadFieldSx}
                InputLabelProps={{ sx: { color: palette.textMuted } }}
              />

              <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                Vi behandler skjema-data iht. GDPR. Ingen tredjeparts marketing-trackere.
              </Typography>

              <Button
                type="submit"
                disabled={busy}
                sx={{
                  background: palette.accentGradient,
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '1rem',
                  py: 1.6,
                  minHeight: 48,
                  borderRadius: 2,
                  boxShadow: '0 8px 24px rgba(168,85,247,0.32)',
                  '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                  '&.Mui-disabled': { background: 'rgba(168,85,247,0.32)', color: 'rgba(255,255,255,0.6)' },
                }}
                endIcon={<ArrowForwardIcon />}
              >
                {busy ? 'Sender …' : 'Send forespørsel'}
              </Button>
            </Stack>
          )}
        </Box>
      </Container>
    </Box>
  );
}

const leadFieldSx = {
  '& .MuiInputBase-input': { color: palette.textPrimary },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderSubtle },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderStrong },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: palette.accentBright },
} as const;

// ──────────────────────────────────────────────────────────────────
// FAQ teaser
// ──────────────────────────────────────────────────────────────────
function FAQTeaser() {
  const items = [
    {
      q: 'Tar dere over kunderelasjonen?',
      a: 'Nei. Talentene står i ditt byrå, du eier consent. Vi er infrastruktur, ikke konkurrent.',
    },
    {
      q: 'Hva med GDPR og data-eierskap?',
      a: 'All data hostet på EU-servere. Granulær per-scope consent + revoke når som helst. Audit-trail på hver visning.',
    },
    {
      q: 'Hvor lang oppsigelsestid?',
      a: 'Ingen. Du sier opp når du vil. Eksport av alle data inkludert.',
    },
    {
      q: 'Fungerer det på iPad og mobil?',
      a: 'Ja, alt fra dag én. Self-tapes spilles inn fra telefonen, Kanban fra iPad.',
    },
  ];

  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 5 } }}>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
          Spørsmål du sannsynligvis har
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: '1.8rem', md: '2.4rem' },
            fontWeight: 800,
            lineHeight: 1.15,
          }}
        >
          De korte svarene
        </Typography>
      </Box>

      <Stack spacing={1.4}>
        {items.map((item) => (
          <Box
            key={item.q}
            sx={{
              bgcolor: palette.bgCard,
              border: `1px solid ${palette.borderSubtle}`,
              borderRadius: 2,
              p: { xs: 2, md: 2.6 },
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: '1.04rem', color: palette.textPrimary, mb: 1 }}>
              {item.q}
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.94rem', lineHeight: 1.6 }}>
              {item.a}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Stack direction="row" justifyContent="center" sx={{ mt: 3 }}>
        <Button
          href="/faq"
          variant="outlined"
          sx={{
            color: palette.textPrimary,
            borderColor: palette.borderStrong,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.94rem',
            px: 3, py: 1.4,
            borderRadius: 2,
            '&:hover': { borderColor: palette.accentBright, bgcolor: 'rgba(168,85,247,0.08)' },
          }}
        >
          Se alle FAQ-svar
        </Button>
      </Stack>
    </Container>
  );
}

// ──────────────────────────────────────────────────────────────────
// Footer CTA
// ──────────────────────────────────────────────────────────────────
function FooterCTA() {
  return (
    <Box
      sx={{
        position: 'relative',
        py: { xs: 6, md: 10 },
        textAlign: 'center',
        overflow: 'hidden',
        background: `
          radial-gradient(ellipse at center, rgba(168,85,247,0.20), transparent 70%),
          ${palette.bgShell}
        `,
      }}
    >
      <Container maxWidth="md">
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: '1.8rem', md: '2.6rem' },
            fontWeight: 800,
            lineHeight: 1.15,
            mb: 2,
          }}
        >
          Klar for å se det selv?
        </Typography>
        <Typography sx={{ color: palette.textSecondary, fontSize: '1.08rem', mb: 4 }}>
          30 minutter med din egen casting-dag på vår plattform.
        </Typography>
        <Button
          href="#book-demo"
          sx={{
            background: palette.accentGradient,
            color: '#fff',
            textTransform: 'none',
            fontWeight: 800,
            fontSize: '1.04rem',
            px: 4, py: 1.8,
            minHeight: 52,
            borderRadius: 2,
            boxShadow: '0 12px 32px rgba(168,85,247,0.48)',
            '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
          }}
          endIcon={<ArrowForwardIcon />}
        >
          Book demo
        </Button>
      </Container>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// Footer
// ──────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <Box sx={{ bgcolor: palette.bgRoot, borderTop: `1px solid ${palette.borderSubtle}`, py: 4 }}>
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ md: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 24, height: 24, borderRadius: 1,
                background: palette.accentGradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, color: '#fff', fontSize: '0.78rem',
              }}
            >
              RR
            </Box>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem' }}>
              The Role Room · creatorhubn.com
            </Typography>
          </Stack>
          <Stack direction="row" spacing={2.4} sx={{ flexWrap: 'wrap' }}>
            {[
              { href: '/pricing', label: 'Priser' },
              { href: '/faq', label: 'FAQ' },
              { href: '/about', label: 'Om oss' },
              { href: '/privacy-policy', label: 'Personvern' },
              { href: '/terms-and-conditions', label: 'Vilkår' },
            ].map((link) => (
              <Box
                key={link.href}
                component="a"
                href={link.href}
                sx={{
                  color: palette.textMuted,
                  fontSize: '0.84rem',
                  textDecoration: 'none',
                  '&:hover': { color: palette.accentBright },
                }}
              >
                {link.label}
              </Box>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
