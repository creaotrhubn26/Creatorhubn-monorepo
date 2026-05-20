/**
 * NextRoleVideoPresentation — Pro-feature for video-presentasjon-trening.
 *
 * Brukerflyt:
 *   1. Bruker velger en prompt (forhåndsdefinert eller egen) + ev. jobbsøknad
 *   2. Kameraprøve med live-preview
 *   3. Opptak (30/60/90 sek) med timer og pulserende rød indikator
 *   4. Playback + valgfri trim (drag-handles på timeline)
 *   5. Send til AI for analyse — Whisper-transkripsjon + Claude vision
 *      på 4-6 keyframes ekstrahert klient-side via <canvas>
 *   6. Vis score (overall + per kompetanse + delivery), strengths, improvements
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, Stack, Paper, Chip,
  CircularProgress, LinearProgress, Alert, IconButton, MenuItem,
  ToggleButtonGroup, ToggleButton, Slider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Videocam as VideocamIcon,
  Stop as StopIcon,
  Replay as ReplayIcon,
  Send as SendIcon,
  EmojiEvents as TrophyIcon,
  ContentCut as TrimIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

function trackGA4(eventName: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') w.gtag('event', eventName, params);
  } catch {
    /* noop */
  }
}

interface Prompt {
  kind: string;
  text: string;
  durationSec: number;
}

interface JobApp {
  id: string;
  jobTitle: string;
  company: string;
  notes?: string | null;
}

interface SessionResult {
  id: string;
  promptText: string;
  durationMs: number | null;
  transcript: string | null;
  overallScore: number | null;
  deliveryScores: Record<string, number> | null;
  feedbackSummary: string | null;
  strengths: string[];
  improvementAreas: string[];
  status: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  resumeId: string | null;
  jobApplicationId?: string | null;
}

function pickVideoMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? '';
}

const DELIVERY_LABELS: Record<string, string> = {
  speech_clarity: 'Tydelig tale',
  filler_words_count: 'Fyllord (antall)',
  energy: 'Energi',
  structure: 'Struktur',
  eye_contact: 'Øyekontakt',
};

export const NextRoleVideoPresentation: React.FC<Props> = ({
  open, onClose, resumeId, jobApplicationId,
}) => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'setup' | 'recording' | 'preview' | 'analyzing' | 'result'>('setup');

  // Setup
  const [selectedAppId, setSelectedAppId] = useState<string>(jobApplicationId ?? '');
  const [selectedPromptKind, setSelectedPromptKind] = useState<string>('about_yourself');
  const [customPrompt, setCustomPrompt] = useState('');
  const [targetDuration, setTargetDuration] = useState<60 | 90 | 120>(60);

  // Recording
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);
  // Trim (i sekunder)
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 0]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // Henter prompts + jobbsøknader
  const { data: prompts = [] } = useQuery<Prompt[]>({
    queryKey: ['video-presentation-prompts'],
    queryFn: async () => {
      const d = (await apiRequest('/api/video-presentations/prompts')) as { prompts: Prompt[] };
      return d.prompts;
    },
    enabled: open,
  });

  const { data: applications = [] } = useQuery<JobApp[]>({
    queryKey: ['job-applications', user?.id],
    queryFn: async () => {
      const d = (await apiRequest('/api/job-applications', {
        headers: { 'x-user-id': user?.id || '' },
      })) as JobApp[];
      return Array.isArray(d) ? d : [];
    },
    enabled: open && !jobApplicationId && !!user?.id,
  });

  // Resette ved åpning
  useEffect(() => {
    if (open) {
      setPhase('setup');
      setRecording(false);
      setRecordedBlob(null);
      setRecordedPreviewUrl((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
      setRecordingMs(0);
      setRecordedDurationSec(0);
      setTrimRange([0, 0]);
      setSessionId(null);
      setResult(null);
      setError(null);
      setSelectedAppId(jobApplicationId ?? '');
      trackGA4('nextrole_video_presentation_opened');
    } else {
      stopMediaTracks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stopMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const startRecording = async () => {
    if (typeof MediaRecorder === 'undefined') {
      setError('Nettleseren støtter ikke video-opptak.');
      return;
    }
    if (!resumeId) {
      setError('Velg en CV først.');
      return;
    }
    const promptText = selectedPromptKind === 'custom'
      ? customPrompt.trim()
      : (prompts.find((p) => p.kind === selectedPromptKind)?.text ?? '');
    if (!promptText) {
      setError('Velg en prompt eller skriv en egen.');
      return;
    }

    try {
      // 1) Opprett sesjon i backend
      const createRes = await apiRequest('/api/video-presentations', {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId,
          jobApplicationId: selectedAppId || undefined,
          promptText,
          promptKind: selectedPromptKind,
          targetDurationSec: targetDuration,
        }),
      });
      setSessionId(createRes.session.id);

      // 2) Få kamera- og mic-tilgang
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      // 3) Start MediaRecorder
      const mime = pickVideoMime();
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recordedChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: mime || 'video/webm',
        });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedPreviewUrl(url);
        stopMediaTracks();
        setPhase('preview');
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setRecording(true);
      setPhase('recording');
      const startedAt = Date.now();
      recordingTimerRef.current = window.setInterval(() => {
        const ms = Date.now() - startedAt;
        setRecordingMs(ms);
        // Auto-stopp ved 5 sek over target
        if (ms > (targetDuration + 5) * 1000) {
          stopRecording();
        }
      }, 100);
      trackGA4('nextrole_video_recording_started', {
        prompt_kind: selectedPromptKind,
        target_duration: targetDuration,
      });
    } catch (err) {
      console.error('Video-opptak feilet', err);
      setError('Kunne ikke starte kamera. Sjekk nettleser-tillatelser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    trackGA4('nextrole_video_recording_stopped', { duration_ms: recordingMs });
  };

  const resetRecording = () => {
    if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl);
    setRecordedBlob(null);
    setRecordedPreviewUrl(null);
    setRecordingMs(0);
    setRecordedDurationSec(0);
    setTrimRange([0, 0]);
    setPhase('setup');
  };

  // Når playback-videoen er klar — sett trim-range til hele klippet
  const handleVideoLoaded = () => {
    if (playbackVideoRef.current) {
      const dur = playbackVideoRef.current.duration;
      if (Number.isFinite(dur) && dur > 0) {
        setRecordedDurationSec(dur);
        setTrimRange([0, dur]);
      }
    }
  };

  // Ekstrahere keyframes fra videoen ved tidsstempler
  const extractKeyframes = async (
    video: HTMLVideoElement,
    timestamps: number[],
  ): Promise<string[]> => {
    const canvas = document.createElement('canvas');
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 360;
    canvas.width = Math.min(w, 720);
    canvas.height = Math.round((canvas.width / w) * h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    const frames: string[] = [];
    for (const t of timestamps) {
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', 0.7));
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        video.currentTime = t;
      });
    }
    return frames;
  };

  const handleSendForAnalysis = async () => {
    if (!recordedBlob || !sessionId) return;
    setLoading(true);
    setError(null);
    setPhase('analyzing');

    try {
      // 1) Ekstrahere 5 keyframes jevnt fordelt innen trim-range
      const video = playbackVideoRef.current;
      let keyframes: string[] = [];
      if (video && recordedDurationSec > 0) {
        const [start, end] = trimRange;
        const span = Math.max(1, end - start);
        const sampleTimes = [
          start + span * 0.1,
          start + span * 0.3,
          start + span * 0.5,
          start + span * 0.7,
          start + span * 0.9,
        ];
        try {
          keyframes = await extractKeyframes(video, sampleTimes);
        } catch (kfErr) {
          console.warn('Keyframe-ekstraksjon feilet', kfErr);
        }
      }

      // 2) Send video + keyframes til backend (FormData multipart)
      const form = new FormData();
      const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
      form.append('video', recordedBlob, `video-${sessionId}.${ext}`);
      form.append('keyframes', JSON.stringify(keyframes));

      const res = await fetch(
        `/api/video-presentations/${sessionId}/upload`,
        {
          method: 'POST',
          headers: { 'x-user-id': user?.id || '' },
          body: form,
        },
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`${res.status} ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      setResult(data.session);
      setPhase('result');
      trackGA4('nextrole_video_presentation_analyzed', {
        session_id: sessionId,
        overall_score: data.session?.overallScore ?? null,
        keyframes_count: keyframes.length,
      });
    } catch (err) {
      console.error('Analyse feilet', err);
      setError('Analysen feilet. Prøv på nytt eller send med kortere video.');
      setPhase('preview');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectedPromptText = selectedPromptKind === 'custom'
    ? customPrompt
    : (prompts.find((p) => p.kind === selectedPromptKind)?.text ?? '');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <VideocamIcon sx={{ color: '#F5B82E' }} />
          <Typography variant="h6" component="span">Video-presentasjon</Typography>
          <Chip label="Pro" size="small" sx={{ bgcolor: '#FFF4D6', color: '#7A5A0B', fontWeight: 700 }} />
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* SETUP */}
        {phase === 'setup' && (
          <Stack spacing={2}>
            <Alert severity="info">
              Tren på "fortell om deg selv"-presentasjon eller en annen pitch.
              AI vurderer både innhold, taleflyt og kroppsspråk.
            </Alert>

            {!jobApplicationId && (
              <TextField
                select
                label="Knytt til jobbsøknad (valgfritt)"
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                fullWidth
                helperText="Brukes til å scoree presentasjonen mot stillingens kompetansekrav"
              >
                <MenuItem value=""><em>— Ingen kobling —</em></MenuItem>
                {applications.map((a) => (
                  <MenuItem key={a.id} value={a.id}>{a.jobTitle} — {a.company}</MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              select
              label="Prompt"
              value={selectedPromptKind}
              onChange={(e) => setSelectedPromptKind(e.target.value)}
              fullWidth
            >
              {prompts.map((p) => (
                <MenuItem key={p.kind} value={p.kind}>
                  {p.text.slice(0, 60)}{p.text.length > 60 ? '…' : ''}
                </MenuItem>
              ))}
              <MenuItem value="custom"><em>Egen prompt</em></MenuItem>
            </TextField>

            {selectedPromptKind === 'custom' && (
              <TextField
                label="Din prompt"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                placeholder="Hva vil du øve på?"
              />
            )}

            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#FAF7F0' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                DIN PROMPT
              </Typography>
              <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                "{selectedPromptText || '— velg en prompt over —'}"
              </Typography>
            </Paper>

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                MÅLLENGDE
              </Typography>
              <ToggleButtonGroup
                value={targetDuration}
                exclusive
                onChange={(_, v) => v && setTargetDuration(v)}
                size="small"
              >
                <ToggleButton value={60}>60 sek</ToggleButton>
                <ToggleButton value={90}>90 sek</ToggleButton>
                <ToggleButton value={120}>2 min</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}

        {/* RECORDING */}
        {phase === 'recording' && (
          <Stack spacing={2} alignItems="center">
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                maxWidth: 640,
                aspectRatio: '16/9',
                bgcolor: '#000',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                muted
                playsInline
              />
              {recording && (
                <Box sx={{
                  position: 'absolute', top: 12, left: 12,
                  display: 'flex', alignItems: 'center', gap: 0.8,
                  bgcolor: 'rgba(0,0,0,0.6)', px: 1.2, py: 0.5, borderRadius: 4,
                }}>
                  <Box sx={{
                    width: 10, height: 10, borderRadius: '50%',
                    bgcolor: '#DC2626',
                    animation: 'pulse 1.2s infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                      '50%': { opacity: 0.4, transform: 'scale(1.3)' },
                    },
                  }} />
                  <Typography variant="caption" sx={{ color: '#fff', fontFamily: 'monospace', fontWeight: 700 }}>
                    REC · {formatTime(recordingMs)} / {formatTime(targetDuration * 1000)}
                  </Typography>
                </Box>
              )}
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, (recordingMs / (targetDuration * 1000)) * 100)}
              sx={{ width: '100%', height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { bgcolor: '#DC2626' } }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
              "{selectedPromptText}"
            </Typography>
          </Stack>
        )}

        {/* PREVIEW + TRIM */}
        {phase === 'preview' && recordedPreviewUrl && (
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <video
                ref={playbackVideoRef}
                src={recordedPreviewUrl}
                controls
                onLoadedMetadata={handleVideoLoaded}
                style={{ width: '100%', maxWidth: 640, borderRadius: 8 }}
              />
            </Box>

            {recordedDurationSec > 0 && (
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <TrimIcon sx={{ fontSize: 18, color: '#7A5A0B' }} />
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    TRIM (kun den delen mellom håndtakene sendes til AI)
                  </Typography>
                </Stack>
                <Slider
                  value={trimRange}
                  onChange={(_, v) => setTrimRange(v as [number, number])}
                  min={0}
                  max={recordedDurationSec}
                  step={0.1}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v.toFixed(1)}s`}
                  sx={{ color: '#F5B82E' }}
                />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    Fra {trimRange[0].toFixed(1)}s
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Lengde {(trimRange[1] - trimRange[0]).toFixed(1)}s
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Til {trimRange[1].toFixed(1)}s
                  </Typography>
                </Stack>
              </Paper>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}

        {/* ANALYZING */}
        {phase === 'analyzing' && (
          <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
            <CircularProgress sx={{ color: '#F5B82E' }} />
            <Typography variant="body2">
              Analyserer video … (transkripsjon + body language + scoring)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tar typisk 15-30 sek.
            </Typography>
          </Stack>
        )}

        {/* RESULT */}
        {phase === 'result' && result && (
          <Stack spacing={2.5}>
            <Box sx={{ textAlign: 'center' }}>
              <TrophyIcon sx={{ fontSize: 48, color: '#F5B82E', mb: 0.5 }} />
              {result.overallScore !== null && (
                <Typography variant="h2" sx={{
                  fontWeight: 900,
                  color: result.overallScore >= 80 ? '#10B981' :
                         result.overallScore >= 60 ? '#F5B82E' : '#DC2626',
                }}>
                  {result.overallScore}
                  <Box component="span" sx={{ fontSize: '1.5rem', color: 'text.secondary' }}>/100</Box>
                </Typography>
              )}
            </Box>

            {result.feedbackSummary && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  {result.feedbackSummary}
                </Typography>
              </Paper>
            )}

            {result.deliveryScores && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                  LEVERINGS-SCORE
                </Typography>
                <Stack spacing={0.8}>
                  {Object.entries(result.deliveryScores).map(([k, v]) => (
                    <Stack key={k} direction="row" alignItems="center" spacing={1}>
                      <Typography variant="caption" sx={{ minWidth: 130 }}>
                        {DELIVERY_LABELS[k] ?? k}
                      </Typography>
                      <Box sx={{ flex: 1, position: 'relative' }}>
                        <LinearProgress
                          variant="determinate"
                          value={k === 'filler_words_count' ? Math.min(100, v * 8) : v * 10}
                          sx={{ height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': {
                            bgcolor: v >= 7 ? '#10B981' : v >= 4 ? '#F5B82E' : '#DC2626',
                          }}}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ minWidth: 32, textAlign: 'right', fontWeight: 700 }}>
                        {k === 'filler_words_count' ? v : `${v}/10`}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {result.strengths.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#10B981' }}>
                  Styrker
                </Typography>
                <Stack spacing={0.5}>
                  {result.strengths.map((s, i) => (
                    <Typography key={i} variant="body2">• {s}</Typography>
                  ))}
                </Stack>
              </Box>
            )}

            {result.improvementAreas.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#DC2626' }}>
                  Forbedringer
                </Typography>
                <Stack spacing={0.5}>
                  {result.improvementAreas.map((s, i) => (
                    <Typography key={i} variant="body2">• {s}</Typography>
                  ))}
                </Stack>
              </Box>
            )}

            {result.transcript && (
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#FAFAFA' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                  TRANSKRIPSJON
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  {result.transcript}
                </Typography>
              </Paper>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
        {phase === 'setup' && (
          <Button
            variant="contained"
            startIcon={<VideocamIcon />}
            onClick={startRecording}
            disabled={loading || !resumeId || !selectedPromptText}
            sx={{ bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' }, color: '#1F2937', fontWeight: 700 }}
          >
            Start opptak
          </Button>
        )}
        {phase === 'recording' && (
          <Button
            variant="contained"
            startIcon={<StopIcon />}
            onClick={stopRecording}
            sx={{ bgcolor: '#1F2937', '&:hover': { bgcolor: '#0F172A' }, color: '#fff' }}
          >
            Stopp opptak
          </Button>
        )}
        {phase === 'preview' && (
          <>
            <Button startIcon={<ReplayIcon />} onClick={resetRecording}>
              Ta nytt opptak
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              onClick={handleSendForAnalysis}
              disabled={loading || !recordedBlob}
              sx={{ bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' }, color: '#1F2937', fontWeight: 700 }}
            >
              {loading ? 'Sender …' : 'Send til AI-analyse'}
            </Button>
          </>
        )}
        {phase === 'result' && (
          <Button onClick={resetRecording} variant="outlined">
            Ny presentasjon
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default NextRoleVideoPresentation;
