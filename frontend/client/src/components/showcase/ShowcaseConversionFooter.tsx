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
import { apiRequest } from '@/lib/queryClient';
import ReviewModerationPanel from './ReviewModerationPanel';
import {
  Box, Container, Typography, Grid, Card, CardContent, Stack, Avatar,
  Accordion, AccordionSummary, AccordionDetails, Button, Fab, Zoom,
  useScrollTrigger, Rating, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Email as EmailIcon,
  FormatQuote as QuoteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  CheckCircle,
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
  /**
   * Klient-/offentlig visning. Når false (eier ser sitt eget showcase) skjules
   * de live konverterings-CTA-ene (kontakt-knapp + sticky FAB) siden «send
   * forespørsel til deg selv» er meningsløst. Innholdet (testimonials/FAQ) vises
   * fortsatt så eier kan se/redigere det.
   */
  clientView?: boolean;
  /**
   * Eier-modus: viser «Rediger»-knapper så fotografen kan legge til/fjerne/endre
   * FAQ + testimonials. Lagres per bruker via /api/user/kv.
   */
  editable?: boolean;
  /** Fotografens bruker-id — kobler klient-omtaler til riktig fotograf. */
  photographerId?: string | null;
}

const FOOTER_KV_KEY = 'showcase-conversion-footer';

const editorFieldSx = {
  '& .MuiInputBase-input, & .MuiInputBase-inputMultiline': { color: '#F5F2EA' },
  '& .MuiInputLabel-root': { color: 'rgba(245,242,234,0.6)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#ffba6c' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.18)' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.32)' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffba6c' },
};
const editorAddBtnSx = {
  color: '#ffba6c', textTransform: 'none', mt: 0.5,
  '&:hover': { bgcolor: 'rgba(255,186,108,0.10)' },
};

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
    clientView = true,
    editable = false,
    photographerId,
  } = props;

  // FAQ + omtale-veiledning: eier-redigert (KV). Omtaler: klient-innsendte (API).
  const [customFaqs, setCustomFaqs] = React.useState<FAQItem[] | null>(null);
  const [customPrompts, setCustomPrompts] = React.useState<string[] | null>(null);
  const [customGoogleUrl, setCustomGoogleUrl] = React.useState<string>('');
  const [reviews, setReviews] = React.useState<Testimonial[]>([]);
  const [reviewSummary, setReviewSummary] = React.useState<{ count: number; average: number }>({ count: 0, average: 0 });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await apiRequest(`/api/user/kv/${FOOTER_KV_KEY}`);
        const value = json?.value ?? json?.data ?? null;
        if (cancelled || !value) return;
        if (Array.isArray(value.faqs)) setCustomFaqs(value.faqs);
        if (Array.isArray(value.reviewPrompts)) setCustomPrompts(value.reviewPrompts);
        if (typeof value.googleReviewUrl === 'string') setCustomGoogleUrl(value.googleReviewUrl);
      } catch {
        /* behold defaults */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Eier-konfigurerte veilednings-prompts (hva man ønsker tilbakemelding på).
  const resolvedPrompts = customPrompts ?? [];

  const loadReviews = React.useCallback(async () => {
    if (!photographerId) return;
    try {
      const res = await fetch(`/api/showcase/reviews?photographerId=${encodeURIComponent(photographerId)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json?.reviews)) {
        setReviews(json.reviews.map((r: any) => ({ id: r.id, author: r.author, role: r.role, text: r.text, rating: r.rating, aspectRatings: r.aspectRatings || {}, verified: !!r.verified })));
      }
      if (json?.summary) setReviewSummary({ count: Number(json.summary.count) || 0, average: Number(json.summary.average) || 0 });
    } catch {
      /* ignore */
    }
  }, [photographerId]);

  React.useEffect(() => { void loadReviews(); }, [loadReviews]);

  // Omtaler = publiserte klient-anmeldelser (ingen fabrikerte defaults).
  const resolvedTestimonials = testimonials?.length ? testimonials : reviews;
  const resolvedFaqs = faqs?.length ? faqs : (customFaqs ?? PROFESSION_FAQ_DEFAULTS[profession] ?? []);
  // Omtale-seksjonen vises alltid (omtaler ELLER «legg igjen omtale»-form).
  const showTestimonials = true;
  const showFaqs = editable || resolvedFaqs.length > 0;

  // ── FAQ-editor-state (kun FAQ; omtaler skrives ikke av eier) ─────────────────
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [draftFaqs, setDraftFaqs] = React.useState<FAQItem[]>([]);
  const [draftPrompts, setDraftPrompts] = React.useState<string[]>([]);
  const [draftGoogleUrl, setDraftGoogleUrl] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const openEditor = React.useCallback(() => {
    setDraftFaqs(resolvedFaqs.map((f) => ({ ...f })));
    setDraftPrompts([...resolvedPrompts]);
    setDraftGoogleUrl(customGoogleUrl);
    setEditorOpen(true);
  }, [resolvedFaqs, resolvedPrompts, customGoogleUrl]);

  const saveContent = React.useCallback(async () => {
    setSaving(true);
    try {
      const cleanFaqs = draftFaqs.filter((f) => (f.question || '').trim() || (f.answer || '').trim());
      const cleanPrompts = draftPrompts.map((p) => (p || '').trim()).filter(Boolean);
      const cleanGoogle = draftGoogleUrl.trim();
      await apiRequest(`/api/user/kv/${FOOTER_KV_KEY}`, {
        method: 'POST',
        body: { value: { faqs: cleanFaqs, reviewPrompts: cleanPrompts, googleReviewUrl: cleanGoogle } },
      });
      setCustomFaqs(cleanFaqs); setCustomPrompts(cleanPrompts); setCustomGoogleUrl(cleanGoogle); setEditorOpen(false);
    } catch {
      /* la dialogen stå åpen ved feil */
    } finally {
      setSaving(false);
    }
  }, [draftFaqs, draftPrompts, draftGoogleUrl]);

  // ── Omtale-innsending (klient) ──────────────────────────────────────────────
  const [reviewForm, setReviewForm] = React.useState({ author: '', role: '', text: '', rating: 5, website: '' });
  const [aspectRatings, setAspectRatings] = React.useState<Record<string, number>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [positiveSubmit, setPositiveSubmit] = React.useState(false);

  const submitReview = React.useCallback(async () => {
    if (!photographerId || !reviewForm.author.trim() || !reviewForm.text.trim()) return;
    // Honeypot (#7): bots fyller skjulte felt → dropp stille.
    if (reviewForm.website) { setSubmitted(true); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/showcase/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photographerId,
          author: reviewForm.author,
          role: reviewForm.role,
          text: reviewForm.text,
          rating: reviewForm.rating,
          aspectRatings: resolvedPrompts.length ? aspectRatings : undefined,
          website: reviewForm.website, // honeypot — backend dropper hvis utfylt
        }),
      });
      if (res.ok) {
        const aspectVals = Object.values(aspectRatings);
        const effRating = resolvedPrompts.length && aspectVals.length
          ? aspectVals.reduce((a, b) => a + b, 0) / aspectVals.length
          : reviewForm.rating;
        setPositiveSubmit(effRating >= 4);
        setSubmitted(true);
        setReviewForm({ author: '', role: '', text: '', rating: 5, website: '' });
        setAspectRatings({});
      }
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  }, [photographerId, reviewForm, aspectRatings, resolvedPrompts]);

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
        {editable && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              onClick={openEditor}
              startIcon={<EditIcon />}
              variant="outlined"
              size="small"
              sx={{
                color: '#F5F2EA', borderColor: 'rgba(255,255,255,0.24)',
                textTransform: 'none', borderRadius: '999px',
                '&:hover': { borderColor: '#ffba6c', color: '#ffba6c' },
              }}
            >
              Rediger FAQ & omtale-veiledning
            </Button>
          </Box>
        )}
        {/* Testimonials */}
        {showTestimonials && (
          <Box sx={{ mb: 8 }}>
            {/* SEO (#6) — schema.org rich snippet (stjerner i Google). */}
            {reviewSummary.count > 0 && (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: displayName || 'CreatorHub-fotograf',
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: reviewSummary.average,
                    reviewCount: reviewSummary.count,
                    bestRating: 5,
                  },
                  review: resolvedTestimonials.slice(0, 10).map((t) => ({
                    '@type': 'Review',
                    author: { '@type': 'Person', name: t.author },
                    reviewRating: { '@type': 'Rating', ratingValue: t.rating || 5, bestRating: 5 },
                    reviewBody: t.text,
                  })),
                }) }}
              />
            )}
            <Typography
              variant="h4"
              align="center"
              sx={{ fontWeight: 700, mb: 1, color: '#F5F2EA' }}
            >
              Det kunder sier
            </Typography>
            <Typography
              variant="body1"
              align="center"
              sx={{ color: 'rgba(245,242,234,0.68)', mb: reviewSummary.count > 0 ? 2 : 4 }}
            >
              Erfaringer fra tidligere samarbeid
            </Typography>
            {reviewSummary.count > 0 && (
              <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ mb: 4 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '2rem', color: '#ffba6c', lineHeight: 1 }}>
                  {reviewSummary.average.toFixed(1)}
                </Typography>
                <Box>
                  <Rating value={reviewSummary.average} precision={0.1} readOnly size="small"
                    sx={{ '& .MuiRating-iconFilled': { color: '#ffba6c' }, '& .MuiRating-iconEmpty': { color: 'rgba(255,255,255,0.25)' } }} />
                  <Typography sx={{ color: 'rgba(245,242,234,0.6)', fontSize: '0.8rem' }}>
                    Basert på {reviewSummary.count} {reviewSummary.count === 1 ? 'omtale' : 'omtaler'}
                  </Typography>
                </Box>
              </Stack>
            )}
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
                          color: '#F5F2EA',
                          fontStyle: 'italic',
                          mb: 2,
                          lineHeight: 1.6,
                        }}
                      >
                        "{t.text}"
                      </Typography>
                      {t.reply && (
                        <Typography sx={{ color: 'rgba(245,242,234,0.7)', fontSize: '0.82rem', mb: 2, pl: 1.5, borderLeft: '2px solid rgba(255,186,108,0.6)' }}>
                          <strong style={{ color: '#ffba6c' }}>Svar fra {displayName || 'fotografen'}:</strong> {t.reply}
                        </Typography>
                      )}
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
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F5F2EA' }}>
                              {t.author}
                            </Typography>
                            {t.verified && (
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.1, borderRadius: '999px', bgcolor: 'rgba(95,184,138,0.16)', color: '#5fb88a', fontSize: '0.68rem', fontWeight: 700 }}>
                                <CheckCircle sx={{ fontSize: 12 }} /> Verifisert kunde
                              </Box>
                            )}
                          </Stack>
                          {t.role && (
                            <Typography variant="caption" sx={{ color: 'rgba(245,242,234,0.68)' }}>
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

            {resolvedTestimonials.length === 0 && (
              <Typography align="center" sx={{ color: 'rgba(245,242,234,0.5)', fontStyle: 'italic' }}>
                {clientView ? 'Bli den første til å legge igjen en omtale.' : 'Ingen omtaler ennå — kundene dine kan legge igjen anmeldelser her.'}
              </Typography>
            )}

            {clientView && (
              <Box sx={{ maxWidth: 560, mx: 'auto', mt: 5, p: 3, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                {submitted ? (
                  <Stack spacing={2} alignItems="center">
                    <Typography align="center" sx={{ color: '#5fb88a' }}>
                      Takk! Omtalen din er sendt og vises etter godkjenning.
                    </Typography>
                    {positiveSubmit && customGoogleUrl && (
                      <>
                        <Typography align="center" sx={{ color: 'rgba(245,242,234,0.7)', fontSize: '0.85rem' }}>
                          Vil du dele den på Google også? Det hjelper enormt.
                        </Typography>
                        <Button variant="outlined" href={customGoogleUrl} target="_blank" rel="noopener"
                          sx={{ color: '#F5F2EA', borderColor: 'rgba(255,255,255,0.32)', textTransform: 'none', borderRadius: '999px', px: 3, '&:hover': { borderColor: '#ffba6c', color: '#ffba6c' } }}>
                          Del på Google
                        </Button>
                      </>
                    )}
                  </Stack>
                ) : (
                  <>
                    <Typography sx={{ fontWeight: 700, color: '#F5F2EA', mb: 2 }}>Legg igjen en omtale</Typography>
                    <Stack spacing={1.5}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <TextField fullWidth size="small" label="Navn" value={reviewForm.author} sx={editorFieldSx}
                          onChange={(e) => setReviewForm((p) => ({ ...p, author: e.target.value }))} />
                        <TextField fullWidth size="small" label="Rolle / prosjekt (valgfritt)" value={reviewForm.role} sx={editorFieldSx}
                          onChange={(e) => setReviewForm((p) => ({ ...p, role: e.target.value }))} />
                      </Stack>
                      {/* Honeypot (#7) — skjult for mennesker, bots fyller det ut. */}
                      <input type="text" tabIndex={-1} autoComplete="off" value={reviewForm.website}
                        onChange={(e) => setReviewForm((p) => ({ ...p, website: e.target.value }))}
                        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
                      <TextField fullWidth size="small" multiline minRows={3} label="Din omtale" value={reviewForm.text} sx={editorFieldSx}
                        onChange={(e) => setReviewForm((p) => ({ ...p, text: e.target.value }))} />
                      {resolvedPrompts.length > 0 ? (
                        // Per-aspekt stjerner (#1) — fotograf-konfigurerte punkter.
                        <Stack spacing={0.5}>
                          {resolvedPrompts.map((p, i) => (
                            <Stack key={i} direction="row" alignItems="center" justifyContent="space-between" sx={{ maxWidth: 360 }}>
                              <Typography sx={{ color: 'rgba(245,242,234,0.8)', fontSize: '0.85rem' }}>{p}</Typography>
                              <Rating value={aspectRatings[p] || 0} size="small"
                                onChange={(_, v) => setAspectRatings((prev) => ({ ...prev, [p]: v || 0 }))}
                                sx={{ '& .MuiRating-iconFilled': { color: '#ffba6c' }, '& .MuiRating-iconEmpty': { color: 'rgba(255,255,255,0.3)' } }} />
                            </Stack>
                          ))}
                        </Stack>
                      ) : (
                        <Box>
                          <Rating value={reviewForm.rating} onChange={(_, v) => setReviewForm((p) => ({ ...p, rating: v || 5 }))}
                            sx={{ '& .MuiRating-iconFilled': { color: '#ffba6c' }, '& .MuiRating-iconEmpty': { color: 'rgba(255,255,255,0.3)' } }} />
                        </Box>
                      )}
                      <Button onClick={submitReview} disabled={submitting || !reviewForm.author.trim() || !reviewForm.text.trim()}
                        variant="contained" sx={{ alignSelf: 'flex-start', bgcolor: '#ffba6c', color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px', px: 3, '&:hover': { bgcolor: '#ffc788' } }}>
                        {submitting ? 'Sender…' : 'Send omtale'}
                      </Button>
                    </Stack>
                  </>
                )}
              </Box>
            )}

            {/* Eier-moderering (#5) — publiser/skjul ventende omtaler + svar. */}
            {editable && <ReviewModerationPanel onChanged={loadReviews} />}
          </Box>
        )}

        {/* FAQ */}
        {showFaqs && (
          <Box sx={{ mb: 8 }}>
            <Typography
              variant="h4"
              align="center"
              sx={{ fontWeight: 700, mb: 1, color: '#F5F2EA' }}
            >
              Ofte stilte spørsmål
            </Typography>
            <Typography
              variant="body1"
              align="center"
              sx={{ color: 'rgba(245,242,234,0.68)', mb: 4 }}
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
                    color: '#F5F2EA',
                    mb: 1.5,
                    '&::before': { display: 'none' },
                    borderRadius: '12px !important',
                    overflow: 'hidden',
                  }}
                  TransitionProps={{ unmountOnExit: true }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={{ color: '#F5F2EA' }} />}
                    aria-controls={`faq-${faq.id}-content`}
                    id={`faq-${faq.id}-header`}
                    sx={{ minHeight: 56 }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#F5F2EA' }}>
                      {faq.question}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails id={`faq-${faq.id}-content`}>
                    <Typography variant="body2" sx={{ color: 'rgba(245,242,234,0.68)', lineHeight: 1.65 }}>
                      {faq.answer}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </Box>
        )}

        {/* Inline CTA — kontakt-blokk. Kun i klient-/offentlig visning. */}
        {clientView && (
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
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#F5F2EA' }}>
            {displayName ? `Klar for å samarbeide med ${displayName}?` : 'Klar for å starte ditt prosjekt?'}
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(245,242,234,0.68)', mb: 3, maxWidth: 480, mx: 'auto' }}>
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
                  color: '#F5F2EA',
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
        )}
      </Container>

      {/* Editor (eier) — legg til / fjern / endre FAQ + omtaler. */}
      <Dialog
        open={editorOpen}
        onClose={() => { if (!saving) setEditorOpen(false); }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#111113', color: '#F5F2EA', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#F5F2EA' }}>Rediger FAQ & omtale-veiledning</DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <Typography sx={{ fontWeight: 700, mb: 1.5, color: '#F5F2EA' }}>Ofte stilte spørsmål</Typography>
          {draftFaqs.map((f, i) => (
            <Box key={i} sx={{ mb: 2, p: 2, border: '1px solid rgba(255,255,255,0.10)', borderRadius: '12px' }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ flex: 1 }}>
                  <TextField fullWidth size="small" label="Spørsmål" value={f.question || ''} sx={editorFieldSx}
                    onChange={(e) => setDraftFaqs((prev) => prev.map((x, xi) => (xi === i ? { ...x, question: e.target.value } : x)))} />
                  <TextField fullWidth size="small" multiline minRows={2} label="Svar" value={f.answer || ''} sx={{ ...editorFieldSx, mt: 1 }}
                    onChange={(e) => setDraftFaqs((prev) => prev.map((x, xi) => (xi === i ? { ...x, answer: e.target.value } : x)))} />
                </Box>
                <IconButton aria-label="Fjern spørsmål" onClick={() => setDraftFaqs((prev) => prev.filter((_, xi) => xi !== i))} sx={{ color: '#e0606a' }}>
                  <DeleteIcon />
                </IconButton>
              </Stack>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} sx={editorAddBtnSx}
            onClick={() => setDraftFaqs((prev) => [...prev, { id: `q${prev.length + 1}_${Date.now()}`, question: '', answer: '' }])}>
            Legg til spørsmål
          </Button>

          <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.08)' }} />

          <Typography sx={{ fontWeight: 700, mb: 0.5, color: '#F5F2EA' }}>Omtale-veiledning</Typography>
          <Typography sx={{ color: 'rgba(245,242,234,0.5)', fontSize: '0.78rem', mb: 1.5 }}>
            Omtaler skrives av kundene dine. Her velger du hva du ønsker tilbakemelding på — disse vises som
            valgfri veiledning i omtale-skjemaet. La stå tomt for fri tekst.
          </Typography>
          {draftPrompts.map((p, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <TextField fullWidth size="small" label={`Punkt ${i + 1}`} value={p} sx={editorFieldSx}
                placeholder="F.eks. Hvordan opplevde du kommunikasjonen?"
                onChange={(e) => setDraftPrompts((prev) => prev.map((x, xi) => (xi === i ? e.target.value : x)))} />
              <IconButton aria-label="Fjern punkt" onClick={() => setDraftPrompts((prev) => prev.filter((_, xi) => xi !== i))} sx={{ color: '#e0606a' }}>
                <DeleteIcon />
              </IconButton>
            </Stack>
          ))}
          <Button startIcon={<AddIcon />} sx={editorAddBtnSx}
            onClick={() => setDraftPrompts((prev) => [...prev, ''])}>
            Legg til punkt
          </Button>

          <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.08)' }} />

          <Typography sx={{ fontWeight: 700, mb: 0.5, color: '#F5F2EA' }}>Google-anmeldelser</Typography>
          <Typography sx={{ color: 'rgba(245,242,234,0.5)', fontSize: '0.78rem', mb: 1.5 }}>
            Lim inn din Google «skriv anmeldelse»-lenke (writereview?placeid=… eller g.page/…/review).
            Fornøyde kunder (4–5★) blir tilbudt å dele på Google. Krever ingen API-oppkobling.
          </Typography>
          <TextField fullWidth size="small" label="Google-anmeldelseslenke" value={draftGoogleUrl} sx={editorFieldSx}
            placeholder="https://g.page/r/…/review"
            onChange={(e) => setDraftGoogleUrl(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditorOpen(false)} disabled={saving} sx={{ color: 'rgba(245,242,234,0.7)', textTransform: 'none' }}>Avbryt</Button>
          <Button onClick={saveContent} disabled={saving} variant="contained"
            sx={{ bgcolor: '#ffba6c', color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px', px: 3, '&:hover': { bgcolor: '#ffc788' } }}>
            {saving ? 'Lagrer…' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sticky CTA — vises etter scroll > 400px. Kun i klient-/offentlig visning. */}
      <Zoom in={clientView && showStickyCta}>
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
