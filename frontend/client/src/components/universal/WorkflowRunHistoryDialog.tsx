// @ts-nocheck
/**
 * WorkflowRunHistoryDialog — Slice 9X.79
 *
 * Viser tidligere SmartFlyt-kjøringer for brukeren. Stine ser:
 *   - Hvilken workflow ble kjørt
 *   - Når + varighet
 *   - Status: completed / partial / failed
 *   - Hvor mange steg ble fullført vs feilet vs venter manuell
 *   - Klikk for å se detaljerte step-statuser
 */

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogActions, Box, Stack, Typography, Button,
  IconButton, Chip, CircularProgress, Alert, Table, TableHead, TableRow,
  TableCell, TableBody, Avatar, alpha,
} from '@mui/material';
import {
  Close as CloseIcon, History as HistoryIcon, CheckCircle as DoneIcon,
  Cancel as FailIcon, Schedule as PendingIcon, PlayCircle as RunningIcon,
  ChevronRight as ExpandIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

const fmtTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return 'akkurat nå';
  if (diffMin < 60) return `${diffMin} min siden`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)} t siden`;
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDuration = (sec?: number) => {
  if (!sec || sec < 0) return '—';
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}t`;
};

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: '✓ Fullført', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  partial: { label: '⏳ Delvis', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  failed: { label: '✗ Feilet', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  running: { label: '⏳ Kjører', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  queued: { label: '⏸ I kø', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  cancelled: { label: '⊘ Avbrutt', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  skipped: { label: '⊘ Hoppet over', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const WorkflowRunHistoryDialog: React.FC<Props> = ({ open, onClose, userId }) => {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workflow-runs', userId],
    queryFn: async () => apiRequest(`/api/orchestration/workflows/${userId}/runs?limit=20`),
    enabled: open && !!userId,
  });

  const { data: stepDetails } = useQuery({
    queryKey: ['workflow-run-steps', expandedRunId],
    queryFn: async () => apiRequest(`/api/orchestration/workflows/runs/${expandedRunId}`),
    enabled: !!expandedRunId,
  });

  const runs = data?.data || [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          background: 'radial-gradient(circle at top, rgba(255,186,108,0.10) 0%, rgba(15,10,7,0.98) 36%, #0a0807 100%)',
          color: '#fff5e8',
          border: '1px solid rgba(255,186,108,0.18)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          minHeight: '60vh',
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3, pt: 3, pb: 2,
        background: 'linear-gradient(135deg, rgba(255,186,108,0.16), rgba(255,186,108,0.02))',
        borderBottom: '1px solid rgba(255,186,108,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: 'rgba(255,186,108,0.18)', color: '#ffba6c' }}>
            <HistoryIcon />
          </Avatar>
          <Box>
            <Typography variant="overline" sx={{ color: '#ffba6c', letterSpacing: '0.18em' }}>
              SmartFlyt
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif' }}>
              Run-historikk
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: 'rgba(246,242,234,0.72)' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {!isLoading && runs.length === 0 && (
          <Alert
            severity="info"
            sx={{
              bgcolor: 'rgba(76,201,240,0.10)',
              color: '#fff5e8',
              border: '1px solid rgba(76,201,240,0.32)',
              '& .MuiAlert-icon': { color: '#4cc9f0' },
            }}
          >
            Ingen workflows har blitt kjørt enda. Trykk "Kjør" på en workflow for å starte.
          </Alert>
        )}

        {runs.length > 0 && (
          <Stack spacing={1.5}>
            {runs.map((run: any) => {
              const status = STATUS_BADGE[run.status] || { label: run.status, color: '#6b7280', bg: 'rgba(107,114,128,0.15)' };
              const isExpanded = expandedRunId === run.id;
              const steps = isExpanded ? (stepDetails?.steps || []) : [];

              return (
                <Box
                  key={run.id}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isExpanded ? 'rgba(255,186,108,0.32)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 2,
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Sammendrag-rad */}
                  <Box
                    onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                    sx={{
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(255,186,108,0.06)' },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#fff5e8' }} noWrap>
                        {run.workflow_name}
                      </Typography>
                      <Stack direction="row" spacing={1.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                          {fmtTime(run.created_at)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.5)' }}>
                          · {fmtDuration(Number(run.duration_sec))}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.5)' }}>
                          · {run.steps_completed}/{run.steps_total} steg
                        </Typography>
                        {run.awaiting_count > 0 && (
                          <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600 }}>
                            · {run.awaiting_count} venter
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                    <Chip
                      label={status.label}
                      size="small"
                      sx={{
                        bgcolor: status.bg,
                        color: status.color,
                        border: `1px solid ${alpha(status.color, 0.32)}`,
                        fontWeight: 700,
                        fontSize: '0.66rem',
                      }}
                    />
                    <ExpandIcon
                      sx={{
                        color: 'rgba(246,242,234,0.5)',
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </Box>

                  {/* Detalj-utvidelse */}
                  {isExpanded && steps.length > 0 && (
                    <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', p: 1.5 }}>
                      <Table size="small">
                        <TableBody>
                          {steps.map((s: any) => {
                            const stepStatus = STATUS_BADGE[s.status] || { label: s.status, color: '#6b7280', bg: 'rgba(107,114,128,0.15)' };
                            return (
                              <TableRow key={s.id} sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.05)' } }}>
                                <TableCell sx={{ width: 40, py: 0.5 }}>
                                  <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.5)', fontWeight: 700 }}>
                                    {s.step_index + 1}.
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ py: 0.5 }}>
                                  <Typography variant="body2" sx={{ color: '#fff5e8' }}>
                                    {s.action_name}
                                  </Typography>
                                  {s.error_message && (
                                    <Typography variant="caption" sx={{ color: '#ef4444', display: 'block' }}>
                                      {s.error_message}
                                    </Typography>
                                  )}
                                  {/* Slice 9X.79 — AI-generert kontrakt-utkast inline */}
                                  {s.result_data?.draftMarkdown && (
                                    <Box sx={{
                                      mt: 0.5, p: 1, borderRadius: 1,
                                      bgcolor: 'rgba(155,135,245,0.06)',
                                      border: '1px solid rgba(155,135,245,0.20)',
                                    }}>
                                      <Typography variant="caption" sx={{ color: '#9b87f5', fontWeight: 700, display: 'block', mb: 0.5 }}>
                                        ✨ AI-generert utkast ({s.result_data.model || 'claude'})
                                      </Typography>
                                      <Box
                                        component="pre"
                                        sx={{
                                          fontFamily: '"SF Mono", Menlo, monospace',
                                          fontSize: '0.7rem',
                                          color: 'rgba(246,242,234,0.85)',
                                          whiteSpace: 'pre-wrap',
                                          margin: 0,
                                          maxHeight: 240,
                                          overflowY: 'auto',
                                        }}
                                      >
                                        {s.result_data.draftMarkdown}
                                      </Box>
                                      <Button
                                        size="small"
                                        onClick={() => navigator.clipboard.writeText(s.result_data.draftMarkdown)}
                                        sx={{ mt: 0.5, fontSize: '0.65rem', textTransform: 'none', color: '#9b87f5' }}
                                      >
                                        Kopier til utklippstavle
                                      </Button>
                                    </Box>
                                  )}
                                </TableCell>
                                <TableCell sx={{ width: 80, py: 0.5 }}>
                                  {s.execution_mode && (
                                    <Chip
                                      label={s.execution_mode === 'auto' ? '🤖' : s.execution_mode === 'ai' ? '✨' : '👆'}
                                      size="small"
                                      sx={{
                                        height: 18,
                                        fontSize: '0.66rem',
                                        bgcolor: 'rgba(255,255,255,0.06)',
                                        color: '#fff5e8',
                                      }}
                                    />
                                  )}
                                </TableCell>
                                <TableCell sx={{ width: 90, py: 0.5 }}>
                                  <Chip
                                    label={stepStatus.label}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.6rem',
                                      bgcolor: stepStatus.bg,
                                      color: stepStatus.color,
                                      fontWeight: 700,
                                    }}
                                  />
                                </TableCell>
                                <TableCell sx={{ width: 60, py: 0.5 }}>
                                  <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.5)' }}>
                                    {s.duration_ms ? `${Math.round(s.duration_ms / 100) / 10}s` : '—'}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Button onClick={() => refetch()} sx={{ color: 'rgba(246,242,234,0.72)', textTransform: 'none' }}>
          Oppdater
        </Button>
        <Button
          variant="contained"
          onClick={onClose}
          sx={{
            borderRadius: '999px', px: 3, py: 1,
            bgcolor: '#ffba6c', color: '#150d05',
            fontWeight: 700, textTransform: 'none',
            '&:hover': { bgcolor: '#ffc788' },
          }}
        >
          Lukk
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkflowRunHistoryDialog;
