/**
 * AssessmentTab.tsx — «Vurdering»-flaten (opplæringslag 4, del 1).
 *
 * Samler alle leverte/vurderte innleveringer på tvers av oppgaver. Faglærer gir
 * FORMATIV, produksjonsnær tilbakemelding + (valgfri) karakter, med «Åpne
 * produksjon» rett til det ekte arbeidet. Karakteren eksporteres til skolens
 * LMS/karaktersystem via CSV — Role Room er bevisst IKKE en gradebook.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Card, CardContent, Button, TextField,
  Chip, CircularProgress, Alert, ToggleButtonGroup, ToggleButton, Tooltip,
} from '@mui/material';
import {
  Grading as AssessmentIcon, OpenInNew as OpenIcon, Download as DownloadIcon,
  CheckCircle as DoneIcon,
} from '@mui/icons-material';
import { educationAssessmentService, type AssessmentItem } from './educationAssessmentService';
import { educationAssignmentsService } from './educationAssignmentsService';
import { openProductionInRoleRoom } from './educationProductionsService';

const ACCENT = '#8B5CF6';

type Filter = 'submitted' | 'reviewed' | 'all';

export function AssessmentTab() {
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('submitted');
  const [exporting, setExporting] = useState(false);

  // Lokale utkast per innlevering (karakter + tilbakemelding).
  const [drafts, setDrafts] = useState<Record<string, { grade: string; feedback: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queue = await educationAssessmentService.getQueue();
      setItems(queue);
      setDrafts(Object.fromEntries(queue.map((it) => [it.submissionId, { grade: it.grade ?? '', feedback: it.feedback ?? '' }])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente vurderingskø');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(
    () => items.filter((it) => filter === 'all' ? true : it.status === filter),
    [items, filter],
  );
  const pendingCount = useMemo(() => items.filter((it) => it.status === 'submitted').length, [items]);

  const setDraft = (id: string, patch: Partial<{ grade: string; feedback: string }>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const save = async (it: AssessmentItem, markReviewed: boolean) => {
    const draft = drafts[it.submissionId] ?? { grade: '', feedback: '' };
    setSavingId(it.submissionId);
    try {
      const status = markReviewed ? 'reviewed' : it.status;
      await educationAssignmentsService.setSubmission(it.assignmentId, {
        studentId: it.studentId,
        status,
        grade: draft.grade.trim() || undefined,
        feedback: draft.feedback.trim() || undefined,
      });
      setItems((prev) => prev.map((x) => x.submissionId === it.submissionId
        ? { ...x, status, grade: draft.grade.trim() || null, feedback: draft.feedback.trim() || null, reviewedAt: markReviewed ? new Date().toISOString() : x.reviewedAt }
        : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke lagre vurdering');
    } finally {
      setSavingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await educationAssessmentService.exportCsv();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke eksportere');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Vurdering</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
            Formativ, produksjonsnær tilbakemelding på leveransene.
          </Typography>
        </Box>
        <Tooltip title="Last ned karakterer + tilbakemeldinger som CSV for opplasting i skolens LMS">
          <span>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport} disabled={exporting || items.length === 0}
              sx={{ borderColor: 'rgba(139,92,246,0.5)', color: '#e9d5ff', textTransform: 'none', '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(139,92,246,0.08)' } }}>
              {exporting ? 'Eksporterer…' : 'Eksporter til LMS (CSV)'}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      <Alert severity="info" icon={<AssessmentIcon fontSize="inherit" />}
        sx={{ bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(255,255,255,0.82)', '& .MuiAlert-icon': { color: ACCENT } }}>
        Dette er formativ vurdering knyttet til det ekte produksjonsarbeidet. Offisielle karakterer føres i skolens eget system — bruk «Eksporter til LMS».
      </Alert>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_e, v: Filter | null) => { if (v) setFilter(v); }}
        sx={{ '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', textTransform: 'none', px: 1.5 }, '& .Mui-selected': { bgcolor: 'rgba(139,92,246,0.28) !important', color: '#fff !important' } }}>
        <ToggleButton value="submitted">Til vurdering{pendingCount > 0 ? ` (${pendingCount})` : ''}</ToggleButton>
        <ToggleButton value="reviewed">Vurdert</ToggleButton>
        <ToggleButton value="all">Alle</ToggleButton>
      </ToggleButtonGroup>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : filtered.length === 0 ? (
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(139,92,246,0.3)' }}>
          <CardContent sx={{ textAlign: 'center', p: 4 }}>
            <AssessmentIcon sx={{ fontSize: 40, color: ACCENT, mb: 1 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>
              {filter === 'submitted' ? 'Ingen leveranser venter på vurdering. Marker innleveringer som «Levert» i Oppgaver-fanen.' : 'Ingenting her enda.'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {filtered.map((it) => {
            const draft = drafts[it.submissionId] ?? { grade: '', feedback: '' };
            const goals = (it.learningGoals ?? '').split('\n').map((g) => g.trim()).filter(Boolean);
            return (
              <Card key={it.submissionId} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardContent sx={{ display: 'grid', gap: 1.25 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} flexWrap="wrap" useFlexGap>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>{it.studentName}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={it.assignmentTitle} sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff' }} />
                        {it.cohortName && <Chip size="small" label={it.cohortName} sx={{ height: 20, fontSize: 10 }} />}
                        {it.status === 'reviewed' && <Chip size="small" icon={<DoneIcon sx={{ fontSize: '12px !important' }} />} label="Vurdert" sx={{ height: 20, fontSize: 10, color: '#10b981', '& .MuiChip-icon': { color: '#10b981' } }} variant="outlined" />}
                      </Stack>
                    </Box>
                    {it.productionProjectId && (
                      <Button size="small" variant="outlined" startIcon={<OpenIcon />} onClick={() => openProductionInRoleRoom(it.productionProjectId as string)}
                        sx={{ borderColor: 'rgba(139,92,246,0.5)', color: '#e9d5ff', textTransform: 'none', whiteSpace: 'nowrap', '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(139,92,246,0.08)' } }}>
                        Åpne produksjon
                      </Button>
                    )}
                  </Stack>

                  {goals.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 }}>Læringsmål</Typography>
                      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{goals.join(' · ')}</Typography>
                    </Box>
                  )}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
                    <TextField label="Karakter" size="small" value={draft.grade}
                      onChange={(e) => setDraft(it.submissionId, { grade: e.target.value })}
                      placeholder="A / B / bestått / 5" sx={{ width: { xs: '100%', sm: 160 } }} />
                    <TextField label="Tilbakemelding" size="small" value={draft.feedback}
                      onChange={(e) => setDraft(it.submissionId, { feedback: e.target.value })}
                      multiline minRows={2} fullWidth placeholder="Hva var sterkt, og hva kan bli bedre — knyttet til læringsmålene?" />
                  </Stack>

                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" onClick={() => save(it, false)} disabled={savingId === it.submissionId}
                      sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>
                      Lagre utkast
                    </Button>
                    <Button size="small" variant="contained" startIcon={<DoneIcon />} onClick={() => save(it, true)} disabled={savingId === it.submissionId}
                      sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT }, textTransform: 'none' }}>
                      {savingId === it.submissionId ? 'Lagrer…' : it.status === 'reviewed' ? 'Oppdater vurdering' : 'Marker vurdert'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export default AssessmentTab;
