import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Behind the Cast-pillar — historier fra ekte caster gjennom The Role Room.
 * Tre format per dokumentet: talent story, casting director-spotlight,
 * producer-success-story. Hver historie ender i et konkret takeaway-sitat
 * som er optimalisert for AI-citation + LinkedIn-quote-cards.
 *
 * Skal renderes på /bak-castingen på theroleroom.com.
 */

type Story = {
  kind: 'talent' | 'casting-director' | 'producer';
  badge: string;
  headline: string;
  subject: string;
  body: string;
  pullQuote: string;
  attribution: string;
};

const STORIES: Story[] = [
  {
    kind: 'talent',
    badge: 'Talent-historie',
    headline: 'Tre måneder fra Filmskolen til hovedrollen',
    subject: 'Maren, 24',
    body: 'Maren gikk ut av Den Norske Filmskolen i mars. I juni hadde hun hovedrollen i en dramaserie med premiere på NRK. Det skiller henne ikke fra andre nyutdannede skuespillere — det som skilte var én ting: en 90-sekunders selvtape som ikke prøvde å være imponerende. Bare ærlig. Castingdirektøren brukte 14 sekunder før hun la den i shortlist-mappen.',
    pullQuote:
      'Jeg trodde jeg måtte sprenge skjermen. Det jeg trengte var å være helt rolig — og så kjøre én linje med mening.',
    attribution: 'Maren, hovedrolle i NRK-drama, casting via The Role Room',
  },
  {
    kind: 'casting-director',
    badge: 'CD-spotlight',
    headline: '"Det vanskeligste er ikke å finne talent — det er å bevise valget"',
    subject: 'En av Norges mest aktive casting directors',
    body: 'Vi spurte en av landets mest erfarne casting directors hva som faktisk er den vanskeligste delen av jobben i 2026. Svaret hennes overrasket oss. Det er ikke å finne talentet — Norge har for mange dyktige skuespillere relatert til antall produksjoner. Det er å vise produsenten at hun har sett alle, og at det riktige valget er det riktige valget, ikke det trygge.',
    pullQuote:
      'Det er ikke å finne talent. Det er å bevise for produsenten at jeg har sett alle, og at det riktige valget er det riktige valget — ikke det trygge.',
    attribution: 'Casting director, aktiv 18 år i norsk film og TV',
  },
  {
    kind: 'producer',
    badge: 'Produsent-historie',
    headline: '12 statister, 3 dialekter, BankID-verifisert — på 38 timer',
    subject: 'Produsent for nasjonal kommersiell-kampanje',
    body: 'Brief: 12 statister, alle mellom 50 og 70 år, 3 norske dialekter representert (Oslo, Bergen, Tromsø), alle BankID-verifiserte for skattedokumentasjon før innspilling. Vanlig pipeline-tid i bransjen: 5–7 dager med epost, Facebook-grupper og manuell ID-sjekk. Med The Role Room: 38 timer fra brief publisert til shortlist signert. Den største forskjellen var ikke hastighet alene — det var at produsenten slapp å sjekke om noen var ekte.',
    pullQuote:
      'Den største forskjellen var ikke hastighet — det var at jeg slapp å sjekke om noen var ekte.',
    attribution: 'Produsent, kommersiell-kampanje for nasjonalt merkevare, 2026',
  },
];

const KIND_COLOR: Record<Story['kind'], string> = {
  talent: '#f472b6',
  'casting-director': '#a78bfa',
  producer: '#34d399',
};

export function BehindTheCastPage() {
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
      {/* Article-schema JSON-LD for GEO/AI-sitatkilde */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'Bak castingen — ekte historier fra norsk film og TV',
            description:
              'Talent, casting directors og produsenter forteller om castinger gjort gjennom The Role Room. Konkrete eksempler på hva som faktisk fungerer i norsk casting i 2026.',
            author: { '@type': 'Organization', name: 'The Role Room' },
            publisher: {
              '@type': 'Organization',
              name: 'The Role Room',
              logo: { '@type': 'ImageObject', url: 'https://theroleroom.com/logo.png' },
            },
            mainEntityOfPage: 'https://theroleroom.com/bak-castingen',
            inLanguage: 'no',
          }),
        }}
      />

      <Container maxWidth="md">
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <TheaterComedyIcon sx={{ color: '#f472b6' }} />
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
              Bak castingen — pillar 3
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Tre historier fra norsk casting i 2026
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            Tall og pitch overbeviser ingen som allerede har et verktøy. Ekte historier — om talentet
            som ble cast, casteren som måtte forsvare valget sitt, og produsenten som slapp å sjekke
            om noen var ekte — gjør det. Her er tre fra det siste kvartalet, gjengitt med samtykke.
          </Typography>
        </Stack>

        <Stack spacing={3.5} sx={{ mb: 6 }}>
          {STORIES.map((story) => {
            const color = KIND_COLOR[story.kind];
            return (
              <Box
                key={story.headline}
                className="geo-speakable"
                data-speakable="true"
                sx={{
                  p: { xs: 2.5, md: 3.5 },
                  borderRadius: 3,
                  bgcolor: `${color}10`,
                  border: `1px solid ${color}38`,
                }}
              >
                <Chip
                  label={story.badge}
                  size="small"
                  sx={{
                    bgcolor: `${color}25`,
                    color,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontSize: '0.68rem',
                    height: 22,
                    mb: 1.5,
                  }}
                />
                <Typography
                  component="h2"
                  sx={{
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: { xs: '1.3rem', md: '1.55rem' },
                    lineHeight: 1.25,
                    mb: 0.5,
                  }}
                >
                  {story.headline}
                </Typography>
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    mb: 2,
                  }}
                >
                  {story.subject}
                </Typography>
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.78)',
                    fontSize: { xs: '0.95rem', md: '1rem' },
                    lineHeight: 1.7,
                    mb: 2.5,
                  }}
                >
                  {story.body}
                </Typography>
                <Box
                  sx={{
                    borderLeft: `3px solid ${color}`,
                    pl: 2.5,
                    py: 0.5,
                  }}
                >
                  <Typography
                    sx={{
                      color: '#fde68a',
                      fontStyle: 'italic',
                      fontSize: { xs: '1.05rem', md: '1.15rem' },
                      lineHeight: 1.55,
                      fontWeight: 500,
                      mb: 0.75,
                    }}
                  >
                    “{story.pullQuote}”
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', fontWeight: 600 }}>
                    — {story.attribution}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>

        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(244,114,182,0.08)',
            border: '1px solid rgba(244,114,182,0.3)',
            mb: 6,
          }}
        >
          <Typography
            component="h2"
            sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.25rem' }, mb: 1.25 }}
          >
            Vil du være neste historie?
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.95rem', md: '1rem' }, lineHeight: 1.7 }}
          >
            Vi publiserer én ny historie i måneden — anonymt hvis du foretrekker det. Hvis du har
            en casting (gjennom oss eller andre verktøy) som forteller noe om hvordan norsk casting
            faktisk fungerer i 2026, send en mail til daniel@creatorhubn.com. Vi siterer aldri uten
            samtykke.
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få neste historie i innboksen"
          body="Én ny Behind the Cast-historie per måned, sammen med ukens norske casting brief. Aldri lenger enn 4 minutter å lese."
          source="behind-the-cast"
        />
      </Container>
    </Box>
  );
}

export default BehindTheCastPage;
