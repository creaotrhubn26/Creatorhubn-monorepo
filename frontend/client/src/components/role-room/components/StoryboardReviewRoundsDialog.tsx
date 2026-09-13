import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { StoryboardSkillContext } from '@shared/storyboard-skills';
import type {
  StoryboardReviewAccessMode,
  StoryboardReviewComment,
  StoryboardReviewDiff,
  StoryboardReviewInboxItem,
  StoryboardReviewRound,
} from '@shared/storyboard-review';
import {
  createStoryboardReviewRound,
  createStoryboardReviewShareLink,
  getStoryboardReviewDiff,
  getStoryboardReviewInbox,
  getStoryboardReviewRound,
  listStoryboardReviewRounds,
  markAllStoryboardReviewNotificationsRead,
  markStoryboardReviewNotificationRead,
  restoreStoryboardReviewRound,
  revokeStoryboardReviewShareLink,
  updateStoryboardReviewComment,
} from '../services/storyboardReviewService';
import { StoryboardReviewMarkupCanvas } from './StoryboardReviewMarkupCanvas';

type RevisionBaseline = NonNullable<StoryboardSkillContext['revisionBaseline']>;

const statusLabel: Record<string, string> = {
  in_review: 'Til review',
  changes_requested: 'Endringer ønsket',
  approved: 'Godkjent',
  superseded: 'Erstattet',
};

type CommentDraft = {
  assignedTo: string;
  dueAt: string;
  resolutionNote: string;
  resolvedInRoundId: string;
};

const dateTimeLocal = (value?: string | null) => value ? value.slice(0, 16) : '';

const draftFor = (comment: StoryboardReviewComment): CommentDraft => ({
  assignedTo: comment.assignedTo ?? '',
  dueAt: dateTimeLocal(comment.dueAt),
  resolutionNote: comment.resolutionNote ?? '',
  resolvedInRoundId: comment.resolvedInRoundId ?? '',
});

export const StoryboardReviewRoundsDialog: React.FC<{
  open: boolean;
  projectId: string;
  manuscriptId: string;
  sceneId: string;
  onClose: () => void;
  onBaselineChange?: (baseline: RevisionBaseline | undefined) => void;
}> = ({ open, projectId, manuscriptId, sceneId, onClose, onBaselineChange }) => {
  const [rounds, setRounds] = useState<StoryboardReviewRound[]>([]);
  const [inbox, setInbox] = useState<StoryboardReviewInboxItem[]>([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showOpenCommentsOnly, setShowOpenCommentsOnly] = useState(true);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, CommentDraft>>({});
  const [selectedId, setSelectedId] = useState<string>('');
  const [detail, setDetail] = useState<StoryboardReviewRound | null>(null);
  const [diff, setDiff] = useState<StoryboardReviewDiff | null>(null);
  const [label, setLabel] = useState('Storyboard review');
  const [summary, setSummary] = useState('');
  const [accessMode, setAccessMode] = useState<StoryboardReviewAccessMode>('approve');
  const [requireIdentity, setRequireIdentity] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState('14');
  const [createdUrl, setCreatedUrl] = useState('');
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshList = useCallback(async (preferId?: string) => {
    const data = await listStoryboardReviewRounds(projectId, manuscriptId);
    setRounds(data);
    setSelectedId(preferId || data[0]?.id || '');
  }, [manuscriptId, projectId]);

  const refreshInbox = useCallback(async () => {
    const data = await getStoryboardReviewInbox(projectId, manuscriptId);
    setInbox(data.items);
  }, [manuscriptId, projectId]);

  useEffect(() => {
    if (!open || !projectId || !manuscriptId) return;
    setError(null);
    void Promise.all([refreshList(), refreshInbox()]).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Kunne ikke hente review-runder.');
    });
  }, [manuscriptId, open, projectId, refreshInbox, refreshList]);

  useEffect(() => {
    if (!open || !projectId || !manuscriptId) return;
    const interval = window.setInterval(() => {
      if (navigator.onLine === false) return;
      void refreshInbox().catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [manuscriptId, open, projectId, refreshInbox]);

  useEffect(() => {
    if (!open) return;
    if (!selectedId) {
      setDetail(null);
      setDiff(null);
      onBaselineChange?.(undefined);
      return;
    }
    let active = true;
    setBusy(true);
    Promise.all([
      getStoryboardReviewRound(projectId, manuscriptId, selectedId),
      getStoryboardReviewDiff(projectId, manuscriptId, selectedId),
    ]).then(([nextDetail, nextDiff]) => {
      if (!active) return;
      setDetail(nextDetail);
      setCommentDrafts(Object.fromEntries((nextDetail.comments ?? []).map((comment) => [comment.id, draftFor(comment)])));
      setDiff(nextDiff);
      const snapshotScene = nextDetail.snapshot?.scenes.find((entry) => entry.id === sceneId);
      if (snapshotScene) {
        onBaselineChange?.({
          snapshotHash: nextDetail.snapshotHash,
          scene: {
            id: snapshotScene.id,
            heading: snapshotScene.heading,
            action: snapshotScene.description,
            dialogue: (nextDetail.snapshot?.dialogue ?? [])
              .filter((line) => !line.sceneId || line.sceneId === sceneId)
              .map((line) => ({
                lineNumber: line.lineNumber,
                characterName: line.characterName,
                text: line.text,
              })),
          },
          frames: snapshotScene.storyboardFrames.map((frame) => ({
            ...frame,
            id: frame.id,
            shotNumber: String(frame.shotNumber ?? ''),
            description: String(frame.description ?? ''),
          })) as RevisionBaseline['frames'],
        });
      } else {
        onBaselineChange?.(undefined);
      }
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Kunne ikke åpne review-runden.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [manuscriptId, onBaselineChange, open, projectId, sceneId, selectedId]);

  const changeCount = useMemo(() => diff
    ? diff.addedFrameIds.length + diff.removedFrameIds.length
      + diff.changedFrameIds.length + diff.movedFrameIds.length
    : 0, [diff]);

  const createRound = async () => {
    setBusy(true); setError(null); setMessage(null); setCreatedUrl('');
    try {
      const created = await createStoryboardReviewRound(projectId, manuscriptId, { label, summary: summary || undefined });
      await Promise.all([refreshList(created.id), refreshInbox()]);
      setMessage(`Review-runde v${created.version} er låst til hash ${created.snapshotHash.slice(0, 10)}…${created.carriedCommentCount ? ` ${created.carriedCommentCount} åpne punkt ble videreført.` : ''}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Kunne ikke opprette review-runden.');
    } finally { setBusy(false); }
  };

  const openInboxItem = async (item: StoryboardReviewInboxItem) => {
    setSelectedId(item.reviewRoundId);
    setBusy(true); setError(null);
    try {
      const nextDetail = await getStoryboardReviewRound(projectId, manuscriptId, item.reviewRoundId);
      setDetail(nextDetail);
      setCommentDrafts(Object.fromEntries((nextDetail.comments ?? []).map((comment) => [comment.id, draftFor(comment)])));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Kunne ikke hente review-punktene.');
    } finally {
      setBusy(false);
    }
    if (item.read) return;
    setInbox((current) => current.map((entry) => entry.id === item.id
      ? { ...entry, read: true, readAt: new Date().toISOString() }
      : entry));
    try {
      await markStoryboardReviewNotificationRead(projectId, manuscriptId, item.id);
    } catch (readError) {
      setInbox((current) => current.map((entry) => entry.id === item.id
        ? { ...entry, read: false, readAt: null }
        : entry));
      setError(readError instanceof Error ? readError.message : 'Kunne ikke markere varselet som lest.');
    }
  };

  const markAllInboxRead = async () => {
    setBusy(true); setError(null);
    try {
      await markAllStoryboardReviewNotificationsRead(projectId, manuscriptId);
      const readAt = new Date().toISOString();
      setInbox((current) => current.map((entry) => ({ ...entry, read: true, readAt })));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'Kunne ikke markere alle som lest.');
    } finally { setBusy(false); }
  };

  const unreadCount = inbox.filter((item) => !item.read).length;
  const visibleInbox = showUnreadOnly ? inbox.filter((item) => !item.read) : inbox;

  const createShare = async () => {
    if (!detail) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const days = Math.max(1, Math.min(90, Number(expiresInDays) || 14));
      const share = await createStoryboardReviewShareLink(projectId, manuscriptId, detail.id, {
        accessMode,
        requireIdentity,
        expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
      });
      const url = `${window.location.origin}/storyboard-review/${share.token}`;
      setCreatedUrl(url);
      await navigator.clipboard?.writeText(url).catch(() => undefined);
      const next = await getStoryboardReviewRound(projectId, manuscriptId, detail.id);
      setDetail(next);
      setMessage('Sikker review-lenke er opprettet og kopiert. Tokenet vises bare nå.');
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Kunne ikke opprette lenken.');
    } finally { setBusy(false); }
  };

  const revokeShare = async (shareId: string) => {
    if (!detail) return;
    setBusy(true); setError(null);
    try {
      await revokeStoryboardReviewShareLink(projectId, manuscriptId, detail.id, shareId);
      setDetail(await getStoryboardReviewRound(projectId, manuscriptId, detail.id));
      setMessage('Review-lenken er tilbakekalt.');
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Kunne ikke tilbakekalle lenken.');
    } finally { setBusy(false); }
  };

  const restore = async () => {
    if (!detail || !diff || restoreConfirmation !== detail.snapshotHash.slice(0, 8)) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await restoreStoryboardReviewRound(projectId, manuscriptId, detail.id, {
        confirmSnapshotHash: detail.snapshotHash,
        expectedCurrentHash: diff.currentHash,
      });
      setRestoreConfirmation('');
      setMessage(`Storyboardfeltene i ${result.restoredSceneIds.length} scener er gjenopprettet. Manus- og produksjonsdata er bevart.${result.skippedSceneIds.length ? ` ${result.skippedSceneIds.length} slettede scener ble hoppet over.` : ''}`);
      setDiff(await getStoryboardReviewDiff(projectId, manuscriptId, detail.id));
      window.dispatchEvent(new CustomEvent('storyboard-review-restored', { detail: result }));
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Kunne ikke gjenopprette revisjonen.');
    } finally { setBusy(false); }
  };

  const patchComment = async (
    comment: StoryboardReviewComment,
    patch: Parameters<typeof updateStoryboardReviewComment>[4],
  ) => {
    if (!detail) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const updated = await updateStoryboardReviewComment(
        projectId, manuscriptId, detail.id, comment.id, patch,
      );
      setDetail((current) => current ? {
        ...current,
        comments: (current.comments ?? []).map((entry) => entry.id === updated.id ? updated : entry),
      } : current);
      setCommentDrafts((current) => ({
        ...current,
        [updated.id]: patch.status
          ? draftFor(updated)
          : { ...draftFor(updated), ...(current[updated.id] ?? {}) },
      }));
      if (patch.status) {
        setMessage(patch.status === 'resolved' ? 'Review-punktet er markert som løst.' : 'Review-punktet er gjenåpnet.');
        await refreshInbox();
      }
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : 'Kunne ikke oppdatere review-punktet.');
    } finally { setBusy(false); }
  };

  const updateDraft = (commentId: string, patch: Partial<CommentDraft>) => {
    setCommentDrafts((current) => ({
      ...current,
      [commentId]: { ...(current[commentId] ?? { assignedTo: '', dueAt: '', resolutionNote: '', resolvedInRoundId: '' }), ...patch },
    }));
  };

  const visibleComments = useMemo(() => {
    const comments = detail?.comments ?? [];
    return comments
      .filter((comment) => !showOpenCommentsOnly || comment.status === 'open')
      .sort((left, right) => {
        if (left.status !== right.status) return left.status === 'open' ? -1 : 1;
        return (left.dueAt || '9999').localeCompare(right.dueAt || '9999');
      });
  }, [detail?.comments, showOpenCommentsOnly]);
  const detailFrames = useMemo(() => new Map(
    (detail?.snapshot?.scenes ?? []).flatMap((scene) => scene.storyboardFrames)
      .map((frame) => [frame.id, frame] as const),
  ), [detail?.snapshot?.scenes]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth data-testid="storyboard-review-rounds-dialog">
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <span>Review-runder og revisjonsvakt</span>
          <Badge color="error" badgeContent={unreadCount} max={99}>
            <Chip
              size="small"
              label={unreadCount ? `${unreadCount} ulest` : 'Alt lest'}
              color={unreadCount ? 'warning' : 'success'}
              variant="outlined"
              data-testid="storyboard-review-inbox-count"
            />
          </Badge>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error.replaceAll('_', ' ')}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}
          {!projectId || !manuscriptId ? (
            <Alert severity="warning">Prosjekt- og manuskript-ID mangler. Åpne storyboardet fra et lagret manuskript.</Alert>
          ) : (
            <>
              <Box
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}
                data-testid="storyboard-review-inbox"
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1} mb={1}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>Review-innboks</Typography>
                    <Typography variant="caption" color="text.secondary">Kommentarer, godkjenninger og nye låste revisjoner.</Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant={showUnreadOnly ? 'contained' : 'outlined'}
                      onClick={() => setShowUnreadOnly((current) => !current)}
                      data-testid="storyboard-review-inbox-unread-filter"
                    >
                      {showUnreadOnly ? 'Vis alle' : 'Bare uleste'}
                    </Button>
                    <Button size="small" onClick={markAllInboxRead} disabled={busy || unreadCount === 0} data-testid="storyboard-review-inbox-read-all">
                      Merk alle lest
                    </Button>
                  </Stack>
                </Stack>
                <Stack spacing={0.75} sx={{ maxHeight: 230, overflowY: 'auto' }}>
                  {visibleInbox.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" data-testid="storyboard-review-inbox-empty">
                      {showUnreadOnly ? 'Ingen uleste review-hendelser.' : 'Ingen review-hendelser ennå.'}
                    </Typography>
                  ) : visibleInbox.map((item) => (
                    <Button
                      key={item.id}
                      variant={item.read ? 'text' : 'outlined'}
                      color={item.decision === 'approved' ? 'success' : item.decision === 'changes_requested' ? 'warning' : 'inherit'}
                      onClick={() => void openInboxItem(item)}
                      data-testid={`storyboard-review-inbox-item-${item.eventType}`}
                      sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', py: 1 }}
                    >
                      <Stack direction="row" spacing={1} alignItems="flex-start" width="100%">
                        {!item.read && <Box aria-label="Ulest" sx={{ width: 8, height: 8, mt: 0.75, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} />}
                        <Box flex={1} minWidth={0}>
                          <Typography variant="body2" fontWeight={item.read ? 500 : 800}>{item.title}</Typography>
                          {item.message && <Typography variant="caption" color="text.secondary" display="block" noWrap>{item.message}</Typography>}
                        </Box>
                        <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">v{item.roundVersion}</Typography>
                      </Stack>
                    </Button>
                  ))}
                </Stack>
              </Box>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField label="Navn på runden" value={label} onChange={(event) => setLabel(event.target.value)} fullWidth />
                <TextField label="Kort beskjed" value={summary} onChange={(event) => setSummary(event.target.value)} fullWidth />
                <Button variant="contained" onClick={createRound} disabled={busy || !label.trim()} data-testid="create-storyboard-review-round">
                  Send til review
                </Button>
              </Stack>

              <Divider />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
                <Stack spacing={1} sx={{ width: { xs: '100%', md: 260 }, flexShrink: 0 }}>
                  <Typography variant="subtitle2">Revisjoner</Typography>
                  {rounds.length === 0 && <Typography variant="body2" color="text.secondary">Ingen serverlagrede review-runder ennå.</Typography>}
                  {rounds.map((round) => (
                    <Button
                      key={round.id}
                      variant={selectedId === round.id ? 'contained' : 'outlined'}
                      onClick={() => { setSelectedId(round.id); setCreatedUrl(''); setRestoreConfirmation(''); }}
                      data-testid={`storyboard-review-round-${round.version}`}
                      sx={{ justifyContent: 'space-between' }}
                    >
                      v{round.version} · {round.label}
                      <Chip size="small" label={statusLabel[round.status] || round.status} />
                    </Button>
                  ))}
                </Stack>

                <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
                  {busy && !detail ? <CircularProgress size={28} /> : detail && (
                    <>
                      <Box>
                        <Typography variant="h6">v{detail.version} · {detail.label}</Typography>
                        <Typography variant="body2" color="text.secondary">{detail.frameCount} shots · {detail.totalDurationSeconds.toFixed(1)} sek · hash {detail.snapshotHash.slice(0, 12)}…</Typography>
                      </Box>
                      {diff && (
                        <Alert severity={changeCount || diff.scriptChanged ? 'warning' : 'success'} data-testid="storyboard-review-diff">
                          {changeCount
                            ? `${changeCount} storyboardendringer siden denne revisjonen: ${diff.addedFrameIds.length} nye, ${diff.removedFrameIds.length} fjernet, ${diff.changedFrameIds.length} endret, ${diff.movedFrameIds.length} flyttet.`
                            : 'Arbeidskopien samsvarer med denne revisjonen.'}
                          {diff.scriptChanged ? ` Manus er endret; ${diff.impactedScriptLineRanges.length} koblede linjeområder må vurderes.` : ''}
                        </Alert>
                      )}

                      <Box
                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}
                        data-testid="storyboard-review-resolution-queue"
                      >
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} mb={1.25}>
                          <Box>
                            <Typography variant="subtitle1" fontWeight={750}>Løsningskø</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {(detail.comments ?? []).filter((entry) => entry.status === 'open').length} åpne av {(detail.comments ?? []).length} punkt
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            variant={showOpenCommentsOnly ? 'contained' : 'outlined'}
                            onClick={() => setShowOpenCommentsOnly((current) => !current)}
                            data-testid="storyboard-review-open-comment-filter"
                          >
                            {showOpenCommentsOnly ? 'Vis alle punkt' : 'Bare åpne punkt'}
                          </Button>
                        </Stack>
                        {visibleComments.length === 0 ? (
                          <Typography variant="body2" color="text.secondary" data-testid="storyboard-review-resolution-empty">
                            {showOpenCommentsOnly && (detail.comments ?? []).length ? 'Alle review-punkt er løst.' : 'Ingen kommentarer i denne revisjonen.'}
                          </Typography>
                        ) : (
                          <Stack spacing={1.25}>
                            {visibleComments.map((comment) => {
                              const draft = commentDrafts[comment.id] ?? draftFor(comment);
                              const frame = comment.frameId ? detailFrames.get(comment.frameId) : undefined;
                              const hasVisualMarkup = comment.anchorX != null
                                || comment.anchorY != null
                                || (comment.annotations?.length ?? 0) > 0;
                              return (
                                <Box
                                  key={comment.id}
                                  sx={{ border: '1px solid', borderColor: comment.status === 'open' ? 'warning.main' : 'success.main', borderRadius: 1.5, p: 1.25 }}
                                  data-testid={`storyboard-review-resolution-comment-${comment.id}`}
                                >
                                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <Chip size="small" color={comment.status === 'open' ? 'warning' : 'success'} label={comment.status === 'open' ? 'Åpent' : 'Løst'} />
                                    {comment.frameId && <Chip size="small" variant="outlined" label={`Shot ${comment.frameId}`} />}
                                    {comment.carriedFromCommentId && <Chip size="small" variant="outlined" label="Videreført" />}
                                    <Typography variant="caption" color="text.secondary">{comment.authorDisplayName}</Typography>
                                  </Stack>
                                  <Typography variant="body2" sx={{ my: 1 }}>{comment.body}</Typography>
                                  {frame && hasVisualMarkup && (
                                    <Box sx={{ maxWidth: 420, mb: 1.25 }} data-testid={`storyboard-review-manager-markup-${comment.id}`}>
                                      <StoryboardReviewMarkupCanvas
                                        frame={frame}
                                        comments={[comment]}
                                        activeCommentId={comment.id}
                                        showMarkup
                                      />
                                    </Box>
                                  )}
                                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                                    <TextField
                                      size="small"
                                      label="Ansvarlig"
                                      value={draft.assignedTo}
                                      onChange={(event) => updateDraft(comment.id, { assignedTo: event.target.value })}
                                      onBlur={() => {
                                        const value = draft.assignedTo.trim() || null;
                                        if (value !== (comment.assignedTo ?? null)) void patchComment(comment, { assignedTo: value });
                                      }}
                                      inputProps={{ 'data-testid': `storyboard-review-assignee-${comment.id}` }}
                                      sx={{ flex: 1 }}
                                    />
                                    <TextField
                                      size="small"
                                      label="Frist"
                                      type="datetime-local"
                                      value={draft.dueAt}
                                      onChange={(event) => updateDraft(comment.id, { dueAt: event.target.value })}
                                      onBlur={() => {
                                        const value = draft.dueAt ? new Date(draft.dueAt).toISOString() : null;
                                        if (value !== (comment.dueAt ?? null)) void patchComment(comment, { dueAt: value });
                                      }}
                                      slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': `storyboard-review-due-${comment.id}` } }}
                                      sx={{ minWidth: 210 }}
                                    />
                                  </Stack>
                                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} mt={1}>
                                    <TextField
                                      size="small"
                                      label="Løsningsnotat"
                                      value={draft.resolutionNote}
                                      onChange={(event) => updateDraft(comment.id, { resolutionNote: event.target.value })}
                                      multiline
                                      maxRows={3}
                                      inputProps={{ 'data-testid': `storyboard-review-resolution-note-${comment.id}` }}
                                      sx={{ flex: 1 }}
                                    />
                                    <TextField
                                      select
                                      size="small"
                                      label="Rettet i revisjon"
                                      value={draft.resolvedInRoundId}
                                      onChange={(event) => updateDraft(comment.id, { resolvedInRoundId: event.target.value })}
                                      sx={{ minWidth: 190 }}
                                      inputProps={{ 'data-testid': `storyboard-review-fixed-in-${comment.id}` }}
                                    >
                                      <MenuItem value="">Ikke angitt</MenuItem>
                                      {rounds.map((round) => <MenuItem key={round.id} value={round.id}>v{round.version} · {round.label}</MenuItem>)}
                                    </TextField>
                                    <Button
                                      variant={comment.status === 'open' ? 'contained' : 'outlined'}
                                      color={comment.status === 'open' ? 'success' : 'warning'}
                                      disabled={busy}
                                      onClick={() => void patchComment(comment, comment.status === 'open' ? {
                                        status: 'resolved',
                                        resolutionNote: draft.resolutionNote.trim() || null,
                                        resolvedInRoundId: draft.resolvedInRoundId || null,
                                      } : { status: 'open' })}
                                      data-testid={`storyboard-review-${comment.status === 'open' ? 'resolve' : 'reopen'}-${comment.id}`}
                                    >
                                      {comment.status === 'open' ? 'Marker løst' : 'Gjenåpne'}
                                    </Button>
                                  </Stack>
                                </Box>
                              );
                            })}
                          </Stack>
                        )}
                      </Box>

                      <Stack spacing={1}>
                        <Typography variant="subtitle2">Del låst revisjon</Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <TextField select label="Tilgang" value={accessMode} onChange={(event) => setAccessMode(event.target.value as StoryboardReviewAccessMode)} sx={{ minWidth: 180 }}>
                            <MenuItem value="view">Bare visning</MenuItem>
                            <MenuItem value="comment">Kommentarer</MenuItem>
                            <MenuItem value="approve">Kommentarer og sign-off</MenuItem>
                          </TextField>
                          <TextField label="Utløper om dager" type="number" value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} sx={{ width: 170 }} />
                          <FormControlLabel control={<Switch checked={requireIdentity} onChange={(event) => setRequireIdentity(event.target.checked)} />} label="Krev navn" />
                          <Button variant="outlined" onClick={createShare} disabled={busy || detail.status === 'superseded'} data-testid="create-storyboard-review-link">Opprett lenke</Button>
                        </Stack>
                        {createdUrl && (
                          <TextField value={createdUrl} fullWidth slotProps={{ input: { readOnly: true } }} data-testid="storyboard-review-created-url" />
                        )}
                        {(detail.shareLinks ?? []).filter((link) => !link.revokedAt).map((link) => (
                          <Stack key={link.id} direction="row" alignItems="center" spacing={1}>
                            <Chip label={`${link.accessMode} · ${link.requireIdentity ? 'navn kreves' : 'uten navn'}`} />
                            <Typography variant="caption" color="text.secondary">Token skjult</Typography>
                            <Button size="small" color="error" onClick={() => revokeShare(link.id)}>Tilbakekall</Button>
                          </Stack>
                        ))}
                      </Stack>

                      <Divider />
                      <Stack spacing={1}>
                        <Typography variant="subtitle2">Sikker gjenoppretting</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Bare storyboardfeltene gjenopprettes. Nyere manus, casting, lokasjon og produksjonsdata beholdes. Hvis arbeidskopien endres etter at denne diffen ble lest, avbryter serveren operasjonen.
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <TextField
                            label={`Skriv ${detail.snapshotHash.slice(0, 8)} for å bekrefte`}
                            value={restoreConfirmation}
                            onChange={(event) => setRestoreConfirmation(event.target.value.trim().toLowerCase())}
                            size="small"
                          />
                          <Button color="warning" variant="outlined" onClick={restore} disabled={busy || !diff || restoreConfirmation !== detail.snapshotHash.slice(0, 8)} data-testid="restore-storyboard-review-round">
                            Gjenopprett storyboardfelter
                          </Button>
                        </Stack>
                      </Stack>
                    </>
                  )}
                </Stack>
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Lukk</Button></DialogActions>
    </Dialog>
  );
};

export default StoryboardReviewRoundsDialog;
