// @ts-nocheck
/**
 * AnimaticSfxPanel — UI for auto-detekterte SFX-events for aktivt
 * frame. Tre interaksjons-knapper per event: ✨ foreslå fra CLAP-
 * bibliotek, 🧠 generer med AI (ElevenLabs), 📤 last opp egen lyd.
 * Pluss preview/bruk per suggestion + AI-generation-status-boks.
 */

import React from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import {
  GraphicEq,
  VolumeUp,
  VolumeOff,
  AutoAwesome,
  Psychology,
  MicNone,
  UploadFile,
  Close as CloseIcon,
  PlayCircleOutline,
  PlayArrow,
} from '@mui/icons-material';
import type { SfxEvent } from './sfxDetector';
import type { SfxMatchHit } from '../../services/sfxMatchClient';

export interface AnimaticSfxPanelProps {
  /** Events for aktivt frame. Tom array → panelet skjules. */
  events: SfxEvent[];
  /** Map fra eventId → audio-URL hvis satt. */
  sfxClipUrls: Record<string, string>;
  /** Map fra eventId → suggestion-state (loading/error/hits). */
  sfxSuggestions: Record<string, { loading: boolean; error?: string; hits?: SfxMatchHit[] }>;
  /** Map fra eventId → generation-state (loading/error). */
  sfxGenerating: Record<string, { loading: boolean; error?: string }>;
  /** IDs av events som spilles av akkurat nå. */
  activeEventIds: string[];
  /** Master-toggle for auto-SFX. */
  sfxEnabled: boolean;
  onToggleSfxEnabled: () => void;
  /** Handlers per event. */
  onSuggest: (ev: SfxEvent) => void;
  onGenerate: (ev: SfxEvent) => void;
  onUpload: (eventId: string) => void;
  onClearClip: (eventId: string) => void;
  onHideEvent: (eventId: string) => void;
  onPreviewHit: (url: string) => void;
  onUseHit: (eventId: string, hit: SfxMatchHit) => void;
  /** Layout. */
  isFullscreen: boolean;
  stageMaxWidth: number;
}

export const AnimaticSfxPanel: React.FC<AnimaticSfxPanelProps> = ({
  events,
  sfxClipUrls,
  sfxSuggestions,
  sfxGenerating,
  activeEventIds,
  sfxEnabled,
  onToggleSfxEnabled,
  onSuggest,
  onGenerate,
  onUpload,
  onClearClip,
  onHideEvent,
  onPreviewHit,
  onUseHit,
  isFullscreen,
  stageMaxWidth,
}) => {
  if (!sfxEnabled || events.length === 0) return null;
  return (
    <Box
      sx={{
        maxWidth: isFullscreen ? '70%' : stageMaxWidth,
        mx: 'auto',
        mb: 0.75,
        p: 0.75,
        borderRadius: 1,
        bgcolor: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(165,180,252,0.15)',
      }}
      data-testid="animatic-sfx-panel"
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
        <GraphicEq sx={{ fontSize: 12, color: '#a5b4fc' }} />
        <Typography variant="caption" sx={{ fontSize: 10, color: '#a5b4fc', fontWeight: 700, letterSpacing: '0.05em' }}>
          SFX
        </Typography>
        <Tooltip title={sfxEnabled ? 'Skru av auto-SFX' : 'Skru på auto-SFX'}>
          <IconButton
            size="small"
            onClick={onToggleSfxEnabled}
            sx={{ p: 0.25, ml: 'auto', color: sfxEnabled ? '#86efac' : 'rgba(255,255,255,0.4)' }}
            data-testid="animatic-sfx-toggle"
          >
            {sfxEnabled ? <VolumeUp sx={{ fontSize: 12 }} /> : <VolumeOff sx={{ fontSize: 12 }} />}
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack spacing={0.25}>
        {events.map((ev) => {
          const hasClip = !!sfxClipUrls[ev.id];
          const isActiveNow = activeEventIds.includes(ev.id);
          return (
            <Stack
              key={ev.id}
              direction="row"
              alignItems="center"
              spacing={0.5}
              sx={{
                px: 0.5,
                py: 0.25,
                borderRadius: 0.5,
                bgcolor: isActiveNow ? 'rgba(134,239,172,0.12)' : 'transparent',
              }}
              data-testid={`animatic-sfx-event-${ev.id}`}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor:
                    ev.layer === 'event' ? '#fcd34d'
                    : ev.layer === 'ambient' ? '#a7f3d0'
                    : '#c4b5fd',
                }}
              />
              <Typography variant="caption" sx={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', flex: 1 }}>
                {ev.category.label}
                <Typography component="span" variant="caption" sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', ml: 0.5 }}>
                  ({ev.matchedKeyword})
                </Typography>
              </Typography>
              {!hasClip && (
                <Tooltip title="Foreslå fra CLAP-bibliotek">
                  <IconButton
                    size="small"
                    onClick={() => onSuggest(ev)}
                    sx={{ p: 0.25, color: '#a5b4fc' }}
                    data-testid={`animatic-sfx-suggest-${ev.id}`}
                    disabled={sfxSuggestions[ev.id]?.loading}
                  >
                    <AutoAwesome sx={{ fontSize: 12 }} />
                  </IconButton>
                </Tooltip>
              )}
              {!hasClip && (
                <Tooltip title="Generer med AI (ElevenLabs)">
                  <IconButton
                    size="small"
                    onClick={() => onGenerate(ev)}
                    sx={{ p: 0.25, color: '#c4b5fd' }}
                    data-testid={`animatic-sfx-generate-${ev.id}`}
                    disabled={sfxGenerating[ev.id]?.loading}
                  >
                    <Psychology sx={{ fontSize: 12 }} />
                  </IconButton>
                </Tooltip>
              )}
              {hasClip ? (
                <Tooltip title="Bytt lydfil">
                  <IconButton
                    size="small"
                    onClick={() => onUpload(ev.id)}
                    sx={{ p: 0.25, color: '#86efac' }}
                  >
                    <MicNone sx={{ fontSize: 12 }} />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="Last opp egen lydfil">
                  <IconButton
                    size="small"
                    onClick={() => onUpload(ev.id)}
                    sx={{ p: 0.25, color: 'rgba(255,255,255,0.55)' }}
                    data-testid={`animatic-sfx-upload-${ev.id}`}
                  >
                    <UploadFile sx={{ fontSize: 12 }} />
                  </IconButton>
                </Tooltip>
              )}
              {hasClip && (
                <IconButton
                  size="small"
                  onClick={() => onClearClip(ev.id)}
                  sx={{ p: 0.15, color: 'rgba(255,255,255,0.4)' }}
                >
                  <CloseIcon sx={{ fontSize: 10 }} />
                </IconButton>
              )}
              <IconButton
                size="small"
                onClick={() => onHideEvent(ev.id)}
                sx={{ p: 0.15, color: 'rgba(255,255,255,0.3)' }}
                title="Skjul denne SFX'en"
              >
                <CloseIcon sx={{ fontSize: 9 }} />
              </IconButton>
            </Stack>
          );
        })}
        {/* AI-generation status per event */}
        {events.map((ev) => {
          const gen = sfxGenerating[ev.id];
          if (!gen) return null;
          return (
            <Box
              key={`gen-${ev.id}`}
              sx={{
                pl: 1.5,
                py: 0.5,
                borderLeft: '2px solid rgba(196,181,253,0.3)',
                bgcolor: 'rgba(196,181,253,0.05)',
              }}
              data-testid={`animatic-sfx-generating-${ev.id}`}
            >
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Psychology sx={{ fontSize: 10, color: '#c4b5fd' }} />
                <Typography variant="caption" sx={{ fontSize: 9, color: '#c4b5fd' }}>
                  {gen.loading
                    ? `Genererer "${ev.category.label}" via ElevenLabs…`
                    : gen.error
                      ? gen.error
                      : 'Generert ✓'}
                </Typography>
              </Stack>
            </Box>
          );
        })}
        {/* Suggestion-list per event */}
        {events.map((ev) => {
          const suggestion = sfxSuggestions[ev.id];
          if (!suggestion) return null;
          return (
            <Box
              key={`sugg-${ev.id}`}
              sx={{
                pl: 1.5,
                py: 0.5,
                borderLeft: '2px solid rgba(165,180,252,0.3)',
                bgcolor: 'rgba(165,180,252,0.05)',
              }}
              data-testid={`animatic-sfx-suggestions-${ev.id}`}
            >
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                <AutoAwesome sx={{ fontSize: 10, color: '#a5b4fc' }} />
                <Typography variant="caption" sx={{ fontSize: 9, color: '#a5b4fc', flex: 1 }}>
                  Forslag for: {ev.category.label}
                </Typography>
              </Stack>
              {suggestion.loading && (
                <Typography variant="caption" sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
                  Søker i CLAP-bibliotek…
                </Typography>
              )}
              {suggestion.error && (
                <Typography variant="caption" sx={{ fontSize: 9, color: '#fca5a5' }}>
                  {suggestion.error}
                </Typography>
              )}
              {!suggestion.loading && !suggestion.error && suggestion.hits && suggestion.hits.length === 0 && (
                <Typography variant="caption" sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
                  Ingen treff. Last opp en egen lyd i stedet.
                </Typography>
              )}
              {!suggestion.loading && suggestion.hits && suggestion.hits.length > 0 && (
                <Stack spacing={0.25}>
                  {suggestion.hits.map((hit) => (
                    <Stack
                      key={hit.id}
                      direction="row"
                      alignItems="center"
                      spacing={0.5}
                      sx={{ py: 0.15 }}
                      data-testid={`animatic-sfx-hit-${hit.id}`}
                    >
                      <Typography variant="caption" sx={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {hit.title}
                        <Typography component="span" variant="caption" sx={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', ml: 0.5 }}>
                          ({Math.round(hit.score * 100)}%)
                        </Typography>
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
                        {hit.license}
                      </Typography>
                      <Tooltip title="Forhåndsvis">
                        <IconButton
                          size="small"
                          onClick={() => onPreviewHit(hit.url)}
                          sx={{ p: 0.15, color: 'rgba(255,255,255,0.55)' }}
                        >
                          <PlayCircleOutline sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Bruk denne">
                        <IconButton
                          size="small"
                          onClick={() => onUseHit(ev.id, hit)}
                          sx={{ p: 0.15, color: '#86efac' }}
                          data-testid={`animatic-sfx-use-${hit.id}`}
                        >
                          <PlayArrow sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};
