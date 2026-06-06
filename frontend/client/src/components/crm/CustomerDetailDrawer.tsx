// Wave 1 (#2/#17/#18/#35) — the customer detail surface: one place that
// unifies the record, a reverse-chronological activity timeline, a quick-log
// composer, and deal/invoice/meeting/task summaries. Opens from a card click.
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Drawer, Box, Stack, Typography, Chip, Divider, TextField, Button, MenuItem,
  IconButton, Avatar, List, ListItem, ListItemText, CircularProgress, Alert,
  Rating, FormControlLabel, Checkbox,
} from '@mui/material';
import { BrandScope } from './crm-brand';
import {
  Close as CloseIcon, NoteAlt as NoteIcon, Call as CallIcon, VideoCall as MeetIcon,
  MailOutline as MailIcon, Description as ContractIcon, ReceiptLong as InvoiceIcon,
  TrendingUp as DealIcon, Circle as DotIcon, Sms as SmsIcon,
} from '@mui/icons-material';

const STATUS_LABELS: Record<string, string> = {
  lead: 'Henvendelse', prospect: 'Potensiell', active: 'Aktiv', completed: 'Fullført', archived: 'Arkivert',
};
const statusLabel = (s: string) => STATUS_LABELS[s] || s;

const ACTIVITY_TYPES = [
  { value: 'note', label: 'Notat', icon: <NoteIcon fontSize="small" /> },
  { value: 'call', label: 'Anrop', icon: <CallIcon fontSize="small" /> },
  { value: 'meeting', label: 'Møte', icon: <MeetIcon fontSize="small" /> },
  { value: 'email', label: 'E-post', icon: <MailIcon fontSize="small" /> },
];

function timelineIcon(kind: string) {
  switch (kind) {
    case 'deal': return <DealIcon fontSize="small" sx={{ color: '#7c3aed' }} />;
    case 'invoice': return <InvoiceIcon fontSize="small" sx={{ color: '#16a34a' }} />;
    case 'meeting': return <MeetIcon fontSize="small" sx={{ color: '#2196f3' }} />;
    case 'contract': return <ContractIcon fontSize="small" sx={{ color: '#f57c00' }} />;
    default: return <DotIcon sx={{ fontSize: 10, color: 'text.secondary' }} />;
  }
}

function staleness(lastContact: string | null): { label: string; warn: boolean } {
  if (!lastContact) return { label: 'Aldri kontaktet', warn: true };
  const days = Math.floor((Date.now() - new Date(lastContact).getTime()) / 86_400_000);
  if (days <= 0) return { label: 'Kontaktet i dag', warn: false };
  if (days === 1) return { label: 'Kontaktet i går', warn: false };
  return { label: `Sist kontaktet for ${days} dager siden`, warn: days > 30 };
}

interface Props {
  open: boolean;
  customerId: string | null;
  customerName?: string;
  onClose: () => void;
  brandColor?: string;
}

export default function CustomerDetailDrawer({ open, customerId, customerName, onClose, brandColor }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [logType, setLogType] = useState('note');
  const [logText, setLogText] = useState('');
  // #22 — email composer
  const [showEmail, setShowEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  // #39 — review capture
  const [reviewRating, setReviewRating] = useState<number | null>(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewPublic, setReviewPublic] = useState(false);
  // #49 — SMS composer
  const [showSms, setShowSms] = useState(false);
  const [smsBody, setSmsBody] = useState('');

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['crm-customer-overview', customerId],
    enabled: open && Boolean(customerId),
    queryFn: () => apiRequest(`/api/universal-crm/customers/${encodeURIComponent(customerId!)}/overview`),
  });

  const logMutation = useMutation({
    mutationFn: async () => apiRequest('/api/universal-crm/activities', {
      method: 'POST',
      body: JSON.stringify({
        customerId,
        type: logType,
        subject: ACTIVITY_TYPES.find((t) => t.value === logType)?.label || 'Notat',
        description: logText.trim(),
        direction: logType === 'email' || logType === 'call' ? 'outbound' : null,
      }),
    }),
    onSuccess: () => {
      setLogText('');
      queryClient.invalidateQueries({ queryKey: ['crm-customer-overview', customerId] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-customers'] });
      toast({ title: 'Logget', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Kunne ikke logge', description: e?.message, variant: 'destructive' }),
  });

  const c = data?.customer;
  const stale = c ? staleness(c.lastContact) : null;

  const sendSmsMutation = useMutation({
    mutationFn: async () => apiRequest('/api/universal-crm/sms/send', {
      method: 'POST',
      body: JSON.stringify({ customerId, to: c?.phone, message: smsBody }),
    }),
    onSuccess: () => {
      setShowSms(false); setSmsBody('');
      queryClient.invalidateQueries({ queryKey: ['crm-customer-overview', customerId] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-customers'] });
      toast({ title: 'SMS sendt', variant: 'success' });
    },
    onError: (e: any) => {
      const msg = String(e?.message || '');
      toast({ title: 'Kunne ikke sende SMS', description: /not configured|konfigurert|409/i.test(msg) ? 'SMS-provider er ikke konfigurert ennå.' : (msg || 'Prøv igjen.'), variant: 'destructive', duration: 7000 });
    },
  });

  const addReview = useMutation({
    mutationFn: async () => apiRequest('/api/universal-crm/reviews', {
      method: 'POST',
      body: JSON.stringify({ customerId, rating: reviewRating, npsScore: reviewRating ? reviewRating * 2 : null, testimonialText: reviewText.trim(), publicConsent: reviewPublic }),
    }),
    onSuccess: () => {
      setReviewText(''); setReviewRating(5); setReviewPublic(false);
      queryClient.invalidateQueries({ queryKey: ['crm-customer-overview', customerId] });
      toast({ title: 'Anmeldelse registrert', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Kunne ikke registrere', description: e?.message, variant: 'destructive' }),
  });

  // #50 — email templates with {{merge}} interpolation.
  const { data: tplData } = useQuery<{ templates: any[] }>({
    queryKey: ['crm-email-templates'],
    enabled: open && showEmail,
    queryFn: () => apiRequest('/api/universal-crm/email-templates'),
  });
  const templates = tplData?.templates || [];
  const interpolate = (s: string) => (s || '')
    .replace(/\{\{\s*name\s*\}\}/gi, c?.name || '')
    .replace(/\{\{\s*firstName\s*\}\}/gi, (c?.name || '').split(' ')[0] || '')
    .replace(/\{\{\s*company\s*\}\}/gi, c?.company || '')
    .replace(/\{\{\s*email\s*\}\}/gi, c?.email || '');

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest('/api/communication/email/send', {
        method: 'POST',
        body: JSON.stringify({ to: c?.email, subject: emailSubject || 'Melding fra CreatorHub', message: emailBody }),
      });
      // Log the send as a CRM activity so the timeline reflects it.
      await apiRequest('/api/universal-crm/activities', {
        method: 'POST',
        body: JSON.stringify({ customerId, type: 'email', subject: emailSubject || 'E-post sendt', description: emailBody.slice(0, 500), direction: 'outbound' }),
      }).catch(() => { /* best-effort log */ });
      return r;
    },
    onSuccess: () => {
      setShowEmail(false); setEmailSubject(''); setEmailBody('');
      queryClient.invalidateQueries({ queryKey: ['crm-customer-overview', customerId] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-customers'] });
      toast({ title: 'E-post sendt', variant: 'success' });
    },
    onError: (e: any) => {
      const msg = String(e?.message || '');
      toast({
        title: 'Kunne ikke sende e-post',
        description: /google|gmail|400|409|connect/i.test(msg) ? 'Koble Gmail i Innstillinger for å sende fra CRM-en.' : (msg || 'Prøv igjen.'),
        variant: 'destructive', duration: 7000,
      });
    },
  });

  return (
    <BrandScope brandColor={brandColor}>
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 480 } } }}>
      <Box sx={{ p: 2.5, height: '100%', overflowY: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{c?.name || customerName || 'Kunde'}</Typography>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Stack>

        {isLoading ? (
          <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
        ) : error ? (
          <Alert severity="error">Kunne ikke laste kundedetaljer.</Alert>
        ) : c ? (
          <Stack spacing={2.5}>
            {/* Record header */}
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip size="small" label={statusLabel(c.status)} color="primary" />
                {c.projectType && <Chip size="small" variant="outlined" label={c.projectType} />}
                {c.source && <Chip size="small" variant="outlined" label={`Kilde: ${c.source}`} />}
                {c.consentStatus && <Chip size="small" color="success" variant="outlined" label={`Samtykke: ${c.consentStatus}`} />}
              </Stack>
              {c.email && <Typography variant="body2" color="text.secondary">{c.email}</Typography>}
              {c.phone && <Typography variant="body2" color="text.secondary">{c.phone}</Typography>}
              {c.company && <Typography variant="body2" color="text.secondary">{c.company}</Typography>}
              {stale && (
                <Chip
                  size="small"
                  label={stale.label}
                  color={stale.warn ? 'warning' : 'default'}
                  variant={stale.warn ? 'filled' : 'outlined'}
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}
            </Stack>

            {/* Summary counts */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" icon={<DealIcon />} label={`${data.deals.length} deals`} variant="outlined" />
              <Chip size="small" icon={<InvoiceIcon />} label={`${data.invoices.length} fakturaer`} variant="outlined" />
              <Chip size="small" icon={<MeetIcon />} label={`${data.meetings.length} møter`} variant="outlined" />
              <Chip size="small" label={`${data.tasks.length} oppgaver`} variant="outlined" />
            </Stack>

            <Divider />

            {/* Quick-log composer (#18) */}
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Logg aktivitet</Typography>
              <Stack direction="row" spacing={1}>
                <TextField select size="small" value={logType} onChange={(e) => setLogType(e.target.value)} sx={{ minWidth: 120 }}>
                  {ACTIVITY_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </TextField>
                <TextField
                  size="small" fullWidth placeholder="Hva skjedde?" value={logText}
                  onChange={(e) => setLogText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && logText.trim()) logMutation.mutate(); }}
                />
                <Button variant="contained" disabled={!logText.trim() || logMutation.isPending} onClick={() => logMutation.mutate()}>
                  Logg
                </Button>
              </Stack>
            </Stack>

            <Divider />

            {/* Email composer (#22/#50) */}
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Kommunikasjon</Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" startIcon={<MailIcon />} onClick={() => {
                    setShowEmail((v) => !v); setShowSms(false);
                    if (!showEmail && !emailSubject) setEmailSubject(`Hei ${(c.name || '').split(' ')[0] || ''}`.trim());
                  }} disabled={!c.email}>
                    {showEmail ? 'Skjul' : 'E-post'}
                  </Button>
                  <Button size="small" startIcon={<SmsIcon />} onClick={() => { setShowSms((v) => !v); setShowEmail(false); }} disabled={!c.phone}>
                    {showSms ? 'Skjul' : 'SMS'}
                  </Button>
                </Stack>
              </Stack>
              {showSms && c.phone && (
                <Stack spacing={1}>
                  <TextField size="small" label={`SMS til ${c.phone}`} value={smsBody} onChange={(e) => setSmsBody(e.target.value)} fullWidth multiline rows={3} inputProps={{ maxLength: 480 }} helperText={`${smsBody.length}/480`} />
                  <Button variant="contained" startIcon={<SmsIcon />} disabled={!smsBody.trim() || sendSmsMutation.isPending} onClick={() => sendSmsMutation.mutate()} sx={{ alignSelf: 'flex-end' }}>
                    {sendSmsMutation.isPending ? 'Sender…' : 'Send SMS'}
                  </Button>
                </Stack>
              )}
              {!c.email && <Typography variant="caption" color="text.secondary">Kunden mangler e-postadresse.</Typography>}
              {showEmail && c.email && (
                <Stack spacing={1}>
                  {templates.length > 0 && (
                    <TextField select size="small" label="Mal" value="" onChange={(e) => {
                      const tpl = templates.find((t: any) => t.id === e.target.value);
                      if (tpl) {
                        setEmailSubject(interpolate(tpl.subject || tpl.title || ''));
                        setEmailBody(interpolate(tpl.body || tpl.content || tpl.html_body || ''));
                      }
                    }}>
                      <MenuItem value="">— velg mal —</MenuItem>
                      {templates.map((t: any) => <MenuItem key={t.id} value={t.id}>{t.name || t.subject || 'Mal'}</MenuItem>)}
                    </TextField>
                  )}
                  <TextField size="small" label="Emne" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} fullWidth />
                  <TextField size="small" label={`Melding til ${c.email}`} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} fullWidth multiline rows={4} />
                  <Button variant="contained" startIcon={<MailIcon />} disabled={!emailBody.trim() || sendEmailMutation.isPending} onClick={() => sendEmailMutation.mutate()} sx={{ alignSelf: 'flex-end' }}>
                    {sendEmailMutation.isPending ? 'Sender…' : 'Send'}
                  </Button>
                </Stack>
              )}
            </Stack>

            <Divider />

            {/* Reviews / NPS (#39) */}
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Anmeldelser</Typography>
              {(data.reviews || []).map((r: any) => (
                <Box key={r.id} sx={{ p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Rating size="small" value={r.rating || 0} readOnly />
                    {r.public_consent && <Chip size="small" label="Kan publiseres" color="success" variant="outlined" />}
                  </Stack>
                  {r.testimonial_text && <Typography variant="caption" color="text.secondary">{r.testimonial_text}</Typography>}
                </Box>
              ))}
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Rating value={reviewRating} onChange={(_e, v) => setReviewRating(v)} />
                  <Typography variant="caption" color="text.secondary">Registrer mottatt anmeldelse</Typography>
                </Stack>
                <TextField size="small" placeholder="Sitat / tilbakemelding (valgfritt)" value={reviewText} onChange={(e) => setReviewText(e.target.value)} fullWidth multiline rows={2} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <FormControlLabel control={<Checkbox size="small" checked={reviewPublic} onChange={(e) => setReviewPublic(e.target.checked)} />} label={<Typography variant="caption">Kan publiseres</Typography>} />
                  <Button size="small" variant="contained" disabled={!reviewRating || addReview.isPending} onClick={() => addReview.mutate()}>Lagre</Button>
                </Stack>
              </Stack>
            </Stack>

            <Divider />

            {/* Activity timeline (#17) */}
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Tidslinje</Typography>
              {(!data.timeline || data.timeline.length === 0) ? (
                <Typography variant="body2" color="text.secondary">Ingen aktivitet ennå — logg det første ovenfor.</Typography>
              ) : (
                <List dense disablePadding>
                  {data.timeline.map((t: any, i: number) => (
                    <ListItem key={i} alignItems="flex-start" sx={{ px: 0 }}>
                      <Avatar sx={{ width: 28, height: 28, mr: 1.5, bgcolor: 'transparent' }}>{timelineIcon(t.kind)}</Avatar>
                      <ListItemText
                        primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{t.title}{t.type ? ` · ${t.type}` : ''}</Typography>}
                        secondary={
                          <>
                            {t.detail && <Typography variant="caption" display="block">{t.detail}</Typography>}
                            <Typography variant="caption" color="text.secondary">
                              {t.at ? new Date(t.at).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Stack>
          </Stack>
        ) : null}
      </Box>
    </Drawer>
    </BrandScope>
  );
}
