/**
 * BookDemoModal.tsx — dedikert "Book demo"-modal for theroleroom.com
 *
 * Erstatter den gamle `/for-byraer#book-demo`-ankerlenken (som ikke åpnet
 * noe dedikert på Role Room-hosten). Samler ALL viktig bedrifts-info en
 * B2B-demo trenger, og poster til POST /api/public/agency-lead med
 * source='book_demo' → lander direkte som `demo_booked` i Admin Room CRM-en.
 *
 * Self-contained: egen mørk-lilla palett som matcher landingssiden, ingen
 * eksterne stil-avhengigheter utover MUI.
 */

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { trackEvent } from '@/utils/ga4-client-tracking';
import { fireGoogleAdsConversion } from '@/utils/google-ads-conversions';

const palette = {
  bgCard: '#150b2e',
  bgElevated: '#1a0f3a',
  border: 'rgba(168, 85, 247, 0.22)',
  borderStrong: 'rgba(168, 85, 247, 0.4)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accentBright: '#c084fc',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

// "Hva beskriver dere best?" — mapper til agency_leads.segment (CHECK-begrenset).
const BUSINESS_TYPES: { label: string; segment: string }[] = [
  { label: 'Produksjonsteam / produksjonsselskap', segment: 'annet' },
  { label: 'Innholdsprodusent / skaper', segment: 'annet' },
  { label: 'Skuespillerbyrå', segment: 'skuespillerbyrå' },
  { label: 'Modellbyrå', segment: 'modellbyrå' },
  { label: 'Bookingbyrå', segment: 'bookingbyrå' },
  { label: 'Dansestudio', segment: 'annet' },
  { label: 'Annet', segment: 'annet' },
];

const TEAM_SIZES = ['1–3', '4–10', '11–30', '31–75', '75+'];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Hvor brukeren trykket "Book demo" — for attribusjon/analytics. */
  trigger?: string;
};

function collectAttribution(trigger?: string): Record<string, unknown> {
  if (typeof window === 'undefined') return { trigger };
  try {
    const params = new URLSearchParams(window.location.search);
    const pick = (k: string) => params.get(k) || undefined;
    return {
      trigger,
      utm_term: pick('utm_term'),
      utm_content: pick('utm_content'),
      gclid: pick('gclid'),
      fbclid: pick('fbclid'),
      li_fat_id: pick('li_fat_id'),
      ttclid: pick('ttclid'),
      referrer: document.referrer || undefined,
      landing_page: window.location.pathname,
      locale: navigator.language || undefined,
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    };
  } catch {
    return { trigger };
  }
}

function utmParam(key: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return new URLSearchParams(window.location.search).get(key) || undefined;
  } catch {
    return undefined;
  }
}

export default function BookDemoModal({ open, onClose, trigger }: Props) {
  const [form, setForm] = useState({
    agency_name: '',
    contact_name: '',
    contact_title: '',
    email: '',
    phone: '',
    org_number: '',
    website: '',
    business_type: BUSINESS_TYPES[0].label,
    team_size: '',
    use_case: '',
    current_tools: '',
    preferred_demo_time: '',
    demo_language: 'nb',
    message: '',
  });
  const [consentResearch, setConsentResearch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const canSubmit = useMemo(
    () =>
      form.agency_name.trim().length > 1 &&
      form.contact_name.trim().length > 1 &&
      /.+@.+\..+/.test(form.email.trim()),
    [form.agency_name, form.contact_name, form.email],
  );

  const reset = () => {
    setDone(false);
    setError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
    // La success-skjermen ligge til neste åpning lukkes ren.
    if (done) setTimeout(reset, 250);
  };

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    const segment =
      BUSINESS_TYPES.find((b) => b.label === form.business_type)?.segment || 'annet';
    try {
      const res = await fetch('/api/public/agency-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          source: 'book_demo',
          segment,
          agency_name: form.agency_name.trim(),
          contact_name: form.contact_name.trim(),
          contact_title: form.contact_title.trim() || null,
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
          org_number: form.org_number.trim() || null,
          website: form.website.trim() || null,
          team_size: form.team_size || null,
          use_case: form.use_case.trim() || null,
          current_tools: form.current_tools.trim() || null,
          preferred_demo_time: form.preferred_demo_time.trim() || null,
          demo_language: form.demo_language,
          message: form.message.trim() || null,
          utm_source: utmParam('utm_source'),
          utm_medium: utmParam('utm_medium'),
          utm_campaign: utmParam('utm_campaign'),
          li_fat_id: utmParam('li_fat_id'),
          request_context: { ...collectAttribution(trigger), business_type: form.business_type },
          consent_research: consentResearch,
          consent_text_version: "v1",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Innsending feilet. Prøv igjen.');
      }
      setDone(true);
      try {
        trackEvent('book_demo_submitted', {
          business_type: form.business_type,
          team_size: form.team_size || undefined,
          surface: 'theroleroom_landing',
        });
        void fireGoogleAdsConversion('demo');
      } catch {
        /* analytics best-effort */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Innsending feilet. Prøv igjen.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: palette.bgElevated,
      color: palette.textPrimary,
      borderRadius: 1.5,
      '& fieldset': { borderColor: palette.border },
      '&:hover fieldset': { borderColor: palette.borderStrong },
      '&.Mui-focused fieldset': { borderColor: palette.accentBright },
    },
    '& .MuiInputLabel-root': { color: palette.textMuted },
    '& .MuiInputLabel-root.Mui-focused': { color: palette.accentBright },
    '& .MuiFormHelperText-root': { color: palette.textMuted },
  } as const;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: palette.bgCard,
          backgroundImage: 'none',
          border: `1px solid ${palette.borderStrong}`,
          borderRadius: 3,
          color: palette.textPrimary,
          boxShadow: '0 24px 80px rgba(168,85,247,0.28)',
        },
      }}
    >
      <IconButton
        onClick={handleClose}
        aria-label="Lukk"
        sx={{ position: 'absolute', top: 10, right: 10, color: palette.textMuted, zIndex: 2 }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        {done ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 4, textAlign: 'center' }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 56, color: '#34d399' }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.4rem' }}>
              Takk — demoen er på vei
            </Typography>
            <Typography sx={{ color: palette.textSecondary, maxWidth: 380 }}>
              Vi tar kontakt innen 24 timer med konkrete tider, tilpasset
              {form.business_type ? ` «${form.business_type}»` : ' din virksomhet'}.
              Du får en bekreftelse på {form.email.trim()}.
            </Typography>
            <Button
              onClick={handleClose}
              sx={{
                mt: 1,
                background: palette.accentGradient,
                color: '#fff',
                textTransform: 'none',
                fontWeight: 700,
                px: 3,
                py: 1.1,
                borderRadius: 2,
              }}
            >
              Lukk
            </Button>
          </Stack>
        ) : (
          <>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 0.5, pr: 4 }}>
              <CalendarMonthOutlinedIcon sx={{ color: palette.accentBright }} />
              <Typography sx={{ fontWeight: 800, fontSize: '1.35rem' }}>Book en demo</Typography>
            </Stack>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem', mb: 2.5 }}>
              30 minutter, skreddersydd for din virksomhet. Fyll ut det viktigste,
              så finner vi en tid som passer.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(239,68,68,0.12)', color: '#fecaca' }}>
                {error}
              </Alert>
            )}

            <Stack spacing={1.8}>
              <TextField
                required
                label="Bedrift / selskap"
                value={form.agency_name}
                onChange={set('agency_name')}
                fullWidth
                size="small"
                sx={fieldSx}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.8}>
                <TextField
                  required
                  label="Ditt navn"
                  value={form.contact_name}
                  onChange={set('contact_name')}
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
                <TextField
                  label="Din rolle / tittel"
                  value={form.contact_title}
                  onChange={set('contact_title')}
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.8}>
                <TextField
                  required
                  type="email"
                  label="Jobb-e-post"
                  value={form.email}
                  onChange={set('email')}
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
                <TextField
                  label="Telefon"
                  value={form.phone}
                  onChange={set('phone')}
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.8}>
                <TextField
                  label="Org.nr"
                  value={form.org_number}
                  onChange={set('org_number')}
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
                <TextField
                  label="Nettside"
                  placeholder="dittfirma.no"
                  value={form.website}
                  onChange={set('website')}
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.8}>
                <TextField
                  select
                  label="Hva beskriver dere best?"
                  value={form.business_type}
                  onChange={set('business_type')}
                  fullWidth
                  size="small"
                  sx={fieldSx}
                  SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: palette.bgElevated, color: palette.textPrimary } } } }}
                >
                  {BUSINESS_TYPES.map((b) => (
                    <MenuItem key={b.label} value={b.label}>{b.label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Team-størrelse"
                  value={form.team_size}
                  onChange={set('team_size')}
                  fullWidth
                  size="small"
                  sx={fieldSx}
                  SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: palette.bgElevated, color: palette.textPrimary } } } }}
                >
                  <MenuItem value="">Velg…</MenuItem>
                  {TEAM_SIZES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </TextField>
              </Stack>
              <TextField
                label="Hva vil dere oppnå?"
                placeholder="F.eks. samle casting, produksjon og distribusjon ett sted"
                value={form.use_case}
                onChange={set('use_case')}
                fullWidth
                multiline
                minRows={2}
                size="small"
                sx={fieldSx}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.8}>
                <TextField
                  label="Hva bruker dere i dag?"
                  value={form.current_tools}
                  onChange={set('current_tools')}
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
                <TextField
                  label="Når passer en demo?"
                  placeholder="F.eks. tirsdager før kl. 12"
                  value={form.preferred_demo_time}
                  onChange={set('preferred_demo_time')}
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
              </Stack>
              <TextField
                select
                label="Språk på demoen"
                value={form.demo_language}
                onChange={set('demo_language')}
                fullWidth
                size="small"
                sx={fieldSx}
                SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: palette.bgElevated, color: palette.textPrimary } } } }}
              >
                <MenuItem value="nb">Norsk</MenuItem>
                <MenuItem value="en">Engelsk</MenuItem>
              </TextField>

              {/* Consent: auto-research */}
              <Box sx={{
                mt: 0.5, p: 2, borderRadius: 2,
                border: `1px solid ${consentResearch ? palette.accentBright : 'rgba(245,243,255,0.15)'}`,
                bgcolor: consentResearch ? 'rgba(168,85,247,0.06)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }} onClick={() => setConsentResearch((v) => !v)}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box sx={{
                    width: 20, height: 20, mt: 0.3,
                    borderRadius: 0.5,
                    border: `2px solid ${consentResearch ? palette.accentBright : 'rgba(245,243,255,0.30)'}`,
                    bgcolor: consentResearch ? palette.accentBright : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {consentResearch && (
                      <Box sx={{ color: '#fff', fontSize: 14, lineHeight: 1, fontWeight: 800 }}>✓</Box>
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.9rem' }}>
                      Ja, dere kan automatisk hente offentlig bedriftsinformasjon før møtet
                    </Typography>
                    <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 0.5 }}>
                      Vi sjekker Brønnøysundregistrene + hjemmesiden deres, og Claude lager
                      et kort sammendrag — slik at samtalen blir mer relevant fra første sekund.{' '}
                      <Box component="a" href="/personvern/automatisk-research"
                           target="_blank" rel="noopener noreferrer"
                           onClick={(e) => e.stopPropagation()}
                           sx={{ color: palette.accentBright, textDecoration: 'underline' }}>
                        Les mer →
                      </Box>
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Button
                onClick={submit}
                disabled={!canSubmit || submitting}
                sx={{
                  mt: 0.5,
                  background: palette.accentGradient,
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 3,
                  py: 1.3,
                  borderRadius: 2,
                  fontSize: '1rem',
                  '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                  '&.Mui-disabled': { background: 'rgba(168,85,247,0.25)', color: 'rgba(245,243,255,0.5)' },
                }}
              >
                {submitting ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Send forespørsel'}
              </Button>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', textAlign: 'center' }}>
                Vi tar kontakt innen 24 timer. Ingen forpliktelse.
              </Typography>
            </Stack>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
