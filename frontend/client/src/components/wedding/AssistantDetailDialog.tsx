// @ts-nocheck
/**
 * AssistantDetailDialog — Slice 9X.45 + 9X.48 + 9X.49 + 9X.50
 *
 * Modal med tre tabs for én assistent:
 *   - Drive: setup delt mappe, file-count, nye filer siden sist sett
 *   - Brief: book Meet-møte, skriv/lim transcript-URL, generer AI-sammendrag + action-items
 *   - Personvern: samtykke-status, signert-status, "request deletion"
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Box,
  Stack,
  Typography,
  Button,
  TextField,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  CloudUpload as DriveIcon,
  EventNote as BriefIcon,
  PrivacyTip as GdprIcon,
  AutoFixHigh as AiIcon,
  OpenInNew as OpenIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface Assistant {
  id: string;
  assistantEmail: string | null;
  assistantName: string | null;
  role: string;
  status: string;
  // Drive
  driveFolderId: string | null;
  driveFolderUrl: string | null;
  driveFolderSetupAt: string | null;
  lastKnownFileCount: number | null;
  newFilesSinceViewed: number;
  lastNewFilesAt: string | null;
  // Sub-kontrakt
  subcontractSignedAt: string | null;
  subcontractSignerName: string | null;
  // Brief
  briefMeetingUrl: string | null;
  briefMeetingAt: string | null;
  briefMeetingDurationMin: number | null;
  briefSummarizedAt: string | null;
  // GDPR
  gdprConsentAt: string | null;
  gdprDeleteRequestedAt: string | null;
  gdprAnonymizedAt: string | null;
}

interface BriefFull {
  meetingUrl: string | null;
  meetingAt: string | null;
  notes: string | null;
  transcriptUrl: string | null;
  summary: string | null;
  actionItems: Array<{ owner: string; task: string; due: string | null }>;
  summarizedAt: string | null;
  summaryModel: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  weddingId: string;
  assistant: Assistant | null;
  onChanged: () => void;
}

const formatDate = (s: string | null): string =>
  s ? new Date(s).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const AssistantDetailDialog: React.FC<Props> = ({ open, onClose, weddingId, assistant, onChanged }) => {
  const [tab, setTab] = useState(0);

  if (!assistant) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Stack>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
            {assistant.assistantName || assistant.assistantEmail || 'Assistent'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {assistant.assistantEmail} · {assistant.role}
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<DriveIcon fontSize="small" />} iconPosition="start" label="Drive" />
        <Tab icon={<BriefIcon fontSize="small" />} iconPosition="start" label="Brief" />
        <Tab icon={<GdprIcon fontSize="small" />} iconPosition="start" label="Personvern" />
      </Tabs>

      <DialogContent dividers>
        {tab === 0 && <DriveTab weddingId={weddingId} assistant={assistant} onChanged={onChanged} />}
        {tab === 1 && <BriefTab weddingId={weddingId} assistant={assistant} onChanged={onChanged} />}
        {tab === 2 && <GdprTab assistant={assistant} onChanged={onChanged} />}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

/* ─── Drive-tab ─────────────────────────────────────────────────── */

const DriveTab: React.FC<{ weddingId: string; assistant: Assistant; onChanged: () => void }> = ({ weddingId, assistant, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [folderState, setFolderState] = useState({
    folderUrl: assistant.driveFolderUrl,
    folderId: assistant.driveFolderId,
    fileCount: assistant.lastKnownFileCount ?? 0,
    newSinceViewed: assistant.newFilesSinceViewed ?? 0,
    lastNewAt: assistant.lastNewFilesAt,
  });

  const handleSetup = async () => {
    setBusy(true); setError(null); setInfo(null);
    try {
      const r: any = await apiRequest(`/api/wedding/${weddingId}/assistants/${assistant.id}/setup-drive-folder`, { method: 'POST' });
      setFolderState((s) => ({ ...s, folderUrl: r.folderUrl, folderId: r.folderId, fileCount: 0 }));
      setInfo(`Mappe opprettet og delt med ${r.sharedWith || assistant.assistantEmail}.`);
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke sette opp Drive-mappe');
    } finally { setBusy(false); }
  };

  const handleCheck = async () => {
    setBusy(true); setError(null);
    try {
      const r: any = await apiRequest(`/api/wedding/${weddingId}/assistants/${assistant.id}/check-drive`, { method: 'POST' });
      setFolderState((s) => ({
        ...s,
        fileCount: r.fileCount ?? s.fileCount,
        newSinceViewed: r.newFilesSinceViewed ?? s.newSinceViewed,
        lastNewAt: r.lastNewFilesAt ?? s.lastNewAt,
      }));
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke sjekke mappen');
    } finally { setBusy(false); }
  };

  const handleOpen = async () => {
    if (!folderState.folderUrl) return;
    if (folderState.newSinceViewed > 0) {
      try {
        await apiRequest(`/api/wedding/${weddingId}/assistants/${assistant.id}/mark-files-viewed`, { method: 'POST' });
        setFolderState((s) => ({ ...s, newSinceViewed: 0 }));
        onChanged();
      } catch { /* ignore */ }
    }
    window.open(folderState.folderUrl, '_blank', 'noopener');
  };

  if (!folderState.folderUrl) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Lag en delt Google Drive-mappe assistenten laster opp bildene sine til. Du får varsel automatisk når nye filer dukker opp.
        </Typography>
        {!assistant.assistantEmail && <Alert severity="warning">Mangler assistent-e-post. Legg til e-post først.</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        {info && <Alert severity="success">{info}</Alert>}
        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DriveIcon />}
          onClick={handleSetup}
          disabled={busy || !assistant.assistantEmail}
        >
          {busy ? 'Setter opp…' : 'Opprett og del Drive-mappe'}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {info && <Alert severity="success" onClose={() => setInfo(null)}>{info}</Alert>}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={1}>
          <Stack>
            <Typography variant="body2"><b>Filer i mappen:</b> {folderState.fileCount}</Typography>
            {folderState.newSinceViewed > 0 && (
              <Chip
                size="small"
                color="warning"
                label={`${folderState.newSinceViewed} nye siden sist sett`}
                sx={{ mt: 0.5, alignSelf: 'flex-start' }}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              Siste nye opplastning: {formatDate(folderState.lastNewAt)}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={busy ? <CircularProgress size={14} /> : <RefreshIcon />}
              onClick={handleCheck}
              disabled={busy}
            >
              Sjekk nå
            </Button>
            <Button size="small" variant="contained" startIcon={<OpenIcon />} onClick={handleOpen}>
              Åpne i Drive
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Typography variant="caption" color="text.secondary">
        Mappen er delt med {assistant.assistantEmail}. Background-job sjekker for nye filer hvert 5.–10. min.
        Sett opp: {formatDate(assistant.driveFolderSetupAt)}.
      </Typography>
    </Stack>
  );
};

/* ─── Brief-tab ─────────────────────────────────────────────────── */

const BriefTab: React.FC<{ weddingId: string; assistant: Assistant; onChanged: () => void }> = ({ weddingId, assistant, onChanged }) => {
  const [brief, setBrief] = useState<BriefFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Form-state
  const [notes, setNotes] = useState('');
  const [transcriptUrl, setTranscriptUrl] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [durationMin, setDurationMin] = useState('30');

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await apiRequest(`/api/wedding/${weddingId}/assistants/${assistant.id}/brief-full`);
      setBrief(r.brief);
      setNotes(r.brief?.notes || '');
      setTranscriptUrl(r.brief?.transcriptUrl || '');
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke laste brief');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [assistant.id]);

  const handleSchedule = async () => {
    if (!scheduleAt) { setError('Velg tidspunkt'); return; }
    setBusy(true); setError(null); setInfo(null);
    try {
      const r: any = await apiRequest(`/api/wedding/${weddingId}/assistants/${assistant.id}/schedule-brief`, {
        method: 'POST',
        body: {
          startDateTime: new Date(scheduleAt).toISOString(),
          durationMin: parseInt(durationMin) || 30,
        },
      });
      setInfo(`Møte opprettet. ${r.meetLink ? 'Meet-lenke sendt på e-post.' : ''}`);
      await load();
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke opprette møte');
    } finally { setBusy(false); }
  };

  const handleCancelMeeting = async () => {
    if (!window.confirm('Fjerne brief-møte-lenken? (Du må selv kansellere i Google Calendar.)')) return;
    setBusy(true); setError(null);
    try {
      await apiRequest(`/api/wedding/${weddingId}/assistants/${assistant.id}/brief`, { method: 'DELETE' });
      await load();
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke slette');
    } finally { setBusy(false); }
  };

  const handleSaveNotes = async () => {
    setBusy(true); setError(null); setInfo(null);
    try {
      await apiRequest(`/api/wedding/${weddingId}/assistants/${assistant.id}/brief-notes`, {
        method: 'PUT',
        body: { notes, transcriptUrl: transcriptUrl || null },
      });
      setInfo('Notater lagret.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke lagre');
    } finally { setBusy(false); }
  };

  const handleSummarize = async () => {
    setBusy(true); setError(null); setInfo(null);
    try {
      const r: any = await apiRequest(`/api/wedding/${weddingId}/assistants/${assistant.id}/brief-summarize`, { method: 'POST' });
      setInfo(`Sammendrag generert. ${r.actionItems?.length || 0} action-items.`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Sammendrag feilet');
    } finally { setBusy(false); }
  };

  if (loading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} /></Box>;

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {info && <Alert severity="success" onClose={() => setInfo(null)}>{info}</Alert>}

      {/* Meeting-sektion */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Brief-møte (Google Meet)</Typography>
        {brief?.meetingUrl ? (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip
              size="small"
              color="success"
              icon={<CheckIcon />}
              label={brief.meetingAt ? formatDate(brief.meetingAt) : 'Booket'}
            />
            <Button size="small" variant="outlined" startIcon={<OpenIcon />} href={brief.meetingUrl} target="_blank" rel="noopener">
              Åpne Meet
            </Button>
            <Button size="small" color="error" startIcon={<CancelIcon />} onClick={handleCancelMeeting} disabled={busy}>
              Fjern
            </Button>
          </Stack>
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
            <TextField
              type="datetime-local"
              size="small"
              label="Tidspunkt"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1, minWidth: 200 }}
            />
            <TextField
              type="number"
              size="small"
              label="Min"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              inputProps={{ min: 15, max: 240, step: 15 }}
              sx={{ width: 90 }}
            />
            <Button variant="contained" onClick={handleSchedule} disabled={busy || !scheduleAt || !assistant.assistantEmail}>
              {busy ? 'Booker…' : 'Book'}
            </Button>
          </Stack>
        )}
      </Paper>

      {/* Notes + transcript */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Notater fra møtet</Typography>
        <TextField
          multiline
          minRows={4}
          maxRows={12}
          fullWidth
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Hva ble avtalt? Roller, lokasjon, utstyr…"
          size="small"
        />
        <TextField
          fullWidth
          size="small"
          label="Transcript-URL (valgfri)"
          value={transcriptUrl}
          onChange={(e) => setTranscriptUrl(e.target.value)}
          placeholder="Lim Drive-lenke til Meet-recording eller transcript"
          sx={{ mt: 1 }}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" variant="outlined" onClick={handleSaveNotes} disabled={busy}>
            Lagre notater
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<AiIcon />}
            onClick={handleSummarize}
            disabled={busy || !notes.trim() || notes.trim().length < 20}
          >
            Generer sammendrag
          </Button>
        </Stack>
      </Box>

      {/* AI-summary */}
      {brief?.summary && (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <AiIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2">AI-sammendrag</Typography>
            <Typography variant="caption" color="text.secondary">
              {brief.summarizedAt ? `(${formatDate(brief.summarizedAt)} · ${brief.summaryModel})` : ''}
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>{brief.summary}</Typography>

          {brief.actionItems?.length > 0 && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Action-items</Typography>
              <List dense disablePadding>
                {brief.actionItems.map((item, i) => (
                  <ListItem key={i} sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Checkbox size="small" disabled checked={false} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip size="small" label={item.owner} variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                          <Typography variant="body2">{item.task}</Typography>
                        </Stack>
                      }
                      secondary={item.due ? `Frist: ${item.due}` : null}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Paper>
      )}
    </Stack>
  );
};

/* ─── GDPR-tab ──────────────────────────────────────────────────── */

const GdprTab: React.FC<{ assistant: Assistant; onChanged: () => void }> = ({ assistant, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleRequestDeletion = async () => {
    if (!window.confirm(`Be om sletting av personlige data for ${assistant.assistantName || assistant.assistantEmail}?\n\nAdmin vil anonymisere innen 30 dager. Fakturerings-grunnlag beholdes (regnskapsloven krever 5 års oppbevaring).`)) return;
    setBusy(true); setError(null); setInfo(null);
    try {
      await apiRequest(`/api/photographer/assistants/${assistant.id}/request-deletion`, { method: 'POST' });
      setInfo('Sletteforespørsel registrert. Admin gjennomgår.');
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke registrere');
    } finally { setBusy(false); }
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {info && <Alert severity="success">{info}</Alert>}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Status</Typography>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2">GDPR-samtykke</Typography>
            {assistant.gdprConsentAt
              ? <Chip size="small" color="success" icon={<CheckIcon />} label={formatDate(assistant.gdprConsentAt)} />
              : <Chip size="small" label="Ikke registrert" />}
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2">Sub-kontrakt signert</Typography>
            {assistant.subcontractSignedAt
              ? <Chip size="small" color="success" icon={<CheckIcon />} label={`${assistant.subcontractSignerName || ''} · ${formatDate(assistant.subcontractSignedAt)}`} />
              : <Chip size="small" label="Ikke signert" />}
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2">Sletteforespørsel</Typography>
            {assistant.gdprAnonymizedAt
              ? <Chip size="small" color="success" label={`Anonymisert ${formatDate(assistant.gdprAnonymizedAt)}`} />
              : assistant.gdprDeleteRequestedAt
                ? <Chip size="small" color="warning" label={`Venter (forespurt ${formatDate(assistant.gdprDeleteRequestedAt)})`} />
                : <Chip size="small" label="Ingen" />}
          </Stack>
        </Stack>
      </Paper>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Personlige data vi lagrer</Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ marginTop: 4, paddingLeft: 18 }}>
            <li>E-post, navn og telefon (kontakt)</li>
            <li>Signaturdetaljer (fullt navn, evt. 4 siste sifre, IP, tidspunkt)</li>
            <li>Notater fra brief-møte (kan inneholde personlig info)</li>
            <li>Drive-mappe-ID som er delt med dem</li>
          </ul>
        </Typography>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" color="error" sx={{ mb: 1 }}>Be om sletting</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Registrerer en forespørsel som admin behandler innen 30 dager. Personlige felter anonymiseres;
          fakturerings-grunnlag beholdes som påkrevd av norsk regnskapslov.
        </Typography>
        <Button
          color="error"
          variant="outlined"
          startIcon={<DeleteIcon />}
          onClick={handleRequestDeletion}
          disabled={busy || !!assistant.gdprDeleteRequestedAt || !!assistant.gdprAnonymizedAt}
        >
          Be om sletting
        </Button>
      </Box>
    </Stack>
  );
};

export default AssistantDetailDialog;
