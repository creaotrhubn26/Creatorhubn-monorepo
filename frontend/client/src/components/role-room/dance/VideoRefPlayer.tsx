/**
 * VideoRefPlayer — kompakt referanse-spiller for et koreografi-segment.
 *
 * Detekterer YouTube / Vimeo / direkte video-fil og rendrer riktig spiller.
 * Faller tilbake til "Åpne i ny fane"-link hvis URL-en ikke kan embeddes.
 */

import { danceFlowColors } from './danceFlowTheme';
import React from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material';

const PURPLE_BORDER = 'rgba(139,92,246,0.25)';

interface ParsedSource {
  kind: 'youtube' | 'vimeo' | 'direct' | 'unknown';
  src?: string;
  startSec?: number;
}

const VIDEO_FILE_PATTERN = /\.(mp4|webm|mov|m4v)(\?|$)/i;

function parseVideoUrl(raw: string): ParsedSource {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'unknown' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: 'unknown' };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  // YouTube — youtu.be/<id>, youtube.com/watch?v=<id>, youtube.com/shorts/<id>, youtube.com/embed/<id>
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    if (id) {
      const start = parseStartParam(url.searchParams.get('t') ?? url.searchParams.get('start'));
      return {
        kind: 'youtube',
        src: `https://www.youtube.com/embed/${encodeURIComponent(id)}${start ? `?start=${start}` : ''}`,
        startSec: start,
      };
    }
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    let id: string | null = null;
    if (url.pathname.startsWith('/watch')) {
      id = url.searchParams.get('v');
    } else if (url.pathname.startsWith('/embed/')) {
      id = url.pathname.split('/').filter(Boolean)[1] ?? null;
    } else if (url.pathname.startsWith('/shorts/')) {
      id = url.pathname.split('/').filter(Boolean)[1] ?? null;
    }
    if (id) {
      const start = parseStartParam(url.searchParams.get('t') ?? url.searchParams.get('start'));
      return {
        kind: 'youtube',
        src: `https://www.youtube.com/embed/${encodeURIComponent(id)}${start ? `?start=${start}` : ''}`,
        startSec: start,
      };
    }
  }

  // Vimeo — vimeo.com/<id>, player.vimeo.com/video/<id>
  if (host === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) {
      return { kind: 'vimeo', src: `https://player.vimeo.com/video/${id}` };
    }
  }
  if (host === 'player.vimeo.com') {
    const segs = url.pathname.split('/').filter(Boolean);
    if (segs[0] === 'video' && segs[1] && /^\d+$/.test(segs[1])) {
      return { kind: 'vimeo', src: `https://player.vimeo.com/video/${segs[1]}` };
    }
  }

  // Direct video file
  if (VIDEO_FILE_PATTERN.test(url.pathname)) {
    return { kind: 'direct', src: url.toString() };
  }

  return { kind: 'unknown', src: url.toString() };
}

function parseStartParam(raw: string | null): number | undefined {
  if (!raw) return undefined;
  // Accept "120", "120s", "2m" etc.
  const m = /^(\d+)([smh]?)$/i.exec(raw.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = (m[2] || 's').toLowerCase();
  const sec = unit === 'h' ? n * 3600 : unit === 'm' ? n * 60 : n;
  return Number.isFinite(sec) && sec > 0 ? sec : undefined;
}

export interface VideoRefPlayerProps {
  url: string;
  height?: number;
}

export const VideoRefPlayer: React.FC<VideoRefPlayerProps> = ({
  url,
  height = 180,
}) => {
  const parsed = React.useMemo(() => parseVideoUrl(url), [url]);

  if (parsed.kind === 'unknown' || !parsed.src) {
    return (
      <Box
        sx={{
          mt: 0.5,
          p: 1,
          bgcolor: danceFlowColors.bgInset,
          borderRadius: 1,
          border: `1px solid ${PURPLE_BORDER}`,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography sx={{ fontSize: 11, color: danceFlowColors.textMuted }}>
            URL-en kan ikke embeddes — åpne i ny fane.
          </Typography>
          <Tooltip title="Åpne i ny fane">
            <IconButton
              size="small"
              component="a"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: danceFlowColors.lavender }}
            >
              <OpenInNewIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        mt: 0.5,
        position: 'relative',
        bgcolor: '#000',
        borderRadius: 1,
        overflow: 'hidden',
        border: `1px solid ${PURPLE_BORDER}`,
        aspectRatio: 16 / 9,
        maxHeight: height,
      }}
      data-testid="video-ref-player"
    >
      {parsed.kind === 'direct' ? (
        <video
          src={parsed.src}
          controls
          preload="metadata"
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      ) : (
        <iframe
          src={parsed.src}
          title="Video-referanse"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
      )}
    </Box>
  );
};

export default VideoRefPlayer;
