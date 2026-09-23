/**
 * Fase 8f — «Les opp scenen»: leser replikkene i rekkefølge med én stemme per taler.
 * Nettleser-TTS er standard (ingen kostnad); KI-stemmer (/api/ai/tts) bak `ai_assist`.
 * Talerens stemmecast fra karakterprofilen (barn/voksen etter epoke) vises som hint —
 * OpenAI-stemmen tildeles deterministisk per taler (assignCharacterVoices).
 * Mønster: TableReadPanel (avspillingsløkke med ref-vakt, 300 ms pause mellom replikker).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Chip, MenuItem, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { PlayArrow as PlayIcon, Stop as StopIcon, RecordVoiceOver as VoiceIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import type { NarrativeGraph, NarrativeSceneLine } from '../narrativeTypes';
import { assignCharacterVoices, speak, stopTTS, type TTSVoice } from '../../services/ttsService';
import { useGamePlanGate } from '../../game/useGamePlanGate';
import { sceneFieldSx } from './sceneUi';

type Lang = 'en' | 'nb';

function speakerKey(line: NarrativeSceneLine): string {
  return line.speakerComponentId ?? line.speakerLabel.toUpperCase() ?? 'STEMMEN';
}

/** Deterministisk nettleser-stemme per taler blant stemmene for språket (tom liste i headless → standard). */
function pickBrowserVoice(voices: SpeechSynthesisVoice[], key: string, lang: Lang): SpeechSynthesisVoice | null {
  const prefix = lang === 'nb' ? ['nb', 'no'] : ['en'];
  const pool = voices.filter((v) => prefix.some((p) => v.lang.toLowerCase().startsWith(p)));
  if (pool.length === 0) return null;
  const hash = key.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[hash % pool.length];
}

export function SceneTableRead({ lines, graph, era }: { lines: NarrativeSceneLine[]; graph: NarrativeGraph; era?: string | null }) {
  const gate = useGamePlanGate();
  const aiAllowed = gate.has('ai_assist');
  const [lang, setLang] = useState<Lang>('en');
  const [useAi, setUseAi] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const playingRef = useRef(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => { try { setBrowserVoices(window.speechSynthesis.getVoices()); } catch { /* ignore */ } };
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => { window.speechSynthesis.removeEventListener?.('voiceschanged', load); };
  }, []);
  useEffect(() => () => { playingRef.current = false; stopTTS(); }, []);

  const speakable = useMemo(() => lines.filter((l) => (lang === 'nb' ? l.textNb : l.textEn).trim().length > 0), [lines, lang]);
  const aiVoices = useMemo(() => assignCharacterVoices([...new Set(speakable.map(speakerKey))]), [speakable]);
  const castHint = useCallback((line: NarrativeSceneLine): string | null => {
    if (!line.speakerComponentId) return null;
    const c = graph.components.find((x) => x.id === line.speakerComponentId);
    const cast = (c?.profile as { voiceCast?: { child?: string; adult?: string } } | undefined)?.voiceCast;
    if (!cast) return null;
    const adult = era === '1817';
    return (adult ? cast.adult : cast.child) ?? cast.child ?? cast.adult ?? null;
  }, [graph.components, era]);

  const stop = useCallback(() => { playingRef.current = false; stopTTS(); setPlaying(false); setCurrent(null); }, []);
  const play = useCallback(async (from = 0) => {
    if (speakable.length === 0) return;
    playingRef.current = true; setPlaying(true);
    for (let i = from; i < speakable.length; i += 1) {
      if (!playingRef.current) break;
      const line = speakable[i];
      setCurrent(i);
      const text = lang === 'nb' ? line.textNb : line.textEn;
      const key = speakerKey(line);
      try {
        await speak(text, useAi && aiAllowed
          ? { voice: aiVoices[key] as TTSVoice, language: lang, speed, model: 'tts-1' }
          : { useBrowserTTS: true, browserVoice: pickBrowserVoice(browserVoices, key, lang), language: lang, speed });
      } catch { /* TTS-feil skal ikke stoppe lesningen */ }
      if (!playingRef.current) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    playingRef.current = false; setPlaying(false); setCurrent(null);
  }, [speakable, lang, useAi, aiAllowed, aiVoices, speed, browserVoices]);

  const currentLine = current != null ? speakable[current] : null;
  return (
    <Box sx={{ border: `1px solid ${narrativeColors.borderSoft}`, borderRadius: 2, p: 1.25 }} data-testid="narrative-table-read">
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <VoiceIcon fontSize="small" sx={{ color: narrativeColors.accent }} />
        <Typography sx={{ fontSize: 13, fontWeight: 800, mr: 1 }}>Les opp scenen</Typography>
        {playing ? (
          <Button size="small" variant="outlined" startIcon={<StopIcon />} onClick={stop} data-testid="narrative-table-read-stop" sx={{ color: narrativeColors.error, borderColor: narrativeColors.error }}>Stopp</Button>
        ) : (
          <Button size="small" variant="contained" startIcon={<PlayIcon />} onClick={() => void play(0)} disabled={speakable.length === 0} data-testid="narrative-table-read-play" sx={{ bgcolor: narrativeColors.accent, color: '#03150a', fontWeight: 700 }}>Spill av ({speakable.length})</Button>
        )}
        <TextField select size="small" label="Språk" value={lang} onChange={(e) => { stop(); setLang(e.target.value as Lang); }} sx={{ ...sceneFieldSx, minWidth: 110 }} inputProps={{ 'data-testid': 'narrative-table-read-lang' }}>
          <MenuItem value="en">Engelsk</MenuItem>
          <MenuItem value="nb">Norsk</MenuItem>
        </TextField>
        <TextField select size="small" label="Tempo" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} sx={{ ...sceneFieldSx, minWidth: 100 }}>
          {[0.8, 1, 1.2].map((s) => <MenuItem key={s} value={s}>{s}×</MenuItem>)}
        </TextField>
        <Tooltip title={aiAllowed ? 'KI-stemmer via OpenAI (koster per replikk). Av = nettleserens egne stemmer.' : 'KI-stemmer krever Pro/Studio (ai_assist).'}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Switch size="small" checked={useAi && aiAllowed} disabled={!aiAllowed} onChange={(e) => setUseAi(e.target.checked)} inputProps={{ 'data-testid': 'narrative-table-read-ai', 'aria-label': 'Bruk KI-stemmer' } as never} />
            <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>KI-stemmer</Typography>
          </Stack>
        </Tooltip>
      </Stack>
      {currentLine ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }} data-testid="narrative-table-read-current">
          <Chip size="small" label={currentLine.cueId} sx={{ height: 20, fontFamily: 'monospace' }} />
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{currentLine.speakerLabel || 'STEMMEN'}</Typography>
          {castHint(currentLine) ? <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>stemmecast: {castHint(currentLine)}</Typography> : null}
          <Typography sx={{ fontSize: 12, fontStyle: 'italic', flex: 1 }}>{lang === 'nb' ? currentLine.textNb : currentLine.textEn}</Typography>
        </Stack>
      ) : (
        <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mt: 0.75 }}>
          Én stemme per taler; norsk leses fra «Norsk»-kolonnen, engelsk fra «Engelsk». Replikker uten tekst på valgt språk hoppes over.
        </Typography>
      )}
    </Box>
  );
}
