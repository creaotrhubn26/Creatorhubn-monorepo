/**
 * ReviewModeWorkspace.tsx
 *
 * REVIEW-mode for LIVE SET PRO — versjon-sammenligning + approval-flow.
 * Speiler livesetmode.md §16.18.
 *
 * Layout:
 *   - Venstre: versjon-historikk (alle rough-cut-drafts)
 *   - Senter: side-by-side player (2 versjoner)
 *   - Høyre: kommentar-tråd + approve/reject-flow
 */

import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import HistoryIcon from '@mui/icons-material/History';
import { useAISuggestions } from '../hooks/useAISuggestions';
import type { AISuggestion, RoughCutPayload } from '../models/casting';

interface ReviewModeWorkspaceProps {
  projectId: string;
  sceneId: string;
}

interface MockComment {
  id: string;
  author: string;
  role: 'director' | 'producer' | 'client';
  timestamp: string;
  text: string;
  /** Timecode i video som kommentaren refererer til */
  videoTimecode?: string;
}

// Mock-kommentarer — real implementasjon ville hentet fra
// casting_ai_suggestions.review_note + en separat comments-tabell.
const MOCK_COMMENTS: MockComment[] = [
  {
    id: '1',
    author: 'Anna Lund',
    role: 'director',
    timestamp: '14:32',
    text: 'Vurder en lengre pause før Take 02 starter — vi trenger pusterom.',
    videoTimecode: '00:00:18',
  },
  {
    id: '2',
    author: 'Mads Henriksen',
    role: 'producer',
    timestamp: '14:47',
    text: 'Cut B1 fungerer bedre enn forventet. Approve.',
    videoTimecode: '00:00:24',
  },
];

const ROLE_COLORS: Record<MockComment['role'], string> = {
  director: '#8b5cf6',
  producer: '#22c55e',
  client: '#fbbf24',
};

const ROLE_LABELS: Record<MockComment['role'], string> = {
  director: 'Regissør',
  producer: 'Produsent',
  client: 'Klient',
};

function VersionCard({
  version,
  selected,
  isComparing,
  onClick,
  variant = 'left',
}: {
  version: AISuggestion<RoughCutPayload>;
  selected: boolean;
  isComparing: boolean;
  onClick: () => void;
  variant?: 'left' | 'right';
}) {
  const totalDuration = version.payload.totalDurationSec ?? 0;
  const minutes = Math.floor(totalDuration / 60);
  const seconds = Math.round(totalDuration % 60);
  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1,
        bgcolor: selected
          ? variant === 'left'
            ? 'rgba(139,92,246,0.15)'
            : 'rgba(220,38,38,0.12)'
          : 'rgba(255,255,255,0.02)',
        border: '1px solid',
        borderColor: selected
          ? variant === 'left'
            ? '#8b5cf6'
            : '#dc2626'
          : 'rgba(255,255,255,0.06)',
        borderRadius: 1,
        cursor: 'pointer',
        transition: 'all 120ms',
        '&:hover': { borderColor: selected ? undefined : 'rgba(255,255,255,0.2)' },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
          {`Draft v${version.id.slice(0, 4)}`}
        </Typography>
        {isComparing && selected && (
          <Chip
            label={variant === 'left' ? 'A' : 'B'}
            size="small"
            sx={{
              height: 16,
              fontSize: 9,
              fontWeight: 700,
              bgcolor: variant === 'left' ? '#8b5cf6' : '#dc2626',
              color: '#fff',
              '& .MuiChip-label': { px: 0.5 },
            }}
          />
        )}
      </Stack>
      <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
        {new Date(version.createdAt).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' })}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 0.25 }}>
        <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
          {version.payload.clips.length} clips
        </Typography>
        <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </Typography>
      </Stack>
    </Box>
  );
}

function VideoPlayer({
  version,
  variant,
}: {
  version: AISuggestion<RoughCutPayload> | null;
  variant: 'left' | 'right';
}) {
  const color = variant === 'left' ? '#8b5cf6' : '#dc2626';

  if (!version) {
    return (
      <Box
        sx={{
          flex: 1,
          aspectRatio: '16/9',
          bgcolor: '#000',
          border: '2px dashed rgba(255,255,255,0.1)',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          Velg versjon for å sammenligne
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        position: 'relative',
        aspectRatio: '16/9',
        bgcolor: '#000',
        border: '2px solid',
        borderColor: color,
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {/* Placeholder video */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(60,40,30,0.6), rgba(20,15,10,0.95))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PlayArrowIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.3)' }} />
      </Box>
      {/* Label */}
      <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
        <Chip
          label={`Draft ${variant === 'left' ? 'A' : 'B'}`}
          size="small"
          sx={{
            bgcolor: color,
            color: '#fff',
            fontWeight: 700,
            fontSize: 10,
          }}
        />
      </Box>
      {/* Stats */}
      <Box sx={{ position: 'absolute', bottom: 8, left: 8, right: 8 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
          <Box>
            <Typography sx={{ fontSize: 10, color: '#fff', fontFamily: 'monospace' }}>
              {version.payload.clips.length} clips · {(version.payload.totalDurationSec ?? 0).toFixed(1)}s
            </Typography>
            {version.payload.rationale && (
              <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', mt: 0.25 }}>
                {version.payload.rationale.slice(0, 60)}{version.payload.rationale.length > 60 ? '…' : ''}
              </Typography>
            )}
          </Box>
          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
            00:00:00 / {(version.payload.totalDurationSec ?? 0).toFixed(1)}s
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

export const ReviewModeWorkspace: React.FC<ReviewModeWorkspaceProps> = ({ projectId, sceneId }) => {
  const { suggestions } = useAISuggestions(projectId, {
    sourceType: 'scene',
    sourceId: sceneId,
    suggestionType: 'edit.rough-cut-draft',
    minConfidence: 0.0,
  });
  const versions = suggestions as AISuggestion<RoughCutPayload>[];

  // Default: nyeste til venstre, nest-nyeste til høyre
  const [leftId, setLeftId] = React.useState<string | null>(null);
  const [rightId, setRightId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (versions.length > 0 && !leftId) setLeftId(versions[0].id);
    if (versions.length > 1 && !rightId) setRightId(versions[1].id);
  }, [versions, leftId, rightId]);

  const leftVersion = versions.find((v) => v.id === leftId) ?? null;
  const rightVersion = versions.find((v) => v.id === rightId) ?? null;

  const [newComment, setNewComment] = React.useState('');

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0, bgcolor: '#0a0a0a' }}>
      {/* Left: version history */}
      <Box sx={{ width: 240, bgcolor: '#000', borderRight: '1px solid rgba(255,255,255,0.08)', p: 1.5, overflowY: 'auto' }}>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
          <HistoryIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }} />
          <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: 'rgba(255,255,255,0.5)' }}>
            VERSJONER ({versions.length})
          </Typography>
        </Stack>
        <Stack spacing={0.5}>
          {versions.map((v) => (
            <VersionCard
              key={v.id}
              version={v}
              selected={v.id === leftId}
              isComparing
              variant="left"
              onClick={() => setLeftId(v.id)}
            />
          ))}
          {versions.length === 0 && (
            <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', py: 2 }}>
              Ingen drafts å gjennomgå
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Center: side-by-side players */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, p: 2, gap: 2 }}>
        <Stack direction="row" alignItems="center">
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'rgba(255,255,255,0.7)' }}>
            REVIEW MODE — VERSJON-SAMMENLIGNING
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<CheckIcon />}
              sx={{
                bgcolor: 'rgba(34,197,94,0.18)',
                color: '#86efac',
                fontWeight: 700,
                letterSpacing: 0.5,
                fontSize: 11,
                '&:hover': { bgcolor: 'rgba(34,197,94,0.3)' },
              }}
            >
              APPROVE A
            </Button>
            <Button
              size="small"
              startIcon={<CloseIcon />}
              sx={{
                bgcolor: 'rgba(220,38,38,0.18)',
                color: '#fca5a5',
                fontWeight: 700,
                letterSpacing: 0.5,
                fontSize: 11,
                '&:hover': { bgcolor: 'rgba(220,38,38,0.3)' },
              }}
            >
              REJECT
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={2} sx={{ flex: 1, minHeight: 0 }}>
          <VideoPlayer version={leftVersion} variant="left" />
          <VideoPlayer version={rightVersion} variant="right" />
        </Stack>

        {/* Right-side version selector for B */}
        {versions.length > 1 && (
          <Stack direction="row" spacing={1} justifyContent="center">
            <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', alignSelf: 'center' }}>
              Sammenlign med:
            </Typography>
            {versions.slice(0, 5).map((v) => (
              <Chip
                key={v.id}
                label={`v${v.id.slice(0, 4)}`}
                size="small"
                onClick={() => setRightId(v.id)}
                sx={{
                  fontSize: 9,
                  height: 22,
                  bgcolor: v.id === rightId ? '#dc2626' : 'rgba(255,255,255,0.05)',
                  color: v.id === rightId ? '#fff' : 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: v.id === rightId ? '#b91c1c' : 'rgba(255,255,255,0.1)' },
                }}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* Right: comments */}
      <Box sx={{ width: 320, bgcolor: '#000', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: 'rgba(255,255,255,0.5)' }}>
            KOMMENTAR-TRÅD
          </Typography>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
          <Stack spacing={1.5}>
            {MOCK_COMMENTS.map((c) => (
              <Box key={c.id}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Avatar
                    sx={{
                      width: 28,
                      height: 28,
                      fontSize: 11,
                      bgcolor: ROLE_COLORS[c.role],
                    }}
                  >
                    {c.author.charAt(0)}
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="baseline">
                      <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
                        {c.author}
                      </Typography>
                      <Typography sx={{ fontSize: 9, color: ROLE_COLORS[c.role], fontWeight: 700 }}>
                        {ROLE_LABELS[c.role]}
                      </Typography>
                      <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                        · {c.timestamp}
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', mt: 0.25, lineHeight: 1.4 }}>
                      {c.text}
                    </Typography>
                    {c.videoTimecode && (
                      <Chip
                        label={`@ ${c.videoTimecode}`}
                        size="small"
                        sx={{
                          mt: 0.5,
                          fontSize: 9,
                          height: 16,
                          bgcolor: 'rgba(139,92,246,0.1)',
                          color: '#c4b5fd',
                          fontFamily: 'monospace',
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    )}
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
        <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="Legg til kommentar…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: 11,
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                },
              }}
            />
            <IconButton
              size="small"
              disabled={!newComment.trim()}
              sx={{
                color: newComment.trim() ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                border: '1px solid',
                borderColor: newComment.trim() ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
              }}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

export default ReviewModeWorkspace;
