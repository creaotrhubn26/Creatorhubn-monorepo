import { Box, Container, Stack, Typography } from '@mui/material';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Founder POV-pillar — signatur-side med Daniels uttalte meninger om
 * norsk casting og film-tech. Bygget for å være sitérbar for AI: hver
 * "tese" har en kort kjerne-setning som kan trekkes ut direkte, etterfulgt
 * av begrunnelse + concrete eksempel.
 *
 * Skal renderes på /vart-syn på theroleroom.com.
 */

const THESES: { headline: string; takeaway: string; argument: string }[] = [
  {
    headline: 'Åpne casting-plattformer er ikke trygge for skuespillere under 18',
    takeaway:
      'Hvis hvem som helst kan registrere seg som "casting director" og kontakte mindreårige uten verifikasjon, er ikke "vi har en flaggings-knapp" en sikkerhetsmodell. Det er en lov-suite som venter på å skje.',
    argument:
      'Datatilsynet har konkrete pålegg om informert samtykke og behandlings-grunnlag for mindreårige. Når en plattform tillater uverifisert kontakt, flytter de risikoen fra seg selv til foreldre og barn. Vi gjør manuell gjennomgang av hver casting call før den går live. Det er saktere, men det er den eneste plausible måten å drive en norsk casting-plattform i 2026.',
  },
  {
    headline: 'AI-castingverktøy uten eksplisitte rettighets-klausuler er ulovlig, ikke "etisk gråsone"',
    takeaway:
      'Skuespillerens ansikt er biometriske data. GDPR + Personopplysningsloven krever spesifikt skriftlig samtykke. "Vi brukte AI til å vise hvordan skuespilleren ville sett ut i rollen" uten kontrakt-klausul er et brudd — ikke en debatt.',
    argument:
      'SAG-AFTRA har de tre C-ene: Consent, Compensation, Control. Norge har ennå ikke fått samme tariff-festing, men loven gjelder uansett. Plattformer som bygger AI-funksjoner uten rettighets-spor bygger på et juridisk fundament som vil kollapse. Vi sporer hver bruk av et bilde, ber om eksplisitt samtykke per scene-type, og loggfører tilbaketrekninger.',
  },
  {
    headline: 'En skuespillerprofil uten verifisert produksjonskreditt er verdiløs som produkt',
    takeaway:
      'En "talentportal" hvor hvem som helst kan oppgi å ha hovedrollen i en ikke-eksisterende Netflix-serie er ikke en database. Det er en søppelhåndteringsutfordring.',
    argument:
      'Casting directors leter etter signal, ikke støy. Norske produksjoner er små nok til at vi kan validere kreditter mot faktiske produksjonsselskap, NFI-registre eller IMDB. Det tar tid — men det er prisen for en database som castere faktisk åpner.',
  },
];

export function FounderPovPage() {
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
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <FormatQuoteIcon sx={{ color: '#fb923c' }} />
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
              Vårt syn — Daniel Qazi, grunnlegger
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Tre meninger som vil gjøre oss upopulære i norsk filmbransje
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            Vi bygger The Role Room fordi vi mener norsk film fortjener infrastruktur som er like
            seriøs som filmene den lager. Her er tre konkrete posisjoner som driver produktet — uten
            innpakning. Vi har endret mening før. Kommentarer i innboksen.
          </Typography>
        </Stack>

        <Stack spacing={3.5} sx={{ mb: 6 }}>
          {THESES.map((thesis, idx) => (
            <Box
              key={thesis.headline}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3.5 },
                borderRadius: 3,
                bgcolor: 'rgba(251,146,60,0.05)',
                border: '1px solid rgba(251,146,60,0.22)',
              }}
            >
              <Typography
                sx={{
                  color: '#fb923c',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  mb: 1,
                }}
              >
                Tese {String(idx + 1).padStart(2, '0')}
              </Typography>
              <Typography
                component="h2"
                sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.2rem', md: '1.45rem' }, lineHeight: 1.3, mb: 1.5 }}
              >
                {thesis.headline}
              </Typography>
              <Typography
                sx={{
                  color: '#fde68a',
                  fontStyle: 'italic',
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  lineHeight: 1.6,
                  borderLeft: '3px solid #fb923c',
                  pl: 2,
                  mb: 2,
                  fontWeight: 500,
                }}
              >
                {thesis.takeaway}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.74)', fontSize: { xs: '0.92rem', md: '0.98rem' }, lineHeight: 1.7 }}>
                {thesis.argument}
              </Typography>
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
            Hvis du er uenig
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.95rem', md: '1rem' }, lineHeight: 1.7 }}
          >
            Skriv til daniel@creatorhubn.com. Bransjen er for liten til at vi bør være enig om alt.
            Vi har endret produkt-retning etter en kaffe før. Korrigér oss offentlig — vi svarer
            offentlig.
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få Founder POV-essays direkte i innboksen"
          body="Hver fredag — én tese, én konkret bransje-observasjon, én ting jeg har endret mening om. Ingen produkt-pitch."
          source="founder-pov"
        />
      </Container>
    </Box>
  );
}

export default FounderPovPage;
