import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * /innholdsprodusent-norge — vertikal-pillar for innholdsprodusent-løsningen
 * (495 kr/sete). Treffer den enkelte frilans-innholdsprodusenten som
 * jongler med 4-8 klienter, ads + content + publisering på tvers av
 * Meta/Google/LinkedIn/TikTok.
 *
 * Basert på THE-ROLE-ROOM-PRODUKTDOKUMENTASJON.md sektion 2.4.
 */

type PainPoint = {
  smerte: string;
  konsekvens: string;
  losning: string;
};

const PAINS: PainPoint[] = [
  {
    smerte: 'Hopper mellom 6-8 verktøy per dag (Meta, Google, TikTok, Notion, Slack, e-post)',
    konsekvens: 'Konteksttap. 30-45 min/dag går til å finne ut hva som er status på en kampanje før du gjør noe annet.',
    losning: 'Ett dashboard. Ads + content + sosial publisering + klient-kommunikasjon i samme sted, med shared state mellom flatene.',
  },
  {
    smerte: 'Klient-godkjenning skjer i 3 forskjellige tråder (Slack, e-post, telefon)',
    konsekvens: 'Klient mister oversikt. Du sender på nytt fordi du ikke husker om de godkjente v3 eller v4. Konflikt om hva som faktisk ble bestilt.',
    losning: 'Versjonert godkjenningsflyt med signed audit-log. Klient godkjenner i app, du ser nøyaktig hva som ble godkjent og når.',
  },
  {
    smerte: 'Annonser på Meta + Google + LinkedIn + TikTok rapporteres separat',
    konsekvens: 'Du må aggregere KPI-er manuelt i Excel hver fredag. 2-3 timer/uke per klient.',
    losning: 'Spend-sync fra alle plattformer i ett grensesnitt. Auto-aggregert KPI per kampanje med daglig oppdatering.',
  },
  {
    smerte: 'Faktura sendt manuelt med 20%-påslag beregnet med Excel',
    konsekvens: 'Math-feil skjer. Klient lurer på hvorfor tallene ikke matcher. Hele forretningsforholdet kommer under tvil.',
    losning: 'Management fee beregnes på prosjekt-nivå med transparent fee-rate. Faktura genereres automatisk fra finalized spend-data.',
  },
  {
    smerte: 'Instagram-publisering bytter mellom Buffer, Later eller manuell',
    konsekvens: 'Du betaler 2-3 verktøy som overlapper. Hver flyttning av kampanje krever omkonfigurering.',
    losning: 'Direkte Instagram Business-publisering fra Role Room. Posten levert med riktig tagging, hashtag-strategi og crosspost-templating.',
  },
];

type Job = {
  title: string;
  description: string;
};

const JOBS: Job[] = [
  {
    title: 'Digital markedsføring',
    description: 'Ads-kampanjer på Meta, Google, LinkedIn, TikTok i ett grensesnitt. Spend-sync, KPI-aggregering, transparent management fee for klient. Klient ser samme tall som du.',
  },
  {
    title: 'Innholdsplanlegging',
    description: 'Content marketing-plan, carousel-generator, feed-strategi. Drevet av Claude (beta) for konkurrentanalyse, partner-discovery og merch-kobling for kundens nisje.',
  },
  {
    title: 'Klient-samarbeid med transparent oversikt',
    description: 'Versjonert godkjenningsflyt. Klient godkjenner i appen, du ser nøyaktig hva som ble godkjent og når. Budsjett-tall delt mellom partene — ingen "har du sett fakturaen?"-spørsmål.',
  },
];

export function InnholdsprodusentPage() {
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
      {/* Article-schema for AI-citation */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'Innholdsprodusent-løsningen — ett verktøy for ads, content og klient-samarbeid',
            description:
              'For frilans-innholdsprodusenter som jonglerer 4-8 klienter med ads + content + publisering på tvers av Meta, Google, LinkedIn og TikTok. 495 kr per sete per måned med transparent klient-godkjenning.',
            author: { '@type': 'Organization', name: 'The Role Room' },
            publisher: {
              '@type': 'Organization',
              name: 'The Role Room',
              logo: { '@type': 'ImageObject', url: 'https://theroleroom.com/logo.png' },
            },
            mainEntityOfPage: 'https://theroleroom.com/innholdsprodusent-norge',
            inLanguage: 'no',
            datePublished: '2026-05-28',
          }),
        }}
      />

      {/* Product-schema for AI product-discovery */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'The Role Room — innholdsprodusent-løsning',
            description:
              'Ads + content marketing + sosial publisering + klient-samarbeid i ett verktøy. Bygget for norske frilans-innholdsprodusenter.',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              name: 'Innholdsprodusent',
              price: '495',
              priceCurrency: 'NOK',
              description: 'Per sete per måned, minimum 1 sete',
            },
            inLanguage: 'no',
          }),
        }}
      />

      <Container maxWidth="md">
        {/* Hero */}
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <VideocamIcon sx={{ color: '#a78bfa' }} />
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
              Vertikal · innholdsprodusent
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Ett verktøy for ads, content og klient-samarbeid
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.7 }}
          >
            For frilans-innholdsprodusenter som jonglerer med 4-8 klienter samtidig. Som driver
            ads på Meta + Google + LinkedIn + TikTok. Som må godkjenne med klient før hver
            publisering. Som bruker 30-45 min per dag bare på å finne ut hva som er status
            på en kampanje. Innholdsprodusent-løsningen er bygget for å fjerne det.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Chip
              label="495 kr per sete per måned · minimum 1 sete"
              sx={{
                bgcolor: 'rgba(167,139,250,0.18)',
                color: '#c4b5fd',
                fontWeight: 700,
                fontSize: '0.92rem',
                height: 36,
                px: 1,
              }}
            />
          </Box>
        </Stack>

        {/* Hva løsningen gjør */}
        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.8rem' }, mb: 2 }}>
          Tre jobber i ett verktøy
        </Typography>
        <Stack spacing={2.5} sx={{ mb: 6 }}>
          {JOBS.map((j) => (
            <Box
              key={j.title}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(167,139,250,0.06)',
                border: '1px solid rgba(167,139,250,0.25)',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <CheckCircleIcon sx={{ color: '#a78bfa', fontSize: 22, mt: 0.5, flexShrink: 0 }} />
                <Box>
                  <Typography component="h3" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.1rem', md: '1.25rem' }, mb: 0.75 }}>
                    {j.title}
                  </Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.94rem', md: '1rem' }, lineHeight: 1.65 }}>
                    {j.description}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>

        {/* Pull-quote */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(34,211,238,0.06)',
            border: '1px solid rgba(34,211,238,0.3)',
            mb: 6,
          }}
        >
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{
              color: '#fde68a',
              fontStyle: 'italic',
              fontSize: { xs: '1.05rem', md: '1.2rem' },
              lineHeight: 1.6,
              fontWeight: 500,
            }}
          >
            "Klienten skal aldri lure på hva som er status. Du skal aldri lure på hva som er godkjent.
            Alle i loop, alltid — det er det innholdsprodusent-løsningen handler om."
          </Typography>
        </Box>

        {/* Pain points */}
        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.8rem' }, mb: 2 }}>
          Fem smerter i frilans-innholdsproduksjon — og hva vi gjør med dem
        </Typography>
        <Stack spacing={2.5} sx={{ mb: 6 }}>
          {PAINS.map((p, idx) => (
            <Box
              key={p.smerte}
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
                  {p.smerte}
                </Typography>
              </Stack>
              <Stack spacing={1.25}>
                <Box>
                  <Typography sx={{ color: 'rgba(248,113,113,0.85)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                    Konsekvens
                  </Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.9rem', md: '0.96rem' }, lineHeight: 1.6 }}>
                    {p.konsekvens}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: '#86efac', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                    Vår tilnærming
                  </Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.9rem', md: '0.96rem' }, lineHeight: 1.6 }}>
                    {p.losning}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>

        {/* Pris */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(167,139,250,0.08)',
            border: '1px solid rgba(167,139,250,0.35)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.2rem', md: '1.4rem' }, mb: 1 }}>
            Prising
          </Typography>
          <Typography sx={{ color: '#c4b5fd', fontWeight: 800, fontSize: { xs: '1.8rem', md: '2.2rem' }, mb: 0.5 }}>
            495 kr / sete / mnd
          </Typography>
          <Typography sx={{ color: 'rgba(229,231,235,0.78)', fontSize: '0.92rem', mb: 1.5 }}>
            Eks. mva · minimum 1 sete · faktura via EHF eller Stripe-abonnement
          </Typography>
          <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.94rem', lineHeight: 1.65 }}>
            Inkluderer ads-sync på Meta + Google + LinkedIn + TikTok, content marketing-modul,
            social publishing, klient-flow med versjonert godkjenning, og management
            fee-beregning. Add-on for SMS (2,00 kr/stk eks. mva) og WhatsApp Business
            faktureres per bruk.
          </Typography>
        </Box>

        {/* Ærlighet */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 3,
            bgcolor: 'rgba(251,191,36,0.05)',
            border: '1px dashed rgba(251,191,36,0.3)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.05rem', md: '1.2rem' }, mb: 1 }}>
            Ærlig om hva som er på plass og hva som ikke er det ennå
          </Typography>
          <Typography sx={{ color: 'rgba(229,231,235,0.82)', fontSize: '0.94rem', lineHeight: 1.7 }}>
            Innholdsprodusent-løsningen er <strong>live</strong>. Ads-sync, klient-godkjenning,
            content-marketing og publisering fungerer i dag. AI-laget (Agenten) som vil drive
            konkurrentanalyse + partner-discovery + merch-kobling for kundens virksomhet er
            i <strong>beta</strong> — testes internt, skipes når den er beviselig nyttig. BankID-
            verifisering er planlagt, ikke deployert ennå.
          </Typography>
        </Box>

        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(148,163,184,0.18)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.3rem', md: '1.5rem' }, mb: 2 }}>
            Del av et større system
          </Typography>
          <Typography sx={{ color: 'rgba(229,231,235,0.78)', fontSize: { xs: '0.94rem', md: '1rem' }, lineHeight: 1.65, mb: 2.5 }}>
            Innholdsprodusent-løsningen er én av tre vertikaler bygget på samme kjerne-OS.
            Hvis du jobber bredere med film- og innholdsproduksjon, eller driver et
            dansestudio, finnes disse:
          </Typography>
          <Stack spacing={1.5}>
            <Box
              component="a"
              href="/produksjons-os"
              sx={{
                display: 'block',
                p: 2,
                borderRadius: 2,
                bgcolor: 'rgba(34,211,238,0.08)',
                border: '1px solid rgba(34,211,238,0.3)',
                textDecoration: 'none',
                transition: 'background-color 120ms ease',
                '&:hover': { bgcolor: 'rgba(34,211,238,0.14)' },
              }}
            >
              <Typography sx={{ color: '#67e8f9', fontWeight: 800, fontSize: '1.05rem', mb: 0.5 }}>
                Produksjons-OS (kjerneposisjonering) → /produksjons-os
              </Typography>
              <Typography sx={{ color: 'rgba(229,231,235,0.82)', fontSize: '0.92rem', lineHeight: 1.55 }}>
                Operativsystemet for film- og innholdsproduksjon. Casting, planlegging, crew, kommunikasjon, faktura. 795 kr/sete.
              </Typography>
            </Box>
            <Box
              component="a"
              href="/dansestudio-norge"
              sx={{
                display: 'block',
                p: 2,
                borderRadius: 2,
                bgcolor: 'rgba(52,211,153,0.08)',
                border: '1px solid rgba(52,211,153,0.3)',
                textDecoration: 'none',
                transition: 'background-color 120ms ease',
                '&:hover': { bgcolor: 'rgba(52,211,153,0.14)' },
              }}
            >
              <Typography sx={{ color: '#86efac', fontWeight: 800, fontSize: '1.05rem', mb: 0.5 }}>
                Dansestudio-vertikalen → /dansestudio-norge
              </Typography>
              <Typography sx={{ color: 'rgba(229,231,235,0.82)', fontSize: '0.92rem', lineHeight: 1.55 }}>
                Booking + koreografi + casting + medlemmer + skadelogg for norske dansestudioer. Danser 149 kr/mnd.
              </Typography>
            </Box>
          </Stack>
        </Box>


        <NewsletterSignupBlock
          heading="Få bransje-data + workflow-research i innboksen"
          body="Norwegian Casting Brief — én bransje-observasjon, ett konkret datapunkt, én ting verdt å vite. 4 minutter."
          source="innholdsprodusent-norge"
        />
      </Container>
    </Box>
  );
}

export default InnholdsprodusentPage;
