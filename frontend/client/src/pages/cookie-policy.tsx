import React from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  Cookie,
  ContactMail,
  Gavel,
  Info,
  Security,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import PublicSocialLinks from '@/components/common/PublicSocialLinks';
import RoleRoomBrandMark from '@/components/role-room/components/shared/RoleRoomBrandMark';
import {
  getPublicSocialProfiles,
  PUBLIC_BRAND_LINKS,
  resolvePublicBrandFromWindow,
} from '@/lib/publicBrandLinks';
import { useTheming } from '../utils/theming-helper';
import BlockRenderer from '../components/role-room/cms/BlockRenderer';
import { useCmsBlocks } from '../components/role-room/cms/useCmsBlocks';
import { DEFAULT_LOCALE } from '../components/role-room/cms/blockSchema';

type CookieBrand = {
  appName: string;
  subtitle: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  pageBg: string;
  iconGradient: string;
  website: string;
  supportEmail: string;
  socialLabel: string;
  domain: string;
};

function getCookieBrand(): CookieBrand {
  const brandKey = resolvePublicBrandFromWindow();

  if (brandKey === 'roleRoom') {
    return {
      appName: 'The Role Room',
      subtitle: 'Cookie- og sporingspraksis for produksjonsplattformen The Role Room',
      accent: '#22d3ee',
      accentSoft: 'rgba(8, 145, 178, 0.12)',
      accentBorder: 'rgba(34, 211, 238, 0.28)',
      pageBg:
        'radial-gradient(circle at top left, rgba(34,211,238,0.18) 0%, transparent 38%), radial-gradient(circle at top right, rgba(124,58,237,0.14) 0%, transparent 34%), linear-gradient(180deg, #07111b 0%, #0b1220 45%, #111827 100%)',
      iconGradient: 'linear-gradient(135deg, #22d3ee 0%, #7c3aed 100%)',
      website: PUBLIC_BRAND_LINKS.roleRoom.website,
      supportEmail: PUBLIC_BRAND_LINKS.roleRoom.email,
      socialLabel: 'Følg The Role Room',
      domain: 'theroleroom.com',
    };
  }

  return {
    appName: 'CreatorHub Norge',
    subtitle: 'Cookie- og sporingspraksis for CreatorHub-plattformen',
    accent: '#ff8c00',
    accentSoft: 'rgba(255, 140, 0, 0.10)',
    accentBorder: 'rgba(255, 140, 0, 0.22)',
    pageBg:
      'linear-gradient(135deg, #fff5e6 0%, #ffedd5 25%, #fed7aa 50%, #fdba74 75%, #f59e0b 100%), radial-gradient(circle at 20% 80%, rgba(255,140,0,0.3) 0%, transparent 50%)',
    iconGradient: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)',
    website: PUBLIC_BRAND_LINKS.creatorhub.website,
    supportEmail: PUBLIC_BRAND_LINKS.creatorhub.email,
    socialLabel: 'Følg CreatorHub',
    domain: 'creatorhubn.com',
  };
}

const COOKIE_CATEGORIES = [
  {
    title: 'Nødvendige cookies',
    detail: 'Kreves for innlogging, sikkerhet (CSRF-beskyttelse, økt-håndtering) og grunnleggende funksjonalitet. Kan ikke slås av — tjenesten fungerer ikke uten disse.',
  },
  {
    title: 'Funksjonelle cookies',
    detail: 'Husker språkvalg, visningsinnstillinger og annet du selv har konfigurert, slik at du slipper å sette dette på nytt hver gang.',
  },
  {
    title: 'Analyse-cookies',
    detail: 'Måler bruksmønster (sidevisninger, klikk, konverteringer) slik at vi kan forbedre produktet. Settes kun etter samtykke der dette kreves.',
  },
  {
    title: 'Markedsførings- og annonse-cookies',
    detail: 'Meta Pixel, Google Tag og LinkedIn Insight Tag måler effekten av annonsene vi kjører, og kan bygge remarketing-publikum (hashet e-post ved konvertering — aldri passord eller prosjektinnhold). Settes kun etter samtykke.',
  },
];

const CookiePolicy: React.FC = () => {
  const cmsBlocks = useCmsBlocks('cookie-policy');
  const [, setLocation] = useLocation();
  const theming = useTheming('photographer');
  const brandKey = resolvePublicBrandFromWindow();
  const brand = getCookieBrand();
  const socialLinks = getPublicSocialProfiles(brandKey);

  const isRoleRoom = brandKey === 'roleRoom';
  const surfaceSx = {
    p: 4,
    borderRadius: '18px',
    background: isRoleRoom ? 'rgba(8, 15, 28, 0.84)' : 'rgba(255,255,255,0.94)',
    color: isRoleRoom ? '#f8fafc' : '#111827',
    border: `1px solid ${brand.accentBorder}`,
    boxShadow: isRoleRoom ? '0 28px 80px rgba(4, 10, 24, 0.44)' : undefined,
    backdropFilter: 'blur(20px)',
    ...theming.getThemedCardSx(),
  } as const;
  const bodyColor = isRoleRoom ? 'rgba(226,232,240,0.9)' : '#374151';
  const mutedColor = isRoleRoom ? 'rgba(148,163,184,0.86)' : '#6b7280';
  const panelSx = {
    p: 3,
    backgroundColor: isRoleRoom ? 'rgba(15, 23, 42, 0.72)' : brand.accentSoft,
    border: `1px solid ${brand.accentBorder}`,
    borderRadius: '14px',
  } as const;

  if (cmsBlocks) {
    return <BlockRenderer blocks={cmsBlocks} locale={DEFAULT_LOCALE} />;
  }

  return (
    <Box sx={{ minHeight: '100vh', background: brand.pageBg, py: 6 }}>
      <Container maxWidth="lg">
        <Paper elevation={3} sx={{ ...surfaceSx, mb: 4, overflow: 'hidden', p: 0 }}>
          <Box
            sx={{
              position: 'relative',
              px: { xs: 2.5, md: 4 },
              py: { xs: 3, md: 4 },
              background: isRoleRoom
                ? 'linear-gradient(135deg, rgba(8,15,28,0.96) 0%, rgba(9,22,38,0.94) 52%, rgba(22,28,51,0.92) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.74) 0%, rgba(255,247,237,0.94) 48%, rgba(255,237,213,0.92) 100%)',
            }}
          >
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'flex-start' }} spacing={3}>
              <Stack spacing={2} sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  {isRoleRoom ? (
                    <RoleRoomBrandMark appearance="header" showLabel={false} sx={{ width: { xs: 124, md: 152 }, flexShrink: 0 }} />
                  ) : (
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '14px',
                        background: brand.iconGradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Cookie sx={{ fontSize: 32, color: 'white' }} />
                    </Box>
                  )}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        color: isRoleRoom ? 'rgba(148,163,184,0.92)' : '#9a3412',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Juridisk informasjon
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: isRoleRoom ? '#f8fafc' : '#1f2937' }}>
                      {brand.appName} · Cookie-erklæring
                    </Typography>
                    <Typography variant="body1" sx={{ color: mutedColor, mt: 1 }}>
                      {brand.subtitle} · Sist oppdatert: 6. april 2026
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1.2} flexWrap="wrap">
                  <Chip icon={<Security />} label="GDPR / ePrivacy" variant="outlined" sx={{ borderColor: brand.accentBorder, color: isRoleRoom ? '#f8fafc' : undefined }} />
                  <Chip icon={<Gavel />} label="Norsk lovgivning" variant="outlined" sx={{ borderColor: brand.accentBorder, color: isRoleRoom ? '#f8fafc' : undefined }} />
                  <Chip icon={<Info />} label={brand.domain} variant="outlined" sx={{ borderColor: brand.accentBorder, color: isRoleRoom ? '#f8fafc' : undefined }} />
                </Stack>
              </Stack>

              <Paper
                sx={{
                  minWidth: { xs: '100%', lg: 300 },
                  maxWidth: 360,
                  p: 2.2,
                  borderRadius: '16px',
                  bgcolor: isRoleRoom ? 'rgba(8,15,28,0.72)' : 'rgba(255,255,255,0.72)',
                  border: `1px solid ${brand.accentBorder}`,
                  boxShadow: isRoleRoom ? '0 18px 44px rgba(2,8,23,0.36)' : '0 18px 44px rgba(217,119,6,0.12)',
                  backdropFilter: 'blur(18px)',
                }}
              >
                <Typography sx={{ color: brand.accent, fontWeight: 800, mb: 1.2 }}>
                  Hurtigvalg
                </Typography>
                <Typography variant="body2" sx={{ color: bodyColor, lineHeight: 1.7, mb: 2 }}>
                  Endre cookie-valgene dine, les personvernerklæringen, eller be om sletting av data.
                </Typography>
                <Stack spacing={1.1}>
                  <Button variant="outlined" onClick={() => setLocation('/')}>
                    Tilbake til forsiden
                  </Button>
                  <Button variant="text" href="/privacy-policy" sx={{ color: brand.accent }}>
                    Les personvernerklæringen
                  </Button>
                  <Button variant="text" href="/data-deletion" sx={{ color: brand.accent }}>
                    Be om sletting av data
                  </Button>
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Paper>

        <Paper elevation={3} sx={surfaceSx}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              1. Hva er cookies?
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8 }}>
              Cookies (informasjonskapsler) er små tekstfiler som lagres i nettleseren din når du besøker {brand.domain}. De brukes til å huske innstillinger, holde deg innlogget og forstå hvordan tjenesten brukes.
            </Typography>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              2. Kategorier av cookies vi bruker
            </Typography>
            <List>
              {COOKIE_CATEGORIES.map((item) => (
                <ListItem key={item.title} disableGutters sx={{ alignItems: 'flex-start', py: 1.1 }}>
                  <Cookie sx={{ color: brand.accent, mr: 2, mt: 0.3 }} />
                  <ListItemText primary={item.title} secondary={item.detail} />
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              3. Hvordan endre eller trekke tilbake samtykke
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Første gang du besøker {brand.domain} vises et samtykkebanner der du kan velge hvilke kategorier du godtar. Du kan når som helst endre valget ditt via knappen <strong>«Administrer cookies»</strong> nederst til venstre på siden.
            </Typography>
            <Paper sx={panelSx}>
              <Typography variant="body2" sx={{ color: bodyColor }}>
                Du kan også blokkere cookies helt i nettleserinnstillingene dine, eller bruke «Do Not Track» / Global Privacy Control — vi respekterer slike signaler for analyse- og markedsføringscookies.
              </Typography>
            </Paper>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              4. Tredjeparts cookies
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Når du samtykker til markedsførings-cookies kan følgende tredjeparter sette cookies i nettleseren din:
            </Typography>
            <List>
              <ListItem disableGutters><ListItemText primary="Meta (Facebook/Instagram) Pixel" secondary="Måler annonseeffekt og bygger remarketing-publikum." /></ListItem>
              <ListItem disableGutters><ListItemText primary="Google Tag" secondary="Måler annonseeffekt og trafikk fra Google-kampanjer." /></ListItem>
              <ListItem disableGutters><ListItemText primary="LinkedIn Insight Tag" secondary="Måler annonseeffekt for B2B-kampanjer på LinkedIn." /></ListItem>
            </List>
            <Typography variant="body2" sx={{ color: mutedColor, mt: 2 }}>
              Se vår <a href="/privacy-policy" style={{ color: brand.accent }}>personvernerklæring</a> for full oversikt over databehandlere og rettslig grunnlag.
            </Typography>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Paper
            sx={{
              p: 3,
              backgroundColor: isRoleRoom ? 'rgba(8, 15, 28, 0.9)' : brand.accentSoft,
              border: `2px solid ${brand.accent}`,
              borderRadius: '14px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <ContactMail sx={{ fontSize: 32, color: brand.accent, mr: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: isRoleRoom ? '#f8fafc' : '#1f2937' }}>
                Spørsmål om cookies?
              </Typography>
            </Box>
            <PublicSocialLinks
              label={brand.socialLabel}
              body={
                isRoleRoom
                  ? 'Følg The Role Room for oppdateringer om produksjonsverktøy, funksjoner og policy-endringer.'
                  : 'Følg CreatorHub for produktoppdateringer, abonnement og plattforminformasjon.'
              }
              links={socialLinks}
              tone="legal"
              sx={{ mb: 2.2 }}
              showTopDivider
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="contained"
                startIcon={<ContactMail />}
                href={`mailto:${brand.supportEmail}`}
                sx={{ ...theming.getThemedButtonSx(), background: brand.iconGradient }}
              >
                Send e-post
              </Button>
              <Button variant="outlined" onClick={() => setLocation('/')}>
                Tilbake til forsiden
              </Button>
              <Button variant="text" href="/privacy-policy" sx={{ color: brand.accent }}>
                Les personvernerklæringen
              </Button>
            </Stack>
          </Paper>
        </Paper>
      </Container>
    </Box>
  );
};

export default CookiePolicy;
