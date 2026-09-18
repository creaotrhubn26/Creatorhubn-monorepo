/**
 * DebuggerPanel — brett/element, variabler (redigerbare), visits og logg.
 */

import React from 'react';
import { Box, Chip, Stack, TextField, Typography } from '@mui/material';
import type { PlayState, PlayView } from '@shared/narrative-runtime';
import type { ScriptValue } from '@shared/narrative-script';
import { htmlToText, type NarrativeGraph } from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';

export interface DebuggerPanelProps {
  graph: NarrativeGraph;
  view: PlayView | null;
  state: PlayState;
  variableDefs: Array<{ name: string; type: string }>;
  onSetVariable: (name: string, value: ScriptValue) => void;
}

const fieldSx = {
  '& .MuiInputBase-root': { color: narrativeColors.text, bgcolor: 'rgba(255,255,255,0.03)', fontFamily: 'monospace', fontSize: 12 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: narrativeColors.borderStrong },
};

function coerce(type: string, raw: string): ScriptValue {
  switch (type) {
    case 'int': return Number.parseInt(raw, 10) || 0;
    case 'float': return Number.parseFloat(raw) || 0;
    case 'bool': return raw === 'true' || raw === '1' || raw.toLowerCase() === 'ja';
    default: return raw;
  }
}

function display(value: ScriptValue | undefined): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box sx={{ mb: 2 }}>
    <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: narrativeColors.textDim, mb: 0.75 }}>{title}</Typography>
    {children}
  </Box>
);

export function DebuggerPanel({ graph, view, state, variableDefs, onSetVariable }: DebuggerPanelProps) {
  const board = view ? graph.boards.find((b) => b.id === view.boardId) : null;
  const elementTitle = (id: string | null): string => {
    if (!id) return '—';
    const e = graph.elements.find((x) => x.id === id);
    return e ? htmlToText(e.titleHtml) || 'Uten tittel' : id;
  };
  const recentLog = state.log.slice(-40).reverse();

  return (
    <Box data-testid="narrative-debugger" sx={{ p: 1.5, color: narrativeColors.text, overflowY: 'auto', height: '100%' }}>
      <Section title="POSISJON">
        <Typography sx={{ fontSize: 12 }}>
          <Box component="span" sx={{ color: narrativeColors.textDim }}>Brett: </Box>{board?.name ?? '—'}
        </Typography>
        <Typography sx={{ fontSize: 12 }} data-testid="narrative-debugger-element">
          <Box component="span" sx={{ color: narrativeColors.textDim }}>Element: </Box>{elementTitle(view?.elementId ?? null)}
        </Typography>
        <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, fontFamily: 'monospace' }}>{view?.elementId ?? ''}</Typography>
      </Section>

      <Section title="VARIABLER">
        {variableDefs.length === 0 ? (
          <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen variabler.</Typography>
        ) : (
          <Stack spacing={0.5}>
            {variableDefs.map((v) => (
              <Stack key={v.name} direction="row" spacing={1} alignItems="center" data-testid={`narrative-debugger-variable-${v.name}`}>
                <Typography sx={{ fontSize: 12, fontFamily: 'monospace', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</Typography>
                <Typography sx={{ fontSize: 10, color: narrativeColors.textDim, width: 40 }}>{v.type}</Typography>
                <TextField
                  size="small"
                  key={`${v.name}:${display(state.variables[v.name])}`}
                  defaultValue={display(state.variables[v.name])}
                  onBlur={(e) => { if (e.target.value !== display(state.variables[v.name])) onSetVariable(v.name, coerce(v.type, e.target.value)); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  sx={{ ...fieldSx, width: 110 }}
                  inputProps={{ 'data-testid': `narrative-debugger-value-${v.name}`, 'aria-label': `Verdi for ${v.name}` }}
                />
              </Stack>
            ))}
          </Stack>
        )}
      </Section>

      <Section title="BESØK">
        {Object.keys(state.visits).length === 0 ? (
          <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen ennå.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {Object.entries(state.visits).map(([id, n]) => (
              <Chip key={id} size="small" label={`${elementTitle(id)} × ${n}`} sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(255,255,255,0.06)', color: narrativeColors.text }} />
            ))}
          </Box>
        )}
      </Section>

      <Section title="LOGG">
        <Stack spacing={0.5}>
          {recentLog.map((entry) => {
            const changes = Object.entries(entry.changes);
            return (
              <Box key={entry.step} sx={{ fontSize: 11, borderLeft: `2px solid ${entry.errors.length ? narrativeColors.error : narrativeColors.borderStrong}`, pl: 1 }}>
                <Typography sx={{ fontSize: 11 }}>
                  <Box component="span" sx={{ color: narrativeColors.textDim }}>{entry.step}. </Box>
                  {entry.message} {entry.elementId ? <Box component="span" sx={{ color: narrativeColors.textDim }}>— {elementTitle(entry.elementId)}</Box> : null}
                </Typography>
                {changes.length > 0 ? (
                  <Typography sx={{ fontSize: 10, fontFamily: 'monospace', color: narrativeColors.accent }}>
                    {changes.map(([k, v]) => `${k} = ${display(v)}`).join(', ')}
                  </Typography>
                ) : null}
                {entry.errors.map((err, i) => (
                  <Typography key={i} sx={{ fontSize: 10, color: narrativeColors.error }}>{err.kind === 'parse' ? 'Skriptfeil' : 'Kjørefeil'}: {err.message}</Typography>
                ))}
              </Box>
            );
          })}
        </Stack>
      </Section>
    </Box>
  );
}
