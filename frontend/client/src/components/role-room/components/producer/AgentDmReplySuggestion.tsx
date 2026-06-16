/**
 * AgentDmReplySuggestion — Agentens svarforslag på en DM (porter eng-dm).
 * Gir ETT AI-generert svarforslag med klassifisering, treffsikkerhet (%),
 * tone og Send/Rediger. «Send» sender direkte; «Rediger» fyller svarfeltet.
 *
 * Backend: /api/role-room/dm/reply-suggestion (Claude, ingen DB).
 */

import * as React from 'react';
import { Box, Stack, Typography, Button, Chip, CircularProgress } from '@mui/material';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import roleRoomAgentService, { type DmReplySuggestion } from '../../services/roleRoomAgentService';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

export interface AgentDmReplySuggestionProps {
  messages: Array<{ direction: string; body: string | null }>;
  participantName?: string | null;
  platform?: string;
  onEdit: (text: string) => void;
  onSend: (text: string) => void;
  sending?: boolean;
}

export default function AgentDmReplySuggestion({ messages, participantName, platform = 'Instagram', onEdit, onSend, sending }: AgentDmReplySuggestionProps): React.ReactElement | null {
  const [suggestion, setSuggestion] = React.useState<DmReplySuggestion | null>(null);
  const [loading, setLoading] = React.useState(false);

  const cleanMsgs = messages.filter((m) => m.body && m.body.trim()).map((m) => ({ direction: m.direction, body: m.body as string }));
  const lastInbound = cleanMsgs.length > 0 && cleanMsgs[cleanMsgs.length - 1].direction !== 'outbound';
  // Nullstill forslaget når tråden endres.
  React.useEffect(() => { setSuggestion(null); }, [cleanMsgs.length]);

  if (cleanMsgs.length === 0) return null;

  const generate = async (): Promise<void> => {
    setLoading(true);
    try {
      const s = await roleRoomAgentService.generateDmReplySuggestion({ participantName, platform, messages: cleanMsgs });
      setSuggestion(s);
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{
      m: 1.5, borderRadius: 3, p: 1.8, overflow: 'hidden',
      border: '1px solid rgba(167,139,250,0.24)',
      background: 'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.16), transparent 55%), linear-gradient(180deg, #0a0a14 0%, #120a26 100%)',
    }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: suggestion ? 1.2 : 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.9}>
          <Box sx={{ width: 26, height: 26, borderRadius: 1.2, display: 'grid', placeItems: 'center', background: GRAD }}>
            <TipsAndUpdatesIcon sx={{ fontSize: 15, color: '#fff' }} />
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: INK }}>Agentens svarforslag</Typography>
        </Stack>
        {!suggestion ? (
          <Button size="small" onClick={() => void generate()} disabled={loading} variant="contained" disableElevation
            startIcon={loading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <AutoAwesomeIcon fontSize="small" />}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' } }}>
            {lastInbound ? 'Foreslå svar' : 'Forslag'}
          </Button>
        ) : null}
      </Stack>

      {suggestion ? (
        <>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip size="small" icon={<SmartToyIcon sx={{ fontSize: 14, color: `${ACCENT} !important` }} />} label={suggestion.tag}
              sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#e9d5ff', fontWeight: 700, fontSize: 10.5 }} />
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: 10.5, color: MUTED }}>Treffsikkerhet</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1, background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{suggestion.confidence}%</Typography>
          </Stack>

          <Box sx={{ p: 1.4, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.16)', mb: 1.2 }}>
            <Typography sx={{ fontSize: 13.5, color: 'rgba(226,232,240,0.92)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{suggestion.reply}</Typography>
          </Box>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Button size="small" onClick={() => onSend(suggestion.reply)} disabled={sending} variant="contained" disableElevation
              startIcon={sending ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <SendIcon fontSize="small" />}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' } }}>
              Send svar
            </Button>
            <Button size="small" onClick={() => onEdit(suggestion.reply)} variant="outlined"
              startIcon={<EditIcon fontSize="small" />}
              sx={{ textTransform: 'none', fontWeight: 700, borderColor: 'rgba(168,85,247,0.4)', color: ACCENT }}>
              Rediger
            </Button>
            <Box sx={{ flex: 1 }} />
            <Stack direction="row" alignItems="center" spacing={0.4}>
              <GraphicEqIcon sx={{ fontSize: 14, color: MUTED }} />
              <Typography sx={{ fontSize: 11, color: MUTED }}>Tone: {suggestion.tone}</Typography>
            </Stack>
          </Stack>
        </>
      ) : null}
    </Box>
  );
}
