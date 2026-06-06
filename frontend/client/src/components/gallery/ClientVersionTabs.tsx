/**
 * ClientVersionTabs — versjons-velger + approve/request-changes-knapper
 * for klient-galleri.
 *
 * Henter GET /api/client/gallery/:accessToken/versions og rendrer:
 *   - Tabber per publisert versjon (R1, R2, R3, Final, ...)
 *   - Status-chip per versjon: "Godkjent av deg", "Du har bedt om endringer",
 *     "Venter på din review", "Sett av deg"
 *   - Notes-felt: "Hva er endret fra forrige versjon" som fotografen
 *     skrev
 *   - To handlinger på aktiv versjon:
 *       [ ❤️ Godkjenn denne versjonen ]   → POST /approve
 *       [ ✍ Be om endringer ]              → åpner dialog med tekstfelt
 *                                            → POST /request-changes
 *
 * Når en versjon er valgt, kaller komponenten onVersionChange-callback
 * slik at containeren kan bytte ut bilde-listen.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Card,
  CardContent,
  Stack,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Edit as EditIcon,
  HourglassEmpty as PendingIcon,
  Favorite as FavoriteIcon,
} from '@mui/icons-material';

interface VersionDecision {
  decision: 'approved' | 'changes_requested' | 'in_review' | 'rejected';
  decision_note: string | null;
  decided_by_email: string;
  decided_by_label: string | null;
  decided_at: string;
}

interface Version {
  id: string;
  label: string;
  order: number;
  publishedAt: string | null;
  notes: string | null;
  imageCount: number;
  decision: VersionDecision | null;
}

interface VersionsResponse {
  success: boolean;
  versions: Version[];
}

interface Props {
  accessToken: string;
  galleryPassword?: string | null;
  /** E-post som vi sender med decision. Klienten må ha skrevet inn dette. */
  clientEmail: string;
  /** Visningsnavn (valgfritt). */
  clientName?: string | null;
  onVersionChange?: (version: Version | null) => void;
  /** Refetch-intervall (ms). Default 60 sek. */
  pollIntervalMs?: number;
}

const decisionChip = (d: VersionDecision | null) => {
  if (!d) {
    return (
      <Chip
        icon={<PendingIcon sx={{ fontSize: 14 }} />}
        label="Venter på review"
        size="small"
        sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600 }}
      />
    );
  }
  switch (d.decision) {
    case 'approved':
      return (
        <Chip
          icon={<CheckIcon sx={{ fontSize: 14 }} />}
          label="Godkjent av deg"
          size="small"
          sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 600 }}
        />
      );
    case 'changes_requested':
      return (
        <Chip
          icon={<EditIcon sx={{ fontSize: 14 }} />}
          label="Du har bedt om endringer"
          size="small"
          sx={{ bgcolor: '#fecaca', color: '#991b1b', fontWeight: 600 }}
        />
      );
    case 'rejected':
      return (
        <Chip
          label="Avslått"
          size="small"
          sx={{ bgcolor: '#fecaca', color: '#991b1b', fontWeight: 600 }}
        />
      );
    default:
      return (
        <Chip
          label="Sett av deg"
          size="small"
          sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 600 }}
        />
      );
  }
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

export const ClientVersionTabs: React.FC<Props> = ({
  accessToken,
  galleryPassword,
  clientEmail,
  clientName,
  onVersionChange,
  pollIntervalMs = 60_000,
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [requestChangesNote, setRequestChangesNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ severity: 'success' | 'error'; msg: string } | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/client/gallery/${encodeURIComponent(accessToken)}/versions`,
        {
          credentials: 'include',
          headers: galleryPassword
            ? { 'x-gallery-password': galleryPassword }
            : undefined,
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as VersionsResponse;
      setVersions(data.versions || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken, galleryPassword]);

  useEffect(() => {
    void fetchVersions();
    const interval = setInterval(fetchVersions, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchVersions, pollIntervalMs]);

  const activeVersion = versions[activeIdx] || null;
  useEffect(() => {
    onVersionChange?.(activeVersion);
  }, [activeVersion, onVersionChange]);

  const submitDecision = async (
    decision: 'approve' | 'request-changes',
    note: string | null,
  ) => {
    if (!activeVersion) return;
    if (!clientEmail) {
      setToast({
        severity: 'error',
        msg: 'Skriv inn e-posten din først (du finner feltet under galleriet).',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/client/gallery/${encodeURIComponent(accessToken)}/versions/${encodeURIComponent(activeVersion.label)}/${decision}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(galleryPassword ? { 'x-gallery-password': galleryPassword } : {}),
          },
          body: JSON.stringify({
            clientEmail,
            clientName: clientName || null,
            note,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      setToast({
        severity: 'success',
        msg:
          decision === 'approve'
            ? `Tusen takk! Du godkjente ${activeVersion.label}.`
            : `Beskjed mottatt. Fotografen får din tilbakemelding nå.`,
      });
      setRequestChangesOpen(false);
      setRequestChangesNote('');
      void fetchVersions();
    } catch (err) {
      setToast({
        severity: 'error',
        msg: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && versions.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  if (error && versions.length === 0) return null;
  if (versions.length === 0) return null;

  const myDecision = activeVersion?.decision ?? null;
  const isMyApproval =
    myDecision?.decision === 'approved' &&
    myDecision.decided_by_email === clientEmail.trim().toLowerCase();

  return (
    <>
      <Card sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeIdx}
          onChange={(_, v) => setActiveIdx(v as number)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: '1px solid rgba(15,23,42,0.08)',
            px: 2,
            minHeight: 48,
          }}
        >
          {versions.map((v, i) => (
            <Tab
              key={v.id}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {v.label}
                  </Typography>
                  {v.decision?.decision === 'approved' && (
                    <CheckIcon sx={{ fontSize: 16, color: '#166534' }} />
                  )}
                  {v.decision?.decision === 'changes_requested' && (
                    <EditIcon sx={{ fontSize: 16, color: '#991b1b' }} />
                  )}
                </Stack>
              }
              value={i}
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
          ))}
        </Tabs>
        <CardContent>
          {activeVersion && (
            <Stack spacing={2}>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {activeVersion.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {activeVersion.imageCount} fil(er)
                    {activeVersion.publishedAt
                      ? ` · publisert ${formatDate(activeVersion.publishedAt)}`
                      : ''}
                  </Typography>
                </Box>
                {decisionChip(myDecision)}
              </Stack>

              {activeVersion.notes && (
                <Alert severity="info" icon={false} sx={{ bgcolor: '#fef9c3', color: '#854d0e' }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, display: 'block', mb: 0.25 }}
                  >
                    Hva er endret fra forrige versjon:
                  </Typography>
                  <Typography variant="body2">{activeVersion.notes}</Typography>
                </Alert>
              )}

              {myDecision?.decision === 'changes_requested' && myDecision.decision_note && (
                <Alert severity="warning">
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                    Du sendte denne tilbakemeldingen{' '}
                    {formatDate(myDecision.decided_at)}:
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    "{myDecision.decision_note}"
                  </Typography>
                </Alert>
              )}

              {/* Approve / Request-changes-knapper.
                  Skjules etter approve så klienten ikke kan godkjenne to ganger. */}
              {!isMyApproval && (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  justifyContent="flex-end"
                >
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => setRequestChangesOpen(true)}
                    disabled={submitting}
                  >
                    Be om endringer
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<FavoriteIcon />}
                    onClick={() => void submitDecision('approve', null)}
                    disabled={submitting}
                    sx={{ fontWeight: 700 }}
                  >
                    {submitting ? 'Sender…' : `Godkjenn ${activeVersion.label}`}
                  </Button>
                </Stack>
              )}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={requestChangesOpen}
        onClose={() => setRequestChangesOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Be om endringer på {activeVersion?.label}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Beskriv kort hva som skal endres. Fotografen får tilbakemeldingen
            på e-post umiddelbart.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={4}
            placeholder="F.eks. 'Kan du klippe ut sekvensen ved 03:47 — der hosten er?'"
            value={requestChangesNote}
            onChange={(e) => setRequestChangesNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRequestChangesOpen(false)} disabled={submitting}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={() => void submitDecision('request-changes', requestChangesNote)}
            disabled={!requestChangesNote.trim() || submitting}
          >
            {submitting ? 'Sender…' : 'Send tilbakemelding'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
};

export default ClientVersionTabs;
