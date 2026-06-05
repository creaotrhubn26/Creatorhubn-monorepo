/**
 * ClientRequestModal — opprett en ny forespørsel til klienten fra
 * hvilken som helst panel i CSW.
 *
 * Vanlig flyt:
 *   1. Markedsføreren klikker "Be klient om X" på en card/panel
 *   2. Modalen åpner med prefilled subject + body fra mal (hvis
 *      platform-key er kjent — bruker dataSourceClientOnboarding)
 *   3. Markedsføreren tilpasser, fyller inn klient-e-post, og sender
 *   4. Backend lagrer + sender e-post + returnerer request-id
 *   5. Modalen lukker, panelet kan oppdatere status til "Venter på klient"
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, Send as SendIcon } from '@mui/icons-material';
import roleRoomAgentService from '../../services/roleRoomAgentService';
import {
  generateClientOnboardingTemplate,
  type DataSourcePlatformKey,
} from '../../utils/dataSourceClientOnboarding';

export type ClientRequestKind =
  | 'data_source_access'
  | 'brand_assets'
  | 'kpi_baseline'
  | 'approval'
  | 'general_info';

export interface ClientRequestModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  kind: ClientRequestKind;
  contextArea: string;
  contextKey?: string | null;

  /** Hvis dette er en data-source-forespørsel kan vi pre-fylle subject+body
   *  fra dataSourceClientOnboarding-malene. */
  platformKey?: DataSourcePlatformKey | null;

  /** Defaults for marketer-info brukt i mal-rendering. */
  marketerName?: string;
  marketerEmail?: string;
  companyName?: string;

  /** Tidligere lagret booking-URL fra prosjekt-config (hvis noe). */
  bookingUrl?: string | null;

  /** Forhåndsutfylt klient-e-post (kan komme fra prosjekt-kontakter). */
  defaultClientEmail?: string;
  defaultClientName?: string;

  /** Når request er opprettet (også når e-post feilet). */
  onCreated?: (requestId: string) => void;
}

const KIND_LABELS: Record<ClientRequestKind, string> = {
  data_source_access: 'Datakilde-tilgang',
  brand_assets: 'Brand-assets',
  kpi_baseline: 'KPI-baseline',
  approval: 'Godkjenning',
  general_info: 'Generell informasjon',
};

const ClientRequestModal: React.FC<ClientRequestModalProps> = ({
  open,
  onClose,
  projectId,
  kind,
  contextArea,
  contextKey,
  platformKey,
  marketerName = 'Markedsfører',
  marketerEmail = '',
  companyName = 'bedriften din',
  bookingUrl,
  defaultClientEmail = '',
  defaultClientName = '',
  onCreated,
}) => {
  const template = useMemo(() => {
    if (!platformKey) return null;
    return generateClientOnboardingTemplate(platformKey, {
      marketerName,
      marketerEmail,
      companyName,
    });
  }, [platformKey, marketerName, marketerEmail, companyName]);

  const [title, setTitle] = useState('');
  const [bodyMarkdown, setBodyMarkdown] = useState('');
  const [clientEmail, setClientEmail] = useState(defaultClientEmail);
  const [clientName, setClientName] = useState(defaultClientName);
  const [includeBookingLink, setIncludeBookingLink] = useState(Boolean(bookingUrl));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(template?.emailSubject ?? `Forespørsel om ${KIND_LABELS[kind].toLowerCase()}`);
    setBodyMarkdown(template?.emailBody ?? '');
    setClientEmail(defaultClientEmail);
    setClientName(defaultClientName);
    setIncludeBookingLink(Boolean(bookingUrl));
    setError(null);
    setSuccess(null);
  }, [open, template, kind, defaultClientEmail, defaultClientName, bookingUrl]);

  const handleSubmit = async (): Promise<void> => {
    if (!clientEmail.trim()) {
      setError('Klientens e-postadresse må fylles ut.');
      return;
    }
    if (!title.trim() || !bodyMarkdown.trim()) {
      setError('Tittel og melding kan ikke være tomme.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await roleRoomAgentService.createClientRequest({
        projectId,
        kind,
        title: title.trim(),
        bodyMarkdown,
        contextArea,
        contextKey: contextKey ?? null,
        clientEmail: clientEmail.trim(),
        clientName: clientName.trim() || null,
        marketerEmail: marketerEmail || null,
        marketerName,
        bookingUrl: includeBookingLink ? bookingUrl ?? null : null,
      });
      if (!result) {
        setError('Forespørsel kunne ikke opprettes. Sjekk e-postadressen og prøv igjen.');
        return;
      }
      const id = String(result.request?.id ?? '');
      if (result.emailSent) {
        setSuccess(`Forespørsel sendt til ${clientEmail.trim()}`);
      } else if (result.emailReason === 'missing_email_config') {
        setSuccess(`Forespørselen ble lagret in-app. E-post kunne ikke sendes (Gmail SMTP er ikke konfigurert).`);
      } else {
        setSuccess(`Forespørselen ble lagret in-app, men e-postutsending feilet${result.emailReason ? `: ${result.emailReason}` : ''}.`);
      }
      onCreated?.(id);
      setTimeout(() => { onClose(); }, 1400);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#0b1226', color: '#f8fafc' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack spacing={0.2}>
          <Typography sx={{ fontWeight: 800 }}>
            Be klienten om {KIND_LABELS[kind].toLowerCase()}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)' }}>
            Sender e-post + lagrer i in-app tråd. Klienten kan svare uten å logge inn.
          </Typography>
        </Stack>
        <IconButton onClick={onClose} disabled={submitting} sx={{ color: '#cbd5e1' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={1.6} sx={{ mt: 0.6 }}>
          {template && template.expectedReturnData.length > 0 ? (
            <Alert
              severity="info"
              sx={{ bgcolor: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}
            >
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, mb: 0.4 }}>
                Du venter på følgende fra klienten:
              </Typography>
              {template.expectedReturnData.map((r, i) => (
                <Typography key={i} sx={{ fontSize: '0.78rem' }}>
                  • <strong>{r.field}</strong> — f.eks. <code>{r.example}</code>
                </Typography>
              ))}
              <Typography sx={{ fontSize: '0.72rem', mt: 0.4, opacity: 0.8 }}>
                Estimert klient-tid: {template.estimatedMinutes} min
              </Typography>
            </Alert>
          ) : null}

          <Stack direction="row" spacing={1.2}>
            <TextField
              label="Klientens navn"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              fullWidth
              variant="outlined"
              sx={textFieldSx}
            />
            <TextField
              label="Klientens e-post"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              required
              fullWidth
              type="email"
              variant="outlined"
              sx={textFieldSx}
            />
          </Stack>

          <TextField
            label="Tittel (også e-post-subject)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            variant="outlined"
            sx={textFieldSx}
          />

          <TextField
            label="Melding til klienten"
            value={bodyMarkdown}
            onChange={(e) => setBodyMarkdown(e.target.value)}
            fullWidth
            multiline
            minRows={10}
            maxRows={22}
            variant="outlined"
            helperText="Markdown støttes. Klienten får denne som e-post + en lenke for å svare direkte i nettleser uten innlogging."
            sx={textFieldSx}
          />

          {bookingUrl ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <input
                type="checkbox"
                checked={includeBookingLink}
                onChange={(e) => setIncludeBookingLink(e.target.checked)}
              />
              <Typography sx={{ fontSize: '0.84rem', color: 'rgba(226,232,240,0.85)' }}>
                Legg ved booking-lenke: <code>{bookingUrl}</code>
              </Typography>
            </Stack>
          ) : (
            <Typography sx={{ fontSize: '0.74rem', color: 'rgba(226,232,240,0.5)' }}>
              Tips: Legg inn en Calendly/Cal.com-URL i prosjekt-config for å tilby klienten en booking-lenke automatisk.
            </Typography>
          )}

          {error ? (
            <Alert severity="error" sx={{ bgcolor: 'rgba(239,68,68,0.1)' }}>
              {error}
            </Alert>
          ) : null}
          {success ? (
            <Alert severity="success" sx={{ bgcolor: 'rgba(52,211,153,0.1)' }}>
              {success}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting} sx={{ color: '#cbd5e1', textTransform: 'none' }}>
          Avbryt
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          disabled={submitting}
          variant="contained"
          startIcon={submitting ? <CircularProgress size={14} sx={{ color: '#0b1226' }} /> : <SendIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: '#22d3ee',
            color: '#0b1226',
            '&:hover': { bgcolor: '#06b6d4' },
          }}
        >
          {submitting ? 'Sender…' : 'Send forespørsel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const textFieldSx = {
  '& .MuiInputBase-input': { color: '#f8fafc' },
  '& .MuiInputBase-multiline': { color: '#f8fafc' },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.7)' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
  '& .MuiFormHelperText-root': { color: 'rgba(226,232,240,0.55)' },
} as const;

export default ClientRequestModal;
