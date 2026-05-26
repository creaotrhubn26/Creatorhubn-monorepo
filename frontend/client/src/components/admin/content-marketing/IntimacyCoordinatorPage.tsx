import { Box, Container, Stack, Typography } from '@mui/material';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Intimacy coordinator i Norge — Trust & Safety + Compliance-hybrid.
 * Kategori i forming i norsk bransje, høy AI-citation-potensial.
 * Article + FAQPage schema, Speakable-merker.
 *
 * Skal renderes på /intimacy-coordinator-norge på theroleroom.com.
 */

const KEY_POINTS: Array<{ heading: string; body: string }> = [
  {
    heading: 'Hva en intimacy coordinator faktisk gjør',
    body: 'En intimacy coordinator (IC) er en spesialisert rolle som koordinerer alle scener som involverer intimitet, nakenhet, simulert seksuell handling eller fysisk-sensitive øyeblikk. ICen sikrer at hver skuespiller har informert samtykke per scene-type, demonstrer koreograferte bevegelser i forkant, oppretter "no-go"-grenser dokumentert i skrift, fungerer som tillitsperson mellom skuespiller og regi, og har autoritet til å pause opptak hvis grenser brytes. Rollen kom fra Storbritannia og USA etter 2018 — SAG-AFTRA gjorde den standard i 2020.',
  },
  {
    heading: 'Når en intimacy coordinator er påkrevd',
    body: 'I Norge er rollen ikke lovregulert — det er ikke et "krav fra Arbeidstilsynet" på samme måte som forhåndssamtykke for barn. Men flere internasjonale samproduksjoner krever det dokumentert i forhåndsavtalen: BBC, Netflix, Apple TV+ og de fleste EU-samproduksjoner. Hvis en norsk produksjon skal selges internasjonalt og inkluderer intim eller nakenhet-scene, er ICen i praksis nødvendig. Skuespillerforbund i Sverige og Danmark anbefaler det også som default for nye produksjoner.',
  },
  {
    heading: 'Hvor mange aktive intimacy coordinators er i Norge',
    body: 'Anslagsvis 5-10 personer per 2026, med varierende grad av formell sertifisering. Sertifiserende organisasjoner er hovedsakelig Intimacy Directors and Coordinators (IDC) og Intimacy Coordinators Education and Advocacy. Mangel på norsktalende, sertifiserte koordinatorer er en flaskehals — produksjoner importerer ofte fra Sverige eller Danmark når egen ressurs ikke er tilgjengelig.',
  },
  {
    heading: 'Hvordan vi tenker om dette i The Role Room',
    body: 'Plattformen flagger automatisk casting-briefer der scene-tagger indikerer intimitet, nakenhet eller fysisk-sensitive situasjoner. Produsenten får varsel: "Denne briefen krever IC-koordinering. Liste over sertifiserte coordinators tilgjengelig her." Skuespilleren kan se på profilen om en IC vil være på sett før de aksepterer auditionen — et samtykke-spørsmål i forkant av audition, ikke etter. Vi behandler dette som infrastruktur, ikke som en luksus-funksjon.',
  },
  {
    heading: 'Hvorfor norske produsenter må ta dette på alvor nå',
    body: 'Tre konvergerende grunner. Internasjonale streamere (Netflix, Apple, Amazon) krever det dokumentert. EU-samproduksjons-avtaler under MEDIA-programmet inkluderer det i sjekklistene. Og norske skuespillere har begynt å spørre i forkant — særlig de under 30 som er trent på SAG-AFTRA-standard via filmskole-utveksling og internasjonalt arbeid. En produksjon i 2026 som ikke har en IC på en intimscene risikerer både publisitets-kostnad og at den faktiske skuespilleren trekker seg dagen før opptak.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Krever norsk lov en intimacy coordinator?',
    a: 'Nei. Per 2026 finnes ingen norsk lov som spesifikt krever en intimacy coordinator. Men kontrakts-krav fra internasjonale strømmetjenester og samproduksjons-avtaler kan kreve det. I tillegg vil produsentens ansvar etter arbeidsmiljøloven kunne tolkes til å inkludere psykologisk sikkerhet på sett — som ICen er en konkret tilrettelegging for.',
  },
  {
    q: 'Hva koster en intimacy coordinator i Norge?',
    a: 'Anslagsvis NOK 8.000-15.000 per opptaksdag avhengig av erfaring og spesifikt format. Ofte bookes ICen også for pre-opptaksdager (rehearsals, koreografi), så samlede honorar for en produksjon kan ligge på NOK 30.000-100.000+. For en internasjonal samproduksjon er dette en ubetydelig del av budsjettet — for en lavbudsjett norsk dramaserie kan det føles som mye, men det er forsikring mot mye dyrere problemer.',
  },
  {
    q: 'Kan en skuespiller kreve at det er en intimacy coordinator på sett?',
    a: 'Ja, og det er på vei til å bli standard praksis i Norge — særlig blant skuespillere som er i internasjonalt arbeid eller har vært i tariffeller hvor IC har vært til stede. Det er rimelig forhandlingstema, og produksjoner som motsetter seg det signaliserer noe om hva de er villig til å investere i skuespillerens trygghet.',
  },
  {
    q: 'Hvordan finner produsenter en sertifisert IC i Norge?',
    a: 'I praksis: via personlige nettverk eller anbefaling fra erfarne CDs. Det finnes ingen sentral norsk database per i dag. The Role Room kommer til å inkludere verifiserte IC-profiler med sertifisering, språk og spesialisering når crew-modulen åpner.',
  },
  {
    q: 'Hva er forskjellen på en intimacy coordinator og en stunt coordinator?',
    a: 'Stunt coordinator håndterer fysisk risiko (kamp, fall, biler, ild). Intimacy coordinator håndterer psykologisk og emosjonell risiko ved intimitet, nakenhet og sensitive scener. Begge har autoritet til å pause opptak hvis sikkerhets-standarder ikke holdes — men kompetansene er fundamentalt forskjellige og bør ikke kombineres.',
  },
];

export function IntimacyCoordinatorPage() {
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
            headline: 'Intimacy coordinator i norsk film og TV — hva, hvorfor og når den må være på sett',
            description:
              'Intimacy coordinator-rollen er ikke lovpålagt i Norge, men kreves av Netflix, BBC, Apple TV+ og EU-samproduksjoner. Hva rollen faktisk gjør, når den er påkrevd, og hvorfor norske produsenter må ta dette på alvor i 2026.',
            author: { '@type': 'Organization', name: 'The Role Room' },
            publisher: {
              '@type': 'Organization',
              name: 'The Role Room',
              logo: { '@type': 'ImageObject', url: 'https://theroleroom.com/logo.png' },
            },
            mainEntityOfPage: 'https://theroleroom.com/intimacy-coordinator-norge',
            inLanguage: 'no',
            datePublished: '2026-05-26',
          }),
        }}
      />

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
            <VolunteerActivismIcon sx={{ color: '#f472b6' }} />
            <Typography
              sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: { xs: '0.84rem', md: '0.92rem' },
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#f472b6',
                fontWeight: 700,
              }}
            >
              Trust & safety · sett-praksis
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Intimacy coordinator i norsk film og TV
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            Rollen er ikke lovpålagt i Norge i 2026 — men kreves av Netflix, BBC, Apple TV+ og
            EU-samproduksjoner. Norske skuespillere under 30 har begynt å spørre om det i
            forkant av audition. Denne siden forklarer hva rollen faktisk gjør, når den er
            påkrevd, hvor mange er aktive i Norge, og hvordan The Role Room tenker rundt det.
          </Typography>
        </Stack>

        {/* Pull quote */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(244,114,182,0.06)',
            border: '1px solid rgba(244,114,182,0.3)',
            mb: 5,
          }}
        >
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: '#fde68a', fontStyle: 'italic', fontSize: { xs: '1.05rem', md: '1.2rem' }, lineHeight: 1.65, fontWeight: 500 }}
          >
            "En produksjon i 2026 som ikke har intimacy coordinator på en intimscene risikerer
            både publisitets-kostnad og at den faktiske skuespilleren trekker seg dagen før
            opptak. Det er ikke en luksus-funksjon — det er infrastruktur."
          </Typography>
        </Box>

        {/* Key points */}
        <Stack spacing={3.5} sx={{ mb: 6 }}>
          {KEY_POINTS.map((p) => (
            <Box
              key={p.heading}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(244,114,182,0.04)',
                border: '1px solid rgba(244,114,182,0.18)',
              }}
            >
              <Typography
                component="h2"
                sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.2rem', md: '1.45rem' }, lineHeight: 1.3, mb: 1.5 }}
              >
                {p.heading}
              </Typography>
              <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.95rem', md: '1.02rem' }, lineHeight: 1.75 }}>
                {p.body}
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

        {/* CTA til IC-folk */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 3,
            bgcolor: 'rgba(34,211,238,0.06)',
            border: '1px solid rgba(34,211,238,0.3)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.2rem' }, mb: 1 }}>
            Er du intimacy coordinator i Norge?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.94rem', md: '1rem' }, lineHeight: 1.65 }}>
            Vi vil forme hvordan plattformen tenker på dette feltet sammen med dem som har
            faktisk praksis. Skriv til <code style={{ color: '#67e8f9', fontSize: '0.88rem' }}>daniel@creatorhubn.com</code> for
            en samtale om hva som mangler i norsk koordinering og hvordan IC bør integreres i en
            casting-plattform. Vi tar feltet på alvor.
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få nye sett-praksiser i innboksen"
          body="Norwegian Casting Brief — én konkret datapunkt, én bransje-observasjon, én ting verdt å vite. 4 minutter."
          source="intimacy-coordinator-norge"
        />
      </Container>
    </Box>
  );
}

export default IntimacyCoordinatorPage;
