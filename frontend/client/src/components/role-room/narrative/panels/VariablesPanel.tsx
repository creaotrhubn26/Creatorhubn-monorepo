/**
 * VariablesPanel — globale variabler (navn, type, standardverdi).
 */

import React, { useState } from 'react';
import {
  Box, Button, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import {
  NARRATIVE_VARIABLE_TYPES, VARIABLE_TYPE_LABELS,
  type NarrativeGraph, type NarrativeVariableType,
} from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';
import type { UseNarrativeGraphResult } from '../state/useNarrativeGraph';

const fieldSx = {
  '& .MuiInputBase-root': { color: narrativeColors.text, bgcolor: 'rgba(255,255,255,0.03)' },
  '& .MuiInputLabel-root': { color: narrativeColors.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: narrativeColors.borderStrong },
};

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,99}$/;

function coerce(type: NarrativeVariableType, raw: string): unknown {
  switch (type) {
    case 'int': return Number.parseInt(raw, 10) || 0;
    case 'float': return Number.parseFloat(raw) || 0;
    case 'bool': return raw === 'true' || raw === '1' || raw.toLowerCase() === 'ja';
    default: return raw;
  }
}

function display(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function VariablesPanel({ graph, store }: { graph: NarrativeGraph; store: UseNarrativeGraphResult }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<NarrativeVariableType>('bool');
  const [defaultRaw, setDefaultRaw] = useState('');
  const nameValid = NAME_RE.test(name);
  const cellSx = { color: narrativeColors.text, borderColor: narrativeColors.borderStrong, fontSize: 13 };

  return (
    <Box sx={{ p: 2, color: narrativeColors.text }} data-testid="narrative-variables-panel">
      <Typography sx={{ fontSize: 13, color: narrativeColors.textDim, mb: 2, maxWidth: 720 }}>
        Globale variabler leses og skrives fra forgreninger og skript (arcscript-kompatibel syntaks, f.eks.
        <Box component="code" sx={{ mx: 0.5, px: 0.5, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 0.5 }}>gold += 5</Box>
        og <Box component="code" sx={{ mx: 0.5, px: 0.5, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 0.5 }}>if gold &gt;= 10</Box>).
      </Typography>

      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <TextField
          size="small"
          label="Navn"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={!!name && !nameValid}
          helperText={name && !nameValid ? 'Bokstav/underscore først; deretter bokstaver, tall, underscore' : ' '}
          sx={{ ...fieldSx, minWidth: 200 }}
          inputProps={{ style: { fontFamily: 'monospace' }, 'data-testid': 'narrative-new-variable-name' }}
        />
        <FormControl size="small" sx={{ ...fieldSx, minWidth: 150 }}>
          <InputLabel id="var-type-label">Type</InputLabel>
          <Select labelId="var-type-label" label="Type" value={type} onChange={(e) => setType(e.target.value as NarrativeVariableType)}>
            {NARRATIVE_VARIABLE_TYPES.map((t) => <MenuItem key={t} value={t}>{VARIABLE_TYPE_LABELS[t]}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" label="Standardverdi" value={defaultRaw} onChange={(e) => setDefaultRaw(e.target.value)} sx={{ ...fieldSx, minWidth: 160 }} placeholder={type === 'bool' ? 'false' : type === 'string' ? '' : '0'} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={!nameValid}
          onClick={async () => {
            await store.createVariable({ name, type, defaultValue: coerce(type, defaultRaw) });
            setName('');
            setDefaultRaw('');
          }}
          sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, '&:hover': { bgcolor: narrativeColors.accentDark }, height: 40 }}
          data-testid="narrative-new-variable-submit"
        >
          Legg til
        </Button>
      </Stack>

      <Table size="small" sx={{ maxWidth: 820 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...cellSx, color: narrativeColors.textDim }}>Navn</TableCell>
            <TableCell sx={{ ...cellSx, color: narrativeColors.textDim }}>Type</TableCell>
            <TableCell sx={{ ...cellSx, color: narrativeColors.textDim }}>Standardverdi</TableCell>
            <TableCell sx={cellSx} />
          </TableRow>
        </TableHead>
        <TableBody>
          {graph.variables.length === 0 ? (
            <TableRow><TableCell colSpan={4} sx={{ ...cellSx, color: narrativeColors.textDim }}>Ingen variabler ennå.</TableCell></TableRow>
          ) : null}
          {graph.variables.map((v) => (
            <TableRow key={v.id} data-testid={`narrative-variable-${v.name}`}>
              <TableCell sx={{ ...cellSx, fontFamily: 'monospace' }}>{v.name}</TableCell>
              <TableCell sx={cellSx}>{VARIABLE_TYPE_LABELS[v.type]}</TableCell>
              <TableCell sx={cellSx}>
                <TextField
                  size="small"
                  key={`${v.id}-${v.updatedAt}`}
                  defaultValue={display(v.defaultValue)}
                  onBlur={(e) => { const next = coerce(v.type, e.target.value); if (JSON.stringify(next) !== JSON.stringify(v.defaultValue)) void store.patchVariable(v.id, { defaultValue: next }); }}
                  sx={{ ...fieldSx, width: 180 }}
                />
              </TableCell>
              <TableCell sx={cellSx} align="right">
                <IconButton size="small" onClick={() => { if (window.confirm(`Slette variabelen «${v.name}»?`)) void store.deleteVariable(v.id); }} sx={{ color: narrativeColors.error }} aria-label={`Slett ${v.name}`}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
