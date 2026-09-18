/**
 * ComponentsPanel — karakterer/steder/gjenstander med attributter.
 */

import React, { useMemo, useState } from 'react';
import {
  Box, Button, FormControl, IconButton, InputLabel, List, ListItemButton, ListItemText,
  MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import {
  ATTRIBUTE_TYPE_LABELS, NARRATIVE_ATTRIBUTE_TYPES,
  type NarrativeAttributeType, type NarrativeGraph,
} from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';
import type { UseNarrativeGraphResult } from '../state/useNarrativeGraph';

const fieldSx = {
  '& .MuiInputBase-root': { color: narrativeColors.text, bgcolor: 'rgba(255,255,255,0.03)' },
  '& .MuiInputLabel-root': { color: narrativeColors.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: narrativeColors.borderStrong },
};

function coerce(type: NarrativeAttributeType, raw: string): unknown {
  switch (type) {
    case 'int': return Number.parseInt(raw, 10) || 0;
    case 'float': return Number.parseFloat(raw) || 0;
    case 'bool': return raw === 'true' || raw === '1' || raw.toLowerCase() === 'ja';
    case 'component_list':
    case 'asset_list': return raw.split(',').map((s) => s.trim()).filter(Boolean);
    default: return raw;
  }
}

function display(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  return JSON.stringify(value);
}

export function ComponentsPanel({ graph, store }: { graph: NarrativeGraph; store: UseNarrativeGraphResult }) {
  const [selectedId, setSelectedId] = useState<string | null>(graph.components[0]?.id ?? null);
  const [newName, setNewName] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [attrName, setAttrName] = useState('');
  const [attrType, setAttrType] = useState<NarrativeAttributeType>('string');

  const selected = graph.components.find((c) => c.id === selectedId) ?? null;
  const attributes = useMemo(
    () => (selected ? graph.attributes.filter((a) => a.ownerKind === 'component' && a.ownerId === selected.id) : []),
    [graph.attributes, selected],
  );
  const usedIn = useMemo(
    () => (selected ? graph.elementComponents.filter((ec) => ec.componentId === selected.id).length : 0),
    [graph.elementComponents, selected],
  );

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 480 }} data-testid="narrative-components-panel">
      <Box sx={{ width: 280, flex: '0 0 280px', borderRight: `1px solid ${narrativeColors.borderStrong}`, display: 'flex', flexDirection: 'column', bgcolor: narrativeColors.bgPanel }}>
        <Box sx={{ p: 1.5, borderBottom: `1px solid ${narrativeColors.borderStrong}` }}>
          <Stack spacing={1}>
            <TextField size="small" label="Ny komponent" value={newName} onChange={(e) => setNewName(e.target.value)} sx={fieldSx} inputProps={{ 'data-testid': 'narrative-new-component-name' }} />
            <TextField size="small" label="Mappe (valgfri)" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} sx={fieldSx} placeholder="Karakterer" />
            <Button
              size="small"
              startIcon={<AddIcon />}
              disabled={!newName.trim()}
              onClick={async () => {
                await store.createComponent({ name: newName.trim(), folderPath: newFolder.trim() });
                setNewName('');
              }}
              sx={{ color: narrativeColors.accent, alignSelf: 'flex-start' }}
              data-testid="narrative-new-component-submit"
            >
              Opprett
            </Button>
          </Stack>
        </Box>
        <List dense sx={{ overflowY: 'auto', flex: 1 }}>
          {graph.components.length === 0 ? (
            <Typography sx={{ px: 1.5, py: 1, fontSize: 12, color: narrativeColors.textDim }}>
              Ingen komponenter ennå. Karakterer, steder og gjenstander lever her og kan festes på elementer.
            </Typography>
          ) : null}
          {graph.components.map((c) => (
            <ListItemButton key={c.id} selected={c.id === selectedId} onClick={() => setSelectedId(c.id)} sx={{ '&.Mui-selected': { bgcolor: narrativeColors.accentSoft } }}>
              <ListItemText
                primary={c.name}
                secondary={c.folderPath || null}
                primaryTypographyProps={{ fontSize: 13, color: narrativeColors.text }}
                secondaryTypographyProps={{ fontSize: 10, color: narrativeColors.textDim }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Box sx={{ flex: 1, p: 2, overflowY: 'auto', color: narrativeColors.text }}>
        {!selected ? (
          <Typography sx={{ color: narrativeColors.textDim, fontSize: 13 }}>Velg en komponent til venstre.</Typography>
        ) : (
          <Stack spacing={2} sx={{ maxWidth: 640 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                label="Navn"
                defaultValue={selected.name}
                key={`${selected.id}-name`}
                onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== selected.name) void store.patchComponent(selected.id, { name: e.target.value.trim() }); }}
                sx={{ ...fieldSx, flex: 1 }}
              />
              <TextField
                size="small"
                label="Mappe"
                defaultValue={selected.folderPath}
                key={`${selected.id}-folder`}
                onBlur={(e) => { if (e.target.value.trim() !== selected.folderPath) void store.patchComponent(selected.id, { folderPath: e.target.value.trim() }); }}
                sx={{ ...fieldSx, width: 180 }}
              />
              <TextField
                size="small"
                label="Custom-ID"
                defaultValue={selected.customId ?? ''}
                key={`${selected.id}-cid`}
                onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== selected.customId) void store.patchComponent(selected.id, { customId: v }); }}
                sx={{ ...fieldSx, width: 140 }}
              />
              <IconButton
                onClick={async () => {
                  if (!window.confirm(`Slette «${selected.name}»? Den fjernes fra ${usedIn} element(er).`)) return;
                  await store.deleteComponent(selected.id);
                  setSelectedId(null);
                }}
                sx={{ color: narrativeColors.error }}
                aria-label="Slett komponent"
              >
                <DeleteIcon />
              </IconButton>
            </Stack>
            <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Brukt på {usedIn} element(er).</Typography>

            <Typography sx={{ fontSize: 12, fontWeight: 700, color: narrativeColors.textDim }}>Attributter</Typography>
            <Stack spacing={1}>
              {attributes.map((a) => (
                <Stack key={a.id} direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontSize: 13, minWidth: 140 }}>{a.name}</Typography>
                  <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, minWidth: 90 }}>{ATTRIBUTE_TYPE_LABELS[a.type]}</Typography>
                  <TextField
                    size="small"
                    defaultValue={display(a.value)}
                    key={`${a.id}-${a.updatedAt}`}
                    onBlur={(e) => void store.patchAttribute(a.id, { value: coerce(a.type, e.target.value) })}
                    sx={{ ...fieldSx, flex: 1 }}
                    multiline={a.type === 'rich_text'}
                  />
                  <IconButton size="small" onClick={() => void store.deleteAttribute(a.id)} sx={{ color: narrativeColors.error }} aria-label="Fjern attributt">
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              ))}
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField size="small" placeholder="Navn" value={attrName} onChange={(e) => setAttrName(e.target.value)} sx={{ ...fieldSx, minWidth: 140 }} />
                <FormControl size="small" sx={{ ...fieldSx, minWidth: 150 }}>
                  <InputLabel id="attr-type-label">Type</InputLabel>
                  <Select labelId="attr-type-label" label="Type" value={attrType} onChange={(e) => setAttrType(e.target.value as NarrativeAttributeType)}>
                    {NARRATIVE_ATTRIBUTE_TYPES.map((t) => <MenuItem key={t} value={t}>{ATTRIBUTE_TYPE_LABELS[t]}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button
                  size="small"
                  disabled={!attrName.trim()}
                  onClick={async () => {
                    await store.createAttribute({ ownerKind: 'component', ownerId: selected.id, name: attrName.trim(), type: attrType, value: coerce(attrType, '') });
                    setAttrName('');
                  }}
                  sx={{ color: narrativeColors.accent }}
                >
                  Legg til attributt
                </Button>
              </Stack>
            </Stack>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
