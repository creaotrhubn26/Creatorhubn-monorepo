/**
 * CarouselPanel — top-level entry for the Website-to-Carousel feature.
 *
 * Three states:
 *   1. Empty — show URL prompt + "Generate this week" CTA
 *   2. Generating — loading spinner + progress message
 *   3. Ready — week overview + click-through to per-post editor
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CarouselWeekOverview from './CarouselWeekOverview';
import CarouselPostEditor from './CarouselPostEditor';
import {
  approveAndPublishPost,
  generateDraft,
  getDraft,
  patchSlide,
  patchPost,
  type CarouselDraftRow,
  type CarouselPostRow,
  type CarouselSlideRow,
  type CarouselPlatform,
} from '../../../../../services/carouselService';

type State =
  | { kind: 'empty' }
  | { kind: 'generating'; url: string; weekStarting: string }
  | { kind: 'ready'; draft: CarouselDraftRow; posts: CarouselPostRow[]; slides: CarouselSlideRow[] }
  | { kind: 'error'; message: string };

function nextMondayISO(): string {
  const today = new Date();
  const day = today.getDay(); // 0 Sun..6 Sat
  const offset = day === 0 ? 1 : 8 - day;
  today.setDate(today.getDate() + offset);
  return today.toISOString().slice(0, 10);
}

interface CarouselPanelProps {
  projectId?: string | null;
}

export default function CarouselPanel({ projectId }: CarouselPanelProps = {}) {
  const [state, setState] = useState<State>({ kind: 'empty' });
  const [url, setUrl] = useState('https://');
  const [weekStarting, setWeekStarting] = useState(nextMondayISO());
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [approveBusyPostId, setApproveBusyPostId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const refreshDraft = useCallback(async (draftId: string) => {
    const data = await getDraft(draftId);
    setState({
      kind: 'ready',
      draft: data.draft,
      posts: data.posts,
      slides: data.slides,
    });
  }, []);

  async function handleGenerate() {
    if (!/^https?:\/\/.+\..+/.test(url)) {
      setState({
        kind: 'error',
        message: 'Limt inn en gyldig URL (med https:// foran)',
      });
      return;
    }
    setState({ kind: 'generating', url, weekStarting });
    try {
      const { draft } = await generateDraft(url, weekStarting);
      await refreshDraft(draft.id);
    } catch (err) {
      setState({
        kind: 'error',
        message: (err as Error).message,
      });
    }
  }

  // Debounced persistence — coalesce rapid edits into a single PATCH
  // call after 1.2s of inactivity per (entity-id + field).
  const slidePatchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const captionPatchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingSlideEdits = useRef<Map<string, Partial<CarouselSlideRow>>>(new Map());
  const pendingPostEdits = useRef<Map<string, Record<CarouselPlatform, string>>>(new Map());

  function handleSlidePatch(slideId: string, patch: Partial<CarouselSlideRow>) {
    // Optimistic local update
    setState((prev) => {
      if (prev.kind !== 'ready') return prev;
      return {
        ...prev,
        slides: prev.slides.map((s) => (s.id === slideId ? { ...s, ...patch } : s)),
      };
    });

    // Coalesce edits into pending queue
    const existing = pendingSlideEdits.current.get(slideId) ?? {};
    pendingSlideEdits.current.set(slideId, { ...existing, ...patch });

    const previous = slidePatchTimers.current.get(slideId);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      const queued = pendingSlideEdits.current.get(slideId);
      if (!queued) return;
      pendingSlideEdits.current.delete(slideId);
      slidePatchTimers.current.delete(slideId);
      patchSlide(slideId, {
        textBlocks: queued.text_blocks,
        layout: queued.layout,
        imageRef: queued.image_ref,
      }).catch((err) => {
        console.error('[CarouselPanel] slide patch failed', err);
      });
    }, 1200);
    slidePatchTimers.current.set(slideId, timer);
  }

  function handleCaptionPatch(postId: string, platform: CarouselPlatform, value: string) {
    // Optimistic local update
    let nextCaption: Record<CarouselPlatform, string> | null = null;
    setState((prev) => {
      if (prev.kind !== 'ready') return prev;
      return {
        ...prev,
        posts: prev.posts.map((p) => {
          if (p.id !== postId) return p;
          const merged = { ...p.caption, [platform]: value };
          nextCaption = merged;
          return { ...p, caption: merged };
        }),
      };
    });
    if (nextCaption) {
      pendingPostEdits.current.set(postId, nextCaption);
    }

    const previous = captionPatchTimers.current.get(postId);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      const queued = pendingPostEdits.current.get(postId);
      if (!queued) return;
      pendingPostEdits.current.delete(postId);
      captionPatchTimers.current.delete(postId);
      patchPost(postId, { caption: queued }).catch((err) => {
        console.error('[CarouselPanel] caption patch failed', err);
      });
    }, 1200);
    captionPatchTimers.current.set(postId, timer);
  }

  function handleSchedulePatch(postId: string, scheduledAt: string | null) {
    setState((prev) => {
      if (prev.kind !== 'ready') return prev;
      return {
        ...prev,
        posts: prev.posts.map((p) =>
          p.id === postId ? { ...p, scheduled_at: scheduledAt } : p,
        ),
      };
    });
    patchPost(postId, { scheduledAt }).catch((err) => {
      console.error('[CarouselPanel] schedule patch failed', err);
      setToast({ kind: 'error', message: 'Kunne ikke lagre tidspunkt' });
    });
  }

  async function handleApprovePublish(postId: string) {
    if (!projectId) {
      setToast({
        kind: 'error',
        message: 'Velg et prosjekt før du publiserer (Role Room → prosjektliste).',
      });
      return;
    }
    setApproveBusyPostId(postId);
    try {
      const post = state.kind === 'ready' ? state.posts.find((p) => p.id === postId) : null;
      const { result } = await approveAndPublishPost(postId, {
        projectId,
        scheduledAt: post?.scheduled_at ?? undefined,
      });
      if (state.kind === 'ready') {
        await refreshDraft(state.draft.id);
      }
      const warnings = result.validationWarnings ?? [];
      setToast({
        kind: 'success',
        message: warnings.length
          ? `Sendt til Feed Planner med ${warnings.length} advarsel(er): ${warnings.join('; ')}`
          : 'Sendt til Feed Planner!',
      });
      setEditingPostId(null);
    } catch (err) {
      setToast({
        kind: 'error',
        message: (err as Error).message || 'Kunne ikke publisere',
      });
    } finally {
      setApproveBusyPostId(null);
    }
  }

  // Auto-load most recent draft if any
  useEffect(() => {
    void (async () => {
      try {
        const { listDrafts } = await import('../../../../../services/carouselService');
        const { drafts } = await listDrafts();
        const latest = drafts.find((d) => d.status === 'ready');
        if (latest) {
          await refreshDraft(latest.id);
        }
      } catch {
        // Ignore — user may not have drafts yet
      }
    })();
  }, [refreshDraft]);

  if (state.kind === 'empty' || state.kind === 'error') {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Card
          variant="outlined"
          sx={{ p: 4, bgcolor: 'rgba(15,23,42,0.5)', borderColor: 'rgba(168,85,247,0.22)' }}
        >
          <Stack spacing={2.5}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <AutoAwesomeIcon sx={{ color: '#c084fc' }} />
              <Typography variant="h6" sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                Lag 1 ukes innhold fra én URL
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.7)' }}>
              Lim inn nettsiden din eller en kunde-side. Vi henter brand-profil, lager 7 ferdige
              innlegg (humor, lærerikt, bak kulissene, kundehistorie, tilbud, sesong, innsikt) og
              klargjør caption per plattform.
            </Typography>
            {state.kind === 'error' && (
              <Alert severity="error">{state.message}</Alert>
            )}
            <TextField
              fullWidth
              label="Nettside-URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://holycrust.no"
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#e2e8f0',
                  '& fieldset': { borderColor: 'rgba(168,85,247,0.22)' },
                },
              }}
            />
            <TextField
              fullWidth
              label="Ukestart (mandag)"
              type="date"
              value={weekStarting}
              onChange={(e) => setWeekStarting(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#e2e8f0',
                  '& fieldset': { borderColor: 'rgba(168,85,247,0.22)' },
                },
              }}
            />
            <Button
              variant="contained"
              size="large"
              onClick={handleGenerate}
              startIcon={<AutoAwesomeIcon />}
              sx={{
                bgcolor: '#a855f7',
                '&:hover': { bgcolor: '#9333ea' },
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Generér 1 ukes innhold
            </Button>
          </Stack>
        </Card>
      </Box>
    );
  }

  if (state.kind === 'generating') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress sx={{ color: '#c084fc' }} />
          <Typography sx={{ color: '#e2e8f0' }}>
            Analyserer {state.url} + lager 7 konsepter…
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.65)' }}>
            Kan ta opptil 60 sekunder første gang
          </Typography>
        </Stack>
      </Box>
    );
  }

  // state.kind === 'ready'
  if (editingPostId) {
    const post = state.posts.find((p) => p.id === editingPostId);
    const slides = state.slides.filter((s) => s.post_id === editingPostId);
    if (post) {
      return (
        <>
          <CarouselPostEditor
            post={post}
            slides={slides}
            onBack={() => setEditingPostId(null)}
            onSlidePatch={handleSlidePatch}
            onCaptionPatch={handleCaptionPatch}
            onApprovePublish={handleApprovePublish}
            onSchedulePatch={handleSchedulePatch}
            approveBusy={approveBusyPostId === post.id}
          />
          <Snackbar
            open={!!toast}
            autoHideDuration={6000}
            onClose={() => setToast(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            {toast ? (
              <Alert
                onClose={() => setToast(null)}
                severity={toast.kind}
                sx={{ width: '100%' }}
              >
                {toast.message}
              </Alert>
            ) : undefined}
          </Snackbar>
        </>
      );
    }
  }

  return (
    <Stack spacing={2}>
      <CarouselWeekOverview
        draft={state.draft}
        posts={state.posts}
        onSelectPost={setEditingPostId}
      />
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setState({ kind: 'empty' })}
          sx={{
            color: '#c084fc',
            borderColor: 'rgba(168,85,247,0.45)',
            textTransform: 'none',
          }}
        >
          Generér ny uke
        </Button>
      </Stack>
      <Snackbar
        open={!!toast}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert onClose={() => setToast(null)} severity={toast.kind} sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Stack>
  );
}
