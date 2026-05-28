import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NewsletterSignupBlock from './NewsletterSignupBlock';

type PainPoint = {
  smerte: string;
  konsekvens: string;
  losning: string;
};

const PAINS: PainPoint[] = [
  {
    smerte: 'Time-booking, casting og medlemshåndtering ligger i tre forskjellige verktøy',
    konsekvens: 'Studio-administrasjon bruker 6-10 timer/uke på dobbel-registering. En danser registrert i bookingen mangler ofte i medlems-CRMen — eller motsatt.',
    losning: 'Booking, casting, medlemmer og event-planlegging i ett system. Hver danser er én entitet — registreres én gang, vises overalt.',
  },
  {
    smerte: 'Skader logges ad-hoc — Excel, papir eller helt i hodet til instruktøren',
    konsekvens: 'Når en danser kommer tilbake etter skade vet ingen hva som faktisk skjedde, hvilke øvelser hun fortsatt ikke kan, eller når hun sist trente. Re-skader skjer.',
    losning: 'Strukturert skadelogg med oppfølging. Instruktør kan se «klar fra dato» og hvilke bevegelser som fortsatt er begrenset, før dans-sekvensen settes sammen.',
  },
  {
    smerte: 'Auditions kjøres på Facebook-grupper, Instagram-DM og e-post om hverandre',
    konsekvens: 'Du har 80 søkere i fire kanaler. Du vet ikke hvem som har video, hvem som er gode på hip-hop-soloen, og hvem som allerede er booket samme dag.',
    losning: 'Åpne auditions med samlede søknader, video-upload, profil-historikk og kalender-konflikt-sjekk mot eksisterende booking. Én radio i stedet for fire flammer.',
  },
  {
    smerte: 'Koreografi + formasjonstrening foregår på blokk-papir eller via «forklare-i-rommet»',
    konsekvens: 'Nye dansere kommer inn midt i et nummer og må lære formasjonen fra null. Instruktør repeterer samme forklaring 30 ganger.',
    losning: 'Formasjonsverktøy for å bygge dansenummer visuelt — posisjoner, rolle-bytter, takt-noter. Eksporteres til hver danser så de kan øve på egenhånd før neste klasse.',
  },
  {
    smerte: 'Forestillinger og events planlegges i Excel + Google Calendar + Messenger-grupper',
    konsekvens: 'Når avlysninger eller forskyvninger skjer må du sende beskjed i 4 kanaler. Halvparten av medlemmene får det ikke med seg.',
    losning: 'Event-dashboard med push-notifikasjoner direkte til medlemmenes Role Room-konto. Avlysninger sendes én gang og når alle.',
  },
];

type FunctionItem = {
  title: string;
  description: string;
};

const FUNCTIONS: FunctionItem[] = [
  {
    title: 'Booking av timer og klasser',
    description: 'Time-/klassebooking med sal-konflikt-sjekk, drop-in-kontroll og auto-påminnelse på SMS eller WhatsApp Business 24 timer før.',
  },
  {
    title: 'Koreografi og produksjon av dansenummer',
    description: 'Planlegg dansenumre og forestillinger. Versjonert koreografi, takt-noter, rolle-tildeling per danser.',
  },
  {
    title: 'Casting til danseoppdrag',
    description: 'Finn dansere til betalte oppdrag — internt for studioets medlemmer, eller åpent for hele The Role Room-nettverket. Profil-historikk, video-prøver, kalender-konflikt-sjekk.',
  },
  {
    title: 'Medlemshåndtering',
    description: 'Administrer aktive medlemmer, drop-in-besøkende, lærere og koreografer. Medlemskategori-styring, fakturering via Stripe-abonnement eller EHF.',
  },
  {
    title: 'Formasjonstrening',
    description: 'Bygg dansenummer visuelt med posisjoner og rolle-bytter. Eksporter til hver danser for hjemmeøving. Reduserer drilling-tid i sal med 30-50%.',
  },
  {
    title: 'Event-dashboard og åpne auditions',
    description: 'Oversikt over kommende forestillinger, audition-runder, gjeste-koreografi-workshops. Push-notifikasjoner til medlemmer ved endringer.',
  },
  {
    title: 'Skadelogg og øvingslogg',
    description: 'Strukturert helsehistorikk per danser. Når dansere kommer tilbake etter skade ser instruktør hva som er klart, hva som er begrenset, og siste treningsdag.',
  },
];

export function DansestudioNorgePage() {
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
            headline: 'Dansestudio-vertikal — booking, koreografi, casting og medlemmer i ett',
            description:
              'Profesjonell dansestudio-vertikal for norske studioer. Booking + koreografi + casting + medlemshåndtering + formasjonstrening + skadelogg i samme system. Dansere fra 149 kr/mnd.',
            author: { '@type': 'Organization', name: 'The Role Room' },
            publisher: {
              '@type': 'Organization',
              name: 'The Role Room',
              logo: { '@type': 'ImageObject', url: 'https://theroleroom.com/logo.png' },
            },
            mainEntityOfPage: 'https://theroleroom.com/dansestudio-norge',
            inLanguage: 'no',
            datePublished: '2026-05-28',
          }),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'The Role Room — dansestudio-vertikal',
            description:
              'Time-booking, koreografi, casting til danseoppdrag, medlemshåndtering, formasjonstrening, event-dashboard og skadelogg for norske dansestudioer.',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: [
              {
                '@type': 'Offer',
                name: 'Danser (frilans)',
                price: '149',
                priceCurrency: 'NOK',
                description: 'Per danser per måned',
              },
              {
                '@type': 'Offer',
                name: 'Studio',
                priceSpecification: {
                  '@type': 'PriceSpecification',
                  priceCurrency: 'NOK',
                  description: '149 – 2 490 kr per måned avhengig av studio-størrelse',
                },
              },
            ],
            inLanguage: 'no',
          }),
        }}
      />

      <Container maxWidth="md">
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <MusicNoteIcon sx={{ color: '#34d399' }} />
            <Typography
              sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: { xs: '0.84rem', md: '0.92rem' },
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#34d399',
                fontWeight: 700,
              }}
            >
              Vertikal · dansestudio
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Et koordineringsverktøy bygget for norske dansestudioer
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.7 }}
          >
            For studioer som driver med profesjonell dans — booking av timer, koreografi til
            forestillinger, casting til oppdrag, medlemshåndtering, formasjonstrening og
            skadelogg. I ett system, med samme dansere-, lærer- og medlemsregister på tvers.
            Frilansere fra 149 kr/mnd, studioer fra 149 kr og oppover etter størrelse.
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label="Danser · 149 kr / mnd"
              sx={{
                bgcolor: 'rgba(52,211,153,0.18)',
                color: '#86efac',
                fontWeight: 700,
                fontSize: '0.88rem',
                height: 34,
              }}
            />
            <Chip
              label="Studio · 149 – 2 490 kr / mnd"
              sx={{
                bgcolor: 'rgba(52,211,153,0.18)',
                color: '#86efac',
                fontWeight: 700,
                fontSize: '0.88rem',
                height: 34,
              }}
            />
          </Stack>
        </Stack>

        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.8rem' }, mb: 2 }}>
          Syv funksjoner i samme studio-system
        </Typography>
        <Stack spacing={2.5} sx={{ mb: 6 }}>
          {FUNCTIONS.map((f) => (
            <Box
              key={f.title}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(52,211,153,0.06)',
                border: '1px solid rgba(52,211,153,0.25)',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <CheckCircleIcon sx={{ color: '#34d399', fontSize: 22, mt: 0.5, flexShrink: 0 }} />
                <Box>
                  <Typography component="h3" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.1rem', md: '1.25rem' }, mb: 0.75 }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.94rem', md: '1rem' }, lineHeight: 1.65 }}>
                    {f.description}
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
            "Hver danser er én entitet — registreres én gang, vises overalt. Booking, casting,
            skadelogg, medlems-CRM og audition-listen ser samme person. Det er det
            dansestudio-vertikalen handler om."
          </Typography>
        </Box>

        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.8rem' }, mb: 2 }}>
          Fem smerter i dansestudio-drift — og hva vi gjør med dem
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

        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(52,211,153,0.08)',
            border: '1px solid rgba(52,211,153,0.35)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.2rem', md: '1.4rem' }, mb: 1 }}>
            Prising
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#86efac', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                Frilans-danser
              </Typography>
              <Typography sx={{ color: '#86efac', fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.8rem' }, mb: 0.5 }}>
                149 kr / mnd
              </Typography>
              <Typography sx={{ color: 'rgba(229,231,235,0.78)', fontSize: '0.88rem' }}>
                Profil, reel, casting-eksport, NAV-rapport. Individ-fakturert.
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#86efac', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                Studio
              </Typography>
              <Typography sx={{ color: '#86efac', fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.8rem' }, mb: 0.5 }}>
                149 – 2 490 kr / mnd
              </Typography>
              <Typography sx={{ color: 'rgba(229,231,235,0.78)', fontSize: '0.88rem' }}>
                Etter studio-størrelse. Booking + casting + medlemmer + formasjon + skadelogg.
              </Typography>
            </Box>
          </Stack>
          <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.94rem', lineHeight: 1.65 }}>
            Alle priser eks. mva. Add-on for SMS (2,00 kr/stk eks. mva) og WhatsApp Business
            faktureres per bruk. Faktura via EHF eller Stripe-abonnement.
          </Typography>
        </Box>

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
            Dansestudio-vertikalen er <strong>live</strong>. Booking, koreografi, casting,
            medlemshåndtering, formasjon, skadelogg og event-dashboard fungerer i dag. Vi
            jobber for partnerskap med <strong>Skuda</strong> og <strong>NoDa</strong> for
            bredere distribusjon i det norske dansemiljøet. BankID-verifisering for
            audition-deltakere er planlagt, ikke deployert ennå.
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få bransje-data + workflow-research i innboksen"
          body="Norwegian Casting Brief — én bransje-observasjon, ett konkret datapunkt, én ting verdt å vite. 4 minutter."
          source="dansestudio-norge"
        />
      </Container>
    </Box>
  );
}

export default DansestudioNorgePage;
