/**
 * ReviewShareSection — «Del med reviewer» (Fase 7e-2, Studio): opprett
 * gjestelenke for den åpne runden (tilgang: se / kommentere / beslutte,
 * valgfritt utløp), vis råtokenet én gang, list og tilbakekall lenker.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { ContentCopy as CopyIcon, LinkOff as RevokeIcon, PersonAddAlt as ShareIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import { NARRATIVE_REVIEW_ACCESS_LABELS, type NarrativeReviewAccessMode, type NarrativeReviewShareLink, type NarrativeSceneReview } from '../narrativeTypes';
import { createReviewShareLink, listReviewShareLinks, revokeReviewShareLink, NarrativeApiError } from '../narrativeService';
import { PlanGateBanner } from '../../game/GameBillingPanels';
import { useGamePlanGate } from '../../game/useGamePlanGate';
import { SectionTitle, sceneFieldSx } from './sceneUi';

const menuProps = { PaperProps: { sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text } } };

export function ReviewShareSection({ projectId, sceneId, review, onNotice }: { projectId: string; sceneId: string; review: NarrativeSceneReview; onNotice: (m: string, s: 'error' | 'warning' | 'success') => void }): React.ReactElement {
  const gate = useGamePlanGate();
  const locked = !gate.loading && !gate.has('guest_reviewers');
  const [links, setLinks] = useState<NarrativeReviewShareLink[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<NarrativeReviewAccessMode>('comment');
  const [expiresDays, setExpiresDays] = useState<string>('14');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ url: string; mode: NarrativeReviewAccessMode } | null>(null);
  const load = useCallback(async () => { try { setLinks(await listReviewShareLinks(projectId, sceneId, review.id)); } catch { /* vis tom */ } }, [projectId, sceneId, review.id]);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const days = Number(expiresDays);
      const r = await createReviewShareLink(projectId, sceneId, review.id, { accessMode: mode, requireIdentity: true, expiresAt: Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null });
      setFresh({ url: `${window.location.origin}${r.path}`, mode });
      setOpen(false);
      await load();
    } catch (err) {
      onNotice(err instanceof NarrativeApiError && err.code === 'plan_required' ? 'Gjeste-reviewere krever Studio-planen.' : err instanceof Error ? err.message : 'Kunne ikke opprette lenken.', 'error');
    } finally { setBusy(false); }
  };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); onNotice('Lenken er kopiert.', 'success'); } catch { onNotice('Kunne ikke kopiere — marker teksten manuelt.', 'warning'); } };
  const revoke = async (id: string) => { try { await revokeReviewShareLink(projectId, sceneId, review.id, id); await load(); onNotice('Lenken er tilbakekalt.', 'success'); } catch (err) { onNotice(err instanceof Error ? err.message : 'Kunne ikke tilbakekalle.', 'error'); } };
  const active = links.filter((l) => !l.revokedAt);

  return (
    <Box data-testid="narrative-review-share">
      <SectionTitle action={(
        <Tooltip title={locked ? 'Krever Studio' : ''}><span>
          <Button size="small" startIcon={<ShareIcon />} disabled={locked} onClick={() => setOpen(true)} sx={{ color: narrativeColors.accent, fontSize: 11 }} data-testid="narrative-review-share-open" data-locked={locked ? 'plan' : undefined}>Del med reviewer</Button>
        </span></Tooltip>
      )}>Gjeste-reviewere</SectionTitle>
      <PlanGateBanner feature="guest_reviewers" compact />
      {fresh ? (
        <Alert severity="success" onClose={() => setFresh(null)} sx={{ mb: 1, bgcolor: 'rgba(34,197,94,0.08)', color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` }} data-testid="narrative-review-share-fresh">
          <Typography sx={{ fontSize: 12, mb: 0.5 }}>Lenke ({NARRATIVE_REVIEW_ACCESS_LABELS[fresh.mode].toLowerCase()}) — vises bare én gang. Send den til reviewer:</Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <TextField size="small" fullWidth value={fresh.url} InputProps={{ readOnly: true }} inputProps={{ 'data-testid': 'narrative-review-share-url' }} sx={{ ...sceneFieldSx, '& .MuiInputBase-input': { fontSize: 12, fontFamily: 'monospace' } }} />
            <IconButton size="small" onClick={() => void copy(fresh.url)} sx={{ color: narrativeColors.accent }} aria-label="Kopier" data-testid="narrative-review-share-copy"><CopyIcon fontSize="small" /></IconButton>
          </Stack>
        </Alert>
      ) : null}
      {active.length === 0 && !fresh ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen gjestelenker for runde {review.round}. Publisher/QA uten konto kan se, kommentere og — med beslutningstilgang — godkjenne runden.</Typography> : null}
      <Stack spacing={0.5}>
        {active.map((l) => (
          <Stack key={l.id} direction="row" spacing={1} alignItems="center" data-testid={`narrative-review-share-link-${l.id}`}>
            <Chip size="small" label={NARRATIVE_REVIEW_ACCESS_LABELS[l.accessMode]} sx={{ bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent, fontWeight: 700 }} />
            <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, flex: 1 }}>opprettet {new Date(l.createdAt).toLocaleDateString('nb-NO')}{l.expiresAt ? ` · utløper ${new Date(l.expiresAt).toLocaleDateString('nb-NO')}` : ''} · {l.viewCount} visninger</Typography>
            <Tooltip title="Tilbakekall"><span><IconButton size="small" disabled={locked} onClick={() => { if (window.confirm('Tilbakekalle lenken? Reviewer mister tilgangen.')) void revoke(l.id); }} sx={{ color: narrativeColors.error }} aria-label="Tilbakekall" data-testid={`narrative-review-share-revoke-${l.id}`}><RevokeIcon fontSize="small" /></IconButton></span></Tooltip>
          </Stack>
        ))}
      </Stack>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` }, 'data-testid': 'narrative-review-share-dialog' } as never}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>Del runde {review.round} med reviewer</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Select size="small" value={mode} onChange={(e) => setMode(e.target.value as NarrativeReviewAccessMode)} sx={sceneFieldSx} MenuProps={menuProps} inputProps={{ 'data-testid': 'narrative-review-share-mode' }}>
              {(['view', 'comment', 'approve'] as NarrativeReviewAccessMode[]).map((m) => <MenuItem key={m} value={m}>{NARRATIVE_REVIEW_ACCESS_LABELS[m]}</MenuItem>)}
            </Select>
            <TextField size="small" type="number" label="Utløper etter (dager, 0 = aldri)" value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} sx={sceneFieldSx} inputProps={{ min: 0, max: 365, 'data-testid': 'narrative-review-share-days' }} />
            <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>Reviewer oppgir navn før tilgang. Beslutninger lagres med reviewerens navn, og studioet varsles.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy} sx={{ color: narrativeColors.textDim }}>Avbryt</Button>
          <Button variant="contained" onClick={() => void create()} disabled={busy} data-testid="narrative-review-share-create" sx={{ bgcolor: narrativeColors.accent, color: '#03150a', fontWeight: 700 }}>{busy ? 'Oppretter…' : 'Opprett lenke'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
