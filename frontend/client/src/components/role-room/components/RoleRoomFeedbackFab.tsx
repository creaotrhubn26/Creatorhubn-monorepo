/**
 * RoleRoomFeedbackFab — flytende knapp som åpner en lett feedback-dialog
 * fra hvor som helst i Casting Planner. Sender ticket til
 * /api/role-room/tickets med automatisk kontekst-fangst (URL, tab,
 * viewport, browser, siste console-error).
 *
 * Ikke en duplikat av HelpdeskSystem — denne er optimalisert for hurtig
 * feedback under aktiv bruk; HelpdeskSystem er full thread-baseret
 * support-flate på admin-siden.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Alert,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Feedback as FeedbackIcon,
  Close as CloseIcon,
  BugReport as BugIcon,
  Lightbulb as IdeaIcon,
  QuestionAnswer as QuestionIcon,
  Send as SendIcon,
  Image as ImageIcon,
} from '@mui/icons-material';

export type FeedbackCategory = 'bug' | 'feature' | 'question' | 'other';
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

export interface FeedbackContext {
  url: string;
  tabLabel?: string;
  projectId?: string | null;
  projectName?: string | null;
  viewportWidth: number;
  viewportHeight: number;
  userAgent: string;
  lastConsoleErrorAt?: string | null;
  lastConsoleError?: string | null;
  timestamp: string;
}

interface RoleRoomFeedbackFabProps {
  /** Endepunkt for ticket-opprettelse. Default: /api/role-room/tickets */
  endpoint?: string;
  /** Bruker-info som sendes med ticket (uten passord etc). */
  user?: { id?: string | number | null; email?: string | null; name?: string | null };
  /** Hvor i Casting Planner befinner brukeren seg? Brukes som auto-tag. */
  currentTabLabel?: string;
  currentProjectId?: string | null;
  currentProjectName?: string | null;
  /** Skjul knappen (f.eks. i Live Set fullskjerm). */
  hidden?: boolean;
}

const CATEGORY_CONFIG: Record<FeedbackCategory, { label: string; icon: typeof BugIcon; color: string }> = {
  bug: { label: 'Bug', icon: BugIcon, color: '#ef4444' },
  feature: { label: 'Idé / forslag', icon: IdeaIcon, color: '#facc15' },
  question: { label: 'Spørsmål', icon: QuestionIcon, color: '#60a5fa' },
  other: { label: 'Annet', icon: FeedbackIcon, color: '#a78bfa' },
};

const PRIORITY_OPTIONS: Array<{ value: FeedbackPriority; label: string; color: string }> = [
  { value: 'low', label: 'Lav', color: '#94a3b8' },
  { value: 'medium', label: 'Medium', color: '#60a5fa' },
  { value: 'high', label: 'Høy', color: '#fb923c' },
  { value: 'critical', label: 'Kritisk', color: '#ef4444' },
];

const lastConsoleErrorState = {
  message: null as string | null,
  at: null as string | null,
};

// Engangs-registrering: fanger siste console.error på vindusnivå så feedback
// kan vise den uten å spamme telemetri.
if (typeof window !== 'undefined' && !(window as unknown as { __roleRoomConsoleHooked?: boolean }).__roleRoomConsoleHooked) {
  (window as unknown as { __roleRoomConsoleHooked: boolean }).__roleRoomConsoleHooked = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const msg = args.map((a) => (typeof a === 'string' ? a : (a as Error)?.message ?? JSON.stringify(a))).join(' ').slice(0, 600);
      lastConsoleErrorState.message = msg;
      lastConsoleErrorState.at = new Date().toISOString();
    } catch {
      /* ignore */
    }
    original(...args);
  };
}

function captureFeedbackContext(extras: Partial<FeedbackContext>): FeedbackContext {
  return {
    url: typeof window !== 'undefined' ? window.location.href : '',
    tabLabel: extras.tabLabel,
    projectId: extras.projectId ?? null,
    projectName: extras.projectName ?? null,
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    lastConsoleError: lastConsoleErrorState.message,
    lastConsoleErrorAt: lastConsoleErrorState.at,
    timestamp: new Date().toISOString(),
  };
}

export const RoleRoomFeedbackFab = ({
  endpoint = '/api/role-room/tickets',
  user,
  currentTabLabel,
  currentProjectId,
  currentProjectName,
  hidden,
}: RoleRoomFeedbackFabProps) => {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [priority, setPriority] = useState<FeedbackPriority>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ ticketId: string } | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  const context = captureFeedbackContext({
    tabLabel: currentTabLabel,
    projectId: currentProjectId,
    projectName: currentProjectName,
  });

  // Focus title field when dialog opens
  useEffect(() => {
    if (open && titleRef.current) {
      const t = window.setTimeout(() => titleRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open]);

  const reset = useCallback(() => {
    setCategory('bug');
    setPriority('medium');
    setTitle('');
    setDescription('');
    setError(null);
    setSuccess(null);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Reset etter close-animasjon
    window.setTimeout(reset, 220);
  }, [reset]);

  const canSubmit =
    title.trim().length >= 3 &&
    description.trim().length >= 10 &&
    !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const payload = {
      category,
      priority,
      title: title.trim(),
      description: description.trim(),
      user: user ? {
        id: user.id != null ? String(user.id) : null,
        email: user.email ?? null,
        name: user.name ?? null,
      } : null,
      context,
    };
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Ticket-API er ikke deployet ennå. Be backend om POST /api/role-room/tickets.');
        }
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || `Kunne ikke opprette ticket (${response.status})`);
      }
      const data = await response.json() as { id: string };
      setSuccess({ ticketId: data.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukjent feil');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, category, priority, title, description, user, context, endpoint]);

  if (hidden) return null;

  return (
    <>
      <Tooltip title="Gi tilbakemelding (bug, idé, spørsmål)" placement="left" arrow>
        <Fab
          size="medium"
          aria-label="Åpne tilbakemelding"
          onClick={() => setOpen(true)}
          sx={{
            position: 'fixed',
            bottom: { xs: 16, sm: 24 },
            right: { xs: 16, sm: 24 },
            zIndex: 1400,
            bgcolor: '#a78bfa',
            color: '#0b1120',
            '&:hover': { bgcolor: '#8b5cf6' },
            boxShadow: '0 4px 14px rgba(167,139,250,0.45)',
          }}
        >
          <FeedbackIcon />
        </Fab>
      </Tooltip>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0f172a',
            color: '#fff',
            border: '1px solid rgba(167,139,250,0.32)',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Gi tilbakemelding</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Vi fanger automatisk URL, tab og siste console-feil for å feilsøke raskere.
            </Typography>
          </Box>
          <IconButton onClick={handleClose} aria-label="Lukk" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {success ? (
            <Alert severity="success" variant="outlined">
              Takk! Ticketen din er registrert (#{success.ticketId}). Du får e-post når en av oss svarer.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {/* Kategori */}
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 1 }}>
                  Type tilbakemelding
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {(Object.keys(CATEGORY_CONFIG) as FeedbackCategory[]).map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat];
                    const Icon = cfg.icon;
                    const isSelected = category === cat;
                    return (
                      <Chip
                        key={cat}
                        icon={<Icon sx={{ fontSize: 16, color: isSelected ? '#0b1120' : cfg.color }} />}
                        label={cfg.label}
                        onClick={() => setCategory(cat)}
                        sx={{
                          fontWeight: 700,
                          bgcolor: isSelected ? cfg.color : 'rgba(255,255,255,0.05)',
                          color: isSelected ? '#0b1120' : 'rgba(255,255,255,0.85)',
                          border: `1px solid ${isSelected ? cfg.color : 'rgba(255,255,255,0.12)'}`,
                          cursor: 'pointer',
                          '& .MuiChip-icon': { ml: 0.5 },
                        }}
                      />
                    );
                  })}
                </Stack>
              </Box>

              {/* Tittel */}
              <TextField
                inputRef={titleRef}
                label="Kort tittel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                size="small"
                helperText={`${title.length}/120`}
                inputProps={{ maxLength: 120 }}
                InputProps={{ sx: { color: '#fff' } }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
                FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }}
              />

              {/* Beskrivelse */}
              <TextField
                label="Detaljert beskrivelse"
                placeholder={
                  category === 'bug'
                    ? 'Hva forventet du? Hva skjedde? Hvordan gjenskape?'
                    : category === 'feature'
                      ? 'Hva ønsker du? Hva ville det løst for deg?'
                      : 'Beskriv så detaljert du kan…'
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={5}
                fullWidth
                size="small"
                helperText={`${description.length}/2000 — minst 10 tegn`}
                inputProps={{ maxLength: 2000 }}
                InputProps={{ sx: { color: '#fff' } }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
                FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }}
              />

              {/* Prioritet */}
              <TextField
                select
                label="Prioritet"
                value={priority}
                onChange={(e) => setPriority(e.target.value as FeedbackPriority)}
                size="small"
                fullWidth
                InputProps={{ sx: { color: '#fff' } }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                      <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: opt.color }} />
                      {opt.label}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>

              {/* Auto-context preview */}
              <Box
                sx={{
                  p: 1.25,
                  bgcolor: 'rgba(2,6,15,0.5)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 1,
                }}
              >
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 0.5 }}>
                  Kontekst som sendes automatisk:
                </Typography>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  {context.tabLabel && (
                    <Chip size="small" label={`Tab: ${context.tabLabel}`} sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.78)', fontSize: '0.7rem', height: 22 }} />
                  )}
                  {context.projectName && (
                    <Chip size="small" label={`Prosjekt: ${context.projectName}`} sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.78)', fontSize: '0.7rem', height: 22 }} />
                  )}
                  <Chip size="small" label={`${context.viewportWidth}×${context.viewportHeight}`} sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.78)', fontSize: '0.7rem', height: 22 }} />
                  {context.lastConsoleError && (
                    <Chip
                      size="small"
                      icon={<ImageIcon sx={{ fontSize: 12 }} />}
                      label="Console-feil siste sek"
                      sx={{ bgcolor: 'rgba(239,68,68,0.16)', color: '#fca5a5', fontSize: '0.7rem', height: 22, '& .MuiChip-icon': { color: '#fca5a5' } }}
                    />
                  )}
                </Stack>
              </Box>

              {error && <Alert severity="error" variant="outlined">{error}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {success ? (
            <Button variant="contained" onClick={handleClose}>Ferdig</Button>
          ) : (
            <>
              <Button onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>Avbryt</Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={!canSubmit}
                startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}
                sx={{
                  bgcolor: '#a78bfa',
                  color: '#0b1120',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#8b5cf6' },
                  '&:disabled': { bgcolor: 'rgba(167,139,250,0.3)' },
                }}
              >
                {submitting ? 'Sender…' : 'Send ticket'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RoleRoomFeedbackFab;
