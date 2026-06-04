// @ts-nocheck
/**
 * RoleRoomAgentChatPanel — the conversational surface for "The Role Room
 * Agent". Shares the branding with the existing bootstrap dialog but is
 * backed by Claude, consent-gated, and pseudonymization-wrapped end-to-end.
 *
 * Flow:
 *   1. AiConsentGate wraps the panel. No data leaves the browser without
 *      an active consent record.
 *   2. User types a question. The hook posts it to the backend runner.
 *   3. Backend returns text + optional tool_uses + transparency metadata.
 *   4. Panel renders the answer with AiTransparencyBanner and a
 *      confirmation dialog for each tool_use. Tool actions are NEVER
 *      executed automatically — user must tap "Bekreft" per action.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoFixHigh as AutoFixIcon,
  CheckCircleOutline as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
  Send as SendIcon,
} from '@mui/icons-material';

import AiConsentGate from './AiConsentGate';
import AiTransparencyBanner from './AiTransparencyBanner';
import AgentThreadList from './AgentThreadList';
import AgentPaywallDialog from './AgentPaywallDialog';
import { useRoleRoomAgentClaude } from '../../hooks/useRoleRoomAgentClaude';
import { revokeProjectConsent } from '../../services/aiConsentService';
import {
  fetchAgentEntitlement,
  type EntitlementBundle,
} from '../../services/roleRoomAgentEntitlementApi';
import { History as HistoryIcon } from '@mui/icons-material';
import type { RoleRoomAgentToolUse } from '../../services/roleRoomAgentClaudeApi';
import type { RoleRoomAgentContext } from '../../services/roleRoomAgentClaudeApi';

interface RoleRoomAgentChatPanelProps {
  projectId: string | null;
  currentUserId: string;
  /** Project context assembled by the parent (brief, reviews, timeline).
   *  This is what gets pseudonymized on the backend. */
  context?: RoleRoomAgentContext;
  /** Called when the user confirms a tool_use. The parent is responsible
   *  for executing the real write (e.g. creating a review, updating a
   *  brief field). Return a string to render an inline success message
   *  in the chat thread. Throw to render an inline error. */
  onConfirmToolUse?: (tool: RoleRoomAgentToolUse) => Promise<string | void> | string | void;
}

/** Per-tool execution feedback rendered inline in the message thread. */
interface ToolFeedback {
  status: 'ok' | 'error';
  message: string;
}

const SUGGESTED_PROMPTS: string[] = [
  'Hva mangler i briefen?',
  'Hva er neste beslutningspunkt?',
  'Oppsummer hvor prosjektet står i dag',
  'Hvilke reviewer venter på klient?',
];

export const RoleRoomAgentChatPanel: React.FC<RoleRoomAgentChatPanelProps> = ({
  projectId,
  currentUserId,
  context,
  onConfirmToolUse,
}) => {
  const [input, setInput] = useState('');
  const [pendingTool, setPendingTool] = useState<RoleRoomAgentToolUse | null>(null);
  const [toolExecuting, setToolExecuting] = useState(false);
  // Map of tool_use.id -> latest feedback. Lives in the panel (not the
  // message) so re-renders from streaming deltas don't blow it away.
  const [toolFeedback, setToolFeedback] = useState<Record<string, ToolFeedback>>({});
  const { messages, pending, send, reset, threadId, loadThread, startNewThread, lastError } = useRoleRoomAgentClaude(projectId);
  const [historyAnchor, setHistoryAnchor] = useState<HTMLElement | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [entitlementBundle, setEntitlementBundle] = useState<EntitlementBundle | null>(null);

  // Pre-flight entitlement fetch so we can skip the 402 round-trip and
  // show the paywall immediately for users who don't have access.
  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetchAgentEntitlement().then((data) => {
      if (!cancelled) setEntitlementBundle(data);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Surface a paywall when a send call comes back with
  // entitlement_required (HTTP 402). The hook stores the code+detail in
  // lastError so we just watch for it.
  React.useEffect(() => {
    if (lastError?.code === 'entitlement_required') {
      setPaywallOpen(true);
      // Best-effort refresh so the dialog shows current state.
      void fetchAgentEntitlement().then((bundle) => setEntitlementBundle(bundle));
    }
  }, [lastError]);

  const needsPaywall =
    entitlementBundle != null && !entitlementBundle.entitlement.allowed;

  // Soft trial-expiry banner — shown when user has 3 or fewer days left
  // on an active trial. No email today; this is the in-app nudge.
  const trialBannerDays = entitlementBundle?.entitlement.status === 'trial'
    && entitlementBundle.entitlement.allowed
    && typeof entitlementBundle.entitlement.daysRemaining === 'number'
    && entitlementBundle.entitlement.daysRemaining >= 0
    && entitlementBundle.entitlement.daysRemaining <= 3
    ? entitlementBundle.entitlement.daysRemaining
    : null;

  const handleSend = useCallback(
    async (question?: string) => {
      const text = (question ?? input).trim();
      if (!text) return;
      if (!question) setInput('');
      await send(text, { context });
    },
    [input, send, context],
  );

  const handleRevokeConsent = useCallback(() => {
    if (!projectId) return;
    // Destructive: revoking consent also wipes the chat history via reset().
    // Confirm first so it isn't a one-click accident.
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Trekke tilbake samtykke? Dette sletter chat-historikken for dette prosjektet og kan ikke angres.',
      )
    ) {
      return;
    }
    void revokeProjectConsent(projectId);
    reset();
  }, [projectId, reset]);

  // Auto-scroll to the newest message as the thread grows / streams.
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending]);

  const body = useMemo(() => (
    <Stack spacing={1.6} sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: { xs: 1.4, md: 2 }, pt: 1.4, pb: 1 }}>
      {trialBannerDays !== null ? (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => setPaywallOpen(true)}>
              Oppgrader
            </Button>
          }
          sx={{
            bgcolor: 'rgba(250,204,21,0.12)',
            color: '#fde68a',
            border: '1px solid rgba(250,204,21,0.28)',
            '& .MuiAlert-icon': { color: '#fde68a' },
          }}
        >
          {trialBannerDays === 0
            ? 'Prøveperioden din utløper i dag.'
            : trialBannerDays === 1
              ? 'Prøveperioden din utløper i morgen.'
              : `Prøveperioden din utløper om ${trialBannerDays} dager.`}
        </Alert>
      ) : null}
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
        <Typography sx={{ color: 'rgba(226,232,240,0.64)', fontSize: '0.76rem' }}>
          {threadId
            ? `Fortsetter samtale (${messages.length} meldinger lagret)`
            : 'Ny samtale'}
        </Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {projectId ? (
            <Chip
              icon={<HistoryIcon sx={{ fontSize: 14, color: '#a5f3fc !important' }} />}
              label="Historikk"
              size="small"
              variant="outlined"
              onClick={(event) => setHistoryAnchor(event.currentTarget)}
              clickable
              sx={{
                color: '#e2e8f0',
                borderColor: 'rgba(34,211,238,0.3)',
                bgcolor: 'rgba(8,47,73,0.24)',
                '&:hover': { bgcolor: 'rgba(8,47,73,0.42)' },
              }}
            />
          ) : null}
          {(threadId || messages.length > 0) ? (
            <Chip
              label="Ny samtale"
              size="small"
              variant="outlined"
              onClick={startNewThread}
              disabled={pending}
              clickable
              sx={{
                color: '#e2e8f0',
                borderColor: 'rgba(148,163,184,0.3)',
                bgcolor: 'rgba(15,23,42,0.4)',
                '&:hover': { bgcolor: 'rgba(15,23,42,0.6)' },
              }}
            />
          ) : null}
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Chip
            key={prompt}
            label={prompt}
            onClick={() => { void handleSend(prompt); }}
            disabled={pending || !projectId}
            clickable
            size="small"
            variant="outlined"
            sx={{
              color: '#a5f3fc',
              borderColor: 'rgba(34,211,238,0.3)',
              bgcolor: 'rgba(8,47,73,0.22)',
              '&:hover': { bgcolor: 'rgba(8,47,73,0.4)', borderColor: 'rgba(34,211,238,0.5)' },
              '&.Mui-disabled': {
                color: 'rgba(165,243,252,0.4)',
                borderColor: 'rgba(34,211,238,0.14)',
              },
            }}
          />
        ))}
      </Stack>

      {messages.length === 0 ? (
        <Alert
          severity="info"
          variant="outlined"
          sx={{
            bgcolor: 'rgba(34,211,238,0.08)',
            color: '#cbd5e1',
            border: '1px solid rgba(34,211,238,0.22)',
            '& .MuiAlert-icon': { color: '#a5f3fc' },
          }}
        >
          Spør The Role Room Agent om prosjektet. Alle svar kommer fra Claude via
          en server-side rutine som sjekker samtykke og pseudonymiserer kandidater/crew
          før kallet.
        </Alert>
      ) : null}

      <Stack spacing={1.4} aria-live="polite" aria-atomic={false}>
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <Box
              key={message.id}
              sx={{
                p: 1.4,
                borderRadius: 2.2,
                border: '1px solid',
                borderColor: isUser ? 'rgba(99,102,241,0.32)' : 'rgba(148,163,184,0.16)',
                bgcolor: isUser ? 'rgba(99,102,241,0.16)' : 'rgba(15,23,42,0.56)',
                // Leaves breathing room on iPad so message bubbles don't
                // stretch across the whole dialog width and look like a
                // wall of text.
                maxWidth: { md: '92%' },
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                ml: isUser ? { md: 'auto' } : undefined,
              }}
            >
              <Typography
                sx={{
                  color: isUser ? '#c7d2fe' : '#a5f3fc',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  mb: 0.4,
                }}
              >
                {isUser ? 'Du' : 'The Role Room Agent'}
              </Typography>

              {message.error ? (
                <Alert
                  severity="error"
                  icon={<ErrorIcon />}
                  sx={{
                    mt: 0.5,
                    bgcolor: 'rgba(239,68,68,0.12)',
                    color: '#fecaca',
                    border: '1px solid rgba(239,68,68,0.28)',
                    '& .MuiAlert-icon': { color: '#fecaca' },
                  }}
                >
                  {message.error}
                </Alert>
              ) : null}

              {message.text ? (
                <Typography
                  sx={{
                    whiteSpace: 'pre-wrap',
                    mt: 0.5,
                    color: '#f1f5f9',
                    fontSize: { xs: '0.92rem', md: '0.95rem' },
                    lineHeight: 1.55,
                  }}
                >
                  {message.text}
                </Typography>
              ) : null}

            {message.response ? (
              <Box sx={{ mt: 1 }}>
                <AiTransparencyBanner
                  model={message.response.transparency.model}
                  fields={message.response.transparency.fields}
                  entityCount={message.response.transparency.entityCount}
                  onRevokeConsent={handleRevokeConsent}
                />
                {message.response.toolUses.length > 0 ? (
                  <Stack spacing={0.75} sx={{ mt: 1 }}>
                    <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.76rem' }}>
                      Agenten foreslår {message.response.toolUses.length} handling
                      {message.response.toolUses.length === 1 ? '' : 'er'} — bekreft for å utføre:
                    </Typography>
                    {message.response.toolUses.map((tool) => {
                      const feedback = toolFeedback[tool.id];
                      return (
                        <Stack key={tool.id} spacing={0.5}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AutoFixIcon />}
                            onClick={() => setPendingTool(tool)}
                            disabled={feedback?.status === 'ok'}
                            sx={{
                              alignSelf: 'flex-start',
                              textTransform: 'none',
                              color: '#a5f3fc',
                              borderColor: 'rgba(34,211,238,0.4)',
                              '&:hover': { borderColor: 'rgba(34,211,238,0.7)', bgcolor: 'rgba(8,47,73,0.3)' },
                              '&.Mui-disabled': {
                                color: 'rgba(165,243,252,0.4)',
                                borderColor: 'rgba(34,211,238,0.16)',
                              },
                            }}
                          >
                            {tool.name.replace(/_/g, ' ')}
                          </Button>
                          {feedback ? (
                            <Alert
                              severity={feedback.status === 'ok' ? 'success' : 'error'}
                              icon={feedback.status === 'ok' ? <CheckCircleIcon /> : <ErrorIcon />}
                              sx={{
                                py: 0.4,
                                fontSize: '0.78rem',
                                bgcolor: feedback.status === 'ok'
                                  ? 'rgba(34,197,94,0.12)'
                                  : 'rgba(239,68,68,0.12)',
                                color: feedback.status === 'ok' ? '#bbf7d0' : '#fecaca',
                                border: feedback.status === 'ok'
                                  ? '1px solid rgba(34,197,94,0.28)'
                                  : '1px solid rgba(239,68,68,0.28)',
                                '& .MuiAlert-icon': {
                                  color: feedback.status === 'ok' ? '#bbf7d0' : '#fecaca',
                                  fontSize: '1rem',
                                  py: 0.4,
                                },
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {feedback.message}
                            </Alert>
                          ) : null}
                        </Stack>
                      );
                    })}
                  </Stack>
                ) : null}
              </Box>
            ) : null}
          </Box>
          );
        })}
        {pending ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} sx={{ color: '#22d3ee' }} />
            <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.8rem' }}>
              The Role Room Agent tenker …
            </Typography>
          </Box>
        ) : null}
        {/* Scroll anchor — keeps the newest message in view as it streams. */}
        <div ref={bottomRef} aria-hidden="true" />
      </Stack>

      {lastError && lastError.code === 'agent_disabled' ? (
        <Alert
          severity="warning"
          sx={{
            bgcolor: 'rgba(250,204,21,0.12)',
            color: '#fde68a',
            border: '1px solid rgba(250,204,21,0.28)',
            '& .MuiAlert-icon': { color: '#fde68a' },
          }}
        >
          Claude-agenten er slått av (feature flag). Be admin sette
          <code> ROLE_ROOM_AGENT_CLAUDE_ENABLED=true</code> i backend-env.
        </Alert>
      ) : null}
    </Stack>
  ), [messages, pending, handleSend, handleRevokeConsent, projectId, lastError, threadId, startNewThread, trialBannerDays, toolFeedback]);

  const composer = (
    <Box
      sx={{
        flexShrink: 0,
        bgcolor: 'rgba(2,6,23,0.82)',
        borderTop: '1px solid rgba(148,163,184,0.18)',
        pt: 1.2,
        pb: 'calc(var(--rr-safe-bottom, 0px) + 10px)',
        px: { xs: 1.4, md: 2 },
        display: 'flex',
        gap: 1,
        alignItems: 'flex-end',
        // Backdrop-blur so if the messages scroll behind the composer
        // on iOS Safari, the composer still reads cleanly.
        backdropFilter: 'blur(6px)',
      }}
    >
      <TextField
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !pending) {
            event.preventDefault();
            void handleSend();
          }
        }}
        placeholder="Spør The Role Room Agent …"
        fullWidth
        multiline
        maxRows={4}
        disabled={!projectId || pending}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: 'rgba(15,23,42,0.62)',
            color: '#f1f5f9',
            fontSize: { xs: '0.95rem', md: '0.95rem' },
            '& fieldset': { borderColor: 'rgba(148,163,184,0.3)' },
            '&:hover fieldset': { borderColor: 'rgba(34,211,238,0.5)' },
            '&.Mui-focused fieldset': { borderColor: '#22d3ee' },
          },
          '& .MuiOutlinedInput-input::placeholder': {
            color: 'rgba(226,232,240,0.5)',
            opacity: 1,
          },
        }}
      />
      <IconButton
        onClick={() => { void handleSend(); }}
        disabled={!input.trim() || pending || !projectId}
        aria-label="Send"
        sx={{
          width: { xs: 44, md: 48 },
          height: { xs: 44, md: 48 },
          flexShrink: 0,
          bgcolor: '#22d3ee',
          color: '#082f49',
          '&:hover': { bgcolor: '#06b6d4' },
          '&.Mui-disabled': { bgcolor: 'rgba(34,211,238,0.25)', color: 'rgba(8,47,73,0.6)' },
        }}
      >
        {pending ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
      </IconButton>
    </Box>
  );

  if (!projectId) {
    return (
      <Alert
        severity="info"
        variant="outlined"
        sx={{
          m: 2,
          bgcolor: 'rgba(34,211,238,0.08)',
          color: '#cbd5e1',
          border: '1px solid rgba(34,211,238,0.22)',
          '& .MuiAlert-icon': { color: '#a5f3fc' },
        }}
      >
        Velg et prosjekt for å åpne The Role Room Agent.
      </Alert>
    );
  }

  return (
    <AiConsentGate projectId={projectId} currentUserId={currentUserId}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          // When the parent constrains height (inside the Dialog we set
          // fullScreen + height:100%), the messages area scrolls within
          // this flex-column. When the parent is unbounded (dashboard
          // Card), we fall back to a comfortable min-height so short
          // conversations don't collapse and tall ones scroll the page.
          height: '100%',
          minHeight: { xs: 420, md: 520 },
          // Own the colour scheme so the panel looks identical on the
          // dark RoleRoomAgentDialog *and* the light RoleRoomDashboard
          // Card. Before this wrap the agent bubbles blended into the
          // Dialog's own light-wrapper and the text was unreadable.
          background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.98) 100%)',
          borderRadius: { xs: 0, md: 2 },
          border: { xs: 'none', md: '1px solid rgba(148,163,184,0.14)' },
          overflow: 'hidden',
        }}
      >
        {body}
        {composer}
      </Box>
      <AgentThreadList
        projectId={projectId ?? ''}
        anchorEl={historyAnchor}
        open={Boolean(historyAnchor) && Boolean(projectId)}
        onClose={() => setHistoryAnchor(null)}
        currentThreadId={threadId}
        onPick={(id) => {
          void loadThread(id);
        }}
      />
      <AgentPaywallDialog
        open={paywallOpen || needsPaywall}
        onClose={() => setPaywallOpen(false)}
        entitlement={entitlementBundle?.entitlement ?? null}
        config={entitlementBundle?.config ?? null}
        onEntitlementChanged={() => {
          void fetchAgentEntitlement().then((bundle) => {
            setEntitlementBundle(bundle);
            if (bundle?.entitlement.allowed) setPaywallOpen(false);
          });
        }}
      />
      <ToolConfirmDialog
        tool={pendingTool}
        executing={toolExecuting}
        onCancel={() => setPendingTool(null)}
        onConfirm={async (tool) => {
          if (!onConfirmToolUse) {
            setPendingTool(null);
            return;
          }
          setToolExecuting(true);
          try {
            const result = await onConfirmToolUse(tool);
            const successMessage = typeof result === 'string' && result.length > 0
              ? result
              : `Utført: ${tool.name.replace(/_/g, ' ')}`;
            setToolFeedback((prev) => ({
              ...prev,
              [tool.id]: { status: 'ok', message: successMessage },
            }));
            setPendingTool(null);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setToolFeedback((prev) => ({
              ...prev,
              [tool.id]: { status: 'error', message },
            }));
            setPendingTool(null);
          } finally {
            setToolExecuting(false);
          }
        }}
      />
    </AiConsentGate>
  );
};

interface ToolConfirmDialogProps {
  tool: RoleRoomAgentToolUse | null;
  executing: boolean;
  onCancel: () => void;
  onConfirm: (tool: RoleRoomAgentToolUse) => Promise<void> | void;
}

const ToolConfirmDialog: React.FC<ToolConfirmDialogProps> = ({
  tool,
  executing,
  onCancel,
  onConfirm,
}) => {
  if (!tool) return null;
  return (
    <Dialog open onClose={executing ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Bekreft handling</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1 }}>
          Agenten foreslår å utføre <strong>{tool.name.replace(/_/g, ' ')}</strong>. Ingenting
          skjer før du bekrefter her.
        </DialogContentText>
        <Box
          component="pre"
          sx={{
            p: 1.5,
            bgcolor: 'rgba(15,23,42,0.04)',
            borderRadius: 1,
            fontSize: 12,
            overflow: 'auto',
            maxHeight: 240,
          }}
        >
          {JSON.stringify(tool.input, null, 2)}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onCancel} disabled={executing}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={() => { void onConfirm(tool); }}
          disabled={executing}
        >
          {executing ? <CircularProgress size={20} color="inherit" /> : 'Bekreft'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoleRoomAgentChatPanel;
