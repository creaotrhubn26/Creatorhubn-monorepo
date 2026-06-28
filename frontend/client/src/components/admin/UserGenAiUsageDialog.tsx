// @ts-nocheck
/**
 * UserGenAiUsageDialog — generativ-AI-forbruk + betaling/Stripe-status for ÉN
 * bruker. Åpnes fra brukerprofilen i UserManagementPanel. Viser genereringer,
 * vår kost vs inntekt vs margin, betalt-status (Stripe-tilknytning + abonnement),
 * og siste redigeringer.
 */
import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, Chip, CircularProgress, Divider } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';

const UserGenAiUsageDialog: React.FC<{ userId: string | null; userName?: string; onClose: () => void }> = ({ userId, userName, onClose }) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) { setData(null); return; }
    setLoading(true);
    apiRequest(`/api/admin/users/${encodeURIComponent(userId)}/genai-usage`)
      .then((r: any) => setData(r || null)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [userId]);

  const usd = (n: number) => `$${(n || 0).toFixed(2)}`;
  const u = data?.usage || {}; const b = data?.billing || {}; const all = data?.allAiCosts || {};

  return (
    <Dialog open={!!userId} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>AI-bruk & kostnader — {userName || 'bruker'}</DialogTitle>
      <DialogContent dividers>
        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : !data ? (
          <Typography color="text.secondary">Ingen data.</Typography>
        ) : (
          <Stack spacing={2.5}>
            {/* Alle AI-kostnader (Claude/Anthropic m.m. + generativ) */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Alle AI-kostnader</Typography>
              <Stack direction="row" spacing={2.5} sx={{ flexWrap: 'wrap', gap: 2, mb: 1 }}>
                <Box><Typography variant="caption" color="text.secondary">Totalt (alle AI)</Typography><Typography sx={{ fontWeight: 800, fontSize: 20 }}>{usd(all.totalUsd)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Denne mnd</Typography><Typography sx={{ fontWeight: 800, fontSize: 20 }}>{usd(all.monthUsd)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Generativ (fal)</Typography><Typography sx={{ fontWeight: 800, fontSize: 20 }}>{usd(all.generativeTotalUsd)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Annet (Claude m.m.)</Typography><Typography sx={{ fontWeight: 800, fontSize: 20 }}>{usd(all.otherTotalUsd)}</Typography></Box>
              </Stack>
              {(all.byFeature || []).length > 0 && (
                <Box sx={{ overflowX: 'auto' }}>
                  <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { textAlign: 'left', p: 0.75, borderBottom: '1px solid', borderColor: 'divider', fontSize: 12.5 }, '& th': { color: 'text.secondary', fontWeight: 600 } }}>
                    <thead><tr><th>Funksjon</th><th>Kall</th><th>Kost (totalt)</th><th>Denne mnd</th></tr></thead>
                    <tbody>
                      {all.byFeature.map((f: any, i: number) => (
                        <tr key={i}><td>{f.feature}</td><td>{f.calls}</td><td>{usd(f.costUsd)}</td><td>{usd(f.monthUsd)}</td></tr>
                      ))}
                    </tbody>
                  </Box>
                </Box>
              )}
            </Box>

            <Divider />

            {/* Generativ-forbruk + økonomi */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Generativ AI (bilde/video)</Typography>
              <Stack direction="row" spacing={2.5} sx={{ flexWrap: 'wrap', gap: 2 }}>
                <Box><Typography variant="caption" color="text.secondary">Genereringer (denne mnd / totalt)</Typography><Typography sx={{ fontWeight: 800, fontSize: 20 }}>{u.monthGenerations ?? 0} / {u.totalGenerations ?? 0}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Vår kost (totalt)</Typography><Typography sx={{ fontWeight: 800, fontSize: 20 }}>{usd(u.ourCostUsd)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Inntekt</Typography><Typography sx={{ fontWeight: 800, fontSize: 20, color: 'primary.main' }}>{usd(u.revenueUsd)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Margin</Typography><Typography sx={{ fontWeight: 800, fontSize: 20, color: 'success.main' }}>{usd(u.marginUsd)}</Typography></Box>
              </Stack>
              {u.includedRemaining != null && <Typography variant="caption" color="text.secondary">Inkludert kvote igjen denne mnd: {u.includedRemaining}</Typography>}
            </Box>

            <Divider />

            {/* Betaling / Stripe */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Betaling</Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" color={b.stripeLinked ? 'success' : 'default'} label={b.stripeLinked ? 'Stripe-tilknyttet' : 'Ikke Stripe-tilknyttet'} />
                  <Chip size="small" color={b.paid ? 'success' : 'warning'} label={b.paid ? `Betaler (${b.subscriptionStatus})` : (b.subscriptionStatus ? `Status: ${b.subscriptionStatus}` : 'Ingen aktivt abonnement')} />
                  <Chip size="small" variant="outlined" label={data.billingMode === 'metered' ? 'Modus: Metered' : 'Modus: Gratis (pilot)'} />
                </Stack>
                {b.plan && <Typography variant="body2" color="text.secondary">Plan: {b.plan.tierId || '—'}{b.plan.amount != null ? ` · ${b.plan.amount} ${b.plan.currency || ''}` : ''}{b.plan.nextBilling ? ` · neste: ${new Date(b.plan.nextBilling).toLocaleDateString('nb-NO')}` : ''}</Typography>}
                {data.billingMode === 'metered'
                  ? <Typography variant="body2">Generativ AI fakturert denne mnd (estimat): <b>{usd(b.genaiBilledThisMonthUsd)}</b> via Stripe-måler</Typography>
                  : <Typography variant="body2" color="text.secondary">I gratis-modus faktureres ingen generativ AI ennå.</Typography>}
                {b.stripeCustomerId && <Typography variant="caption" color="text.secondary">Stripe-kunde: {b.stripeCustomerId}</Typography>}
              </Stack>
            </Box>

            {/* Siste redigeringer */}
            {(data.recentJobs || []).length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Siste redigeringer</Typography>
                <Stack spacing={0.5}>
                  {data.recentJobs.map((j: any, i: number) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ fontSize: 13 }}>
                      <Chip size="small" variant="outlined" label={j.status} color={j.status === 'completed' ? 'success' : j.status === 'failed' ? 'error' : 'default'} />
                      <Typography variant="body2" sx={{ flex: 1 }} noWrap>{j.prompt || j.model}</Typography>
                      <Typography variant="caption" color="text.secondary">{j.createdAt ? new Date(j.createdAt).toLocaleDateString('nb-NO') : ''}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Lukk</Button></DialogActions>
    </Dialog>
  );
};

export default UserGenAiUsageDialog;
