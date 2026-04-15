// @ts-nocheck
import React, { useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowForward,
  AutoAwesome,
  HealthAndSafety,
  Insights,
  Security,
  Timeline,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import PublicSocialLinks from '@/components/common/PublicSocialLinks';
import { GdprNotice } from '@/components/common/GdprNotice';
import {
  getPublicSocialProfiles,
  PUBLIC_BRAND_LINKS,
} from '@/lib/publicBrandLinks';
import { syncSiteSeo } from '@/lib/siteSeo';
import { trackMarketingPageView } from '@/lib/marketingPixelsRuntime';

const tidumHighlights = [
  {
    title: 'Bygget for felt og virksomhet',
    body: 'Tidum er utviklet for virksomheter innen barn, omsorg og miljøarbeid som trenger et tryggere arbeidstidssystem enn generiske timeløsninger.',
    icon: <HealthAndSafety />,
  },
  {
    title: 'Tilgang på forespørsel',
    body: 'Virksomheter vurderes og aktiveres manuelt. Ledere kan deretter godkjenne miljøarbeidere og styre tilgang internt.',
    icon: <Security />,
  },
  {
    title: 'Fra drift til innsikt',
    body: 'Løsningen samler timeføring, dokumentasjonskrav, rapportering og operativ oppfølging i ett system.',
    icon: <Insights />,
  },
];

export default function CreatorhubInnovationPage() {
  const [, setLocation] = useLocation();
  const socialLinks = getPublicSocialProfiles('creatorhub');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    syncSiteSeo({
      hostname: window.location.hostname,
      pathname: '/creatorhub-innovasjon',
    });
    trackMarketingPageView('/creatorhub-innovasjon');
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#f8fafc',
        background:
          'radial-gradient(circle at top left, rgba(255,140,0,0.18) 0%, transparent 32%), radial-gradient(circle at top right, rgba(14,165,233,0.14) 0%, transparent 28%), linear-gradient(180deg, #0f1116 0%, #17120f 46%, #0b1016 100%)',
      }}
    >
      <Container maxWidth="xl" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={4}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            spacing={3}
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Box>
              <Chip
                label="Creatorhub Innovasjon"
                sx={{
                  mb: 2,
                  bgcolor: 'rgba(255, 140, 0, 0.14)',
                  color: '#ffba6c',
                  border: '1px solid rgba(255, 186, 108, 0.28)',
                }}
              />
              <Typography
                sx={{
                  fontSize: { xs: '2.4rem', md: '4.4rem' },
                  lineHeight: 0.95,
                  letterSpacing: '-0.05em',
                  fontWeight: 700,
                  maxWidth: 900,
                }}
              >
                Produkter utviklet av Creatorhub AS
              </Typography>
              <Typography
                sx={{
                  mt: 2,
                  maxWidth: 760,
                  fontSize: { xs: '1rem', md: '1.18rem' },
                  color: 'rgba(241,245,249,0.78)',
                  lineHeight: 1.8,
                }}
              >
                Creatorhub Innovasjon er flaten der vi presenterer løsninger som utvikles internt
                i Creatorhub AS. Første produkt ut er Tidum, et arbeidstidssystem bygget for
                virksomheter som jobber tett på mennesker, turnus og dokumentasjon.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={() => window.open('https://tidum.no', '_blank', 'noopener,noreferrer')}
                sx={{
                  borderRadius: '999px',
                  bgcolor: '#ff8c00',
                  px: 3,
                  py: 1.35,
                  '&:hover': { bgcolor: '#e67e00' },
                }}
              >
                Åpne Tidum
              </Button>
              <Button
                variant="outlined"
                onClick={() => setLocation('/about')}
                sx={{
                  borderRadius: '999px',
                  px: 3,
                  py: 1.35,
                  color: '#f8fafc',
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                Om Creatorhub AS
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={2.5}>
            <Grid item xs={12} lg={7}>
              <Paper
                sx={{
                  height: '100%',
                  p: { xs: 3, md: 4 },
                  borderRadius: '28px',
                  bgcolor: 'rgba(12, 17, 24, 0.74)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(18px)',
                }}
              >
                <Stack spacing={3}>
                  <Box>
                    <Typography sx={{ color: '#ffba6c', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.82rem' }}>
                      Case 01
                    </Typography>
                    <Typography sx={{ mt: 1, fontSize: { xs: '1.7rem', md: '2.4rem' }, fontWeight: 700 }}>
                      Tidum
                    </Typography>
                    <Typography sx={{ mt: 1.25, color: 'rgba(241,245,249,0.78)', lineHeight: 1.85 }}>
                      Tidum er ikke markedsført som CreatorHubs hovedprodukt. Det er utviklet som et
                      spesialisert system for virksomheter og ledere som trenger strukturert tilgang,
                      godkjenningsflyt og mer robust arbeidstidsoppfølging enn det vanlige markedet tilbyr.
                    </Typography>
                  </Box>

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 2.5, borderRadius: '22px', bgcolor: 'rgba(255,255,255,0.03)' }}>
                        <Typography sx={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#ffba6c', mb: 1 }}>
                          Fokus
                        </Typography>
                        <Typography sx={{ lineHeight: 1.8, color: 'rgba(241,245,249,0.86)' }}>
                          Barn, omsorg, miljøarbeid, turnusnære team og ledere med godkjenningsansvar.
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 2.5, borderRadius: '22px', bgcolor: 'rgba(255,255,255,0.03)' }}>
                        <Typography sx={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#ffba6c', mb: 1 }}>
                          Modell
                        </Typography>
                        <Typography sx={{ lineHeight: 1.8, color: 'rgba(241,245,249,0.86)' }}>
                          Tilgang på forespørsel, virksomhetsaktivering manuelt, og intern godkjenning av brukere etterpå.
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} lg={5}>
              <Paper
                sx={{
                  height: '100%',
                  p: { xs: 3, md: 4 },
                  borderRadius: '28px',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(18px)',
                }}
              >
                <Stack spacing={2.5}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <AutoAwesome sx={{ color: '#ffba6c' }} />
                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      Hvorfor dette ligger i Creatorhub Innovasjon
                    </Typography>
                  </Stack>
                  <Typography sx={{ color: 'rgba(241,245,249,0.78)', lineHeight: 1.85 }}>
                    Tidum er et eksempel på hvordan Creatorhub AS bygger vertikale produkter på toppen
                    av samme operative kompetanse: arbeidsflyt, tilgang, struktur, innhold og systemdesign.
                  </Typography>
                  <Stack spacing={1.5}>
                    {[
                      'Utviklet og driftet av Creatorhub AS',
                      'Beholdt som eget brand med egen hosting og egen analyse',
                      'Koblet til CreatorHub der det gir operativ verdi, blant annet administrasjon og tilgang',
                    ].map((item) => (
                      <Stack key={item} direction="row" spacing={1.5} alignItems="flex-start">
                        <Timeline sx={{ mt: 0.25, color: '#22d3ee', fontSize: 18 }} />
                        <Typography sx={{ color: 'rgba(241,245,249,0.84)', lineHeight: 1.75 }}>
                          {item}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={2.5}>
            {tidumHighlights.map((item) => (
              <Grid item xs={12} md={4} key={item.title}>
                <Paper
                  sx={{
                    height: '100%',
                    p: 3,
                    borderRadius: '24px',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <Stack spacing={1.5}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '14px',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'rgba(255, 140, 0, 0.14)',
                        color: '#ffba6c',
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Typography sx={{ fontSize: '1.08rem', fontWeight: 700 }}>
                      {item.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(241,245,249,0.74)', lineHeight: 1.75 }}>
                      {item.body}
                    </Typography>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: '28px',
              bgcolor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <Box>
                <Typography sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 700 }}>
                  Vil du se hvordan Tidum er satt opp?
                </Typography>
                <Typography sx={{ mt: 1, maxWidth: 720, color: 'rgba(241,245,249,0.74)', lineHeight: 1.8 }}>
                  Tidum hostes som et eget produkt, men presenteres her som en del av Creatorhub AS sin
                  innovasjonsportefølje.
                </Typography>
              </Box>
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={() => window.open('https://tidum.no/kontakt', '_blank', 'noopener,noreferrer')}
                sx={{
                  borderRadius: '999px',
                  bgcolor: '#22d3ee',
                  color: '#07111b',
                  px: 3,
                  py: 1.35,
                  '&:hover': { bgcolor: '#0ea5e9' },
                }}
              >
                Be om tilgang til Tidum
              </Button>
            </Stack>
          </Paper>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 2,
              flexDirection: { xs: 'column', md: 'row' },
              pb: 6,
            }}
          >
            <PublicSocialLinks
              links={socialLinks}
              brandName="CreatorHub Norge"
              label="Følg CreatorHub"
              description="Følg CreatorHub for produktoppdateringer og nye initiativer fra Creatorhub AS."
              iconColor="#ffba6c"
              textColor="rgba(241,245,249,0.82)"
              mutedColor="rgba(241,245,249,0.56)"
            />
            <Button
              variant="text"
              sx={{ color: '#ffba6c' }}
              onClick={() => setLocation('/')}
            >
              Tilbake til CreatorHub
            </Button>
          </Box>
        </Stack>
      </Container>

      <GdprNotice position="bottom" />
    </Box>
  );
}
