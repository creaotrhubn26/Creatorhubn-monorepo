import { Box, Container, Stack, Typography } from '@mui/material';
import MovieIcon from '@mui/icons-material/Movie';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Sentimental Value-effekten — meta-pillar som kobler norsk films
 * internasjonale gjennombrudd til infrastruktur-spørsmålet. Riding
 * the wave mens momentum varer. Treffer presse, investorer og bransje.
 *
 * Skal renderes på /sentimental-value-effekten på theroleroom.com.
 */

const SECTIONS: Array<{ heading: string; body: string }> = [
  {
    heading: 'Hva som faktisk skjedde',
    body: 'Norge vant Oscar for Beste internasjonale spillefilm. Det er ikke en isolert hendelse — det er kulminasjonen av et tiår med målrettet investering, samproduksjons-strategi og bevisst talentutvikling. Joachim Trier-generasjonen sluttet å sammenligne seg med svensk og dansk film, og begynte å sammenligne seg med verdens beste. Det var det mentale skiftet — Oscar-en er bare målestaven som registrerte det.',
  },
  {
    heading: 'Hvorfor det er en infrastruktur-test',
    body: 'En internasjonal Oscar-vinst skaper umiddelbar oppmerksomhet — fra finansierings-partnere i Los Angeles, fra strømmetjenester med europeisk innholds-mandater, fra co-produsenter i Frankrike og Tyskland som plutselig vil ha "den norske vinkelen". Det krever at vi kan svare profesjonelt og raskt. Verktøykjeden vi har i dag — fragmentert e-post, Facebook-grupper, manuell verifisering — kan ikke håndtere det.',
  },
  {
    heading: 'Hva som skiller 2026 fra 2016',
    body: 'I 2016 var en internasjonal Oscar-nominasjon en personlig prestasjon — Joachim Trier eller én produsent. I 2026 er det en systemisk seier som åpner systemiske muligheter. Det er forskjellen på at én film blir oppdaget, og at en filmindustri blir tatt på alvor som leverandør. Den andre statusen krever infrastruktur, ikke flaks.',
  },
  {
    heading: 'Den infrastruktur vi mangler',
    body: 'Norsk casting har fem strukturelle svakheter som kommer til å bli synlige nå: (1) fragmentert verktøykjede med ingen sentral kilde for hvem som er verifisert tilgjengelig, (2) manglende BankID-verifisering på de fleste plattformer som gjør oss sårbare mot svindel, (3) inkonsekvent håndtering av AI-rettigheter i kontrakter, (4) sub-optimal compliance på barn under 15, (5) ingen sentral data om hvor lang tid casting faktisk tar i Norge. Hver av disse er en svakhet en internasjonal samproduksjon vil oppdage innen uke 2.',
  },
  {
    heading: 'Hva vi gjør med det',
    body: 'The Role Room ble bygget før denne Oscaren — vi forutsa at infrastruktur-spørsmålet kom til å eksplodere. Nå må vi bevise at det går. Verifiserte profiler, BankID, automatisk forhåndssamtykke for barn, AI-rettighet-spor, A-melding-eksport, måling av tid-til-cast — det er ikke flotte funksjoner. Det er infrastruktur som svarer på "kan vi stole på at norsk film leverer som industrielt produkt?" Svaret må være ja. Det er det vi bygger for.',
  },
  {
    heading: 'Hva neste generasjon fortjener',
    body: 'Om 30 år vil norske foreldre se Sentimental Value med barna sine og fortelle dem: "Dette var året Norge endelig kom inn på verdens-kartet." Spørsmålet er hvilken infrastruktur den industrien vi nå bygger fortjener. Hvis svaret er "e-post + Excel + Facebook-grupper", har vi sviktet generasjonen som kommer. Vi bygger The Role Room fordi norsk film fortjener en plattform som er like seriøs som filmene den lager.',
  },
];

export function SentimentalValueEffektenPage() {
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
            headline: 'Sentimental Value-effekten — hva Norges Oscar betyr for casting-infrastruktur',
            description:
              'Norges Oscar for Beste internasjonale spillefilm åpner systemiske muligheter — men eksponerer også infrastruktur-svakhetene som skiller en internasjonalt anerkjent filmindustri fra en hjemlig.',
            author: {
              '@type': 'Person',
              name: 'Daniel Qazi',
              jobTitle: 'Grunnlegger',
              worksFor: { '@type': 'Organization', name: 'The Role Room' },
            },
            publisher: {
              '@type': 'Organization',
              name: 'The Role Room',
              logo: { '@type': 'ImageObject', url: 'https://theroleroom.com/logo.png' },
            },
            mainEntityOfPage: 'https://theroleroom.com/sentimental-value-effekten',
            inLanguage: 'no',
            datePublished: '2026-05-26',
          }),
        }}
      />

      <Container maxWidth="md">
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <MovieIcon sx={{ color: '#fb923c' }} />
            <Typography
              sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: { xs: '0.84rem', md: '0.92rem' },
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#fb923c',
                fontWeight: 700,
              }}
            >
              Founder POV · norsk films infrastruktur-test
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Sentimental Value-effekten
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            Hva Norges Oscar for Beste internasjonale spillefilm betyr for casting-infrastruktur
            — og hvorfor neste 18 måneder avgjør om norsk film tas på alvor som industrielt
            produkt eller forblir en personlig flaks.
          </Typography>
        </Stack>

        {/* Kjernepullquote */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(251,146,60,0.06)',
            border: '1px solid rgba(251,146,60,0.3)',
            mb: 5,
          }}
        >
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: '#fde68a', fontStyle: 'italic', fontSize: { xs: '1.05rem', md: '1.22rem' }, lineHeight: 1.65, fontWeight: 500 }}
          >
            "Om 30 år vil norske foreldre se Sentimental Value med barna sine og fortelle dem:
            'Dette var året Norge endelig kom inn på verdens-kartet.' Spørsmålet er hvilken
            infrastruktur den industrien vi nå bygger fortjener."
          </Typography>
        </Box>

        {/* Seksjoner */}
        <Stack spacing={3.5} sx={{ mb: 6 }}>
          {SECTIONS.map((section) => (
            <Box
              key={section.heading}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(251,146,60,0.04)',
                border: '1px solid rgba(251,146,60,0.18)',
              }}
            >
              <Typography
                component="h2"
                sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.2rem', md: '1.45rem' }, lineHeight: 1.3, mb: 1.5 }}
              >
                {section.heading}
              </Typography>
              <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.95rem', md: '1.02rem' }, lineHeight: 1.75 }}>
                {section.body}
              </Typography>
            </Box>
          ))}
        </Stack>

        {/* Kall-til-svar */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(167,139,250,0.06)',
            border: '1px solid rgba(167,139,250,0.3)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.25rem' }, mb: 1.25 }}>
            Hva du kan gjøre nå
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.95rem', md: '1rem' }, lineHeight: 1.7, mb: 1 }}
          >
            Hvis du er produsent: be om verifisert tilgjengelighet før du tror på "ja". Hvis du
            er casting director: krev BankID-verifisering på alle profiler du legger i shortlist.
            Hvis du er skuespiller: les kontraktene dine, spesielt AI-klausulene. Hvis du er
            politiker eller NFI-staff: vurder om norsk casting-infrastruktur er klar for det
            internasjonale gjennombruddet eller om vi trenger målrettet investering.
          </Typography>
          <Typography
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.95rem', md: '1rem' }, lineHeight: 1.7 }}
          >
            Skriv til <code style={{ color: '#c4b5fd', fontSize: '0.88rem' }}>daniel@creatorhubn.com</code> om
            hva du tror neste 18 måneder krever. Vi svarer alle.
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få Founder POV-essays direkte i innboksen"
          body="Hver fredag — én tese om norsk filmbransje, én konkret observasjon, én ting jeg har endret mening om. Ingen produkt-pitch."
          source="sentimental-value-effekten"
        />
      </Container>
    </Box>
  );
}

export default SentimentalValueEffektenPage;
