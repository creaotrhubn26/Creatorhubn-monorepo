/**
 * ClipsSidebar — venstre kolonne i DanceFlowShell for formations-flaten.
 *
 * Lister video-clips for prosjektet (fra `danceVideoService.listClips`).
 * Klikk på en clip:
 *   - markerer den lokalt (visuell selection)
 *   - dispatcher `dance:select-clip` CustomEvent m/ `{ clipId, signedUrl,
 *     durationSec }` så Phase 4-video-panelet kan reagere
 *
 * Phase 3 leverer kun listen + click-event. Phase 4 lager video-panelet som
 * lytter på eventet og spiller den valgte clipen. Phase 5 wirer waveform fra
 * samme clip.
 *
 * Tom liste → "Last opp clips i Video-fanen" CTA m/ `dance:set-tab`-dispatch.
 * Last-feil → diskret retry-knapp. Ingen blokkering — formations-editoren
 * fungerer fortsatt uten clips.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import {
  Movie as MovieIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { listClips, type VideoClip } from './danceVideoService';
import { formatTimecode } from './timecode';
import { danceFlowColors } from './danceFlowTheme';

export interface ClipsSidebarProps {
  /** Prosjekt clips skal scopes til. Null = eierens "frie" clips. */
  projectId: string | null;
  /** Test-id-override. */
  'data-testid'?: string;
}

interface LoadState {
  phase: 'loading' | 'ready' | 'error';
  message?: string;
}

export const SELECT_CLIP_EVENT = 'dance:select-clip' as const;

export interface SelectClipDetail {
  clipId: string;
  signedUrl: string | null;
  durationSec: number | null;
  title: string;
}

export default function ClipsSidebar({
  projectId,
  'data-testid': testId = 'clips-sidebar',
}: ClipsSidebarProps): React.ReactElement {
  const [load, setLoad] = React.useState<LoadState>({ phase: 'loading' });
  const [clips, setClips] = React.useState<VideoClip[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async (): Promise<void> => {
    setLoad({ phase: 'loading' });
    try {
      const list = await listClips({
        // Backend tar imot undefined ↔ "alle eierens clips"; bare send hvis vi
        // har en konkret projectId.
        projectId: projectId ?? undefined,
        limit: 100,
      });
      setClips(list);
      setLoad({ phase: 'ready' });
    } catch (err) {
      setLoad({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Kunne ikke laste clips',
      });
    }
  }, [projectId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSelect = React.useCallback((clip: VideoClip): void => {
    setSelectedId(clip.id);
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent<SelectClipDetail>(SELECT_CLIP_EVENT, {
        detail: {
          clipId: clip.id,
          signedUrl: clip.signedUrl,
          durationSec: clip.durationSec,
          title: clip.title,
        },
      }),
    );
  }, []);

  const handleGoToVideoTab = React.useCallback((): void => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('dance:set-tab', { detail: { tabId: 'video' } }),
    );
  }, []);

  return (
    <Box
      data-testid={testId}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Sidebar-header */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${danceFlowColors.borderStrong}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography
          variant="overline"
          sx={{
            color: danceFlowColors.textMuted,
            fontWeight: 700,
            letterSpacing: 1.2,
          }}
        >
          Clips
        </Typography>
        <Button
          size="small"
          startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
          onClick={() => { void refresh(); }}
          data-testid={`${testId}-refresh`}
          sx={{
            textTransform: 'none',
            color: danceFlowColors.textMuted,
            minHeight: 24,
            px: 0.75,
            '&:hover': { color: danceFlowColors.lavender },
          }}
        >
          Oppdater
        </Button>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {load.phase === 'loading' ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={20} sx={{ color: danceFlowColors.lavender }} />
          </Stack>
        ) : null}

        {load.phase === 'error' ? (
          <Box sx={{ p: 1.5 }}>
            <Alert
              severity="error"
              data-testid={`${testId}-error`}
              sx={{
                bgcolor: 'rgba(248,113,113,0.08)',
                color: danceFlowColors.errorPrimary,
                fontSize: '0.75rem',
              }}
              action={
                <Button
                  size="small"
                  onClick={() => { void refresh(); }}
                  sx={{ color: danceFlowColors.errorPrimary }}
                >
                  Prøv igjen
                </Button>
              }
            >
              {load.message}
            </Alert>
          </Box>
        ) : null}

        {load.phase === 'ready' && clips.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }} data-testid={`${testId}-empty`}>
            <MovieIcon sx={{ fontSize: 32, color: danceFlowColors.textDisabled, mb: 1 }} />
            <Typography variant="body2" sx={{ color: danceFlowColors.textMuted, mb: 1.5 }}>
              Ingen clips i prosjektet.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={handleGoToVideoTab}
              data-testid={`${testId}-empty-cta`}
              sx={{
                textTransform: 'none',
                borderColor: danceFlowColors.borderStrong,
                color: danceFlowColors.lavender,
                '&:hover': {
                  borderColor: danceFlowColors.lavender,
                  bgcolor: 'rgba(167,139,250,0.08)',
                },
              }}
            >
              Last opp i Video-fanen
            </Button>
          </Box>
        ) : null}

        {load.phase === 'ready' && clips.length > 0 ? (
          <Stack spacing={0.5} sx={{ p: 1 }}>
            {clips.map((clip) => {
              const isSelected = clip.id === selectedId;
              return (
                <Box
                  key={clip.id}
                  component="button"
                  type="button"
                  onClick={() => handleSelect(clip)}
                  data-testid={`${testId}-clip-${clip.id}`}
                  aria-pressed={isSelected}
                  sx={{
                    textAlign: 'left',
                    width: '100%',
                    p: 1,
                    border: `1px solid ${isSelected ? danceFlowColors.lavender : 'transparent'}`,
                    borderRadius: 1,
                    bgcolor: isSelected
                      ? 'rgba(167,139,250,0.12)'
                      : 'transparent',
                    color: danceFlowColors.textSecondary,
                    cursor: 'pointer',
                    font: 'inherit',
                    transition: 'background-color 120ms, border-color 120ms',
                    '&:hover': {
                      bgcolor: isSelected
                        ? 'rgba(167,139,250,0.16)'
                        : 'rgba(255,255,255,0.04)',
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${danceFlowColors.lavender}`,
                      outlineOffset: 1,
                    },
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    {/* Thumbnail placeholder — backend leverer ikke poster-frame
                        ennå; Phase 4 wirer faktisk thumbnail fra video-clip. */}
                    <Box
                      sx={{
                        width: 56,
                        height: 32,
                        flexShrink: 0,
                        borderRadius: 0.5,
                        bgcolor: danceFlowColors.bgInset,
                        border: `1px solid ${danceFlowColors.borderSoft}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MovieIcon
                        sx={{ fontSize: 14, color: danceFlowColors.textDisabled }}
                      />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected
                            ? danceFlowColors.lavender
                            : danceFlowColors.textSecondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {clip.title}
                      </Typography>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                        <Chip
                          size="small"
                          label={clip.kind}
                          sx={{
                            height: 16,
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            bgcolor: danceFlowColors.bgInset,
                            color: danceFlowColors.textMuted,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                        {clip.durationSec != null ? (
                          <Typography
                            variant="caption"
                            sx={{
                              color: danceFlowColors.textDisabled,
                              fontSize: '0.6875rem',
                            }}
                          >
                            {formatTimecode(clip.durationSec)}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
