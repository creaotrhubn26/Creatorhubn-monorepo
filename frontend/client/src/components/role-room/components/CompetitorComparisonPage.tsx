/**
 * CompetitorComparisonPage.tsx
 *
 * SEO-landingsside for "X vs The Role Room"-søk. En enkelt
 * komponent driver alle konkurrent-sammenligninger via
 * `COMPETITOR_CONFIGS` — meta-tags settes via inline-skript i
 * theroleroom.html (kjører før React mounter), så Googlebot
 * leser riktig title/description selv om JS-rendering henger.
 *
 * Innhold er forsiktig formulert for å unngå usanne påstander
 * om konkurrenter. Vi fokuserer på The Role Rooms styrker
 * (norsk språk, GDPR, integrert AI) og lar leser sjekke
 * konkurrentens egne sider for spesifikk feature-status.
 *
 * Indeks-side `/alternatives` lister alle konkurrenter med
 * lenker til hver sammenligning.
 */

import React, { useEffect, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LanguageIcon from '@mui/icons-material/Language';
import ShieldIcon from '@mui/icons-material/Shield';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

export type CompetitorKey = 'studiobinder' | 'castingnetworks' | 'moviemagic' | 'yamdu' | 'setkeeper';

type FeatureSupport = 'yes' | 'no' | 'partial' | 'unknown';

interface FeatureRow {
  feature: string;
  roleRoom: FeatureSupport;
  competitor: FeatureSupport;
  note?: string;
}

interface CompetitorConfig {
  key: CompetitorKey;
  name: string;
  tagline: string;
  intro: string;
  features: FeatureRow[];
}

const SHARED_NORDIC_FEATURES: Pick<FeatureRow, 'feature' | 'roleRoom'>[] = [
  { feature: 'Norsk språk i hele appen', roleRoom: 'yes' },
  { feature: 'GDPR-trygg datalagring (EU/EØS)', roleRoom: 'yes' },
  { feature: 'Norsk og nordisk skuespiller-database', roleRoom: 'yes' },
  { feature: 'Integrert AI-agent for casting-arbeidsflyt', roleRoom: 'yes' },
  { feature: 'Talentportal (selv-registrering for skuespillere)', roleRoom: 'yes' },
  { feature: 'Utdanningsinstitusjon-partnerskap', roleRoom: 'yes' },
];

const COMPETITOR_CONFIGS: Record<CompetitorKey, CompetitorConfig> = {
  studiobinder: {
    key: 'studiobinder',
    name: 'StudioBinder',
    tagline: 'Filmproduksjons-styringsplattform',
    intro:
      'StudioBinder er en amerikansk produksjons-suite med call-sheets, shotlist og storyboard. The Role Room dekker samme arbeidsflyt, men er bygget for norsk og nordisk produksjon — språk, datalagring og bransje-integrasjoner.',
    features: [
      ...SHARED_NORDIC_FEATURES.map((f) => ({ ...f, competitor: 'no' as FeatureSupport })),
      { feature: 'Casting-pipeline med kanban-statuser', roleRoom: 'yes', competitor: 'partial' },
      { feature: 'Shotlist og storyboard-koordinering', roleRoom: 'yes', competitor: 'yes' },
      { feature: 'Call-sheet generering', roleRoom: 'yes', competitor: 'yes' },
      { feature: 'Crew- og lokasjons-koordinering', roleRoom: 'yes', competitor: 'yes' },
      { feature: 'Sanntids-samarbeid i nettleser', roleRoom: 'yes', competitor: 'yes' },
    ],
  },
  castingnetworks: {
    key: 'castingnetworks',
    name: 'Casting Networks',
    tagline: 'Internasjonalt skuespiller-marketplace',
    intro:
      'Casting Networks er et globalt skuespiller- og crew-marketplace. The Role Room er bygget som en helhetlig produksjonsflate — du eier dine egne kandidater, prosjekter og opptaksplaner uten et abonnement per session.',
    features: [
      ...SHARED_NORDIC_FEATURES.map((f) => ({ ...f, competitor: 'partial' as FeatureSupport })),
      { feature: 'Casting-pipeline med kanban-statuser', roleRoom: 'yes', competitor: 'yes' },
      { feature: 'Selvbetjent audition-innspilling fra kandidater', roleRoom: 'yes', competitor: 'yes' },
      { feature: 'Eget arbeidsrom for prosjekt (ikke per-session-abonnement)', roleRoom: 'yes', competitor: 'no' },
      { feature: 'Integrert crew- og lokasjons-modul', roleRoom: 'yes', competitor: 'no' },
      { feature: 'Storyboard og shotlist i samme plattform', roleRoom: 'yes', competitor: 'no' },
    ],
  },
  moviemagic: {
    key: 'moviemagic',
    name: 'MovieMagic Scheduling',
    tagline: 'Produksjons-scheduling for film og TV',
    intro:
      'MovieMagic Scheduling og Budgeting er de-facto-standard i Hollywood for produksjonsplanlegging. The Role Room samler de samme byggesteinene i et nettleser-basert arbeidsrom med moderne UI og norsk språk.',
    features: [
      ...SHARED_NORDIC_FEATURES.map((f) => ({ ...f, competitor: 'no' as FeatureSupport })),
      { feature: 'Opptaksdag-planlegging og strip-board', roleRoom: 'yes', competitor: 'yes' },
      { feature: 'Crew- og lokasjons-koordinering', roleRoom: 'yes', competitor: 'yes' },
      { feature: 'Casting-pipeline (roller + kandidater)', roleRoom: 'yes', competitor: 'no' },
      { feature: 'Storyboard og shotlist', roleRoom: 'yes', competitor: 'no' },
      { feature: 'Nettleser-basert (ingen desktop-installasjon)', roleRoom: 'yes', competitor: 'no' },
      { feature: 'Sanntids-samarbeid mellom prosjekt-medlemmer', roleRoom: 'yes', competitor: 'partial' },
    ],
  },
  yamdu: {
    key: 'yamdu',
    name: 'Yamdu',
    tagline: 'Tysk produksjons-management-plattform',
    intro:
      'Yamdu er en europeisk produksjons-management-plattform med fokus på TV- og film-administrasjon. The Role Room legger til en sterk casting-modul og dedikert talentportal i samme arbeidsrom.',
    features: [
      ...SHARED_NORDIC_FEATURES.map((f) => ({ ...f, competitor: 'partial' as FeatureSupport })),
      { feature: 'Integrert AI-agent for casting-arbeidsflyt', roleRoom: 'yes', competitor: 'no' },
      { feature: 'Talentportal med selv-registrering', roleRoom: 'yes', competitor: 'partial' },
      { feature: 'Storyboard og shotlist', roleRoom: 'yes', competitor: 'yes' },
      { feature: 'Opptaksdag-koordinering', roleRoom: 'yes', competitor: 'yes' },
      { feature: 'Crew- og lokasjons-modul', roleRoom: 'yes', competitor: 'yes' },
    ],
  },
  setkeeper: {
    key: 'setkeeper',
    name: 'Setkeeper',
    tagline: 'Mobil-først call-sheet-app',
    intro:
      'Setkeeper er en moderne mobil-først produksjons-app. The Role Room dekker både mobil og web, og legger til en fullverdig casting-pipeline med talentportal som Setkeeper ikke har.',
    features: [
      ...SHARED_NORDIC_FEATURES.map((f) => ({ ...f, competitor: 'partial' as FeatureSupport })),
      { feature: 'Call-sheet generering', roleRoom: 'yes', competitor: 'yes' },
      { feature: 'Casting-pipeline (roller + kandidater)', roleRoom: 'yes', competitor: 'no' },
      { feature: 'Selvbetjent audition-innspilling', roleRoom: 'yes', competitor: 'no' },
      { feature: 'Storyboard og shotlist', roleRoom: 'yes', competitor: 'no' },
      { feature: 'Integrert AI-agent', roleRoom: 'yes', competitor: 'no' },
    ],
  },
};

const SUPPORT_TONES: Record<FeatureSupport, { color: string; bg: string; label: string }> = {
  yes: { color: '#22c55e', bg: 'rgba(34,197,94,0.10)', label: 'Ja' },
  no: { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Nei' },
  partial: { color: '#f97316', bg: 'rgba(249,115,22,0.10)', label: 'Delvis' },
  unknown: { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', label: 'Ukjent' },
};

function SupportCell({ support }: { support: FeatureSupport }) {
  const tone = SUPPORT_TONES[support];
  const Icon =
    support === 'yes' ? CheckCircleIcon :
    support === 'no' ? RemoveCircleOutlineIcon :
    HelpOutlineIcon;
  return (
    <Chip
      icon={<Icon sx={{ color: `${tone.color} !important` }} />}
      label={tone.label}
      size="small"
      sx={{
        bgcolor: tone.bg,
        color: tone.color,
        border: `1px solid ${tone.color}40`,
        fontWeight: 600,
        '& .MuiChip-icon': { color: tone.color },
      }}
    />
  );
}

/**
 * Hovedkomponent — viser sammenligning for én konkurrent.
 */
function ComparisonView({ config }: { config: CompetitorConfig }) {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      <Stack spacing={4}>
        {/* Hero */}
        <Stack spacing={2} sx={{ maxWidth: 820 }}>
          <Chip
            label={config.tagline}
            size="small"
            sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(167,139,250,0.16)', color: '#ddd6fe', fontWeight: 600 }}
          />
          <Typography
            component="h1"
            sx={{ color: '#f8fafc', fontWeight: 800, fontSize: { xs: '1.8rem', md: '2.6rem' }, lineHeight: 1.15 }}
          >
            The Role Room vs {config.name}
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.86)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.6 }}>
            {config.intro}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
            <Button
              href="/"
              variant="contained"
              size="large"
              sx={{
                bgcolor: '#a78bfa',
                color: '#0b1120',
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { bgcolor: '#c4b5fd' },
              }}
            >
              Prøv The Role Room
            </Button>
            <Button
              href="/alternatives"
              variant="outlined"
              size="large"
              sx={{
                color: 'rgba(203,213,225,0.92)',
                borderColor: 'rgba(148,163,184,0.32)',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { borderColor: 'rgba(203,213,225,0.6)', bgcolor: 'rgba(148,163,184,0.06)' },
              }}
            >
              Se andre alternativer
            </Button>
          </Stack>
        </Stack>

        {/* Value props */}
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            pt: 1,
          }}
        >
          {[
            { Icon: LanguageIcon, title: 'Norsk språk', text: 'Hele appen, dokumenter og automatiske e-poster på norsk.' },
            { Icon: ShieldIcon, title: 'GDPR i EU/EØS', text: 'Data lagres i Europa. Klart definert databehandler-avtale.' },
            { Icon: AutoAwesomeIcon, title: 'Integrert AI', text: 'Casting-agent foreslår kandidater, sender invitasjoner og oppsummerer pipelinen.' },
          ].map((v) => (
            <Card key={v.title} sx={{ bgcolor: 'rgba(2,6,23,0.42)', border: '1px solid rgba(148,163,184,0.16)' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <v.Icon sx={{ color: '#a78bfa' }} />
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>{v.title}</Typography>
                </Stack>
                <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.92rem' }}>{v.text}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Divider sx={{ borderColor: 'rgba(148,163,184,0.18)' }} />

        {/* Comparison table */}
        <Box>
          <Typography
            component="h2"
            sx={{ color: '#f8fafc', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.8rem' }, mb: 2 }}
          >
            Sammenligning: feature-by-feature
          </Typography>
          <Alert
            severity="info"
            sx={{
              mb: 2,
              bgcolor: 'rgba(59,130,246,0.08)',
              color: 'rgba(203,213,225,0.92)',
              border: '1px solid rgba(59,130,246,0.24)',
              '& .MuiAlert-icon': { color: '#60a5fa' },
            }}
          >
            Vi gjør vårt beste for å holde sammenligningen oppdatert. {config.name}-statuser baseres på offentlig
            dokumentasjon på leverandørens side. Kjøp aldri kun basert på sammenligningstabeller — be om en demo.
          </Alert>
          <TableContainer
            component={Box}
            sx={{
              bgcolor: 'rgba(2,6,23,0.42)',
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.16)',
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(148,163,184,0.18)', fontWeight: 700, color: '#f8fafc' } }}>
                  <TableCell>Feature</TableCell>
                  <TableCell align="center">The Role Room</TableCell>
                  <TableCell align="center">{config.name}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {config.features.map((row, idx) => (
                  <TableRow key={idx} sx={{ '& td': { borderBottom: '1px solid rgba(148,163,184,0.10)', color: 'rgba(203,213,225,0.92)' } }}>
                    <TableCell>{row.feature}</TableCell>
                    <TableCell align="center"><SupportCell support={row.roleRoom} /></TableCell>
                    <TableCell align="center"><SupportCell support={row.competitor} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* CTA */}
        <Card
          sx={{
            bgcolor: 'rgba(167,139,250,0.10)',
            border: '1px solid rgba(167,139,250,0.32)',
            mt: 2,
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
            <Typography
              component="h2"
              sx={{ color: '#f8fafc', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.6rem' }, mb: 1 }}
            >
              Klar til å prøve The Role Room?
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.86)', mb: 2.5 }}>
              Opprett ditt første prosjekt på minutter. Ingen kredittkort nødvendig.
            </Typography>
            <Button
              href="/"
              variant="contained"
              size="large"
              sx={{
                bgcolor: '#a78bfa',
                color: '#0b1120',
                textTransform: 'none',
                fontWeight: 700,
                px: 4,
                '&:hover': { bgcolor: '#c4b5fd' },
              }}
            >
              Kom i gang gratis
            </Button>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}

/**
 * Indeks-side `/alternatives` — lister alle konkurrent-sammenligninger.
 */
function AlternativesIndexView() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      <Stack spacing={4}>
        <Stack spacing={2} sx={{ maxWidth: 820 }}>
          <Typography
            component="h1"
            sx={{ color: '#f8fafc', fontWeight: 800, fontSize: { xs: '1.8rem', md: '2.6rem' } }}
          >
            Casting-plattform alternativer
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.86)', fontSize: '1.05rem', lineHeight: 1.6 }}>
            Sammenligning av The Role Room mot de største casting- og produksjons-plattformene globalt.
            Vi har bygget The Role Room for nordisk språk og bransje — så valg av plattform handler ofte
            om språk, dataøkonomi og hvor mye av produksjonen som skal bo i samme arbeidsrom.
          </Typography>
        </Stack>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
          {Object.values(COMPETITOR_CONFIGS).map((c) => (
            <Card
              key={c.key}
              sx={{
                bgcolor: 'rgba(2,6,23,0.42)',
                border: '1px solid rgba(148,163,184,0.16)',
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: 'rgba(167,139,250,0.48)' },
              }}
            >
              <CardContent>
                <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.2rem', mb: 0.5 }}>
                  The Role Room vs {c.name}
                </Typography>
                <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.85rem', mb: 1.5 }}>
                  {c.tagline}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontSize: '0.92rem', mb: 2 }}>
                  {c.intro.slice(0, 160)}…
                </Typography>
                <Button
                  href={`/vs-${c.key}`}
                  variant="outlined"
                  size="small"
                  endIcon={<OpenInNewIcon />}
                  sx={{
                    color: '#a78bfa',
                    borderColor: 'rgba(167,139,250,0.32)',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': { borderColor: '#a78bfa', bgcolor: 'rgba(167,139,250,0.08)' },
                  }}
                >
                  Les sammenligningen
                </Button>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Stack>
    </Container>
  );
}

/**
 * Path-parser — mapper `/vs-studiobinder` → `'studiobinder'`.
 * Returnerer null hvis ingen comparison-path matcher.
 */
export function parseCompetitorFromPath(pathname: string): CompetitorKey | 'alternatives' | null {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();
  if (normalized === '/alternatives') return 'alternatives';
  const match = normalized.match(/^\/vs-([a-z]+)$/);
  if (!match) return null;
  const candidate = match[1] as CompetitorKey;
  return candidate in COMPETITOR_CONFIGS ? candidate : null;
}

export interface CompetitorComparisonPageProps {
  competitor: CompetitorKey | 'alternatives';
}

export default function CompetitorComparisonPage({ competitor }: CompetitorComparisonPageProps) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [competitor]);

  const content = useMemo(() => {
    if (competitor === 'alternatives') return <AlternativesIndexView />;
    return <ComparisonView config={COMPETITOR_CONFIGS[competitor]} />;
  }, [competitor]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0b1120', color: '#e2e8f0' }}>
      {content}
    </Box>
  );
}
