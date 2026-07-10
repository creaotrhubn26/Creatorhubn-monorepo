/**
 * leadgrid-feltsalg-salgsteam.tsx
 *
 * GEO-innholdsside for Leadgrids enterprise-segment (tiltaksplanen
 * docs/integration-audit/09 — Daniels presisering: Leadgrid er for små
 * OG store bedrifter). Retter seg mot salgssjefer/salgsdirektører:
 * territorie-styring, salgsledelse, prognoser, norsk alternativ til
 * SuperOffice for utegående salg. Article + FAQPage JSON-LD.
 * Offentlig side — krever ikke auth.
 */

import { Box, Container, Stack, Typography } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

type FaqItem = { q: string; a: string };

const FAQ: FaqItem[] = [
  {
    q: 'Hvordan styrer jeg territorier for et utegående salgsteam?',
    a: 'I Leadgrid tegner salgssjefen territorier direkte på kartet og tildeler dem til selgere eller team. Hver selger ser kun sine leads og sin rute, teamleder følger sitt team, og salgsledelsen ser hele bildet — med automatisk varsling når territorier endres.',
  },
  {
    q: 'Finnes det et norsk alternativ til SuperOffice for feltsalg?',
    a: 'Ja — Leadgrid. Der SuperOffice er et kontor-CRM, er Leadgrid bygget for felt: leads som pins på kart, ruteplanlegging, native iPad-/iPhone-/Apple Watch-apper for registrering hos kunden, og norske datakilder (Brønnøysundregistrene, SSB, Kartverket) for å finne nye leads — ikke bare administrere eksisterende.',
  },
  {
    q: 'Hvordan får salgsledelsen oversikt uten å mase på selgerne om rapportering?',
    a: 'Rapporteringen skjer som biprodukt av arbeidet: når selgeren registrerer besøket fra mobilen, oppdateres pipeline, prognoser og won/lost-statistikk automatisk. Salgsledelsen får ukentlige PDF-rapporter på e-post og live dashboards — uten at noen fyller ut regneark på fredager.',
  },
  {
    q: 'Kan vi se hvilke bransjer og områder som faktisk konverterer?',
    a: 'Ja. Won/lost-analysen bryter ned konverteringsrate per bransje (NACE), område og selger — så neste kampanje og territorie-fordeling bygger på faktiske tall, ikke magefølelse. SSB-demografi per kommune (befolkning, inntekt) ligger inne som kontekst.',
  },
  {
    q: 'Hvordan kommer nye leads inn til teamet?',
    a: 'AI-drevet markedsskann finner bedrifter via Brønnøysundregistrene og Google Places ut fra bransje og område, og plotter dem rett i riktig territorium. Salgssjef kan også kjøre målrettede kampanjer (bransje + område + mål) som teamet jobber ned med automatisk pipeline-sporing.',
  },
  {
    q: 'Hvordan onboardes et team, og hva med tilgangsstyring?',
    a: 'Organisasjonen administrerer roller (salgssjef, teamleder, selger) med tilgang scopet til team og territorium. GDPR: data lagres i EU/EØS med databehandler-avtale. Prising per organisasjon (Agency-nivå for team) — se /leadgrid/priser.',
  },
];

const CAPABILITIES = [
  'Territorier tegnet på kart, tildelt per selger/team — med konfliktvarsling',
  'Ruteplanlegging med reise-ETA for effektive felt-dager',
  'Native iPad-, iPhone- og Apple Watch-apper — registrering hos kunden, ikke på kontoret',
  'Prognoser og pipeline-verdi per team, territorium og periode',
  'Won/lost-analyse per bransje, område og selger',
  'Ukentlige PDF-rapporter til salgsledelsen automatisk på e-post',
  'AI lead-discovery med Brønnøysund/SSB/Kartverket innebygd',
  'Roller og tilgangsstyring: salgssjef, teamleder, selger',
];

export function LeadgridFeltsalgSalgsteamPage() {
  return (
    <Box
      component="article"
      sx={{
        width: '100%',
        minHeight: '100vh',
        bgcolor: '#0a0512',
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
            headline: 'Feltsalg for salgsteam: territorier, ruter og salgsledelse på kart',
            description:
              'For salgssjefer i norske organisasjoner med utegående salg: territorie-styring, prognoser, won/lost-analyse og native felt-apper. Norsk alternativ til SuperOffice/Pipedrive for feltsalg.',
            author: { '@type': 'Organization', name: 'Leadgrid (Creatorhub AS)' },
            publisher: {
              '@type': 'Organization',
              name: 'Leadgrid',
              logo: { '@type': 'ImageObject', url: 'https://leadgrid.no/leadgrid/leadgrid-logo.png' },
            },
            mainEntityOfPage: 'https://leadgrid.no/leadgrid/feltsalg-for-salgsteam',
            inLanguage: 'no',
            datePublished: '2026-07-10',
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            inLanguage: 'no',
            mainEntity: FAQ.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />

      <Container maxWidth="md">
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <MapIcon sx={{ color: '#a78bfa' }} />
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
              For salgsteam og større organisasjoner
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Feltsalg med territorier, ruter og salgsledelse — på ett kart
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.7 }}
          >
            Leadgrid er bygget for norske salgsorganisasjoner med utegående salg:
            salgssjefen styrer territorier og prognoser, teamlederne følger sine team,
            og selgerne registrerer besøk fra iPad, iPhone eller Apple Watch — hos
            kunden. Rapporteringen skriver seg selv.
          </Typography>
        </Stack>

        <Box sx={{ mb: 5 }}>
          <Typography
            component="h2"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' }, mb: 2.5 }}
          >
            Hva salgsledelsen får
          </Typography>
          <Stack spacing={1.5}>
            {CAPABILITIES.map((cap) => (
              <Stack key={cap} direction="row" spacing={1.25} alignItems="flex-start">
                <CheckCircleIcon sx={{ color: '#9be15d', fontSize: 20, mt: 0.3 }} />
                <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.98rem', lineHeight: 1.6 }}>
                  {cap}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Box sx={{ mb: 5 }}>
          <Typography
            component="h2"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' }, mb: 2.5 }}
          >
            Vanlige spørsmål
          </Typography>
          <Stack spacing={2.5}>
            {FAQ.map((f) => (
              <Box key={f.q}>
                <Typography component="h3" sx={{ color: '#a78bfa', fontWeight: 700, fontSize: '1.05rem', mb: 0.5 }}>
                  {f.q}
                </Typography>
                <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.95rem', lineHeight: 1.65 }}>
                  {f.a}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Box
            component="a"
            href="/leadgrid/priser"
            sx={{
              flex: 1, display: 'block', p: 2.5, borderRadius: 2,
              bgcolor: 'rgba(155,225,93,0.08)', border: '1px solid rgba(155,225,93,0.3)',
              textDecoration: 'none', '&:hover': { bgcolor: 'rgba(155,225,93,0.14)' },
            }}
          >
            <Typography sx={{ color: '#9be15d', fontWeight: 800, fontSize: '1.05rem', mb: 0.5 }}>
              Priser for team → /leadgrid/priser
            </Typography>
            <Typography sx={{ color: 'rgba(229,231,235,0.82)', fontSize: '0.92rem' }}>
              Solo Pro og Agency — per organisasjon.
            </Typography>
          </Box>
          <Box
            component="a"
            href="/leadgrid/skaffe-leads-guide"
            sx={{
              flex: 1, display: 'block', p: 2.5, borderRadius: 2,
              bgcolor: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)',
              textDecoration: 'none', '&:hover': { bgcolor: 'rgba(167,139,250,0.14)' },
            }}
          >
            <Typography sx={{ color: '#c4b5fd', fontWeight: 800, fontSize: '1.05rem', mb: 0.5 }}>
              Liten bedrift? → /leadgrid/skaffe-leads-guide
            </Typography>
            <Typography sx={{ color: 'rgba(229,231,235,0.82)', fontSize: '0.92rem' }}>
              Egen lead-generering uten dyre annonser.
            </Typography>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

export default LeadgridFeltsalgSalgsteamPage;
