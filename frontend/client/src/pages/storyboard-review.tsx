import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import GestureIcon from '@mui/icons-material/Gesture';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useRoute } from 'wouter';
import type {
  StoryboardReviewAnnotationColor,
  StoryboardReviewSnapshotFrame,
} from '@shared/storyboard-review';
import {
  addSharedStoryboardComment,
  createStoryboardReviewerSession,
  decideSharedStoryboardReview,
  getSharedStoryboardReview,
  type StoryboardSharedReviewEnvelope,
} from '@/components/role-room/services/storyboardReviewService';
import {
  EMPTY_STORYBOARD_REVIEW_MARKUP,
  StoryboardReviewMarkupCanvas,
  type StoryboardReviewMarkupDraft,
  type StoryboardReviewMarkupTool,
} from '@/components/role-room/components/StoryboardReviewMarkupCanvas';

function sessionKey(token: string) { return `storyboard-reviewer:${token}`; }

const MARKUP_COLORS: StoryboardReviewAnnotationColor[] = ['#fbbf24', '#f87171', '#60a5fa', '#34d399'];

function emptyMarkup(): StoryboardReviewMarkupDraft {
  return { ...EMPTY_STORYBOARD_REVIEW_MARKUP, annotations: [] };
}

export default function StoryboardReviewPage() {
  const [, params] = useRoute('/storyboard-review/:token');
  const token = params?.token || '';
  const [reviewerToken, setReviewerToken] = useState(() => {
    try { return sessionStorage.getItem(sessionKey(token)) || ''; } catch { return ''; }
  });
  const [data, setData] = useState<StoryboardSharedReviewEnvelope | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedFrame, setSelectedFrame] = useState<StoryboardReviewSnapshotFrame | null>(null);
  const [markupDraft, setMarkupDraft] = useState<StoryboardReviewMarkupDraft>(emptyMarkup);
  const [markupTool, setMarkupTool] = useState<StoryboardReviewMarkupTool>('pin');
  const [markupColor, setMarkupColor] = useState<StoryboardReviewAnnotationColor>('#fbbf24');
  const [showMarkup, setShowMarkup] = useState(true);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [confirmOpenComments, setConfirmOpenComments] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (identity = reviewerToken) => {
    if (!token) return;
    setBusy(true); setError(null);
    try { setData(await getSharedStoryboardReview(token, identity || undefined)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Kunne ikke åpne review-lenken.'); }
    finally { setBusy(false); }
  }, [reviewerToken, token]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!reviewerToken) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        void load(reviewerToken);
      }
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [load, reviewerToken]);

  const join = async (event: FormEvent) => {
    event.preventDefault();
    if (!displayName.trim()) return;
    setBusy(true); setError(null);
    try {
      const created = await createStoryboardReviewerSession(token, {
        displayName: displayName.trim(), email: email.trim() || undefined,
      });
      setReviewerToken(created.reviewerToken);
      sessionStorage.setItem(sessionKey(token), created.reviewerToken);
      setData(await getSharedStoryboardReview(token, created.reviewerToken));
    } catch (joinError) { setError(joinError instanceof Error ? joinError.message : 'Kunne ikke starte review.'); }
    finally { setBusy(false); }
  };

  const interactiveData = data && !data.requiresIdentity ? data : null;
  const frames = useMemo(() => interactiveData?.round.snapshot.scenes.flatMap((scene) =>
    scene.storyboardFrames.map((frame) => ({ ...frame, sceneHeading: scene.heading }))) ?? [], [interactiveData]);
  const isLocked = interactiveData?.round.status === 'approved' || interactiveData?.round.status === 'superseded';
  const openComments = useMemo(
    () => (interactiveData?.round.comments ?? []).filter((entry) => entry.status === 'open'),
    [interactiveData?.round.comments],
  );
  const selectedFrameComments = useMemo(
    () => (interactiveData?.round.comments ?? []).filter((entry) => entry.frameId === selectedFrame?.id),
    [interactiveData?.round.comments, selectedFrame?.id],
  );

  const selectFrame = (frame: StoryboardReviewSnapshotFrame) => {
    if (selectedFrame?.id !== frame.id) {
      setMarkupDraft(emptyMarkup());
      setActiveCommentId(null);
    }
    setSelectedFrame(frame);
  };

  const submitComment = async () => {
    if (!selectedFrame || !comment.trim() || !reviewerToken) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await addSharedStoryboardComment(token, reviewerToken, {
        frameId: selectedFrame.id,
        body: comment.trim(),
        anchorX: markupDraft.anchorX,
        anchorY: markupDraft.anchorY,
        annotations: markupDraft.annotations,
      });
      setComment(''); setMarkupDraft(emptyMarkup());
      setMessage(markupDraft.anchorX != null || markupDraft.annotations.length
        ? 'Kommentaren og den visuelle markeringen er knyttet til riktig shot.'
        : 'Kommentaren er knyttet til riktig shot.');
      await load(reviewerToken);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Kommentaren kunne ikke lagres.'); }
    finally { setBusy(false); }
  };

  const decide = async (decision: 'approved' | 'changes_requested') => {
    if (!interactiveData || !reviewerToken) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await decideSharedStoryboardReview(token, reviewerToken, {
        decision,
        expectedSnapshotHash: interactiveData.round.snapshotHash,
        note: decisionNote.trim() || undefined,
        confirmOpenComments: decision === 'approved' && openComments.length > 0
          ? confirmOpenComments
          : undefined,
      });
      setDecisionNote('');
      setMessage(decision === 'approved'
        ? `Revisjon v${interactiveData.round.version} er godkjent med kontrollert hash.`
        : 'Endringer er etterspurt på denne revisjonen.');
      await load(reviewerToken);
    } catch (decisionError) { setError(decisionError instanceof Error ? decisionError.message : 'Beslutningen kunne ikke lagres.'); }
    finally { setBusy(false); }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0b0b11', color: '#fff', py: 4 }} data-testid="storyboard-shared-review">
      <Container maxWidth="xl">
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="overline" sx={{ color: '#a78bfa', letterSpacing: 2 }}>THE ROLE ROOM · STORYBOARD REVIEW</Typography>
            <Typography variant="h3" fontWeight={850}>{data?.round.label || 'Storyboard review'}</Typography>
            {data?.round && (
              <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Revisjon v${data.round.version}`} color="secondary" />
                <Chip label={data.round.status.replaceAll('_', ' ')} variant="outlined" sx={{ color: '#fff' }} />
                <Chip label={`${data.round.frameCount} shots`} variant="outlined" sx={{ color: '#fff' }} />
                <Chip label={`Hash ${data.round.snapshotHash.slice(0, 12)}…`} variant="outlined" sx={{ color: '#fff' }} />
              </Stack>
            )}
          </Box>
          {error && <Alert severity="error">{error.replaceAll('_', ' ')}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}
          {busy && !data && <CircularProgress color="secondary" />}

          {data && (data.requiresIdentity || (!data.reviewer && data.share.accessMode !== 'view')) && (
            <Card component="form" onSubmit={join} sx={{ maxWidth: 560, bgcolor: '#171720', color: '#fff' }} data-testid="storyboard-review-identity-form">
              <CardContent>
                <Typography variant="h6">Hvem gir tilbakemelding?</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.65)', mb: 2 }}>Navnet følger kommentarer og sign-off. Ingen konto er nødvendig.</Typography>
                <Stack spacing={1.5}>
                  <TextField label="Navn" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required inputProps={{ 'data-testid': 'storyboard-reviewer-name' }} />
                  <TextField label="E-post (valgfritt)" value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
                  <Button type="submit" variant="contained" disabled={busy || !displayName.trim()} data-testid="start-storyboard-review">Åpne låst revisjon</Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {interactiveData && (
            <>
              {isLocked && <Alert severity="info">Denne revisjonen er låst. Innhold, kommentarer og beslutninger kan leses, men ikke endres.</Alert>}
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 2, flex: 1 }}>
                  {frames.map((frame: StoryboardReviewSnapshotFrame & { sceneHeading?: string }, index) => (
                    <Card
                      key={frame.id}
                      onClick={() => selectFrame(frame)}
                      data-testid={`storyboard-review-frame-${index}`}
                      sx={{ cursor: 'pointer', bgcolor: selectedFrame?.id === frame.id ? '#292044' : '#171720', color: '#fff', border: '1px solid rgba(255,255,255,.12)' }}
                    >
                      {(frame.thumbnailUrl || frame.imageUrl) ? (
                        <Box component="img" src={frame.thumbnailUrl || frame.imageUrl} alt="" referrerPolicy="no-referrer" sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <Box sx={{ aspectRatio: '16/9', bgcolor: '#25252f', display: 'grid', placeItems: 'center' }}>Ingen forhåndsvisning</Box>
                      )}
                      <CardContent>
                        <Typography variant="overline" color="rgba(255,255,255,.55)">{frame.sceneHeading}</Typography>
                        <Typography fontWeight={800}>{frame.shotNumber || `Shot ${index + 1}`}</Typography>
                        <Typography variant="body2" color="rgba(255,255,255,.72)">{frame.description || 'Uten beskrivelse'}</Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>

                <Stack spacing={2} sx={{ width: { xs: '100%', lg: 380 }, position: { lg: 'sticky' }, top: 24 }}>
                  {selectedFrame && (
                    <Card sx={{ bgcolor: '#171720', color: '#fff' }} data-testid="storyboard-review-visual-feedback">
                      <CardContent>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} mb={1}>
                          <Box>
                            <Typography variant="h6">Visuell feedback</Typography>
                            <Typography variant="caption" color="rgba(255,255,255,.62)">
                              {selectedFrame.shotNumber || selectedFrame.id}
                            </Typography>
                          </Box>
                          <Tooltip title={showMarkup ? 'Skjul markeringer' : 'Vis markeringer'}>
                            <IconButton
                              color="inherit"
                              onClick={() => setShowMarkup((current) => !current)}
                              data-testid="storyboard-review-toggle-markup"
                              aria-label={showMarkup ? 'Skjul markeringer' : 'Vis markeringer'}
                            >
                              {showMarkup ? <VisibilityIcon /> : <VisibilityOffIcon />}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                        <StoryboardReviewMarkupCanvas
                          frame={selectedFrame}
                          comments={selectedFrameComments}
                          activeCommentId={activeCommentId}
                          showMarkup={showMarkup}
                          draft={markupDraft}
                          tool={markupTool}
                          color={markupColor}
                          interactive={!isLocked && interactiveData.share.accessMode !== 'view' && Boolean(reviewerToken)}
                          onDraftChange={setMarkupDraft}
                          onCommentSelect={setActiveCommentId}
                        />
                        {!isLocked && interactiveData.share.accessMode !== 'view' && reviewerToken && (
                          <Stack spacing={1.25} mt={1.5}>
                            <ToggleButtonGroup
                              exclusive
                              size="small"
                              value={markupTool}
                              onChange={(_event, next: StoryboardReviewMarkupTool | null) => { if (next) setMarkupTool(next); }}
                              fullWidth
                              aria-label="Markeringsverktøy"
                            >
                              <ToggleButton value="pin" data-testid="storyboard-review-tool-pin" aria-label="Plasser pin"><PushPinOutlinedIcon fontSize="small" /></ToggleButton>
                              <ToggleButton value="freehand" data-testid="storyboard-review-tool-freehand" aria-label="Tegn frihånd"><GestureIcon fontSize="small" /></ToggleButton>
                              <ToggleButton value="arrow" data-testid="storyboard-review-tool-arrow" aria-label="Tegn pil"><ArrowOutwardIcon fontSize="small" /></ToggleButton>
                              <ToggleButton value="rectangle" data-testid="storyboard-review-tool-rectangle" aria-label="Tegn rektangel"><CropSquareIcon fontSize="small" /></ToggleButton>
                            </ToggleButtonGroup>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              {MARKUP_COLORS.map((entry) => (
                                <IconButton
                                  key={entry}
                                  size="small"
                                  onClick={() => setMarkupColor(entry)}
                                  aria-label={`Velg markeringsfarge ${entry}`}
                                  data-testid={`storyboard-review-color-${entry.slice(1)}`}
                                  sx={{
                                    width: 30, height: 30, bgcolor: entry,
                                    border: markupColor === entry ? '3px solid white' : '1px solid rgba(255,255,255,.4)',
                                    '&:hover': { bgcolor: entry },
                                  }}
                                />
                              ))}
                              <Box sx={{ flex: 1 }} />
                              <Tooltip title="Angre siste strek">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="inherit"
                                    disabled={!markupDraft.annotations.length}
                                    onClick={() => setMarkupDraft((current) => ({
                                      ...current, annotations: current.annotations.slice(0, -1),
                                    }))}
                                    data-testid="storyboard-review-markup-undo"
                                    aria-label="Angre siste markering"
                                  ><UndoIcon fontSize="small" /></IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Fjern kladdemarkeringer">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="inherit"
                                    disabled={markupDraft.anchorX == null && !markupDraft.annotations.length}
                                    onClick={() => setMarkupDraft(emptyMarkup())}
                                    data-testid="storyboard-review-markup-clear"
                                    aria-label="Fjern kladdemarkeringer"
                                  ><DeleteSweepIcon fontSize="small" /></IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                            <Typography variant="caption" color="rgba(255,255,255,.62)">
                              {markupTool === 'pin' ? 'Klikk på detaljen kommentaren gjelder.' : 'Dra over bildet for å tegne. Originalbildet endres ikke.'}
                            </Typography>
                          </Stack>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <Card sx={{ bgcolor: '#171720', color: '#fff' }}>
                    <CardContent>
                      <Typography variant="h6">Kommentarer {selectedFrame ? `· ${selectedFrame.shotNumber || selectedFrame.id}` : ''}</Typography>
                      {(interactiveData.round.comments ?? [])
                        .filter((entry) => !selectedFrame || entry.frameId === selectedFrame.id)
                        .map((entry) => (
                          <Box
                            key={entry.id}
                            onClick={() => setActiveCommentId(entry.id)}
                            data-testid={`storyboard-review-comment-${entry.id}`}
                            sx={{
                              py: 1.25, px: 1, mx: -1, borderRadius: 1, cursor: entry.frameId ? 'pointer' : 'default',
                              bgcolor: activeCommentId === entry.id ? 'rgba(167,139,250,.13)' : 'transparent',
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                              <Typography variant="subtitle2">{entry.authorDisplayName}</Typography>
                              <Chip
                                size="small"
                                color={entry.status === 'resolved' ? 'success' : 'warning'}
                                label={entry.status === 'resolved' ? 'Løst' : 'Åpent'}
                                data-testid={`storyboard-review-comment-status-${entry.id}`}
                              />
                              {entry.assignedTo && <Chip size="small" variant="outlined" label={`Ansvarlig: ${entry.assignedTo}`} sx={{ color: '#fff' }} />}
                            </Stack>
                            <Typography variant="body2" color="rgba(255,255,255,.72)">{entry.body}</Typography>
                            {entry.resolutionNote && (
                              <Typography variant="caption" color="rgba(167,243,208,.9)" display="block">
                                Løsning: {entry.resolutionNote}
                              </Typography>
                            )}
                          </Box>
                        ))}
                      {!isLocked && interactiveData.share.accessMode !== 'view' && reviewerToken && (
                        <Stack spacing={1} mt={1}>
                          <TextField multiline minRows={3} label={selectedFrame ? 'Kommentar til shot' : 'Velg et shot'} value={comment} onChange={(event) => setComment(event.target.value)} disabled={!selectedFrame} inputProps={{ 'data-testid': 'storyboard-review-comment' }} />
                          <Button onClick={submitComment} disabled={busy || !selectedFrame || !comment.trim()} variant="outlined" data-testid="submit-storyboard-review-comment">Legg til kommentar</Button>
                        </Stack>
                      )}
                    </CardContent>
                  </Card>

                  {interactiveData.share.accessMode === 'approve' && reviewerToken && !isLocked && (
                    <Card sx={{ bgcolor: '#171720', color: '#fff' }}>
                      <CardContent>
                        <Typography variant="h6">Sign-off</Typography>
                        <Typography variant="body2" color="rgba(255,255,255,.65)" mb={1.5}>Beslutningen bindes til nøyaktig revisjon v{interactiveData.round.version} og hash {interactiveData.round.snapshotHash.slice(0, 12)}…</Typography>
                        {openComments.length > 0 && (
                          <Alert severity="warning" sx={{ mb: 1.5 }} data-testid="storyboard-review-open-comments-warning">
                            {openComments.length} review-punkt er fortsatt {openComments.length === 1 ? 'åpent' : 'åpne'}. Be om endringer, eller bekreft eksplisitt at revisjonen skal godkjennes likevel.
                          </Alert>
                        )}
                        <TextField multiline minRows={2} fullWidth label="Beslutningsnotat" value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} />
                        {openComments.length > 0 && (
                          <FormControlLabel
                            control={<Checkbox checked={confirmOpenComments} onChange={(event) => setConfirmOpenComments(event.target.checked)} />}
                            label={`Jeg godkjenner med ${openComments.length} åpne punkt`}
                            data-testid="storyboard-review-confirm-open-comments"
                          />
                        )}
                        <Divider sx={{ my: 1.5 }} />
                        <Stack direction="row" spacing={1}>
                          <Button color="warning" variant="outlined" onClick={() => decide('changes_requested')} disabled={busy} data-testid="request-storyboard-changes">Be om endringer</Button>
                          <Button color="success" variant="contained" onClick={() => decide('approved')} disabled={busy || (openComments.length > 0 && !confirmOpenComments)} data-testid="approve-storyboard-review">Godkjenn revisjon</Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  )}
                </Stack>
              </Stack>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
