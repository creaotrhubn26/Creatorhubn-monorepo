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

import React, { useCallback, useMemo, useState } from 'react';
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
  ErrorOutline as ErrorIcon,
  Send as SendIcon,
} from '@mui/icons-material';

import AiConsentGate from './AiConsentGate';
import AiTransparencyBanner from './AiTransparencyBanner';
import { useRoleRoomAgentClaude } from '../../hooks/useRoleRoomAgentClaude';
import { revokeProjectConsent } from '../../services/aiConsentService';
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
   *  brief field). Returning undefined/void closes the dialog silently. */
  onConfirmToolUse?: (tool: RoleRoomAgentToolUse) => Promise<void> | void;
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
  const { messages, pending, send, reset, lastError } = useRoleRoomAgentClaude(projectId);

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
    void revokeProjectConsent(projectId);
    reset();
  }, [projectId, reset]);

  const body = useMemo(() => (
    <Stack spacing={2}>
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
          />
        ))}
      </Stack>

      {messages.length === 0 ? (
        <Alert severity="info" variant="outlined">
          Spør The Role Room Agent om prosjektet. Alle svar kommer fra Claude via
          en server-side rutine som sjekker samtykke og pseudonymiserer kandidater/crew
          før kallet.
        </Alert>
      ) : null}

      <Stack spacing={2}>
        {messages.map((message) => (
          <Box
            key={message.id}
            sx={{
              p: 1.5,
              borderRadius: 'var(--rr-card-radius, 12px)',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: message.role === 'user' ? 'rgba(99,102,241,0.06)' : 'background.paper',
            }}
          >
            <Typography variant="overline" color="text.secondary">
              {message.role === 'user' ? 'Du' : 'The Role Room Agent'}
            </Typography>

            {message.error ? (
              <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 0.5 }}>
                {message.error}
              </Alert>
            ) : null}

            {message.text ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
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
                  <Stack spacing={0.75}>
                    <Typography variant="caption" color="text.secondary">
                      Agenten foreslår {message.response.toolUses.length} handling
                      {message.response.toolUses.length === 1 ? '' : 'er'} — bekreft for å utføre:
                    </Typography>
                    {message.response.toolUses.map((tool) => (
                      <Button
                        key={tool.id}
                        size="small"
                        variant="outlined"
                        startIcon={<AutoFixIcon />}
                        onClick={() => setPendingTool(tool)}
                        sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                      >
                        {tool.name.replace(/_/g, ' ')}
                      </Button>
                    ))}
                  </Stack>
                ) : null}
              </Box>
            ) : null}
          </Box>
        ))}
        {pending ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="caption" color="text.secondary">
              The Role Room Agent tenker …
            </Typography>
          </Box>
        ) : null}
      </Stack>

      {lastError && lastError.code === 'agent_disabled' ? (
        <Alert severity="warning">
          Claude-agenten er slått av (feature flag). Be admin sette
          <code> ROLE_ROOM_AGENT_CLAUDE_ENABLED=true</code> i backend-env.
        </Alert>
      ) : null}
    </Stack>
  ), [messages, pending, handleSend, handleRevokeConsent, projectId, lastError]);

  const composer = (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        pt: 1.5,
        pb: 'calc(var(--rr-safe-bottom, 0px) + 8px)',
        mt: 2,
        display: 'flex',
        gap: 1,
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
      />
      <IconButton
        onClick={() => { void handleSend(); }}
        disabled={!input.trim() || pending || !projectId}
        aria-label="Send"
        sx={{
          width: 'var(--rr-touch-target-min, 44px)',
          height: 'var(--rr-touch-target-min, 44px)',
          bgcolor: '#6366f1',
          color: '#fff',
          '&:hover': { bgcolor: '#4f46e5' },
          '&.Mui-disabled': { bgcolor: 'rgba(99,102,241,0.2)', color: '#fff' },
        }}
      >
        {pending ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
      </IconButton>
    </Box>
  );

  if (!projectId) {
    return (
      <Alert severity="info" variant="outlined">
        Velg et prosjekt for å åpne The Role Room Agent.
      </Alert>
    );
  }

  return (
    <AiConsentGate projectId={projectId} currentUserId={currentUserId}>
      <Stack spacing={2}>
        {body}
        {composer}
      </Stack>
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
            await onConfirmToolUse(tool);
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
