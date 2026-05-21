// @ts-nocheck
/**
 * ShowcaseConversionFooter — Slice 9X.81
 *
 * Footer-seksjon på showcase-pages med tre konverterings-elementer:
 *  - Testimonials (sosialt bevis)
 *  - FAQ (reduserer support-spørsmål)
 *  - Sticky CTA-knapp (kontakt) som vises når brukeren scroller forbi
 *    første viewport
 *
 * Data hentes per fotograf hvis tilgjengelig; ellers stand-in-content
 * basert på profesjon. UI er progressivt — om vi mangler data, vises
 * bare CTA-knappen.
 */

import React from 'react';
import {
  Box, Container, Typography, Grid, Card, CardContent, Stack, Avatar,
  Accordion, AccordionSummary, AccordionDetails, Button, Fab, Zoom,
  useScrollTrigger, Rating,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Email as EmailIcon,
  FormatQuote as QuoteIcon,
} from '@mui/icons-material';

type ShowcaseProfession = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';

interface Testimonial {
  id: string;
  author: string;
  role?: string;
  text: string;
  rating?: number;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface Props {
  profession: ShowcaseProfession;
  displayName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  onContactClick?: () => void;
  /** Hvis fotografens egne testimonials finnes — overstyrer profession-defaults */
  testimonials?: Testimonial[];
  /** Hvis fotografens egne FAQs finnes — overstyrer profession-defaults */
  faqs?: FAQItem[];
}

const PROFESSION_FAQ_DEFAULTS: Record<ShowcaseProfession, FAQItem[]> = {
  photographer: [
    { id: 'q1', question: 'Hvor lang er leveringstiden på bildene?', answer: 'Du får forhåndsvisning innen 7 dager etter shoot. Endelig redigert galleri leveres innen 4-6 uker.' },
    { id: 'q2', question: 'Får jeg fullrettigheter til bildene?', answer: 'Du får personlig bruksrett til alle leverte bilder (sosiale medier, print, deling). Kommersiell bruk og videresalg krever egen avtale.' },
    { id: 'q3', question: 'Hva skjer hvis vi må avlyse?', answer: 'Avbestilling mer enn 30 dager før shoot: full refundering minus depositum. 7-30 dager: 50% refundering. Mindre enn 7 dager: ingen refundering, men vi flytter datoen om mulig.' },
    { id: 'q4', question: 'Hvilket utstyr bruker du?', answer: 'Profesjonelt kamerautstyr med backup. Spør gjerne om spesifikke modeller hvis du er interessert i tekniske detaljer.' },
  ],
  videographer: [
    { id: 'q1', question: 'Hvor lang er leveringstiden?', answer: 'Trailer leveres innen 2 uker. Fullfilm levres innen 8-10 uker etter shoot.' },
    { id: 'q2', question: 'Får jeg råopptaket?', answer: 'Råfiler leveres på forespørsel mot tilleggspris. Standard er kun ferdig redigert versjon.' },
    { id: 'q3', question: 'Kan dere filme på flere lokasjoner?', answer: 'Ja, vi tar med utstyr til opptil 3 lokasjoner. Reise utenfor Oslo-området faktureres separat etter avtale.' },
    { id: 'q4', question: 'Hvilket format leveres filmen i?', answer: '4K mp4 for digital deling + master-fil i ProRes for arkiv. Vertikal-versjon (TikTok/Reels) tilgjengelig som tillegg.' },
  ],
  music_producer: [
    { id: 'q1', question: 'Hvor lang tid tar mixing og mastering?', answer: 'Standard turnaround er 2-3 uker per låt. Express-tilbud (5 dager) tilgjengelig mot tillegg.' },
    { id: 'q2', question: 'Hvor mange revisjoner inkluderes?', answer: 'Inntil 3 revisjoner per låt er inkludert. Ytterligere endringer kostar etter avtalt timepris.' },
    { id: 'q3', question: 'Hvilke filformater leverer dere?', answer: 'WAV 24-bit/48kHz som standard. MP3, FLAC, eller streaming-optimaliserte formater på forespørsel.' },
    { id: 'q4', question: 'Eier jeg masterene?', answer: 'Ja, du beholder full eierskap til både master og publishing. Vi tar betalt for tjenesten, ikke rettigheter.' },
  ],
  vendor: [
    { id: 'q1', question: 'Hva er leveringstiden?', answer: 'Avhenger av produkt. Standardvarer 3-5 virkedager, skreddersydd 2-4 uker.' },
    { id: 'q2', question: 'Hva er retur-policyen?', answer: '14 dagers angrefrist på ubrukte varer i original-emballasje. Skreddersydd kan ikke returneres.' },
  ],
  enterprise: [],
};

const PROFESSION_TESTIMONIAL_DEFAULTS: Record<ShowcaseProfession, Testimonial[]> = {
  photographer: [
    { id: 't1', author: 'Familien Berg', role: 'Bryllup, Oslo', text: 'Vi fikk bilder som virkelig fanget følelsene fra dagen. Profesjonell, men også varm og imøtekommende.', rating: 5 },
    { id: 't2', author: 'Maria K.', role: 'Familiefoto', text: 'Barna mine elsket henne. Naturlige bilder uten å føle seg posert.', rating: 5 },
  ],
  videographer: [
    { id: 't1', author: 'Lars & Eva', role: 'Bryllupsvideo', text: 'Filmen ble en gave vi vil se på i mange år. Hvert moment ble fanget.', rating: 5 },
  ],
  music_producer: [
    { id: 't1', author: 'Studio Nord', role: 'Indie-band', text: 'Mixen løftet låten vår til et profesjonelt nivå. Klart bedre enn forrige produsent.', rating: 5 },
  ],
  vendor: [],
  enterprise: [],
};

function ShowcaseConversionFooter(props: Props) {
  const {
    profession,
    displayName,
    contactEmail,
    contactPhone,
    onContactClick,
    testimonials,
    faqs,
  } = props;

  const resolvedTestimonials = testimonials?.length ? testimonials : PROFESSION_TESTIMONIAL_DEFAULTS[profession] || [];
  const resolvedFaqs = faqs?.length ? faqs : PROFESSION_FAQ_DEFAULTS[profession] || [];
  const showTestimonials = resolvedTestimonials.length > 0;
  const showFaqs = resolvedFaqs.length > 0;

  // Sticky-CTA dukker opp når brukeren har scrollet > 400px
  const showStickyCta = useScrollTrigger({ disableHysteresis: true, threshold: 400 });

  const handleContact = React.useCallback(() => {
    if (onContactClick) {
      onContactClick();
      return;
    }
    if (contactEmail) {
      window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent('Forespørsel fra showcase')}`;
    }
  }, [onContactClick, contactEmail]);

  return (
    <Box component="section" sx={{ pt: 8, pb: 12 }}>
      <Container maxWidth="lg">
        {/* Testimonials */}
        {showTestimonials && (
          <Box sx={{ mb: 8 }}>
            <Typography
              variant="h4"
              align="center"
              sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}
            >
              Det kunder sier
            </Typography>
            <Typography
              variant="body1"
              align="center"
              sx={{ color: 'text.secondary', mb: 4 }}
            >
              Erfaringer fra tidligere samarbeid
            </Typography>
            <Grid container spacing={3}>
              {resolvedTestimonials.map((t) => (
                <Grid item xs={12} md={6} key={t.id}>
                  <Card
                    sx={{
                      height: '100%',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 3,
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <QuoteIcon sx={{ color: 'rgba(255,186,108,0.32)', fontSize: 32, mb: 1 }} />
                      {t.rating && (
                        <Rating
                          value={t.rating}
                          readOnly
                          size="small"
                          sx={{ mb: 1.5, '& .MuiRating-iconFilled': { color: '#ffba6c' } }}
                          aria-label={`${t.rating} av 5 stjerner`}
                        />
                      )}
                      <Typography
                        variant="body1"
                        sx={{
                          color: 'text.primary',
                          fontStyle: 'italic',
                          mb: 2,
                          lineHeight: 1.6,
                        }}
                      >
                        "{t.text}"
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar
                          sx={{
                            bgcolor: 'rgba(255,186,108,0.18)',
                            color: '#ffba6c',
                            fontWeight: 700,
                            width: 36,
                            height: 36,
                          }}
                        >
                          {t.author.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {t.author}
                          </Typography>
                          {t.role && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {t.role}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* FAQ */}
        {showFaqs && (
          <Box sx={{ mb: 8 }}>
            <Typography
              variant="h4"
              align="center"
              sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}
            >
              Ofte stilte spørsmål
            </Typography>
            <Typography
              variant="body1"
              align="center"
              sx={{ color: 'text.secondary', mb: 4 }}
            >
              Finner du ikke svar på det du lurer på? Send en melding.
            </Typography>
            <Box sx={{ maxWidth: 720, mx: 'auto' }}>
              {resolvedFaqs.map((faq) => (
                <Accordion
                  key={faq.id}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    mb: 1.5,
                    '&::before': { display: 'none' },
                    borderRadius: '12px !important',
                    overflow: 'hidden',
                  }}
                  TransitionProps={{ unmountOnExit: true }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={{ color: 'text.primary' }} />}
                    aria-controls={`faq-${faq.id}-content`}
                    id={`faq-${faq.id}-header`}
                    sx={{ minHeight: 56 }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {faq.question}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails id={`faq-${faq.id}-content`}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.65 }}>
                      {faq.answer}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </Box>
        )}

        {/* Inline CTA — endelig kontakt-blokk */}
        <Box
          sx={{
            mt: 4,
            p: { xs: 4, md: 6 },
            borderRadius: 4,
            background: 'linear-gradient(135deg, rgba(255,186,108,0.15), rgba(255,186,108,0.04))',
            border: '1px solid rgba(255,186,108,0.32)',
            textAlign: 'center',
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
            {displayName ? `Klar for å samarbeide med ${displayName}?` : 'Klar for å starte ditt prosjekt?'}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3, maxWidth: 480, mx: 'auto' }}>
            Send en uforpliktende forespørsel — svar vanligvis innen 24 timer.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              startIcon={<EmailIcon />}
              onClick={handleContact}
              sx={{
                bgcolor: '#ffba6c',
                color: '#150d05',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                borderRadius: '999px',
                textTransform: 'none',
                '&:hover': { bgcolor: '#ffc788' },
              }}
            >
              Send forespørsel
            </Button>
            {contactPhone && (
              <Button
                variant="outlined"
                size="large"
                href={`tel:${contactPhone}`}
                sx={{
                  color: 'text.primary',
                  borderColor: 'rgba(255,255,255,0.32)',
                  px: 4,
                  py: 1.5,
                  borderRadius: '999px',
                  textTransform: 'none',
                  '&:hover': { borderColor: '#ffba6c' },
                }}
              >
                Ring {contactPhone}
              </Button>
            )}
          </Stack>
        </Box>
      </Container>

      {/* Sticky CTA — vises etter scroll > 400px */}
      <Zoom in={showStickyCta}>
        <Fab
          variant="extended"
          onClick={handleContact}
          aria-label="Send forespørsel"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1100,
            bgcolor: '#ffba6c',
            color: '#150d05',
            fontWeight: 700,
            textTransform: 'none',
            px: 3,
            '&:hover': { bgcolor: '#ffc788' },
          }}
        >
          <EmailIcon sx={{ mr: 1 }} />
          Send forespørsel
        </Fab>
      </Zoom>
    </Box>
  );
}

export default ShowcaseConversionFooter;
