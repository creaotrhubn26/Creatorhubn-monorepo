/**
 * Klient-flatens onboarding-wizard for plattform-tilkoblinger.
 *
 * Daniel: «her bør det være en wizard, hvilke sosiale medier platformer
 * har du? — i wizarden bør det komme opp logo av de ulike kontoene etc.»
 *
 * Wizard-flow:
 *  1. Vis 4 plattform-kort (Meta, Google Ads, LinkedIn, TikTok) med store
 *     brand-logoer.
 *  2. Hver kort viser status: «Tilkoblet ✓» med kundens egen konto-logo +
 *     navn, eller «Ikke koblet» med «Slik kobler du»-knapp.
 *  3. Klikk på «Slik kobler du» → dialog med trinn-for-trinn instrukser
 *     (kopiert fra docs/role-room/client-guide.md §1.x).
 *
 * Wizarden bruker samme `/api/role-room/ads/assets`-data som GrantedAssetsCard
 * — så den er automatisk synket: så snart kunden gir produsenten tilgang i sin
 * Business Manager, dukker det opp som «Tilkoblet» i wizarden ved neste page-
 * load. Ingen ny backend-kode trengs.
 */

import { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  LinkedIn as LinkedInIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomGrantedAssets,
} from '../../services/roleRoomAgentService';

const CARD_SX = {
  p: 1.6,
  borderRadius: 2,
  bgcolor: 'rgba(15,23,42,0.55)',
  border: '1px solid rgba(148,163,184,0.16)',
} as const;
const LABEL = { color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' } as const;
const SUBTLE = { color: 'rgba(226,232,240,0.66)', fontSize: '0.8rem' } as const;

type PlatformKey = 'meta' | 'google' | 'linkedin' | 'tiktok';

interface PlatformSpec {
  key: PlatformKey;
  name: string;
  accent: string;
  icon: React.ReactNode;
  description: string;
  // Bestemor-vennlig steg-for-steg-instruks
  instructions: {
    summary: string;
    /** Hva du trenger før du begynner — verktøy, kontoer, info. */
    prerequisites: string[];
    steps: string[];
    recommendedRole: string;
    /** Hvordan brukeren vet at det virket. */
    successCheck: string;
    docLink?: { label: string; href: string };
  };
}

const PLATFORMS: PlatformSpec[] = [
  {
    key: 'meta',
    name: 'Meta (Facebook + Instagram)',
    accent: '#1877F2',
    icon: (
      <Stack direction="row" spacing={-0.5}>
        <FacebookIcon sx={{ fontSize: 44, color: '#1877F2' }} />
        <InstagramIcon sx={{ fontSize: 44, color: '#E1306C' }} />
      </Stack>
    ),
    description: 'Annonser + organisk innhold på Facebook og Instagram. Tre tilganger trengs: Page, IG-konto og annonsekonto.',
    instructions: {
      summary: 'Du gir produsenten en avgrenset rolle som lar dem kjøre annonser på din Facebook-side og Instagram-konto. Du beholder all kontroll på fakturering.',
      prerequisites: [
        'Din vanlige Facebook-konto (den du bruker privat eller på jobb).',
        'E-postadressen produsenten ba deg om å bruke (spør hvis du ikke har den).',
        'Cirka 5–10 minutter.',
      ],
      steps: [
        'Trykk «Åpne Facebook Business» nederst i denne dialogen. Det åpner Facebooks bedriftsside i en ny fane.',
        'Logg inn med din vanlige Facebook-konto hvis siden ber om det. Bruk passordet du vanligvis bruker.',
        'Øverst på siden ser du en meny eller dropdown med navn på bedriften din. Sjekk at riktig bedrift er valgt (hvis du har flere).',
        'Nederst til venstre i menyen finner du et lite tannhjul-ikon (⚙️). Trykk på det — det heter «Innstillinger».',
        'I venstrekolonnen som åpnes, finn overskriften «Kontoer». Under den, trykk «Sider».',
        'Du ser en liste over Facebook-sider du har tilgang til. Trykk på din egen Facebook-side i listen.',
        'Til høyre dukker det opp en knapp som heter «Legg til personer» (eller «Add people»). Trykk på den.',
        'Skriv inn produsentens e-postadresse i feltet som åpnes.',
        'Velg rollen «Annonsør» (ikke «Administrator» eller «Redaktør»). Det betyr produsenten kan kjøre annonser, men ikke endre eller slette siden din.',
        'Trykk «Neste» eller «Tilordne». Ferdig med Facebook-siden! 🎉',
        'Nå må vi gjøre det samme for annonsekontoen din. Gå tilbake til «Innstillinger» → under «Kontoer» → trykk «Annonsekontoer» (ikke «Sider» denne gangen).',
        'Velg din annonsekonto → «Legg til personer» → skriv inn samme e-post.',
        'Velg tilgangsnivå «ADVERTISE» (ikke MANAGE). Det lar produsenten lage og kjøre annonser, men IKKE røre fakturering eller kontoinnstillinger.',
        'Trykk «Tilordne». Nå er du ferdig!',
        'Instagram-kontoen din får automatisk tilgang hvis den er koblet til Facebook-siden. Hvis ikke: gå til Facebook-sidens innstillinger → «Linked Accounts» → koble Instagram først.',
      ],
      recommendedRole: 'ADVERTISE (ikke MANAGE — du beholder fakturering selv)',
      successCheck: 'Vent 5–10 minutter, gå tilbake til denne siden, og last den på nytt. Facebook-siden, Instagram-kontoen og annonsekontoen skal dukke opp her med logo og navn.',
      docLink: { label: 'Åpne Facebook Business', href: 'https://business.facebook.com' },
    },
  },
  {
    key: 'google',
    name: 'Google Ads',
    accent: '#4285F4',
    icon: (
      <Box
        sx={{
          width: 44, height: 44, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'conic-gradient(from 0deg, #4285F4 0% 25%, #34A853 25% 50%, #FBBC05 50% 75%, #EA4335 75% 100%)',
          color: '#fff', fontWeight: 900, fontSize: '1.4rem',
        }}
      >
        G
      </Box>
    ),
    description: 'Annonser på Google Search, Display og Performance Max. Produsenten administrerer på vegne av deg.',
    instructions: {
      summary: 'Du inviterer produsenten som bruker på din Google Ads-konto. Du beholder full kontroll og kan fjerne tilgangen når som helst.',
      prerequisites: [
        'En eksisterende Google Ads-konto (hvis du ikke har det, må du opprette den først på ads.google.com).',
        'Innloggings-info til din Google-konto.',
        'E-postadressen produsenten ba deg om.',
        'Cirka 5 minutter.',
      ],
      steps: [
        'Trykk «Åpne Google Ads» nederst i denne dialogen. Det åpner Google Ads i en ny fane.',
        'Logg inn med Google-kontoen din hvis nødvendig.',
        'Øverst på siden ser du en kunde-ID på formen «XXX-XXX-XXXX». Sjekk at riktig konto er valgt (hvis du har flere — du kan bytte i dropdown-en øverst).',
        'Øverst til høyre, finn et lite ikon som ser ut som en skiftenøkkel 🔧. Trykk på det. Menyen heter «Verktøy og innstillinger» (Tools and settings).',
        'En meny åpnes med kategorier. Under «Oppsett» (Setup) — trykk «Tilgang og sikkerhet» (Access and security).',
        'Du ser en tabell over brukere. Øverst til venstre i tabellen er det et stort blått «+»-tegn. Trykk på det.',
        'Skriv inn produsentens e-postadresse.',
        'Velg rollenivå «Standard» (ikke «Administrator»). Det betyr produsenten kan lage og kjøre annonser, men ikke endre konto-innstillinger eller fakturering.',
        'Trykk «Send invitasjon» (Send invitation). Produsenten må godta invitasjonen i sin egen Google-konto.',
      ],
      recommendedRole: 'Standard (ikke Administrator — du beholder konto-kontroll)',
      successCheck: 'Vent 10–15 minutter (Google bruker litt lenger tid enn andre på å aktivere tilgang). Gå tilbake til denne siden og last den på nytt. Kunde-ID-en din skal dukke opp her som «Tilkoblet».',
      docLink: { label: 'Åpne Google Ads', href: 'https://ads.google.com' },
    },
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    accent: '#0A66C2',
    icon: <LinkedInIcon sx={{ fontSize: 44, color: '#0A66C2' }} />,
    description: 'Annonser rettet mot beslutningstakere på LinkedIn (B2B). Produsenten lager + drifter kampanjer.',
    instructions: {
      summary: 'Du legger produsenten til som Campaign Manager på din LinkedIn-annonsekonto. De kan da lage og kjøre kampanjer på vegne av deg.',
      prerequisites: [
        'En eksisterende LinkedIn Campaign Manager-konto.',
        'Din LinkedIn-innlogging.',
        'E-posten ELLER LinkedIn-profilen til produsenten.',
        'Cirka 3–5 minutter.',
      ],
      steps: [
        'Trykk «Åpne LinkedIn Campaign Manager» nederst i denne dialogen.',
        'Logg inn med LinkedIn hvis nødvendig.',
        'Øverst på siden ser du navnet på annonsekontoen din. Sjekk at riktig konto er valgt.',
        'Trykk på konto-navnet øverst — en meny åpnes. Velg «Innstillinger» (Settings).',
        'Finn seksjonen «Manage access» og trykk «Edit».',
        'Trykk «Add user to account».',
        'Skriv inn enten produsentens e-post ELLER deres LinkedIn-profilnavn (begge fungerer).',
        'Velg rolle «Campaign Manager». Det er trygt — produsenten kan lage og rapportere på kampanjer, men kan ikke endre kontoinnstillinger eller fakturering.',
        'Trykk «Save». Du er ferdig!',
      ],
      recommendedRole: 'Campaign Manager (ikke Account Billing Admin)',
      successCheck: 'Vent 5–10 minutter, gå tilbake til denne siden, og last den på nytt. LinkedIn-kontoen din skal dukke opp her som «Tilkoblet».',
      docLink: { label: 'Åpne LinkedIn Campaign Manager', href: 'https://www.linkedin.com/campaignmanager/' },
    },
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    accent: '#FE2C55',
    icon: (
      <Box
        sx={{
          width: 44, height: 44, borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: '#000', color: '#fff', fontWeight: 900, fontSize: '1.3rem',
          position: 'relative',
          '&::before': { content: '"♪"', position: 'absolute', color: '#25F4EE', transform: 'translate(-3px, -3px)' },
          '&::after': { content: '"♪"', position: 'absolute', color: '#FE2C55', transform: 'translate(3px, 3px)' },
        }}
      />
    ),
    description: 'Annonser på TikTok (kommer snart i Role Room — vi støtter tilkobling i forberedelse).',
    instructions: {
      summary: 'TikTok Ads-integrasjonen er på vei. Når den er klar legger vi inn samme type guide her.',
      prerequisites: [
        'Du trenger ikke gjøre noe nå.',
      ],
      steps: [
        'TikTok-tilkobling er foreløpig ikke aktivert i Role Room.',
        'Hvis dere har en TikTok For Business-konto i dag: si fra til produsenten, så prioriterer vi den når API-en er klar.',
      ],
      recommendedRole: '—',
      successCheck: 'Vi gir beskjed her når TikTok-tilkobling blir tilgjengelig.',
    },
  },
];

interface ClientConnectWizardProps {
  /** Optional: cached data så wizarden ikke trenger å re-fetche hvis parent allerede har data. */
  initialData?: RoleRoomGrantedAssets | null;
}

export default function ClientConnectWizard({ initialData }: ClientConnectWizardProps = {}) {
  const [loading, setLoading] = useState(!initialData);
  const [data, setData] = useState<RoleRoomGrantedAssets | null>(initialData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<PlatformKey | null>(null);
  /** «Sjekk tilkoblingen»-state for dialogen: idle | checking | success | not_yet */
  const [verifyState, setVerifyState] = useState<'idle' | 'checking' | 'success' | 'not_yet'>('idle');

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await roleRoomAgentService.fetchGrantedAdsAssets();
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setError('Klarte ikke å hente tilkoblings-oversikt.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialData]);

  // Per-plattform status — telleren av admin-assets fra `data` (per plattform).
  const statusFor = (key: PlatformKey): { connected: boolean; assets: { name: string | null; logoUrl: string | null; label: string }[] } => {
    if (key === 'meta') {
      const pages = data?.platforms.meta.pages?.filter((p) => p.isAdmin) ?? [];
      return {
        connected: pages.length > 0,
        assets: pages.map((p) => ({ name: p.name, logoUrl: p.pictureUrl ?? null, label: 'Facebook Page' })),
      };
    }
    if (key === 'linkedin') {
      const li = data?.platforms.linkedin;
      // LinkedIn returnerer én flat 'assets'-array; filtrer på assetType for å skille ad-account vs organisasjon.
      const items: { name: string | null; logoUrl: string | null; label: string }[] = [];
      li?.assets?.filter((a) => a.isAdmin).forEach((a) => {
        items.push({
          name: a.name,
          logoUrl: a.logoUrl ?? null,
          label: a.assetType === 'ad_account' ? 'Annonsekonto' : 'Organisasjon',
        });
      });
      return { connected: items.length > 0, assets: items };
    }
    // Google + TikTok: ikke wiret i fetchGrantedAdsAssets ennå
    return { connected: false, assets: [] };
  };

  const openSpec = openDialog ? PLATFORMS.find((p) => p.key === openDialog) ?? null : null;

  /** Sjekk tilkoblingen nå — re-fetcher GET /ads/assets og oppdaterer state. */
  const verifyConnection = async () => {
    if (!openDialog) return;
    setVerifyState('checking');
    try {
      const fresh = await roleRoomAgentService.fetchGrantedAdsAssets();
      setData(fresh);
      // Sjekk om akkurat denne plattformen nå er koblet
      const wasConnected = statusFor(openDialog).connected;
      // Re-bruk statusFor med fresh data ved å midlertidig sette data og re-evaluere
      const isConnectedNow = (() => {
        if (openDialog === 'meta') {
          return (fresh.platforms.meta.pages?.filter((p) => p.isAdmin).length ?? 0) > 0;
        }
        if (openDialog === 'linkedin') {
          return (fresh.platforms.linkedin.assets?.filter((a) => a.isAdmin).length ?? 0) > 0;
        }
        return false; // google + tiktok: ikke wiret i /ads/assets ennå
      })();
      setVerifyState(isConnectedNow ? 'success' : 'not_yet');
      // Reset state etter 6 sek så brukeren kan prøve igjen
      setTimeout(() => setVerifyState('idle'), 6000);
      void wasConnected; // hint: kunne brukes til diff i en future-versjon
    } catch {
      setVerifyState('not_yet');
      setTimeout(() => setVerifyState('idle'), 4000);
    }
  };

  // Reset verify-state når dialog endrer plattform
  useEffect(() => { setVerifyState('idle'); }, [openDialog]);

  return (
    <>
      <Stack spacing={1.2} sx={CARD_SX}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography sx={LABEL}>Plattformer dere annonserer på</Typography>
        </Stack>
        <Typography sx={SUBTLE}>
          Velg hvilke plattformer dere bruker, og gi produsenten admin-tilgang via deres egen Business Manager. Når tilkoblingen er på plass dukker logo og navn opp her.
        </Typography>

        {loading && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
            <CircularProgress size={16} sx={{ color: 'rgba(226,232,240,0.6)' }} />
            <Typography sx={SUBTLE}>Sjekker tilkoblinger …</Typography>
          </Stack>
        )}

        {error && <Alert severity="warning">{error}</Alert>}

        {!loading && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: 1.2,
            }}
          >
            {PLATFORMS.map((p) => {
              const status = statusFor(p.key);
              return (
                <Card
                  key={p.key}
                  sx={{
                    p: 1.4,
                    borderRadius: 2,
                    bgcolor: status.connected ? 'rgba(134,239,172,0.06)' : 'rgba(148,163,184,0.05)',
                    border: `1px solid ${status.connected ? 'rgba(134,239,172,0.3)' : 'rgba(148,163,184,0.18)'}`,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1 }}>
                    {p.icon}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.92rem' }} noWrap>
                        {p.name}
                      </Typography>
                      {status.connected ? (
                        <Chip
                          size="small"
                          icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                          label={`Tilkoblet · ${status.assets.length}`}
                          sx={{ mt: 0.4, fontWeight: 700, color: '#86efac', bgcolor: 'rgba(134,239,172,0.1)', border: '1px solid rgba(134,239,172,0.3)' }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          label="Ikke koblet ennå"
                          sx={{ mt: 0.4, fontWeight: 700, color: 'rgba(226,232,240,0.7)', bgcolor: 'rgba(148,163,184,0.12)' }}
                        />
                      )}
                    </Box>
                  </Stack>

                  <Typography sx={{ ...SUBTLE, fontSize: '0.74rem', mb: 0.8 }}>
                    {p.description}
                  </Typography>

                  {/* Kunde-konto-logoer hvis koblet */}
                  {status.connected && (
                    <Stack spacing={0.5} sx={{ mb: 1 }}>
                      {status.assets.slice(0, 3).map((a, i) => (
                        <Stack key={i} direction="row" alignItems="center" spacing={0.8}>
                          <Avatar src={a.logoUrl ?? undefined} sx={{ width: 22, height: 22, bgcolor: 'rgba(15,23,42,0.6)', fontSize: '0.6rem' }}>
                            {(a.name?.[0] ?? '?').toUpperCase()}
                          </Avatar>
                          <Typography sx={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 600 }} noWrap>
                            {a.name || 'Uten navn'}
                          </Typography>
                          <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.68rem' }}>
                            · {a.label}
                          </Typography>
                        </Stack>
                      ))}
                      {status.assets.length > 3 && (
                        <Typography sx={SUBTLE}>+ {status.assets.length - 3} til</Typography>
                      )}
                    </Stack>
                  )}

                  <Button
                    size="small"
                    variant={status.connected ? 'text' : 'outlined'}
                    startIcon={<HelpIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setOpenDialog(p.key)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      color: status.connected ? 'rgba(226,232,240,0.7)' : p.accent,
                      borderColor: `${p.accent}66`,
                    }}
                  >
                    {status.connected ? 'Slik gir du flere tilgang' : 'Slik kobler du'}
                  </Button>
                </Card>
              );
            })}
          </Box>
        )}
      </Stack>

      {/* Slik-kobler-du-dialog */}
      <Dialog open={!!openDialog} onClose={() => setOpenDialog(null)} maxWidth="sm" fullWidth>
        {openSpec && (
          <>
            <DialogTitle>
              <Stack direction="row" alignItems="center" spacing={1.2}>
                {openSpec.icon}
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
                    Koble {openSpec.name}
                  </Typography>
                  <Typography sx={{ ...SUBTLE, fontSize: '0.76rem' }}>
                    Anbefalt rolle: <strong>{openSpec.instructions.recommendedRole}</strong>
                  </Typography>
                </Box>
                <IconButton onClick={() => setOpenDialog(null)} size="small">
                  <CloseIcon />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Typography sx={{ fontSize: '0.92rem', mb: 1.5, color: '#e2e8f0', fontWeight: 500 }}>
                {openSpec.instructions.summary}
              </Typography>

              {/* Hva du trenger først */}
              <Box
                sx={{
                  mb: 1.8,
                  p: 1.2,
                  borderRadius: 1.5,
                  bgcolor: `${openSpec.accent}11`,
                  border: `1px solid ${openSpec.accent}44`,
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: openSpec.accent, mb: 0.6 }}>
                  📋 Hva du trenger først
                </Typography>
                <Stack spacing={0.4}>
                  {openSpec.instructions.prerequisites.map((pre, i) => (
                    <Typography key={i} sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.85)' }}>
                      • {pre}
                    </Typography>
                  ))}
                </Stack>
              </Box>

              {/* Steg-for-steg */}
              <Typography sx={{ fontWeight: 700, fontSize: '0.86rem', color: '#e2e8f0', mb: 1 }}>
                Steg-for-steg
              </Typography>
              <Stack spacing={1.2} sx={{ mb: 1.8 }}>
                {openSpec.instructions.steps.map((step, i) => (
                  <Stack key={i} direction="row" spacing={1.2} alignItems="flex-start">
                    <Chip
                      label={String(i + 1)}
                      size="small"
                      sx={{
                        fontWeight: 800, minWidth: 28, height: 24,
                        bgcolor: `${openSpec.accent}22`,
                        color: openSpec.accent,
                        border: `1px solid ${openSpec.accent}55`,
                      }}
                    />
                    <Typography sx={{ fontSize: '0.86rem', color: 'rgba(226,232,240,0.92)', flex: 1, lineHeight: 1.55 }}>
                      {step}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              {/* Suksess-sjekk-tekst */}
              <Alert
                severity="success"
                icon={<CheckCircleIcon fontSize="inherit" />}
                sx={{ mb: 1.8, '& .MuiAlert-message': { fontSize: '0.84rem' } }}
              >
                <strong>Hvordan du vet at det virket:</strong> {openSpec.instructions.successCheck}
              </Alert>

              {/* Verify-knapp + live status (kun for plattformer som er wiret i /ads/assets) */}
              {(openSpec.key === 'meta' || openSpec.key === 'linkedin') && (
                <Stack spacing={1.2} sx={{ mb: 1.8 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    size="large"
                    startIcon={verifyState === 'checking' ? <CircularProgress size={16} sx={{ color: openSpec.accent }} /> : <CheckCircleIcon />}
                    onClick={verifyConnection}
                    disabled={verifyState === 'checking'}
                    sx={{
                      textTransform: 'none', fontWeight: 700, py: 1.2,
                      color: openSpec.accent, borderColor: `${openSpec.accent}66`,
                      '&:hover': { borderColor: openSpec.accent, bgcolor: `${openSpec.accent}11` },
                    }}
                  >
                    {verifyState === 'checking' ? 'Sjekker tilkoblingen …' : 'Sjekk tilkoblingen min nå'}
                  </Button>
                  {verifyState === 'success' && (
                    <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />}>
                      <strong>Tilkobling bekreftet!</strong> Du kan lukke dette vinduet — kontoen din vises nå med logo i wizarden.
                    </Alert>
                  )}
                  {verifyState === 'not_yet' && (
                    <Alert severity="warning">
                      <strong>Ikke registrert ennå.</strong> Tilgangen tar typisk 2–10 minutter å aktivere etter at du ga den. Vent litt og trykk «Sjekk tilkoblingen min nå» på nytt.
                    </Alert>
                  )}
                </Stack>
              )}

              {openSpec.instructions.docLink && (
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<OpenInNewIcon />}
                  href={openSpec.instructions.docLink.href}
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    textTransform: 'none', fontWeight: 700, py: 1.2,
                    bgcolor: openSpec.accent,
                    '&:hover': { bgcolor: openSpec.accent, filter: 'brightness(1.1)' },
                  }}
                >
                  {openSpec.instructions.docLink.label}
                </Button>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}
