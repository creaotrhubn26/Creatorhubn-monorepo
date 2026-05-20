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
  CheckCircle,
  ContactMail,
  Gavel,
  Info,
  Policy,
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

type LegalBrand = {
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
  summary: string;
  categories: Array<{ title: string; detail: string }>;
  purposes: Array<{ title: string; detail: string }>;
};

function getPrivacyBrand(): LegalBrand {
  const brandKey = resolvePublicBrandFromWindow();

  if (brandKey === 'roleRoom') {
    return {
      appName: 'The Role Room',
      subtitle: 'Personvernerklæring for produksjonsplattformen The Role Room',
      accent: '#22d3ee',
      accentSoft: 'rgba(8, 145, 178, 0.12)',
      accentBorder: 'rgba(34, 211, 238, 0.28)',
      pageBg:
        'radial-gradient(circle at top left, rgba(34,211,238,0.18) 0%, transparent 38%), radial-gradient(circle at top right, rgba(124,58,237,0.14) 0%, transparent 34%), linear-gradient(180deg, #07111b 0%, #0b1220 45%, #111827 100%)',
      iconGradient: 'linear-gradient(135deg, #22d3ee 0%, #7c3aed 100%)',
      website: PUBLIC_BRAND_LINKS.roleRoom.website,
      supportEmail: PUBLIC_BRAND_LINKS.roleRoom.email,
      socialLabel: 'Følg The Role Room',
      summary:
        'The Role Room er produksjonsflaten for casting, team, manus, planlegging og gjennomføring. Creatorhub AS er behandlingsansvarlig for personopplysninger som behandles i løsningen.',
      categories: [
        {
          title: 'Konto- og kontaktinformasjon',
          detail: 'Navn, e-postadresse, telefonnummer, rolle, virksomhet og annen kontoinformasjon du registrerer.',
        },
        {
          title: 'Prosjekt- og produksjonsdata',
          detail: 'Prosjektnavn, castingdata, team, manus, storyboards, lokasjoner, utstyr, call sheets, avtaler og annet produksjonsgrunnlag.',
        },
        {
          title: 'Integrasjonsdata',
          detail: 'Data fra Google Workspace, Google Places og andre tjenester du selv kobler til for dokumenter, kalender, reviews eller bedriftsinformasjon.',
        },
        {
          title: 'AI- og arbeidsflytdata',
          detail: 'Brief, manus, story logikk, kundeprofil og annet innhold som brukes for å generere forslag og anbefalinger i The Role Room Agent.',
        },
        {
          title: 'Teknisk og sikkerhetsrelatert informasjon',
          detail: 'IP-adresse, nettleser, enhet, påloggingslogger, samtykker og sikkerhetshendelser.',
        },
      ],
      purposes: [
        {
          title: 'Levere og drifte tjenesten',
          detail: 'For å opprette kontoer, lagre prosjekter, koordinere team og levere funksjonalitet i plattformen. Rettslig grunnlag: GDPR art. 6.1.b.',
        },
        {
          title: 'Samarbeid og integrasjoner',
          detail: 'For å koble til Google Workspace, hente bedriftsdata, synkronisere kalender og behandle innhold du eksplisitt ber oss bruke. Rettslig grunnlag: GDPR art. 6.1.b / 6.1.a.',
        },
        {
          title: 'AI-forslag og automatisering',
          detail: 'For å generere forslag til brief, story logikk, manus, tidslinje og andre arbeidsutkast. Rettslig grunnlag: GDPR art. 6.1.b og eventuelt samtykke når dette kreves.',
        },
        {
          title: 'Sikkerhet og misbruksforebygging',
          detail: 'For å beskytte kontoer, oppdage misbruk og dokumentere hendelser. Rettslig grunnlag: GDPR art. 6.1.f.',
        },
        {
          title: 'Lovpålagte plikter',
          detail: 'For å oppfylle bokføringskrav, sikkerhetskrav og andre rettslige forpliktelser. Rettslig grunnlag: GDPR art. 6.1.c.',
        },
      ],
    };
  }

  return {
    appName: 'CreatorHub Norge',
    subtitle: 'Personvernerklæring for CreatorHub-plattformen',
    accent: '#ff8c00',
    accentSoft: 'rgba(255, 140, 0, 0.10)',
    accentBorder: 'rgba(255, 140, 0, 0.22)',
    pageBg:
      'linear-gradient(135deg, #fff5e6 0%, #ffedd5 25%, #fed7aa 50%, #fdba74 75%, #f59e0b 100%), radial-gradient(circle at 20% 80%, rgba(255,140,0,0.3) 0%, transparent 50%)',
    iconGradient: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)',
    website: PUBLIC_BRAND_LINKS.creatorhub.website,
    supportEmail: PUBLIC_BRAND_LINKS.creatorhub.email,
    socialLabel: 'Følg CreatorHub',
    summary:
      'CreatorHub samler prosjektstyring, kundeopplevelse, abonnementsflyt, ResumeBuilder, Academy og community i én plattform. Creatorhub AS er behandlingsansvarlig for personopplysninger som behandles i løsningen, i samsvar med GDPR (forordning (EU) 2016/679), personopplysningsloven, Datatilsynets veileder for AI og Forbrukertilsynets retningslinjer for AI i forbrukertjenester.',
    categories: [
      {
        title: 'Konto- og kontaktinformasjon',
        detail: 'Navn, e-postadresse, telefonnummer, profesjon, virksomhet og annen informasjon du registrerer i plattformen.',
      },
      {
        title: 'Abonnements- og bedriftsinformasjon',
        detail: 'Firmanavn, organisasjonsnummer, fakturadetaljer, kjøpshistorikk og informasjon om planene du bruker.',
      },
      {
        title: 'Prosjekt- og samarbeidsdata',
        detail: 'Prosjekter, filer, oppgaver, klientinformasjon, meldinger, læringsdata og community-aktivitet du velger å lagre i plattformen.',
      },
      {
        title: 'CV- og jobbsøkingsdata (ResumeBuilder)',
        detail: 'Arbeidserfaring, utdanning, ferdigheter, språk, sertifiseringer, profilbilde, importerte CV-er (PDF/DOCX), AI-genererte sammendrag og søknadsbrev, samt jobbsøknader du sporer.',
      },
      {
        title: 'Integrasjons- og AI-data',
        detail: 'Data fra Google Workspace, LinkedIn, Vitnemålsportalen, betalingssystemer og — ved bruk av AI-funksjoner — innhold sendt til Anthropic Claude (se egen seksjon under «AI-funksjoner»).',
      },
      {
        title: 'Teknisk og sikkerhetsrelatert informasjon',
        detail: 'IP-adresse, nettleser, enhet, påloggingslogger, samtykker og sikkerhetshendelser.',
      },
    ],
    purposes: [
      {
        title: 'Levere og drifte tjenesten',
        detail: 'For å opprette kontoer, administrere abonnement, lagre prosjekter og levere plattformfunksjonalitet. Rettslig grunnlag: GDPR art. 6.1.b.',
      },
      {
        title: 'Betaling, kundedialog og support',
        detail: 'For å gjennomføre kjøp, sende kvitteringer, gi support og håndtere kundeforhold. Rettslig grunnlag: GDPR art. 6.1.b.',
      },
      {
        title: 'AI-funksjoner (Anthropic Claude som databehandler)',
        detail: 'Når du aktivt bruker AI-funksjoner i ResumeBuilder eller andre moduler (CV-import, ATS-analyse, sammendrag, søknadsbrev, oversettelse, intervjuforberedelse osv.), sendes det relevante innholdet til Anthropic PBC (USA) for behandling. Anthropic er databehandler etter art. 28, data overføres med Standardklausuler (SCC) og lagres maksimalt 30 dager hos Anthropic uten å brukes til modelltrening. Rettslig grunnlag: GDPR art. 6.1.a (samtykke ved klikk) eller 6.1.b. Du kan til enhver tid la være å bruke AI-funksjonene.',
      },
      {
        title: 'Automatiserte beslutninger og din rett til å protestere',
        detail: 'AI-genererte ATS-scorer, sammendrag, søknadsbrev og andre forslag er kun forslag — du tar selv den endelige beslutningen. Vi tar ikke automatiserte avgjørelser med rettslig virkning eller tilsvarende vesentlig påvirkning (GDPR art. 22). Du kan klage til Datatilsynet (datatilsynet.no) eller Forbrukertilsynet (forbrukertilsynet.no).',
      },
      {
        title: 'Integrasjoner du selv aktiverer',
        detail: 'For å koble til tjenester du selv aktiverer (Google, LinkedIn, Vitnemålsportalen) og generere utkast eller anbefalinger. Rettslig grunnlag: GDPR art. 6.1.b / 6.1.a.',
      },
      {
        title: 'Sikkerhet og misbruksforebygging',
        detail: 'For å beskytte kontoer, oppdage misbruk og dokumentere hendelser. Rettslig grunnlag: GDPR art. 6.1.f.',
      },
      {
        title: 'Lovpålagte plikter',
        detail: 'For å oppfylle bokføringskrav, sikkerhetskrav og andre rettslige forpliktelser. Rettslig grunnlag: GDPR art. 6.1.c.',
      },
    ],
  };
}

const PrivacyPolicy: React.FC = () => {
  const [, setLocation] = useLocation();
  const theming = useTheming('photographer');
  const brandKey = resolvePublicBrandFromWindow();
  const brand = getPrivacyBrand();
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

  return (
    <Box sx={{ minHeight: '100vh', background: brand.pageBg, py: 6 }}>
      <Container maxWidth="lg">
        <Paper
          elevation={3}
          sx={{
            ...surfaceSx,
            mb: 4,
            overflow: 'hidden',
            p: 0,
          }}
        >
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
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: isRoleRoom
                  ? 'radial-gradient(circle at 12% 18%, rgba(34,211,238,0.18) 0%, transparent 28%), radial-gradient(circle at 82% 22%, rgba(168,85,247,0.16) 0%, transparent 26%)'
                  : 'radial-gradient(circle at 12% 18%, rgba(255,140,0,0.14) 0%, transparent 28%), radial-gradient(circle at 82% 22%, rgba(251,191,36,0.12) 0%, transparent 26%)',
              }}
            />
            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              justifyContent="space-between"
              alignItems={{ lg: 'flex-start' }}
              spacing={3}
              sx={{ position: 'relative' }}
            >
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
                      <Policy sx={{ fontSize: 32, color: 'white' }} />
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
                    <Typography variant="h3" sx={{ fontWeight: 800, color: isRoleRoom ? '#f8fafc' : '#1f2937', ...theming.colors }}>
                      {brand.appName} · Personvernerklæring
                    </Typography>
                    <Typography variant="body1" sx={{ color: mutedColor, mt: 1 }}>
                      {brand.subtitle} · Sist oppdatert: 6. april 2026
                    </Typography>
                  </Box>
                </Stack>

                <Typography
                  variant="body1"
                  sx={{
                    maxWidth: 780,
                    color: bodyColor,
                    lineHeight: 1.8,
                    fontSize: { xs: '0.95rem', md: '1rem' },
                  }}
                >
                  {brand.summary}
                </Typography>

                <Stack direction="row" spacing={1.2} flexWrap="wrap">
                  <Chip icon={<Security />} label="GDPR" variant="outlined" sx={{ borderColor: brand.accentBorder, color: isRoleRoom ? '#f8fafc' : undefined }} />
                  <Chip icon={<Gavel />} label="Norsk lovgivning" variant="outlined" sx={{ borderColor: brand.accentBorder, color: isRoleRoom ? '#f8fafc' : undefined }} />
                  <Chip icon={<Info />} label="Oppdatert for Google og AI-integrasjoner" variant="outlined" sx={{ borderColor: brand.accentBorder, color: isRoleRoom ? '#f8fafc' : undefined }} />
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
                  Gå tilbake til forsiden, kontakt support eller hopp direkte til vilkårene.
                </Typography>
                <Stack spacing={1.1}>
                  <Button variant="contained" href={`mailto:${brand.supportEmail}`} startIcon={<ContactMail />} sx={{ ...theming.getThemedButtonSx(), background: brand.iconGradient }}>
                    Kontakt support
                  </Button>
                  <Button variant="outlined" onClick={() => setLocation('/')}>
                    Tilbake til forsiden
                  </Button>
                  <Button variant="text" href="/terms-and-conditions" sx={{ color: brand.accent }}>
                    Les vilkår og betingelser
                  </Button>
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Paper>

        <Paper elevation={3} sx={surfaceSx}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              1. Behandlingsansvarlig
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Behandlingsansvarlig for personopplysninger som behandles i {brand.appName} er Creatorhub AS.
            </Typography>
            <Paper sx={panelSx}>
              <Typography variant="body1" sx={{ fontWeight: 700, mb: 1 }}>
                Creatorhub AS
              </Typography>
              <Typography variant="body2" sx={{ color: bodyColor }}>Tjeneste: {brand.appName}</Typography>
              <Typography variant="body2" sx={{ color: bodyColor }}>Nettside: {brand.website}</Typography>
              <Typography variant="body2" sx={{ color: bodyColor }}>E-post: {brand.supportEmail}</Typography>
              <Typography variant="body2" sx={{ color: bodyColor, mt: 1.5 }}>
                {brand.summary}
              </Typography>
            </Paper>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              2. Hvilke opplysninger vi behandler
            </Typography>
            <List>
              {brand.categories.map((item) => (
                <ListItem key={item.title} disableGutters sx={{ alignItems: 'flex-start', py: 1.1 }}>
                  <CheckCircle sx={{ color: brand.accent, mr: 2, mt: 0.3 }} />
                  <ListItemText primary={item.title} secondary={item.detail} />
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              3. Hvorfor vi behandler opplysningene
            </Typography>
            <List>
              {brand.purposes.map((item) => (
                <ListItem key={item.title} disableGutters sx={{ alignItems: 'flex-start', py: 1.1 }}>
                  <ListItemText primary={item.title} secondary={item.detail} />
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              4. Deling med tredjepart og databehandlere
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Vi deler ikke personopplysninger med tredjeparter for deres egne markedsføringsformål. Vi bruker databehandlere og underleverandører der dette er nødvendig for å levere tjenesten.
            </Typography>
            <List>
              <ListItem disableGutters><ListItemText primary="Teknisk drift og lagring" secondary="Hosting, database, logging, sikkerhet, backup og overvåking." /></ListItem>
              <ListItem disableGutters><ListItemText primary="Betalings- og fakturaleverandører" secondary="Stripe og tilknyttede betalingstjenester når du gjennomfører kjøp eller mottar faktura/kvittering." /></ListItem>
              <ListItem disableGutters><ListItemText primary="Google-tjenester" secondary="Google Workspace og Google Places når du eller en administrator kobler til slike tjenester for dokumenter, kalender, bedriftsdata eller reviews." /></ListItem>
              <ListItem disableGutters><ListItemText primary="AI- og søketjenester" secondary="OpenAI, Cohere og tilsvarende leverandører når du bruker funksjoner som genererer forslag, oppsummeringer eller bedriftsanalyse." /></ListItem>
              <ListItem disableGutters><ListItemText primary="Offentlige myndigheter" secondary="Når dette er lovpålagt eller nødvendig for å forsvare rettskrav." /></ListItem>
            </List>
            <Paper sx={{ ...panelSx, mt: 2 }}>
              <Typography variant="body2" sx={{ color: bodyColor }}>
                Dersom personopplysninger behandles utenfor EU/EØS, skjer dette bare med gyldig overføringsgrunnlag, som EU Standard Contractual Clauses eller tilsvarende mekanismer.
              </Typography>
            </Paper>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              5. Informasjonssikkerhet og lagringstid
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Vi bruker tilgangsstyring, kryptert kommunikasjon, logging, sikkerhetsoppdateringer og andre organisatoriske og tekniske tiltak for å beskytte dataene dine.
            </Typography>
            <List>
              <ListItem disableGutters><ListItemText primary="Aktive kontoer" secondary="Data lagres så lenge kontoen eller prosjektet er aktivt og det er nødvendig for å levere tjenesten." /></ListItem>
              <ListItem disableGutters><ListItemText primary="Kjøps- og regnskapsdata" secondary="Lagringsplikt følger bokføringsloven og tilhørende regelverk." /></ListItem>
              <ListItem disableGutters><ListItemText primary="Sikkerhetslogger" secondary="Oppbevares så lenge det er nødvendig for sikkerhet, feilsøking og dokumentasjon." /></ListItem>
              <ListItem disableGutters><ListItemText primary="AI-utkast og integrasjonsdata" secondary="Lagres som del av arbeidsflyten eller fjernes når de ikke lenger trengs, avhengig av prosjektets innstillinger og tjenestens funksjon." /></ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              6. Dine rettigheter
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Du har rett til innsyn, retting, sletting, begrensning, dataportabilitet, å protestere mot behandling og å trekke tilbake samtykke der samtykke er brukt som grunnlag.
            </Typography>
            <Paper sx={panelSx}>
              <Typography variant="body1" sx={{ fontWeight: 700, color: brand.accent, mb: 1 }}>
                Utøv dine rettigheter
              </Typography>
              <Typography variant="body2" sx={{ color: bodyColor }}>
                Send forespørsel til <strong>{brand.supportEmail}</strong>. Vi svarer uten ugrunnet opphold og normalt senest innen 30 dager.
              </Typography>
            </Paper>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              7. Cookies og lignende teknologier
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Vi bruker nødvendige cookies for innlogging, sikkerhet og grunnleggende funksjonalitet. Analyse- og markedsføringscookies brukes bare når du har gitt samtykke der dette kreves.
            </Typography>
            <Paper sx={panelSx}>
              <Typography variant="body2" sx={{ color: bodyColor }}>
                Nødvendige cookies kan ikke slås av hvis tjenesten skal fungere. Andre kategorier styres gjennom samtykkebanner og gjeldende innstillinger.
              </Typography>
            </Paper>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              8. Klage til Datatilsynet
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Hvis du mener behandlingen vår bryter personvernlovgivningen, kan du kontakte oss først eller sende klage til Datatilsynet.
            </Typography>
            <Paper sx={panelSx}>
              <Typography variant="body2" sx={{ color: bodyColor }}>
                Datatilsynet, Postboks 458 Sentrum, 0105 Oslo ·{' '}
                <a href="https://www.datatilsynet.no" target="_blank" rel="noopener noreferrer" style={{ color: brand.accent }}>
                  www.datatilsynet.no
                </a>
              </Typography>
            </Paper>
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
                Kontakt og oppdateringer
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: bodyColor, mb: 2 }}>
              Har du spørsmål om personvern, integrasjoner eller hvordan vi bruker data i plattformen, kontakt oss direkte.
            </Typography>
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
              <Button variant="text" href="/terms-and-conditions" sx={{ color: brand.accent }}>
                Les vilkår og betingelser
              </Button>
            </Stack>
          </Paper>
        </Paper>
      </Container>
    </Box>
  );
};

export default PrivacyPolicy;
