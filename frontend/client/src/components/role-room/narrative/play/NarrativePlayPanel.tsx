/**
 * NarrativePlayPanel — Play Mode: ett element per tur, valg, debugger, TTS.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, FormControlLabel, IconButton, Stack, Switch, Tooltip, Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
  RestartAlt as RestartIcon,
  VolumeUp as SpeakIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import { assignCharacterVoices, speak, stopTTS } from '../../services/ttsService';
import { htmlToText, type NarrativeGraph } from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';
import { DebuggerPanel } from './DebuggerPanel';
import { sanitizePlayHtml } from './sanitizePlayHtml';
import { usePlaySession } from './usePlaySession';

export interface NarrativePlayPanelProps {
  graph: NarrativeGraph;
  onEditElement: (elementId: string) => void;
}

const AUTO_SPEAK_KEY = 'role_room_narrative_auto_speak';
const AI_VOICES_KEY = 'role_room_narrative_ai_voices';

function readFlag(key: string): boolean {
  try { return window.localStorage.getItem(key) === '1'; } catch { return false; }
}
function writeFlag(key: string, value: boolean): void {
  try { window.localStorage.setItem(key, value ? '1' : '0'); } catch { /* ignore */ }
}

export function NarrativePlayPanel({ graph, onEditElement }: NarrativePlayPanelProps) {
  const play = usePlaySession(graph);
  const { view, state } = play;
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => readFlag(AUTO_SPEAK_KEY));
  const [aiVoices, setAiVoices] = useState<boolean>(() => readFlag(AI_VOICES_KEY));
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);

  const voices = useMemo(() => assignCharacterVoices(graph.components.map((c) => c.name)), [graph.components]);
  const safeHtml = useMemo(() => (view ? sanitizePlayHtml(view.html) : ''), [view]);
  const contentText = useMemo(() => (view ? htmlToText(view.html) : ''), [view]);

  const stopSpeaking = () => {
    speakingRef.current = false;
    stopTTS();
    setSpeaking(false);
  };

  const speakCurrent = async () => {
    if (!view || !contentText) return;
    stopSpeaking();
    speakingRef.current = true;
    setSpeaking(true);
    try {
      const voice = view.speakerName ? voices[view.speakerName] : undefined;
      await speak(contentText, { useBrowserTTS: !aiVoices, voice, language: 'nb' });
    } catch {
      /* TTS-feil er ikke kritiske */
    } finally {
      if (speakingRef.current) setSpeaking(false);
      speakingRef.current = false;
    }
  };

  // Auto-opplesning ved nytt element (aldri i e2e — flagget er av som standard).
  useEffect(() => {
    if (!autoSpeak || !view) return;
    void speakCurrent();
    return () => { stopTTS(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.elementId, state.log.length]);

  useEffect(() => () => stopTTS(), []);

  const errorsForView = useMemo(() => {
    const last = state.log.filter((l) => l.elementId === view?.elementId && l.errors.length > 0);
    return last.flatMap((l) => l.errors);
  }, [state.log, view?.elementId]);

  if (graph.elements.length === 0) {
    return (
      <Box sx={{ p: 3 }} data-testid="narrative-play-panel">
        <Typography sx={{ color: narrativeColors.textDim, fontSize: 13 }}>
          Ingen elementer ennå. Tegn historien på et brett først, så kan du spille den her.
        </Typography>
      </Box>
    );
  }

  return (
    <Box data-testid="narrative-play-panel" sx={{ display: 'flex', minHeight: 'calc(100vh - 150px)', color: narrativeColors.text }}>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, borderBottom: `1px solid ${narrativeColors.borderStrong}`, bgcolor: narrativeColors.bgPanel, flexWrap: 'wrap' }}>
          <Button size="small" startIcon={<RestartIcon />} onClick={() => { stopSpeaking(); play.restart(); }} sx={{ color: narrativeColors.accent }} data-testid="narrative-play-restart">Start på nytt</Button>
          <Button size="small" startIcon={<BackIcon />} disabled={!play.canBack} onClick={() => { stopSpeaking(); play.back(); }} sx={{ color: narrativeColors.textDim }} data-testid="narrative-play-back">Tilbake</Button>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={speaking ? 'Stopp opplesning' : 'Les opp dette elementet'}>
            <span>
              <IconButton size="small" disabled={!contentText} onClick={() => (speaking ? stopSpeaking() : void speakCurrent())} sx={{ color: speaking ? narrativeColors.accent : narrativeColors.textDim }} aria-label="Les opp">
                {speaking ? <StopIcon fontSize="small" /> : <SpeakIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <FormControlLabel
            control={<Switch size="small" checked={autoSpeak} onChange={(e) => { setAutoSpeak(e.target.checked); writeFlag(AUTO_SPEAK_KEY, e.target.checked); if (!e.target.checked) stopSpeaking(); }} />}
            label={<Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>Auto-les</Typography>}
            sx={{ mr: 0 }}
          />
          <FormControlLabel
            control={<Switch size="small" checked={aiVoices} onChange={(e) => { setAiVoices(e.target.checked); writeFlag(AI_VOICES_KEY, e.target.checked); }} />}
            label={<Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>AI-stemmer</Typography>}
            sx={{ mr: 0 }}
          />
        </Box>

        {play.stale ? (
          <Alert
            severity="info"
            action={<Button size="small" onClick={() => { stopSpeaking(); play.rebuild(); }} data-testid="narrative-play-rebuild">Start på nytt</Button>}
            sx={{ m: 1.5, mb: 0 }}
          >
            Grafen er endret siden du startet. Start på nytt for å spille den nye versjonen.
          </Alert>
        ) : null}

        <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 4 } }}>
          {!view ? (
            <Box>
              <Typography sx={{ color: narrativeColors.textDim, fontSize: 13, mb: 1 }}>
                {play.started ? 'Ingen startelement — sett et startelement på brettet.' : 'Klar til å spille.'}
              </Typography>
              <Button variant="contained" startIcon={<PlayIcon />} onClick={play.start} sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700 }}>Start</Button>
            </Box>
          ) : (
            <Box sx={{ maxWidth: 720, mx: 'auto' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                {view.speakerName ? (
                  <Chip size="small" label={view.speakerName} sx={{ bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent, fontWeight: 700 }} data-testid="narrative-play-speaker" />
                ) : null}
                <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, flex: 1 }} data-testid="narrative-play-title">
                  {htmlToText(view.element.titleHtml) || 'Uten tittel'}
                </Typography>
                <Tooltip title="Rediger dette elementet">
                  <IconButton size="small" onClick={() => { stopSpeaking(); onEditElement(view.elementId); }} sx={{ color: narrativeColors.textDim }} aria-label="Rediger element" data-testid="narrative-play-edit">
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Box
                data-testid="narrative-play-content"
                sx={{
                  fontSize: 17, lineHeight: 1.7,
                  '& p': { my: 1 },
                  '& .narrative-show': { color: narrativeColors.accent, fontFamily: 'monospace', fontSize: 14 },
                  '& .mention': { color: narrativeColors.accent, fontWeight: 600 },
                  '& img': { maxWidth: '100%', borderRadius: 1 },
                }}
                dangerouslySetInnerHTML={{ __html: safeHtml || '<p><em>Tomt innhold</em></p>' }}
              />

              {errorsForView.length > 0 ? (
                <Alert severity="warning" sx={{ mt: 1.5 }} data-testid="narrative-play-errors">
                  {errorsForView.map((e, i) => <div key={i}>{e.kind === 'parse' ? 'Skriptfeil' : 'Kjørefeil'}: {e.message}</div>)}
                </Alert>
              ) : null}

              <Stack spacing={1} sx={{ mt: 3 }} data-testid="narrative-play-options">
                {view.options.map((opt, i) => {
                  const label = htmlToText(opt.labelHtml) || `Fortsett${view.options.length > 1 ? ` (${i + 1})` : ''}`;
                  return (
                    <Button
                      key={opt.connectionId}
                      variant="outlined"
                      onClick={() => { stopSpeaking(); play.choose(opt.connectionId); }}
                      data-testid={`narrative-play-option-${opt.connectionId}`}
                      sx={{ justifyContent: 'flex-start', textTransform: 'none', color: narrativeColors.text, borderColor: narrativeColors.borderSoft, '&:hover': { borderColor: narrativeColors.accent, bgcolor: narrativeColors.accentSoft } }}
                    >
                      {label}
                    </Button>
                  );
                })}
                {view.deadEnd ? (
                  <Typography sx={{ fontSize: 12, color: narrativeColors.warning }} data-testid="narrative-play-deadend">
                    {view.element.kind === 'branch'
                      ? 'Forgreningen har ingen utgang som passer — ingen betingelse traff, eller utgangen er ikke koblet.'
                      : 'Slutt — dette elementet har ingen utganger.'}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ width: 320, flex: '0 0 320px', borderLeft: `1px solid ${narrativeColors.borderStrong}`, bgcolor: narrativeColors.bgPanel, display: { xs: 'none', md: 'block' } }}>
        <DebuggerPanel graph={graph} view={view} state={state} variableDefs={play.variableDefs} onSetVariable={play.setVariable} />
      </Box>
    </Box>
  );
}
