import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  Email as EmailIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomAccessRequestPlatform,
  type RoleRoomSocialAccessRequest,
} from '../../services/roleRoomAgentService';

interface SocialAccessRequestDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  platform: RoleRoomAccessRequestPlatform;
  /** Vises i header — f.eks. "YouTube" eller "Instagram". */
  platformLabel: string;
}

/**
 * Modal som lar produsenten lage en proaktiv tilgangsforespørsel-e-post
 * til kunden. Claude lager teksten skreddersydd til kunden + bransje, og
 * vi limer på plattform-spesifikke trinn slik at mottakeren slipper å
 * gjette hvor i UI-en de skal.
 *
 * UX:
 *   - Valgfritt: produsenten fyller inn kundens navn + e-post
 *   - "Lag e-post" → Claude returnerer subject/body/steps/mailto-URL
 *   - Kopi-knapper på tittel + body + hele e-posten
 *   - "Åpne i e-post-app" hvis mailto-URL er tilgjengelig
 */
export default function SocialAccessRequestDialog({
  open,
  onClose,
  projectId,
  platform,
  platformLabel,
}: SocialAccessRequestDialogProps): React.ReactElement {
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<RoleRoomSocialAccessRequest | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    const result = await roleRoomAgentService.generateSocialAccessRequest({
      projectId,
      platform,
      recipientName: recipientName.trim() || null,
      recipientEmail: recipientEmail.trim() || null,
    });
    if (result.error) setError(result.error);
    setRequest(result.request);
    setLoading(false);
  }

  function copy(value: string, key: string) {
    void navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  function handleClose() {
    onClose();
    // small delay to allow closing animation before reset
    window.setTimeout(() => {
      setRequest(null);
      setError(null);
      setRecipientName('');
      setRecipientEmail('');
    }, 250);
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0f172a',
          color: '#e2e8f0',
          border: '1px solid rgba(148,163,184,0.18)',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <EmailIcon sx={{ color: '#60a5fa' }} />
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: '#e2e8f0' }}>
              Be om tilgang til {platformLabel}
            </Typography>
          </Stack>
          <IconButton onClick={handleClose} sx={{ color: 'rgba(148,163,184,0.7)' }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.84rem', mb: 2 }}>
          CI lager en kort, vennlig e-post du kan sende til kunden, med konkrete steg-for-steg-
          instruksjoner for hvordan de gir deg admin-tilgang.
        </Typography>

        {!request ? (
          <Stack spacing={1.5}>
            <TextField
              label="Mottakerens navn (valgfritt)"
              size="small"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Ola Hansen"
              sx={textFieldSx}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.6)' } }}
            />
            <TextField
              label="Mottakerens e-post (valgfritt)"
              size="small"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="ola@bedrift.no"
              helperText="Hvis fylt ut, lager vi en mailto-lenke som åpner direkte i e-post-appen din."
              sx={textFieldSx}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.6)' } }}
              FormHelperTextProps={{ sx: { color: 'rgba(148,163,184,0.7)', fontSize: '0.7rem' } }}
            />
            {error ? (
              <Typography sx={{ color: '#fca5a5', fontSize: '0.78rem' }}>{error}</Typography>
            ) : null}
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <AutoAwesomeIcon />}
              onClick={generate}
              disabled={loading}
              sx={{
                textTransform: 'none',
                bgcolor: '#3b82f6',
                fontWeight: 600,
                '&:hover': { bgcolor: '#2563eb' },
              }}
            >
              {loading ? 'Lager e-post…' : 'Lag e-post med CI'}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.6}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={`Rolle: ${request.requiredRole}`}
                size="small"
                sx={{
                  bgcolor: 'rgba(168,85,247,0.15)',
                  color: '#d8b4fe',
                  fontSize: '0.7rem',
                  height: 20,
                }}
              />
              {request.source === 'fallback' ? (
                <Chip
                  label="standard-mal"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(148,163,184,0.18)',
                    color: '#cbd5e1',
                    fontSize: '0.66rem',
                    height: 20,
                  }}
                />
              ) : null}
            </Stack>

            <FieldBlock
              label="Emnefelt"
              value={request.subject}
              copyKey="subject"
              copied={copied === 'subject'}
              onCopy={copy}
            />
            <FieldBlock
              label="E-post"
              value={request.fullText}
              copyKey="full"
              copied={copied === 'full'}
              onCopy={copy}
              multiline
            />

            <Box>
              <Typography
                sx={{
                  color: 'rgba(148,163,184,0.85)',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  mb: 0.6,
                }}
              >
                Steg mottakeren skal følge
              </Typography>
              <Stack spacing={0.4} sx={{ pl: 1 }}>
                {request.steps.map((s, i) => (
                  <Typography key={i} sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.78rem' }}>
                    {i + 1}. {s}
                  </Typography>
                ))}
              </Stack>
            </Box>

            <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
              {request.mailtoUrl ? (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<EmailIcon sx={{ fontSize: '1rem' }} />}
                  onClick={() => window.open(request.mailtoUrl!, '_self')}
                  sx={{
                    textTransform: 'none',
                    bgcolor: '#3b82f6',
                    fontWeight: 600,
                    '&:hover': { bgcolor: '#2563eb' },
                  }}
                >
                  Åpne i e-post-app
                </Button>
              ) : null}
              <Button
                variant="outlined"
                size="small"
                onClick={() => setRequest(null)}
                sx={{
                  textTransform: 'none',
                  color: 'rgba(226,232,240,0.7)',
                  borderColor: 'rgba(148,163,184,0.3)',
                }}
              >
                Lag ny
              </Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    color: '#e2e8f0',
    bgcolor: 'rgba(15,23,42,0.6)',
    '& fieldset': { borderColor: 'rgba(148,163,184,0.25)' },
    '&:hover fieldset': { borderColor: 'rgba(148,163,184,0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
  },
} as const;

function FieldBlock({
  label,
  value,
  copyKey,
  copied,
  onCopy,
  multiline,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: boolean;
  onCopy: (value: string, key: string) => void;
  multiline?: boolean;
}) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.4 }}>
        <Typography
          sx={{
            color: 'rgba(148,163,184,0.85)',
            fontSize: '0.66rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </Typography>
        <Tooltip title={copied ? 'Kopiert' : 'Kopier'}>
          <IconButton
            size="small"
            onClick={() => onCopy(value, copyKey)}
            sx={{ color: copied ? '#86efac' : 'rgba(148,163,184,0.7)', p: 0.4 }}
          >
            {copied ? (
              <CheckIcon sx={{ fontSize: '0.95rem' }} />
            ) : (
              <ContentCopyIcon sx={{ fontSize: '0.95rem' }} />
            )}
          </IconButton>
        </Tooltip>
      </Stack>
      <Box
        sx={{
          p: 1,
          borderRadius: 1.2,
          bgcolor: 'rgba(15,23,42,0.5)',
          border: '1px solid rgba(148,163,184,0.16)',
          maxHeight: multiline ? 240 : 'auto',
          overflow: multiline ? 'auto' : 'visible',
        }}
      >
        <Typography
          sx={{
            color: '#e2e8f0',
            fontSize: '0.82rem',
            whiteSpace: multiline ? 'pre-wrap' : 'normal',
            lineHeight: multiline ? 1.55 : 1.3,
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}
