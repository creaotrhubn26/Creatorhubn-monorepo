/**
 * AssetsPanel — ressurser (Fase 1: ekstern URL). Opplasting til S3 er Fase 3.
 */

import React, { useState } from 'react';
import {
  Box, Button, Card, CardContent, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { NARRATIVE_ASSET_KINDS, type NarrativeAssetKind, type NarrativeGraph } from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';
import type { UseNarrativeGraphResult } from '../state/useNarrativeGraph';

const fieldSx = {
  '& .MuiInputBase-root': { color: narrativeColors.text, bgcolor: 'rgba(255,255,255,0.03)' },
  '& .MuiInputLabel-root': { color: narrativeColors.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: narrativeColors.borderStrong },
};

const KIND_LABELS: Record<NarrativeAssetKind, string> = { image: 'Bilde', audio: 'Lyd', video: 'Video' };

export function AssetsPanel({ graph, store }: { graph: NarrativeGraph; store: UseNarrativeGraphResult }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<NarrativeAssetKind>('image');
  const [url, setUrl] = useState('');
  const urlValid = /^https?:\/\/\S+$/i.test(url.trim());

  return (
    <Box sx={{ p: 2, color: narrativeColors.text }} data-testid="narrative-assets-panel">
      <Typography sx={{ fontSize: 13, color: narrativeColors.textDim, mb: 2, maxWidth: 720 }}>
        Legg inn bilder, lyd og video via lenke. Direkte opplasting kommer i Fase 3.
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <TextField size="small" label="Navn" value={name} onChange={(e) => setName(e.target.value)} sx={{ ...fieldSx, minWidth: 200 }} />
        <FormControl size="small" sx={{ ...fieldSx, minWidth: 120 }}>
          <InputLabel id="asset-kind-label">Type</InputLabel>
          <Select labelId="asset-kind-label" label="Type" value={kind} onChange={(e) => setKind(e.target.value as NarrativeAssetKind)}>
            {NARRATIVE_ASSET_KINDS.map((k) => <MenuItem key={k} value={k}>{KIND_LABELS[k]}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" label="URL" value={url} onChange={(e) => setUrl(e.target.value)} error={!!url && !urlValid} sx={{ ...fieldSx, minWidth: 320, flex: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={!name.trim() || !urlValid}
          onClick={async () => {
            await store.createAsset({ name: name.trim(), kind, externalUrl: url.trim() });
            setName('');
            setUrl('');
          }}
          sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, '&:hover': { bgcolor: narrativeColors.accentDark } }}
        >
          Legg til
        </Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.5 }}>
        {graph.assets.length === 0 ? (
          <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen ressurser ennå.</Typography>
        ) : null}
        {graph.assets.map((a) => (
          <Card key={a.id} sx={{ bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}`, color: narrativeColors.text }}>
            {a.kind === 'image' && a.externalUrl ? (
              <Box component="img" src={a.externalUrl} alt={a.name} sx={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} loading="lazy" />
            ) : (
              <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: narrativeColors.textDim, fontSize: 12 }}>
                {KIND_LABELS[a.kind]}
              </Box>
            )}
            <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</Typography>
                <IconButton size="small" onClick={() => { if (window.confirm(`Slette «${a.name}»?`)) void store.deleteAsset(a.id); }} sx={{ color: narrativeColors.error }} aria-label={`Slett ${a.name}`}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
