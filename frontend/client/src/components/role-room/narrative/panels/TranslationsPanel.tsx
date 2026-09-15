/**
 * TranslationsPanel — Translation Mode: velg språk, se kilde og oversettelse
 * side om side per prose-bit, oversett med KI (forslag går rett i feltet) og
 * lagre. Kodeblokker (arcscript) vises aldri her og kan ikke endres — de
 * flettes fra kilden ved oppslag (shared/narrative-format/locale.ts).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, FormControl, IconButton, InputLabel, LinearProgress, MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { AutoAwesome as AiIcon, Add as AddIcon, Save as SaveIcon, Delete as RemoveIcon } from '@mui/icons-material';
import {
  LOCALE_CODE_RE, SUGGESTED_LOCALES, listTranslatableSegments, mergeCodeBlocks, replaceProseChunk, translatedTextFor,
  type TranslatableSegment,
} from '@shared/narrative-format';
import * as api from '../narrativeService';
import type { NarrativeGraph } from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';
import { PlanGateBanner } from '../../game/GameBillingPanels';
import { useGamePlanGate } from '../../game/useGamePlanGate';
import type { UseNarrativeGraphResult } from '../state/useNarrativeGraph';

export interface TranslationsPanelProps {
  projectId: string;
  graph: NarrativeGraph;
  store: UseNarrativeGraphResult;
  onNotice: (message: string, severity: 'success' | 'error' | 'warning') => void;
}

const fieldSx = {
  '& .MuiInputBase-root': { color: narrativeColors.text, bgcolor: 'rgba(255,255,255,0.03)', fontSize: 13 },
  '& .MuiInputLabel-root': { color: narrativeColors.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: narrativeColors.borderStrong },
  '& .MuiSvgIcon-root': { color: narrativeColors.textDim },
};

function localeLabel(code: string): string {
  return SUGGESTED_LOCALES.find((l) => l.code === code)?.label ?? code;
}

/** Bygg lagrings-HTML for et segment ut fra gjeldende override/kilde + ny tekst. */
function buildEntry(graph: NarrativeGraph, seg: TranslatableSegment, locale: string, text: string): api.TranslationEntry {
  if (seg.ownerKind === 'settings') return { ownerKind: 'settings', id: 'settings', field: 'title', html: text.trim() };
  if (seg.ownerKind === 'element') {
    const e = graph.elements.find((x) => x.id === seg.id)!;
    if (seg.field === 'titleHtml') return { ownerKind: 'element', id: seg.id, field: 'titleHtml', html: replaceProseChunk('', 0, text) };
    const base = mergeCodeBlocks(e.contentHtml, e.i18n?.[locale]?.contentHtml);
    return { ownerKind: 'element', id: seg.id, field: 'contentHtml', html: replaceProseChunk(base, seg.index, text) };
  }
  const c = graph.connections.find((x) => x.id === seg.id)!;
  const base = mergeCodeBlocks(c.labelHtml, c.i18n?.[locale]?.labelHtml);
  return { ownerKind: 'connection', id: seg.id, field: 'labelHtml', html: replaceProseChunk(base, seg.index, text) };
}

export function TranslationsPanel({ projectId, graph, store, onNotice }: TranslationsPanelProps) {
  const locales = graph.settings.locales?.length ? graph.settings.locales : ['nb'];
  const targets = locales.filter((l) => l !== 'nb');
  const [locale, setLocale] = useState<string>(targets[0] ?? '');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [newLocale, setNewLocale] = useState('');

  useEffect(() => {
    if (locale && !targets.includes(locale)) setLocale(targets[0] ?? '');
    if (!locale && targets[0]) setLocale(targets[0]);
  }, [targets, locale]);

  const segments = useMemo(() => listTranslatableSegments(graph), [graph]);
  const gate = useGamePlanGate();
  const canAi = gate.has('translations');
  const saved = useMemo(() => {
    const map: Record<string, string | null> = {};
    if (locale) for (const s of segments) map[s.key] = translatedTextFor(graph, s, locale);
    return map;
  }, [graph, segments, locale]);
  const done = segments.filter((s) => (drafts[s.key] ?? saved[s.key] ?? '').trim()).length;
  const dirtyKeys = Object.keys(drafts).filter((k) => (drafts[k] ?? '') !== (saved[k] ?? ''));

  // Nullstill utkast ved språkbytte.
  useEffect(() => { setDrafts({}); }, [locale]);

  const addLocale = async () => {
    const code = newLocale.trim();
    if (!LOCALE_CODE_RE.test(code)) { onNotice('Locale-kode må være f.eks. en, sv eller pt-BR.', 'error'); return; }
    if (locales.includes(code)) { onNotice('Språket finnes allerede.', 'warning'); return; }
    setBusy('locale');
    try {
      await store.updateSettings({ locales: [...locales, code] });
      setNewLocale('');
      setLocale(code);
      onNotice(`Språket ${localeLabel(code)} er lagt til.`, 'success');
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Kunne ikke legge til språk.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const removeLocale = async (code: string) => {
    if (!window.confirm(`Fjerne ${localeLabel(code)} fra aktiverte språk? Lagrede oversettelser beholdes i databasen.`)) return;
    setBusy('locale');
    try {
      await store.updateSettings({ locales: locales.filter((l) => l !== code) });
      onNotice(`${localeLabel(code)} er fjernet.`, 'success');
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Kunne ikke fjerne språk.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const save = useCallback(async () => {
    if (!locale || dirtyKeys.length === 0) return;
    setBusy('save');
    try {
      const entries = dirtyKeys
        .map((key) => segments.find((s) => s.key === key))
        .filter((s): s is TranslatableSegment => !!s)
        .map((s) => buildEntry(graph, s, locale, drafts[s.key] ?? ''));
      // Flere biter i samme felt: siste entry per (owner,id,field) må inneholde alle bitene.
      const merged = new Map<string, api.TranslationEntry>();
      for (const s of dirtyKeys.map((key) => segments.find((x) => x.key === key)!).filter(Boolean)) {
        const k = `${s.ownerKind}:${s.id}:${s.field}`;
        const prev = merged.get(k);
        const text = drafts[s.key] ?? '';
        if (s.ownerKind === 'element' && s.field === 'contentHtml' && prev) {
          merged.set(k, { ...prev, html: replaceProseChunk(prev.html, s.index, text) });
        } else if (s.ownerKind === 'connection' && prev) {
          merged.set(k, { ...prev, html: replaceProseChunk(prev.html, s.index, text) });
        } else {
          merged.set(k, buildEntry(graph, s, locale, text));
        }
      }
      void entries;
      const result = await api.saveTranslations(projectId, locale, [...merged.values()]);
      await store.reload();
      setDrafts({});
      onNotice(`${result.saved} felt lagret på ${localeLabel(locale)}.`, 'success');
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Kunne ikke lagre oversettelser.', 'error');
    } finally {
      setBusy(null);
    }
  }, [locale, dirtyKeys, segments, graph, drafts, projectId, store, onNotice]);

  const translate = useCallback(async (only: TranslatableSegment[] | null) => {
    if (!locale) return;
    const list = (only ?? segments.filter((s) => !(drafts[s.key] ?? saved[s.key] ?? '').trim())).slice(0, 40);
    if (list.length === 0) { onNotice('Ingenting å oversette.', 'warning'); return; }
    setBusy(only ? `ai-${only[0].key}` : 'ai-all');
    try {
      const res = await api.translateSegments(projectId, {
        sourceLocale: 'nb', targetLocale: locale, storyContext: graph.settings.title ?? undefined,
        segments: list.map((s) => ({ key: s.key, text: s.sourceText, context: s.context })),
      });
      setDrafts((prev) => {
        const next = { ...prev };
        for (const t of res.translations) next[t.key] = t.text;
        return next;
      });
      onNotice(`${res.translations.length} forslag lagt inn — se over og lagre.${res.missing.length ? ` ${res.missing.length} mangler.` : ''}`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'KI-oversettelse feilet.';
      onNotice(/ikke aktivert|ai_unavailable/i.test(message) ? 'KI-oversettelse er ikke aktivert på denne serveren.' : message, 'error');
    } finally {
      setBusy(null);
    }
  }, [locale, segments, drafts, saved, projectId, graph.settings.title, onNotice]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, color: narrativeColors.text, maxWidth: 1100 }} data-testid="narrative-translations-panel">
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Oversettelser</Typography>
        <Box sx={{ flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 180, ...fieldSx }} disabled={targets.length === 0}>
          <InputLabel id="narrative-translations-locale-label">Målspråk</InputLabel>
          <Select labelId="narrative-translations-locale-label" label="Målspråk" value={locale} onChange={(e) => setLocale(String(e.target.value))} data-testid="narrative-translations-locale">
            {targets.map((code) => <MenuItem key={code} value={code}>{localeLabel(code)}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Nytt språk (kode)"
          placeholder="en"
          value={newLocale}
          onChange={(e) => setNewLocale(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void addLocale(); }}
          sx={{ ...fieldSx, width: 150 }}
          inputProps={{ 'data-testid': 'narrative-translations-new-locale', maxLength: 6 }}
        />
        <Button size="small" startIcon={<AddIcon />} onClick={() => void addLocale()} disabled={busy === 'locale'} sx={{ color: narrativeColors.accent }} data-testid="narrative-translations-add-locale">Legg til</Button>
      </Stack>

      <Stack direction="row" spacing={0.75} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        {SUGGESTED_LOCALES.filter((l) => !locales.includes(l.code)).slice(0, 6).map((l) => (
          <Chip key={l.code} size="small" label={`+ ${l.label}`} onClick={() => setNewLocale(l.code)} sx={{ bgcolor: 'transparent', border: `1px solid ${narrativeColors.borderStrong}`, color: narrativeColors.textDim }} />
        ))}
        {targets.map((code) => (
          <Chip key={code} size="small" label={localeLabel(code)} onDelete={() => void removeLocale(code)} deleteIcon={<RemoveIcon />} sx={{ bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent }} data-testid={`narrative-translations-chip-${code}`} />
        ))}
      </Stack>

      {targets.length === 0 ? (
        <Alert severity="info">Legg til et målspråk (f.eks. «en») for å begynne å oversette. Norsk bokmål er kildespråket.</Alert>
      ) : (
        <>
          <PlanGateBanner feature="translations" />
          <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, flex: 1 }} data-testid="narrative-translations-progress">
                {done} av {segments.length} tekster oversatt til {localeLabel(locale)}
              </Typography>
              <Button size="small" startIcon={<AiIcon />} onClick={() => void translate(null)} disabled={busy !== null || done >= segments.length || !canAi} sx={{ color: narrativeColors.accent }} data-testid="narrative-translations-ai-all" data-locked={canAi ? undefined : 'plan'}>
                Oversett alle manglende med KI
              </Button>
              <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={() => void save()} disabled={busy !== null || dirtyKeys.length === 0} sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700 }} data-testid="narrative-translations-save">
                Lagre {dirtyKeys.length ? `(${dirtyKeys.length})` : ''}
              </Button>
            </Stack>
            <LinearProgress variant="determinate" value={segments.length ? (done / segments.length) * 100 : 0} sx={{ mt: 1, height: 4, bgcolor: narrativeColors.borderSoft, '& .MuiLinearProgress-bar': { bgcolor: narrativeColors.accent } }} />
          </Box>

          <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mb: 1 }}>
            Skript (kodeblokker) oversettes aldri og vises ikke her — de følger kilden automatisk. Tomt felt = kildeteksten brukes.
          </Typography>

          <Stack spacing={1}>
            {segments.map((seg) => {
              const value = drafts[seg.key] ?? saved[seg.key] ?? '';
              const dirty = seg.key in drafts && (drafts[seg.key] ?? '') !== (saved[seg.key] ?? '');
              return (
                <Box key={`${seg.key}-${locale}`} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto' }, gap: 1, alignItems: 'start', p: 1.25, border: `1px solid ${dirty ? narrativeColors.accent : narrativeColors.borderSoft}`, borderRadius: 1.5, bgcolor: narrativeColors.bgPanel }} data-testid={`narrative-translation-row-${seg.key}`}>
                  <Box>
                    <Typography sx={{ fontSize: 10, color: narrativeColors.textDim, letterSpacing: 0.5, mb: 0.5 }}>{seg.context}</Typography>
                    <Typography sx={{ fontSize: 13, whiteSpace: 'pre-line' }}>{seg.sourceText}</Typography>
                  </Box>
                  <TextField
                    multiline
                    minRows={1}
                    size="small"
                    placeholder={`Oversettelse (${localeLabel(locale)})`}
                    value={value}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [seg.key]: e.target.value }))}
                    sx={fieldSx}
                    inputProps={{ 'data-testid': `narrative-translation-input-${seg.key}` }}
                  />
                  <Tooltip title="Oversett denne med KI">
                    <span>
                      <IconButton size="small" onClick={() => void translate([seg])} disabled={busy !== null} sx={{ color: narrativeColors.accent }} aria-label="Oversett med KI" data-testid={`narrative-translation-ai-${seg.key}`}>
                        <AiIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              );
            })}
          </Stack>
        </>
      )}
    </Box>
  );
}
