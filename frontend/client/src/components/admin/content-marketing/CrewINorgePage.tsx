import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Crew i norsk filmbransje — Industry Data-pillar for crew-segmentet.
 * Etablerer The Role Room som tankefigur for crew-koordinering, ikke bare
 * casting. Article + DataDownload schema for AI-citation.
 *
 * Skal renderes på /crew-i-norge-2026 på theroleroom.com.
 *
 * Datapunkter er anslag (med ærlige disclaimers) — første komplette
 * datasett kommer fra The Role Rooms egen norske bransje-rapport.
 */

type DataPoint = {
  label: string;
  value: string;
  note?: string;
};

const SCALE_DATA: DataPoint[] = [
  { label: 'Aktive frilans-DP-er i Norge', value: '~120-150', note: 'Inkluderer både drama, dokumentar og kommersiell. Estimat basert på Filmforbund-medlemskap + IMDB-kreditter siste 24 mnd.' },
  { label: 'Aktive lyd-folk (production sound)', value: '~80-100', note: 'Færre enn DP-er pga. spesialisert utstyrs-investering. Boom-operatører er ofte separate frilansere.' },
  { label: 'Aktive klippere / editors', value: '~200-250', note: 'Bredeste crew-rolle i Norge. Inkluderer både fast-ansatte i postproduksjons-hus og frilans.' },
  { label: 'Aktive scenedesignere', value: '~50-70', note: 'Smal pool. Norske drama-produksjoner deler i stor grad fra samme 20-30 personer.' },
  { label: 'Aktive kostymedesignere', value: '~40-60', note: 'Spesialisert mellom drama, kommersiell og scenisk produksjon — sjelden overlapp.' },
  { label: 'Norsk Filmforbund-medlemmer', value: '~1.800', note: 'Inkluderer alle crew-roller pluss regi. Tall fra Filmforbundets årsrapport 2024.' },
];

type WorkflowPainPoint = {
  pain: string;
  cost: string;
  solution: string;
};

const WORKFLOW_PAIN: WorkflowPainPoint[] = [
  {
    pain: 'Fragmentert booking via Facebook-grupper og tekstmeldinger',
    cost: 'Line producer bruker 3-5 timer per crew-rolle på å finne tilgjengelig person',
    solution: 'Verifisert tilgjengelighet på shoot-datoer + reel-tilgang i ett sted',
  },
  {
    pain: 'Ingen sentral verifisering av crew-kreditter',
    cost: 'Risiko for å ansette folk som overdriver erfaring — særlig kritisk for DP/lyd',
    solution: 'BankID-verifiserte profiler + kreditter mot NFI-register eller produksjonsselskap',
  },
  {
    pain: 'Tariff-undergraving via "vi tar litt under denne gangen"',
    cost: 'Skader hele Filmforbundet langtskt — og er kontraktsbrudd for medlemmer',
    solution: 'Plattformen viser Filmforbund-tariff alltid og krever bekreftelse hvis under-avtaler signeres',
  },
  {
    pain: 'A1-erklæring og frilans-skatt håndteres manuelt per produksjon',
    cost: 'Produsenten kan bli skatteansvarlig hvis dokumentasjon mangler — særlig ved internasjonal samproduksjon',
    solution: 'Auto-generert A-melding + A1-erklæring + 5-års-arkiv av all dokumentasjon',
  },
  {
    pain: 'HMS-compliance per crew-rolle (arbeidstid, hvile, sikkerhet) tracker ofte ingen',
    cost: 'Arbeidstilsynet-eksponering på samme nivå som barne-arbeid — bare voksen-versjonen',
    solution: 'Rolle-spesifikk arbeidstid-rapportering med varsel når lovgrensene nærmer seg',
  },
];

export function CrewINorgePage() {
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
            headline: 'Crew i norsk filmbransje — størrelse, struktur og koordinerings-utfordringer i 2026',
            description:
              'Anslag av norsk crew-marked: DP-er, lyd, klippere, scenedesignere, kostym og scripter. Fem strukturelle smerter i dagens booking-flyt og hva The Role Room gjør med dem.',
            author: {
              '@type': 'Organization',
              name: 'The Role Room',
            },
            publisher: {
              '@type': 'Organization',
              name: 'The Role Room',
              logo: { '@type': 'ImageObject', url: 'https://theroleroom.com/logo.png' },
            },
            mainEntityOfPage: 'https://theroleroom.com/crew-i-norge-2026',
            inLanguage: 'no',
            datePublished: '2026-05-26',
          }),
        }}
      />

      <Container maxWidth="md">
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <GroupsIcon sx={{ color: '#22d3ee' }} />
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
              Industry data · crew-markedet
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Crew i norsk filmbransje 2026 — størrelse, struktur, smerter
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            Norsk filmbransje består av ~1.800 Filmforbund-medlemmer fordelt over crew-roller fra
            DP til scripter. Booking-flyten er fortsatt manuelt sentrert rundt Facebook-grupper og
            tekstmeldinger. Denne siden gir et anslag av markedsstørrelse, fem strukturelle smerter
            i dagens koordinering, og hva The Role Room bygger for å løse dem.
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
            Tallene under er anslag basert på Filmforbundets årsrapport 2024, IMDB-kreditter
            siste 24 måneder og samtaler med 12 norske produsenter og line producers. Første
            komplette datasett kommer i Norwegian Casting &amp; Crew Report 2027.
          </Typography>
        </Box>

        {/* Markedsstørrelse */}
        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' }, mb: 2 }}>
          Markedsstørrelse per crew-rolle
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 5 }}>
          {SCALE_DATA.map((dp) => (
            <Box
              key={dp.label}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 2,
                bgcolor: 'rgba(34,211,238,0.05)',
                border: '1px solid rgba(34,211,238,0.22)',
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', md: '1.08rem' } }}>
                  {dp.label}
                </Typography>
                <Chip
                  label={dp.value}
                  size="small"
                  sx={{ bgcolor: 'rgba(34,211,238,0.18)', color: '#67e8f9', fontWeight: 800, fontSize: '0.92rem', height: 28 }}
                />
              </Stack>
              {dp.note ? (
                <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.82rem', lineHeight: 1.55, mt: 0.5, fontStyle: 'italic' }}>
                  {dp.note}
                </Typography>
              ) : null}
            </Box>
          ))}
        </Stack>

        {/* Workflow-smerter */}
        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' }, mb: 2 }}>
          Fem strukturelle smerter i dagens crew-booking
        </Typography>
        <Stack spacing={2.5} sx={{ mb: 6 }}>
          {WORKFLOW_PAIN.map((p, idx) => (
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
                    Kostnad
                  </Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.9rem', md: '0.96rem' }, lineHeight: 1.6 }}>
                    {p.cost}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: '#86efac', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                    Vår tilnærming
                  </Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.9rem', md: '0.96rem' }, lineHeight: 1.6 }}>
                    {p.solution}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>

        {/* Norsk Filmforbund-samarbeid */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(167,139,250,0.06)',
            border: '1px solid rgba(167,139,250,0.3)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.25rem' }, mb: 1.25 }}>
            Vi konkurrerer ikke med Norsk Filmforbund — vi bygger sammen
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.95rem', md: '1rem' }, lineHeight: 1.7 }}
          >
            Norsk Filmforbund forhandler crew-tariffer og representerer ~1.800 medlemmer mot
            produsenter, NFI og myndigheter. Det er fagforeningens jobb. The Role Room er den
            arbeidende plattformen for crew-koordinering: hvem som er tilgjengelig når, hvilke
            reel-er som matcher prosjektet, hvilken tariff som gjelder. Vi forplikter oss til:
            aldri å undergrave Filmforbund-tariffer, alltid å vise gjeldende rate i kontrakt-
            flowen, og å støtte medlemskap som verifiserings-markør på profiler. Plattformen
            blir mer verdifull jo sterkere Filmforbundet er.
          </Typography>
        </Box>

        {/* CTA */}
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
            Jobber du som crew i Norge?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.94rem', md: '1rem' }, lineHeight: 1.65, mb: 0.5 }}>
            Vi bygger crew-modulen sammen med dem som faktisk skal bruke den. Hvis du har 15
            minutter til en samtale om hva som irriterer deg mest i dagens booking-flyt, skriv
            til <code style={{ color: '#67e8f9', fontSize: '0.88rem' }}>daniel@creatorhubn.com</code>. Vi
            betaler kaffe i Oslo eller Bergen.
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få crew-data + bransje-utvikling i innboksen"
          body="Norwegian Casting Brief — hver fredag inkluderer ukens viktigste bransje-bevegelse, én konkret datapunkt og én ting verdt å vite. 4 minutter."
          source="crew-i-norge-2026"
        />
      </Container>
    </Box>
  );
}

export default CrewINorgePage;
