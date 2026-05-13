/**
 * PressKitPage.tsx
 *
 * SEO-side `/presse` med pressepakke: boilerplate, logoer,
 * fakta og kontaktinfo. Strukturert for at journalister og
 * partnere skal finne alt de trenger uten å spørre.
 */

import React, { useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import EmailIcon from '@mui/icons-material/Email';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { roleRoomAnalytics } from '../services/roleRoomAnalytics';
import { clarityTag } from '@/lib/clarity';
import BlockRenderer from '../cms/BlockRenderer';
import { useCmsBlocks } from '../cms/useCmsBlocks';
import { DEFAULT_LOCALE, type Locale } from '../cms/blockSchema';

const PRESS_CONTACT_EMAIL = 'presse@theroleroom.com';

const FACTS: Array<{ label: string; value: string }> = [
  { label: 'Navn', value: 'The Role Room' },
  { label: 'Eier', value: 'CreatorHub AS (Norge)' },
  { label: 'Lansert', value: '2026' },
  { label: 'Kategori', value: 'Casting & produksjonsplattform' },
  { label: 'Marked', value: 'Norge og Norden (norsk + engelsk UI)' },
  { label: 'Datalagring', value: 'EU/EØS, GDPR-compliant' },
];

const BOILERPLATE_SHORT =
  'The Role Room er en norsk casting- og produksjonsplattform for film, TV og innholdsproduksjon. Roller, auditions, talenter, crew, lokasjoner og storyboard samles i ett arbeidsrom — med norsk språk, GDPR-trygg datalagring og en integrert AI-agent for casting-arbeidsflyt.';

const BOILERPLATE_LONG =
  'The Role Room er en del av CreatorHub-økosystemet og bygget av nordiske produksjonsfolk for det nordiske markedet. Plattformen dekker hele casting-pipelinen — fra rolle-opprettelse og selvbetjent audition-innspilling via talentportal til opptaks-koordinering med crew, lokasjoner, kalender og kommunikasjon. The Role Room kombinerer dette med Live Set Mode for selve opptaksdagen og DIT-backup-infrastruktur for kamera-data — alt i én samlet flate. Dataene lagres i EU/EØS med tydelig databehandler-avtale.';

const LOGOS: Array<{ name: string; src: string; alt: string; download: string }> = [
  {
    name: 'The Role Room — App-logo (PNG)',
    src: '/TheRoleRoom_App_Logo.png',
    alt: 'The Role Room app-logo',
    download: '/TheRoleRoom_App_Logo.png',
  },
  {
    name: 'Landing backdrop (WEBP)',
    src: '/role-room-assets/landing_backdrop_with_logo.webp',
    alt: 'The Role Room landing-backdrop med logo',
    download: '/role-room-assets/landing_backdrop_with_logo.webp',
  },
];

const BRAND_COLORS: Array<{ name: string; hex: string; usage: string }> = [
  { name: 'Bakgrunn', hex: '#121218', usage: 'Hoved-bakgrunn (mørk)' },
  { name: 'Aksent lilla', hex: '#a78bfa', usage: 'CTA-er, fremhevet tekst' },
  { name: 'Tekst primær', hex: '#f8fafc', usage: 'Brødtekst på mørk bakgrunn' },
  { name: 'Tekst sekundær', hex: 'rgba(203,213,225,0.78)', usage: 'Støttetekst' },
];

function useOrganizationPressSchema() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const schemaId = 'roleroom-press-organization';
    document.querySelector(`script[data-schema-id="${schemaId}"]`)?.remove();

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://theroleroom.com/#organization',
      name: 'The Role Room',
      legalName: 'CreatorHub AS',
      url: 'https://theroleroom.com',
      logo: 'https://theroleroom.com/TheRoleRoom_App_Logo.png',
      sameAs: ['https://creatorhubn.com'],
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'Press',
          email: PRESS_CONTACT_EMAIL,
          areaServed: 'NO',
          availableLanguage: ['Norwegian', 'English'],
        },
      ],
      description: BOILERPLATE_SHORT,
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema-id', schemaId);
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.querySelector(`script[data-schema-id="${schemaId}"]`)?.remove();
    };
  }, []);
}

export function parsePressKitFromPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();
  return normalized === '/presse' || normalized === '/press';
}

export interface PressKitPageProps {
  locale?: Locale;
}

export default function PressKitPage({ locale = DEFAULT_LOCALE }: PressKitPageProps = {}) {
  useOrganizationPressSchema();
  const cmsBlocks = useCmsBlocks('presse');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    try {
      roleRoomAnalytics.seoPageViewed({ page_type: 'press-kit', page_slug: 'presse' });
    } catch {
      // analytics er best-effort
    }
    clarityTag('page_type', 'press-kit');
  }, []);

  if (cmsBlocks) {
    return <BlockRenderer blocks={cmsBlocks} locale={locale} />;
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      <Stack spacing={5}>
        {/* Hero */}
        <Stack spacing={2} sx={{ maxWidth: 820 }}>
          <Chip
            label="Pressepakke"
            size="small"
            sx={{
              alignSelf: 'flex-start',
              bgcolor: 'rgba(167,139,250,0.16)',
              color: '#ddd6fe',
              fontWeight: 600,
            }}
          />
          <Typography
            component="h1"
            sx={{
              color: '#f8fafc',
              fontWeight: 800,
              fontSize: { xs: '1.8rem', md: '2.6rem' },
              lineHeight: 1.15,
            }}
          >
            Pressepakke — The Role Room
          </Typography>
          <Typography
            sx={{
              color: 'rgba(203,213,225,0.86)',
              fontSize: { xs: '1rem', md: '1.15rem' },
              lineHeight: 1.6,
            }}
          >
            Logoer, boilerplate, fakta og pressekontakt. Bruk fritt i redaksjonell sammenheng — refererer du
            til The Role Room i en sak, send oss gjerne en lenke.
          </Typography>
        </Stack>

        {/* Fakta */}
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <CardContent>
            <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.25rem', mb: 2 }}>
              Hurtigfakta
            </Typography>
            <Grid container spacing={2}>
              {FACTS.map((fact) => (
                <Grid item xs={12} sm={6} md={4} key={fact.label}>
                  <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {fact.label}
                  </Typography>
                  <Typography sx={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 500 }}>
                    {fact.value}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Boilerplate */}
        <Stack spacing={2}>
          <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.25rem' }}>
            Boilerplate
          </Typography>
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <CardContent>
              <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                Kort versjon (≤ 60 ord)
              </Typography>
              <Typography sx={{ color: '#f8fafc', fontSize: '1rem', lineHeight: 1.7, mb: 3 }}>
                {BOILERPLATE_SHORT}
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 3 }} />
              <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                Lang versjon
              </Typography>
              <Typography sx={{ color: '#f8fafc', fontSize: '1rem', lineHeight: 1.7 }}>
                {BOILERPLATE_LONG}
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        {/* Logoer */}
        <Stack spacing={2}>
          <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.25rem' }}>
            Logoer
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.95rem' }}>
            Bruk gjerne logoen vår i redaksjonell sammenheng. Ikke endre proporsjoner, farger eller legg til ramme.
          </Typography>
          <Grid container spacing={2}>
            {LOGOS.map((logo) => (
              <Grid item xs={12} sm={6} key={logo.src}>
                <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <CardContent>
                    <Box
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.06)',
                        borderRadius: 1,
                        p: 3,
                        mb: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 140,
                      }}
                    >
                      <Box
                        component="img"
                        src={logo.src}
                        alt={logo.alt}
                        sx={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }}
                      />
                    </Box>
                    <Typography sx={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: 500, mb: 1 }}>
                      {logo.name}
                    </Typography>
                    <Button
                      component="a"
                      href={logo.download}
                      download
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      sx={{
                        color: '#ddd6fe',
                        borderColor: 'rgba(167,139,250,0.4)',
                        '&:hover': { borderColor: '#a78bfa', bgcolor: 'rgba(167,139,250,0.08)' },
                      }}
                    >
                      Last ned
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Stack>

        {/* Brand-farger */}
        <Stack spacing={2}>
          <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.25rem' }}>
            Brand-farger
          </Typography>
          <Grid container spacing={2}>
            {BRAND_COLORS.map((color) => (
              <Grid item xs={6} sm={3} key={color.name}>
                <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Box sx={{ bgcolor: color.hex, height: 80, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                  <CardContent>
                    <Typography sx={{ color: '#f8fafc', fontSize: '0.9rem', fontWeight: 600 }}>
                      {color.name}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {color.hex}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.75rem', mt: 0.5 }}>
                      {color.usage}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Stack>

        {/* Kontakt */}
        <Card
          sx={{
            bgcolor: 'rgba(167,139,250,0.08)',
            border: '1px solid rgba(167,139,250,0.24)',
          }}
        >
          <CardContent>
            <Stack spacing={2}>
              <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.25rem' }}>
                Pressekontakt
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.86)', fontSize: '1rem' }}>
                Henvendelser fra presse, partnere og bransje besvares innen 1 virkedag.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  component="a"
                  href={`mailto:${PRESS_CONTACT_EMAIL}`}
                  variant="contained"
                  startIcon={<EmailIcon />}
                  sx={{
                    bgcolor: '#a78bfa',
                    color: '#121218',
                    fontWeight: 600,
                    '&:hover': { bgcolor: '#8b5cf6' },
                  }}
                >
                  {PRESS_CONTACT_EMAIL}
                </Button>
                <Button
                  component="a"
                  href="https://theroleroom.com"
                  target="_blank"
                  rel="noopener"
                  variant="outlined"
                  endIcon={<OpenInNewIcon />}
                  sx={{
                    color: '#ddd6fe',
                    borderColor: 'rgba(167,139,250,0.4)',
                    '&:hover': { borderColor: '#a78bfa', bgcolor: 'rgba(167,139,250,0.08)' },
                  }}
                >
                  Besøk theroleroom.com
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
