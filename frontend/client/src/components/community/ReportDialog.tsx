/**
 * Report Dialog Component
 * Allows users to report violations in the community
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  IconButton,
} from '@mui/material';
import { Close, Report, Send } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import {
  COMMUNITY_DIALOG_ACTIONS_SX,
  COMMUNITY_DIALOG_CLOSE_BUTTON_SX,
  COMMUNITY_DIALOG_CONTENT_SX,
  COMMUNITY_DIALOG_FIELD_SX,
  COMMUNITY_DIALOG_MUTED,
  COMMUNITY_DIALOG_PAPER_SX,
  COMMUNITY_DIALOG_PRIMARY_BUTTON_SX,
  COMMUNITY_DIALOG_SECONDARY_BUTTON_SX,
  COMMUNITY_DIALOG_SX,
  COMMUNITY_DIALOG_TEXT,
  COMMUNITY_DIALOG_TITLE_SX,
} from './communityDialogStyles';

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedMessageId?: string;
  channelId?: string;
  reporterId: string;
}

export default function ReportDialog({
  open,
  onClose,
  reportedUserId,
  reportedMessageId,
  channelId,
  reporterId,
}: ReportDialogProps) {
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const reportReasons = [
    { value: 'respect', label: 'Respekt og Profesjonalitet - Trakassering eller upassende språk' },
    { value: 'quality', label: 'Kvalitetsinnhold - Irrelevant eller lavkvalitetsinnhold' },
    { value: 'spam', label: 'Spam - Reklame eller spam' },
    { value: 'copyright', label: 'Opphavsrett - Deling av beskyttet innhold' },
    { value: 'confidentiality', label: 'Konfidensialitet - Deling av privat informasjon' },
    { value: 'feedback', label: 'Konstruktiv Tilbakemelding - Personlige angrep' },
    { value: 'channel', label: 'Riktig Kanalbruk - Feil kanal' },
    { value: 'other', label: 'Annet - Beskriv nedenfor' },
  ];

  const handleSubmit = async () => {
    if (!reportReason || !reportDescription.trim()) {
      setError('Vennligst velg en grunn og beskriv problemet');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await apiRequest('/api/community/moderation/report', {
        method: 'POST',
        body: JSON.stringify({
          reporterId,
          reportedUserId,
          reportedMessageId,
          channelId,
          reportReason,
          reportDescription,
        }),
      }) as { success: boolean; message: string };

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setReportReason('');
          setReportDescription('');
        }, 2000);
      }
    } catch (err) {
      console.error('Error submitting report: ', err);
      setError('Kunne ikke sende rapport. Vennligst prøv igjen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={COMMUNITY_DIALOG_SX}
      PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
    >
      <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Report sx={{ color: '#ff8e83' }} />
            <Typography variant="h6" sx={{ fontWeight: 800, color: COMMUNITY_DIALOG_TEXT }}>
              Rapporter Regelbrudd
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={COMMUNITY_DIALOG_CLOSE_BUTTON_SX}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          ...COMMUNITY_DIALOG_CONTENT_SX,
          '& .MuiFormLabel-root': { color: COMMUNITY_DIALOG_MUTED },
          '& .MuiRadio-root': { color: COMMUNITY_DIALOG_MUTED },
          '& .MuiRadio-root.Mui-checked': { color: '#ff8c00' },
        }}
      >
        {success ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Takk for rapporten! Vårt moderasjonsteam vil gjennomgå den snart.
          </Alert>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 3 }}>
              Din identitet vil holdes konfidensiell. Bruk dette skjemaet kun for alvorlige regelbrudd.
            </Alert>

            <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
              <FormLabel component="legend" sx={{ mb: 2, fontWeight: 'bold' }}>
                Hva er grunnen til rapporten?
              </FormLabel>
              <RadioGroup
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              >
                {reportReasons.map((reason) => (
                  <FormControlLabel
                    key={reason.value}
                    value={reason.value}
                    control={<Radio />}
                    label={reason.label}
                    sx={{ mb: 1 }}
                  />
                ))}
              </RadioGroup>
            </FormControl>

            <TextField
              label="Beskriv problemet"
              multiline
              rows={4}
              fullWidth
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              placeholder="Vennligst gi en detaljert beskrivelse av hva som skjedde..."
              required
              helperText="Vær så spesifikk som mulig. Dette hjelper vårt moderasjonsteam med å ta riktig beslutning."
              sx={COMMUNITY_DIALOG_FIELD_SX}
            />

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={COMMUNITY_DIALOG_ACTIONS_SX}>
        <Button onClick={onClose} disabled={submitting} sx={COMMUNITY_DIALOG_SECONDARY_BUTTON_SX}>
          Avbryt
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting || success}
          startIcon={<Send />}
          sx={COMMUNITY_DIALOG_PRIMARY_BUTTON_SX}
        >
          {submitting ? 'Sender...' : 'Send Rapport'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
