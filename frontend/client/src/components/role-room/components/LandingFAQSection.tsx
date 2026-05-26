import { Box, Container, Typography } from '@mui/material';

/**
 * FAQ-seksjon synlig på landingssiden. Innholdet speiler FAQPage JSON-LD
 * i theroleroom.html slik at AI-modeller (ChatGPT, Perplexity, Google AI
 * Overview, Claude) får både strukturerte data og synlig sitérbar tekst.
 *
 * data-speakable peker til Speakable-spec i AboutPage-schema og lar
 * voice-assistenter (Google Assistant, Alexa) lese opp svarene.
 */

interface FAQItem {
  question: string;
  answer: string;
}

const ROLE_ROOM_FAQ: FAQItem[] = [
  {
    question: 'Hva er The Role Room?',
    answer:
      'The Role Room er en norsk casting- og produksjonsplattform for film, TV og innholdsproduksjon. Plattformen samler roller, kandidater, auditions, manus, storyboard, crew, lokasjoner og opptaksplan i ett arbeidsrom — som nordisk alternativ til StudioBinder, Casting Networks og MovieMagic.',
  },
  {
    question: 'Hvor mye koster The Role Room?',
    answer:
      'Basis-tilgang er gratis og inkluderer prosjekter, casting-pipeline, talent-database, manus, storyboard og audition-planlegging. Betalt Pro-plan låser opp Live Set-modus for opptaksdag, ubegrenset crew og utvidet AI-agent-bruk.',
  },
  {
    question: 'Hvordan skiller The Role Room seg fra StudioBinder?',
    answer:
      'Fire hovedforskjeller: hele appen er på norsk bokmål, data lagres i EU/EØS under GDPR med signert databehandler-avtale, det er en integrert AI-agent uten ekstra abonnement, og det er en dedikert talentportal hvor skuespillere registrerer seg direkte uten per-session-betaling.',
  },
  {
    question: 'Kan filmstudenter bruke The Role Room gratis?',
    answer:
      'Ja. Studenter ved norske film-, TV- og produksjons-utdanninger (Filmskolen, NISS, Westerdals, NTNU og lignende) bruker plattformen gratis for studieoppgaver, eksamensprosjekter og masteroppgaver.',
  },
  {
    question: 'Hvor lagres dataene mine?',
    answer:
      'All kundedata lagres i EU/EØS hos databehandlere som er godkjent under GDPR. The Role Room signerer databehandler-avtale (DPA) med alle kunder og deler ikke data utenfor EU/EØS uten eksplisitt samtykke.',
  },
  {
    question: 'Støtter The Role Room norske barneskuespillere?',
    answer:
      'Ja. Plattformen har innebygd AML-compliance-tracker som overvåker pause-tider og arbeidsregler for mindreårige skuespillere i tråd med norsk arbeidsmiljølov. Foresatt-samtykke og medvirkningsregler håndteres i samtykkemodulen.',
  },
];

export function LandingFAQSection() {
  return (
    <Box
      component="section"
      aria-labelledby="role-room-faq-heading"
      data-testid="role-room-landing-faq"
      sx={{ position: 'relative', zIndex: 2, mt: 10, mb: 6 }}
    >
      <Container maxWidth="md">
        <Typography
          id="role-room-faq-heading"
          component="h2"
          sx={{
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: { xs: '1rem', md: '1.1rem' },
            fontWeight: 700,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            mb: 1.5,
            textAlign: 'center',
            background: 'linear-gradient(90deg, #fff 0%, #8b5cf6 55%, #6366f1 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Ofte stilte spørsmål
        </Typography>
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.72)',
            fontSize: { xs: '0.92rem', md: '1.02rem' },
            maxWidth: 620,
            mx: 'auto',
            lineHeight: 1.6,
            textAlign: 'center',
            mb: 5,
          }}
        >
          Korte svar på det filmskapere, casting-folk og produsenter spør oss om.
        </Typography>
        <Box
          component="dl"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: { xs: 2.5, md: 3 },
            m: 0,
          }}
        >
          {ROLE_ROOM_FAQ.map((item) => (
            <Box
              key={item.question}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Typography
                component="dt"
                sx={{
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: { xs: '1rem', md: '1.05rem' },
                  mb: 1.25,
                  lineHeight: 1.35,
                }}
              >
                {item.question}
              </Typography>
              <Typography
                component="dd"
                sx={{
                  color: 'rgba(255,255,255,0.74)',
                  fontSize: { xs: '0.88rem', md: '0.92rem' },
                  lineHeight: 1.65,
                  m: 0,
                }}
              >
                {item.answer}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

export default LandingFAQSection;
