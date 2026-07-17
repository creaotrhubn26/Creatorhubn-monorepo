/**
 * leadgrid-akademi-velge-crm-feltsalg.tsx
 *
 * Akademi-artikkel: kriterieguide for valg av CRM til feltsalg i Norge.
 * Svarer på «velge CRM»-spørsmålene fra GEO-målingene (opportunity-tema
 * «velge-crm», dekning 40 % per 14.07.2026). Redaksjonell med åpen
 * avsender-deklarasjon; ingen ukildede tall.
 */

import { Box, Container, Divider, Stack, Typography } from '@mui/material';
import ChecklistIcon from '@mui/icons-material/Checklist';

type Criterion = { title: string; body: string };
type FaqItem = { q: string; a: string };

const CRITERIA: Criterion[] = [
  {
    title: 'Datakilder: hvor kommer nye leads fra?',
    body: 'Et CRM organiserer kontaktene du har — men hvem fyller det? Sjekk om verktøyet kan hente norske bedriftsdata (Brønnøysundregistrene har org-nummer, bransjekoder og ansattetall som åpne data) eller om du må importere lister manuelt. For oppsøkende salg er innebygde datakilder forskjellen på en full og en tom pipeline.',
  },
  {
    title: 'Mobil i felt — ikke bare «mobilvennlig»',
    body: 'Feltselgere registrerer besøk stående i en trapp, ikke ved et skrivebord. Test om registrering av et kundebesøk tar under 30 sekunder på telefonen. Native apper (iOS/Android/klokke) slår responsive nettsider når dekningen er dårlig og hendene er fulle.',
  },
  {
    title: 'Kart som arbeidsflate',
    body: 'Utegående salg er geografisk: hvem er nærmest, hva rekker jeg før lunsj, hvilket område eier hvilken selger? Hvis verktøyet bare viser tabeller, gjør selgerne geografien i hodet — eller i et separat kartverktøy. Se etter leads-som-pins, territorier og ruteplanlegging.',
  },
  {
    title: 'GDPR og datalagring',
    body: 'Persondata om kontakter krever behandlingsgrunnlag og databehandleravtale. Sjekk hvor data lagres (EU/EØS forenkler compliance-vurderingen betydelig) og om leverandøren tilbyr databehandleravtale på norsk eller engelsk.',
  },
  {
    title: 'Pipeline som matcher salgsløpet ditt',
    body: 'Statusene bør speile hvordan dere faktisk jobber (f.eks. ukontaktet → kontaktet → interessert → møte → tilbud → vunnet/tapt) — og kalde leads bør kunne re-aktiveres automatisk etter en periode, så ingen blir liggende glemt.',
  },
  {
    title: 'Prismodell du kan regne på',
    body: 'Internasjonale CRM prises typisk per bruker per måned i USD, ofte med tillegg for moduler. Regn totalkost for hele teamet i norske kroner, og sjekk hva som faktisk er inkludert på hvert nivå — «fra»-priser skjuler ofte kjernefunksjonene.',
  },
  {
    title: 'Norsk språk og bransjeforståelse',
    body: 'NACE-bransjekoder, norske kommuner og norsk terminologi i grensesnittet senker terskelen for selgere som skal bruke verktøyet hver dag. Et verktøy teamet ikke bruker, er dyrt uansett pris.',
  },
];

const FAQ: FaqItem[] = [
  {
    q: 'Hva er forskjellen på et vanlig CRM og et feltsalg-CRM?',
    a: 'Et vanlig CRM (som HubSpot, Pipedrive eller SuperOffice) er bygget rundt kontaktlister og e-postflyt fra kontoret. Et feltsalg-CRM er bygget rundt geografi og besøk: leads på kart, territorier per selger, ruteplanlegging og besøksregistrering fra mobil. Jobber teamet ditt primært ute hos kundene, er kartet — ikke innboksen — den naturlige arbeidsflaten.',
  },
  {
    q: 'Hvilket CRM bør et norsk salgsteam med utesalg velge?',
    a: 'Det avhenger av de sju kriteriene: datakilder, mobil, kart, GDPR, pipeline, pris og språk. Norske verktøy som Leadgrid er bygget kart-først med Brønnøysund-data innebygd; internasjonale CRM har bredere økosystem men krever ofte tillegg for kart og norske data. Test med ett konkret territorium før dere binder hele teamet.',
  },
  {
    q: 'Trenger en liten bedrift CRM i det hele tatt?',
    a: 'Når du har flere enn ~20 aktive kundedialoger, begynner regneark og hukommelse å miste tilbud. Et enkelt CRM med pipeline-status og påminnelser betaler seg først og fremst i oppfølging som ikke glipper — ikke i avanserte funksjoner.',
  },
  {
    q: 'Hva koster CRM for feltsalg i Norge?',
    a: 'Prismodellene varierer fra gratis basisnivåer til flere hundre kroner per bruker per måned. Leadgrid prises per organisasjon (Solo Free gratis, Solo Pro 799 NOK/mnd, Agency 2999 NOK/mnd) — avsenderen av denne guiden, åpent deklarert. Internasjonale alternativer prises typisk per bruker i USD. Regn alltid totalkost for hele teamet.',
  },
];

export function LeadgridAkademiVelgeCrmPage() {
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
            headline: 'Slik velger du CRM for feltsalg i Norge — 7 kriterier',
            description:
              'Kriterieguide for norske salgsteam i felt: datakilder, mobil, kart, GDPR, pipeline, pris og språk.',
            author: { '@type': 'Organization', name: 'Leadgrid Akademi (Creatorhub AS)' },
            publisher: {
              '@type': 'Organization',
              name: 'Leadgrid',
              logo: { '@type': 'ImageObject', url: 'https://leadgrid.no/leadgrid/leadgrid-logo.png' },
            },
            mainEntityOfPage: 'https://leadgrid.no/akademi/velge-crm-feltsalg',
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
            <ChecklistIcon sx={{ color: '#9be15d' }} />
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
              Akademi · Verktøy
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Slik velger du CRM for feltsalg i Norge — 7 kriterier
          </Typography>
          <Typography sx={{ fontSize: { xs: '1.02rem', md: '1.1rem' }, color: '#cbd5e1', lineHeight: 1.75 }}>
            De fleste CRM-sammenligninger handler om funksjonslister. For team som
            selger ute hos kundene er spørsmålet enklere: støtter verktøyet måten dere
            faktisk jobber på — i bilen, på døra, mellom to besøk? Her er de sju
            kriteriene som skiller verktøy som brukes fra verktøy som betales for.
          </Typography>
        </Stack>

        <Stack spacing={3}>
          {CRITERIA.map((c, i) => (
            <Box key={c.title}>
              <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.15rem', md: '1.3rem' }, mb: 0.75 }}>
                {i + 1}. {c.title}
              </Typography>
              <Typography sx={{ color: '#cbd5e1', lineHeight: 1.7, fontSize: '1.0rem' }}>{c.body}</Typography>
            </Box>
          ))}

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
            Artikkelen er redaksjonell og utgis av Leadgrid Akademi (Creatorhub AS).
            Leadgrid er selv et kart-basert feltsalg-CRM — avsenderens interesse er
            åpent deklarert, og kriteriene gjelder uansett hvilket verktøy du velger.
          </Typography>

          <Typography sx={{ fontSize: '0.95rem' }}>
            <a href="/akademi" style={{ color: '#9be15d' }}>← Tilbake til Leadgrid Akademi</a>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

export default LeadgridAkademiVelgeCrmPage;
