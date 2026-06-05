/**
 * SelfTapeStudioPage.tsx — Self-Tape Studio (Fase B av spec)
 *
 * 3-kolonne layout (matcher mockup #15):
 *   Venstre: project-info + video-player + record/upload + previous takes
 *   Midten: script + take management + AI feedback
 *   Høyre: submission targets + almost-ready + history
 *
 * Spec: docs/specs/SELF_TAPE_STUDIO_SPEC.md
 */

import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
  type ProjectDetail,
  type SelftapeProject,
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

  // Last project-listen ved mount
  useEffect(() => {
    let cancelled = false;
    listProjects()
      .then(({ projects }) => {
        if (cancelled) return;
        setProjects(projects);
        // Velg første active prosjekt
        const active = projects.find((p) => p.status === 'active') ?? projects[0];
        setActiveProjectId(active?.id ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Klarte ikke å hente prosjekter');
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  // Avled history-entries fra submissions (Fase B: viser status-progresjon)
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
            startIcon={<FolderOutlinedIcon />}
            disabled
            sx={{
              textTransform: 'none', fontWeight: 600, px: 2, py: 1, borderRadius: radius.sm,
              color: palette.textPrimary, border: `1px solid ${palette.borderStrong}`,
              '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
            }}
          >
            Prosjekt-bibliotek
          </Button>
          <Button
            startIcon={<AddCircleOutlineIcon />}
            disabled
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
          <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem' }}>
            Klikk «Nytt prosjekt» for å begynne din første self-tape.
          </Typography>
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
          {/* VENSTRE KOLONNE — video + actions + takes + status */}
          <Stack spacing={2}>
            <SelfTapeProjectInfoCard project={detail.project} />
            <SelfTapeVideoPlayer take={currentTake} />
            <SelfTapePreviousTakesStrip
              takes={detail.takes}
              currentTakeId={detail.project.current_take_id}
              onSelect={async () => { await reloadDetail(); }}
            />
            <SelfTapeStatusCards feedback={detail.feedback} />
          </Stack>

          {/* MIDTRE KOLONNE — script + take mgmt + AI feedback */}
          <Stack spacing={2}>
            <SelfTapeScriptCard
              sceneLabel={detail.project.scene_label}
              sidesPages={detail.project.sides_pages}
              sidesContent={detail.project.sides_content}
            />
            <SelfTapeTakeManagement
              takes={detail.takes}
              currentTakeId={detail.project.current_take_id}
              onSelect={async () => { await reloadDetail(); }}
            />
            <SelfTapeAIFeedbackCard feedback={detail.feedback} />
          </Stack>

          {/* HØYRE KOLONNE — submissions + almost ready + history */}
          <Stack spacing={2}>
            <SelfTapeSubmissionTargets
              submissions={detail.submissions}
              onChange={reloadDetail}
            />
            <SelfTapeAlmostReadyCard
              checklist={checklist}
              onSubmit={async () => {
                // Send første ikke-sendte target
                const next = detail.submissions.find(
                  (s) => !s.submitted_at && s.status !== 'submitted',
                );
                if (next) {
                  try {
                    const { sendSubmission } = await import(
                      '../../services/roleRoomSelfTapesService'
                    );
                    await sendSubmission(next.id);
                    await reloadDetail();
                  } catch (err) {
                    console.error('AlmostReady onSubmit failed', err);
                  }
                }
              }}
            />
            <SelfTapeSubmissionHistory entries={historyEntries} />
          </Stack>
        </Box>
      )}
      {/* Demo-modus + projects-state debugging — kun i dev */}
      {demoMode && projects.length > 1 ? (
        <Box sx={{ mt: 3, color: palette.textMuted, fontSize: '0.78rem' }}>
          {projects.length} prosjekter tilgjengelig. Velg via «Prosjekt-bibliotek».
        </Box>
      ) : null}
    </Box>
  );
}
