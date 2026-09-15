/**
 * /story/:token — offentlig spill-side for Story Graph (delingslenke).
 *
 * Ingen innlogging: grafen hentes fra /api/role-room/narrative/public/:token
 * (kun runtime-delsettet). Debugger vises bare når lenken er «view_play».
 * Ruten er registrert i både App.tsx og casting-main.tsx (theroleroom.com
 * bruker sin egen bootstrap) — samme mønster som mockup-review.
 */

import React, { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { Box, CircularProgress, Typography } from '@mui/material';
import { getPublicStory } from '@/components/role-room/narrative/narrativeService';
import type { NarrativePublicStory } from '@/components/role-room/narrative/narrativeTypes';
import { StoryPlayer } from '@/components/role-room/narrative/play/StoryPlayer';
import { narrativeColors } from '@/components/role-room/narrative/narrativeTheme';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; story: NarrativePublicStory };

export function StoryPlayView({ token, locale = null }: { token: string; locale?: string | null }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      try {
        const story = await getPublicStory(token);
        if (cancelled) return;
        setState(story ? { kind: 'ready', story } : { kind: 'missing' });
      } catch (err) {
        if (!cancelled) setState({ kind: 'error', message: err instanceof Error ? err.message : 'Kunne ikke laste historien.' });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (state.kind === 'ready') document.title = `${state.story.title} — Story Graph`;
  }, [state]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#050505', color: narrativeColors.text, display: 'flex', flexDirection: 'column' }} data-testid="story-play-page">
      <Box sx={{ px: 2, py: 1, borderBottom: `1px solid rgba(34,197,94,0.18)`, bgcolor: 'rgba(10,10,10,0.95)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 11, letterSpacing: 2, color: narrativeColors.accent, fontWeight: 700 }}>STORY GRAPH</Typography>
        <Typography sx={{ fontSize: 13, color: narrativeColors.textDim, flex: 1 }} data-testid="story-play-title">
          {state.kind === 'ready' ? state.story.title : ''}
        </Typography>
        <Typography sx={{ fontSize: 10, color: narrativeColors.textDim }}>The Role Room</Typography>
      </Box>

      {state.kind === 'loading' ? (
        <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress size={28} sx={{ color: narrativeColors.accent }} /></Box>
      ) : null}
      {state.kind === 'missing' ? (
        <Box sx={{ p: 6, textAlign: 'center' }} data-testid="story-play-missing">
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Lenken er ugyldig, utløpt eller tilbakekalt.</Typography>
          <Typography sx={{ fontSize: 13, color: narrativeColors.textDim }}>Be den som delte historien om en ny lenke.</Typography>
        </Box>
      ) : null}
      {state.kind === 'error' ? (
        <Box sx={{ p: 6, textAlign: 'center' }} data-testid="story-play-error">
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Kunne ikke laste historien.</Typography>
          <Typography sx={{ fontSize: 13, color: narrativeColors.textDim }}>{state.message}</Typography>
        </Box>
      ) : null}
      {state.kind === 'ready' ? (
        <StoryPlayer graph={state.story.graph} showDebugger={state.story.mode === 'view_play'} minHeight="calc(100vh - 42px)" initialLocale={locale} />
      ) : null}
    </Box>
  );
}

export default function StoryPlayPage() {
  const [, params] = useRoute('/story/:token');
  const token = (params as { token?: string } | null)?.token ?? '';
  let locale: string | null = null;
  try { locale = new URLSearchParams(window.location.search).get('locale'); } catch { /* ignore */ }
  return <StoryPlayView token={token} locale={locale} />;
}
