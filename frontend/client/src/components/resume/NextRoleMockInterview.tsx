/**
 * NextRoleMockInterview — chat-basert intervjutrening (Pro-feature)
 *
 * Brukerflyt:
 *   1. Bruker velger jobbsøknad (fra Kanban) eller limer inn JD
 *   2. Velger modus: Tekst eller Tale (Whisper-transkripsjon)
 *   3. Klikk "Start" → backend ekstraherer kompetansekrav fra JD
 *      + genererer Q1
 *   4. Hvert svar gir feedback + neste spørsmål
 *   5. Etter 8 spørsmål: samlet vurdering med score per kompetanse
 *
 * Kobling til jobbsøknad: hvis `jobApplicationId` sendes inn, hopper
 * vi over JD-paste-skjemaet og bruker søknadens data direkte.
 * Ellers viser vi picker + JD-textarea som fallback.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, Stack, Paper, Chip,
  CircularProgress, LinearProgress, Alert, IconButton, Avatar,
  ToggleButtonGroup, ToggleButton, MenuItem, Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Mic as MicIcon,
  Replay as ReplayIcon,
  EmojiEvents as TrophyIcon,
  AutoAwesome as AIIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  TextFields as TextFieldsIcon,
  AccountTree as CaseIcon,
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

interface CompetenceRequirement {
  key: string;
  label: string;
  why: string;
}

interface Message {
  role: 'question' | 'answer' | 'feedback';
  content: string;
  category?: string;
  feedbackScore?: number;
  audioUrl?: string;
  durationMs?: number;
}

interface JobApplication {
  id: string;
  jobTitle: string;
  company: string;
  jobUrl?: string | null;
  notes?: string | null;
  source?: string | null;
  status: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  resumeId: string | null;
  /** Hvis satt: bruker søknaden direkte uten JD-paste-skjema */
  jobApplicationId?: string | null;
}

type Mode = 'qa_text' | 'qa_voice' | 'case';

// Velg en MediaRecorder-mime som er bredt støttet og fungerer med
// Whisper (webm/opus støttes direkte av Whisper API).
function pickRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? '';
}

export const NextRoleMockInterview: React.FC<Props> = ({
  open, onClose, resumeId, jobApplicationId,
}) => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'setup' | 'interview' | 'complete'>('setup');

  // Setup-state
  const [mode, setMode] = useState<Mode>('qa_text');
  const [selectedAppId, setSelectedAppId] = useState<string>(jobApplicationId ?? '');
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  // Case-modus: bruker kan valgfritt lime inn casen de fikk fra arbeidsgiver.
  // Hvis tom, lar Claude lage en relevant case basert på stillingen.
  const [casePrompt, setCasePrompt] = useState('');
  // Case-modus: arbeidsfelt for kandidatens egen struktur (Profit Tree etc).
  // Brukes som "scratch pad" mens de bygger rammeverk i hodet.
  const [caseStructure, setCaseStructure] = useState('');

  // Interview-state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [totalQuestions] = useState(8);
  const [answer, setAnswer] = useState('');
  const [competenceRequirements, setCompetenceRequirements] = useState<CompetenceRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    score: number | null;
    summary: string;
    strengths: string[];
    improvements: string[];
  } | null>(null);

  // Voice-state
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Henter brukerens jobbsøknader for picker ─────────────────────
  const { data: applications = [] } = useQuery<JobApplication[]>({
    queryKey: ['job-applications', user?.id],
    queryFn: async () => {
      const data = (await apiRequest('/api/job-applications', {
        headers: { 'x-user-id': user?.id || '' },
      })) as JobApplication[];
      return Array.isArray(data) ? data : [];
    },
    enabled: open && !jobApplicationId && !!user?.id,
  });

  // Hvis prop-bundet til en søknad: forhåndsvalg den
  useEffect(() => {
    if (jobApplicationId && open) {
      setSelectedAppId(jobApplicationId);
    }
  }, [jobApplicationId, open]);

  // Reset state når dialog åpnes
  useEffect(() => {
    if (open) {
      setPhase('setup');
      setMessages([]);
      setAnswer('');
      setError(null);
      setSummary(null);
      setSessionId(null);
      setQuestionIdx(0);
      setCompetenceRequirements([]);
      setRecordedBlob(null);
      setRecordedPreviewUrl(null);
      setRecording(false);
      setRecordingMs(0);
      trackGA4('nextrole_mock_interview_opened', { feature: 'mock_interview' });
    } else {
      // Rydd opp media stream hvis åpen
      stopRecorderTracks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Voice: recording lifecycle ───────────────────────────────────
  function stopRecorderTracks() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  const startRecording = async () => {
    if (typeof MediaRecorder === 'undefined') {
      setError('Nettleseren din støtter ikke lydopptak. Bytt til tekst-modus.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mime = pickRecorderMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recordedChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: mime || 'audio/webm',
        });
        setRecordedBlob(blob);
        setRecordedPreviewUrl(URL.createObjectURL(blob));
        stopRecorderTracks();
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setRecording(true);
      setRecordingMs(0);
      setRecordedBlob(null);
      setRecordedPreviewUrl(null);
      const startedAt = Date.now();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingMs(Date.now() - startedAt);
      }, 100);
      trackGA4('nextrole_voice_recording_started', { question_idx: questionIdx });
    } catch (err) {
      console.error('Mic-access feilet', err);
      setError('Kunne ikke få tilgang til mikrofonen. Sjekk nettleser-tillatelser.');
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
    trackGA4('nextrole_voice_recording_stopped', {
      question_idx: questionIdx,
      duration_ms: recordingMs,
    });
  };

  const resetRecording = () => {
    if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl);
    setRecordedBlob(null);
    setRecordedPreviewUrl(null);
    setRecordingMs(0);
  };

  // ── Start-sesjon ─────────────────────────────────────────────────
  const handleStart = async () => {
    // Krev enten en valgt søknad ELLER en JD-tekst
    if (!resumeId) {
      setError('Velg en CV først.');
      return;
    }
    if (!selectedAppId && !jobDescription.trim()) {
      setError('Velg en jobbsøknad eller lim inn en stillingsannonse.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/api/interview-sessions', {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeId,
          jobApplicationId: selectedAppId || undefined,
          jobDescription: jobDescription.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          company: company.trim() || undefined,
          totalQuestions: mode === 'case' ? 6 : totalQuestions,
          mode,
          casePrompt: mode === 'case' ? casePrompt.trim() || undefined : undefined,
        }),
      });
      setSessionId(res.sessionId);
      setMessages([{ role: 'question', content: res.question, category: res.category }]);
      setQuestionIdx(0);
      setCompetenceRequirements(Array.isArray(res.competenceRequirements) ? res.competenceRequirements : []);
      setPhase('interview');
      trackGA4('nextrole_mock_interview_started', {
        session_id: res.sessionId,
        mode,
        has_job_application: !!selectedAppId,
        competence_count: Array.isArray(res.competenceRequirements) ? res.competenceRequirements.length : 0,
        first_question_category: res.category ?? null,
      });
    } catch (err) {
      console.error('Start intervju feilet', err);
      setError('Kunne ikke starte intervjuet. Prøv igjen.');
      trackGA4('nextrole_mock_interview_error', { phase: 'start' });
    } finally {
      setLoading(false);
    }
  };

  // ── Send tekst-svar ──────────────────────────────────────────────
  const handleAnswerText = async () => {
    if (!sessionId || !answer.trim()) return;
    setLoading(true);
    const userAnswer = answer.trim();
    setMessages((prev) => [...prev, { role: 'answer', content: userAnswer }]);
    setAnswer('');
    try {
      const res = await apiRequest(`/api/interview-sessions/${sessionId}/answer`, {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answer: userAnswer }),
      });
      await handleAnswerResponse(res);
    } catch (err) {
      console.error('Svar feilet', err);
      setError('Kunne ikke sende svar. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  // ── Send audio-svar ──────────────────────────────────────────────
  const handleAnswerAudio = async () => {
    if (!sessionId || !recordedBlob) return;
    setTranscribing(true);
    setLoading(true);
    try {
      const form = new FormData();
      // MediaRecorder gir vanligvis webm. Bruk det.
      const ext = recordedBlob.type.includes('mp4') ? 'mp4' :
                  recordedBlob.type.includes('ogg') ? 'ogg' : 'webm';
      form.append('audio', recordedBlob, `answer-${questionIdx}.${ext}`);

      const baseUrl = '';
      const res = await fetch(
        `${baseUrl}/api/interview-sessions/${sessionId}/answer-audio`,
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

      // Bygg "answer"-bubble med audio + transcript
      setMessages((prev) => [
        ...prev,
        {
          role: 'answer',
          content: data.transcript ?? '(ingen tale registrert)',
          audioUrl: data.audioUrl ?? undefined,
          durationMs: data.durationMs ?? undefined,
        },
      ]);
      resetRecording();
      await handleAnswerResponse(data);
    } catch (err) {
      console.error('Audio-svar feilet', err);
      setError('Kunne ikke sende lydopptak. Prøv igjen, eller bytt til tekst.');
      trackGA4('nextrole_voice_send_error', { question_idx: questionIdx });
    } finally {
      setTranscribing(false);
      setLoading(false);
    }
  };

  // Felles respons-håndtering — brukes av både tekst og audio
  const handleAnswerResponse = async (res: {
    feedback?: string;
    score?: number;
    questionIdx?: number;
    isFinal?: boolean;
    nextQuestion?: string;
    nextCategory?: string;
  }) => {
    if (res.feedback) {
      setMessages((prev) => [
        ...prev,
        { role: 'feedback', content: res.feedback!, feedbackScore: res.score },
      ]);
    }
    if (res.isFinal && sessionId) {
      const final = await apiRequest(`/api/interview-sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '' },
      });
      setSummary({
        score: final.overallScore,
        summary: final.summary ?? '',
        strengths: final.strengths ?? [],
        improvements: final.improvements ?? [],
      });
      setPhase('complete');
      trackGA4('nextrole_mock_interview_completed', {
        session_id: sessionId,
        mode,
        overall_score: final.overallScore ?? null,
        total_questions: totalQuestions,
      });
    } else if (res.nextQuestion && typeof res.questionIdx === 'number') {
      setQuestionIdx(res.questionIdx);
      setMessages((prev) => [
        ...prev,
        { role: 'question', content: res.nextQuestion!, category: res.nextCategory },
      ]);
    }
  };

  const formatRecordingTime = (ms: number): string => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = ((questionIdx + 1) / totalQuestions) * 100;
  const selectedApp = applications.find((a) => a.id === selectedAppId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AIIcon sx={{ color: '#F5B82E' }} />
          <Typography variant="h6" component="span">AI Intervjutrening</Typography>
          <Chip label="Pro" size="small" sx={{ bgcolor: '#FFF4D6', color: '#7A5A0B', fontWeight: 700 }} />
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {/* SETUP-fase */}
        {phase === 'setup' && (
          <Stack spacing={2}>
            <Alert severity="info">
              {mode === 'case'
                ? 'Case-intervju: Claude opptrer som kresen intervjuer (McKinsey/BCG-stil) og leder deg gjennom case-faser: avklaring → struktur → analyse → anbefaling.'
                : 'Velg jobbsøknad fra Kanban — så ekstraherer AI kompetansekravene fra annonsen og lager skreddersydde spørsmål.'}
            </Alert>

            <Alert
              severity="warning"
              icon={false}
              sx={{
                py: 0.5, px: 1.5, fontSize: 12,
                bgcolor: '#F9FAFB',
                color: 'text.secondary',
                border: '1px solid', borderColor: 'divider',
                '& .MuiAlert-message': { p: 0 },
              }}
            >
              <Typography variant="caption">
                Mock Interview sender CV-utdrag (tittel, by, erfaring, ferdigheter)
                til AI — aldri navn, e-post eller telefon. Fri-tekst scrubbes for
                fødselsnumre og adresser.{' '}
                <Box component="a" href="/privacy-policy#nextrole" target="_blank" sx={{ color: '#3B82F6' }}>
                  Detaljer
                </Box>
              </Typography>
            </Alert>

            {/* Modus-toggle */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                TYPE INTERVJU
              </Typography>
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(_, v) => v && setMode(v)}
                size="small"
                fullWidth
              >
                <ToggleButton value="qa_text" sx={{ textTransform: 'none' }}>
                  <TextFieldsIcon sx={{ mr: 1, fontSize: 18 }} />
                  Q&A tekst
                </ToggleButton>
                <ToggleButton value="qa_voice" sx={{ textTransform: 'none' }}>
                  <MicIcon sx={{ mr: 1, fontSize: 18 }} />
                  Q&A tale
                </ToggleButton>
                <ToggleButton value="case" sx={{ textTransform: 'none' }}>
                  <CaseIcon sx={{ mr: 1, fontSize: 18 }} />
                  Case
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {mode === 'qa_voice'
                  ? 'Du svarer ved å snakke. Whisper transkriberer, Claude gir feedback på både innhold og taleflyt.'
                  : mode === 'case'
                  ? 'Claude presenterer en case og presser deg på struktur, MECE, tallgrunnlag og anbefaling.'
                  : 'Du skriver svarene dine i tekstfeltet.'}
              </Typography>
            </Box>

            {/* Case-prompt — bare i case-modus */}
            {mode === 'case' && (
              <TextField
                label="Case-prompt (valgfritt)"
                value={casePrompt}
                onChange={(e) => setCasePrompt(e.target.value)}
                fullWidth
                multiline
                minRows={3}
                maxRows={6}
                placeholder="Hvis du har fått en konkret case fra arbeidsgiver, lim inn her. Ellers lar vi Claude lage en relevant for stillingen."
                helperText="Tom = Claude genererer case basert på stillingen"
              />
            )}

            {/* Jobbsøknad-picker */}
            {!jobApplicationId && (
              <TextField
                select
                label="Velg jobbsøknad"
                value={selectedAppId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedAppId(id);
                  const app = applications.find((a) => a.id === id);
                  if (app) {
                    setJobTitle(app.jobTitle);
                    setCompany(app.company);
                    if (app.notes) setJobDescription(app.notes);
                  }
                }}
                fullWidth
                helperText={applications.length === 0
                  ? 'Du har ingen lagrede søknader ennå. Lim inn annonsen under.'
                  : `${applications.length} søknader tilgjengelig`}
              >
                <MenuItem value="">
                  <em>— Lim inn annonsen manuelt —</em>
                </MenuItem>
                {applications.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.jobTitle} — {a.company}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {jobApplicationId && selectedApp && (
              <Alert severity="success" sx={{ alignItems: 'center' }}>
                Trening for: <strong>{selectedApp.jobTitle}</strong> hos <strong>{selectedApp.company}</strong>
              </Alert>
            )}

            {/* JD fallback (vises hvis ikke valgt søknad eller for å overstyre) */}
            {!selectedAppId && (
              <>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Stilling"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Selskap"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    fullWidth
                  />
                </Stack>
                <TextField
                  label="Stillingsannonse"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  fullWidth
                  required
                  multiline
                  minRows={5}
                  maxRows={10}
                  placeholder="Lim inn hele stillingsannonsen her — vi bruker den til å lage relevante spørsmål og evaluere svarene dine mot konkrete kompetansekrav."
                />
              </>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}

        {/* INTERVJU-fase */}
        {phase === 'interview' && (
          <Box>
            {/* Progresjon + kompetanse-checklist */}
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={progressPct}
                  sx={{ height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { bgcolor: '#F5B82E' } }}
                />
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {questionIdx + 1}/{totalQuestions}
              </Typography>
            </Stack>

            {competenceRequirements.length > 0 && (
              <Paper variant="outlined" sx={{ p: 1.2, mb: 1.5, bgcolor: '#FAF7F0' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: '#7A5A0B' }}>
                  KOMPETANSEKRAV FRA ANNONSEN
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {competenceRequirements.map((c) => (
                    <Tooltip key={c.key} title={c.why} placement="top" arrow>
                      <Chip
                        label={c.label}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 22, fontSize: 11,
                          bgcolor: '#fff', borderColor: '#F5B82E',
                          '& .MuiChip-label': { fontWeight: 600 },
                        }}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              </Paper>
            )}

            {/* Chat-vindu */}
            <Box
              ref={scrollRef}
              sx={{
                maxHeight: 380, overflowY: 'auto', mb: 1.5,
                bgcolor: '#FAFAFA', p: 1.5, borderRadius: 2,
              }}
            >
              <Stack spacing={1.5}>
                {messages.map((m, i) => (
                  <Stack
                    key={i}
                    direction={m.role === 'answer' ? 'row-reverse' : 'row'}
                    spacing={1.5}
                    alignItems="flex-start"
                  >
                    <Avatar sx={{
                      bgcolor: m.role === 'answer' ? '#1F2937' : m.role === 'feedback' ? '#10B981' : '#F5B82E',
                      width: 28, height: 28,
                    }}>
                      {m.role === 'answer' ? <PersonIcon sx={{ fontSize: 16 }} /> : <AIIcon sx={{ fontSize: 16 }} />}
                    </Avatar>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.2,
                        maxWidth: '78%',
                        bgcolor: m.role === 'answer' ? '#fff' : m.role === 'feedback' ? '#ECFDF5' : '#FFF8E1',
                        borderColor: m.role === 'feedback' ? '#10B981' : 'divider',
                      }}
                    >
                      {m.category && (
                        <Chip label={m.category} size="small"
                          sx={{ height: 18, fontSize: 10, mb: 0.5, bgcolor: '#FFF4D6', color: '#7A5A0B' }} />
                      )}
                      {m.role === 'feedback' && typeof m.feedbackScore === 'number' && (
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#10B981', display: 'block', mb: 0.5 }}>
                          Feedback · {m.feedbackScore}/10
                        </Typography>
                      )}
                      {/* Audio playback for voice-svar */}
                      {m.audioUrl && (
                        <Box sx={{ mb: 0.5 }}>
                          <audio src={m.audioUrl} controls style={{ width: '100%', maxWidth: 320, height: 32 }} />
                        </Box>
                      )}
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                        {m.content}
                      </Typography>
                      {m.durationMs && (
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.3 }}>
                          {(m.durationMs / 1000).toFixed(1)} sek
                        </Typography>
                      )}
                    </Paper>
                  </Stack>
                ))}
                {(loading || transcribing) && (
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pl: 5 }}>
                    <CircularProgress size={14} sx={{ color: '#F5B82E' }} />
                    <Typography variant="caption" color="text.secondary">
                      {transcribing ? 'Transkriberer …' : 'Claude tenker …'}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Box>

            {/* Case-modus: scratchpad-sidefelt for å skrive ned struktur */}
            {mode === 'case' && (
              <Paper variant="outlined" sx={{ p: 1.2, mb: 1, bgcolor: '#FFFEF9' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: '#7A5A0B' }}>
                  RAMMEVERK / NOTATER (KUN FOR DEG)
                </Typography>
                <TextField
                  value={caseStructure}
                  onChange={(e) => setCaseStructure(e.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={4}
                  placeholder="Skriv ned Profit Tree, MECE-grener, hypoteser etc her — Claude ser ikke dette, men det hjelper deg å holde oversikt."
                  size="small"
                  InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12 } }}
                />
              </Paper>
            )}

            {/* Svar-input — tekst eller voice */}
            {(mode === 'qa_text' || mode === 'case') ? (
              <TextField
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                fullWidth
                multiline
                minRows={3}
                maxRows={6}
                placeholder={mode === 'case'
                  ? 'Skriv ditt svar (avklaring, struktur, analyse eller anbefaling)'
                  : 'Skriv ditt svar (STAR-formatet: Situasjon, Oppgave, Handling, Resultat)'}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleAnswerText();
                  }
                }}
                helperText={`${answer.length} tegn · Cmd/Ctrl + Enter for å sende`}
              />
            ) : (
              <Paper variant="outlined" sx={{ p: 2 }}>
                {!recording && !recordedBlob && (
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
                    <Button
                      variant="contained"
                      startIcon={<MicIcon />}
                      onClick={startRecording}
                      disabled={loading}
                      sx={{
                        bgcolor: '#DC2626',
                        '&:hover': { bgcolor: '#B91C1C' },
                        color: '#fff',
                      }}
                    >
                      Start opptak
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      Sikt mot 30-60 sek per svar
                    </Typography>
                  </Stack>
                )}

                {recording && (
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 12, height: 12, borderRadius: '50%',
                        bgcolor: '#DC2626',
                        animation: 'pulse 1.2s infinite',
                        '@keyframes pulse': {
                          '0%': { opacity: 1, transform: 'scale(1)' },
                          '50%': { opacity: 0.4, transform: 'scale(1.2)' },
                          '100%': { opacity: 1, transform: 'scale(1)' },
                        },
                      }} />
                      <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {formatRecordingTime(recordingMs)}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      startIcon={<StopIcon />}
                      onClick={stopRecording}
                      sx={{ bgcolor: '#1F2937', '&:hover': { bgcolor: '#0F172A' } }}
                    >
                      Stopp opptak
                    </Button>
                  </Stack>
                )}

                {recordedBlob && !recording && recordedPreviewUrl && (
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        Opptak ferdig — {formatRecordingTime(recordingMs)}
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<ReplayIcon />}
                        onClick={resetRecording}
                        disabled={loading}
                      >
                        Ta nytt opptak
                      </Button>
                    </Stack>
                    <audio src={recordedPreviewUrl} controls style={{ width: '100%', height: 36 }} />
                  </Stack>
                )}
              </Paper>
            )}

            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
          </Box>
        )}

        {/* COMPLETE-fase */}
        {phase === 'complete' && summary && (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center' }}>
              <TrophyIcon sx={{ fontSize: 56, color: '#F5B82E', mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>Intervju fullført</Typography>
              {summary.score !== null && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="h2" sx={{
                    fontWeight: 900,
                    color: summary.score >= 80 ? '#10B981' : summary.score >= 60 ? '#F5B82E' : '#DC2626',
                  }}>
                    {summary.score}
                    <Box component="span" sx={{ fontSize: '1.5rem', color: 'text.secondary' }}>/100</Box>
                  </Typography>
                </Box>
              )}
            </Box>
            {summary.summary && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{summary.summary}</Typography>
              </Paper>
            )}
            {summary.strengths.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#10B981' }}>Styrker</Typography>
                <Stack spacing={0.5}>
                  {summary.strengths.map((s, i) => (
                    <Typography key={i} variant="body2">• {s}</Typography>
                  ))}
                </Stack>
              </Box>
            )}
            {summary.improvements.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#DC2626' }}>Forbedrings-områder</Typography>
                <Stack spacing={0.5}>
                  {summary.improvements.map((s, i) => (
                    <Typography key={i} variant="body2">• {s}</Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
        {phase === 'setup' && (
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
            onClick={handleStart}
            disabled={loading || !resumeId || (!selectedAppId && !jobDescription.trim())}
            sx={{ bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' }, color: '#1F2937', fontWeight: 700 }}
          >
            {loading ? 'Klargjør …' : 'Start intervju'}
          </Button>
        )}
        {phase === 'interview' && (mode === 'qa_text' || mode === 'case') && (
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleAnswerText}
            disabled={loading || !answer.trim()}
            sx={{ bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' }, color: '#1F2937', fontWeight: 700 }}
          >
            Send svar
          </Button>
        )}
        {phase === 'interview' && mode === 'qa_voice' && (
          <Button
            variant="contained"
            startIcon={transcribing ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={handleAnswerAudio}
            disabled={loading || transcribing || !recordedBlob || recording}
            sx={{ bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' }, color: '#1F2937', fontWeight: 700 }}
          >
            {transcribing ? 'Transkriberer …' : 'Send opptak'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default NextRoleMockInterview;
