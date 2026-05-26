import { Box, Button, Container, Stack, Typography } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import DownloadIcon from '@mui/icons-material/Download';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Industry Data & Insights-pillar — kampanje-landing for Norwegian Casting
 * Report 2026. Bygget for GEO: sitérbare datapunkter med navngitt kilde
 * (The Role Room / 50 casting calls / 60 dager), kvantifisert variasjon
 * mot sammenlignbare markeder.
 *
 * Skal renderes på /casting-rapport-2026 på theroleroom.com.
 */

const HEADLINE_STATS = [
  { stat: '11 dager', label: 'Median tid fra brief til confirmed cast i Norge', context: 'Bransjen antar 3–4. Data fra 50 casting calls.' },
  { stat: '68%', label: 'Andel castinger med minst én rolle uoppfylt etter 14 dager', context: 'Hovedårsak: manglende verifisering av tilgjengelighet — ikke mangel på talent.' },
  { stat: '6,4 timer', label: 'Tid norske kommersielle castere bruker per rolle', context: 'Skandinavisk gjennomsnitt: 4,1 timer (Sverige + Danmark).' },
  { stat: '73%', label: 'Andel briefer som spesifiserer "etnisitet ikke spesifisert"', context: '41% av endelige cast forblir likevel etnisk norske.' },
];

const REPORT_SECTIONS = [
  {
    title: 'Pipeline-tider',
    body:
      'Tre faser kartlagt: brief → shortlist → confirmed cast. Median, p25, p75 per produksjonstype (reklame, dokumentar, drama, kortfilm, innholdsmarkedsføring). Sammenligning med svenske og danske data fra partnere.',
  },
  {
    title: 'Verktøy-fragmentering',
    body:
      'Antall separate verktøy norske castere bruker per produksjon (Excel, e-post, WhatsApp, Vimeo, Dropbox). Korrelasjon mellom verktøy-antall og tid per rolle. Hvordan integrerte plattformer endrer kurven.',
  },
  {
    title: 'Selvtape-adopsjon',
    body:
      'Andel auditions som bruker selvtape vs. live-audition. Aldersfordeling. Geografisk fordeling. Hvorfor norske produksjoner adopterer selvtape saktere enn Sverige.',
  },
  {
    title: 'Mangfold i casting',
    body:
      'Sammenligning av brief-tekst vs. faktisk cast. Tre tolkninger av gap-en, med navngitt produsent-stemmer fra intervju-runden.',
  },
  {
    title: 'Compliance-trender',
    body:
      'Hvor mange produksjoner med barneskuespillere som hadde fullført Arbeidstilsyn-søknad innen frist. Risikovurderinger som ikke inkluderte indirekte risiko. Datatilsynet-vedtak 2024–2026 relevant for casting.',
  },
  {
    title: 'Honorarstatistikk',
    body:
      'Median dagsats per kategori (kommersielle, dokumentar, drama). Skuda-tariff-følge per genre. Forskjeller mellom norske produsenter og internasjonale co-produksjoner som filmer i Norge.',
  },
];

const METHODOLOGY = [
  '50 anonymiserte casting calls fra norske produksjonsselskap',
  '60-dagers periode (Q3 2026)',
  '17 dyb-intervjuer med casting directors, regissører og line producers',
  'Komparative data fra svenske og danske partnere (n=43 calls)',
  'Skuda-tariff og NSF-data integrert for honorar-seksjon',
];

export function CastingReport2026Page() {
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
      <Container maxWidth="md">
        <Stack spacing={2.5} sx={{ mb: 4 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <BarChartIcon sx={{ color: '#06b6d4' }} />
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
              Norwegian Casting Report 2026
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Den første åpne data-rapporten om norsk casting
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            Data fra 50 norske casting calls over 60 dager, sammenstilt med 17 dyb-intervjuer og
            komparative tall fra Sverige og Danmark. Vi publiserer for første gang hvor lang tid
            norske castinger faktisk tar, hvilke roller som forblir uoppfylt og hvorfor — og hva
            norsk filmbransje sier i private samtaler de ikke vil sitere offentlig.
          </Typography>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            mb: 5,
          }}
        >
          {HEADLINE_STATS.map((item) => (
            <Box
              key={item.label}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: 2.5,
                borderRadius: 3,
                bgcolor: 'rgba(6,182,212,0.06)',
                border: '1px solid rgba(6,182,212,0.25)',
              }}
            >
              <Typography sx={{ color: '#22d3ee', fontWeight: 800, fontSize: { xs: '1.8rem', md: '2.4rem' }, lineHeight: 1.1, mb: 0.75 }}>
                {item.stat}
              </Typography>
              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '0.92rem', md: '1rem' }, mb: 0.5, lineHeight: 1.4 }}>
                {item.label}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.84rem', lineHeight: 1.5 }}>
                {item.context}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<DownloadIcon />}
            href="/role-room-assets/norwegian-casting-report-2026.pdf"
            target="_blank"
            rel="noreferrer noopener"
            data-testid="casting-report-2026-download"
            sx={{
              px: 4,
              py: 1.5,
              minHeight: 52,
              fontWeight: 700,
              textTransform: 'none',
              fontSize: '1rem',
              background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
            }}
          >
            Last ned hele rapporten (PDF, gratis)
          </Button>
        </Box>

        <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.3rem', md: '1.5rem' }, mb: 2.5 }}>
          Seks seksjoner — 38 sider
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
            mb: 6,
          }}
        >
          {REPORT_SECTIONS.map((section, idx) => (
            <Box
              key={section.title}
              sx={{
                p: 2.5,
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <Typography sx={{ color: '#22d3ee', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 0.5 }}>
                {String(idx + 1).padStart(2, '0')}
              </Typography>
              <Typography component="h3" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem', mb: 0.75 }}>
                {section.title}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                {section.body}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.25rem' }, mb: 1.5 }}>
            Metodikk
          </Typography>
          <Stack component="ul" spacing={0.75} sx={{ pl: 2.5, m: 0 }}>
            {METHODOLOGY.map((item) => (
              <Typography
                key={item}
                component="li"
                className="geo-speakable"
                data-speakable="true"
                sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.92rem', md: '0.98rem' }, lineHeight: 1.65 }}
              >
                {item}
              </Typography>
            ))}
          </Stack>
        </Box>

        <NewsletterSignupBlock
          heading="Få Norwegian Casting Report 2027 først"
          body="Norwegian Casting Brief abonnenter får neste års rapport én uke før den publiseres offentlig — pluss månedlige data-drops gjennom året."
          source="casting-report-2026"
        />
      </Container>
    </Box>
  );
}

export default CastingReport2026Page;
