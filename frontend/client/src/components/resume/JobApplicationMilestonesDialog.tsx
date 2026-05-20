/**
 * JobApplicationMilestonesDialog
 *
 * Lar bruker se og redigere alle milepæler for én jobbsøknad.
 * Brukes både fra Kanban-kort (klikk → åpner) og fra Job-Tracker.
 *
 * Brukerflyt:
 *   1. Liste over eksisterende milepæler (chronological)
 *   2. + Legg til ny — kompakt skjema (kind, title, due date/time, notes)
 *   3. Klikk på rad → marker som fullført / slett
 *
 * Default-påminnelser (48t/24t/2t før) håndteres server-side hvis
 * `reminderAt` ikke spesifiseres i POST.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, Stack, Paper,
  IconButton, Chip, MenuItem, Alert, CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

function trackGA4(eventName: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') w.gtag('event', eventName, params);
  } catch {
    /* noop */
  }
}

type MilestoneKind =
  | 'application_deadline'
  | 'case_deadline'
  | 'interview'
  | 'expected_response'
  | 'custom';

interface Milestone {
  id: string;
  applicationId: string;
  kind: MilestoneKind;
  title: string;
  dueAt: string;
  reminderAt: string[];
  remindersSent: string[];
  completedAt: string | null;
  notes: string | null;
  artifactUrl: string | null;
}

interface Props {
  applicationId: string | null;
  open: boolean;
  onClose: () => void;
  jobTitle?: string;
  company?: string;
}

const KIND_LABEL: Record<MilestoneKind, string> = {
  application_deadline: 'Søknadsfrist',
  case_deadline: 'Case-frist',
  interview: 'Intervju',
  expected_response: 'Forventet svar',
  custom: 'Egen frist',
};

const KIND_COLOR: Record<MilestoneKind, string> = {
  application_deadline: '#3B82F6',
  case_deadline: '#DC2626',
  interview: '#F5B82E',
  expected_response: '#9CA3AF',
  custom: '#6B7280',
};

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('no-NO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export const JobApplicationMilestonesDialog: React.FC<Props> = ({
  applicationId,
  open,
  onClose,
  jobTitle,
  company,
}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [formKind, setFormKind] = useState<MilestoneKind>('case_deadline');
  const [formTitle, setFormTitle] = useState('');
  const [formDueAt, setFormDueAt] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: milestones = [], isLoading } = useQuery<Milestone[]>({
    queryKey: ['milestones', applicationId],
    queryFn: async () => {
      if (!applicationId) return [];
      const data = (await apiRequest(
        `/api/job-applications/${applicationId}/milestones`,
        { headers: { 'x-user-id': user?.id || '' } },
      )) as { milestones: Milestone[] };
      return data.milestones ?? [];
    },
    enabled: open && !!applicationId && !!user?.id,
  });

  const resetForm = () => {
    setFormKind('case_deadline');
    setFormTitle('');
    setFormDueAt('');
    setFormNotes('');
    setError(null);
    setShowAddForm(false);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!applicationId) throw new Error('no_application');
      if (!formTitle.trim() || !formDueAt) {
        throw new Error('missing_fields');
      }
      // datetime-local-input gir "YYYY-MM-DDTHH:MM" uten timezone.
      // Vi tolker den som Europe/Oslo og konverterer til ISO.
      const localIso = new Date(formDueAt).toISOString();
      return await apiRequest(
        `/api/job-applications/${applicationId}/milestones`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user?.id || '',
          },
          body: JSON.stringify({
            kind: formKind,
            title: formTitle.trim(),
            dueAt: localIso,
            notes: formNotes.trim() || undefined,
          }),
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', applicationId] });
      qc.invalidateQueries({ queryKey: ['job-milestones-upcoming'] });
      trackGA4('nextrole_milestone_created', { kind: formKind });
      resetForm();
    },
    onError: (err) => {
      setError(
        err instanceof Error && err.message === 'missing_fields'
          ? 'Tittel og forfallsdato er påkrevd'
          : 'Kunne ikke lagre. Prøv igjen.',
      );
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      return await apiRequest(`/api/job-application-milestones/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({ completed }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', applicationId] });
      qc.invalidateQueries({ queryKey: ['job-milestones-upcoming'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/job-application-milestones/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', applicationId] });
      qc.invalidateQueries({ queryKey: ['job-milestones-upcoming'] });
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" component="span" sx={{ fontWeight: 800 }}>
            Milepæler
          </Typography>
          {(jobTitle || company) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
              {jobTitle}{company && jobTitle ? ' · ' : ''}{company}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {!isLoading && milestones.length === 0 && !showAddForm && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Ingen deadlines satt for denne søknaden ennå. Legg til søknadsfrist,
            case-frist, intervju eller forventet svar — du får påminnelser 48t, 24t og 2t før.
          </Alert>
        )}

        <Stack spacing={1.2}>
          {milestones.map((m) => {
            const isCompleted = !!m.completedAt;
            const days = daysUntil(m.dueAt);
            return (
              <Paper
                key={m.id}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderLeft: `4px solid ${KIND_COLOR[m.kind]}`,
                  opacity: isCompleted ? 0.6 : 1,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <IconButton
                    size="small"
                    onClick={() => toggleCompleteMutation.mutate({ id: m.id, completed: !isCompleted })}
                    sx={{ p: 0.4 }}
                  >
                    {isCompleted ? (
                      <CheckCircleIcon sx={{ color: '#10B981' }} fontSize="small" />
                    ) : (
                      <UncheckIcon fontSize="small" />
                    )}
                  </IconButton>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip
                        label={KIND_LABEL[m.kind]}
                        size="small"
                        sx={{
                          height: 18, fontSize: 10, fontWeight: 700,
                          bgcolor: KIND_COLOR[m.kind] + '22',
                          color: KIND_COLOR[m.kind],
                        }}
                      />
                      {!isCompleted && (
                        <Chip
                          icon={<ScheduleIcon sx={{ fontSize: 12 }} />}
                          label={
                            days < 0 ? `forfalt ${Math.abs(days)} d siden` :
                            days === 0 ? 'i dag' :
                            days === 1 ? 'i morgen' :
                            `${days} dager`
                          }
                          size="small"
                          sx={{
                            height: 18, fontSize: 10,
                            bgcolor: days <= 1 ? '#FEE2E2' : days <= 3 ? '#FEF3C7' : '#F3F4F6',
                            color: days <= 1 ? '#DC2626' : days <= 3 ? '#7A5A0B' : '#6B7280',
                          }}
                        />
                      )}
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        mt: 0.5,
                        textDecoration: isCompleted ? 'line-through' : 'none',
                      }}
                    >
                      {m.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(m.dueAt)}
                    </Typography>
                    {m.notes && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4, fontStyle: 'italic' }}>
                        {m.notes}
                      </Typography>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (window.confirm('Slett denne milepælen?')) {
                        deleteMutation.mutate(m.id);
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" color="error" />
                  </IconButton>
                </Stack>
              </Paper>
            );
          })}
        </Stack>

        {/* Add-form */}
        {showAddForm && (
          <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: '#FAFAFA' }}>
            <Stack spacing={1.5}>
              <TextField
                select
                label="Type"
                size="small"
                value={formKind}
                onChange={(e) => setFormKind(e.target.value as MilestoneKind)}
                fullWidth
              >
                {(Object.entries(KIND_LABEL) as [MilestoneKind, string][]).map(([v, l]) => (
                  <MenuItem key={v} value={v}>{l}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Tittel"
                size="small"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={
                  formKind === 'case_deadline' ? 'F.eks. Lever markedsstørrelse-case' :
                  formKind === 'interview' ? 'F.eks. Intervju med fagsjef' :
                  'F.eks. Søknadsfrist'
                }
                fullWidth
              />
              <TextField
                label="Forfaller"
                size="small"
                type="datetime-local"
                value={formDueAt}
                onChange={(e) => setFormDueAt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Notater (valgfritt)"
                size="small"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                multiline
                rows={2}
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button size="small" onClick={resetForm}>Avbryt</Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !formTitle.trim() || !formDueAt}
                  startIcon={createMutation.isPending ? <CircularProgress size={14} /> : <AddIcon />}
                  sx={{ bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' }, color: '#1F2937' }}
                >
                  Lagre
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        {!showAddForm && (
          <Button startIcon={<AddIcon />} onClick={() => setShowAddForm(true)}>
            Ny milepæl
          </Button>
        )}
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

export default JobApplicationMilestonesDialog;
