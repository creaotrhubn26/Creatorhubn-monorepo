/**
 * ClipsSidebar — venstre kolonne i DanceFlowShell for formations-flaten.
 *
 * Lag B v2 (2026-05-31) mot DanceFlow-mockup:
 *   - Header: "CLIPS" + "+ New Clip"-knapp
 *   - "Search clips…" input m/ filter
 *   - Clip-cards m/ 16:9 thumbnail + tittel + duration · dato
 *   - Aktiv card har lavender venstre-border-accent
 *
 * Lytter på klikk:
 *   - markerer clip lokalt (visuell selection)
 *   - dispatcher `dance:select-clip` CustomEvent (Phase 3a-kontrakt) som
 *     FormationVideoPanel + FormationView musicUrl bruker
 *
 * Thumbnails:
 *   - For Cloudflare Stream `signedUrl` (m3u8) avleder vi
 *     `customer-X.cloudflarestream.com/<uid>/thumbnails/thumbnail.jpg`
 *     via `deriveCloudflareStreamThumbnail`. onError fallback til
 *     ikon-placeholder.
 *   - For andre URLer: ikon-placeholder.
 *
 * "+ New Clip" dispatcher `dance:set-tab` til 'video' — opplastings-flyt
 * eier av Video-fanen.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import {
  Movie as MovieIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

import { listClips, type VideoClip } from './danceVideoService';
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

/**
 * Cloudflare Stream signedUrl-format:
 *   https://customer-<sub>.cloudflarestream.com/<uid>/manifest/video.m3u8?...
 * Thumbnail-tjenesten på samme domene:
 *   https://customer-<sub>.cloudflarestream.com/<uid>/thumbnails/thumbnail.jpg
 * Returner null hvis URL'en ikke matcher (e.g. YouTube/Vimeo/direct mp4).
 */
function deriveCloudflareStreamThumbnail(signedUrl: string | null): string | null {
  if (!signedUrl) return null;
  try {
    const u = new URL(signedUrl);
    const host = u.hostname.toLowerCase();
    if (!host.includes('cloudflarestream.com') && !host.includes('videodelivery.net')) {
      return null;
    }
    const match = /^\/([a-f0-9]{20,})\//.exec(u.pathname);
    if (!match) return null;
    const uid = match[1];
    // Behold customer-subdomain hvis tilgjengelig (raskere CDN-path).
    // Fallback til generisk videodelivery.net.
    if (host.startsWith('customer-')) {
      return `https://${host}/${uid}/thumbnails/thumbnail.jpg?height=120`;
    }
    return `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?height=120`;
  } catch {
    return null;
  }
}

/** Kompakt duration-string for clip-cards: "2:35" (m:ss) eller "1:02:35" (h:mm:ss). */
function formatShortDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const total = Math.floor(sec);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  if (hh > 0) return `${hh}:${pad(mm)}:${pad(ss)}`;
  return `${mm}:${pad(ss)}`;
}

/** "May 12" / "Mar 4" — kort dato (engelsk; matcher mockupet). */
function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function ClipsSidebar({
  projectId,
  'data-testid': testId = 'clips-sidebar',
}: ClipsSidebarProps): React.ReactElement {
  const [load, setLoad] = React.useState<LoadState>({ phase: 'loading' });
  const [clips, setClips] = React.useState<VideoClip[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState<string>('');

  const refresh = React.useCallback(async (): Promise<void> => {
    setLoad({ phase: 'loading' });
    try {
      const list = await listClips({
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

  const handleNewClip = React.useCallback((): void => {
    if (typeof window === 'undefined') return;
    // Video-fanen eier upload-flyten. Phase 5+: åpne upload-modal direkte hvis vi
    // bygger en, men nå bruker vi tab-switch for å unngå duplisert UI.
    window.dispatchEvent(
      new CustomEvent('dance:set-tab', { detail: { tabId: 'video' } }),
    );
  }, []);

  // Søk-filter — case-insensitive på tittel + kind. Beholder rekkefølgen fra
  // backend (createdAt DESC typisk).
  const filteredClips = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clips;
    return clips.filter((c) =>
      c.title.toLowerCase().includes(q) || c.kind.toLowerCase().includes(q),
    );
  }, [clips, search]);

  return (
    <Box
      data-testid={testId}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header: "CLIPS" + "+ New Clip" */}
      <Box
        sx={{
          px: 1.5,
          pt: 1,
          pb: 0.75,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 0.5,
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
        <Stack direction="row" spacing={0.25} alignItems="center">
          <Tooltip title="Oppdater liste">
            <IconButton
              size="small"
              onClick={() => { void refresh(); }}
              data-testid={`${testId}-refresh`}
              sx={{
                color: danceFlowColors.textMuted,
                '&:hover': { color: danceFlowColors.lavender },
              }}
            >
              <RefreshIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={handleNewClip}
            data-testid={`${testId}-new-clip`}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: danceFlowColors.lavender,
              minHeight: 26,
              px: 0.75,
              '&:hover': {
                bgcolor: 'rgba(167,139,250,0.1)',
              },
            }}
          >
            New Clip
          </Button>
        </Stack>
      </Box>

      {/* Search input */}
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            bgcolor: danceFlowColors.bgInset,
            border: `1px solid ${danceFlowColors.borderSoft}`,
            borderRadius: 1,
            px: 1,
            py: 0.25,
            transition: 'border-color 120ms',
            '&:focus-within': {
              borderColor: danceFlowColors.lavender,
            },
          }}
        >
          <SearchIcon sx={{ fontSize: 14, color: danceFlowColors.textDisabled, mr: 0.5 }} />
          <InputBase
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clips…"
            data-testid={`${testId}-search`}
            sx={{
              flex: 1,
              fontSize: '0.75rem',
              color: danceFlowColors.textSecondary,
              '& input': { p: 0.5 },
              '& input::placeholder': {
                color: danceFlowColors.textDisabled,
                opacity: 1,
              },
            }}
          />
          {search ? (
            <IconButton
              size="small"
              onClick={() => setSearch('')}
              data-testid={`${testId}-search-clear`}
              sx={{ p: 0.25, color: danceFlowColors.textDisabled }}
            >
              <ClearIcon sx={{ fontSize: 12 }} />
            </IconButton>
          ) : null}
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, borderTop: `1px solid ${danceFlowColors.borderStrong}` }}>
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
              Ingen clips ennå.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={handleNewClip}
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
              Last opp ditt første
            </Button>
          </Box>
        ) : null}

        {load.phase === 'ready' && filteredClips.length === 0 && clips.length > 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }} data-testid={`${testId}-no-matches`}>
            <Typography variant="caption" sx={{ color: danceFlowColors.textMuted }}>
              Ingen clips matchet "{search}".
            </Typography>
          </Box>
        ) : null}

        {load.phase === 'ready' && filteredClips.length > 0 ? (
          <Stack spacing={0.75} sx={{ p: 1 }}>
            {filteredClips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                isSelected={clip.id === selectedId}
                onSelect={() => handleSelect(clip)}
                testIdPrefix={`${testId}-clip-${clip.id}`}
              />
            ))}
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}

/**
 * ClipCard — én entry i ClipsSidebar.
 * 16:9 thumbnail · tittel · duration · dato.
 * Aktiv: lavender venstre-border + halvgjennomsiktig bakgrunn.
 */
const ClipCard: React.FC<{
  clip: VideoClip;
  isSelected: boolean;
  onSelect: () => void;
  testIdPrefix: string;
}> = ({ clip, isSelected, onSelect, testIdPrefix }) => {
  const thumbnailUrl = React.useMemo(
    () => deriveCloudflareStreamThumbnail(clip.signedUrl),
    [clip.signedUrl],
  );
  const [thumbnailError, setThumbnailError] = React.useState(false);
  const showThumbnail = thumbnailUrl != null && !thumbnailError;

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      data-testid={testIdPrefix}
      aria-pressed={isSelected}
      sx={{
        textAlign: 'left',
        width: '100%',
        p: 0.75,
        border: 'none',
        borderLeft: `3px solid ${isSelected ? danceFlowColors.lavender : 'transparent'}`,
        borderRadius: 1,
        bgcolor: isSelected ? 'rgba(167,139,250,0.12)' : 'transparent',
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
        {/* 16:9 thumbnail */}
        <Box
          sx={{
            position: 'relative',
            width: 72,
            aspectRatio: '16 / 9',
            flexShrink: 0,
            borderRadius: 0.5,
            overflow: 'hidden',
            bgcolor: danceFlowColors.bgInset,
            border: `1px solid ${danceFlowColors.borderSoft}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {showThumbnail ? (
            <Box
              component="img"
              src={thumbnailUrl ?? undefined}
              alt=""
              onError={() => setThumbnailError(true)}
              loading="lazy"
              data-testid={`${testIdPrefix}-thumb`}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <MovieIcon sx={{ fontSize: 16, color: danceFlowColors.textDisabled }} />
          )}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: isSelected ? 600 : 500,
              color: isSelected ? danceFlowColors.lavender : danceFlowColors.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.8125rem',
              lineHeight: 1.3,
            }}
          >
            {clip.title}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: danceFlowColors.textDisabled,
              fontSize: '0.6875rem',
              display: 'block',
              mt: 0.25,
            }}
          >
            {formatShortDuration(clip.durationSec)}
            {clip.capturedAt || clip.createdAt ? (
              <> &nbsp;·&nbsp; {formatShortDate(clip.capturedAt ?? clip.createdAt)}</>
            ) : null}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
};
