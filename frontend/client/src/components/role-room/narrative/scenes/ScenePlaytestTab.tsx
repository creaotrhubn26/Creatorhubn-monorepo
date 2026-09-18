/**
 * Scenekort → Spilltest (Fase 8e): aggregat fra spilltest-telemetrien for denne scenen —
 * økter, drop-off, median tid, dødsfall/fullført og valgfordeling, filtrert på build.
 * Ingen PII: tallene kommer fra anonyme økter sendt av spillet med et prosjekt-token.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { narrativeColors } from '../narrativeTheme';
import { htmlToText, type NarrativeGraph, type NarrativeSceneDetail } from '../narrativeTypes';
import { getPlaytestSummary, type PlaytestSummary } from '../narrativeService';
import { sceneFieldSx } from './sceneUi';

function fmtMs(ms: number | null): string {
  if (ms == null) return '–';
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

export function ScenePlaytestTab({ projectId, detail, graph }: { projectId: string; detail: NarrativeSceneDetail; graph: NarrativeGraph }) {
  const [summary, setSummary] = useState<PlaytestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [build, setBuild] = useState<string>('');
  const [days, setDays] = useState<number>(30);
  const load = useCallback(async () => {
    setError(null);
    try { setSummary(await getPlaytestSummary(projectId, { build: build || null, days })); }
    catch (err) { setError(err instanceof Error ? err.message : 'Kunne ikke hente spilltest-data.'); }
  }, [projectId, build, days]);
  useEffect(() => { void load(); }, [load]);

  const code = detail.scene.code.toUpperCase();
  const stats = useMemo(() => summary?.scenes.find((s) => s.sceneCode === code || s.sceneCode === (detail.scene.workingId ?? '').toUpperCase()) ?? null, [summary, code, detail.scene.workingId]);
  const connectionLabel = useCallback((id: string) => {
    const c = graph.connections.find((x) => x.id === id);
    if (!c) return id;
    const target = graph.elements.find((e) => e.id === c.targetId);
    const label = htmlToText(c.labelHtml) || (target ? htmlToText(target.titleHtml) : '');
    return label || id;
  }, [graph]);

  return (
    <Stack spacing={1.5} sx={{ maxWidth: 900 }} data-testid="narrative-scene-playtest">
      <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>
        Telemetri fra spilltester (iPad-runtime, standalone-spiller eller JS-pakken) sendt med et spilltest-token fra Integrasjoner-fanen. Kun scenekode, hendelse og tid — ingen personopplysninger.
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField select size="small" label="Build" value={build} onChange={(e) => setBuild(e.target.value)} sx={{ ...sceneFieldSx, minWidth: 160 }} inputProps={{ 'data-testid': 'narrative-playtest-build' }}>
          <MenuItem value="">Alle builds</MenuItem>
          {(summary?.builds ?? []).map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Periode" value={days} onChange={(e) => setDays(Number(e.target.value))} sx={{ ...sceneFieldSx, minWidth: 140 }}>
          {[7, 30, 90].map((d) => <MenuItem key={d} value={d}>Siste {d} dager</MenuItem>)}
        </TextField>
        <Button size="small" onClick={() => void load()} sx={{ color: narrativeColors.textDim }}>Oppdater</Button>
      </Stack>
      {error ? <Alert severity="error" action={<Button size="small" color="inherit" onClick={() => void load()}>Prøv igjen</Button>}>{error}</Alert> : null}
      {summary && !stats ? (
        <Box sx={{ color: narrativeColors.textDim, fontSize: 12, p: 2, border: `1px dashed ${narrativeColors.borderSoft}`, borderRadius: 2 }} data-testid="narrative-playtest-empty">
          Ingen spilltest-hendelser for {code} i perioden. Opprett et token under Integrasjoner og send <code>enter</code>/<code>exit</code>/<code>choice</code> fra spillet.
        </Box>
      ) : null}
      {stats ? (
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap data-testid="narrative-playtest-kpis">
            {[
              { k: 'sessions', label: 'økter', v: String(stats.sessions) },
              { k: 'dropoff', label: 'drop-off (økter som slutter her)', v: String(stats.dropOff), warn: stats.dropOff > 0 },
              { k: 'median', label: 'median tid i scenen', v: fmtMs(stats.medianTimeMs) },
              { k: 'deaths', label: 'dødsfall', v: String(stats.deaths), warn: stats.deaths > 0 },
              { k: 'completes', label: 'fullført', v: String(stats.completes) },
            ].map((c) => (
              <Box key={c.k} sx={{ px: 1.5, py: 1, borderRadius: 2, border: `1px solid ${c.warn ? narrativeColors.warning : narrativeColors.borderSoft}`, minWidth: 120 }} data-testid={`narrative-playtest-kpi-${c.k}`}>
                <Typography sx={{ fontSize: 20, fontWeight: 800, color: c.warn ? narrativeColors.warning : narrativeColors.text }}>{c.v}</Typography>
                <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{c.label}</Typography>
              </Box>
            ))}
          </Stack>
          <Typography sx={{ fontSize: 13, fontWeight: 800 }}>Valg tatt i scenen</Typography>
          {Object.keys(stats.choices).length === 0 ? (
            <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen valg registrert.</Typography>
          ) : (
            <Stack spacing={0.5} data-testid="narrative-playtest-choices">
              {Object.entries(stats.choices).sort((a, b) => b[1] - a[1]).map(([id, n]) => {
                const total = Object.values(stats.choices).reduce((x, y) => x + y, 0) || 1;
                const pct = Math.round((n / total) * 100);
                return (
                  <Stack key={id} direction="row" spacing={1} alignItems="center" data-testid={`narrative-playtest-choice-${id}`}>
                    <Box sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: narrativeColors.accent }} />
                    </Box>
                    <Typography sx={{ fontSize: 12, minWidth: 220 }}>{connectionLabel(id)}</Typography>
                    <Chip size="small" label={`${n} · ${pct} %`} sx={{ height: 20 }} />
                  </Stack>
                );
              })}
            </Stack>
          )}
          <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>
            Totalt i prosjektet: {summary?.sessions ?? 0} økter · {summary?.events ?? 0} hendelser{summary?.worstDropOff ? ` · verste drop-off: ${summary.worstDropOff.sceneCode} (${summary.worstDropOff.sessions})` : ''}.
          </Typography>
        </>
      ) : null}
    </Stack>
  );
}
