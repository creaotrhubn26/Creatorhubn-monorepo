// @ts-nocheck
/**
 * SupportDialog — «Meld en feil / få hjelp» inne i Team Workspace.
 *
 * Sender en support-ticket til /api/support/tickets (dedikert produkt-support,
 * adskilt fra The Role Room). Autentisert via apiRequest med Bearer-token siden
 * workspace ikke bruker cookie-auth. Auto-kontekst (URL, fane, prosjekt,
 * viewport, UA) legges ved slik at admin kan triagere uten å spørre.
 * Dark CreatorHub-design via ws-tokens; no/en via WsLocaleProvider.
 */
import React, { useState } from 'react';
import {
  Box, Stack, Typography, TextField, Button, MenuItem, Alert, CircularProgress,
} from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import { apiRequest } from '@/lib/queryClient';
import { ws } from './workspaceTheme';
import { WsModal } from './ui';
import { useWsLocale, makeT, type WsDict } from './wsLocale';

const T: WsDict = {
  title: { no: 'Få hjelp / meld en feil', en: 'Get help / report a problem' },
  intro: { no: 'Beskriv problemet eller spørsmålet ditt. Vi legger automatisk ved teknisk kontekst så vi kan hjelpe raskere.', en: 'Describe your problem or question. We automatically attach technical context so we can help faster.' },
  category: { no: 'Kategori', en: 'Category' },
  catBug: { no: 'Feil / noe virker ikke', en: 'Bug / something is broken' },
  catQuestion: { no: 'Spørsmål', en: 'Question' },
  catFeature: { no: 'Forslag / ønske', en: 'Suggestion / request' },
  catOther: { no: 'Annet', en: 'Other' },
  priority: { no: 'Hvor viktig?', en: 'How urgent?' },
  prLow: { no: 'Lav', en: 'Low' },
  prMedium: { no: 'Middels', en: 'Medium' },
  prHigh: { no: 'Høy', en: 'High' },
  prCritical: { no: 'Kritisk (blokkerer arbeidet)', en: 'Critical (blocks my work)' },
  titleField: { no: 'Kort tittel', en: 'Short title' },
  titlePh: { no: 'F.eks. «Kan ikke laste opp bilder»', en: 'E.g. "Cannot upload images"' },
  descField: { no: 'Beskrivelse', en: 'Description' },
  descPh: { no: 'Hva skjedde? Hva forventet du? Steg for å gjenskape hjelper.', en: 'What happened? What did you expect? Steps to reproduce help.' },
  send: { no: 'Send inn', en: 'Submit' },
  sending: { no: 'Sender…', en: 'Sending…' },
  cancel: { no: 'Avbryt', en: 'Cancel' },
  successTitle: { no: 'Takk! Saken er sendt inn.', en: 'Thanks! Your ticket was submitted.' },
  successBody: { no: 'Vi tar en titt og følger opp på e-posten din.', en: 'We will take a look and follow up by email.' },
  close: { no: 'Lukk', en: 'Close' },
  errGeneric: { no: 'Kunne ikke sende inn. Prøv igjen.', en: 'Could not submit. Please try again.' },
  ctxNote: { no: 'Vedlegges automatisk: side, fane, prosjekt, skjermstørrelse.', en: 'Attached automatically: page, tab, project, screen size.' },
};

const SupportDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  user?: { id?: string | number | null; email?: string | null; name?: string | null };
  tabLabel?: string;
  projectId?: string | null;
  projectName?: string | null;
}> = ({ open, onClose, user, tabLabel, projectId, projectName }) => {
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const [category, setCategory] = useState('bug');
  const [priority, setPriority] = useState('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = title.trim().length >= 3 && description.trim().length >= 10 && !submitting;

  const reset = () => {
    setCategory('bug'); setPriority('medium'); setTitle(''); setDescription('');
    setError(null); setDone(false); setSubmitting(false);
  };
  const handleClose = () => { onClose(); window.setTimeout(reset, 220); };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      await apiRequest('/api/support/tickets', {
        method: 'POST',
        body: {
          category, priority,
          title: title.trim(),
          description: description.trim(),
          user: user ? {
            id: user.id != null ? String(user.id) : null,
            email: user.email ?? null,
            name: user.name ?? null,
          } : null,
          context: {
            source: 'workspace',
            url: typeof window !== 'undefined' ? window.location.href : '',
            tabLabel: tabLabel ?? null,
            projectId: projectId ?? null,
            projectName: projectName ?? null,
            viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
            viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            timestamp: new Date().toISOString(),
          },
        },
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message || t('errGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  const sel = { '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, color: ws.text, fontSize: 14 }, '& .MuiInputLabel-root': { color: ws.textDim }, '& .MuiSvgIcon-root': { color: ws.textDim } };

  return (
    <WsModal open={open} onClose={handleClose} title={t('title')} maxWidth="sm">
      {done ? (
        <Stack alignItems="center" spacing={1.5} sx={{ py: 3, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 44, color: ws.green }} />
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: ws.text }}>{t('successTitle')}</Typography>
          <Typography sx={{ fontSize: 13.5, color: ws.textDim }}>{t('successBody')}</Typography>
          <Button onClick={handleClose} variant="contained" sx={{ mt: 1, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('close')}</Button>
        </Stack>
      ) : (
        <Stack spacing={1.75} sx={{ pt: 0.5 }}>
          <Typography sx={{ fontSize: 13, color: ws.textDim }}>{t('intro')}</Typography>
          {error && <Alert severity="error" sx={{ fontSize: 13 }}>{error}</Alert>}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField select fullWidth size="small" label={t('category')} value={category} onChange={(e) => setCategory(e.target.value)} sx={sel}>
              <MenuItem value="bug">{t('catBug')}</MenuItem>
              <MenuItem value="question">{t('catQuestion')}</MenuItem>
              <MenuItem value="feature">{t('catFeature')}</MenuItem>
              <MenuItem value="other">{t('catOther')}</MenuItem>
            </TextField>
            <TextField select fullWidth size="small" label={t('priority')} value={priority} onChange={(e) => setPriority(e.target.value)} sx={sel}>
              <MenuItem value="low">{t('prLow')}</MenuItem>
              <MenuItem value="medium">{t('prMedium')}</MenuItem>
              <MenuItem value="high">{t('prHigh')}</MenuItem>
              <MenuItem value="critical">{t('prCritical')}</MenuItem>
            </TextField>
          </Stack>
          <TextField fullWidth size="small" label={t('titleField')} placeholder={t('titlePh')} value={title} onChange={(e) => setTitle(e.target.value)} inputProps={{ maxLength: 200 }} sx={sel} />
          <TextField fullWidth multiline minRows={4} size="small" label={t('descField')} placeholder={t('descPh')} value={description} onChange={(e) => setDescription(e.target.value)} inputProps={{ maxLength: 5000 }} sx={sel} />
          <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>{t('ctxNote')}</Typography>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={handleClose} sx={{ color: ws.textDim, textTransform: 'none' }}>{t('cancel')}</Button>
            <Button onClick={submit} disabled={!canSubmit} variant="contained" startIcon={submitting ? <CircularProgress size={15} sx={{ color: ws.accentContrast }} /> : undefined} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover }, '&.Mui-disabled': { bgcolor: ws.panelAlt, color: ws.textFaint } }}>
              {submitting ? t('sending') : t('send')}
            </Button>
          </Stack>
        </Stack>
      )}
    </WsModal>
  );
};

export default SupportDialog;
