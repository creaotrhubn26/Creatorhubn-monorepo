/**
 * NextRoleMockInterview — chat-basert intervjutrening (Pro-feature)
 *
 * Brukerflyt:
 *   1. Bruker limer inn JD (eller velger en lagret jobbsøknad)
 *   2. Klikk "Start intervju" → backend genererer Q1
 *   3. Bruker skriver svar → AI gir feedback + Q2
 *   4. Etter 8 spørsmål: AI gir samlet vurdering med score, styrker, forbedringer
 *
 * Bruker eksisterende /api/interview-sessions-endepunkter.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, Stack, Paper, Chip,
  CircularProgress, LinearProgress, Alert, IconButton, Avatar,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  PlayArrow as PlayIcon,
  EmojiEvents as TrophyIcon,
  AutoAwesome as AIIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

// GA4-helper — feiler stille hvis gtag ikke er injisert (localhost,
// blokkert av consent, eller før analytics-script har lastet).
function trackGA4(eventName: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') {
      w.gtag('event', eventName, params);
    }
  } catch {
    /* noop */
  }
}

interface Message {
  role: 'question' | 'answer' | 'feedback';
  content: string;
  category?: string;
  feedbackScore?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  resumeId: string | null;
}

export const NextRoleMockInterview: React.FC<Props> = ({ open, onClose, resumeId }) => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'setup' | 'interview' | 'complete'>('setup');
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<{ text: string; category: string } | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [totalQuestions] = useState(8);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    score: number | null;
    summary: string;
    strengths: string[];
    improvements: string[];
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset state når dialog åpnes/lukkes
  useEffect(() => {
    if (open) {
      setPhase('setup');
      setMessages([]);
      setAnswer('');
      setError(null);
      setSummary(null);
      setSessionId(null);
      setQuestionIdx(0);
      trackGA4('nextrole_mock_interview_opened', { feature: 'mock_interview' });
    }
  }, [open]);

  // Auto-scroll til bunn
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentQuestion]);

  const handleStart = async () => {
    if (!resumeId || !jobDescription.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/api/interview-sessions', {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId,
          jobDescription: jobDescription.trim(),
          jobTitle: jobTitle.trim() || undefined,
          company: company.trim() || undefined,
          totalQuestions,
        }),
      });
      setSessionId(res.sessionId);
      setCurrentQuestion({ text: res.question, category: res.category });
      setMessages([{ role: 'question', content: res.question, category: res.category }]);
      setQuestionIdx(0);
      setPhase('interview');
      trackGA4('nextrole_mock_interview_started', {
        session_id: res.sessionId,
        has_job_title: Boolean(jobTitle.trim()),
        has_company: Boolean(company.trim()),
        jd_length: jobDescription.trim().length,
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

  const handleAnswer = async () => {
    if (!sessionId || !answer.trim()) return;
    setLoading(true);
    const userAnswer = answer.trim();
    setMessages((prev) => [...prev, { role: 'answer', content: userAnswer }]);
    setAnswer('');
    try {
      const res = await apiRequest(`/api/interview-sessions/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: userAnswer }),
      });
      // Legg til feedback-melding
      setMessages((prev) => [
        ...prev,
        { role: 'feedback', content: res.feedback, feedbackScore: res.score },
      ]);
      trackGA4('nextrole_mock_interview_answer_submitted', {
        session_id: sessionId,
        question_idx: questionIdx,
        answer_length: userAnswer.length,
        feedback_score: typeof res.score === 'number' ? res.score : null,
      });
      if (res.isFinal) {
        // Hent samlet vurdering
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
          overall_score: final.overallScore ?? null,
          strengths_count: Array.isArray(final.strengths) ? final.strengths.length : 0,
          improvements_count: Array.isArray(final.improvements) ? final.improvements.length : 0,
          total_questions: totalQuestions,
        });
      } else if (res.nextQuestion) {
        setQuestionIdx(res.questionIdx);
        setCurrentQuestion({ text: res.nextQuestion, category: res.nextCategory });
        setMessages((prev) => [
          ...prev,
          { role: 'question', content: res.nextQuestion, category: res.nextCategory },
        ]);
      }
    } catch (err) {
      console.error('Svar feilet', err);
      setError('Kunne ikke sende svar. Prøv igjen.');
      trackGA4('nextrole_mock_interview_error', { phase: 'answer', session_id: sessionId });
    } finally {
      setLoading(false);
    }
  };

  const progressPct = ((questionIdx + 1) / totalQuestions) * 100;

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
              Lim inn en stillingsannonse, så genererer Claude {totalQuestions} skreddersydde intervjuspørsmål basert på CV-en din og stillingen.
              Du svarer i tekst, og du får konkret feedback per svar — og en samlet vurdering på slutten.
            </Alert>
            <TextField
              label="Stilling (valgfritt)"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              fullWidth
              placeholder="F.eks. Senior Content Manager"
            />
            <TextField
              label="Selskap (valgfritt)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              fullWidth
              placeholder="F.eks. Equinor"
            />
            <TextField
              label="Stillingsannonse"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              fullWidth
              required
              multiline
              minRows={6}
              maxRows={12}
              placeholder="Lim inn hele stillingsannonsen her — vi bruker den til å lage relevante spørsmål."
              helperText={`${jobDescription.length} tegn`}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}

        {/* INTERVJU-fase */}
        {phase === 'interview' && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={progressPct}
                  sx={{
                    height: 8, borderRadius: 4,
                    '& .MuiLinearProgress-bar': { bgcolor: '#F5B82E' },
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {questionIdx + 1}/{totalQuestions}
              </Typography>
            </Stack>

            <Box
              ref={scrollRef}
              sx={{
                maxHeight: 400, overflowY: 'auto', mb: 2,
                bgcolor: '#FAFAFA', p: 2, borderRadius: 2,
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
                      width: 32, height: 32,
                    }}>
                      {m.role === 'answer' ? <PersonIcon sx={{ fontSize: 18 }} /> : <AIIcon sx={{ fontSize: 18 }} />}
                    </Avatar>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        maxWidth: '75%',
                        bgcolor: m.role === 'answer' ? '#fff' : m.role === 'feedback' ? '#ECFDF5' : '#FFF8E1',
                        borderColor: m.role === 'feedback' ? '#10B981' : 'divider',
                      }}
                    >
                      {m.category && (
                        <Chip
                          label={m.category}
                          size="small"
                          sx={{
                            height: 18, fontSize: 10, mb: 0.5,
                            bgcolor: '#FFF4D6', color: '#7A5A0B',
                          }}
                        />
                      )}
                      {m.role === 'feedback' && typeof m.feedbackScore === 'number' && (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#10B981' }}>
                            Feedback · {m.feedbackScore}/10
                          </Typography>
                        </Stack>
                      )}
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                        {m.content}
                      </Typography>
                    </Paper>
                  </Stack>
                ))}
                {loading && (
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pl: 6 }}>
                    <CircularProgress size={16} sx={{ color: '#F5B82E' }} />
                    <Typography variant="caption" color="text.secondary">
                      Claude tenker …
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Box>

            <TextField
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              fullWidth
              multiline
              minRows={3}
              maxRows={6}
              placeholder="Skriv ditt svar her (bruk STAR-formatet: Situasjon, Oppgave, Handling, Resultat)"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleAnswer();
                }
              }}
              helperText={`${answer.length} tegn · Cmd/Ctrl + Enter for å sende`}
            />
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
          </Box>
        )}

        {/* COMPLETE-fase */}
        {phase === 'complete' && summary && (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center' }}>
              <TrophyIcon sx={{ fontSize: 64, color: '#F5B82E', mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Intervju fullført
              </Typography>
              {summary.score !== null && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="h2" sx={{
                    fontWeight: 900,
                    color: summary.score >= 80 ? '#10B981' : summary.score >= 60 ? '#F5B82E' : '#DC2626',
                  }}>
                    {summary.score}
                    <Box component="span" sx={{ fontSize: '1.5rem', color: 'text.secondary' }}>/100</Box>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Samlet vurdering
                  </Typography>
                </Box>
              )}
            </Box>
            {summary.summary && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  {summary.summary}
                </Typography>
              </Paper>
            )}
            {summary.strengths.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#10B981' }}>
                  Styrker
                </Typography>
                <Stack spacing={0.5}>
                  {summary.strengths.map((s, i) => (
                    <Typography key={i} variant="body2">• {s}</Typography>
                  ))}
                </Stack>
              </Box>
            )}
            {summary.improvements.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#DC2626' }}>
                  Forbedrings-områder
                </Typography>
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
            disabled={loading || !jobDescription.trim() || !resumeId}
            sx={{ bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' }, color: '#1F2937', fontWeight: 700 }}
          >
            {loading ? 'Genererer …' : 'Start intervju'}
          </Button>
        )}
        {phase === 'interview' && (
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleAnswer}
            disabled={loading || !answer.trim()}
            sx={{ bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' }, color: '#1F2937', fontWeight: 700 }}
          >
            Send svar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default NextRoleMockInterview;
