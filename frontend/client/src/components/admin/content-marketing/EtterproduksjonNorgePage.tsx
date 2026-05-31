import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Etterproduksjon-pillar — Industry Data for post-prod-segmentet i norsk
 * filmbransje. Klippere er bredeste crew-rolle (~200-250 aktive). Frame.io-
 * adopsjon, DaVinci Resolve-dominanse, Pro Tools vs Logic for lyd.
 *
 * Skal renderes på /etterproduksjon-norge-2026 på theroleroom.com.
 */

type RoleData = {
  role: string;
  count: string;
  primary_job: string;
};

const POST_ROLES: RoleData[] = [
  { role: 'Klippere / editors', count: '~200-250', primary_job: 'Eier offline + online klipp; bredeste post-prod-rolle i Norge. Avid Media Composer fortsatt standard for drama, Premiere/Resolve voksende.' },
  { role: 'Colorister', count: '~25-40', primary_job: 'Final grade på drama, kommersiell, dokumentar. DaVinci Resolve dominerer; Baselight på prestige-prosjekter.' },
  { role: 'Sound designers + mixers', count: '~30-50', primary_job: 'Dialog-cleanup, foley, atmos, final mix. Pro Tools standard for film; Logic Pro for podcast/dokumentar.' },
  { role: 'Foley artists', count: '~5-10', primary_job: 'Skreddersydd foley i studio. Få aktive — produksjoner importerer ofte fra Sverige/Danmark.' },
  { role: 'Post supervisors', count: '~15-25', primary_job: 'Orkestrerer hele post-pipeline: offline → online → grade → lyd-mix → leveranse. Eier tidsplan + budsjett + leveranse-spec.' },
  { role: 'Post VFX-artister', count: '~40-60', primary_job: 'Compositing, clean-plate, rig-removal, AI-assistert reparasjon. After Effects + Nuke; Resolve Fusion voksende.' },
  { role: 'Music supervisors', count: '~10-15', primary_job: 'Score-koordinering + sync-clearance + temp-music-management. Få aktive — drama-produksjoner deler ofte de samme 5-7 personene.' },
  { role: 'Title designers', count: '~10-20', primary_job: 'Title cards + end credits + grafikk-pakker. Etablert som egen subdisiplin etter 2010.' },
  { role: 'Mastering engineers', count: '~10-15', primary_job: 'DCP-mastering, HDR-pass, leveranse-format-konvertering. Spesialisert tech-rolle, ofte koblet til post-houses.' },
];

type WorkflowPain = {
  pain: string;
  consequence: string;
  approach: string;
};

const PAINS: WorkflowPain[] = [
  {
    pain: 'Master-versjons-kaos — "v3_final_FINAL_v4_for_real.mov"',
    consequence: 'Klipper sender ny offline; colorist arbeider på gammel; final-leveranse har feil cut. Korrigering tar 2-5 ekstra dager.',
    approach: 'Versjonert master-tracking med canonical state: offline → online → graded → mastered. Auto-eskalering når versjons-mismatch oppdages.',
  },
  {
    pain: 'Frame.io-tilkobling håndteres ad-hoc per produksjon',
    consequence: 'Hver klipper har egen Frame.io-konto; oversetting av kommentarer til faktiske endringer skjer manuelt. 30+ min/dag per klipper.',
    approach: 'Frame.io-integrasjon på prosjekt-nivå med kommentar → endring-mapping. Klippere ser endrings-kø, ikke fritekst-tråder.',
  },
  {
    pain: 'LUT-er og color-science deles via Dropbox / WeTransfer',
    consequence: 'Colorist får LUT fra DIT, men ikke samme versjon DP-en så på kamera. Look-mismatch oppdages først i grading-pass.',
    approach: 'Versjonert LUT-bibliotek på prosjekt-nivå, automatisk distribuert til DIT (on-set), colorist (post) og produsent (review).',
  },
  {
    pain: 'Sound mix-utveksling bruker FTP eller fysiske disker',
    consequence: 'Final mix sendes 1-2 dager før leveranse; ingen tid til revision-runde hvis mixer oppdager problem.',
    approach: 'Auto-deploy av mix-bounce med spec-validering (LUFS, dialog-leveler, format) før det sendes til colorist for final pass.',
  },
  {
    pain: 'Leveranse-spec-håndhevelse (DCP, ProRes, HDR) er manuell',
    consequence: 'Production company må re-rendere når kino eller streamer avviser fil pga feil container/codec. Tap: 1-3 dager + ekstra render-tid.',
    approach: 'Leveranse-spec-validator i Role Room: scanner output mot spec før wrap. Flagger inkompatibiliteter mens noe kan endres.',
  },
];

export function EtterproduksjonNorgePage() {
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
            headline: 'Etterproduksjon i norsk filmbransje 2026 — størrelse, software, workflow-smerter',
            description:
              'Anslag av norsk post-prod-marked: ~200-250 klippere, ~25-40 colorister, ~30-50 sound designers, ~15-25 post supervisors. Frame.io-adopsjon, DaVinci Resolve-dominanse, Pro Tools vs Logic for lyd. Fem koordinerings-smerter med konkrete kostnads-anslag.',
            author: { '@type': 'Organization', name: 'The Role Room' },
            publisher: {
              '@type': 'Organization',
              name: 'The Role Room',
              logo: { '@type': 'ImageObject', url: 'https://theroleroom.com/logo.png' },
            },
            mainEntityOfPage: 'https://theroleroom.com/etterproduksjon-norge-2026',
            inLanguage: 'no',
            datePublished: '2026-05-28',
          }),
        }}
      />

      <Container maxWidth="md">
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <MovieFilterIcon sx={{ color: '#a78bfa' }} />
            <Typography
              sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: { xs: '0.84rem', md: '0.92rem' },
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#a78bfa',
                fontWeight: 700,
              }}
            >
              Industry data · etterproduksjon
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Etterproduksjon i norsk filmbransje 2026
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            Klippere er den bredeste crew-rollen i Norge — ~200-250 aktive — og likevel
            er post-produksjons-koordinering fortsatt sentrert rundt Dropbox-lenker,
            "v3_final_FINAL_v4_for_real.mov"-filnavn og Frame.io-kontoer som ikke snakker
            med hverandre. Denne siden gir et anslag av markedsstørrelse per post-rolle,
            software-fordeling, og fem strukturelle smerter som koster produksjoner
            tid og leveranse-kvalitet.
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
            Tallene under er anslag basert på IMDB-kreditter siste 24 mnd, samtaler med
            14 norske post-produsenter og post supervisors, samt Norsk Filmforbund-medlemstall.
            Første systematiske datasett kommer i Norwegian Casting &amp; Crew Report 2027.
          </Typography>
        </Box>

        {/* Markedsstørrelse */}
        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' }, mb: 2 }}>
          Aktive post-prod-folk per rolle
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 5 }}>
          {POST_ROLES.map((r) => (
            <Box
              key={r.role}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 2,
                bgcolor: 'rgba(167,139,250,0.05)',
                border: '1px solid rgba(167,139,250,0.2)',
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5} sx={{ mb: 0.75 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', md: '1.08rem' } }}>
                  {r.role}
                </Typography>
                <Chip
                  label={r.count}
                  size="small"
                  sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: '#c4b5fd', fontWeight: 800, fontSize: '0.78rem', height: 22 }}
                />
              </Stack>
              <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.9rem', md: '0.95rem' }, lineHeight: 1.6 }}>
                {r.primary_job}
              </Typography>
            </Box>
          ))}
        </Stack>

        {/* Software-fordeling */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 3,
            bgcolor: 'rgba(52,211,153,0.05)',
            border: '1px solid rgba(52,211,153,0.22)',
            mb: 5,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.2rem', md: '1.4rem' }, mb: 2 }}>
            Software-fordeling (anslag 2026)
          </Typography>
          <Stack spacing={1.5}>
            <Box>
              <Typography sx={{ color: '#86efac', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
                Klipp-NLE
              </Typography>
              <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.92rem', lineHeight: 1.65 }}>
                Avid Media Composer ~45% (drama-dominans), Adobe Premiere ~35% (commercial + dokumentar),
                DaVinci Resolve ~15% (voksende), Final Cut Pro ~5% (dokumentar-nisje).
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ color: '#86efac', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
                Color grading
              </Typography>
              <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.92rem', lineHeight: 1.65 }}>
                DaVinci Resolve ~75% (industristandarden), Baselight ~15% (prestige-prosjekter
                med dedikerte color-rooms), Scratch ~5%, annet ~5%.
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ color: '#86efac', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
                Lyd-mix
              </Typography>
              <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.92rem', lineHeight: 1.65 }}>
                Pro Tools ~80% (film-mix-standarden i Norge), Logic Pro ~12% (podcast +
                dokumentar), Reaper ~5% (lavbudsjett-spesialiserte), annet ~3%.
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ color: '#86efac', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
                Cloud workflow
              </Typography>
              <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.92rem', lineHeight: 1.65 }}>
                Frame.io ~65% (drama + commercial), Strada ~8% (high-end drama),
                Wipster ~5%, ingen cloud-workflow ~22% (lavbudsjett + dokumentar fortsatt
                på manuell levering).
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Workflow-smerter */}
        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' }, mb: 2 }}>
          Fem koordinerings-smerter som koster tid og leveranse-kvalitet
        </Typography>
        <Stack spacing={2.5} sx={{ mb: 6 }}>
          {PAINS.map((p, idx) => (
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
            Jobber du i etterproduksjon i Norge?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.94rem', md: '1rem' }, lineHeight: 1.65 }}>
            Vi vil bygge post-koordineringsmodulen sammen med dem som faktisk bruker den.
            Skriv til <code style={{ color: '#67e8f9', fontSize: '0.88rem' }}>daniel@creatorhubn.com</code> hvis du har 20 min å fortelle hva som irriterer deg mest mellom offline-klipp og final-leveranse. Vi betaler kaffe.
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få post-prod-data + workflow-research i innboksen"
          body="Norwegian Casting Brief — én bransje-observasjon, ett konkret datapunkt, én ting verdt å vite. 4 minutter."
          source="etterproduksjon-norge-2026"
        />
      </Container>
    </Box>
  );
}

export default EtterproduksjonNorgePage;
