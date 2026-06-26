/**
 * SecretsRotationPanel — admin-oversikt over nøkkel-rotering.
 *
 * Henter fra GET /api/admin/secrets/rotation og viser:
 *   - Summary-kort: # overdue, # due_soon, # never_rotated, # missing-from-env
 *   - Tabell over alle sporede nøkler med status + dager til neste rotering
 *   - Knapp "Marker som rotert" per nøkkel (krever at admin har gjort
 *     selve rotasjonen først via Stripe/Cloudflare/Render-dashboardene)
 *
 * Vi lagrer ALDRI selve nøkkelverdiene — kun metadata om når de ble
 * rotert. Dette panelet erstatter ikke en KMS, men forhindrer "glemt
 * å rotere"-situasjonen som er den mest vanlige sikkerhets-svikten.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  Refresh as RefreshIcon,
  CheckCircle as RotatedIcon,
  Warning as OverdueIcon,
  Schedule as DueSoonIcon,
  Cancel as MissingIcon,
  HistoryToggleOff as NeverIcon,
} from '@mui/icons-material';

type Status = 'overdue' | 'due_soon' | 'ok' | 'never_rotated';

interface SecretRow {
  keyName: string;
  displayName: string;
  category: string;
  rotatedAt: string | null;
  rotatedBy: string | null;
  rotationIntervalDays: number;
  nextRotationDue: string | null;
  status: Status;
  daysUntilDue: number | null;
  envVarPresent: boolean;
  notes: string | null;
}

interface RotationResponse {
  success: boolean;
  summary: {
    overdue: number;
    dueSoon: number;
    neverRotated: number;
    ok: number;
    missingFromEnv: number;
  };
  rows: SecretRow[];
}

const statusChip = (status: Status, days: number | null) => {
  switch (status) {
    case 'overdue':
      return (
        <Chip
          icon={<OverdueIcon style={{ fontSize: 16 }} />}
          label={`Forfalt ${days != null ? `(${Math.abs(days)} dager)` : ''}`}
          size="small"
          sx={{ bgcolor: 'rgba(239,68,68,0.18)', color: '#fca5a5', fontWeight: 700 }}
        />
      );
    case 'due_soon':
      return (
        <Chip
          icon={<DueSoonIcon style={{ fontSize: 16 }} />}
          label={`Snart (${days} dager)`}
          size="small"
          sx={{ bgcolor: 'rgba(245,158,11,0.18)', color: '#fcd34d', fontWeight: 700 }}
        />
      );
    case 'never_rotated':
      return (
        <Chip
          icon={<NeverIcon style={{ fontSize: 16 }} />}
          label="Aldri rotert"
          size="small"
          sx={{ bgcolor: 'rgba(99,102,241,0.18)', color: '#a5b4fc', fontWeight: 700 }}
        />
      );
    default:
      return (
        <Chip
          icon={<RotatedIcon style={{ fontSize: 16 }} />}
          label={`OK (${days} dager)`}
          size="small"
          sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#86efac', fontWeight: 700 }}
        />
      );
  }
};

export const SecretsRotationPanel: React.FC = () => {
  const [data, setData] = useState<RotationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingDialog, setMarkingDialog] = useState<SecretRow | null>(null);
  const [markingNotes, setMarkingNotes] = useState('');
  const [marking, setMarking] = useState(false);
  const [toast, setToast] = useState<{ severity: 'success' | 'error'; msg: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/secrets/rotation', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as RotationResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const markAsRotated = async () => {
    if (!markingDialog) return;
    setMarking(true);
    try {
      const res = await fetch(
        `/api/admin/secrets/rotation/${encodeURIComponent(markingDialog.keyName)}/rotated`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: markingNotes || undefined }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      setToast({
        severity: 'success',
        msg: `Markert ${markingDialog.displayName} som rotert.`,
      });
      setMarkingDialog(null);
      setMarkingNotes('');
      void fetchData();
    } catch (err) {
      setToast({
        severity: 'error',
        msg: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setMarking(false);
    }
  };

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.04)', minHeight: '100%' }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Nøkkel-rotering
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Oversikt over når hver hemmelig nøkkel sist ble rotert. Marker som rotert ETTER at du
            har gjort selve rotasjonen i Stripe/Cloudflare/Render-dashboardet.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void fetchData()}
          disabled={loading}
        >
          Oppdater
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Kunne ikke hente rotation-status: {error}
        </Alert>
      ) : null}

      {/* Summary */}
      {data ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          <SummaryCard
            label="Forfalt"
            value={String(data.summary.overdue)}
            color={data.summary.overdue > 0 ? '#dc2626' : 'rgba(255,255,255,0.5)'}
            icon={<OverdueIcon />}
          />
          <SummaryCard
            label="Snart forfalt"
            value={String(data.summary.dueSoon)}
            color={data.summary.dueSoon > 0 ? '#f59e0b' : 'rgba(255,255,255,0.5)'}
            icon={<DueSoonIcon />}
          />
          <SummaryCard
            label="Aldri rotert"
            value={String(data.summary.neverRotated)}
            color={data.summary.neverRotated > 0 ? '#a5b4fc' : 'rgba(255,255,255,0.5)'}
            icon={<NeverIcon />}
          />
          <SummaryCard
            label="OK"
            value={String(data.summary.ok)}
            color="#16a34a"
            icon={<RotatedIcon />}
          />
          <SummaryCard
            label="Mangler i env"
            value={String(data.summary.missingFromEnv)}
            color={data.summary.missingFromEnv > 0 ? '#9333ea' : 'rgba(255,255,255,0.5)'}
            icon={<MissingIcon />}
          />
        </Box>
      ) : null}

      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            {loading && !data ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nøkkel</TableCell>
                    <TableCell>Kategori</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Sist rotert</TableCell>
                    <TableCell>Neste forfall</TableCell>
                    <TableCell>Intervall</TableCell>
                    <TableCell>Env</TableCell>
                    <TableCell align="right">Handling</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(Array.isArray(data?.rows) ? data.rows : []).map((row) => (
                    <TableRow
                      key={row.keyName}
                      sx={{
                        bgcolor:
                          row.status === 'overdue'
                            ? 'rgba(220, 38, 38, 0.05)'
                            : row.status === 'due_soon'
                              ? 'rgba(245, 158, 11, 0.05)'
                              : undefined,
                      }}
                    >
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {row.displayName}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: 'monospace',
                              color: 'text.secondary',
                            }}
                          >
                            {row.keyName}
                          </Typography>
                          {row.notes ? (
                            <Tooltip title={row.notes}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  maxWidth: 240,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {row.notes}
                              </Typography>
                            </Tooltip>
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip label={row.category} size="small" />
                      </TableCell>
                      <TableCell>{statusChip(row.status, row.daysUntilDue)}</TableCell>
                      <TableCell>
                        {row.rotatedAt ? (
                          <Stack spacing={0.25}>
                            <Typography variant="caption">
                              {new Date(row.rotatedAt).toLocaleDateString('nb-NO')}
                            </Typography>
                            {row.rotatedBy ? (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  fontFamily: 'monospace',
                                  fontSize: '0.65rem',
                                }}
                              >
                                av {row.rotatedBy}
                              </Typography>
                            ) : null}
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.nextRotationDue ? (
                          <Typography variant="caption">
                            {new Date(row.nextRotationDue).toLocaleDateString('nb-NO')}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {row.rotationIntervalDays} dager
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {row.envVarPresent ? (
                          <Chip
                            label="✓"
                            size="small"
                            sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#86efac' }}
                          />
                        ) : (
                          <Tooltip title="Env-vars mangler i Render — sjekk at navnet stemmer">
                            <Chip
                              label="✗"
                              size="small"
                              sx={{ bgcolor: 'rgba(239,68,68,0.18)', color: '#fca5a5' }}
                            />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setMarkingDialog(row);
                            setMarkingNotes('');
                          }}
                        >
                          Markér som rotert
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!(Array.isArray(data?.rows) ? data.rows : []).length && !loading ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          Ingen nøkler registrert ennå. Kjør migrasjon 220 for å seede.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        </CardContent>
      </Card>

      {/* Mark-as-rotated dialog */}
      <Dialog
        open={!!markingDialog}
        onClose={() => setMarkingDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Markér som rotert</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Sjekkliste FØR du markerer som rotert:</strong>
            <Box component="ol" sx={{ pl: 2, mt: 1, mb: 0 }}>
              <li>Opprettet ny nøkkel i Stripe/Cloudflare/Render-dashboardet</li>
              <li>Limt inn ny nøkkel i Render env-vars</li>
              <li>Trigget redeploy så ny nøkkel er i bruk</li>
              <li>Slettet/deaktivert gammel nøkkel</li>
              <li>Verifisert at backend fortsatt fungerer</li>
            </Box>
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Markerer <strong>{markingDialog?.displayName}</strong> som rotert nå. Neste
            forventede rotering blir om <strong>{markingDialog?.rotationIntervalDays} dager</strong>.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notater (valgfritt)"
            placeholder="F.eks. 'Roterte sammen med R2 access_key_id'"
            value={markingNotes}
            onChange={(e) => setMarkingNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarkingDialog(null)} disabled={marking}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => void markAsRotated()}
            disabled={marking}
          >
            {marking ? 'Lagrer…' : 'Bekreft rotering'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
    </ThemeProvider>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: string;
  color: string;
  icon: React.ReactNode;
}> = ({ label, value, color, icon }) => (
  <Card sx={{ borderRadius: 2, borderLeft: `4px solid ${color}` }}>
    <CardContent sx={{ py: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color }}>
            {value}
          </Typography>
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

export default SecretsRotationPanel;
