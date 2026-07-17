/**
 * leadgrid-akademi-samarbeid-salg-marked.tsx
 *
 * Akademi-artikkel: salg/marked-samarbeid i norske B2B-selskaper.
 * Alle tall har navngitt kilde (B2B-rapporten fra Inbound/MFO/Norstat;
 * Edelman-LinkedIn B2B Thought Leadership Impact Report 2024) — ingen
 * selvrapporterte eller ukildede påstander (doc 13-prinsippet).
 */

import { Box, Container, Divider, Stack, Typography } from '@mui/material';
import HandshakeIcon from '@mui/icons-material/Handshake';

type FaqItem = { q: string; a: string };

const FAQ: FaqItem[] = [
  {
    q: 'Hvorfor krangler salg og marked i så mange B2B-selskaper?',
    a: 'Fordi de måles på hver sin del av samme løp: marked på leads og synlighet, salg på lukkede kontrakter. Uten felles definisjon av hva et kvalifisert lead er — og en felles pipeline begge kan se — blir overleveringen et friksjonspunkt i stedet for et stafettskifte.',
  },
  {
    q: 'Hva er det første konkrete steget for bedre samarbeid mellom salg og marked?',
    a: 'Bli enige om lead-definisjonen. Når begge avdelinger kan svare likt på «hva skal til før salg tar over?», forsvinner den vanligste konflikten. Deretter: felles tall — én pipeline, ett dashboard, samme virkelighetsbilde.',
  },
  {
    q: 'Fungerer thought leadership faktisk som salgskanal i B2B?',
    a: 'Ifølge Edelman-LinkedIn B2B Thought Leadership Impact Report 2024 (undersøkelse blant om lag 3 500 beslutningstakere i sju land) svarte 45 % av beslutningstakerne — og 48 % av topplederne — at et selskaps thought leadership direkte førte til at de tildelte selskapet forretning. Faglig innhold er med andre ord ikke pynt; det er dokumentert etterspørselsdriver.',
  },
  {
    q: 'Hvor mye utgjør godt samarbeid mellom salg og marked på resultatene?',
    a: 'B2B-rapporten (Inbound, med MFO og Norstat, basert på 650 norske B2B-selskaper) fant at 58 % av virksomheter der salg og marked samarbeider godt når ønskede resultater — mot bare 28 % der samarbeidet er dårlig. Forskjellen mellom de to gruppene er større enn effekten av de fleste enkeltverktøy.',
  },
];

export function LeadgridAkademiSamarbeidPage() {
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
            headline: 'Salg og marked som samarbeider: hva tallene faktisk sier',
            description:
              'B2B-rapporten (Inbound/MFO/Norstat, 650 norske selskaper): 58 % av virksomheter der salg og marked samarbeider godt når målene — mot 28 % der samarbeidet er dårlig.',
            author: { '@type': 'Organization', name: 'Leadgrid Akademi (Creatorhub AS)' },
            publisher: {
              '@type': 'Organization',
              name: 'Leadgrid',
              logo: { '@type': 'ImageObject', url: 'https://leadgrid.no/leadgrid/leadgrid-logo.png' },
            },
            mainEntityOfPage: 'https://leadgrid.no/akademi/samarbeid-salg-marked',
            inLanguage: 'no',
            datePublished: '2026-07-17',
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
        <Stack spacing={2.5} sx={{ mb: 4 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <HandshakeIcon sx={{ color: '#9be15d' }} />
            <Typography
              sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: { xs: '0.84rem', md: '0.92rem' },
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#9be15d',
                fontWeight: 700,
              }}
            >
              Akademi · B2B-salg
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Salg og marked som samarbeider: hva tallene faktisk sier
          </Typography>
        </Stack>

        <Stack spacing={3}>
          <Typography sx={{ fontSize: { xs: '1.02rem', md: '1.1rem' }, color: '#cbd5e1', lineHeight: 1.75 }}>
            Det finnes få tall i norsk B2B som er tydeligere enn dette: I B2B-rapporten —
            «Norges største undersøkelse om B2B-salg og -markedsføring», produsert av
            byrået Inbound sammen med Markedsføringsforeningen i Oslo og Norstat, basert
            på 650 norske B2B-selskaper — oppnår <strong>58 %</strong> av virksomhetene
            der salg og marked samarbeider godt de resultatene de ønsker seg.
            Der samarbeidet er dårlig, lykkes bare <strong>28 %</strong>.
          </Typography>

          <Typography sx={{ fontSize: { xs: '1.02rem', md: '1.1rem' }, color: '#cbd5e1', lineHeight: 1.75 }}>
            Det er mer enn en dobling — og forskjellen handler sjelden om budsjett eller
            verktøy. Den handler om tre ting de beste gjør systematisk:
          </Typography>

          <Stack spacing={2} component="ol" sx={{ pl: 3, m: 0 }}>
            {[
              ['Felles lead-definisjon', 'Begge avdelinger kan svare likt på «hva skal til før salg tar over?». Uten den definisjonen er hver overlevering en forhandling.'],
              ['Ett felles tallgrunnlag', 'Én pipeline begge ser, samme dashboard, samme virkelighetsbilde. Når salg og marked leser ulike rapporter, diskuterer de rapportene i stedet for kundene.'],
              ['Innhold som salgsverktøy', 'Markeds innhold brukes aktivt av selgerne i dialogen — ikke som pynt. Edelman-LinkedIn-rapporten 2024 (≈3 500 beslutningstakere, sju land) fant at 45 % av beslutningstakere og 48 % av toppledere har tildelt forretning direkte på grunn av et selskaps thought leadership.'],
            ].map(([title, body]) => (
              <Typography key={title} component="li" sx={{ color: '#cbd5e1', lineHeight: 1.7, fontSize: '1.02rem' }}>
                <strong style={{ color: '#fff' }}>{title}.</strong> {body}
              </Typography>
            ))}
          </Stack>

          <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />

          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.4rem', md: '1.6rem' } }}>
            Ofte stilte spørsmål
          </Typography>
          <Stack spacing={2.5}>
            {FAQ.map((f) => (
              <Box key={f.q}>
                <Typography component="h3" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem', mb: 0.75 }}>
                  {f.q}
                </Typography>
                <Typography sx={{ color: '#cbd5e1', lineHeight: 1.7, fontSize: '0.98rem' }}>{f.a}</Typography>
              </Box>
            ))}
          </Stack>

          <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />

          <Typography sx={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Kilder: B2B-rapporten (Inbound / Markedsføringsforeningen i Oslo / Norstat,
            650 norske B2B-selskaper); Edelman-LinkedIn B2B Thought Leadership Impact
            Report 2024 (~3 500 respondenter, sju land). Artikkelen er redaksjonell og
            utgis av Leadgrid Akademi (Creatorhub AS). Én felles pipeline for salg og
            marked er blant annet det Leadgrid bygger — det er avsenderens interesse,
            åpent deklarert.
          </Typography>

          <Typography sx={{ fontSize: '0.95rem' }}>
            <a href="/akademi" style={{ color: '#9be15d' }}>← Tilbake til Leadgrid Akademi</a>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

export default LeadgridAkademiSamarbeidPage;
