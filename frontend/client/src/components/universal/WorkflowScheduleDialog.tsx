// @ts-nocheck
/**
 * WorkflowScheduleDialog — Slice 9X.79
 *
 * Planlegg en SmartFlyt-workflow til å kjøres automatisk på fast tid.
 * Stine kan velge daglig/ukentlig/månedlig + time + dag.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogActions, Box, Stack, Typography, Button,
  IconButton, ToggleButtonGroup, ToggleButton, MenuItem, Select, FormControl,
  InputLabel, Alert, Avatar, Switch, FormControlLabel,
} from '@mui/material';
import {
  Close as CloseIcon, Schedule as ScheduleIcon, Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  workflowId: string;
  workflowName: string;
  profession?: string;
}

const DOW_LABELS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const WorkflowScheduleDialog: React.FC<Props> = ({
  open, onClose, userId, workflowId, workflowName, profession,
}) => {
  const queryClient = useQueryClient();

  const { data: schedulesData } = useQuery({
    queryKey: ['workflow-schedules', userId],
    queryFn: async () => apiRequest(`/api/orchestration/workflows/${userId}/schedules`),
    enabled: open && !!userId,
  });

  const existing = (schedulesData?.data || []).find((s: any) => s.workflow_id === workflowId);

  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [hour, setHour] = useState<number>(9);
  const [dow, setDow] = useState<number>(1);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setScheduleType(existing.schedule_type);
      setHour(existing.schedule_hour);
      setDow(existing.schedule_dow ?? 1);
      setEnabled(existing.enabled);
    } else {
      setScheduleType('weekly');
      setHour(9);
      setDow(1);
      setEnabled(true);
    }
    setError(null);
  }, [existing, open]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/orchestration/workflows/${userId}/${workflowId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profession,
          scheduleType,
          scheduleHour: hour,
          scheduleDow: scheduleType === 'daily' ? null : dow,
          enabled,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-schedules', userId] });
      onClose();
    },
    onError: (e: any) => setError(e?.message || 'Kunne ikke lagre'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/orchestration/workflows/${userId}/${workflowId}/schedule`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-schedules', userId] });
      onClose();
    },
  });

  const fmtNextRun = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('nb-NO', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          background: 'radial-gradient(circle at top, rgba(155,135,245,0.10) 0%, rgba(15,10,7,0.98) 36%, #0a0807 100%)',
          color: '#fff5e8',
          border: '1px solid rgba(155,135,245,0.18)',
        },
      }}
    >
      <Box sx={{
        px: 3, pt: 3, pb: 2,
        background: 'linear-gradient(135deg, rgba(155,135,245,0.16), rgba(155,135,245,0.02))',
        borderBottom: '1px solid rgba(155,135,245,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: 'rgba(155,135,245,0.18)', color: '#9b87f5' }}>
            <ScheduleIcon />
          </Avatar>
          <Box>
            <Typography variant="overline" sx={{ color: '#9b87f5', letterSpacing: '0.18em' }}>
              SmartFlyt
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
              Planlegg "{workflowName}"
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: 'rgba(246,242,234,0.72)' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {existing && (
          <Alert
            severity="info"
            sx={{
              mb: 2,
              bgcolor: 'rgba(155,135,245,0.10)',
              color: '#fff5e8',
              border: '1px solid rgba(155,135,245,0.32)',
              '& .MuiAlert-icon': { color: '#9b87f5' },
            }}
          >
            Neste planlagte kjøring: <strong>{fmtNextRun(existing.next_run_at)}</strong>
            {existing.last_run_at && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'rgba(246,242,234,0.72)' }}>
                Sist kjørt: {fmtNextRun(existing.last_run_at)}
              </Typography>
            )}
          </Alert>
        )}

        <Stack spacing={2.5}>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)', mb: 1, display: 'block' }}>
              Hvor ofte?
            </Typography>
            <ToggleButtonGroup
              value={scheduleType}
              exclusive
              onChange={(_, v) => v && setScheduleType(v)}
              fullWidth
              sx={{
                '& .MuiToggleButton-root': {
                  color: 'rgba(246,242,234,0.72)',
                  borderColor: 'rgba(255,255,255,0.12)',
                  '&.Mui-selected': {
                    bgcolor: 'rgba(155,135,245,0.22)',
                    color: '#fff5e8',
                    borderColor: 'rgba(155,135,245,0.48)',
                  },
                },
              }}
            >
              <ToggleButton value="daily">Daglig</ToggleButton>
              <ToggleButton value="weekly">Ukentlig</ToggleButton>
              <ToggleButton value="monthly">Månedlig</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {scheduleType === 'weekly' && (
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(246,242,234,0.72)' }}>Dag i uken</InputLabel>
              <Select
                value={dow}
                label="Dag i uken"
                onChange={(e) => setDow(Number(e.target.value))}
                sx={{ color: '#fff5e8', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.18)' } }}
              >
                {DOW_LABELS.map((label, i) => (
                  <MenuItem key={i} value={i}>{label}dag</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {scheduleType === 'monthly' && (
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(246,242,234,0.72)' }}>Dag i måneden (1-28)</InputLabel>
              <Select
                value={dow}
                label="Dag i måneden (1-28)"
                onChange={(e) => setDow(Number(e.target.value))}
                sx={{ color: '#fff5e8', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.18)' } }}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <MenuItem key={d} value={d}>Dag {d}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FormControl fullWidth>
            <InputLabel sx={{ color: 'rgba(246,242,234,0.72)' }}>Tidspunkt (Oslo-tid)</InputLabel>
            <Select
              value={hour}
              label="Tidspunkt (Oslo-tid)"
              onChange={(e) => setHour(Number(e.target.value))}
              sx={{ color: '#fff5e8', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.18)' } }}
            >
              {HOURS.map((h) => (
                <MenuItem key={h} value={h}>
                  {h.toString().padStart(2, '0')}:00
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label="Planleggingen er aktiv"
            sx={{ color: '#fff5e8' }}
          />

          {error && (
            <Alert severity="error">{error}</Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)', gap: 1 }}>
        {existing && (
          <Button
            startIcon={<DeleteIcon />}
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            sx={{ color: '#ef4444', textTransform: 'none', mr: 'auto' }}
          >
            Fjern planlegging
          </Button>
        )}
        <Button onClick={onClose} sx={{ color: 'rgba(246,242,234,0.72)', textTransform: 'none' }}>
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          sx={{
            bgcolor: '#9b87f5', color: '#150d05',
            fontWeight: 700, textTransform: 'none', px: 3, borderRadius: '999px',
            '&:hover': { bgcolor: '#b3a4f8' },
          }}
        >
          {existing ? 'Oppdater' : 'Aktiver'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkflowScheduleDialog;
