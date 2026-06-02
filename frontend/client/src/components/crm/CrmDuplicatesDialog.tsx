// Dedupe / merge UI (#33) — lists customers that share a normalized email and
// lets the photographer merge duplicates into one record (children reparented,
// source soft-deleted).
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Typography, Button,
  Paper, Radio, FormControlLabel, RadioGroup, CircularProgress, Alert, Chip,
} from '@mui/material';
import { MergeType as MergeIcon } from '@mui/icons-material';
import { BrandScope } from './crm-brand';

interface Props { open: boolean; onClose: () => void; brandColor?: string; }

export default function CrmDuplicatesDialog({ open, onClose, brandColor }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targets, setTargets] = useState<Record<string, string>>({}); // email_normalized -> keep id

  const { data, isLoading, error } = useQuery<{ duplicates: any[] }>({
    queryKey: ['crm-duplicates'],
    enabled: open,
    queryFn: () => apiRequest('/api/universal-crm/duplicates'),
  });
  const groups = data?.duplicates || [];

  const mergeMutation = useMutation({
    mutationFn: async (group: any) => {
      const keep = targets[group.email_normalized] || group.members[0].id;
      const others = group.members.filter((m: any) => m.id !== keep);
      for (const m of others) {
        await apiRequest(`/api/universal-crm/customers/${encodeURIComponent(m.id)}/merge`, { method: 'POST', body: JSON.stringify({ into: keep }) });
      }
      return others.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ['crm-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-customers'] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
      toast({ title: `Slått sammen ${n} duplikat`, variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Sammenslåing feilet', description: e?.message, variant: 'destructive' }),
  });

  return (
    <BrandScope brandColor={brandColor}>
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <MergeIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Duplikater</Typography>
          {groups.length > 0 && <Chip size="small" label={groups.length} />}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress /></Stack>
        ) : error ? (
          <Alert severity="error">Kunne ikke laste duplikater.</Alert>
        ) : groups.length === 0 ? (
          <Alert severity="success">Ingen duplikater funnet (basert på e-post). 🎯</Alert>
        ) : (
          <Stack spacing={2}>
            {groups.map((g) => {
              const keep = targets[g.email_normalized] || g.members[0].id;
              return (
                <Paper key={g.email_normalized} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">{g.email_normalized} · {g.n} oppføringer</Typography>
                  <RadioGroup value={keep} onChange={(e) => setTargets((t) => ({ ...t, [g.email_normalized]: e.target.value }))}>
                    {g.members.map((m: any) => (
                      <FormControlLabel key={m.id} value={m.id} control={<Radio size="small" />}
                        label={<Typography variant="body2">{m.name} <Typography component="span" variant="caption" color="text.secondary">· {new Date(m.createdAt).toLocaleDateString('nb-NO')}</Typography></Typography>} />
                    ))}
                  </RadioGroup>
                  <Button size="small" variant="contained" startIcon={<MergeIcon />} disabled={mergeMutation.isPending} onClick={() => mergeMutation.mutate(g)}>
                    Behold valgt, slå sammen resten
                  </Button>
                </Paper>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Lukk</Button></DialogActions>
    </Dialog>
    </BrandScope>
  );
}
