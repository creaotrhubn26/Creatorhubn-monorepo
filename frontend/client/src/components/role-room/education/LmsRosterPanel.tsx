/**
 * LmsRosterPanel.tsx — LMS-klasse-roster (LTI 1.3 NRPS) i Vurdering.
 *
 * Når faglærer er LTI-launchet fra LMS-en henter vi klasse-rosteret (hver
 * students LMS-sub + navn/e-post/rolle) og lar faglærer sende karakter rett
 * til hver students egen rad i karakterboka via AGS. Dette løfter grade-
 * passback fra «student-launchet» til «faglærer-vurderer-hele-kullet».
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Stack, Chip, TextField, Button,
  CircularProgress, Alert, Collapse, IconButton, Tooltip,
} from '@mui/material';
import {
  Groups as RosterIcon, CloudUpload as LmsPushIcon, CheckCircle as DoneIcon,
  ExpandMore as ExpandIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import educationLtiService, { type LtiRosterMember } from './educationLtiService';

const ACCENT = '#8B5CF6';

function roleLabel(roles: string[]): { label: string; color: string } {
  const joined = roles.join(' ');
  if (/Instructor|TeachingAssistant|ContentDeveloper|Mentor|Administrator/i.test(joined)) {
    return { label: 'Faglærer', color: '#38bdf8' };
  }
  if (/Learner|Student/i.test(joined)) return { label: 'Student', color: '#a78bfa' };
  return { label: 'Medlem', color: 'rgba(255,255,255,0.72)' };
}

export function LmsRosterPanel({ launchId }: { launchId: string }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<LtiRosterMember[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [pushingSub, setPushingSub] = useState<string | null>(null);
  const [pushedSubs, setPushedSubs] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const roster = await educationLtiService.getRoster(launchId);
      setMembers(roster);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kunne ikke hente klasseliste';
      setError(msg === 'no_nrps' ? 'LMS-en delte ikke klasseliste (NRPS) for denne launchen.' : msg);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [launchId]);

  // Hent rosteret første gang panelet åpnes.
  useEffect(() => {
    if (open && members === null && !loading) void load();
  }, [open, members, loading, load]);

  const pushGrade = async (m: LtiRosterMember) => {
    const grade = (grades[m.sub] ?? '').trim();
    if (!grade) { setError('Sett en karakter først.'); return; }
    setPushingSub(m.sub);
    setError(null);
    try {
      await educationLtiService.pushGrade(launchId, { grade, ltiUserSub: m.sub, label: 'The Role Room' });
      setPushedSubs((prev) => new Set(prev).add(m.sub));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke sende til LMS');
    } finally {
      setPushingSub(null);
    }
  };

  return (
    <Card sx={{ bgcolor: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.25)' }}>
      <CardContent sx={{ pb: open ? 2 : '16px !important' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}
          sx={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <RosterIcon sx={{ color: '#38bdf8' }} />
            <Box>
              <Typography sx={{ fontWeight: 700 }}>LMS-klasseliste (LTI)</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                Send karakter rett til hver students rad i LMS-karakterboka.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {open && (
              <Tooltip title="Oppdater klasseliste">
                <span>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); void load(); }} disabled={loading}>
                    <RefreshIcon fontSize="small" sx={{ color: '#38bdf8' }} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <ExpandIcon sx={{ color: '#38bdf8', transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
          </Stack>
        </Stack>

        <Collapse in={open}>
          <Box sx={{ mt: 2, display: 'grid', gap: 1 }}>
            {error && <Alert severity="warning" onClose={() => setError(null)} sx={{ fontSize: 13 }}>{error}</Alert>}
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={22} sx={{ color: '#38bdf8' }} /></Box>
            ) : members && members.length === 0 ? (
              <Typography sx={{ color: 'text.secondary', fontSize: 13, p: 1 }}>Ingen medlemmer i rosteret.</Typography>
            ) : (
              (members ?? []).map((m) => {
                const role = roleLabel(m.roles);
                const pushed = pushedSubs.has(m.sub);
                return (
                  <Stack key={m.sub} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}
                    sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{m.name || m.email || m.sub}</Typography>
                        <Chip size="small" label={role.label} sx={{ height: 18, fontSize: 9.5, color: role.color, borderColor: role.color }} variant="outlined" />
                      </Stack>
                      {m.email && <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{m.email}</Typography>}
                    </Box>
                    <TextField size="small" label="Karakter" value={grades[m.sub] ?? ''}
                      onChange={(e) => setGrades((g) => ({ ...g, [m.sub]: e.target.value }))}
                      placeholder="A / bestått / 5" sx={{ width: { xs: '100%', sm: 130 } }} />
                    <Button size="small" variant="outlined"
                      startIcon={pushed ? <DoneIcon /> : <LmsPushIcon />}
                      onClick={() => pushGrade(m)} disabled={pushingSub === m.sub}
                      sx={{ whiteSpace: 'nowrap', borderColor: 'rgba(56,189,248,0.5)', color: pushed ? '#10b981' : '#7dd3fc', textTransform: 'none', '&:hover': { borderColor: '#38bdf8', bgcolor: 'rgba(56,189,248,0.08)' } }}>
                      {pushingSub === m.sub ? 'Sender…' : pushed ? 'Sendt' : 'Send til LMS'}
                    </Button>
                  </Stack>
                );
              })
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

export default LmsRosterPanel;
