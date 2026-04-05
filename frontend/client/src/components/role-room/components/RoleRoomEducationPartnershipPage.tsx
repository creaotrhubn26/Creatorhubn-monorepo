import { useState } from 'react';
import {
  ArrowBackRounded,
  ArrowForwardRounded,
  AutoStoriesRounded,
  BusinessCenterRounded,
  ChecklistRounded,
  Groups2Rounded,
  SchoolRounded,
  VideocamRounded,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import PublicSocialLinks from '@/components/common/PublicSocialLinks';
import { getPublicSocialProfiles } from '@/lib/publicBrandLinks';
import LoginDialog from './LoginDialog';
import { ROLE_ROOM_BRAND_ASSETS } from '../config/branding';
import { getRoleRoomVideoStillUrl } from '../utils/roleRoomMedia';
const roleRoomSocialLinks = getPublicSocialProfiles('roleRoom');

export default function RoleRoomEducationPartnershipPage() {
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const backdropStillUrl = getRoleRoomVideoStillUrl(
    '/role-room-assets/landing_backdrop.mp4',
    '/role-room-assets/landing_backdrop.webp',
  );

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        overflowX: 'hidden',
        bgcolor: '#06070d',
        color: '#f8f5ef',
      }}
    >
      {backdropStillUrl ? (
        <Box
          component="img"
          src={backdropStillUrl}
          alt=""
          aria-hidden="true"
          sx={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 24%',
            opacity: 0.18,
            filter: 'saturate(0.55) brightness(0.42)',
            pointerEvents: 'none',
          }}
        />
      ) : null}

      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(7,8,14,0.76) 0%, rgba(7,8,14,0.4) 34%, rgba(7,8,14,0.92) 100%)',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, py: { xs: 3, md: 5 } }}>
        <Stack spacing={{ xs: 4.5, md: 7 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Button
              type="button"
              onClick={() => window.location.assign('/')}
              startIcon={<ArrowBackRounded />}
              sx={{
                alignSelf: 'flex-start',
                color: 'rgba(246,242,234,0.88)',
                borderRadius: '999px',
                px: 1.8,
                py: 0.8,
                textTransform: 'none',
                bgcolor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              Tilbake til The Role Room
            </Button>

            <Box
              component="img"
              src={ROLE_ROOM_BRAND_ASSETS.wordmark}
              alt="The Role Room"
              sx={{
                width: { xs: 180, sm: 220, md: 250 },
                height: 'auto',
                alignSelf: { xs: 'flex-start', md: 'center' },
              }}
            />
          </Stack>

          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={{ xs: 3, md: 4 }}
            sx={{ alignItems: { lg: 'flex-end' } }}
          >
            <Stack spacing={2} sx={{ flex: 1.15, maxWidth: 760 }}>
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'rgba(246,195,88,0.92)',
                  fontWeight: 700,
                }}
              >
                For utdanningsinstitusjoner
              </Typography>
              <Typography
                variant="h1"
                sx={{
                  fontFamily: '"Georgia", "Times New Roman", serif',
                  fontSize: { xs: '2.35rem', sm: '3.1rem', md: '4.7rem' },
                  lineHeight: { xs: 1.03, md: 0.96 },
                  letterSpacing: '-0.05em',
                  maxWidth: 820,
                }}
              >
                Gi studentene samme produksjonsrom som de skal jobbe i etter studiet.
              </Typography>
              <Typography
                sx={{
                  maxWidth: 620,
                  fontSize: { xs: '0.98rem', md: '1.1rem' },
                  lineHeight: 1.7,
                  color: 'rgba(244,240,232,0.74)',
                }}
              >
                The Role Room gjør undervisning, studentproduksjoner og samarbeid med eksterne oppdragsgivere
                langt mer praksisnært. Lærere, kull, prosjektledere og gjesteforelesere jobber i samme struktur
                som et profesjonelt produksjonsteam.
              </Typography>
            </Stack>

            <Box
              sx={{
                width: { xs: '100%', lg: 360 },
                p: { xs: 2.25, md: 2.5 },
                borderRadius: '28px',
                bgcolor: 'rgba(11,13,21,0.8)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.24)',
              }}
            >
              <Stack spacing={1.25}>
                <Typography
                  sx={{
                    fontSize: '0.74rem',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    color: 'rgba(246,195,88,0.88)',
                  }}
                >
                  Relevans for institusjonen
                </Typography>
                {[
                  'Studentene får en tydelig produksjonsflyt, ikke bare løse filer og spredte verktøy.',
                  'Faglærere kan følge progresjon, leveranser, roller og samarbeid i én flate.',
                  'Institusjonen kan koble skoleprosjekter tettere til bransjen og reelle produksjoner.',
                ].map((item) => (
                  <Typography
                    key={item}
                    sx={{
                      fontSize: '0.92rem',
                      lineHeight: 1.65,
                      color: 'rgba(244,240,232,0.78)',
                    }}
                  >
                    {item}
                  </Typography>
                ))}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ pt: 1 }}>
                  <Button
                    type="button"
                    onClick={() => setLoginDialogOpen(true)}
                    endIcon={<ArrowForwardRounded />}
                    sx={{
                      flex: 1,
                      minHeight: 46,
                      textTransform: 'none',
                      borderRadius: '999px',
                      fontWeight: 700,
                      color: '#0d1018',
                      bgcolor: '#f6c358',
                      '&:hover': {
                        bgcolor: '#ffd787',
                      },
                    }}
                  >
                    Be om institusjonssamtale
                  </Button>
                  <Button
                    component="a"
                    href="#samarbeidsflyt"
                    sx={{
                      flex: 1,
                      minHeight: 46,
                      textTransform: 'none',
                      borderRadius: '999px',
                      fontWeight: 600,
                      color: 'rgba(248,245,239,0.92)',
                      bgcolor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.1)',
                      },
                    }}
                  >
                    Se samarbeidsflyten
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            {[
              {
                icon: <SchoolRounded sx={{ fontSize: 30 }} />,
                title: 'Undervisning som ligner virkeligheten',
                body: 'Lærere kan strukturere oppgaver, manus, crew, godkjenninger og produksjonsdager i samme system som studentene bruker.',
              },
              {
                icon: <Groups2Rounded sx={{ fontSize: 30 }} />,
                title: 'Kull, faglærere og prosjektledelse samlet',
                body: 'Hver produksjon kan eies av kull, emner eller prosjektgrupper, mens institusjonen beholder oversikt og kontroll.',
              },
              {
                icon: <BusinessCenterRounded sx={{ fontSize: 30 }} />,
                title: 'Tettere kobling til bransjen',
                body: 'Eksterne samarbeidspartnere og klienter kan følge prosjekter, gi feedback og jobbe med studentene i en tydelig produksjonsflyt.',
              },
            ].map((item) => (
              <Box
                key={item.title}
                sx={{
                  p: { xs: 2, md: 2.4 },
                  borderRadius: '24px',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                <Box sx={{ color: '#f6c358', mb: 1.1 }}>{item.icon}</Box>
                <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, mb: 0.8 }}>
                  {item.title}
                </Typography>
                <Typography sx={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'rgba(244,240,232,0.72)' }}>
                  {item.body}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box
            id="samarbeidsflyt"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1.1fr 0.9fr' },
              gap: 2,
              alignItems: 'stretch',
            }}
          >
            <Box
              sx={{
                p: { xs: 2.2, md: 3 },
                borderRadius: '28px',
                bgcolor: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.76rem',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'rgba(246,195,88,0.88)',
                  mb: 1.4,
                }}
              >
                Slik kan et oppsett se ut
              </Typography>
              <Stack spacing={1.4}>
                {[
                  {
                    step: '1',
                    title: 'Institusjonen verifiseres og programmet defineres',
                    body: 'Bruk organisasjonsnummer, studieprogram og kullstørrelse for å sette et tydelig oppsett før første student inviteres inn.',
                  },
                  {
                    step: '2',
                    title: 'Lærere og koordinatorer får egne arbeidsflater',
                    body: 'Programansvarlige, faglærere og prosjektledere kan følge fremdrift, produksjonsplan og leveranser uten å miste overblikk.',
                  },
                  {
                    step: '3',
                    title: 'Studentene jobber i faktiske produksjonsroller',
                    body: 'De lærer samarbeid, ansvar, leveranseflyt og rollefordeling i et system som ligner det de møter i profesjonelle team.',
                  },
                ].map((item) => (
                  <Box key={item.step} sx={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 1.2 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '999px',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'rgba(246,195,88,0.12)',
                        border: '1px solid rgba(246,195,88,0.32)',
                        color: '#f6c358',
                        fontWeight: 800,
                      }}
                    >
                      {item.step}
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 700, mb: 0.4 }}>
                        {item.title}
                      </Typography>
                      <Typography sx={{ fontSize: '0.94rem', lineHeight: 1.7, color: 'rgba(244,240,232,0.7)' }}>
                        {item.body}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box
              sx={{
                p: { xs: 2.2, md: 3 },
                borderRadius: '28px',
                bgcolor: 'rgba(17,12,26,0.82)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.4,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.76rem',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'rgba(246,195,88,0.88)',
                }}
              >
                Hva dere kan bruke det til
              </Typography>
              {[
                {
                  icon: <VideocamRounded sx={{ fontSize: 24 }} />,
                  title: 'Studentproduksjoner',
                  body: 'Kortfilm, flerkamera, dokumentar, reklame, fotooppdrag og eksamensprosjekter.',
                },
                {
                  icon: <ChecklistRounded sx={{ fontSize: 24 }} />,
                  title: 'Felles produksjonsstandard',
                  body: 'Én struktur for planlegging, roller, leveranser, feedback og godkjenninger på tvers av kull.',
                },
                {
                  icon: <AutoStoriesRounded sx={{ fontSize: 24 }} />,
                  title: 'Praksisnær læring',
                  body: 'Studentene trener på faktiske arbeidsmåter, ikke bare på separate fagverktøy uten sammenheng.',
                },
              ].map((item) => (
                <Box
                  key={item.title}
                  sx={{
                    p: 1.4,
                    borderRadius: '20px',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 0.75 }}>
                    <Box sx={{ color: '#f6c358' }}>{item.icon}</Box>
                    <Typography sx={{ fontSize: '0.98rem', fontWeight: 700 }}>
                      {item.title}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'rgba(244,240,232,0.7)' }}>
                    {item.body}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box
            sx={{
              p: { xs: 2.2, md: 3 },
              borderRadius: '30px',
              bgcolor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              textAlign: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.76rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'rgba(246,195,88,0.88)',
                mb: 1,
              }}
            >
              Klar for å se et oppsett?
            </Typography>
            <Typography
              sx={{
                maxWidth: 760,
                mx: 'auto',
                mb: 2,
                fontSize: { xs: '1rem', md: '1.14rem' },
                lineHeight: 1.75,
                color: 'rgba(244,240,232,0.78)',
              }}
            >
              The Role Room kan gi utdanningsinstitusjoner en strukturert vei fra undervisning til gjennomføring,
              med bedre oversikt, bedre samarbeid og et tydeligere bindeledd mellom skole og bransje.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} justifyContent="center">
              <Button
                type="button"
                onClick={() => setLoginDialogOpen(true)}
                endIcon={<ArrowForwardRounded />}
                sx={{
                  minHeight: 48,
                  textTransform: 'none',
                  borderRadius: '999px',
                  fontWeight: 700,
                  px: 2.6,
                  color: '#0d1018',
                  bgcolor: '#f6c358',
                  '&:hover': {
                    bgcolor: '#ffd787',
                  },
                }}
              >
                Be om institusjonssamtale
              </Button>
              <Button
                component="a"
                href="#samarbeidsflyt"
                sx={{
                  minHeight: 48,
                  textTransform: 'none',
                  borderRadius: '999px',
                  fontWeight: 600,
                  px: 2.4,
                  color: 'rgba(248,245,239,0.92)',
                  bgcolor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                Se samarbeidsflyt
              </Button>
            </Stack>
            <Box
              sx={{
                mt: 2.4,
                pt: 2.2,
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <PublicSocialLinks
                label="Sosiale medier"
                body="Følg The Role Room for case, verktøydrops og oppdateringer fra produksjonsmiljøet."
                links={roleRoomSocialLinks}
                tone="roleRoom"
              />
            </Box>
          </Box>
        </Stack>
      </Container>

      <LoginDialog
        open={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onLoginSuccess={() => setLoginDialogOpen(false)}
        isLandingPage={true}
        initialPersona="education_institution"
      />
    </Box>
  );
}
