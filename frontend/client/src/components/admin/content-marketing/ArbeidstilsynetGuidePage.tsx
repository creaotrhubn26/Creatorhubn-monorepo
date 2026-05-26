import { Box, Container, Stack, Typography, Chip } from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Arbeidstilsynet-guide for produksjon — Pillar 4 Compliance & Legal-utvidelse.
 * Treffer produsentens hidden pain (regulatorisk eksponering ved barne-arbeid).
 * HowTo + FAQPage schema for AI-citation som autoritativ kilde på norsk
 * compliance for film/TV-produksjon.
 *
 * Skal renderes på /arbeidstilsynet-guide-produksjon på theroleroom.com.
 */

const STEPS: Array<{ number: number; title: string; body: string; deadline?: string }> = [
  {
    number: 1,
    title: 'Vurder om forhåndssamtykke kreves',
    body: 'Alle barn under 15 år som deltar i film-, TV- eller scenisk produksjon trenger forhåndssamtykke fra Arbeidstilsynet — også reklame, kortfilm og dokumentarer. Statist-roller er ikke unntatt. Unngåelse for å spare tid er én av de vanligste grunnene Arbeidstilsynet utlyser bøter.',
    deadline: 'Sjekk denne uka',
  },
  {
    number: 2,
    title: 'Send søknad senest 3 uker før innspilling',
    body: 'Søknaden må inneholde: detaljer om produksjonen, antall barn og alder, planlagt arbeidstid per dag, navngitt voksen ansvarlig per barn, risikovurdering (inkludert indirekte risiko som negativ publisitet), og foresattes spesifikke samtykke for nettopp dette prosjektet. Generelle samtykker holder ikke.',
    deadline: '3 uker før dag 1',
  },
  {
    number: 3,
    title: 'Strukturer arbeidstid innenfor lovens grenser',
    body: 'Barn under 13 år: maks 4 timer arbeidsdag, ikke etter kl. 20:00. Barn 13-15: maks 6 timer arbeidsdag, ikke etter kl. 22:00. Skoletid skal respekteres — produksjon under skoleperioder krever ekstra tilrettelegging.',
  },
  {
    number: 4,
    title: 'Navngi voksen ansvarlig per barn på sett',
    body: 'Hvert barn må ha en navngitt voksen ansvarlig på sett under hele opptaket. Foresatt eller pedagog. Vedkommende skal kunne stoppe opptaket dersom barnet viser ubehag. Dokumenteres med signert avtale før dag 1.',
  },
  {
    number: 5,
    title: 'Dokumenter risikovurdering — inkludert indirekte risiko',
    body: 'Arbeidstilsynet krever skriftlig risikovurdering. Inkluder: fysisk sikkerhet på sett, psykologisk belastning av rollen, eksponering for arbeidsmiljø (røyk, lyd, vær), og indirekte risiko som negativ publisitet, sosiale media-eksponering etter premiere, og typecasting-effekter.',
  },
  {
    number: 6,
    title: 'Arkivér all dokumentasjon i 5 år',
    body: 'Forhåndssamtykket, signert avtale med ansvarlig voksen, risikovurdering, arbeidstidsregistreringer og foresatt-samtykke skal arkiveres i minst 5 år etter siste opptaksdag. Datatilsynet-bøter for dårlig dokumentasjon i 2024 var opp til NOK 2 millioner.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Gjelder forhåndssamtykke også reklame med barn?',
    a: 'Ja. Kommersielle reklamefilmer, sosiale media-kampanjer og brand-content med barn under 15 er underlagt samme krav som drama. Det er ingen unntak for "kort produksjon" eller "lavbudsjett". Bøtene fra 2024 inkluderte flere reklame-produksjoner.',
  },
  {
    q: 'Hva skjer hvis vi caster et barn uten å søke forhåndssamtykke?',
    a: 'Tre konsekvenser kan inntre: (1) Arbeidstilsynet kan stoppe produksjonen midt i innspilling med umiddelbar virkning, (2) bøter fra Arbeidstilsynet (typisk NOK 50.000-500.000 per overtredelse), (3) Datatilsynet-bøter dersom barnedata også ble behandlet ulovlig (opp til NOK 2 mill). I tillegg kommer omdømme-skade som er vanskeligere å reparere.',
  },
  {
    q: 'Kan vi gjenbruke forhåndssamtykke fra forrige produksjon?',
    a: 'Nei. Forhåndssamtykket er prosjekt-spesifikt. Hver ny produksjon — inkludert oppfølgere, spin-offs eller reklame-kampanjer med samme barn — krever ny søknad. Også hvis kun datoene endres må forhåndssamtykket fornyes.',
  },
  {
    q: 'Hvor finner vi søknadsskjema?',
    a: 'Arbeidstilsynets nettside har det digitale skjemaet. Søknaden behandles typisk på 1-2 uker. Hvis dere bruker The Role Room genererer plattformen et utfylt utkast automatisk basert på casting-briefen — dere må fortsatt signere og sende det selv, men datafyllingen og dokumenttilstrekkelig-sjekken er gjort.',
  },
  {
    q: 'Hva er forskjellen på Arbeidstilsynet-samtykke og GDPR-samtykke?',
    a: 'To separate krav. Arbeidstilsynet regulerer barnets arbeidsforhold (timer, sikkerhet, ansvarlig voksen). GDPR regulerer behandling av barnets personopplysninger (bilder, video, navn, kontaktinformasjon). Begge må håndteres. GDPR-samtykket må også være spesifikt for produksjonen og kan trekkes tilbake av foresatte når som helst.',
  },
];

export function ArbeidstilsynetGuidePage() {
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
      {/* HowTo schema — perfekt for AI-citation av compliance-trinn */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'Slik følger du Arbeidstilsynets krav for barn i film- og TV-produksjon',
            description:
              'Komplett guide for norske produsenter som caster barn under 15 år. Søknadsfrist, dokumentasjon, arbeidstid og arkivering — i seks steg.',
            inLanguage: 'no',
            totalTime: 'PT3W',
            step: STEPS.map((s) => ({
              '@type': 'HowToStep',
              position: s.number,
              name: s.title,
              text: s.body,
            })),
            publisher: { '@type': 'Organization', name: 'The Role Room' },
          }),
        }}
      />

      {/* FAQPage schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
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
            <GavelIcon sx={{ color: '#a78bfa' }} />
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
              Compliance · for produsenter
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Arbeidstilsynet-guide: barn i norsk film- og TV-produksjon
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            Arbeidstilsynet har varslet økt tilsyn med audiovisuell produksjon høsten 2026.
            Bøtene fra 2024 var opp til NOK 2 millioner per overtredelse — flere produsenter
            ble pålagt det. Denne guiden gir konkret seks-trinns-prosess for å være compliant
            uten å bremse produksjonen.
          </Typography>
        </Stack>

        {/* Advarsel-card */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 3,
            bgcolor: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.3)',
            mb: 5,
          }}
        >
          <Typography sx={{ color: '#fca5a5', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1 }}>
            Hvorfor dette gjelder deg
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: '#fde68a', fontStyle: 'italic', fontSize: { xs: '1.02rem', md: '1.14rem' }, lineHeight: 1.6, fontWeight: 500 }}
          >
            Hvis du caster ett eneste barn under 15 år — også som statist, også i reklame, også
            i én scene — er du juridisk ansvarlig for å følge denne prosessen. Det er ingen
            unntak for "kort produksjon", "lavbudsjett" eller "vi spurte foresatt".
          </Typography>
        </Box>

        {/* Steg */}
        <Stack spacing={2.5} sx={{ mb: 6 }}>
          {STEPS.map((step) => (
            <Box
              key={step.number}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(167,139,250,0.05)',
                border: '1px solid rgba(167,139,250,0.22)',
              }}
            >
              <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: 'rgba(167,139,250,0.2)',
                    border: '2px solid rgba(167,139,250,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Typography sx={{ color: '#c4b5fd', fontWeight: 800, fontSize: '1.1rem' }}>{step.number}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    component="h2"
                    sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.18rem', md: '1.35rem' }, lineHeight: 1.3 }}
                  >
                    {step.title}
                  </Typography>
                  {step.deadline ? (
                    <Chip
                      label={`⏱ ${step.deadline}`}
                      size="small"
                      sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fde68a', fontSize: '0.72rem', fontWeight: 700, mt: 0.75 }}
                    />
                  ) : null}
                </Box>
              </Stack>
              <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.93rem', md: '1rem' }, lineHeight: 1.7 }}>
                {step.body}
              </Typography>
            </Box>
          ))}
        </Stack>

        {/* FAQ */}
        <Stack spacing={2.5} sx={{ mb: 6 }}>
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' }, mb: 1 }}>
            Vanlige spørsmål
          </Typography>
          {FAQ.map((item) => (
            <Box
              key={item.q}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 2,
                bgcolor: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.14)',
              }}
            >
              <Typography component="h3" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', md: '1.08rem' }, mb: 1 }}>
                {item.q}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.92rem', md: '0.98rem' }, lineHeight: 1.7 }}>
                {item.a}
              </Typography>
            </Box>
          ))}
        </Stack>

        {/* CTA-card til produkt */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(34,211,238,0.06)',
            border: '1px solid rgba(34,211,238,0.3)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.25rem' }, mb: 1.25 }}>
            The Role Room automatiserer denne prosessen
          </Typography>
          <Typography
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.95rem', md: '1rem' }, lineHeight: 1.7, mb: 1 }}
          >
            Når dere caster barn via The Role Room genererer plattformen automatisk: utfylt
            forhåndssamtykke-søknad, mal for risikovurdering, signerings-flyt for ansvarlig
            voksen, og 5-års arkiv av all dokumentasjon. Dere får varsel når søknadsfristen
            nærmer seg. Det er en av grunnene plattformen finnes.
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få compliance-oppdateringer i innboksen"
          body="Norwegian Casting Brief sender ukens viktigste regulatoriske endring + ett konkret tilfelle fra norsk bransje. Aldri lenger enn 4 minutter."
          source="arbeidstilsynet-guide"
        />
      </Container>
    </Box>
  );
}

export default ArbeidstilsynetGuidePage;
