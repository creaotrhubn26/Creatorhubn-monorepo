// Wave 2 (#24) — the daily action queue: turns lifecycle data into a concrete
// to-do that drives repeat revenue. Rebook-due, dormant, review-due, overdue.
import React from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  Chip, Button, List, ListItem, ListItemText, CircularProgress, Alert, Divider,
} from '@mui/material';
import {
  Bolt as AutomationIcon, Autorenew as RebookIcon, NightsStay as DormantIcon,
  StarBorder as ReviewIcon, WarningAmber as OverdueIcon,
} from '@mui/icons-material';

const daysSince = (d: string | null) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null;

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenCustomer: (id: string, name?: string) => void;
}

export default function CrmActionQueue({ open, onClose, onOpenCustomer }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['crm-action-queue'],
    enabled: open,
    queryFn: () => apiRequest('/api/universal-crm/action-queue'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['crm-action-queue'] });
    queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
    queryClient.invalidateQueries({ queryKey: ['crm-task-inbox'] });
  };

  const runSweep = useMutation({
    mutationFn: async () => apiRequest('/api/universal-crm/automation/run', { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: (r: any) => { invalidate(); toast({ title: `Automatikk kjørt — ${r?.rebookTasks ?? 0} rebook-oppgave(r) opprettet`, variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Kunne ikke kjøre automatikk', description: e?.message, variant: 'destructive' }),
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/universal-crm/tasks/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }) }),
    onSuccess: () => { invalidate(); toast({ title: 'Oppgave fullført', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Kunne ikke fullføre', description: e?.message, variant: 'destructive' }),
  });

  const open2 = (id: string, name?: string) => { onClose(); onOpenCustomer(id, name); };

  const q = data || {};
  const total = (q.overdueTasks?.length || 0) + (q.rebookDue?.length || 0) + (q.dormant?.length || 0) + (q.reviewDue?.length || 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <AutomationIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Handlingskø</Typography>
            {total > 0 && <Chip size="small" label={total} />}
          </Stack>
          <Button size="small" variant="outlined" startIcon={<AutomationIcon />} disabled={runSweep.isPending} onClick={() => runSweep.mutate()}>
            Kjør automatikk
          </Button>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress /></Stack>
        ) : error ? (
          <Alert severity="error">Kunne ikke laste handlingskø.</Alert>
        ) : total === 0 ? (
          <Alert severity="success">Ingenting krever handling akkurat nå. 🎯</Alert>
        ) : (
          <Stack spacing={2}>
            {q.overdueTasks?.length > 0 && (
              <Section icon={<OverdueIcon sx={{ color: '#d32f2f' }} />} title="Forfalte oppgaver" count={q.overdueTasks.length} color="error">
                {q.overdueTasks.map((t: any) => (
                  <ListItem key={t.id} sx={{ px: 0 }} secondaryAction={<Button size="small" onClick={() => completeTask.mutate(t.id)}>Fullfør</Button>}>
                    <ListItemText
                      primary={t.title}
                      secondary={`${t.customer_name || ''} · forfalt ${new Date(t.due_date).toLocaleDateString('nb-NO')}`}
                      onClick={() => t.customer_id && open2(t.customer_id, t.customer_name)}
                      sx={{ cursor: t.customer_id ? 'pointer' : 'default' }}
                    />
                  </ListItem>
                ))}
              </Section>
            )}
            {q.rebookDue?.length > 0 && (
              <Section icon={<RebookIcon sx={{ color: '#16a34a' }} />} title="Klare for gjenbestilling" count={q.rebookDue.length} color="success">
                {q.rebookDue.map((c: any) => (
                  <ListItem key={c.id} sx={{ px: 0 }} secondaryAction={<Button size="small" onClick={() => open2(c.id, c.name)}>Åpne</Button>}>
                    <ListItemText primary={c.name} secondary={c.last_delivered_at ? `Levert ${new Date(c.last_delivered_at).toLocaleDateString('nb-NO')}` : 'Klar for ny kontakt'} />
                  </ListItem>
                ))}
              </Section>
            )}
            {q.dormant?.length > 0 && (
              <Section icon={<DormantIcon sx={{ color: '#f59e0b' }} />} title="Dvalende (>45 dager)" count={q.dormant.length} color="warning">
                {q.dormant.map((c: any) => (
                  <ListItem key={c.id} sx={{ px: 0 }} secondaryAction={<Button size="small" onClick={() => open2(c.id, c.name)}>Åpne</Button>}>
                    <ListItemText primary={c.name} secondary={c.last_contact ? `Sist kontaktet for ${daysSince(c.last_contact)} dager siden` : 'Aldri kontaktet'} />
                  </ListItem>
                ))}
              </Section>
            )}
            {q.reviewDue?.length > 0 && (
              <Section icon={<ReviewIcon sx={{ color: '#e91e63' }} />} title="Be om anmeldelse" count={q.reviewDue.length} color="default">
                {q.reviewDue.map((c: any) => (
                  <ListItem key={c.id} sx={{ px: 0 }} secondaryAction={<Button size="small" onClick={() => open2(c.id, c.name)}>Åpne</Button>}>
                    <ListItemText primary={c.name} secondary={`Levert ${c.last_delivered_at ? new Date(c.last_delivered_at).toLocaleDateString('nb-NO') : ''}`} />
                  </ListItem>
                ))}
              </Section>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
}

function Section({ icon, title, count, color, children }: { icon: React.ReactNode; title: string; count: number; color: any; children: React.ReactNode }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        {icon}
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Chip size="small" color={color} label={count} />
      </Stack>
      <List dense disablePadding>{children}</List>
      <Divider sx={{ mt: 1 }} />
    </Box>
  );
}
