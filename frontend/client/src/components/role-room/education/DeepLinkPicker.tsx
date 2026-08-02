/**
 * DeepLinkPicker.tsx — LTI Deep Linking-plukker.
 *
 * Vises når Canvas launcher oss som en Deep Linking-forespørsel (?deeplink=1):
 * læreren velger (eller oppretter) en studentproduksjon, og vi sender en signert
 * DeepLinkingResponse tilbake til Canvas (ltiResourceLink som launcher produksjonen).
 * Canvas oppretter da en oppgave/lenke med DIREKTE tilgang til produksjonen.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Stack, Typography, Button, Card, CardActionArea, CircularProgress, Alert,
  TextField, MenuItem, Divider,
} from '@mui/material';
import { MovieCreation as ProductionIcon, Add as AddIcon, Send as SendIcon } from '@mui/icons-material';
import educationLtiService from './educationLtiService';
import { educationProductionsService, type Production } from './educationProductionsService';
import { educationCohortsService, type Cohort } from './educationCohortsService';

const ACCENT = '#8B5CF6';

function submitToCanvas(returnUrl: string, jwt: string): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = returnUrl;
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'JWT';
  input.value = jwt;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}

export function DeepLinkPicker() {
  const [launchId] = useState<string | null>(() => educationLtiService.getLaunchId());
  const [productions, setProductions] = useState<Production[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Opprett ny produksjon.
  const [newTitle, setNewTitle] = useState('');
  const [newCohort, setNewCohort] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [prods, chs] = await Promise.all([
        educationProductionsService.listProductions(),
        educationCohortsService.listCohorts().catch(() => [] as Cohort[]),
      ]);
      setProductions(prods); setCohorts(chs);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke hente produksjoner'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const sendBack = async (projectId: string, title: string, key: string) => {
    if (!launchId) { setError('Mangler launch-kontekst.'); return; }
    setSendingId(key); setError(null);
    try {
      const { returnUrl, jwt } = await educationLtiService.deepLinkResponse(launchId, { projectId, title });
      submitToCanvas(returnUrl, jwt);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke sende til Canvas'); setSendingId(null); }
  };

  const createAndSend = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true); setError(null);
    try {
      const prod = await educationProductionsService.createProduction({ title: newTitle.trim(), cohortId: newCohort || undefined });
      await sendBack(prod.projectId, prod.title, 'new');
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke opprette'); setCreating(false); }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', color: '#fff', p: { xs: 2, md: 4 }, display: 'grid', placeItems: 'start center' }}>
      <Box sx={{ width: '100%', maxWidth: 640 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', display: 'grid', placeItems: 'center' }}><ProductionIcon /></Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Velg produksjon for Canvas</Typography>
            <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>Legger til en direkte lenke til produksjonen som en oppgave/ressurs i Canvas.</Typography>
          </Box>
        </Stack>

        {error && <Alert severity="error" sx={{ my: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
        ) : (
          <>
            <Card sx={{ bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 3, p: 2, mt: 2 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Opprett ny produksjon</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <TextField size="small" label="Tittel" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} fullWidth />
                <TextField size="small" select label="Kull" value={newCohort} onChange={(e) => setNewCohort(e.target.value)} sx={{ minWidth: 160 }}>
                  <MenuItem value="">Ingen</MenuItem>
                  {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
                <Button variant="contained" startIcon={<AddIcon />} onClick={createAndSend} disabled={!newTitle.trim() || creating}
                  sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2, whiteSpace: 'nowrap' }}>
                  {creating ? 'Sender…' : 'Opprett + legg til'}
                </Button>
              </Stack>
            </Card>

            <Divider sx={{ my: 2.5, borderColor: 'rgba(255,255,255,0.08)' }}><Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>ELLER VELG EKSISTERENDE</Typography></Divider>

            {productions.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'center', py: 2 }}>Ingen produksjoner ennå — opprett en over.</Typography>
            ) : (
              <Stack spacing={1}>
                {productions.map((p) => (
                  <Card key={p.id} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2.5 }}>
                    <CardActionArea onClick={() => sendBack(p.projectId, p.title, p.id)} disabled={!!sendingId} sx={{ p: 1.75, display: 'flex', justifyContent: 'space-between' }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{p.title}</Typography>
                        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{p.assignmentCount} oppgaver</Typography>
                      </Box>
                      {sendingId === p.id ? <CircularProgress size={18} sx={{ color: ACCENT }} /> : <SendIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} />}
                    </CardActionArea>
                  </Card>
                ))}
              </Stack>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

export default DeepLinkPicker;
