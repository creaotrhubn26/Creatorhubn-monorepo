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
  Cancel,
  ContactMail,
  CreditCard,
  Gavel,
  Info,
  Security,
  Warning,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import PublicSocialLinks from '@/components/common/PublicSocialLinks';
import {
  getPublicSocialProfiles,
  PUBLIC_BRAND_LINKS,
  resolvePublicBrandFromWindow,
} from '@/lib/publicBrandLinks';
import { useTheming } from '../utils/theming-helper';

type TermsBrand = {
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
  intro: string;
  summary: string;
  allowed: string[];
  prohibited: string[];
};

function getTermsBrand(): TermsBrand {
  const brandKey = resolvePublicBrandFromWindow();

  if (brandKey === 'roleRoom') {
    return {
      appName: 'The Role Room',
      subtitle: 'Vilkår for produksjonsplattformen The Role Room',
      accent: '#22d3ee',
      accentSoft: 'rgba(8, 145, 178, 0.12)',
      accentBorder: 'rgba(34, 211, 238, 0.28)',
      pageBg:
        'radial-gradient(circle at top left, rgba(34,211,238,0.18) 0%, transparent 38%), radial-gradient(circle at top right, rgba(124,58,237,0.14) 0%, transparent 34%), linear-gradient(180deg, #07111b 0%, #0b1220 45%, #111827 100%)',
      iconGradient: 'linear-gradient(135deg, #22d3ee 0%, #7c3aed 100%)',
      website: PUBLIC_BRAND_LINKS.roleRoom.website,
      supportEmail: PUBLIC_BRAND_LINKS.roleRoom.email,
      socialLabel: 'Følg The Role Room',
      intro:
        'Ved å bruke The Role Room aksepterer du disse vilkårene for bruk av plattformen, inkludert prosjektdata, produksjonsplanlegging, samarbeid, integrasjoner og administrative verktøy.',
      summary:
        'The Role Room leveres av Creatorhub AS og er bygget for casting, teamkoordinering, manus, storyboard, produksjonslogistikk og klientnært samarbeid.',
      allowed: [
        'Planlegge, koordinere og gjennomføre produksjoner i tråd med valgt abonnement og rolle.',
        'Laste opp eget materiale, invitere team og behandle produksjonsdata du har rett til å bruke.',
        'Koble til integrasjoner du har tilgang til, som Google Workspace og andre godkjente verktøy.',
      ],
      prohibited: [
        'Laste opp eller dele innhold du ikke har rettigheter til, eller innhold som bryter lov, avtaler eller personvernregler.',
        'Misbruke plattformen til scraping, uautorisert automatisering, hacking eller omgåelse av sikkerhet.',
        'Bruke andres konto, dele sensitiv tilgang eller forsøke å hente ut data du ikke har tilgang til.',
      ],
    };
  }

  return {
    appName: 'CreatorHub Norge',
    subtitle: 'Vilkår for CreatorHub-plattformen',
    accent: '#ff8c00',
    accentSoft: 'rgba(255, 140, 0, 0.10)',
    accentBorder: 'rgba(255, 140, 0, 0.22)',
    pageBg:
      'linear-gradient(135deg, #fff5e6 0%, #ffedd5 25%, #fed7aa 50%, #fdba74 75%, #f59e0b 100%), radial-gradient(circle at 20% 80%, rgba(255,140,0,0.3) 0%, transparent 50%)',
    iconGradient: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)',
    website: PUBLIC_BRAND_LINKS.creatorhub.website,
    supportEmail: PUBLIC_BRAND_LINKS.creatorhub.email,
    socialLabel: 'Følg CreatorHub',
    intro:
      'Ved å bruke CreatorHub Norge aksepterer du disse vilkårene for medlemskap, betaling, prosjekter, community, integrasjoner og annen bruk av plattformen.',
    summary:
      'CreatorHub leveres av Creatorhub AS og samler prosjektstyring, kundeopplevelse, læring, abonnementsflyt og community i én plattform.',
    allowed: [
      'Bruke plattformen til prosjekter, samarbeid, læring, kundearbeid og andre legitime arbeidsflyter.',
      'Laste opp eget materiale og bruke integrasjoner du selv har rettigheter til å koble til.',
      'Bruke abonnements- og kjøpsflyten slik den er beskrevet i gjeldende plan, tilbud eller bestillingsside.',
    ],
    prohibited: [
      'Laste opp ulovlig innhold, krenkende materiale eller filer du ikke har rettigheter til.',
      'Misbruke plattformen til spam, scraping, phishing, reverse engineering eller omgåelse av sikkerhet.',
      'Dele konto, få uautorisert tilgang til andres data eller manipulere betalings- og abonnementsflyt.',
    ],
  };
}

const TermsAndConditions: React.FC = () => {
  const [, setLocation] = useLocation();
  const theming = useTheming('photographer');
  const brandKey = resolvePublicBrandFromWindow();
  const brand = getTermsBrand();
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
        <Paper elevation={3} sx={{ ...surfaceSx, mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '14px',
                background: brand.iconGradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 3,
              }}
            >
              <Gavel sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 800, color: isRoleRoom ? '#f8fafc' : '#1f2937', ...theming.colors }}>
                {brand.appName} · Vilkår og betingelser
              </Typography>
              <Typography variant="body1" sx={{ color: mutedColor, mt: 1 }}>
                {brand.subtitle} · Sist oppdatert: 6. april 2026
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3, borderColor: brand.accentBorder }} />

          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip icon={<Gavel />} label="Juridisk bindende" variant="outlined" sx={{ borderColor: brand.accentBorder, color: isRoleRoom ? '#f8fafc' : undefined }} />
            <Chip icon={<Security />} label="Norsk lovgivning" variant="outlined" sx={{ borderColor: brand.accentBorder, color: isRoleRoom ? '#f8fafc' : undefined }} />
            <Chip icon={<Info />} label="Oppdatert for abonnement, Google og AI" variant="outlined" sx={{ borderColor: brand.accentBorder, color: isRoleRoom ? '#f8fafc' : undefined }} />
          </Stack>
        </Paper>

        <Paper elevation={3} sx={surfaceSx}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              {brand.intro}
            </Typography>
            <Paper sx={panelSx}>
              <Typography variant="body2" sx={{ color: bodyColor }}>
                <strong>Viktig:</strong> Disse vilkårene utgjør en juridisk bindende avtale mellom deg og <strong>Creatorhub AS</strong>. {brand.summary}
              </Typography>
            </Paper>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              1. Tjenesten og hvem vilkårene gjelder for
            </Typography>
            <List>
              <ListItem disableGutters><ListItemText primary="Tjenesten" secondary={`${brand.appName}, inkludert nettsted, arbeidsflater, prosjekter, filer, integrasjoner, AI-funksjoner og andre tilhørende funksjoner.`} /></ListItem>
              <ListItem disableGutters><ListItemText primary="Bruker" secondary="Enhver person eller virksomhet som registrerer, aktiverer eller bruker tjenesten." /></ListItem>
              <ListItem disableGutters><ListItemText primary="Virksomhet" secondary="Hvis du bruker tjenesten på vegne av et selskap eller en kunde, bekrefter du at du har nødvendig fullmakt." /></ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              2. Konto, tilgang og ansvar
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Du er ansvarlig for at opplysningene du gir er korrekte, at pålogging holdes konfidensiell, og at bare autoriserte personer bruker kontoen.
            </Typography>
            <List>
              <ListItem disableGutters><ListItemText primary="Korrekte opplysninger" secondary="Du må holde navn, kontaktinformasjon, virksomhetsinformasjon og relevante prosjektopplysninger oppdatert." /></ListItem>
              <ListItem disableGutters><ListItemText primary="Kontosikkerhet" secondary="Du er ansvarlig for passord, MFA, invitasjoner og annen tilgang du administrerer." /></ListItem>
              <ListItem disableGutters><ListItemText primary="Tilganger og roller" secondary="Vi kan håndheve rollebasert tilgang, administratortilganger og sikkerhetspolicyer for å beskytte tjenesten." /></ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              3. Abonnement, betaling og fornyelse
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Betalte planer, teamnivåer, tilvalg og eventuelle piloter fremgår av bestillingsflyt, prisside, tilbud eller skriftlig avtale.
            </Typography>
            <List>
              <ListItem disableGutters><CreditCard sx={{ color: brand.accent, mr: 2, mt: 0.25 }} /><ListItemText primary="Fakturering og kortbetaling" secondary="Betaling håndteres via godkjente betalingsleverandører. Faktura og kvittering sendes eller gjøres tilgjengelig digitalt." /></ListItem>
              <ListItem disableGutters><CreditCard sx={{ color: brand.accent, mr: 2, mt: 0.25 }} /><ListItemText primary="Automatisk fornyelse" secondary="Løpende planer fornyes automatisk med mindre de sies opp før neste periode." /></ListItem>
              <ListItem disableGutters><CreditCard sx={{ color: brand.accent, mr: 2, mt: 0.25 }} /><ListItemText primary="Prisendringer" secondary="Vi kan oppdatere priser med rimelig forhåndsvarsel før ny periode eller fornyelse." /></ListItem>
            </List>
            <Paper sx={{ ...panelSx, mt: 2 }}>
              <Typography variant="body2" sx={{ color: bodyColor }}>
                Ved mislykket betaling kan tilgangen begrenses inntil betaling er gjennomført. Dette gjelder ikke lovpålagte rettigheter du måtte ha som forbruker.
              </Typography>
            </Paper>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              4. Integrasjoner, AI og tredjepartstjenester
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Tjenesten kan kobles til tredjepartstjenester som Google Workspace, betalingsleverandører, bedriftsoppslag og AI-tjenester. Når du eller administrator aktiverer slike integrasjoner, godtar du at relevante data behandles for å levere funksjonen.
            </Typography>
            <List>
              <ListItem disableGutters><ListItemText primary="Google-integrasjoner" secondary="Dokumenter, kalender, e-post, Tasks, YouTube, bedriftsprofiler og andre godkjente Google-funksjoner behandles bare innenfor oppsatt tilgang og scopes." /></ListItem>
              <ListItem disableGutters><ListItemText primary="AI-genererte forslag" secondary="AI-funksjoner kan generere utkast, anbefalinger og oppsummeringer, men du er ansvarlig for å kontrollere resultatene før de brukes i praksis." /></ListItem>
              <ListItem disableGutters><ListItemText primary="Tilgjengelighet og endringer" secondary="Vi kan endre, forbedre eller fjerne integrasjoner og AI-funksjoner dersom leverandører, sikkerhetskrav eller produktbehov tilsier det." /></ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              5. Tillatt og forbudt bruk
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: isRoleRoom ? '#f8fafc' : '#1f2937', mt: 1, mb: 1.5 }}>
              Tillatt bruk
            </Typography>
            <List>
              {brand.allowed.map((item) => (
                <ListItem key={item} disableGutters><ListItemText primary={item} /></ListItem>
              ))}
            </List>
            <Typography variant="h6" sx={{ fontWeight: 800, color: brand.accent, mt: 2, mb: 1.5 }}>
              Forbudt bruk
            </Typography>
            <List>
              {brand.prohibited.map((item) => (
                <ListItem key={item} disableGutters>
                  <Warning sx={{ color: '#ef4444', mr: 2, mt: 0.2 }} />
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              6. Innhold, eierskap og lisens
            </Typography>
            <List>
              <ListItem disableGutters><ListItemText primary="Ditt innhold" secondary="Du beholder rettighetene til materiale du laster opp eller oppretter, med mindre annet er uttrykkelig avtalt." /></ListItem>
              <ListItem disableGutters><ListItemText primary="Nødvendig lisens til oss" secondary="Du gir oss en begrenset rett til å lagre, behandle, vise og overføre innholdet når dette er nødvendig for å levere tjenesten." /></ListItem>
              <ListItem disableGutters><ListItemText primary="Plattform og merkevarer" secondary={`${brand.appName}, design, kode, databaser, logoer og funksjonalitet tilhører Creatorhub AS eller våre lisensgivere.`} /></ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              7. Oppsigelse, nedstenging og refusjon
            </Typography>
            <List>
              <ListItem disableGutters><Cancel sx={{ color: '#ef4444', mr: 2, mt: 0.2 }} /><ListItemText primary="Din oppsigelse" secondary="Du kan si opp løpende planer før neste faktureringsperiode. Tilgang varer normalt ut betalt periode med mindre annet er avtalt." /></ListItem>
              <ListItem disableGutters><Cancel sx={{ color: '#ef4444', mr: 2, mt: 0.2 }} /><ListItemText primary="Vår rett til å suspendere" secondary="Vi kan midlertidig eller permanent stenge tilgang ved sikkerhetsbrudd, misbruk, ulovlig aktivitet eller vesentlig brudd på vilkårene." /></ListItem>
              <ListItem disableGutters><Cancel sx={{ color: '#ef4444', mr: 2, mt: 0.2 }} /><ListItemText primary="Refusjon" secondary="Refusjon vurderes etter gjeldende avtale, angrerett og norsk forbrukerlovgivning. Særskilte B2B-avtaler kan ha egne vilkår." /></ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              8. Ansvarsbegrensning
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Tjenesten leveres i den form den til enhver tid foreligger. Vi arbeider for stabil drift, men kan ikke garantere at tjenesten alltid er feilfri, kontinuerlig tilgjengelig eller passer ethvert spesifikt formål.
            </Typography>
            <Paper sx={panelSx}>
              <Typography variant="body2" sx={{ color: bodyColor }}>
                Der loven tillater det, er vårt totale ansvar begrenset til beløpet du har betalt for tjenesten de siste 12 månedene. Dette begrenser ikke ufravikelige rettigheter etter norsk lov.
              </Typography>
            </Paper>
          </Box>

          <Divider sx={{ my: 4, borderColor: brand.accentBorder }} />

          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.accent, mb: 2 }}>
              9. Personvern og lovvalg
            </Typography>
            <Typography variant="body1" sx={{ color: bodyColor, lineHeight: 1.8, mb: 2 }}>
              Din bruk av tjenesten er også underlagt vår personvernerklæring. Disse vilkårene reguleres av norsk rett. Eventuelle tvister skal søkes løst i minnelighet først, og kan deretter bringes inn for ordinære domstoler i Norge med mindre ufravikelig forbrukerlovgivning sier noe annet.
            </Typography>
            <Button href="/privacy-policy" sx={{ color: brand.accent, px: 0 }}>
              Les personvernerklæringen
            </Button>
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
              Har du spørsmål om vilkårene, abonnement, integrasjoner eller bruk av plattformen, kontakt oss direkte.
            </Typography>
            <Paper sx={panelSx}>
              <Typography variant="body2" sx={{ color: bodyColor }}>Creatorhub AS</Typography>
              <Typography variant="body2" sx={{ color: bodyColor }}>Tjeneste: {brand.appName}</Typography>
              <Typography variant="body2" sx={{ color: bodyColor }}>Nettside: {brand.website}</Typography>
              <Typography variant="body2" sx={{ color: bodyColor }}>E-post: {brand.supportEmail}</Typography>
            </Paper>
            <PublicSocialLinks
              label={brand.socialLabel}
              body={
                isRoleRoom
                  ? 'Følg The Role Room for oppdateringer om produksjonsflyt, nye verktøy og policy-endringer.'
                  : 'Følg CreatorHub for produktnyheter, abonnement og plattformoppdateringer.'
              }
              links={socialLinks}
              tone="legal"
              sx={{ my: 2.2 }}
              showTopDivider
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="contained"
                startIcon={<ContactMail />}
                href={`mailto:${brand.supportEmail}`}
                sx={{ ...theming.getThemedButtonSx(), background: brand.iconGradient }}
              >
                Kontakt support
              </Button>
              <Button variant="outlined" onClick={() => setLocation('/')}>
                Tilbake til forsiden
              </Button>
              <Button variant="text" href="/privacy-policy" sx={{ color: brand.accent }}>
                Personvernerklæring
              </Button>
            </Stack>
          </Paper>
        </Paper>
      </Container>
    </Box>
  );
};

export default TermsAndConditions;
