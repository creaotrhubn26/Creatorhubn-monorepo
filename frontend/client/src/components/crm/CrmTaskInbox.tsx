// Wave 1 (#5/#37) — the "what needs doing" inbox. Without it, SLA tasks
// (e.g. the 24h follow-up created on every new lead) rot in silence.
import React from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  Chip, Button, Checkbox, List, ListItem, ListItemText, CircularProgress, Alert,
} from '@mui/material';
import { Task as TaskIcon } from '@mui/icons-material';
import { BrandScope } from './crm-brand';

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const endOfWeek = () => { const d = startOfToday(); d.setDate(d.getDate() + 7); return d; };

function bucketOf(due: string | null): 'overdue' | 'today' | 'week' | 'none' {
  if (!due) return 'none';
  const d = new Date(due);
  const today = startOfToday();
  if (d < today) return 'overdue';
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  if (d < tomorrow) return 'today';
  if (d < endOfWeek()) return 'week';
  return 'none';
}

const BUCKETS: { key: 'overdue' | 'today' | 'week' | 'none'; label: string; color: any }[] = [
  { key: 'overdue', label: 'Forfalt', color: 'error' },
  { key: 'today', label: 'I dag', color: 'warning' },
  { key: 'week', label: 'Denne uka', color: 'info' },
  { key: 'none', label: 'Senere / uten dato', color: 'default' },
];

interface Props { open: boolean; onClose: () => void; brandColor?: string; }

export default function CrmTaskInbox({ open, onClose, brandColor }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ tasks: any[] }>({
    queryKey: ['crm-task-inbox'],
    enabled: open,
    queryFn: () => apiRequest('/api/universal-crm/tasks?status=pending'),
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/universal-crm/tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-task-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
      toast({ title: 'Oppgave fullført', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Kunne ikke fullføre', description: e?.message, variant: 'destructive' }),
  });

  const tasks = data?.tasks || [];
  const grouped: Record<string, any[]> = { overdue: [], today: [], week: [], none: [] };
  for (const t of tasks) grouped[bucketOf(t.due_date)].push(t);

  return (
    <BrandScope brandColor={brandColor}>
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <TaskIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Oppgaver</Typography>
          {tasks.length > 0 && <Chip size="small" label={tasks.length} />}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress /></Stack>
        ) : error ? (
          <Alert severity="error">Kunne ikke laste oppgaver.</Alert>
        ) : tasks.length === 0 ? (
          <Alert severity="success">Ingenting forfaller — du er à jour. 🎯</Alert>
        ) : (
          <Stack spacing={2}>
            {BUCKETS.map(({ key, label, color }) => grouped[key].length > 0 && (
              <Box key={key}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{label}</Typography>
                  <Chip size="small" color={color} label={grouped[key].length} />
                </Stack>
                <List dense disablePadding>
                  {grouped[key].map((t) => (
                    <ListItem key={t.id} sx={{ px: 0 }}
                      secondaryAction={
                        <Button size="small" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate(t.id)}>Fullfør</Button>
                      }>
                      <Checkbox edge="start" checked={false} disabled={completeMutation.isPending} onChange={() => completeMutation.mutate(t.id)} />
                      <ListItemText
                        primary={t.title}
                        secondary={t.due_date ? `Forfall ${new Date(t.due_date).toLocaleDateString('nb-NO')}` : 'Uten frist'}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
    </BrandScope>
  );
}
