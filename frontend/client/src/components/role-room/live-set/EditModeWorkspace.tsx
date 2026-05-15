/**
 * EditModeWorkspace.tsx
 *
 * EDIT-mode for LIVE SET PRO — scene-assembly med node-graf + timeline.
 * Speiler livesetmode.md §16.13-§16.17.
 *
 * Arkitektur:
 *   - Venstre kolonne: clip-bibliotek (analyzed/circled takes)
 *   - Senter: node-graf med START → take-noder → END
 *   - Bunn: timeline-strip
 *   - Høyre: export/review-panel med versjonshistorikk
 *
 * Node-graf er custom SVG-basert (ikke React Flow) for å holde
 * avhengighetene minimal. SVG-based er enklere å lese, debugge og
 * style for vår use-case.
 *
 * Data:
 *   - Tar takes fra useTakes
 *   - Rough-cut-suggestions fra useAISuggestions (filter:
 *     suggestionType='edit.rough-cut-draft')
 *   - Hvis rough-cut finnes, render som default node-arrangement
 */

import React from 'react';
import { Box, Button, Chip, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import PanToolIcon from '@mui/icons-material/PanTool';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import DeleteIcon from '@mui/icons-material/Delete';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import GestureIcon from '@mui/icons-material/Gesture';
import VerticalAlignCenterIcon from '@mui/icons-material/VerticalAlignCenter';
import HomeIcon from '@mui/icons-material/Home';
import FlagIcon from '@mui/icons-material/Flag';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import ReplayIcon from '@mui/icons-material/Replay';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import { useAISuggestions } from '../hooks/useAISuggestions';
import { useTakes } from '../hooks/useTakes';
import { generateSuggestions } from '../services/aiSuggestionsClient';
import type { CastingTake } from '../services/takesClient';
import type { AISuggestion, RoughCutPayload } from '../models/casting';

interface EditModeWorkspaceProps {
  projectId: string;
  sceneId: string;
}

interface ClipNode {
  id: string;
  takeId: string;
  takeNumber: number;
  cameraLabel: string;  // 'Cam A', 'Cam B', etc — fra take-tagging
  cameraIndex: number;  // for color-coding (0..3)
  durationSec: number;
  shotIndex?: number;
  /** Hvilken node-index på timeline (for visuell sortering) */
  graphIndex: number;
}

// Color-mapping pr kamera
const CAM_COLORS = [
  '#dc2626', // A — rød
  '#3b82f6', // B — blå
  '#22c55e', // C — grønn
  '#fbbf24', // D — gul
];

function formatDuration(sec: number): string {
  const hh = Math.floor(sec / 3600).toString().padStart(2, '0');
  const mm = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
  const ss = Math.floor(sec % 60).toString().padStart(2, '0');
  const ff = Math.floor((sec % 1) * 24).toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}:${ff}`;
}

function formatShortTime(sec: number): string {
  const mm = Math.floor(sec / 60).toString().padStart(2, '0');
  const ss = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

// ─────────────────────────────────────────────────────────────────────
// Klipper takes til ClipNode-modell
// ─────────────────────────────────────────────────────────────────────

function takeToClipNode(take: CastingTake, graphIndex: number): ClipNode | null {
  if (!take.durationSec) return null;
  // Mock-fordeling av cameraLabel basert på take-id-hash for nå.
  // Real: kameraet kommer fra take-metadata når CCAPI-integrasjon er der.
  const camIdx = parseInt(take.id.replace(/\D/g, '').slice(-1) || '0', 10) % 4;
  return {
    id: take.id,
    takeId: take.id,
    takeNumber: take.takeNumber,
    cameraLabel: ['A', 'B', 'C', 'D'][camIdx],
    cameraIndex: camIdx,
    durationSec: take.durationSec,
    shotIndex: take.shotIndex ?? undefined,
    graphIndex,
  };
}

// ─────────────────────────────────────────────────────────────────────
// SVG Node-graph
// ─────────────────────────────────────────────────────────────────────

const NODE_WIDTH = 140;
const NODE_HEIGHT = 90;
const NODE_GAP = 60;

function NodeGraph({
  clips,
  playheadIndex,
  onClipSelect,
}: {
  clips: ClipNode[];
  playheadIndex: number;
  onClipSelect: (clipId: string) => void;
}) {
  const totalWidth = 80 + clips.length * (NODE_WIDTH + NODE_GAP) + 80; // start + clips + end
  const graphHeight = NODE_HEIGHT + 80;

  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: '#0a0a0a',
        position: 'relative',
        overflow: 'auto',
        minHeight: graphHeight + 40,
      }}
    >
      <svg
        width={totalWidth}
        height={graphHeight}
        style={{ display: 'block', minWidth: '100%' }}
      >
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* START-node */}
        <g transform={`translate(20, ${(graphHeight - NODE_HEIGHT) / 2})`}>
          <rect
            width={60}
            height={NODE_HEIGHT}
            rx="8"
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.15)"
          />
          <text x="30" y="40" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">
            START
          </text>
          <text x="30" y="58" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">
            ▶
          </text>
        </g>

        {/* Connection lines */}
        {clips.map((_, idx) => {
          const x1 = 80 + idx * (NODE_WIDTH + NODE_GAP);
          const x2 = x1 + NODE_GAP;
          const y = graphHeight / 2;
          return (
            <line
              key={`conn-${idx}`}
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="2"
              strokeDasharray={idx === playheadIndex - 1 ? "5,3" : undefined}
            />
          );
        })}

        {/* Clip nodes */}
        {clips.map((clip, idx) => {
          const x = 80 + NODE_GAP + idx * (NODE_WIDTH + NODE_GAP);
          const y = (graphHeight - NODE_HEIGHT) / 2;
          const color = CAM_COLORS[clip.cameraIndex];
          const isPlayhead = idx === playheadIndex;

          return (
            <g
              key={clip.id}
              transform={`translate(${x}, ${y})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onClipSelect(clip.id)}
            >
              {/* Card */}
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx="8"
                fill="rgba(255,255,255,0.05)"
                stroke={isPlayhead ? '#a78bfa' : color}
                strokeWidth={isPlayhead ? 2.5 : 1.5}
              />
              {/* Header badge */}
              <rect
                x="8"
                y="8"
                width="32"
                height="18"
                rx="3"
                fill={color}
              />
              <text x="24" y="20" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">
                {clip.cameraLabel}{idx + 1}
              </text>
              {/* Take label */}
              <text x="48" y="22" fill="#fff" fontSize="11" fontWeight="600">
                Take {clip.takeNumber.toString().padStart(2, '0')}
              </text>
              {/* Camera */}
              <text x="12" y="50" fill="rgba(255,255,255,0.6)" fontSize="10">
                Cam {clip.cameraLabel}
              </text>
              {/* Timecode */}
              <text x="12" y="74" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="monospace">
                {formatDuration(clip.durationSec)}
              </text>
            </g>
          );
        })}

        {/* End-node */}
        <g transform={`translate(${80 + NODE_GAP + clips.length * (NODE_WIDTH + NODE_GAP)}, ${(graphHeight - NODE_HEIGHT) / 2})`}>
          <rect
            width={60}
            height={NODE_HEIGHT}
            rx="8"
            fill="rgba(220,38,38,0.1)"
            stroke="rgba(220,38,38,0.5)"
          />
          <text x="30" y="40" textAnchor="middle" fill="#fca5a5" fontSize="11" fontWeight="700">
            END
          </text>
          <text x="30" y="58" textAnchor="middle" fill="rgba(252,165,165,0.7)" fontSize="9">
            ▣
          </text>
        </g>
      </svg>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Timeline (clip-strip)
// ─────────────────────────────────────────────────────────────────────

function Timeline({
  clips,
  totalDuration,
  playheadPos,
}: {
  clips: ClipNode[];
  totalDuration: number;
  playheadPos: number;
}) {
  // Ruler-merker hver 5. sekund
  const markerInterval = totalDuration > 30 ? 10 : 5;
  const markers: number[] = [];
  for (let t = 0; t <= totalDuration; t += markerInterval) markers.push(t);

  // Beregn pixel-bredde per sekund — fixed 30px/s for nå
  const PX_PER_SEC = 25;
  const totalWidth = totalDuration * PX_PER_SEC;

  return (
    <Box sx={{ bgcolor: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: 'rgba(255,255,255,0.7)' }}>
          TIMELINE (DRAFT)
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          DURASJON:&nbsp;
          <Typography component="span" sx={{ fontSize: 10, color: '#fff', fontFamily: 'monospace' }}>
            {formatDuration(totalDuration)}
          </Typography>
        </Typography>
      </Stack>

      {/* Ruler + clips */}
      <Box sx={{ position: 'relative', overflowX: 'auto', overflowY: 'hidden', minHeight: 100 }}>
        <Box sx={{ minWidth: totalWidth + 40, position: 'relative' }}>
          {/* Ruler */}
          <Box sx={{ position: 'relative', height: 24, mb: 0.5 }}>
            {markers.map((t) => (
              <Box
                key={t}
                sx={{
                  position: 'absolute',
                  left: t * PX_PER_SEC + 8,
                  top: 0,
                  height: 24,
                  display: 'flex',
                  alignItems: 'flex-end',
                }}
              >
                <Box sx={{ position: 'absolute', bottom: 0, left: 0, width: 1, height: 6, bgcolor: 'rgba(255,255,255,0.2)' }} />
                <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', ml: 0.5 }}>
                  {formatShortTime(t)}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Clip strip */}
          <Box sx={{ position: 'relative', height: 60, px: 0.5 }}>
            {clips.reduce<React.ReactNode[]>((acc, clip, idx) => {
              const startTime = clips.slice(0, idx).reduce((s, c) => s + c.durationSec, 0);
              const color = CAM_COLORS[clip.cameraIndex];
              acc.push(
                <Box
                  key={clip.id}
                  sx={{
                    position: 'absolute',
                    left: startTime * PX_PER_SEC + 4,
                    top: 0,
                    width: clip.durationSec * PX_PER_SEC - 2,
                    height: 56,
                    bgcolor: `${color}20`,
                    border: '1px solid',
                    borderColor: color,
                    borderRadius: 1,
                    px: 0.75,
                    py: 0.5,
                    overflow: 'hidden',
                  }}
                >
                  <Typography sx={{ fontSize: 9, fontWeight: 700, color, lineHeight: 1.1 }}>
                    {clip.cameraLabel}{idx + 1}
                  </Typography>
                  <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', lineHeight: 1.2 }}>
                    Take {clip.takeNumber.toString().padStart(2, '0')} – Cam {clip.cameraLabel}
                  </Typography>
                  <Typography sx={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', mt: 0.25 }}>
                    {formatShortTime(clip.durationSec)}
                  </Typography>
                </Box>
              );
              return acc;
            }, [])}

            {/* Playhead */}
            <Box
              sx={{
                position: 'absolute',
                left: playheadPos * PX_PER_SEC + 4,
                top: -10,
                bottom: -4,
                width: 2,
                bgcolor: '#a78bfa',
                zIndex: 10,
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: -6,
                  width: 0,
                  height: 0,
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderTop: '8px solid #a78bfa',
                }}
              />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Playback controls */}
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ py: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          <UndoIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          <RedoIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          <ContentCutIcon fontSize="small" />
        </IconButton>
        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          <SkipPreviousIcon fontSize="small" />
        </IconButton>
        <IconButton sx={{ color: '#fff', bgcolor: 'rgba(139,92,246,0.3)', '&:hover': { bgcolor: 'rgba(139,92,246,0.5)' } }}>
          <PlayArrowIcon />
        </IconButton>
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          <SkipNextIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          <ReplayIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main EditModeWorkspace
// ─────────────────────────────────────────────────────────────────────

export const EditModeWorkspace: React.FC<EditModeWorkspaceProps> = ({ projectId, sceneId }) => {
  const { takes } = useTakes(projectId, sceneId);
  const { suggestions, refetch } = useAISuggestions(projectId, {
    sourceType: 'scene',
    sourceId: sceneId,
    suggestionType: 'edit.rough-cut-draft',
    minConfidence: 0.0,
  });

  const [generating, setGenerating] = React.useState(false);

  // Hent siste rough-cut hvis det finnes
  const latestCut = suggestions[0] as AISuggestion<RoughCutPayload> | undefined;

  // Bygg clip-noder fra rough-cut, eller fra circled takes som fallback
  const clips: ClipNode[] = React.useMemo(() => {
    if (latestCut?.payload.clips && latestCut.payload.clips.length > 0) {
      const built: ClipNode[] = [];
      latestCut.payload.clips.forEach((c, idx) => {
        const take = takes.find((t) => t.id === c.takeId);
        if (!take) return;
        const node = takeToClipNode(take, idx);
        if (!node) return;
        built.push({
          ...node,
          durationSec: c.durationSec ?? node.durationSec,
          shotIndex: c.shotIndex,
        });
      });
      return built;
    }
    // Fallback: alle circled/analyzed takes
    return takes
      .filter((t) => t.markedCircled || t.processingStatus === 'analyzed')
      .map((t, idx) => takeToClipNode(t, idx))
      .filter((c): c is ClipNode => c !== null);
  }, [latestCut, takes]);

  const totalDuration = clips.reduce((s, c) => s + c.durationSec, 0);

  const handleGenerateDraft = async () => {
    setGenerating(true);
    try {
      await generateSuggestions(projectId, {
        agentName: 'rough-cut-agent',
        sourceType: 'scene',
        sourceId: sceneId,
        payload: { sceneId },
      });
      await refetch();
    } catch (err) {
      console.error('[EditModeWorkspace] generate failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0, bgcolor: '#0a0a0a' }}>
      {/* Tools sidebar */}
      <Box
        sx={{
          width: 56,
          bgcolor: '#000',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 1.5,
          gap: 0.5,
        }}
      >
        {[PanToolIcon, FullscreenIcon, DeleteIcon, PhotoCameraIcon, GestureIcon, VerticalAlignCenterIcon].map((Icon, i) => (
          <IconButton key={i} size="small" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            <Icon fontSize="small" />
          </IconButton>
        ))}
      </Box>

      {/* Center: clip library + graph + timeline */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          sx={{ px: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'rgba(255,255,255,0.7)' }}>
            EDIT MODE — SCENE ASSEMBLY
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            size="small"
            variant="outlined"
            onClick={handleGenerateDraft}
            disabled={generating}
            sx={{
              color: '#c4b5fd',
              borderColor: 'rgba(139,92,246,0.3)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              '&:hover': { borderColor: '#8b5cf6', bgcolor: 'rgba(139,92,246,0.1)' },
            }}
          >
            {generating ? 'GENERERER...' : 'GENERER DRAFT'}
          </Button>
        </Stack>

        {/* Scene flow header */}
        <Stack
          direction="row"
          alignItems="center"
          sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: 'rgba(255,255,255,0.5)' }}>
            SCENE FLOW (NODES)
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            label={`${clips.length} clip${clips.length === 1 ? '' : 's'}`}
            size="small"
            sx={{ fontSize: 9, height: 18, bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}
          />
        </Stack>

        {/* Node graph */}
        {clips.length === 0 ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
              Ingen takes klare for assembly
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              Last opp takes i LIVE-mode, marker som circled, eller klikk GENERER DRAFT
            </Typography>
          </Box>
        ) : (
          <NodeGraph clips={clips} playheadIndex={0} onClipSelect={() => {}} />
        )}

        {/* Timeline strip */}
        {clips.length > 0 && (
          <Timeline clips={clips} totalDuration={totalDuration} playheadPos={0} />
        )}
      </Box>

      {/* Right export sidebar */}
      <Box
        sx={{
          width: 240,
          bgcolor: '#000',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: 'rgba(255,255,255,0.5)', mb: 1 }}>
          EXPORT / REVIEW
        </Typography>
        <Stack spacing={0.75}>
          <Button
            fullWidth
            sx={{
              bgcolor: 'rgba(139,92,246,0.2)',
              color: '#c4b5fd',
              fontWeight: 700,
              letterSpacing: 0.5,
              fontSize: 11,
              '&:hover': { bgcolor: 'rgba(139,92,246,0.3)' },
            }}
            onClick={handleGenerateDraft}
            disabled={generating}
          >
            GENERER DRAFT
          </Button>
          <Button
            fullWidth
            variant="outlined"
            sx={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.15)', fontSize: 11 }}
          >
            Åpne i ekstern editor (XML/AAF)
          </Button>
          <Button
            fullWidth
            variant="outlined"
            sx={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.15)', fontSize: 11 }}
          >
            Del for gjennomgang
          </Button>
        </Stack>

        <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: 'rgba(255,255,255,0.5)', mt: 2, mb: 1 }}>
          VERSJONER
        </Typography>
        <Stack spacing={0.5}>
          {suggestions.slice(0, 3).map((sug, idx) => (
            <Box
              key={sug.id}
              sx={{
                p: 0.75,
                bgcolor: idx === 0 ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
                border: '1px solid',
                borderColor: idx === 0 ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.05)',
                borderRadius: 1,
                cursor: 'pointer',
              }}
            >
              <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
                Draft v{(suggestions.length - idx).toString()}
              </Typography>
              <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
                {new Date(sug.createdAt).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' })}
              </Typography>
            </Box>
          ))}
          {suggestions.length === 0 && (
            <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', py: 1 }}>
              Ingen drafts ennå
            </Typography>
          )}
        </Stack>
        {suggestions.length > 3 && (
          <Button size="small" sx={{ mt: 0.5, color: 'rgba(255,255,255,0.5)', fontSize: 10, justifyContent: 'flex-start' }}>
            Se alle versjoner
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default EditModeWorkspace;
