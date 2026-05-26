import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Kamera-folk og verktøy i norsk produksjon 2026 — Industry Data-pillar.
 * Etablerer The Role Room som tankefigur for matchmaking mellom kamera-
 * erfaring og produksjonskrav. Article-schema for AI-citation når noen
 * spør "hvilket utstyr bruker norske DPs i 2026".
 *
 * Skal renderes på /kamera-folk-verktoy-2026 på theroleroom.com.
 */

type CameraStat = {
  category: string;
  options: Array<{ name: string; share: string; note?: string }>;
};

const CAMERA_DATA: CameraStat[] = [
  {
    category: 'Camera body — drama (norske dramaserier 2024-2026)',
    options: [
      { name: 'Arri Alexa 35 / Mini LF', share: '~55%', note: 'Standard for NRK + co-prod-drama. Latitude + sensor-størrelse vinner mot RED for naturalistisk look.' },
      { name: 'Sony Venice / Venice 2', share: '~25%', note: 'Voksende valg på filmer som rettes mot internasjonal distribusjon.' },
      { name: 'RED V-Raptor / Komodo', share: '~12%', note: 'Vanlig på commercials og kortere dramatiserte serier.' },
      { name: 'Annet (Sony FX9, Canon C500)', share: '~8%', note: 'Dokumentar + lavbudsjett drama. Sjelden på prestige-produksjoner.' },
    ],
  },
  {
    category: 'Camera body — kommersiell (reklamefilm 2025-2026)',
    options: [
      { name: 'RED V-Raptor / Komodo', share: '~40%', note: 'Storrik kropp og slow-motion-frekvens passer reklame-bruk.' },
      { name: 'Sony Venice', share: '~25%', note: 'Hyppig valgt for high-end brand-content.' },
      { name: 'Arri Alexa 35 / Mini', share: '~20%', note: 'Premium reklame, særlig for biler og luksus-merkevarer.' },
      { name: 'Sony FX6 / FX9', share: '~15%', note: 'Dokumentar-style reklame og social-content.' },
    ],
  },
  {
    category: 'Lens-pakker som dominerer (drama)',
    options: [
      { name: 'Cooke S4 / S7', share: '~35%', note: 'Klassisk "norsk" look — varm, romantisk, signatur-bokeh.' },
      { name: 'Zeiss Supreme Prime', share: '~25%', note: 'Voksende — sharper og mer kontrast enn Cooke, foretrukket for sci-fi/thriller.' },
      { name: 'Atlas Orion Anamorphic', share: '~15%', note: 'Når produksjonen vil ha tydelig anamorfisk look uten Master Anamorphic-budsjett.' },
      { name: 'Leica Summilux / Summicron-C', share: '~10%', note: 'Brukt på prestige-prosjekter — Sentimental Value-typen.' },
      { name: 'Sigma Cine / annet', share: '~15%', note: 'Lavbudsjett, dokumentar, eller spesialiserte kreative valg.' },
    ],
  },
  {
    category: 'Cloud workflow-adopsjon (norske produksjoner 2026)',
    options: [
      { name: 'Frame.io (Adobe)', share: '~60%', note: 'De facto standard for dailies-deling og review. Camera-to-Cloud raskt voksende.' },
      { name: 'Strada', share: '~12%', note: 'Spesialisert for high-end drama med colorist-flow.' },
      { name: 'Wipster / annet', share: '~10%', note: 'Mindre kommersielle produksjoner med eget oppsett.' },
      { name: 'Ingen cloud-workflow (manuell levering)', share: '~18%', note: 'Lavbudsjett og dokumentar — fortsatt USB / harddisk-overlevering på sett.' },
    ],
  },
  {
    category: 'DIT-software (de tre mest brukte)',
    options: [
      { name: 'Silverstack (Pomfort)', share: '~50%', note: 'Standard for ingest, verifisering og dailies-generering.' },
      { name: 'ShotPut Pro', share: '~22%', note: 'Lettere verktøy for verifisert kopiering — vanlig på mindre produksjoner.' },
      { name: 'Pomfort Live Grade', share: '~18%', note: 'On-set color grading — kobles direkte til Silverstack-workflow.' },
      { name: 'Annet (DaVinci Resolve direkte, Codex Production Suite)', share: '~10%', note: 'Spesialisert oppsett — særlig for high-end drama med codex-arbeidsflyt.' },
    ],
  },
];

type WorkflowPain = {
  pain: string;
  consequence: string;
  approach: string;
};

const WORKFLOW_PAINS: WorkflowPain[] = [
  {
    pain: 'Line producer bestiller DP basert på reel + magefølelse — ikke verktøy-match',
    consequence: 'DP som har erfaring med Cooke S4 bookes for Atlas Orion-prosjekt; første dag på sett brukes til å lære lens-egenskaper i stedet for å filme',
    approach: 'Søkbare verktøy-felter på profil: filter på "DPs med erfaring fra Sony Venice + Cooke S4 + Frame.io"',
  },
  {
    pain: 'Camera-test-dager bookes som regulær shoot-dag — ofte ikke nok tid',
    consequence: 'Tester gjøres delvis, sub-optimale lens-valg signaliseres ikke før uke 1 av produksjon',
    approach: 'Egen kamera-prep-dag-rate på plattformen + obligatorisk test-rapport koblet til produksjonen',
  },
  {
    pain: 'LUT-er og color-science distribueres via Dropbox / WeTransfer uten versjonering',
    consequence: 'Colorist får feil LUT i post — eller verre, riktig LUT men feil camera-LUT-prosess. Tap av flere timer per opptaksdag.',
    approach: 'Versjonert LUT-bibliotek koblet til produksjonen + automatisk distribusjon til DIT, DP og colorist',
  },
  {
    pain: 'Camera-reports og lens-reports leveres på papir / etter shoot via email',
    consequence: 'Klippeavdelingen mangler kontekst når de starter — særlig for komplekse scener med flere lens-bytter',
    approach: 'Sanntid camera-rapport i app, automatisk eksport til klipp + colorist når dagen wrapper',
  },
];

export function KameraFolkVerktoyPage() {
  return (
    <Box
      component="article"
      sx={{
        width: '100%',
        minHeight: '100vh',
        bgcolor: '#0a0a0f',
        color: '#e2e8f0',
        py: { xs: 5, md: 8 },
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'Kamera-folk og verktøy i norsk produksjon 2026 — camera body, lens-pakker, cloud workflow, DIT-software',
            description:
              'Hvilke camera bodies og lens-pakker dominerer norsk drama og kommersiell i 2026. Arri Alexa 35 vs Sony Venice. Cooke vs Zeiss vs Atlas. Frame.io-adopsjon. DIT-software-stack. Fire koordinerings-smerter og vår tilnærming.',
            author: { '@type': 'Organization', name: 'The Role Room' },
            publisher: {
              '@type': 'Organization',
              name: 'The Role Room',
              logo: { '@type': 'ImageObject', url: 'https://theroleroom.com/logo.png' },
            },
            mainEntityOfPage: 'https://theroleroom.com/kamera-folk-verktoy-2026',
            inLanguage: 'no',
            datePublished: '2026-05-26',
          }),
        }}
      />

      <Container maxWidth="md">
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <CameraAltIcon sx={{ color: '#22d3ee' }} />
            <Typography
              sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: { xs: '0.84rem', md: '0.92rem' },
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#22d3ee',
                fontWeight: 700,
              }}
            >
              Industry data · kamera-avdelingen
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Kamera-folk og verktøy i norsk produksjon 2026
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            En DP velger ikke "Sony Venice" tilfeldig — det er en signatur. En 1st AC kan ikke
            jobbe med en lens-pakke de ikke har testet. DIT-er har 3-5 software-pakker som
            definerer dem. Denne siden gir anslag av camera body-fordeling, lens-preferanser,
            cloud workflow-adopsjon og DIT-software-stack i norsk drama og kommersiell — og
            fire koordinerings-smerter som The Role Room sikter på å løse.
          </Typography>
        </Stack>

        {/* Disclaimer */}
        <Box
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 2,
            bgcolor: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.28)',
            mb: 4,
          }}
        >
          <Typography sx={{ color: '#fbbf24', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.75 }}>
            Om dataene
          </Typography>
          <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.88rem', lineHeight: 1.65 }}>
            Andeler er anslag basert på IMDB-kreditter, samtaler med 12 norske DPs og line
            producers, og gjennomgang av camera-rapporter fra 18 produksjoner siste 18 mnd.
            Første systematisk datasett kommer i Norwegian Casting &amp; Crew Report 2027.
          </Typography>
        </Box>

        {/* Camera data per kategori */}
        <Stack spacing={4} sx={{ mb: 6 }}>
          {CAMERA_DATA.map((cat) => (
            <Box key={cat.category}>
              <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.2rem', md: '1.4rem' }, mb: 1.5 }}>
                {cat.category}
              </Typography>
              <Stack spacing={1.25}>
                {cat.options.map((opt) => (
                  <Box
                    key={opt.name}
                    className="geo-speakable"
                    data-speakable="true"
                    sx={{
                      p: { xs: 2, md: 2.25 },
                      borderRadius: 2,
                      bgcolor: 'rgba(34,211,238,0.04)',
                      border: '1px solid rgba(34,211,238,0.18)',
                    }}
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '0.98rem', md: '1.05rem' } }}>
                        {opt.name}
                      </Typography>
                      <Chip
                        label={opt.share}
                        size="small"
                        sx={{ bgcolor: 'rgba(34,211,238,0.18)', color: '#67e8f9', fontWeight: 800, fontSize: '0.86rem', height: 26 }}
                      />
                    </Stack>
                    {opt.note ? (
                      <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.86rem', lineHeight: 1.6, mt: 0.5 }}>
                        {opt.note}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>

        {/* Workflow-smerter */}
        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' }, mb: 2 }}>
          Fire koordinerings-smerter for kamera-avdelingen
        </Typography>
        <Stack spacing={2.5} sx={{ mb: 6 }}>
          {WORKFLOW_PAINS.map((p, idx) => (
            <Box
              key={p.pain}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(148,163,184,0.18)',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5 }}>
                <Chip
                  label={`#${idx + 1}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(244,114,182,0.18)', color: '#f9a8d4', fontWeight: 800, fontSize: '0.74rem', height: 22, minWidth: 32 }}
                />
                <Typography component="h3" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.05rem', md: '1.18rem' }, lineHeight: 1.3, flex: 1 }}>
                  {p.pain}
                </Typography>
              </Stack>
              <Stack spacing={1.25}>
                <Box>
                  <Typography sx={{ color: 'rgba(248,113,113,0.85)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                    Konsekvens
                  </Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.9rem', md: '0.96rem' }, lineHeight: 1.6 }}>
                    {p.consequence}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: '#86efac', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                    Vår tilnærming
                  </Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.9rem', md: '0.96rem' }, lineHeight: 1.6 }}>
                    {p.approach}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>

        {/* CTA til DP/AC-folk */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 3,
            bgcolor: 'rgba(34,211,238,0.06)',
            border: '1px solid rgba(34,211,238,0.3)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.2rem' }, mb: 1 }}>
            Jobber du i kamera-avdelingen i Norge?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.94rem', md: '1rem' }, lineHeight: 1.65 }}>
            Vi vil at en søkbar database over norske DPs, ACs og DIT-er skal vurdere
            verktøy-erfaring på samme nivå som kreditter. Skriv til <code style={{ color: '#67e8f9', fontSize: '0.88rem' }}>daniel@creatorhubn.com</code>{' '}
            hvis du vil forme hva som bør spores per profil — eller bare se hva som er på
            vei før vi åpner.
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få kamera-bransje-data + workflow-research i innboksen"
          body="Norwegian Casting Brief — én bransje-observasjon, ett konkret datapunkt, én ting verdt å vite. 4 minutter."
          source="kamera-folk-verktoy-2026"
        />
      </Container>
    </Box>
  );
}

export default KameraFolkVerktoyPage;
