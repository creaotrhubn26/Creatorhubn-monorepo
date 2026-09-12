/**
 * CensorView.tsx — ekstern sensors flate (/role-room/censor).
 *
 * Isolert sensor-sesjon → ser kullets studenter, deres leveranser + faglærers
 * vurdering (read-only), og gir sin egen uavhengige karakter + kommentar.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Stack, Typography, Card, CardContent, Button, TextField, Chip,
  CircularProgress, Alert, Divider,
} from '@mui/material';
import { FactCheck as CensorIcon, Logout as LogoutIcon } from '@mui/icons-material';
import {
  educationCensorService, getCensorToken, clearCensorSession,
  type CensorView as CensorViewData, type CensorAssignmentRow,
} from '@/components/role-room/education/educationCensorService';

const ACCENT = '#8B5CF6';

export default function CensorView() {
  const [view, setView] = useState<CensorViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getCensorToken()) { window.location.href = '/'; return; }
    void educationCensorService.getView()
      .then(setView)
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunne ikke hente sensuren'))
      .finally(() => setLoading(false));
  }, []);

  const logout = () => { clearCensorSession(); window.location.href = '/'; };

  if (loading) return <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><CircularProgress sx={{ color: ACCENT }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', color: '#fff', p: { xs: 2, md: 4 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <CensorIcon sx={{ color: ACCENT }} />
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Sensur</Typography>
        {view?.cohortName && <Chip label={view.cohortName} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff', fontWeight: 700 }} />}
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" startIcon={<LogoutIcon />} onClick={logout} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>Logg ut</Button>
      </Stack>
      <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5, mb: 3 }}>
        Ekstern sensur — se studentarbeid og faglærers vurdering, og gi din egen uavhengige vurdering.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {view && view.students.length === 0 ? (
        <Typography sx={{ color: 'text.disabled' }}>Ingen studenter i kullet.</Typography>
      ) : (
        <Stack spacing={2}>
          {view?.students.map((st) => (
            <Card key={st.studentId} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <CardContent>
                <Typography sx={{ fontWeight: 800, mb: 1 }}>{st.name}</Typography>
                <Stack spacing={1.5}>
                  {st.assignments.map((a, i) => (
                    <Box key={a.assignmentId}>
                      {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 1.5 }} />}
                      <CensorAssignment studentId={st.studentId} row={a} onError={setError} />
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function CensorAssignment({ studentId, row, onError }: { studentId: string; row: CensorAssignmentRow; onError: (m: string | null) => void }) {
  const [grade, setGrade] = useState(row.censorGrade ?? '');
  const [feedback, setFeedback] = useState(row.censorFeedback ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = useCallback(async () => {
    setSaving(true); setSaved(false);
    try {
      await educationCensorService.setGrade({ studentId, assignmentId: row.assignmentId, grade: grade.trim() || undefined, feedback: feedback.trim() || undefined });
      setSaved(true); window.setTimeout(() => setSaved(false), 1600);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke lagre vurdering');
    } finally {
      setSaving(false);
    }
  }, [studentId, row.assignmentId, grade, feedback, onError]);

  const statusLabel = row.submissionStatus === 'reviewed' ? 'Vurdert av faglærer'
    : row.submissionStatus === 'submitted' ? 'Levert' : 'Ikke levert';

  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{row.title}</Typography>
        <Chip size="small" label={statusLabel} sx={{ height: 20, fontSize: 10 }} />
      </Stack>
      {(row.teacherGrade || row.teacherFeedback) && (
        <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Faglærers vurdering{row.teacherGrade ? ` · ${row.teacherGrade}` : ''}
          </Typography>
          {row.teacherFeedback && <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', whiteSpace: 'pre-wrap' }}>{row.teacherFeedback}</Typography>}
        </Box>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
        <TextField label="Din karakter" size="small" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="A / bestått" sx={{ width: { xs: '100%', sm: 150 } }} />
        <TextField label="Din vurdering" size="small" value={feedback} onChange={(e) => setFeedback(e.target.value)} multiline minRows={1} fullWidth />
        <Button variant="contained" onClick={save} disabled={saving} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT }, whiteSpace: 'nowrap' }}>
          {saving ? 'Lagrer…' : saved ? 'Lagret ✓' : 'Lagre'}
        </Button>
      </Stack>
    </Box>
  );
}
