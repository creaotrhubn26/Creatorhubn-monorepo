/**
 * /story-review/:token — gjeste-review av én Story Graph-scene (Fase 7e-2).
 *
 * Ingen innlogging: runden hentes fra /api/role-room/narrative/review/:token.
 * Flyt: navn (+ e-post) → reviewer-sesjon (sessionStorage) → frosset snapshot
 * (manusfelt, replikker, rammer) + kommentartråd → «Godkjenn / Be om endringer»
 * når lenken er `approve`. Registrert i både App.tsx og casting-main.tsx.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRoute } from 'wouter';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { CheckCircle as ApproveIcon } from '@mui/icons-material';
import { createGuestReviewerSession, decideAsGuest, getGuestReview, NarrativeApiError, NarrativeStaleReviewError, REVIEW_PUBLIC_BASE } from '@/components/role-room/narrative/narrativeService';
import type { NarrativeGuestReview } from '@/components/role-room/narrative/narrativeTypes';
import { NARRATIVE_SCENE_ERA_LABELS, NARRATIVE_SOURCE_TAG_LABELS } from '@/components/role-room/narrative/narrativeTypes';
import { narrativeColors } from '@/components/role-room/narrative/narrativeTheme';
import { PostCommentLayer } from '@/components/role-room/components/PostCommentLayer';
import { NARRATIVE_COMMENT_THEME } from '@/components/role-room/narrative/scenes/SceneStoryboardTab';
import { REVIEW_STATUS_LABELS } from '@/components/role-room/narrative/scenes/sceneOps';

const fieldSx = { '& .MuiInputBase-root': { color: narrativeColors.text, bgcolor: 'rgba(255,255,255,0.03)' }, '& .MuiInputLabel-root': { color: narrativeColors.textDim }, '& .MuiOutlinedInput-notchedOutline': { borderColor: narrativeColors.borderStrong } } as const;
const STORAGE_PREFIX = 'narrative_reviewer:';
function readReviewerToken(token: string): string | null { try { return window.sessionStorage.getItem(STORAGE_PREFIX + token); } catch { return null; } }
function writeReviewerToken(token: string, value: string): void { try { window.sessionStorage.setItem(STORAGE_PREFIX + token, value); } catch { /* ignore */ } }
const STATUS_COLOR: Record<string, string> = { in_review: '#60a5fa', approved: narrativeColors.accent, changes_requested: narrativeColors.warning, superseded: narrativeColors.textDim };
const SCRIPT_FIELDS: Array<{ key: 'beforeState' | 'action' | 'control' | 'afterState' | 'audio' | 'changeNote' | 'bridge' | 'timeNote'; label: string }> = [
  { key: 'beforeState', label: 'Før' }, { key: 'action', label: 'Handling' }, { key: 'control', label: 'Kontroll' }, { key: 'afterState', label: 'Etter / utløser' }, { key: 'audio', label: 'Lyd' }, { key: 'changeNote', label: 'Endring' }, { key: 'bridge', label: 'Bro' }, { key: 'timeNote', label: 'Tidsnote' },
];

export interface StoryReviewViewProps { token: string }

export function StoryReviewView({ token }: StoryReviewViewProps) {
  const [reviewerToken, setReviewerToken] = useState<string | null>(() => readReviewerToken(token));
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'missing' } | { kind: 'error'; message: string } | { kind: 'ready'; data: NarrativeGuestReview }>({ kind: 'loading' });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [joining, setJoining] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'changes_requested' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; severity: 'success' | 'error' | 'warning' } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getGuestReview(token, reviewerToken);
      setState(data ? { kind: 'ready', data } : { kind: 'missing' });
    } catch (err) { setState({ kind: 'error', message: err instanceof Error ? err.message : 'Kunne ikke laste runden.' }); }
  }, [token, reviewerToken]);
  useEffect(() => { setState({ kind: 'loading' }); void load(); }, [load]);
  useEffect(() => { if (state.kind === 'ready') document.title = `Review: ${state.data.scene.code} — Story Graph`; }, [state]);

  const join = async () => {
    if (name.trim().length < 2) return;
    setJoining(true);
    try {
      const r = await createGuestReviewerSession(token, name.trim(), email.trim() || null);
      writeReviewerToken(token, r.reviewerToken);
      setReviewerToken(r.reviewerToken);
    } catch (err) { setNotice({ message: err instanceof Error ? err.message : 'Kunne ikke starte økten.', severity: 'error' }); }
    finally { setJoining(false); }
  };
  const decide = async () => {
    if (state.kind !== 'ready' || !reviewerToken || !decision) return;
    setBusy(true);
    try {
      await decideAsGuest(token, reviewerToken, { decision, note: note.trim() || null, expectedSnapshotHash: state.data.round.snapshotHash });
      setDecision(null); setNote('');
      setNotice({ message: decision === 'approved' ? 'Runden er godkjent. Studioet er varslet.' : 'Endringsønsket er sendt til studioet.', severity: 'success' });
      await load();
    } catch (err) {
      if (err instanceof NarrativeStaleReviewError) setNotice({ message: 'Scenen er endret siden runden ble sendt — be studioet om en ny lenke.', severity: 'warning' });
      else if (err instanceof NarrativeApiError && err.code === 'review_closed') setNotice({ message: 'Runden er allerede avgjort.', severity: 'warning' });
      else setNotice({ message: err instanceof Error ? err.message : 'Kunne ikke lagre beslutningen.', severity: 'error' });
    } finally { setBusy(false); }
  };

  const snapshot = state.kind === 'ready' ? state.data.snapshot : undefined;
  const lines = useMemo(() => snapshot?.lines ?? [], [snapshot]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#050505', color: narrativeColors.text, display: 'flex', flexDirection: 'column' }} data-testid="story-review-page">
      <Box sx={{ px: 2, py: 1, borderBottom: `1px solid rgba(34,197,94,0.18)`, bgcolor: 'rgba(10,10,10,0.95)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 11, letterSpacing: 2, color: narrativeColors.accent, fontWeight: 700 }}>STORY GRAPH · REVIEW</Typography>
        <Typography sx={{ fontSize: 13, color: narrativeColors.textDim, flex: 1 }} data-testid="story-review-title">{state.kind === 'ready' ? `${state.data.scene.code} · ${state.data.scene.title}` : ''}</Typography>
        {state.kind === 'ready' && state.data.reviewer ? <Chip size="small" label={state.data.reviewer.displayName} sx={{ bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent, fontWeight: 700 }} data-testid="story-review-reviewer" /> : null}
      </Box>
      {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ m: 2 }} data-testid="story-review-notice">{notice.message}</Alert> : null}
      {state.kind === 'loading' ? <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress size={28} sx={{ color: narrativeColors.accent }} /></Box> : null}
      {state.kind === 'missing' ? (
        <Box sx={{ p: 6, textAlign: 'center' }} data-testid="story-review-missing">
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Lenken er ugyldig, utløpt eller tilbakekalt.</Typography>
          <Typography sx={{ fontSize: 13, color: narrativeColors.textDim }}>Be studioet om en ny review-lenke.</Typography>
        </Box>
      ) : null}
      {state.kind === 'error' ? <Box sx={{ p: 6, textAlign: 'center' }} data-testid="story-review-error"><Typography sx={{ fontWeight: 700 }}>Kunne ikke laste runden.</Typography><Typography sx={{ fontSize: 13, color: narrativeColors.textDim }}>{state.message}</Typography></Box> : null}

      {state.kind === 'ready' && state.data.requiresIdentity ? (
        <Box sx={{ p: { xs: 2, md: 6 }, maxWidth: 520, mx: 'auto', width: '100%' }} data-testid="story-review-identity">
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Du er invitert til å reviewe {state.data.scene.code} · {state.data.scene.title}</Typography>
          <Typography sx={{ fontSize: 13, color: narrativeColors.textDim, mt: 1, mb: 2 }}>Runde {state.data.round.round}. Oppgi navnet ditt så studioet ser hvem som kommenterer{state.data.share.accessMode === 'approve' ? ' og beslutter' : ''}. Ingen konto trengs.</Typography>
          <Stack spacing={1.5}>
            <TextField size="small" label="Navn" autoFocus value={name} onChange={(e) => setName(e.target.value)} sx={fieldSx} inputProps={{ 'data-testid': 'story-review-name' }} onKeyDown={(e) => { if (e.key === 'Enter') void join(); }} />
            <TextField size="small" label="E-post (valgfritt)" value={email} onChange={(e) => setEmail(e.target.value)} sx={fieldSx} inputProps={{ 'data-testid': 'story-review-email' }} />
            <Button variant="contained" disabled={joining || name.trim().length < 2} onClick={() => void join()} sx={{ bgcolor: narrativeColors.accent, color: '#03150a', fontWeight: 700, alignSelf: 'flex-start' }} data-testid="story-review-join">Fortsett</Button>
          </Stack>
        </Box>
      ) : null}

      {state.kind === 'ready' && !state.data.requiresIdentity && snapshot ? (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto', width: '100%' }} data-testid="story-review-body">
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: narrativeColors.bgPanel, border: `1px solid ${STATUS_COLOR[state.data.round.status] ?? narrativeColors.borderStrong}66`, mb: 2 }} data-testid="story-review-round" data-status={state.data.round.status}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }} useFlexGap>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: STATUS_COLOR[state.data.round.status] }}>Runde {state.data.round.round} · {REVIEW_STATUS_LABELS[state.data.round.status]}</Typography>
              {snapshot.era ? <Chip size="small" label={NARRATIVE_SCENE_ERA_LABELS[snapshot.era]} sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: narrativeColors.text }} /> : null}
              <Box sx={{ flex: 1 }} />
              {state.data.share.accessMode === 'approve' && state.data.round.status === 'in_review' ? (
                <>
                  <Button variant="contained" startIcon={<ApproveIcon />} disabled={busy} onClick={() => setDecision('approved')} sx={{ bgcolor: narrativeColors.accent, color: '#03150a', fontWeight: 700 }} data-testid="story-review-approve">Godkjenn</Button>
                  <Button variant="outlined" disabled={busy} onClick={() => setDecision('changes_requested')} sx={{ color: narrativeColors.warning, borderColor: narrativeColors.warning }} data-testid="story-review-changes">Be om endringer</Button>
                </>
              ) : null}
            </Stack>
            {state.data.round.requestNote ? <Typography sx={{ fontSize: 13, mt: 1, whiteSpace: 'pre-wrap' }}>{state.data.round.requestNote}</Typography> : null}
            {state.data.round.decidedAt ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, mt: 1 }}>Avgjort {state.data.round.decidedByLabel ? `av ${state.data.round.decidedByLabel} ` : ''}{new Date(state.data.round.decidedAt).toLocaleString('nb-NO')}{state.data.round.decisionNote ? ` · ${state.data.round.decisionNote}` : ''}</Typography> : null}
            {state.data.share.accessMode === 'view' ? <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mt: 1 }}>Lenken gir bare lesetilgang.</Typography> : null}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, gap: 2 }}>
            <Stack spacing={2}>
              {snapshot.subtitle ? <Typography sx={{ fontSize: 14, color: narrativeColors.textDim }}>{snapshot.subtitle}</Typography> : null}
              {snapshot.location ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Lokasjon: {snapshot.location}</Typography> : null}
              {snapshot.script ? SCRIPT_FIELDS.filter((f) => snapshot.script![f.key]).map((f) => (
                <Box key={f.key} data-testid={`story-review-field-${f.key}`}>
                  <Typography sx={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: narrativeColors.accent, fontWeight: 700 }}>{f.label}</Typography>
                  <Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{snapshot.script![f.key]}</Typography>
                </Box>
              )) : null}
              {[['challenge', 'Utfordring'], ['gameplayMechanic', 'Spillmekanikk'], ['environment', 'Miljø']].filter(([k]) => snapshot[k as 'challenge']).map(([k, label]) => (
                <Box key={k}><Typography sx={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: narrativeColors.textDim, fontWeight: 700 }}>{label}</Typography><Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{snapshot[k as 'challenge']}</Typography></Box>
              ))}
              {snapshot.sourceRefs?.length ? <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>{snapshot.sourceRefs.map((r, i) => <Chip key={i} size="small" label={`${r.tag} · ${r.ref}`} title={NARRATIVE_SOURCE_TAG_LABELS[r.tag]} sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: narrativeColors.textDim }} />)}</Stack> : null}
              {snapshot.frames.length ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1 }} data-testid="story-review-frames">
                  {snapshot.frames.map((f, i) => f.externalUrl ? <Box key={i} component="img" src={f.externalUrl} alt={f.caption || `Ramme ${i + 1}`} sx={{ width: '100%', borderRadius: 1.5, border: `1px solid ${narrativeColors.borderStrong}` }} /> : <Box key={i} sx={{ p: 1, borderRadius: 1.5, border: `1px solid ${narrativeColors.borderStrong}`, fontSize: 11, color: narrativeColors.textDim }}>{f.caption || `Ramme ${i + 1}`}</Box>)}
                </Box>
              ) : null}
              {lines.length ? (
                <Box data-testid="story-review-lines">
                  <Typography sx={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: narrativeColors.accent, fontWeight: 700, mb: 0.5 }}>Replikker ({lines.length})</Typography>
                  <Stack spacing={0.5}>
                    {lines.map((l) => (
                      <Stack key={l.cueId} direction="row" spacing={1} alignItems="baseline" data-testid={`story-review-line-${l.cueId}`}>
                        <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: narrativeColors.accent, fontWeight: 800, minWidth: 64 }}>{l.cueId}</Typography>
                        <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, minWidth: 90 }}>{l.speakerLabel}</Typography>
                        <Typography sx={{ fontSize: 13, flex: 1 }}>{l.textEn}</Typography>
                        <Chip size="small" label={l.sourceType} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.06)', color: narrativeColors.textDim }} />
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Stack>
            <Box>
              <Typography sx={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: narrativeColors.accent, fontWeight: 700, mb: 0.5 }}>Diskusjon</Typography>
              {reviewerToken && state.data.scene.id ? (
                <PostCommentLayer projectId="guest" anchorType="narrative_scene" anchorRef={state.data.scene.id} auth={{ kind: 'narrative-reviewer', token: reviewerToken }} apiBase={`${REVIEW_PUBLIC_BASE}/${encodeURIComponent(token)}`} authorDisplayName={state.data.reviewer?.displayName ?? 'Gjest'} readOnly={state.data.share.accessMode === 'view'} composerPlaceholder="Skriv en kommentar til studioet…" pollingIntervalMs={15_000} defaultVisibleCount={8} theme={NARRATIVE_COMMENT_THEME} />
              ) : <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Oppgi navn for å kommentere.</Typography>}
            </Box>
          </Box>
        </Box>
      ) : null}

      <Dialog open={!!decision} onClose={() => !busy && setDecision(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` }, 'data-testid': 'story-review-decision-dialog' } as never}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>{decision === 'approved' ? 'Godkjenn runden' : 'Be om endringer'}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth multiline minRows={3} size="small" label={decision === 'approved' ? 'Kommentar (valgfritt)' : 'Hva må endres?'} value={note} onChange={(e) => setNote(e.target.value)} sx={{ ...fieldSx, mt: 1 }} inputProps={{ 'data-testid': 'story-review-decision-note' }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecision(null)} disabled={busy} sx={{ color: narrativeColors.textDim }}>Avbryt</Button>
          <Button variant="contained" onClick={() => void decide()} disabled={busy || (decision === 'changes_requested' && !note.trim())} data-testid="story-review-decision-confirm" sx={{ bgcolor: narrativeColors.accent, color: '#03150a', fontWeight: 700 }}>{busy ? 'Lagrer…' : decision === 'approved' ? 'Godkjenn' : 'Send tilbake'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function StoryReviewPage() {
  const [, params] = useRoute('/story-review/:token');
  const token = (params as { token?: string } | null)?.token ?? '';
  return <StoryReviewView token={token} />;
}
