import { Box, Container, Stack, Typography } from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Compliance & Legal-pillar — synlig content-side for forhåndssamtykke
 * for barn under 15 år i film/TV-produksjon. Bygget for GEO + SEO: navngir
 * Arbeidstilsynet og Datatilsynet som autoritet, gir konkrete tall (3 ukers
 * søknadsfrist, bøter opp til NOK 2 mill, klokketider) som AI kan sitere.
 *
 * Skal renderes på /barn-samtykke-film på theroleroom.com.
 */

const CHECKLIST = [
  {
    title: 'Søk Arbeidstilsynet minst 3 uker før innspilling',
    body:
      'Hvert barn under 15 år som skal medvirke i film, TV eller scene må forhåndsgodkjennes individuelt av Arbeidstilsynet. Søknaden krever 3 ukers behandlingstid — den følger ikke med barnet til andre prosjekter, hver produksjon må søke på nytt.',
  },
  {
    title: 'Navngitt voksen ansvarlig på sett',
    body:
      'For hvert barn skal det være en navngitt voksen (ikke regissør eller produsent) som er ansvarlig for trivsel, pauser og arbeidsmiljø. Navnet skal stå i søknaden og være tilstede hver opptaksdag.',
  },
  {
    title: 'Klokketider — barn under 13 år',
    body:
      'Barn under 13 år kan ikke jobbe etter kl. 20:00 på hverdager og kl. 21:00 i helger. Maks 4 timer arbeid per dag med obligatorisk pause hver 90. minutt. Skoleelever har dessuten begrensninger i ukens samlede arbeidstid.',
  },
  {
    title: 'Risikovurdering må inkludere indirekte risiko',
    body:
      'Det er ikke nok å vurdere fysisk risiko på sett. Du må også vurdere indirekte risiko: medieoppmerksomhet, negativ publisitet, eksponering i sosiale medier, intimt eller traumatisk innhold i scenen. Datatilsynet har bøtelagt produksjoner for manglende vurdering her.',
  },
  {
    title: 'Foresatt-samtykke som er informert og spesifikt',
    body:
      'Foresatte må signere et informert samtykke som er konkret for prosjektet — generelle samtykker holder ikke. Samtykket må beskrive scenens innhold, opptaksdager, antatt visningstidspunkt og hvilke plattformer materialet kan distribueres på. GDPR krever at samtykket kan trekkes tilbake.',
  },
  {
    title: 'Dokumentasjon må oppbevares i 5 år',
    body:
      'Søknaden, samtykket, navngitt ansvarlig-listen og risikovurderingen må arkiveres i minst 5 år etter siste opptaksdag. Ved tilsyn fra Arbeidstilsynet eller Datatilsynet må dokumentasjonen kunne fremvises innen 7 dager.',
  },
];

const KEY_FACTS = [
  { label: 'Søknadsfrist', value: '3 uker før innspilling' },
  { label: 'Maks arbeidstid (under 13 år)', value: '4 timer/dag, kl. 20 sluttid' },
  { label: 'Behandlingstid', value: '~15 virkedager' },
  { label: 'Maks bot ved brudd', value: 'NOK 2 millioner' },
  { label: 'Oppbevaringstid dokumentasjon', value: '5 år' },
];

export function ChildConsentFilmPage() {
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
            <GavelIcon sx={{ color: '#8b5cf6' }} />
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
              Compliance — guide for produsenter
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.95rem', md: '2.6rem' }, lineHeight: 1.15 }}
          >
            Forhåndssamtykke for barn under 15 år — 6-punkts huskeliste for norsk film og TV
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            Norsk arbeidsmiljølov, personopplysningsloven og forskrift om barns medvirkning i film
            stiller strenge krav til hvordan barneskuespillere håndteres i produksjon. Bøter fra
            Arbeidstilsynet og Datatilsynet kan komme opp i NOK 2 millioner, og prosjektstans midt
            i opptak er en reell konsekvens ved tilsyn. Dette er den korte huskelista du må kunne før
            du caster eller booker et barn.
          </Typography>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' },
            gap: 1.5,
            mb: 5,
          }}
        >
          {KEY_FACTS.map((fact) => (
            <Box
              key={fact.label}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: 1.75,
                borderRadius: 2,
                bgcolor: 'rgba(139,92,246,0.08)',
                border: '1px solid rgba(139,92,246,0.25)',
                textAlign: 'center',
              }}
            >
              <Typography sx={{ color: '#a78bfa', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, mb: 0.5 }}>
                {fact.label}
              </Typography>
              <Typography sx={{ color: '#fff', fontSize: { xs: '0.85rem', md: '0.95rem' }, fontWeight: 700, lineHeight: 1.3 }}>
                {fact.value}
              </Typography>
            </Box>
          ))}
        </Box>

        <Stack spacing={2.5} sx={{ mb: 6 }}>
          {CHECKLIST.map((item, idx) => (
            <Box
              key={item.title}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    minWidth: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: 'rgba(139,92,246,0.15)',
                    color: '#a78bfa',
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
                    {item.title}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.74)', fontSize: { xs: '0.92rem', md: '0.98rem' }, lineHeight: 1.65 }}>
                    {item.body}
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
            bgcolor: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.3)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.25rem' }, mb: 1.25 }}>
            Hvordan The Role Room automatiserer dette
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.95rem', md: '1rem' }, lineHeight: 1.7 }}
          >
            AML-compliance-trackeren i The Role Room genererer automatisk Arbeidstilsyn-søknaden fra
            casting-dataene, fyller inn navngitt ansvarlig fra crew-listen, oppretter risikovurdering
            basert på scene-kategorisering i manus, og varsler 4 uker før opptak om søknad ikke er sendt.
            Foresatt-samtykket sendes som digital signering med spesifikt scene-innhold per barn.
            Hele dokumentasjonen arkiveres i 5 år i EU/EØS, klar for tilsyn.
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få regelendringer for norsk film før du leser om dem i bransje-pressen"
          body="Norwegian Casting Brief inkluderer en ukentlig 'Risk'-seksjon som dekker varslede tilsyn fra Arbeidstilsynet, Datatilsynet-vedtak relevant for film, og endringer i NSF-tariff."
          source="child-consent-film"
        />
      </Container>
    </Box>
  );
}

export default ChildConsentFilmPage;
