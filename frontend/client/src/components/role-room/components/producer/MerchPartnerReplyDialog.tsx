/**
 * MerchPartnerReplyDialog — Slice 7c (manual mark).
 *
 * Producer paster inn en oppsummering av det partneren svarte +
 * sentiment-pille (positiv/nøytral/negativ). Lagres mot den sendte
 * e-posten så supplier-cardet kan vise "Svar mottatt 5. mai · positivt".
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
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
import {
  CheckCircle as CheckIcon,
  Close as CloseIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  RemoveCircle as NeutralIcon,
} from '@mui/icons-material';
import {
  logMerchPartnerReply,
  type MerchPartnerEmailLogEntry,
  type MerchReplySentiment,
} from '../../services/roleRoomAgentClaudeApi';

interface MerchPartnerReplyDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  projectId: string | null;
  /** The sent email this reply belongs to. */
  sentEmail: MerchPartnerEmailLogEntry | null;
}

const SENTIMENT_OPTIONS: ReadonlyArray<{ id: MerchReplySentiment; label: string; icon: React.ReactNode; color: string }> = [
  { id: 'positive', label: 'Positivt — vil gå videre', icon: <ThumbUpIcon fontSize="small" />, color: '#bbf7d0' },
  { id: 'neutral', label: 'Nøytralt — trenger mer info', icon: <NeutralIcon fontSize="small" />, color: '#fde68a' },
  { id: 'negative', label: 'Negativt — passer ikke', icon: <ThumbDownIcon fontSize="small" />, color: '#fecaca' },
];

const MerchPartnerReplyDialog: React.FC<MerchPartnerReplyDialogProps> = ({
  open,
  onClose,
  onSaved,
  projectId,
  sentEmail,
}) => {
  const [summary, setSummary] = useState('');
  const [fullText, setFullText] = useState('');
  const [sentiment, setSentiment] = useState<MerchReplySentiment>('positive');
  const [repliedAt, setRepliedAt] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open / sentEmail change
  useEffect(() => {
    if (open) {
      setSummary('');
      setFullText('');
      setSentiment('positive');
      setRepliedAt(new Date().toISOString().slice(0, 16));
      setError(null);
    }
  }, [open, sentEmail?.id]);

  const handleSave = async () => {
    if (!projectId || !sentEmail || !summary.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await logMerchPartnerReply({
        projectId,
        emailId: sentEmail.id,
        replySummary: summary.trim(),
        replyFullText: fullText.trim() || null,
        sentiment,
        repliedAt: new Date(repliedAt).toISOString(),
      });
      if (!r) {
        setError('Klarte ikke å lagre svaret. Prøv igjen.');
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Marker svar fra {sentEmail?.partnerName ?? 'partner'}
        <IconButton
          onClick={onClose}
          disabled={saving}
          size="small"
          sx={{ position: 'absolute', right: 8, top: 8 }}
          aria-label="Lukk"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.6}>
          {sentEmail ? (
            <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
              Til <strong>{sentEmail.partnerEmail}</strong>, sendt {new Date(sentEmail.sentAt).toLocaleString('nb-NO')}: «{sentEmail.subject}»
            </Typography>
          ) : null}

          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem', alignSelf: 'center', mr: 0.5 }}>
              Tone:
            </Typography>
            {SENTIMENT_OPTIONS.map((opt) => {
              const active = sentiment === opt.id;
              return (
                <Chip
                  key={opt.id}
                  size="small"
                  clickable
                  icon={opt.icon as React.ReactElement}
                  label={opt.label}
                  onClick={() => setSentiment(opt.id)}
                  sx={{
                    bgcolor: active ? `rgba(99,102,241,0.2)` : 'rgba(15,23,42,0.6)',
                    color: active ? opt.color : 'text.primary',
                    border: active ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(148,163,184,0.2)',
                  }}
                />
              );
            })}
          </Stack>

          <TextField
            label="Tidspunkt for svar"
            type="datetime-local"
            value={repliedAt}
            onChange={(e) => setRepliedAt(e.target.value)}
            size="small"
            fullWidth
          />

          <TextField
            label="Kort sammendrag (1-3 setninger)"
            value={summary}
            onChange={(e) => setSummary(e.target.value.slice(0, 600))}
            placeholder="f.eks. 'Spennende forslag, ber om møte 12. mai for å diskutere drakt-spec.'"
            size="small"
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            required
          />

          <TextField
            label="Hele svaret (valgfritt)"
            value={fullText}
            onChange={(e) => setFullText(e.target.value.slice(0, 8000))}
            placeholder="Lim inn full e-post-tekst hvis du vil ha den lagret i prosjektet"
            size="small"
            fullWidth
            multiline
            minRows={3}
            maxRows={10}
          />

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={saving}>Avbryt</Button>
        <Button
          onClick={() => void handleSave()}
          variant="contained"
          disabled={!summary.trim() || saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <CheckIcon fontSize="small" />}
        >
          {saving ? 'Lagrer …' : 'Lagre svar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MerchPartnerReplyDialog;
