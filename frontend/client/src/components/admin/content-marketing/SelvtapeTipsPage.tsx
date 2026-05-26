import { Box, Container, Stack, Typography } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * How-To Education-pillar — funnel-top SEO/GEO-side med praktisk selvtape-guide
 * for norske skuespillere. Bygget for å rangere på spørsmål som
 * "hvordan filme selvtape", "tips selvtape audition" og bli sitert av AI
 * når noen spør om hva castere ser etter.
 *
 * Skal renderes på /selvtape-tips på theroleroom.com.
 */

const TIPS: { title: string; body: string; pro: string }[] = [
  {
    title: 'Slate ærlig — 7 sekunder',
    body:
      'Si navnet ditt, alder, og agentur (hvis du har). Ingen forklaring, ingen "takk for muligheten". Castere ser på 50 selvtaper på rad — slate-en din skal ikke prøve å imponere, den skal gi informasjon.',
    pro: 'Slate hodet rett mot linsen og blink to ganger før du starter. Det signaliserer kontroll og rolig nerver.',
  },
  {
    title: 'Stillhet før første replikk — 2 sekunder',
    body:
      'Caster trenger pust før de leser sammen med deg. To hele sekunder mellom slate og første replikk fra scenen er ikke for mye. Det er respekt for prosessen.',
    pro: 'Bruk de 2 sekundene til å bygge karakterens indre tilstand. Castere ser når du tenker, ikke når du later som.',
  },
  {
    title: 'Øynene treffer linsen — ikke partneren',
    body:
      'Hvis du leser med en reader off-camera: be dem stå nært nok til kameraet at øyene dine treffer linsen-aksen, ikke svinger til siden. Linsen er publikum. Avstand 6-10cm fra linsen er normal off-camera-vinkel.',
    pro:
      'Hvis det ikke er mulig: marker en X med tape rett over linsen og bruk den som anchor. Castere godtar dette mye bedre enn et profil-blikk.',
  },
  {
    title: 'Outfits som ikke distraherer',
    body:
      'Solide farger. Aldri rent hvitt (sprenger bildet i autoeksponering). Aldri tett mønster (moiré-effekt på kompresjon). Aldri logoer. Caster skal se ansiktet ditt, ikke t-skjorta.',
    pro:
      'Henfarger til karakteren, ikke kostyme. Hvis rollen er "lærer", er en mørk genser nok. Castere caster en person, ikke en kostymesøker.',
  },
  {
    title: 'Slutt med stillhet — 3 sekunder',
    body:
      'Ikke "tusen takk!", ikke smil, ikke vink. Bare hold karakterens siste tilstand i 3 sekunder, så stopper du. Slutt-stillhet er der castere fanger den ekte versjonen av deg.',
    pro:
      'Pust ut langsomt mens du holder. Det visuelle tegnet på en skuespiller som har vært "ferdig før de stoppet kamera" er noe castere snakker om seg imellom som umiddelbart-positivt.',
  },
];

const TECH_SETUP = [
  { setting: 'Format', value: 'MP4, H.264, 1920×1080, 25fps (Norge / Europa)' },
  { setting: 'Lyd', value: 'Stereo, 48kHz, så lite romklang som mulig — bruk dyne bak kamera' },
  { setting: 'Eksponering', value: 'Hovedlys 45° fra siden, fyll-lys svakere fra motsatt side, ingen bakgrunns-overeksponering' },
  { setting: 'Bakgrunn', value: 'Solid nøytral farge eller jevn vegg. 1-2 meter avstand fra deg til vegg' },
  { setting: 'Komposisjon', value: 'Headshot: skuldre til toppen av panne. Medium: bryst til over hodet' },
  { setting: 'Filnavn', value: 'Fornavn_Etternavn_Rollenavn_Produksjon.mp4 — case caster bruker ikke 30 sek på å finne deg' },
];

export function SelvtapeTipsPage() {
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
            <SchoolIcon sx={{ color: '#34d399' }} />
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
              Selvtape — guide for skuespillere
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.7rem' }, lineHeight: 1.15 }}
          >
            5 ting castere ser etter i selvtaper — selvom de ikke sier det høyt
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            En selvtape er ikke en miniatyr-film. Det er et 90-sekunders kamerasamtale med en caster
            som ser deg neste. Vi har spurt norske casting directors hva de plukker opp på umiddelbart
            — her er fem konkrete signaler og hvordan du leverer dem uten å virke beregnet.
          </Typography>
        </Stack>

        <Stack spacing={2.5} sx={{ mb: 6 }}>
          {TIPS.map((tip, idx) => (
            <Box
              key={tip.title}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(52,211,153,0.05)',
                border: '1px solid rgba(52,211,153,0.22)',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    minWidth: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: 'rgba(52,211,153,0.15)',
                    color: '#34d399',
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
                    {tip.title}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.92rem', md: '0.98rem' }, lineHeight: 1.65, mb: 1.5 }}>
                    {tip.body}
                  </Typography>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'rgba(52,211,153,0.08)',
                      borderLeft: '3px solid #34d399',
                    }}
                  >
                    <Typography sx={{ color: '#86efac', fontWeight: 700, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>
                      Pro-trikset
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                      {tip.pro}
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>

        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.3rem', md: '1.5rem' }, mb: 2 }}>
          Teknisk: 6 innstillinger som skiller proff fra amatør
        </Typography>
        <Box
          sx={{
            mb: 6,
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          {TECH_SETUP.map((row, idx) => (
            <Stack
              key={row.setting}
              direction={{ xs: 'column', sm: 'row' }}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 1.5, md: 2 },
                bgcolor: idx % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
                borderBottom: idx < TECH_SETUP.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <Typography sx={{ color: '#86efac', fontWeight: 700, fontSize: '0.85rem', minWidth: 160 }}>
                {row.setting}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.88rem', lineHeight: 1.55 }}>
                {row.value}
              </Typography>
            </Stack>
          ))}
        </Box>

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
            Last opp selvtape direkte i The Role Room
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.95rem', md: '1rem' }, lineHeight: 1.7 }}
          >
            Skuespillere som har profil i The Role Room kan spille inn selvtape direkte i nettleseren,
            samtidig som de ser scenen, og levere uten å laste opp eksternt. Casting directors får
            alle opptak per rolle samlet — uten å lete i Vimeo-mapper. Gratis å bruke som skuespiller.
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få ukentlige selvtape-tips fra norske castere"
          body="Norwegian Casting Brief sender én konkret skuespiller-tipsfra et faktisk audition hver uke — anonyme cases, alltid praktiske."
          source="selvtape-tips"
        />
      </Container>
    </Box>
  );
}

export default SelvtapeTipsPage;
