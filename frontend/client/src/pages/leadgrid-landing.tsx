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

import { useEffect } from 'react';
import {
  Box, Container, Typography, Button, Grid, Stack, Chip,
  Card, CardContent, Divider, Avatar,
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
} from '@mui/icons-material';

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

const TRUST_LOGOS = [
  'ElektroPartner', 'Fixit', 'Kaffebrenneriet',
  'Renholdspartner', 'ByggTeam', 'Blomsterpikene',
];

const ECOSYSTEM = [
  { Icon: TravelExploreOutlined,    title: 'Oppdag',       desc: 'Finn leads fra flere kilder.' },
  { Icon: FolderOutlined,           title: 'Organiser',    desc: 'Hold alle leads og notater samlet på ett sted.' },
  { Icon: AutoAwesomeMosaicOutlined, title: 'Automatiser', desc: 'Spar tid med smarte arbeidsflyter.' },
  { Icon: SendOutlined,             title: 'Engasjer',     desc: 'Ta kontakt med riktig budskap.' },
  { Icon: AutoGraphOutlined,        title: 'Følg opp',     desc: 'Overvåk aktivitet og oppfølginger.' },
  { Icon: HubOutlined,              title: 'Analyser',     desc: 'Se hva som fungerer og forbedre.' },
];

const TESTIMONIALS = [
  {
    quote: 'Leadgrid har gjort oss mye mer strukturerte. Vi ser flere muligheter og følger opp raskere enn før.',
    name: 'Martin Ødegaard', role: 'Daglig leder, ElektroPartner',
  },
  {
    quote: 'Kartvisningen gir oss en helt ny forståelse av markedet. Vi har økt antall møter med 40%.',
    name: 'Kari Nordmann', role: 'Salgsleder, Fixit AS',
  },
  {
    quote: 'Enkelt å bruke, kraftfullt i hverdagen. Leadgrid er blitt en uunnværlig del av vår salgsprosess.',
    name: 'Thomas Hølland', role: 'CEO, Renholdspartner',
  },
];

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

export default function LeadgridLanding() {
  useEffect(() => {
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
            {['Produkt', 'Løsninger', 'Priser', 'Demo'].map((label) => (
              <Typography
                key={label}
                component="a"
                href={`#${label.toLowerCase()}`}
                sx={{
                  color: PALETTE.textMuted, fontSize: 14, fontWeight: 500,
                  textDecoration: 'none',
                  '&:hover': { color: PALETTE.text },
                }}
              >
                {label}
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
  return (
    <Box
      sx={{
        position: 'relative',
        pt: { xs: 8, md: 12 },
        pb: { xs: 6, md: 10 },
        backgroundImage: 'url(/leadgrid/backdrop3.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center right',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(11,5,24,0.65) 0%, rgba(11,5,24,0.85) 100%)',
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
                href="/"
              >
                Start gratis
              </Button>
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

/**
 * Device-mockup-komposisjon: MacBook bak, iPad foran-venstre, iPhone
 * foran-høyre. Ekte UI-skjermbilder fylles inn senere — for nå er
 * device-rammene synlig med en lett purple glow på bakgrunnen.
 */
function DeviceComposition() {
  return (
    <Box
      sx={{
        position: 'relative',
        height: { xs: 280, sm: 360, md: 440 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(167, 139, 250, 0.25) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
      <Box
        component="img"
        src="/leadgrid/device-macbook.png"
        alt=""
        sx={{
          position: 'relative',
          width: '95%',
          maxWidth: 540,
          filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.6))',
        }}
      />
      <Box
        component="img"
        src="/leadgrid/device-ipad.png"
        alt=""
        sx={{
          position: 'absolute',
          left: { xs: '-2%', md: '-8%' },
          top: { xs: '5%', md: '8%' },
          width: { xs: '32%', md: '34%' },
          filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.6))',
          transform: 'rotate(-3deg)',
        }}
      />
      <Box
        component="img"
        src="/leadgrid/device-iphone.png"
        alt=""
        sx={{
          position: 'absolute',
          right: { xs: '-5%', md: '-10%' },
          bottom: { xs: '0%', md: '5%' },
          width: { xs: '24%', md: '26%' },
          filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.6))',
          transform: 'rotate(4deg)',
        }}
      />
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Trust-strip
// ────────────────────────────────────────────────────────────

function TrustStrip() {
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
        {TRUST_LOGOS.map((label) => (
          <Typography
            key={label}
            sx={{
              color: PALETTE.textMuted,
              fontWeight: 600,
              fontSize: { xs: 16, md: 18 },
              letterSpacing: '-0.01em',
              opacity: 0.7,
            }}
          >
            {label}
          </Typography>
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
          backdrop="/leadgrid/backdrop1.png"
        />
        <FeatureCard
          title="Smarte filtre"
          desc="Filtrér på bransje, størrelse, rating, omsetning og mer for å finne de riktige leadsene, raskere."
          backdrop="/leadgrid/backdrop4.png"
        />
        <FeatureCard
          title="AI-pitch og oppfølging"
          desc="Få hjelp til å skrive personlige, førsteinntrykk og oppfølgings-e-poster som faktisk får svar."
          backdrop="/leadgrid/backdrop2.png"
        />
        <FeatureCard
          title="Pipeline og aktiviteter"
          desc="Få full kontroll på fremdriften med en drag-and-drop pipeline og automatiske påminnelser."
          backdrop="/leadgrid/backdrop8.png"
        />
        <FeatureCard
          title="Rapporter og innsikt"
          desc="Se hva som fungerer. Spor teamets resultater og ta datadrevne beslutninger som gir vekst."
          backdrop="/leadgrid/backdrop6.png"
        />
        <FeatureCard
          title="Alt du trenger — samlet på ett sted"
          desc="Leadgrid samler kart, data, kommunikasjon og pipeline i én plattform som hjelper teamet ditt å jobbe smartere og vinne flere kunder."
          backdrop="/leadgrid/backdrop5.png"
          highlight
        />
      </Grid>
    </Container>
  );
}

function FeatureCard({
  title, desc, backdrop, highlight = false,
}: { title: string; desc: string; backdrop: string; highlight?: boolean }) {
  return (
    <Grid item xs={12} md={6}>
      <Card
        sx={{
          position: 'relative',
          minHeight: 220,
          bgcolor: highlight
            ? 'rgba(167, 139, 250, 0.12)'
            : PALETTE.card,
          border: `1px solid ${highlight ? PALETTE.accent : PALETTE.cardBorder}`,
          borderRadius: 3,
          boxShadow: 'none',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${backdrop})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.25,
            transition: 'opacity 0.3s',
            '.MuiCard-root:hover &': { opacity: 0.4 },
          }}
        />
        <CardContent sx={{ position: 'relative', p: 4 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 22, mb: 1.5 }}>
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
        backgroundImage: 'url(/leadgrid/backdrop2.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        '&::before': {
          content: '""',
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(11,5,24,0.65) 0%, rgba(11,5,24,0.85) 100%)',
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
            { title: 'Produkt', links: ['Funksjoner', 'Integrasjoner', 'Sikkerhet', 'Oppdateringer'] },
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
