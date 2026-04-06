import React, { useEffect, useState } from 'react';
import {
  AccountTree,
  ArrowForward,
  AutoAwesome,
  Close,
  Groups,
  Menu,
  NorthEast,
  School,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  GlobalStyles,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { useLanguage } from '@/components/language-provider';
import { withVisualEditor } from '@/components/admin/visual-editor/withVisualEditor';
import PublicSocialLinks from '@/components/common/PublicSocialLinks';
import { getPublicSocialProfiles } from '@/lib/publicBrandLinks';

const CREATORHUB_ICON_URL = '/creatorhub-icon.png';
const ROLE_ROOM_LOGO_URL = '/role-room-assets/TheRoleRoom_Logo_Tagline.webp';
const ACADEMY_LOGO_URL = '/creatorhub-academy-logo.svg';
const COMMUNITY_ICON_URL = '/creatorhub-community-icon.svg';
const ABOUT_BACKDROP_URL = '/role-room-assets/landing_backdrop.webp';
const ROLE_ROOM_EXTERNAL_URL = 'https://theroleroom.com';

const localeOptions = [
  { value: 'no' as const, flag: '🇳🇴', no: 'Norsk', en: 'Norwegian' },
  { value: 'en' as const, flag: '🇬🇧', no: 'Engelsk', en: 'English' },
];

const aboutCopy = {
  no: {
    title: 'Creatorhub | Om Creatorhub AS',
    nav: {
      home: 'Hjem',
      platform: 'Plattform',
      roleRoom: 'Role Room',
      academy: 'Academy',
      community: 'Community',
      signIn: 'Logg inn',
    },
    hero: {
      eyebrow: 'Creatorhub AS',
      title: 'Om Creatorhub AS',
      subtitle:
        'Creatorhub bygger en strukturert plattform for å administrere, gjennomføre og skalere kreativt arbeid.',
      body:
        'Vi bygger for kreative profesjoner som trenger mer enn enkeltverktøy. Creatorhub kombinerer kjerneplattform, produkter og community i ett sammenhengende system.',
      primary: 'Tilbake til forsiden',
      secondary: 'Åpne plattformen',
    },
    story: {
      label: 'Why Creatorhub Exists',
      title: 'Vi bygger et system, ikke bare flere funksjoner.',
      body:
        'Kreativt arbeid blir ofte spredt mellom prosjektstyring, produksjonsverktøy, læring og relasjoner. Creatorhub samler dette i ett system med en tydelig kjerne, produkter bygget på toppen og et community-lag som holder økosystemet levende.',
    },
    structure: {
      label: 'Company Structure',
      title: 'Slik er Creatorhub strukturert',
      body:
        'Creatorhub AS organiseres som en plattformbedrift der kjerneplattformen er motoren, og produktene er utvidelser av samme system.',
      items: [
        {
          title: 'Kjerneplattform',
          subtitle: 'Project Management System',
          description: 'Prosjektstyring, team-samarbeid, arbeidsflyt og produksjonsoppfølging for kreative fag.',
        },
        {
          title: 'Produkter',
          subtitle: 'The Role Room og Creatorhub Academy',
          description: 'To tydelige produktlag som utdyper bruk og utvider plattformens verdi.',
        },
        {
          title: 'Community Layer',
          subtitle: 'Nettverk, læring og retensjon',
          description: 'Et lag som kobler kreatører, team og fagpersoner sammen over tid.',
        },
      ],
    },
    principles: {
      label: 'Principles',
      title: 'Hva som gjør Creatorhub annerledes',
      items: [
        'Plattform først. Produkter bygges på toppen av kjernen.',
        'Bygget av kreative, for kreative arbeidsflyter.',
        'Læring og community er integrert i systemet, ikke separate sideprosjekter.',
        'Struktur, gjennomføring og vekst henger sammen i samme plattform.',
      ],
    },
    layers: {
      label: 'Platform Layers',
      title: 'Lagene i økosystemet',
      body:
        'Hvert lag har en tydelig rolle i selskapet: kjernen driver arbeidsflyt, produktene utdyper bruk, og community-laget skaper langsiktig tilknytning.',
      platform: {
        title: 'Core Platform',
        body: 'Basen for planlegging, prosjektstyring, samarbeid og produksjonskontroll.',
      },
      roleRoom: {
        title: 'The Role Room',
        body: 'Produksjonssystem for planlegging, casting og gjennomføring.',
      },
      academy: {
        title: 'Creatorhub Academy',
        body: 'Læringslag for ferdighetsbygging, vekst og nye innganger til plattformen.',
      },
      community: {
        title: 'Community Layer',
        body: 'Et økosystem for samarbeid, relasjoner og retensjon rundt kreativt arbeid.',
      },
    },
    profile: {
      label: 'Company Profile',
      title: 'Om selskapet',
      body:
        'Creatorhub AS er posisjonert som et plattformselskap med tydelig produktstruktur og et selskapsspråk som speiler hvordan kreativt arbeid faktisk blir utført.',
      rows: [
        ['Selskap', 'Creatorhub AS'],
        ['Kategori', 'Plattform for kreativt arbeid'],
        ['Modell', 'Kjerneplattform med produkter og community-lag'],
        ['Posisjon', 'Bygget av kreative, for kreative'],
      ],
    },
    final: {
      title: 'Creatorhub er laget for hvordan kreativt arbeid faktisk skjer.',
      body:
        'Målet er å bygge et varig system for kreative profesjoner, der administrasjon, gjennomføring, læring og nettverk ikke lenger er fragmentert.',
      primary: 'Gå til forsiden',
      secondary: 'Åpne Community',
    },
    social: {
      label: 'Sosiale medier',
      body: 'Følg CreatorHub for oppdateringer om plattform, produkter og community.',
    },
  },
  en: {
    title: 'Creatorhub | About Creatorhub AS',
    nav: {
      home: 'Home',
      platform: 'Platform',
      roleRoom: 'Role Room',
      academy: 'Academy',
      community: 'Community',
      signIn: 'Sign in',
    },
    hero: {
      eyebrow: 'Creatorhub AS',
      title: 'About Creatorhub AS',
      subtitle:
        'Creatorhub is building a structured platform for managing, executing and scaling creative work.',
      body:
        'We are building for creative professions that need more than isolated tools. Creatorhub combines a core platform, products and a community layer into one connected system.',
      primary: 'Back to the homepage',
      secondary: 'Open the platform',
    },
    story: {
      label: 'Why Creatorhub Exists',
      title: 'We are building a system, not just more features.',
      body:
        'Creative work is often fragmented across project management, production tools, learning and relationships. Creatorhub brings these layers together into one structured system with a clear core, products built on top and a community layer that keeps the ecosystem active over time.',
    },
    structure: {
      label: 'Company Structure',
      title: 'How Creatorhub is structured',
      body:
        'Creatorhub AS is organised as a platform company where the core platform is the engine and the products extend the same system.',
      items: [
        {
          title: 'Core Platform',
          subtitle: 'Project Management System',
          description: 'Project management, team collaboration, workflow structure and production visibility for creative work.',
        },
        {
          title: 'Products',
          subtitle: 'The Role Room and Creatorhub Academy',
          description: 'Two product layers that deepen usage and expand the platform surface area.',
        },
        {
          title: 'Community Layer',
          subtitle: 'Network, learning and retention',
          description: 'A layer that connects creators, teams and professionals over time.',
        },
      ],
    },
    principles: {
      label: 'Principles',
      title: 'What makes Creatorhub different',
      items: [
        'Platform first. Products are built on top of the core.',
        'Built by creatives, for creative workflows.',
        'Learning and community are integrated into the system, not detached side bets.',
        'Structure, execution and growth live inside the same platform.',
      ],
    },
    layers: {
      label: 'Platform Layers',
      title: 'The layers in the ecosystem',
      body:
        'Each layer has a clear role in the company model: the core drives workflow, the products deepen usage, and the community layer supports long-term retention.',
      platform: {
        title: 'Core Platform',
        body: 'The base for planning, project management, collaboration and production control.',
      },
      roleRoom: {
        title: 'The Role Room',
        body: 'A production system for planning, casting and execution.',
      },
      academy: {
        title: 'Creatorhub Academy',
        body: 'A learning layer for skill development, growth and new entry points into the platform.',
      },
      community: {
        title: 'Community Layer',
        body: 'An ecosystem for collaboration, relationships and retention around creative work.',
      },
    },
    profile: {
      label: 'Company Profile',
      title: 'Company overview',
      body:
        'Creatorhub AS is positioned as a platform company with a clear product structure and a company narrative aligned with how creative work is actually executed.',
      rows: [
        ['Company', 'Creatorhub AS'],
        ['Category', 'Platform for creative work'],
        ['Model', 'Core platform with products and a community layer'],
        ['Positioning', 'Built by creatives, for creatives'],
      ],
    },
    final: {
      title: 'Creatorhub is designed around how creative work actually happens.',
      body:
        'The goal is to build a lasting system for creative professions where operations, execution, learning and network are no longer fragmented.',
      primary: 'Go to homepage',
      secondary: 'Open Community',
    },
    social: {
      label: 'Social media',
      body: 'Follow CreatorHub for platform, product, and community updates.',
    },
  },
} as const;

const MotionDiv = motion.div;

function upsertHeadLink(rel: string, href: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const existing = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (existing) {
    existing.href = href;
    return;
  }

  const next = document.createElement('link');
  next.rel = rel;
  next.href = href;
  document.head.appendChild(next);
}

function ensureLandingFonts() {
  if (typeof document === 'undefined' || document.getElementById('creatorhub-investor-fonts')) {
    return;
  }

  const link = document.createElement('link');
  link.id = 'creatorhub-investor-fonts';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Space+Grotesk:wght@500;700&display=swap';
  document.head.appendChild(link);
}

function AboutSectionHeading({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <Stack spacing={2} sx={{ maxWidth: 760 }}>
      <Typography
        sx={{
          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
          fontSize: '0.8rem',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'rgba(255,186,108,0.84)',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="h2"
        sx={{
          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
          fontWeight: 700,
          fontSize: { xs: '2rem', md: '3rem' },
          lineHeight: 1.02,
          color: '#f7f1e8',
          letterSpacing: '-0.04em',
        }}
      >
        {title}
      </Typography>
      <Typography sx={{ color: 'rgba(242,234,223,0.72)', lineHeight: 1.8, fontSize: { xs: '1rem', md: '1.08rem' } }}>
        {body}
      </Typography>
    </Stack>
  );
}

function AboutComponent() {
  const { language, setLanguage } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const copy = aboutCopy[language];
  const creatorhubSocialLinks = getPublicSocialProfiles('creatorhub');

  useEffect(() => {
    ensureLandingFonts();
    document.title = copy.title;
    upsertHeadLink('icon', CREATORHUB_ICON_URL);
    upsertHeadLink('apple-touch-icon', CREATORHUB_ICON_URL);
  }, [copy.title]);

  const navigate = (path: string) => {
    setMenuOpen(false);
    setLocation(path);
  };

  const openExternalUrl = (url: string) => {
    setMenuOpen(false);
    window.location.href = url;
  };

  return (
    <Box sx={{ bgcolor: '#05060a', color: '#f6f2ea', minHeight: '100vh' }}>
      <GlobalStyles
        styles={{
          body: { backgroundColor: '#05060a', color: '#f6f2ea' },
          '#root': { backgroundColor: '#05060a' },
        }}
      />

      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(180deg, rgba(5,6,10,0.28) 0%, rgba(5,6,10,0.84) 62%, rgba(5,6,10,1) 100%), url(${ABOUT_BACKDROP_URL})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.34,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at top right, rgba(255,186,108,0.18), transparent 28%), radial-gradient(circle at left center, rgba(208,120,56,0.12), transparent 38%)',
          }}
        />

        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(22px)',
            background: 'rgba(5,6,10,0.58)',
          }}
        >
          <Container maxWidth="xl" sx={{ py: 1.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Button
                onClick={() => navigate('/')}
                sx={{
                  gap: 1.2,
                  px: 0,
                  color: '#fff5e8',
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                <Box component="img" src={CREATORHUB_ICON_URL} alt="Creatorhub" sx={{ width: 34, height: 34 }} />
                <Stack spacing={0.15} sx={{ alignItems: 'flex-start' }}>
                  <Typography sx={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif', fontWeight: 700 }}>
                    Creatorhub
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,245,232,0.56)' }}>
                    Creatorhub AS
                  </Typography>
                </Stack>
              </Button>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
                <Button onClick={() => navigate('/')} sx={{ color: 'rgba(246,242,234,0.74)' }}>
                  {copy.nav.home}
                </Button>
                <Button onClick={() => openExternalUrl(ROLE_ROOM_EXTERNAL_URL)} sx={{ color: 'rgba(246,242,234,0.74)' }}>
                  {copy.nav.roleRoom}
                </Button>
                <Button onClick={() => navigate('/academy')} sx={{ color: 'rgba(246,242,234,0.74)' }}>
                  {copy.nav.academy}
                </Button>
                <Button onClick={() => navigate('/community')} sx={{ color: 'rgba(246,242,234,0.74)' }}>
                  {copy.nav.community}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    p: 0.5,
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    bgcolor: 'rgba(255,255,255,0.03)',
                  }}
                >
                  {localeOptions.map((option) => (
                    <Button
                      key={option.value}
                      onClick={() => setLanguage(option.value)}
                      startIcon={<span>{option.flag}</span>}
                      sx={{
                        minWidth: 0,
                        px: 1.4,
                        py: 0.65,
                        borderRadius: '999px',
                        color: language === option.value ? '#150d05' : 'rgba(246,242,234,0.72)',
                        backgroundColor: language === option.value ? '#ffba6c' : 'transparent',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textTransform: 'none',
                        '&:hover': {
                          backgroundColor:
                            language === option.value ? '#ffba6c' : 'rgba(255,255,255,0.06)',
                        },
                      }}
                    >
                      {language === 'no' ? option.no : option.en}
                    </Button>
                  ))}
                </Stack>

                <Button
                  onClick={() => navigate('/login')}
                  variant="outlined"
                  sx={{
                    display: { xs: 'none', md: 'inline-flex' },
                    borderColor: 'rgba(255,186,108,0.4)',
                    color: '#ffba6c',
                    borderRadius: '999px',
                    '&:hover': { borderColor: '#ffba6c', bgcolor: 'rgba(255,186,108,0.08)' },
                  }}
                >
                  {copy.nav.signIn}
                </Button>

                <IconButton
                  onClick={() => setMenuOpen(true)}
                  sx={{ display: { xs: 'inline-flex', md: 'none' }, color: '#fff5e8' }}
                >
                  <Menu />
                </IconButton>
              </Stack>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1, py: { xs: 9, md: 13 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(320px, 0.84fr)' },
              gap: { xs: 6, md: 8 },
              alignItems: 'end',
            }}
          >
            <MotionDiv
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <Stack spacing={3}>
                <Typography sx={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif', color: 'rgba(255,186,108,0.84)', letterSpacing: '0.24em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                  {copy.hero.eyebrow}
                </Typography>
                <Typography
                  variant="h1"
                  sx={{
                    fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                    fontWeight: 700,
                    fontSize: { xs: '3rem', md: '5.4rem' },
                    lineHeight: 0.94,
                    letterSpacing: '-0.06em',
                    maxWidth: 760,
                  }}
                >
                  {copy.hero.title}
                </Typography>
                <Typography sx={{ fontSize: { xs: '1.08rem', md: '1.26rem' }, color: 'rgba(246,242,234,0.76)', maxWidth: 620, lineHeight: 1.75 }}>
                  {copy.hero.subtitle}
                </Typography>
                <Typography sx={{ fontSize: '1rem', color: 'rgba(246,242,234,0.58)', maxWidth: 660, lineHeight: 1.8 }}>
                  {copy.hero.body}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
                  <Button
                    onClick={() => navigate('/')}
                    variant="contained"
                    endIcon={<ArrowForward />}
                    sx={{
                      borderRadius: '999px',
                      px: 3,
                      py: 1.35,
                      bgcolor: '#ffba6c',
                      color: '#150d05',
                      fontWeight: 800,
                      '&:hover': { bgcolor: '#ffcb91' },
                    }}
                  >
                    {copy.hero.primary}
                  </Button>
                  <Button
                    onClick={() => navigate('/login')}
                    variant="text"
                    endIcon={<NorthEast />}
                    sx={{
                      color: '#fff5e8',
                      justifyContent: { xs: 'space-between', sm: 'center' },
                      '&:hover': { bgcolor: 'transparent', color: '#ffcf95' },
                    }}
                  >
                    {copy.hero.secondary}
                  </Button>
                </Stack>
              </Stack>
            </MotionDiv>

            <MotionDiv
              initial={{ opacity: 0, y: 42 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.78, delay: 0.14 }}
            >
              <Box
                sx={{
                  borderRadius: '30px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                  p: { xs: 3, md: 4 },
                }}
              >
                <Stack spacing={2.2}>
                  {copy.structure.items.map((item, index) => (
                    <Box
                      key={item.title}
                      sx={{
                        p: 2.2,
                        borderRadius: '22px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        bgcolor: index === 0 ? 'rgba(255,186,108,0.12)' : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <Stack spacing={0.7}>
                        <Typography sx={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif', fontWeight: 700 }}>
                          {item.title}
                        </Typography>
                        <Typography sx={{ color: 'rgba(246,242,234,0.58)', fontSize: '0.92rem' }}>
                          {item.subtitle}
                        </Typography>
                        <Typography sx={{ color: 'rgba(246,242,234,0.74)', lineHeight: 1.75 }}>
                          {item.description}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </MotionDiv>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 10, md: 14 } }}>
        <Stack spacing={{ xs: 10, md: 14 }}>
          <MotionDiv initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}>
            <AboutSectionHeading
              label={copy.story.label}
              title={copy.story.title}
              body={copy.story.body}
            />
          </MotionDiv>

          <MotionDiv initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}>
            <AboutSectionHeading
              label={copy.structure.label}
              title={copy.structure.title}
              body={copy.structure.body}
            />
          </MotionDiv>

          <MotionDiv initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}>
            <Box
              sx={{
                borderRadius: '30px',
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden',
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
              }}
            >
              {copy.principles.items.map((item, index) => (
                <Box
                  key={item}
                  sx={{
                    p: { xs: 3, md: 3.5 },
                    borderRight: {
                      xs: 'none',
                      md: index === copy.principles.items.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    },
                    borderBottom: {
                      xs: index === copy.principles.items.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      md: 'none',
                    },
                    backgroundColor: index === 0 ? 'rgba(255,186,108,0.08)' : 'transparent',
                  }}
                >
                  <Typography sx={{ color: '#fbf5ee', lineHeight: 1.8 }}>{item}</Typography>
                </Box>
              ))}
            </Box>
          </MotionDiv>

          <MotionDiv initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}>
            <AboutSectionHeading
              label={copy.layers.label}
              title={copy.layers.title}
              body={copy.layers.body}
            />
            <Box
              sx={{
                mt: 5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                gap: 2,
              }}
            >
              {[
                {
                  title: copy.layers.platform.title,
                  body: copy.layers.platform.body,
                  icon: <AccountTree sx={{ color: '#ffba6c' }} />,
                  media: <Box component="img" src={CREATORHUB_ICON_URL} alt="Creatorhub" sx={{ width: 52, height: 52 }} />,
                },
                {
                  title: copy.layers.roleRoom.title,
                  body: copy.layers.roleRoom.body,
                  icon: <AutoAwesome sx={{ color: '#ffba6c' }} />,
                  media: <Box component="img" src={ROLE_ROOM_LOGO_URL} alt="The Role Room" sx={{ width: 210, height: 'auto' }} />,
                },
                {
                  title: copy.layers.academy.title,
                  body: copy.layers.academy.body,
                  icon: <School sx={{ color: '#ffba6c' }} />,
                  media: <Box component="img" src={ACADEMY_LOGO_URL} alt="Creatorhub Academy" sx={{ width: 180, height: 'auto' }} />,
                },
                {
                  title: copy.layers.community.title,
                  body: copy.layers.community.body,
                  icon: <Groups sx={{ color: '#ffba6c' }} />,
                  media: <Box component="img" src={COMMUNITY_ICON_URL} alt="Creatorhub Community" sx={{ width: 52, height: 52 }} />,
                },
              ].map((layer) => (
                <Box
                  key={layer.title}
                  sx={{
                    borderRadius: '26px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    p: 3,
                  }}
                >
                  <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                      {layer.media}
                      {layer.icon}
                    </Stack>
                    <Typography sx={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif', fontWeight: 700, fontSize: '1.2rem' }}>
                      {layer.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(246,242,234,0.7)', lineHeight: 1.8 }}>
                      {layer.body}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Box>
          </MotionDiv>

          <MotionDiv initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}>
            <AboutSectionHeading
              label={copy.profile.label}
              title={copy.profile.title}
              body={copy.profile.body}
            />
            <Box
              sx={{
                mt: 5,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {copy.profile.rows.map(([label, value], index) => (
                <Stack
                  key={label}
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  justifyContent="space-between"
                  sx={{
                    py: 2.5,
                    borderBottom:
                      index === copy.profile.rows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(255,186,108,0.84)', minWidth: 180 }}>{label}</Typography>
                  <Typography sx={{ color: '#fbf5ee' }}>{value}</Typography>
                </Stack>
              ))}
            </Box>
          </MotionDiv>
        </Stack>
      </Container>

      <Box sx={{ px: { xs: 2, md: 4 }, pb: { xs: 10, md: 14 } }}>
        <Box
          sx={{
            maxWidth: 1480,
            mx: 'auto',
            borderRadius: '34px',
            border: '1px solid rgba(255,186,108,0.14)',
            background:
              'linear-gradient(135deg, rgba(255,186,108,0.16) 0%, rgba(27,18,9,0.96) 55%, rgba(10,10,16,0.98) 100%)',
            p: { xs: 3, md: 5 },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
              gap: { xs: 3, md: 4 },
              alignItems: 'center',
            }}
          >
            <Stack spacing={2}>
              <Typography
                sx={{
                  fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                  fontSize: { xs: '2rem', md: '3.4rem' },
                  lineHeight: 1,
                  fontWeight: 700,
                  letterSpacing: '-0.05em',
                  maxWidth: 760,
                }}
              >
                {copy.final.title}
              </Typography>
              <Typography sx={{ color: 'rgba(246,242,234,0.72)', maxWidth: 740, lineHeight: 1.8 }}>
                {copy.final.body}
              </Typography>
              <PublicSocialLinks
                label={copy.social.label}
                body={copy.social.body}
                links={creatorhubSocialLinks}
                tone="creatorhub"
                maxWidth={520}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
              <Button
                onClick={() => navigate('/')}
                variant="contained"
                endIcon={<ArrowForward />}
                sx={{
                  borderRadius: '999px',
                  px: 3,
                  py: 1.3,
                  bgcolor: '#ffba6c',
                  color: '#150d05',
                  fontWeight: 800,
                  '&:hover': { bgcolor: '#ffcb91' },
                }}
              >
                {copy.final.primary}
              </Button>
              <Button
                onClick={() => navigate('/community')}
                variant="outlined"
                endIcon={<NorthEast />}
                sx={{
                  borderRadius: '999px',
                  px: 3,
                  py: 1.3,
                  borderColor: 'rgba(255,245,232,0.22)',
                  color: '#fff5e8',
                  '&:hover': { borderColor: '#fff5e8', bgcolor: 'rgba(255,255,255,0.04)' },
                }}
              >
                {copy.final.secondary}
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>

      <Drawer
        anchor="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        PaperProps={{
          sx: {
            width: 300,
            bgcolor: '#0b0d12',
            color: '#f6f2ea',
            p: 2,
          },
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif', fontWeight: 700 }}>
              Creatorhub
            </Typography>
            <IconButton onClick={() => setMenuOpen(false)} sx={{ color: '#fff5e8' }}>
              <Close />
            </IconButton>
          </Stack>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          <Button onClick={() => navigate('/')} sx={{ justifyContent: 'space-between', color: '#fbf5ee' }} endIcon={<ArrowForward />}>
            {copy.nav.home}
          </Button>
          <Button onClick={() => openExternalUrl(ROLE_ROOM_EXTERNAL_URL)} sx={{ justifyContent: 'space-between', color: '#fbf5ee' }} endIcon={<ArrowForward />}>
            {copy.nav.roleRoom}
          </Button>
          <Button onClick={() => navigate('/academy')} sx={{ justifyContent: 'space-between', color: '#fbf5ee' }} endIcon={<ArrowForward />}>
            {copy.nav.academy}
          </Button>
          <Button onClick={() => navigate('/community')} sx={{ justifyContent: 'space-between', color: '#fbf5ee' }} endIcon={<ArrowForward />}>
            {copy.nav.community}
          </Button>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <Button
            onClick={() => navigate('/login')}
            variant="contained"
            sx={{
              borderRadius: '999px',
              bgcolor: '#ffba6c',
              color: '#150d05',
              fontWeight: 800,
              '&:hover': { bgcolor: '#ffcb91' },
            }}
          >
            {copy.nav.signIn}
          </Button>
        </Stack>
      </Drawer>
    </Box>
  );
}

const About = withVisualEditor(AboutComponent, {
  componentId: 'about',
  componentName: 'About Page',
  category: 'company',
  editable: true,
  previewable: true,
  templateable: true,
  propsEditable: true,
});

export default About;
