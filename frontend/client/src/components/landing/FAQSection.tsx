import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import { ExpandMore, Help } from '@mui/icons-material';

interface FAQItem {
  question: string;
  answer: string;
  category?: string;
}

const faqData: FAQItem[] = [
  {
    question: 'Er CreatorHub Norge gratis?',
    answer: 'CreatorHub Norge tilbyr både gratis og betalte planer. Du kan starte med en gratis konto for å utforske plattformen. For profesjonelle funksjoner som StoryArc Studio, avansert prosjektadministrasjon og prioriterte integrasjoner, tilbyr vi betalte abonnementer.',
    category: 'Pris',
  },
  {
    question: 'Hvordan kommer jeg i gang?',
    answer: 'Klikk på "Kom i Gang" knappen og velg din kreative rolle (fotograf, videograf, musikkprodusent eller leverandør). Du vil bli guidet gjennom en enkel onboarding-prosess. Etterpå kan du umiddelbart begynne å bruke plattformen.',
    category: 'Komme i gang',
  },
  {
    question: 'Hvilke yrker støttes?',
    answer: 'Vi støtter primært fotografer, videografer, musikkprodusenter og leverandører. Plattformen er designet spesielt for norske kreative fagfolk og tilbyr verktøy og funksjoner som er relevante for disse profesjonene.',
    category: 'Funksjoner',
  },
  {
    question: 'Trenger jeg Google Workspace?',
    answer: 'Nei, Google Workspace er ikke påkrevd, men vi anbefaler det sterkt. Integrasjonen med Google Workspace gir deg sømløs synkronisering med Gmail, Google Drive, Calendar og Docs, noe som gjør arbeidsflyten din mye mer effektiv.',
    category: 'Integrasjoner',
  },
  {
    question: 'Hva er StoryArc Studio?',
    answer: 'StoryArc Studio er vår avanserte videoredigeringsløsning som analyserer innholdet ditt og genererer story arcs automatisk. Du kan eksportere direkte til DaVinci Resolve, Final Cut Pro og Premiere Pro. Det er inkludert i våre profesjonelle planer.',
    category: 'Funksjoner',
  },
  {
    question: 'Kan jeg bruke plattformen på mobil?',
    answer: 'Ja! CreatorHub Norge er fullt responsiv og fungerer utmerket på mobil, nettbrett og desktop. Vi har også dedikerte mobile funksjoner for å håndtere prosjekter på farten.',
    category: 'Plattform',
  },
  {
    question: 'Hva er Academy?',
    answer: 'Academy er vår læringsplattform hvor du kan ta kurs, se tutorials og lære nye ferdigheter. Vi tilbyr innhold spesielt designet for kreative fagfolk i Norge, fra grunnleggende teknikker til avanserte metoder.',
    category: 'Funksjoner',
  },
  {
    question: 'Hvordan fungerer Community?',
    answer: 'Community er et sted hvor norske kreative kan møtes, dele erfaringer, stille spørsmål og samarbeide. Det er en støttende miljø for å vokse sammen som profesjonelle.',
    category: 'Funksjoner',
  },
];

const FAQSection: React.FC = () => {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const categories = Array.from(new Set(faqData.map(item => item.category).filter(Boolean)));

  return (
    <Box
      sx={{
        py: { xs: 8, md: 12 },
        background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.95) 100%)',
      }}
    >
      <Container maxWidth="lg">
        {/* Section Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2.5,
              py: 1,
              mb: 3,
              borderRadius: '50px',
              background: 'linear-gradient(135deg, rgba(251,146,60,0.15) 0%, rgba(234,88,12,0.1) 100%)',
              border: '1px solid rgba(251,146,60,0.3)',
            }}
          >
            <Help sx={{ fontSize: 18, color: '#ea580c' }} />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: '#ea580c',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '0.75rem',
              }}
            >
              Ofte Stilte Spørsmål
            </Typography>
          </Box>

          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              color: '#1f2937',
              mb: 2,
              fontSize: { xs: '2rem', md: '2.75rem' },
              lineHeight: 1.2,
            }}
          >
            Spørsmål?{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #fb923c 0%, #ea580c 50%, #c2410c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Vi har svarene
            </Box>
          </Typography>

          <Typography
            variant="h6"
            sx={{
              color: '#6b7280',
              maxWidth: '600px',
              mx: 'auto',
              lineHeight: 1.8,
              fontWeight: 400,
            }}
          >
            Finn raskt svar på de vanligste spørsmålene om CreatorHub Norge
          </Typography>
        </Box>

        {/* FAQ Accordion */}
        <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
          {faqData.map((item, index) => (
            <Accordion
              key={index}
              expanded={expanded === `panel${index}`}
              onChange={handleChange(`panel${index}`)}
              sx={{
                mb: 2,
                borderRadius: '16px !important',
                border: '1px solid rgba(255,140,0,0.1)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                '&:before': { display: 'none' },
                '&.Mui-expanded': {
                  boxShadow: '0 8px 24px rgba(255,140,0,0.15)',
                  border: '1px solid rgba(255,140,0,0.2)',
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore sx={{ color: '#ff8c00' }} />}
                sx={{
                  px: 3,
                  py: 2,
                  '&.Mui-expanded': {
                    borderBottom: '1px solid rgba(255,140,0,0.1)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  {item.category && (
                    <Chip
                      label={item.category}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255,140,0,0.1)',
                        color: '#ea580c',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: '24px',
                      }}
                    />
                  )}
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: '#1f2937',
                      flex: 1,
                      fontSize: { xs: '1rem', md: '1.125rem' },
                    }}
                  >
                    {item.question}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, py: 3 }}>
                <Typography
                  variant="body1"
                  sx={{
                    color: '#4b5563',
                    lineHeight: 1.8,
                    fontSize: '1rem',
                  }}
                >
                  {item.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

        {/* Contact CTA */}
        <Box sx={{ textAlign: 'center', mt: 6 }}>
          <Typography variant="body1" sx={{ color: '#6b7280', mb: 2 }}>
            Fant du ikke svaret du lette etter?
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: '#ff8c00',
              fontWeight: 600,
              '& a': {
                color: '#ff8c00',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              },
            }}
          >
            Kontakt oss på{' '}
            <Box component="a" href="mailto:support@creatorhubn.com">
              support@creatorhubn.com
            </Box>
            {' '}eller besøk{' '}
            <Box component="a" href="/help">
              hjelpesenteret
            </Box>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default FAQSection;




