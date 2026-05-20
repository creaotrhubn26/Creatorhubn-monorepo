// @ts-nocheck
/**
 * WorkflowTriggerDialog — Slice 9X.79
 *
 * Lar Stine velge hvilke events som skal trigge en workflow automatisk.
 * F.eks. "kjør 'Klient-onboarding' når ny submission mottatt fra
 * project_type=wedding". Conditions er valgfri JSON key/value-mapping.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogActions, Box, Stack, Typography, Button,
  IconButton, Avatar, Switch, FormControlLabel, Alert, Chip, Tooltip,
  TextField, Divider,
} from '@mui/material';
import {
  Close as CloseIcon, Bolt as BoltIcon, Delete as DeleteIcon,
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

const WorkflowTriggerDialog: React.FC<Props> = ({
  open, onClose, userId, workflowId, workflowName, profession,
}) => {
  const queryClient = useQueryClient();

  const { data: triggersData } = useQuery({
    queryKey: ['workflow-triggers', userId],
    queryFn: async () => apiRequest(`/api/orchestration/workflows/${userId}/triggers`),
    enabled: open && !!userId,
  });

  const supportedEvents = triggersData?.supportedEvents || [];
  const existingForWorkflow = (triggersData?.data || []).filter((t: any) => t.workflow_id === workflowId);

  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [conditionsText, setConditionsText] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setError(null); }, [editingEvent]);

  const startEdit = (eventType: string) => {
    const found = existingForWorkflow.find((t: any) => t.event_type === eventType);
    setEditingEvent(eventType);
    setConditionsText(found ? JSON.stringify(found.conditions || {}, null, 2) : '{}');
    setEnabled(found ? found.enabled : true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsedConditions = {};
      try {
        parsedConditions = JSON.parse(conditionsText || '{}');
      } catch {
        throw new Error('Conditions må være gyldig JSON');
      }
      return apiRequest(`/api/orchestration/workflows/${userId}/${workflowId}/triggers/${editingEvent}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profession, conditions: parsedConditions, enabled }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-triggers', userId] });
      setEditingEvent(null);
    },
    onError: (e: any) => setError(e?.message || 'Kunne ikke lagre'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventType: string) =>
      apiRequest(`/api/orchestration/workflows/${userId}/${workflowId}/triggers/${eventType}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-triggers', userId] });
      setEditingEvent(null);
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          background: 'radial-gradient(circle at top, rgba(245,158,11,0.10) 0%, rgba(15,10,7,0.98) 36%, #0a0807 100%)',
          color: '#fff5e8',
          border: '1px solid rgba(245,158,11,0.18)',
        },
      }}
    >
      <Box sx={{
        px: 3, pt: 3, pb: 2,
        background: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.02))',
        borderBottom: '1px solid rgba(245,158,11,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: 'rgba(245,158,11,0.18)', color: '#f59e0b' }}>
            <BoltIcon />
          </Avatar>
          <Box>
            <Typography variant="overline" sx={{ color: '#f59e0b', letterSpacing: '0.18em' }}>
              SmartFlyt
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
              Auto-trigge "{workflowName}"
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: 'rgba(246,242,234,0.72)' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ color: 'rgba(246,242,234,0.72)', mb: 2 }}>
          Workflow starter automatisk når et av disse eventene skjer.
          Klikk på et event for å aktivere eller redigere conditions.
        </Typography>

        <Stack spacing={1.5}>
          {supportedEvents.map((ev: any) => {
            const active = existingForWorkflow.find((t: any) => t.event_type === ev.value);
            const isEditing = editingEvent === ev.value;
            return (
              <Box
                key={ev.value}
                sx={{
                  border: `1px solid ${active ? 'rgba(245,158,11,0.40)' : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: 2,
                  bgcolor: active ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                  overflow: 'hidden',
                }}
              >
                <Box
                  onClick={() => startEdit(ev.value)}
                  sx={{
                    p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff5e8' }}>
                        {ev.label}
                      </Typography>
                      {active && (
                        <Chip
                          size="small"
                          label={active.enabled ? `✓ Aktiv · ${active.trigger_count}×` : 'Pauset'}
                          sx={{
                            height: 18,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            bgcolor: active.enabled ? 'rgba(16,185,129,0.18)' : 'rgba(107,114,128,0.18)',
                            color: active.enabled ? '#10b981' : '#9ca3af',
                          }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.6)', display: 'block', mt: 0.25 }}>
                      {ev.description}
                    </Typography>
                  </Box>
                </Box>

                {isEditing && (
                  <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', p: 2, bgcolor: 'rgba(0,0,0,0.20)' }}>
                    <FormControlLabel
                      control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
                      label="Trigger er aktiv"
                      sx={{ color: '#fff5e8', mb: 1 }}
                    />
                    <Tooltip
                      title="Workflow starter bare når alle key/value-par i payloadet matcher. Tom = trigge alltid."
                      placement="top"
                    >
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        size="small"
                        label='Conditions (JSON, valgfritt — f.eks. {"project_type":"wedding"})'
                        value={conditionsText}
                        onChange={(e) => setConditionsText(e.target.value)}
                        sx={{
                          mt: 1,
                          '& .MuiOutlinedInput-root': {
                            color: '#fff5e8',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
                          },
                          '& .MuiInputLabel-root': { color: 'rgba(246,242,234,0.72)', fontSize: '0.78rem' },
                        }}
                      />
                    </Tooltip>
                    {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }} justifyContent="flex-end">
                      {active && (
                        <Button
                          startIcon={<DeleteIcon />}
                          size="small"
                          onClick={() => deleteMutation.mutate(ev.value)}
                          sx={{ color: '#ef4444', textTransform: 'none', mr: 'auto' }}
                        >
                          Fjern
                        </Button>
                      )}
                      <Button
                        size="small"
                        onClick={() => setEditingEvent(null)}
                        sx={{ color: 'rgba(246,242,234,0.72)', textTransform: 'none' }}
                      >
                        Avbryt
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        sx={{
                          bgcolor: '#f59e0b', color: '#150d05',
                          fontWeight: 700, textTransform: 'none', px: 2, borderRadius: '999px',
                          '&:hover': { bgcolor: '#fbbf24' },
                        }}
                      >
                        {active ? 'Oppdater' : 'Aktiver'}
                      </Button>
                    </Stack>
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>

        {existingForWorkflow.length > 0 && (
          <>
            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.5)' }}>
              {existingForWorkflow.length} trigger{existingForWorkflow.length === 1 ? '' : 'e'} aktiv på denne workflowen
            </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: '999px', px: 3, py: 1,
            bgcolor: '#f59e0b', color: '#150d05',
            fontWeight: 700, textTransform: 'none',
            '&:hover': { bgcolor: '#fbbf24' },
          }}
        >
          Lukk
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkflowTriggerDialog;
