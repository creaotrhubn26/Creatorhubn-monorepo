/**
 * TalentConsentCard.tsx — student-vendt samtykke-flate (GDPR-transparens).
 *
 * Viser en ventende Role Room Talents-invitasjon skolen har opprettet, FORKLARER
 * hva Role Room Talents er (informert samtykke, art. 13/14), og lar studenten
 * selv AKSEPTERE (overta profilen) eller AVSLÅ (slette utkastet). Rendrer
 * ingenting hvis det ikke finnes en ventende invitasjon (eller bruker ikke er
 * autentisert som en ordinær konto) — trygt å montere hvor som helst.
 *
 * Kanonisk hjem: den ordinære Talents-flaten for en innlogget nyutdannet. Kan
 * også monteres i student-flater der brukeren har en ordinær sesjon.
 */

import { useEffect, useState, useCallback } from 'react';
import { Box, Stack, Typography, Button, Divider } from '@mui/material';
import { TheaterComedy as TalentIcon, Verified as VerifiedIcon, Movie as ShowreelIcon, CheckCircle as AcceptIcon, Block as DeclineIcon, Shield as ShieldIcon } from '@mui/icons-material';
import { educationTalentPipelineService, type PendingInvite, type TalentsInfo } from './educationTalentPipelineService';

const ACCENT = '#8B5CF6';

export function TalentConsentCard({ onDone }: { onDone?: () => void }) {
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [info, setInfo] = useState<TalentsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await educationTalentPipelineService.getPending();
      setPending(r.pending); setInfo(r.info);
    } catch { setPending([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const accept = async () => {
    setBusy(true); setError(null);
    try { await educationTalentPipelineService.claim(); setDone('accepted'); onDone?.(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke akseptere'); }
    finally { setBusy(false); }
  };
  const decline = async () => {
    setBusy(true); setError(null);
    try { await educationTalentPipelineService.decline(); setDone('declined'); onDone?.(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke avslå'); }
    finally { setBusy(false); }
  };

  if (loading || (pending.length === 0 && !done)) return null;

  if (done) {
    return (
      <Box sx={{ p: 2, borderRadius: 3, bgcolor: done === 'accepted' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${done === 'accepted' ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.1)'}`, color: '#fff' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {done === 'accepted' ? <AcceptIcon sx={{ color: '#34d399' }} /> : <DeclineIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />}
          <Typography sx={{ fontSize: 13.5 }}>
            {done === 'accepted'
              ? 'Du har overtatt profilen din i Role Room Talents. Den er fortsatt usynlig for byråer til du selv gir samtykke per byrå.'
              : 'Invitasjonen er avslått og utkastet er slettet.'}
          </Typography>
        </Stack>
      </Box>
    );
  }

  const p = pending[0];
  return (
    <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(139,92,246,0.09)', border: '1px solid rgba(139,92,246,0.32)', color: '#fff' }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
        <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: 'rgba(139,92,246,0.22)', color: '#c4b5fd', display: 'grid', placeItems: 'center', flexShrink: 0 }}><TalentIcon /></Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Du er invitert til Role Room Talents</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>Skolen din har opprettet et utkast til talent-profil for deg{p.credential?.institution ? ` (${[p.credential.program, p.credential.institution, p.credential.year].filter(Boolean).join(' · ')})` : ''}.</Typography>
        </Box>
      </Stack>

      {info && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{info.title}</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55, mt: 0.5 }}>{info.summary}</Typography>

          <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.1)' }} />
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>Hva deles</Typography>
          <Stack spacing={0.25} sx={{ mb: 1.25 }}>
            {info.dataShared.map((d, i) => <Typography key={i} sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>• {d}</Typography>)}
          </Stack>

          <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ p: 1.25, borderRadius: 2, bgcolor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', mb: 1.25 }}>
            <ShieldIcon sx={{ fontSize: 16, color: '#34d399', mt: 0.25 }} />
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{info.visibility}</Typography>
          </Stack>

          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>Dine rettigheter</Typography>
          <Stack spacing={0.25} sx={{ mb: 1 }}>
            {info.yourRights.map((r, i) => <Typography key={i} sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>• {r}</Typography>)}
          </Stack>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>{info.controller}</Typography>
        </Box>
      )}

      {p.showreelUrl && (
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1.5 }}>
          <VerifiedIcon sx={{ fontSize: 15, color: '#34d399' }} />
          <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>Showreel klar</Typography>
          <Button size="small" href={p.showreelUrl} target="_blank" rel="noopener" startIcon={<ShowreelIcon sx={{ fontSize: '15px !important' }} />} sx={{ color: '#c4b5fd', textTransform: 'none', fontSize: 12 }}>Se</Button>
        </Stack>
      )}

      {error && <Typography sx={{ fontSize: 12, color: '#ef4444', mt: 1 }}>{error}</Typography>}

      <Stack direction="row" spacing={1.25} sx={{ mt: 2 }}>
        <Button variant="contained" startIcon={<AcceptIcon />} onClick={accept} disabled={busy}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
          {busy ? 'Lagrer…' : 'Ja, overta profilen'}
        </Button>
        <Button variant="outlined" startIcon={<DeclineIcon />} onClick={decline} disabled={busy}
          sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
          Nei takk, slett utkastet
        </Button>
      </Stack>
    </Box>
  );
}

export default TalentConsentCard;
