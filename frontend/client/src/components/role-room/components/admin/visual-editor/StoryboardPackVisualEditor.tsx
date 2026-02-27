import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Select,
  Tabs,
  Tab,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import storyboardPackService from '../../../services/storyboardPackService';
import type { StoryboardPackAdminState, StoryboardPackManifest } from '../../storyboardPackTypes';

const formatDate = (value: string | null | undefined) => (value ? new Date(value).toLocaleString() : 'Not published');

export function StoryboardPackVisualEditor() {
  const [state, setState] = useState<StoryboardPackAdminState | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string>('');
  const [activeSlotId, setActiveSlotId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishWarning, setPublishWarning] = useState<string | null>(null);

  useEffect(() => {
    storyboardPackService.getAdminState().then((result) => {
      setState(result);
      setSelectedPackId(result.draft.packs[0]?.id ?? '');
      setActiveSlotId(result.draft.packs[0]?.slots[0]?.id ?? '');
    });
  }, []);

  const selectedPack = useMemo(
    () => state?.draft.packs.find((pack) => pack.id === selectedPackId) ?? state?.draft.packs[0],
    [state, selectedPackId],
  );
  const activeSlot = selectedPack?.slots.find((slot) => slot.id === activeSlotId) ?? selectedPack?.slots[0];

  const updateDraft = (updater: (draft: StoryboardPackManifest) => StoryboardPackManifest) => {
    setDirty(true);
    setState((prev) => (prev ? { ...prev, draft: updater(prev.draft), updatedAt: new Date().toISOString() } : prev));
  };

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>, packId: string, slotId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const imageBase64 = await fileToBase64(file);
    try {
      setErrorMessage(null);
      const { imageUrl } = await storyboardPackService.uploadSlotImage({ packId, slotId, fileName: file.name, imageBase64 });
      updateDraft((draft) => ({
        ...draft,
        packs: draft.packs.map((pack) => (pack.id !== packId ? pack : {
          ...pack,
          slots: pack.slots.map((slot) => (slot.id === slotId ? { ...slot, imageUrl } : slot)),
        })),
      }));
    } catch {
      setErrorMessage('Image upload failed. Please retry.');
    }
  };

  if (!state || !selectedPack || !activeSlot) return null;

  return (
    <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" sx={{ color: '#fff' }}>Storyboard Packs</Typography>
        <Stack direction="row" spacing={1}>
          <Chip size="small" label={`Version ${state.version}`} sx={{ color: '#fff' }} />
          <Chip size="small" label={`Published: ${formatDate(state.publishedAt)}`} sx={{ color: '#fff' }} />
          {dirty && <Chip size="small" label="Unsaved changes" sx={{ color: '#fbbf24' }} />}
          {state.draft.version !== state.published.version && <Chip size="small" label="Draft differs from published" sx={{ color: '#f97316' }} />}
        </Stack>
      </Stack>

      {errorMessage && (
        <Typography sx={{ color: '#fca5a5', fontSize: 13, mb: 1 }}>{errorMessage}</Typography>
      )}
      {publishWarning && (
        <Typography sx={{ color: '#fdba74', fontSize: 13, mb: 1 }}>{publishWarning}</Typography>
      )}

      <Stack spacing={2}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ '& .MuiTab-root': { color: 'rgba(255,255,255,0.75)' }, '& .Mui-selected': { color: '#fbbf24 !important' }, '& .MuiTabs-indicator': { bgcolor: '#f59e0b' } }}>
          <Tab label="Presets" />
          <Tab label="Custom" />
          <Tab label="Library" />
        </Tabs>
        <Select
          value={selectedPack.id}
          onChange={(event) => {
            const nextPackId = String(event.target.value);
            setSelectedPackId(nextPackId);
            const nextPack = state.draft.packs.find((pack) => pack.id === nextPackId);
            setActiveSlotId(nextPack?.slots[0]?.id ?? '');
          }}
          sx={{ color: '#fff' }}
        >
          {state.draft.packs.map((pack) => (
            <MenuItem key={pack.id} value={pack.id}>{pack.name}</MenuItem>
          ))}
        </Select>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1.5 }}>
          {selectedPack.slots.map((slot, index) => (
            <Paper
              key={slot.id}
              onClick={() => setActiveSlotId(slot.id)}
              sx={{
                p: 1,
                cursor: 'pointer',
                border: slot.id === activeSlot.id ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.12)',
                bgcolor: '#0f172a',
              }}
            >
              <Box component="img" src={slot.imageUrl} alt={slot.name} sx={{ width: '100%', height: 84, objectFit: 'cover', borderRadius: 1 }} />
              <Typography sx={{ color: '#fff', fontSize: 12, mt: 0.5 }}>{slot.name}</Typography>
              <Stack direction="row" spacing={0.5} mt={1}>
                <Button
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (index === 0) return;
                    updateDraft((draft) => ({
                      ...draft,
                      packs: draft.packs.map((pack) => {
                        if (pack.id !== selectedPack.id) return pack;
                        const slots = [...pack.slots];
                        [slots[index - 1], slots[index]] = [slots[index], slots[index - 1]];
                        return { ...pack, slots };
                      }),
                    }));
                  }}
                >↑</Button>
                <Button
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (index >= selectedPack.slots.length - 1) return;
                    updateDraft((draft) => ({
                      ...draft,
                      packs: draft.packs.map((pack) => {
                        if (pack.id !== selectedPack.id) return pack;
                        const slots = [...pack.slots];
                        [slots[index + 1], slots[index]] = [slots[index], slots[index + 1]];
                        return { ...pack, slots };
                      }),
                    }));
                  }}
                >↓</Button>
                <Button component="label" size="small" sx={{ color: '#fbbf24' }}>Replace<input hidden type="file" accept="image/*" onChange={(e) => void onUpload(e, selectedPack.id, slot.id)} /></Button>
              </Stack>
            </Paper>
          ))}
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

        <Stack spacing={1}>
          <TextField
            label="Slot name"
            value={activeSlot.name}
            onChange={(event) => updateDraft((draft) => ({
              ...draft,
              packs: draft.packs.map((pack) => (pack.id !== selectedPack.id ? pack : {
                ...pack,
                slots: pack.slots.map((slot) => (slot.id === activeSlot.id ? { ...slot, name: event.target.value } : slot)),
              })),
            }))}
          />
          <TextField
            label="Slot description"
            value={activeSlot.description}
            onChange={(event) => updateDraft((draft) => ({
              ...draft,
              packs: draft.packs.map((pack) => (pack.id !== selectedPack.id ? pack : {
                ...pack,
                slots: pack.slots.map((slot) => (slot.id === activeSlot.id ? { ...slot, description: event.target.value } : slot)),
              })),
            }))}
          />
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setErrorMessage(null);
              setPublishWarning(null);
              try {
                const result = await storyboardPackService.saveDraft({ ...state.draft, updatedAt: new Date().toISOString() });
                setState(result);
                setDirty(false);
              } catch {
                setErrorMessage('Save draft failed. Please retry.');
              } finally {
                setSaving(false);
              }
            }}
          >Save Draft</Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setPublishWarning(null);
              setErrorMessage(null);
              try {
                const latestState = await storyboardPackService.getAdminState();
                const hasPublishedChanged =
                  latestState.version !== state.version || latestState.publishedAt !== state.publishedAt;
                if (hasPublishedChanged) {
                  setPublishWarning('Published manifest changed since you loaded this page. Review latest draft before publishing.');
                  if (!window.confirm('Published manifest changed in another session. Publish anyway?')) {
                    setState(latestState);
                    return;
                  }
                }

                const result = await storyboardPackService.publishDraft();
                setState(result);
                setDirty(false);
              } catch {
                setErrorMessage('Publish failed. Please retry.');
              } finally {
                setSaving(false);
              }
            }}
          >Publish</Button>
          <Button
            variant="outlined"
            onClick={() => {
              if (dirty && !window.confirm('Discard unsaved draft changes?')) return;
              setState((prev) => (prev ? { ...prev, draft: prev.published } : prev));
              setDirty(false);
            }}
          >Reset to Published</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default StoryboardPackVisualEditor;
