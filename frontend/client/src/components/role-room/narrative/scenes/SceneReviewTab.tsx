/**
 * SceneReviewTab — review-runder med godkjenning.
 *
 * Forebygg feil: «Be om review» er deaktivert (med forklaring) når en uendret
 * runde allerede er åpen; beslutning sendes med forventet hash, og en stale
 * runde vises som banner med «Send ny runde» FØR noen rekker å trykke
 * «Godkjenn». 409 fra serveren håndteres likevel (to faner, samtidighet).
 * Plan-gating: Pro/Studio (scene_review) — banner + låst knapp på Solo.
 */

import React, { useState } from 'react';
import { Alert, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { CheckCircle as ApproveIcon, ExpandMore as ExpandIcon, RateReview as ReviewIcon, ReportProblemOutlined as WarnIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import type { NarrativeSceneDetail, NarrativeSceneReview } from '../narrativeTypes';
import { NarrativeApiError, NarrativeStaleReviewError } from '../narrativeService';
import type { UseNarrativeScenesResult } from './useNarrativeScenes';
import { EmptyHint, SectionTitle, sceneFieldSx } from './sceneUi';
import { REVIEW_STATUS_LABELS, canRequestReview, formatShortDate, formatTime, openReview, snapshotIsStale } from './sceneOps';
import { PlanGateBanner } from '../../game/GameBillingPanels';
import { useGamePlanGate } from '../../game/useGamePlanGate';
import { PostCommentLayer } from '../../components/PostCommentLayer';
import { bearerToken, selfDisplayName } from './SceneStoryboardTab';

const STATUS_COLOR: Record<NarrativeSceneReview['status'], string> = {
  in_review: narrativeColors.warning,
  changes_requested: narrativeColors.error,
  approved: narrativeColors.accent,
  superseded: '#6b7280',
};

function when(iso: string | null): string {
  return iso ? `${formatShortDate(iso)} ${formatTime(iso)}` : '';
}

export function SceneReviewTab({ projectId, detail, scenes, onNotice }: {
  projectId: string; detail: NarrativeSceneDetail; scenes: UseNarrativeScenesResult;
  onNotice: (message: string, severity: 'error' | 'warning' | 'success') => void;
}) {
  const gate = useGamePlanGate();
  const locked = !gate.loading && !gate.has('scene_review');
  const open = openReview(detail.reviews);
  const stale = snapshotIsStale(detail);
  const request = canRequestReview(detail);
  const token = bearerToken();

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [decision, setDecision] = useState<'approved' | 'changes_requested' | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [staleFromServer, setStaleFromServer] = useState(false);

  const submitRequest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await scenes.requestReview(requestNote.trim() || null);
      setRequestOpen(false);
      setRequestNote('');
      setStaleFromServer(false);
      onNotice(`Runde ${r.round} er sendt til review. Ansvarlig får varsel.`, 'success');
    } catch (err) {
      if (err instanceof NarrativeApiError && err.code === 'plan_required') onNotice('Review-runder krever Pro eller Studio.', 'warning');
      else onNotice(err instanceof Error ? err.message : 'Kunne ikke sende runden.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitDecision = async () => {
    if (!open || !decision || busy) return;
    setBusy(true);
    try {
      const r = await scenes.decideReview(open.id, decision, decisionNote.trim() || null);
      setDecision(null);
      setDecisionNote('');
      onNotice(r.status === 'approved' ? `Runde ${r.round} er godkjent.` : `Runde ${r.round}: endringer er bedt om.`, 'success');
    } catch (err) {
      setDecision(null);
      if (err instanceof NarrativeStaleReviewError) { setStaleFromServer(true); onNotice(err.message, 'warning'); }
      else if (err instanceof NarrativeApiError && err.code === 'review_closed') onNotice('Runden er allerede avgjort — lista er oppdatert.', 'warning');
      else if (err instanceof NarrativeApiError && err.code === 'plan_required') onNotice('Beslutning på review-runder krever Pro eller Studio.', 'warning');
      else onNotice(err instanceof Error ? err.message : 'Kunne ikke lagre beslutningen.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const showStale = open && (stale || staleFromServer);
  const requestDisabled = locked || busy || (!request.ok && !showStale);
  const requestLabel = showStale ? 'Send ny runde' : open ? `Runde ${open.round} er åpen` : detail.reviews.length ? 'Be om ny review' : 'Be om review';

  const requestButton = (
    <Button
      variant="contained" startIcon={<ReviewIcon />} disabled={requestDisabled}
      onClick={() => setRequestOpen(true)} data-testid="narrative-scene-review-request" data-locked={locked ? 'plan' : undefined}
      sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, '&:hover': { bgcolor: narrativeColors.accentDark } }}
    >
      {requestLabel}
    </Button>
  );

  return (
    <Stack spacing={2} sx={{ maxWidth: 820 }}>
      <PlanGateBanner feature="scene_review" compact />

      {showStale ? (
        <Alert severity="warning" icon={<WarnIcon fontSize="small" />} data-testid="narrative-scene-review-stale" sx={{ bgcolor: 'rgba(245,158,11,0.10)', color: narrativeColors.text, border: `1px solid rgba(245,158,11,0.4)` }}>
          <Typography sx={{ fontSize: 12 }}><b>Scenen er endret siden runde {open.round} ble sendt.</b> Beslutning på den gamle runden er sperret — send en ny runde så reviewer ser gjeldende versjon.</Typography>
        </Alert>
      ) : null}

      <Box sx={{ p: 2, borderRadius: 2, bgcolor: narrativeColors.bgPanel, border: `1px solid ${open ? STATUS_COLOR.in_review + '66' : narrativeColors.borderStrong}` }} data-testid="narrative-scene-review-status" data-status={open ? 'in_review' : detail.reviews[0]?.status ?? 'none'}>
        {open ? (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: STATUS_COLOR.in_review }}>Runde {open.round} · Til review</Typography>
              <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>sendt {when(open.requestedAt)}{open.requestedBy ? ` av ${open.requestedBy}` : ''}</Typography>
            </Stack>
            {open.requestNote ? <Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{open.requestNote}</Typography> : null}
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
              <Tooltip title={locked ? 'Krever Pro eller Studio' : showStale ? 'Send ny runde først' : ''}>
                <span>
                  <Button variant="contained" startIcon={<ApproveIcon />} disabled={locked || busy || !!showStale} onClick={() => setDecision('approved')} data-testid="narrative-scene-review-approve" data-locked={locked ? 'plan' : undefined}
                    sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, '&:hover': { bgcolor: narrativeColors.accentDark } }}>Godkjenn</Button>
                </span>
              </Tooltip>
              <Tooltip title={locked ? 'Krever Pro eller Studio' : showStale ? 'Send ny runde først' : ''}>
                <span>
                  <Button variant="outlined" disabled={locked || busy || !!showStale} onClick={() => setDecision('changes_requested')} data-testid="narrative-scene-review-changes" data-locked={locked ? 'plan' : undefined}
                    sx={{ color: narrativeColors.warning, borderColor: narrativeColors.warning }}>Be om endringer</Button>
                </span>
              </Tooltip>
              <Box sx={{ flex: 1 }} />
              {showStale ? requestButton : (
                <Tooltip title={request.reason ?? ''}><span>{requestButton}</span></Tooltip>
              )}
            </Stack>
          </Stack>
        ) : (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap' }} useFlexGap>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              {detail.reviews[0] ? (
                <>
                  <Typography sx={{ fontSize: 14, fontWeight: 800, color: STATUS_COLOR[detail.reviews[0].status] }}>Runde {detail.reviews[0].round} · {REVIEW_STATUS_LABELS[detail.reviews[0].status]}</Typography>
                  <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{detail.reviews[0].decidedByLabel ? `av ${detail.reviews[0].decidedByLabel} ` : ''}{when(detail.reviews[0].decidedAt)}</Typography>
                  {detail.reviews[0].decisionNote ? <Typography sx={{ fontSize: 13, mt: 0.5, whiteSpace: 'pre-wrap' }}>{detail.reviews[0].decisionNote}</Typography> : null}
                </>
              ) : (
                <>
                  <Typography sx={{ fontSize: 14, fontWeight: 800 }}>Ingen review ennå</Typography>
                  <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>En runde fryser scenen slik den er nå (felter, rammer, koblede elementer) så reviewer og designer ser det samme.</Typography>
                </>
              )}
            </Box>
            <Tooltip title={locked ? 'Krever Pro eller Studio' : ''}><span>{requestButton}</span></Tooltip>
          </Stack>
        )}
      </Box>

      <Box>
        <SectionTitle>Diskusjon</SectionTitle>
        {token ? (
          <PostCommentLayer projectId={projectId} anchorType="narrative_scene" anchorRef={detail.scene.id} auth={{ kind: 'bearer', token }} authorDisplayName={selfDisplayName()} composerPlaceholder="Skriv en kommentar til scenen…" pollingIntervalMs={15_000} defaultVisibleCount={5} />
        ) : (
          <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Logg inn for å kommentere.</Typography>
        )}
      </Box>

      {detail.reviews.length > 0 ? (
        <Box>
          <Button size="small" endIcon={<ExpandIcon sx={{ transform: historyOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />} onClick={() => setHistoryOpen((v) => !v)} sx={{ color: narrativeColors.textDim, fontSize: 12 }} data-testid="narrative-scene-review-history-toggle">
            Rundehistorikk ({detail.reviews.length})
          </Button>
          <Collapse in={historyOpen}>
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {detail.reviews.map((r) => (
                <Stack key={r.id} direction="row" spacing={1} alignItems="flex-start" sx={{ px: 1.5, py: 1, borderRadius: 1.5, border: `1px solid ${narrativeColors.borderStrong}`, borderLeft: `3px solid ${STATUS_COLOR[r.status]}` }} data-testid={`narrative-scene-review-round-${r.round}`} data-status={r.status}>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, width: 64, flexShrink: 0 }}>Runde {r.round}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, color: STATUS_COLOR[r.status], fontWeight: 700 }}>{REVIEW_STATUS_LABELS[r.status]}</Typography>
                    <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>sendt {when(r.requestedAt)}{r.decidedAt ? ` · avgjort ${when(r.decidedAt)}${r.decidedByLabel ? ` av ${r.decidedByLabel}` : ''}` : ''}</Typography>
                    {r.requestNote ? <Typography sx={{ fontSize: 12, mt: 0.25, color: narrativeColors.textDim }}>Forespørsel: {r.requestNote}</Typography> : null}
                    {r.decisionNote ? <Typography sx={{ fontSize: 12, mt: 0.25 }}>Beslutning: {r.decisionNote}</Typography> : null}
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Collapse>
        </Box>
      ) : !open ? null : null}

      {detail.reviews.length === 0 && !locked ? (
        <EmptyHint title="Slik fungerer review" body="1) Be om review når scenen er klar. 2) Ansvarlig får varsel og diskuterer i tråden. 3) Godkjenn eller be om endringer — statusen på scenen følger med." />
      ) : null}

      <Dialog open={requestOpen} onClose={() => !busy && setRequestOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` }, 'data-testid': 'narrative-scene-review-request-dialog' } as never}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>{showStale ? 'Send ny runde' : 'Be om review'}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, mb: 1.5 }}>Scenen fryses slik den er nå. {showStale ? `Runde ${open?.round} erstattes.` : 'Ansvarlig får varsel i innboksen og på e-post.'}</Typography>
          <TextField autoFocus fullWidth multiline minRows={3} size="small" label="Merknad til reviewer (valgfritt)" value={requestNote} onChange={(e) => setRequestNote(e.target.value)} inputProps={{ 'data-testid': 'narrative-scene-review-note', maxLength: 5000 }} sx={sceneFieldSx} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRequestOpen(false)} disabled={busy} sx={{ color: narrativeColors.textDim }}>Avbryt</Button>
          <Button variant="contained" onClick={() => void submitRequest()} disabled={busy} data-testid="narrative-scene-review-submit" sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, '&:hover': { bgcolor: narrativeColors.accentDark } }}>{busy ? 'Sender…' : 'Send til review'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!decision} onClose={() => !busy && setDecision(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` }, 'data-testid': 'narrative-scene-decision-dialog' } as never}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>{decision === 'approved' ? `Godkjenn runde ${open?.round}` : `Be om endringer i runde ${open?.round}`}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth multiline minRows={3} size="small" label={decision === 'approved' ? 'Kommentar (valgfritt)' : 'Hva må endres?'} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} inputProps={{ 'data-testid': 'narrative-scene-decision-note', maxLength: 5000 }} sx={sceneFieldSx} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecision(null)} disabled={busy} sx={{ color: narrativeColors.textDim }}>Avbryt</Button>
          <Button variant="contained" onClick={() => void submitDecision()} disabled={busy || (decision === 'changes_requested' && !decisionNote.trim())} data-testid="narrative-scene-decision-confirm"
            sx={{ bgcolor: decision === 'approved' ? narrativeColors.accent : narrativeColors.warning, color: '#04140a', fontWeight: 700 }}>
            {busy ? 'Lagrer…' : decision === 'approved' ? 'Godkjenn' : 'Send tilbake'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
