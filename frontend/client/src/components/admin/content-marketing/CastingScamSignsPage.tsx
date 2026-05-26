import { Box, Container, Stack, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Trust & Safety-pillar — synlig content-side for "casting-svindel-tegn".
 * Bygget for GEO: Article JSON-LD + FAQPage + Speakable, sitérbare red-flags
 * og navngitte myndigheter (Datatilsynet, NSF) som autoritetsanker.
 *
 * Skal renderes på /casting-svindel-tegn på theroleroom.com når godkjent.
 */

const RED_FLAGS: { title: string; body: string }[] = [
  {
    title: 'De ber deg betale for noe',
    body:
      'Workshop-avgift, "registreringsgebyr", "premium-medlemskap" eller headshot-pakke. Reelle casting directors betaler deg, de tar ikke betalt. Hvis pengene går én vei — fra deg til dem — er det svindel.',
  },
  {
    title: 'De flytter samtalen utenfor plattformen',
    body:
      'WhatsApp, Telegram, Signal eller privat e-post tilbys umiddelbart. Profesjonelle castingbyråer holder kommunikasjonen sporbar i e-post eller på sin egen plattform fordi de må dokumentere kontakten for GDPR og kontrakts-historikk.',
  },
  {
    title: 'Produksjonen finnes ikke',
    body:
      'Du blir kontaktet om et høyprofilert prosjekt med navn som "Netflix-original", "Disney-internasjonal" eller "Hollywood-co-production" — men ingen produksjonsselskap, regissør eller IMDb-side. Sjekk alltid om produksjonen er registrert hos NFI eller har sak i Rushprint.',
  },
  {
    title: 'De krever sensitive opplysninger tidlig',
    body:
      'Personnummer, bankkortinformasjon, kopi av pass eller "kredittsjekk" før et eneste audition. Casting krever ikke dette. Skattekortinformasjon hentes først etter signert kontrakt med ekte produksjonsselskap.',
  },
  {
    title: 'Tilbudet føles for godt',
    body:
      'Garantert hovedrolle, eksklusivt tilbud "kun til deg", høyt honorar uten audition, eller løfter om internasjonal karriere etter én session. Hvis det føles for godt — det er det.',
  },
];

const AUTHORITIES = [
  { name: 'Norsk Skuespillerforbund (NSF)', what: 'Verifiserer profesjonelle skuespiller-medlemmer + bistår ved tvist.', url: 'https://www.skuespillerforbund.no' },
  { name: 'Datatilsynet', what: 'Behandler GDPR-klager når personopplysninger misbrukes — bøter opp til 4% av omsetning.', url: 'https://www.datatilsynet.no' },
  { name: 'Forbrukerrådet', what: 'Hjelp ved svindelhenvendelser og urettmessig fakturering.', url: 'https://www.forbrukerradet.no' },
  { name: 'Politiet — anmelde svindel', what: 'Anmeld økonomisk svindel via politiet.no eller på lokalt politikammer.', url: 'https://www.politiet.no' },
];

export function CastingScamSignsPage() {
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
            <WarningAmberIcon sx={{ color: '#fbbf24' }} />
            <Typography
              sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: { xs: '0.84rem', md: '0.92rem' },
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#fbbf24',
                fontWeight: 700,
              }}
            >
              Trygghet — guide
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.75rem' }, lineHeight: 1.15 }}
          >
            Slik kjenner du igjen en falsk casting director
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            Falske casting directors koster norske skuespillere både penger og personopplysninger
            hvert eneste år. Mønsteret er det samme uansett plattform: pre-payment, off-platform-kommunikasjon
            og produksjoner som ikke eksisterer. Her er de fem røde flaggene du må kjenne — pluss hvor du
            melder fra hvis du allerede er rammet.
          </Typography>
        </Stack>

        <Stack spacing={2.5} sx={{ mb: 6 }}>
          {RED_FLAGS.map((flag, idx) => (
            <Box
              key={flag.title}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(251,191,36,0.22)',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    minWidth: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: 'rgba(251,191,36,0.15)',
                    color: '#fbbf24',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {idx + 1}
                </Box>
                <Box>
                  <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.05rem', md: '1.2rem' }, mb: 0.75 }}>
                    {flag.title}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.74)', fontSize: { xs: '0.92rem', md: '0.98rem' }, lineHeight: 1.65 }}>
                    {flag.body}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>

        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.3)',
            mb: 6,
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
            <VerifiedUserIcon sx={{ color: '#4ade80' }} />
            <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.25rem' } }}>
              Slik gjør The Role Room det annerledes
            </Typography>
          </Stack>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.95rem', md: '1rem' }, lineHeight: 1.7 }}
          >
            Hver eneste casting call på theroleroom.com gjennomgås manuelt før den publiseres. Det
            betyr at vi vokser saktere enn konkurrenter som tillater uverifiserte casting directors,
            men det betyr også at norske skuespillere ikke blir kontaktet av svindlere via plattformen
            vår. Vi publiserer en kvartalsvis åpenhetsrapport som viser hvor mange casting calls vi
            blokkerte, hvor mange sikkerhetsrapporter vi mottok, og responstiden vår.
          </Typography>
        </Box>

        <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.2rem', md: '1.4rem' }, mb: 2 }}>
          Hvis du er rammet — meld fra her
        </Typography>
        <Stack spacing={1.25} sx={{ mb: 6 }}>
          {AUTHORITIES.map((auth) => (
            <Box
              key={auth.name}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <Typography component="a" href={auth.url} target="_blank" rel="noreferrer noopener" sx={{ color: '#a78bfa', fontWeight: 700, textDecoration: 'none', fontSize: '1rem' }}>
                {auth.name} →
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', mt: 0.5, lineHeight: 1.55 }}>
                {auth.what}
              </Typography>
            </Box>
          ))}
        </Stack>

        <NewsletterSignupBlock
          heading="Få sikkerhetsoppdateringer fra norsk casting"
          body="Norwegian Casting Brief er ukentlig oppsummering for casting-folk og skuespillere — vi varsler tidlig om svindel-mønstre og hvilke plattformer som har slått ned på dem."
          source="casting-scam-signs"
        />
      </Container>
    </Box>
  );
}

export default CastingScamSignsPage;
