/**
 * AssessmentTab.tsx — «Vurdering» (redesign, CMS-koblet).
 *
 * Samler alle leverte/vurderte innleveringer på tvers av oppgaver. Faglærer gir
 * FORMATIV, produksjonsnær tilbakemelding + (valgfri) karakter, med «Åpne
 * produksjon» rett til det ekte arbeidet. Karakter kan sendes til LMS via LTI
 * (AGS grade-passback) når åpnet fra LMS, eller eksporteres som CSV.
 *
 * Design speiler mockup: KPI-kort, header m/ Eksporter CSV + Send alle til LMS,
 * vurderingskø m/ filter-pills. All AGS/rubrikk/LMS-logikk er BEVART.
 *
 * 🔑 CMS: stabile data-edit-id (edu-vu-*) på hvert statiske element.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Card, CardContent, Button, TextField,
  Chip, CircularProgress, Alert, ToggleButtonGroup, ToggleButton, Tooltip, Link,
} from '@mui/material';
import {
  Grading as AssessmentIcon, OpenInNew as OpenIcon, Download as DownloadIcon,
  CheckCircle as DoneIcon, CloudUpload as LmsPushIcon, HourglassTop as PendingIcon,
  TrendingUp as AvgIcon, School as LmsIcon,
} from '@mui/icons-material';
import { educationAssessmentService, type AssessmentItem } from './educationAssessmentService';
import educationLtiService from './educationLtiService';
import { LmsRosterPanel } from './LmsRosterPanel';
import { educationRubricService, RUBRIC_LEVELS, RUBRIC_MAX, type RubricCriterion } from './educationRubricService';
import { educationAssignmentsService } from './educationAssignmentsService';
import { openProductionInRoleRoom } from './educationProductionsService';
import { ACCENT, Panel, T } from './_eduUi';

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

  // LTI-launch-kontekst → «Send til LMS-karakterbok» (AGS grade-passback).
  const [launchId] = useState<string | null>(() => educationLtiService.getLaunchId());
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [pushedIds, setPushedIds] = useState<Set<string>>(new Set());

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
  const reviewedThisWeek = useMemo(() => items.filter((it) => it.reviewedAt && (Date.now() - new Date(it.reviewedAt).getTime()) < 7 * 86_400_000).length, [items]);
  const avgGrade = useMemo(() => {
    const nums = items.map((it) => Number(it.grade)).filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length === 0) return '—';
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
  }, [items]);

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

  const pushToLms = async (it: AssessmentItem) => {
    if (!launchId) return;
    const draft = drafts[it.submissionId] ?? { grade: '', feedback: '' };
    const grade = (draft.grade || it.grade || '').trim();
    if (!grade) { setError('Sett en karakter før du sender til LMS.'); return; }
    setPushingId(it.submissionId);
    setError(null);
    try {
      await educationLtiService.pushGrade(launchId, {
        grade,
        comment: (draft.feedback || it.feedback || '').trim() || undefined,
        label: it.assignmentTitle,
      });
      setPushedIds((prev) => new Set(prev).add(it.submissionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke sende til LMS');
    } finally {
      setPushingId(null);
    }
  };

  const pushAllToLms = async () => {
    if (!launchId) return;
    const targets = items.filter((it) => it.status === 'reviewed' && ((drafts[it.submissionId]?.grade || it.grade || '').trim()) && !pushedIds.has(it.submissionId));
    if (targets.length === 0) { setError('Ingen vurderte innleveringer med karakter å sende ennå.'); return; }
    for (const it of targets) {
      // eslint-disable-next-line no-await-in-loop -- sekvensiell AGS-passback unngår rate-limit
      await pushToLms(it);
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

  const kpis = [
    { id: 'kø', label: 'Til vurdering', value: pendingCount, hint: 'Innleveringer venter', icon: <PendingIcon />, bg: 'rgba(245,158,11,0.16)', c: '#f59e0b' },
    { id: 'vurdert', label: 'Vurdert denne uken', value: reviewedThisWeek, hint: 'Fullførte vurderinger', icon: <DoneIcon />, bg: 'rgba(16,185,129,0.16)', c: '#34d399' },
    { id: 'snitt', label: 'Snittkarakter', value: avgGrade, hint: 'Der karakter er tallfestet', icon: <AvgIcon />, bg: 'rgba(139,92,246,0.16)', c: '#c4b5fd' },
    { id: 'lms', label: 'Sendt til LMS', value: pushedIds.size, hint: 'Karakterer via AGS', icon: <LmsIcon />, bg: 'rgba(56,189,248,0.16)', c: '#38bdf8' },
  ];

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2}>
        <Stack direction="row" spacing={1.75} alignItems="flex-start">
          <Box sx={{ width: 50, height: 50, borderRadius: 3, bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', display: 'grid', placeItems: 'center', flexShrink: 0 }}><AssessmentIcon /></Box>
          <Box>
            <T eid="edu-vu-title" variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>Vurdering</T>
            <T eid="edu-vu-subtitle" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, mt: 0.4 }}>Formativ, produksjonsnær tilbakemelding på leveransene — offisiell karakter føres i skolens system.</T>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Tooltip title="Last ned karakterer + tilbakemeldinger som CSV for opplasting i skolens LMS">
            <span>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport} disabled={exporting || items.length === 0}
                sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
                <T eid="edu-vu-btn-csv" component="span" sx={{ fontWeight: 600 }}>{exporting ? 'Eksporterer…' : 'Eksporter CSV'}</T>
              </Button>
            </span>
          </Tooltip>
          {launchId && (
            <Button variant="contained" startIcon={<LmsPushIcon />} onClick={pushAllToLms}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
              <T eid="edu-vu-btn-pushall" component="span" sx={{ fontWeight: 700 }}>Send alle til LMS</T>
            </Button>
          )}
        </Stack>
      </Stack>

      {/* KPI-kort */}
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        {kpis.map((k) => (
          <Panel key={k.id} sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <T eid={`edu-vu-kpi-${k.id}-label`} sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{k.label}</T>
              <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: k.bg, color: k.c, '& svg': { fontSize: 19 } }}>{k.icon}</Box>
            </Stack>
            <Typography sx={{ fontSize: 30, fontWeight: 800, mt: 1, lineHeight: 1 }}>{k.value}</Typography>
            <T eid={`edu-vu-kpi-${k.id}-hint`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', mt: 0.75 }}>{k.hint}</T>
          </Panel>
        ))}
      </Box>

      <Alert severity="info" icon={<AssessmentIcon fontSize="inherit" />}
        sx={{ bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(255,255,255,0.82)', '& .MuiAlert-icon': { color: ACCENT } }}>
        <T eid="edu-vu-info" component="span">Dette er formativ vurdering knyttet til det ekte produksjonsarbeidet. Offisielle karakterer føres i skolens eget system — bruk «Eksporter CSV» eller «Send til LMS».</T>
      </Alert>

      {launchId && <LmsRosterPanel launchId={launchId} />}

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* Vurderingskø */}
      <Panel sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <T eid="edu-vu-queue-title" sx={{ fontWeight: 700, fontSize: 17 }}>Vurderingskø</T>
          <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_e, v: Filter | null) => { if (v) setFilter(v); }}
            sx={{ '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', textTransform: 'none', px: 1.5, borderColor: 'rgba(255,255,255,0.12)' }, '& .Mui-selected': { bgcolor: 'rgba(139,92,246,0.28) !important', color: '#fff !important' } }}>
            <ToggleButton value="submitted">Til vurdering{pendingCount > 0 ? ` (${pendingCount})` : ''}</ToggleButton>
            <ToggleButton value="reviewed">Vurdert</ToggleButton>
            <ToggleButton value="all">Alle</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <AssessmentIcon sx={{ fontSize: 40, color: ACCENT, mb: 1 }} />
            <T eid="edu-vu-empty" sx={{ color: 'rgba(255,255,255,0.72)', display: 'block' }}>
              {filter === 'submitted' ? 'Ingen leveranser venter på vurdering. Marker innleveringer som «Levert» i Oppgaver-fanen.' : 'Ingenting her ennå.'}
            </T>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            {filtered.map((it) => {
              const draft = drafts[it.submissionId] ?? { grade: '', feedback: '' };
              const goals = (it.learningGoals ?? '').split('\n').map((g) => g.trim()).filter(Boolean);
              return (
                <Card key={it.submissionId} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2.5 }}>
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

                    {it.link && (
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <OpenIcon sx={{ fontSize: 15, color: ACCENT }} />
                        <Link href={it.link} target="_blank" rel="noopener" sx={{ color: ACCENT, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Studentens levering</Link>
                      </Stack>
                    )}

                    <RubricScoring assignmentId={it.assignmentId} studentId={it.studentId} onError={setError} />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
                      <TextField label="Karakter" size="small" value={draft.grade}
                        onChange={(e) => setDraft(it.submissionId, { grade: e.target.value })}
                        placeholder="A / B / bestått / 5" sx={{ width: { xs: '100%', sm: 160 } }} />
                      <TextField label="Tilbakemelding" size="small" value={draft.feedback}
                        onChange={(e) => setDraft(it.submissionId, { feedback: e.target.value })}
                        multiline minRows={2} fullWidth placeholder="Hva var sterkt, og hva kan bli bedre — knyttet til læringsmålene?" />
                    </Stack>

                    <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                      {launchId && (
                        <Tooltip title="Send karakteren rett til LMS-karakterboka via LTI (AGS). MVP: går til LMS-brukeren som åpnet Role Room fra LMS-en — per-student passback for hele kullet kommer med roster-sync.">
                          <span>
                            <Button size="small" variant="outlined"
                              startIcon={pushedIds.has(it.submissionId) ? <DoneIcon /> : <LmsPushIcon />}
                              onClick={() => pushToLms(it)} disabled={pushingId === it.submissionId}
                              sx={{ borderColor: 'rgba(139,92,246,0.5)', color: pushedIds.has(it.submissionId) ? '#10b981' : '#e9d5ff', textTransform: 'none', whiteSpace: 'nowrap', '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(139,92,246,0.08)' } }}>
                              {pushingId === it.submissionId ? 'Sender…' : pushedIds.has(it.submissionId) ? 'Sendt til LMS' : 'Send til LMS'}
                            </Button>
                          </span>
                        </Tooltip>
                      )}
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
      </Panel>
    </Box>
  );
}

function RubricScoring({ assignmentId, studentId, onError }: { assignmentId: string; studentId: string; onError: (m: string | null) => void }) {
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void educationRubricService.getScores(assignmentId, studentId)
      .then((d) => { if (!cancelled) { setCriteria(d.criteria); setScores(d.scores ?? {}); } })
      .catch(() => { /* tom rubrikk greit */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [assignmentId, studentId]);

  if (loading || criteria.length === 0) return null;

  const setLevel = async (criterionId: string, level: 0 | 1 | 2) => {
    setScores((prev) => ({ ...prev, [criterionId]: level }));
    try {
      await educationRubricService.setScore({ criterionId, studentId, level });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke lagre rubrikk-score');
    }
  };

  const total = criteria.reduce((s, c) => s + (scores[c.id] ?? 0), 0);
  const max = criteria.length * RUBRIC_MAX;
  const pct = max ? Math.round((total / max) * 100) : 0;

  return (
    <Box sx={{ display: 'grid', gap: 1, p: 1.5, borderRadius: 2, bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 }}>Rubrikk</Typography>
        <Chip size="small" label={`${total} / ${max} poeng · ${pct}%`} sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff' }} />
      </Stack>
      {criteria.map((c) => (
        <Stack key={c.id} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={0.5}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{c.title}</Typography>
            {c.learningGoal && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{c.learningGoal}</Typography>}
          </Box>
          <ToggleButtonGroup size="small" exclusive value={scores[c.id] ?? 0}
            onChange={(_e, v: number | null) => { if (v !== null) void setLevel(c.id, v as 0 | 1 | 2); }}
            sx={{ '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', textTransform: 'none', fontSize: 11, py: 0.25, px: 1 }, '& .Mui-selected': { bgcolor: 'rgba(139,92,246,0.28) !important', color: '#fff !important' } }}>
            {RUBRIC_LEVELS.map((l) => <ToggleButton key={l.value} value={l.value}>{l.label}</ToggleButton>)}
          </ToggleButtonGroup>
        </Stack>
      ))}
    </Box>
  );
}

export default AssessmentTab;
