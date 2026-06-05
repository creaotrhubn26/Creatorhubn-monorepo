/**
 * SelfTapeStudioPage.tsx — Self-Tape Studio
 *
 * 3-kolonne layout (mockup #15):
 *   Venstre: project-info + video-player + previous-takes + status
 *   Midten:  script + take management + AI feedback
 *   Høyre:   submissions + almost-ready + history
 *
 * Wired med dialoger (Fase B-2) og opptak/upload (Fase C).
 *
 * Spec: docs/specs/SELF_TAPE_STUDIO_SPEC.md
 */

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useCallback, useEffect, useState } from 'react';

import { palette, radius } from '../theme';
import {
  getProject,
  listProjects,
  sendSubmission,
  uploadRecordedTake,
  type ProjectDetail,
  type SelftapeProject,
  type SelftapeTake,
} from '../../services/roleRoomSelfTapesService';

import SelfTapeProjectInfoCard from '../components/selftape/SelfTapeProjectInfoCard';
import SelfTapeVideoPlayer from '../components/selftape/SelfTapeVideoPlayer';
import SelfTapePreviousTakesStrip from '../components/selftape/SelfTapePreviousTakesStrip';
import SelfTapeStatusCards from '../components/selftape/SelfTapeStatusCards';
import SelfTapeScriptCard from '../components/selftape/SelfTapeScriptCard';
import SelfTapeTakeManagement from '../components/selftape/SelfTapeTakeManagement';
import SelfTapeAIFeedbackCard from '../components/selftape/SelfTapeAIFeedbackCard';
import SelfTapeSubmissionTargets from '../components/selftape/SelfTapeSubmissionTargets';
import SelfTapeAlmostReadyCard from '../components/selftape/SelfTapeAlmostReadyCard';
import SelfTapeSubmissionHistory, {
  type SubmissionHistoryEntry,
} from '../components/selftape/SelfTapeSubmissionHistory';

import ProjectLibraryDrawer from '../components/selftape/dialogs/ProjectLibraryDrawer';
import NewProjectDialog from '../components/selftape/dialogs/NewProjectDialog';
import ScriptViewerDialog from '../components/selftape/dialogs/ScriptViewerDialog';
import GuidesDrawer from '../components/selftape/dialogs/GuidesDrawer';
import TakeActionsMenu from '../components/selftape/dialogs/TakeActionsMenu';
import RecordTakeDialog from '../components/selftape/dialogs/RecordTakeDialog';

interface SelfTapeStudioPageProps {
  demoMode?: boolean;
}

export default function SelfTapeStudioPage({ demoMode = false }: SelfTapeStudioPageProps) {
  // Project-state
  const [projects, setProjects] = useState<SelftapeProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog open-state
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [scriptDialog, setScriptDialog] = useState<'brief' | 'script' | null>(null);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [takeMenuAnchor, setTakeMenuAnchor] = useState<HTMLElement | null>(null);
  const [takeMenuTake, setTakeMenuTake] = useState<SelftapeTake | null>(null);

  // Snackbar
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);

  const refreshProjects = useCallback(async () => {
    const { projects } = await listProjects();
    setProjects(projects);
    return projects;
  }, []);

  // Last project-listen ved mount
  useEffect(() => {
    let cancelled = false;
    refreshProjects()
      .then((projs) => {
        if (cancelled) return;
        const active = projs.find((p) => p.status === 'active') ?? projs[0];
        setActiveProjectId(active?.id ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Klarte ikke å hente prosjekter');
      });
    return () => { cancelled = true; };
  }, [refreshProjects]);

  // Last detail når activeProjectId endres
  useEffect(() => {
    if (!activeProjectId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getProject(activeProjectId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Klarte ikke å hente prosjekt-data');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeProjectId]);

  const reloadDetail = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      setDetail(await getProject(activeProjectId));
    } catch (err) {
      console.error('reloadDetail failed', err);
    }
  }, [activeProjectId]);

  const currentTake = detail?.takes.find((t) => t.id === detail?.project.current_take_id) ?? null;

  // Sjekkliste for "Snart klar"-card
  const checklist = [
    { label: 'Take valgt', done: !!detail?.project.current_take_id },
    { label: 'AI-feedback gjennomgått', done: detail?.feedback?.status === 'ready' },
    { label: 'Minst ett målsted valgt', done: (detail?.submissions.length ?? 0) > 0 },
  ];

  // Avled history-entries fra submissions
  const historyEntries: SubmissionHistoryEntry[] = (detail?.submissions ?? [])
    .flatMap((s) => {
      const label = s.target_type === 'agency_direct'
        ? (s.agency_name ?? 'byrå')
        : s.target_type === 'private_link'
          ? 'privat lenke'
          : (s.casting_project_name ?? 'rolle');
      const items: SubmissionHistoryEntry[] = [];
      if (s.submitted_at) {
        items.push({ id: `${s.id}-sent`, event_type: 'submitted', target_label: label, occurred_at: s.submitted_at });
      }
      if (s.viewed_at) {
        items.push({ id: `${s.id}-viewed`, event_type: 'viewed', target_label: label, occurred_at: s.viewed_at });
      }
      if (s.status === 'shortlisted') {
        items.push({ id: `${s.id}-shortlisted`, event_type: 'shortlisted', target_label: label, occurred_at: s.viewed_at ?? s.submitted_at ?? new Date().toISOString() });
      }
      return items;
    })
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  // Handlers
  const handleNewProjectCreated = useCallback(async (projectId: string) => {
    await refreshProjects();
    setActiveProjectId(projectId);
    setSnack({ msg: 'Prosjektet er opprettet', severity: 'success' });
  }, [refreshProjects]);

  const handleProjectChanged = useCallback(async () => {
    const projs = await refreshProjects();
    // Hvis aktivt prosjekt ble arkivert, bytt til neste
    if (activeProjectId && !projs.some((p) => p.id === activeProjectId)) {
      const next = projs.find((p) => p.status === 'active') ?? projs[0];
      setActiveProjectId(next?.id ?? null);
    }
  }, [activeProjectId, refreshProjects]);

  const handleUploadFile = useCallback(async (file: File) => {
    if (!activeProjectId) return;
    setSnack({ msg: 'Laster opp video …', severity: 'info' });
    try {
      // Estimer varighet fra fil-størrelse hvis ikke i metadata
      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';
      const objectUrl = URL.createObjectURL(file);
      videoEl.src = objectUrl;
      const durationMs = await new Promise<number>((resolve) => {
        videoEl.onloadedmetadata = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(Math.round((videoEl.duration || 0) * 1000));
        };
        videoEl.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(0); };
        // Fallback hvis metadata aldri trigger
        window.setTimeout(() => resolve(0), 4000);
      });
      await uploadRecordedTake(activeProjectId, file, {
        durationMs,
        filename: file.name,
      });
      await reloadDetail();
      setSnack({ msg: 'Take lastet opp', severity: 'success' });
    } catch (err) {
      setSnack({
        msg: err instanceof Error ? `Upload feilet: ${err.message}` : 'Upload feilet',
        severity: 'error',
      });
    }
  }, [activeProjectId, reloadDetail]);

  const handleAlmostReadySubmit = useCallback(async () => {
    if (!detail) return;
    const next = detail.submissions.find((s) => !s.submitted_at && s.status !== 'submitted');
    if (!next) {
      setSnack({ msg: 'Ingen ledige målsteder å sende til', severity: 'info' });
      return;
    }
    try {
      await sendSubmission(next.id);
      await reloadDetail();
      setSnack({ msg: 'Self-tapen er sendt', severity: 'success' });
    } catch (err) {
      setSnack({
        msg: err instanceof Error ? `Send feilet: ${err.message}` : 'Send feilet',
        severity: 'error',
      });
    }
  }, [detail, reloadDetail]);

  const handleTakeMenu = useCallback((e: React.MouseEvent<HTMLElement>, take: SelftapeTake) => {
    setTakeMenuAnchor(e.currentTarget);
    setTakeMenuTake(take);
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: 1600, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: palette.textPrimary, lineHeight: 1.15 }}>
            Self-tape-studio
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem', mt: 0.6 }}>
            Spill inn, vurder og perfeksjoner din audition.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.2}>
          <Button
            onClick={() => setLibraryOpen(true)}
            startIcon={<FolderOutlinedIcon />}
            sx={{
              textTransform: 'none', fontWeight: 600, px: 2, py: 1, borderRadius: radius.sm,
              color: palette.textPrimary, border: `1px solid ${palette.borderStrong}`,
              '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
            }}
          >
            Prosjekt-bibliotek
          </Button>
          <Button
            onClick={() => setNewProjectOpen(true)}
            startIcon={<AddCircleOutlineIcon />}
            sx={{
              textTransform: 'none', fontWeight: 700, px: 2.4, py: 1, borderRadius: radius.sm,
              background: palette.accentGradient, color: '#fff',
              boxShadow: '0 4px 14px rgba(168,85,247,0.38)',
              '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
            }}
          >
            Nytt prosjekt
          </Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {loading && !detail ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={28} sx={{ color: palette.accentBright }} />
        </Box>
      ) : !detail ? (
        <Box
          sx={{
            bgcolor: palette.bgCard,
            border: `1px solid ${palette.border}`,
            borderRadius: radius.lg,
            p: 5,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 0.8 }}>
            Ingen prosjekter ennå
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem', mb: 2 }}>
            Klikk «Nytt prosjekt» for å begynne din første self-tape.
          </Typography>
          <Button
            onClick={() => setNewProjectOpen(true)}
            startIcon={<AddCircleOutlineIcon />}
            sx={{
              textTransform: 'none', fontWeight: 700, px: 2.4, py: 1, borderRadius: radius.sm,
              background: palette.accentGradient, color: '#fff',
              '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
            }}
          >
            Nytt prosjekt
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) 360px 320px' },
            alignItems: 'start',
          }}
        >
          {/* VENSTRE KOLONNE */}
          <Stack spacing={2}>
            <SelfTapeProjectInfoCard
              project={detail.project}
              onBriefClick={() => setScriptDialog('brief')}
            />
            <SelfTapeVideoPlayer
              take={currentTake}
              onRecordClick={() => setRecordOpen(true)}
              onUploadFile={handleUploadFile}
              onGuidesClick={() => setGuidesOpen(true)}
            />
            <SelfTapePreviousTakesStrip
              takes={detail.takes}
              currentTakeId={detail.project.current_take_id}
              onSelect={async () => { await reloadDetail(); }}
              onMoreClick={handleTakeMenu}
            />
            <SelfTapeStatusCards feedback={detail.feedback} />
          </Stack>

          {/* MIDTRE KOLONNE */}
          <Stack spacing={2}>
            <SelfTapeScriptCard
              sceneLabel={detail.project.scene_label}
              sidesPages={detail.project.sides_pages}
              sidesContent={detail.project.sides_content}
              onViewFullScript={() => setScriptDialog('script')}
            />
            <SelfTapeTakeManagement
              takes={detail.takes}
              currentTakeId={detail.project.current_take_id}
              onSelect={async () => { await reloadDetail(); }}
            />
            <SelfTapeAIFeedbackCard
              feedback={detail.feedback}
              currentTake={currentTake}
              onRegenerated={reloadDetail}
            />
          </Stack>

          {/* HØYRE KOLONNE */}
          <Stack spacing={2}>
            <SelfTapeSubmissionTargets
              submissions={detail.submissions}
              onChange={reloadDetail}
            />
            <SelfTapeAlmostReadyCard
              checklist={checklist}
              onSubmit={handleAlmostReadySubmit}
            />
            <SelfTapeSubmissionHistory entries={historyEntries} />
          </Stack>
        </Box>
      )}

      {/* Dialoger */}
      <ProjectLibraryDrawer
        open={libraryOpen}
        projects={projects}
        activeProjectId={activeProjectId}
        onClose={() => setLibraryOpen(false)}
        onSelect={(id) => setActiveProjectId(id)}
        onChanged={handleProjectChanged}
      />
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={handleNewProjectCreated}
      />
      <ScriptViewerDialog
        open={scriptDialog !== null}
        project={detail?.project ?? null}
        onClose={() => setScriptDialog(null)}
        variant={scriptDialog ?? 'script'}
      />
      <GuidesDrawer
        open={guidesOpen}
        onClose={() => setGuidesOpen(false)}
      />
      <RecordTakeDialog
        open={recordOpen}
        projectId={activeProjectId}
        onClose={() => setRecordOpen(false)}
        onUploaded={async () => {
          await reloadDetail();
          setSnack({ msg: 'Take lastet opp og klar', severity: 'success' });
        }}
      />
      <TakeActionsMenu
        anchorEl={takeMenuAnchor}
        take={takeMenuTake}
        isCurrent={takeMenuTake?.id === detail?.project.current_take_id}
        onClose={() => { setTakeMenuAnchor(null); setTakeMenuTake(null); }}
        onChanged={reloadDetail}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert
            onClose={() => setSnack(null)}
            severity={snack.severity}
            sx={{ width: '100%' }}
          >
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>

      {/* Demo-modus + projects-debug */}
      {demoMode && projects.length > 1 ? (
        <Box sx={{ mt: 3, color: palette.textMuted, fontSize: '0.78rem' }}>
          {projects.length} prosjekter tilgjengelig. Velg via «Prosjekt-bibliotek».
        </Box>
      ) : null}
    </Box>
  );
}
