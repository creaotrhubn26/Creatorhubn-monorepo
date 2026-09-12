import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  StoryboardReviewDiff,
  StoryboardReviewRound,
} from '@shared/storyboard-review';
import {
  createStoryboardReviewRound,
  createStoryboardReviewShareLink,
  getStoryboardReviewDiff,
  getStoryboardReviewRound,
  listStoryboardReviewRounds,
  restoreStoryboardReviewRound,
  revokeStoryboardReviewShareLink,
} from '../services/storyboardReviewService';

type RevisionBaseline = NonNullable<StoryboardSkillContext['revisionBaseline']>;

const statusLabel: Record<string, string> = {
  in_review: 'Til review',
  changes_requested: 'Endringer ønsket',
  approved: 'Godkjent',
  superseded: 'Erstattet',
};

export const StoryboardReviewRoundsDialog: React.FC<{
  open: boolean;
  projectId: string;
  manuscriptId: string;
  sceneId: string;
  onClose: () => void;
  onBaselineChange?: (baseline: RevisionBaseline | undefined) => void;
}> = ({ open, projectId, manuscriptId, sceneId, onClose, onBaselineChange }) => {
  const [rounds, setRounds] = useState<StoryboardReviewRound[]>([]);
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

  useEffect(() => {
    if (!open || !projectId || !manuscriptId) return;
    setError(null);
    void refreshList().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Kunne ikke hente review-runder.');
    });
  }, [manuscriptId, open, projectId, refreshList]);

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
      await refreshList(created.id);
      setMessage(`Review-runde v${created.version} er låst til hash ${created.snapshotHash.slice(0, 10)}…`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Kunne ikke opprette review-runden.');
    } finally { setBusy(false); }
  };

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth data-testid="storyboard-review-rounds-dialog">
      <DialogTitle>Review-runder og revisjonsvakt</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error.replaceAll('_', ' ')}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}
          {!projectId || !manuscriptId ? (
            <Alert severity="warning">Prosjekt- og manuskript-ID mangler. Åpne storyboardet fra et lagret manuskript.</Alert>
          ) : (
            <>
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
