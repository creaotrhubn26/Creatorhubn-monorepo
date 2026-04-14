// ============================================
// ProductionNotesPanel — per-scene, draft/saved, autosave
// ============================================
import { useState, useEffect, useRef, useCallback, memo, type FC } from 'react';
import {
  Box,
  Typography,
  Stack,
  IconButton,
  TextField,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  Movie as MovieIcon,
  Mic as MicIcon,
  Layers as SceneIcon,
} from '@mui/icons-material';

import { type NoteType, NOTE_TYPE_META } from './types';
import GlobalMentionHelper from '../shared/GlobalMentionHelper';

// ---- Icon lookup ----
const NOTE_ICONS: Record<NoteType, typeof CameraIcon> = {
  camera: CameraIcon,
  director: MovieIcon,
  sound: MicIcon,
  vfx: SceneIcon,
};

// ---- Props ----
interface ProductionNotesPanelProps {
  sceneId: string;
  sceneNumber?: number;
  /** Current saved notes (from parent / DB) */
  savedNotes: Partial<Record<NoteType, string>>;
  /** Called when a note should be persisted */
  onSaveNote: (sceneId: string, noteType: NoteType, value: string) => void;
  /** Whether we're in read-through mode */
  readThroughMode?: boolean;
}

// ---- Component ----
const ProductionNotesPanel: FC<ProductionNotesPanelProps> = memo(function ProductionNotesPanel({
  sceneId,
  sceneNumber,
  savedNotes,
  onSaveNote,
  readThroughMode,
}) {
  // Local draft state per note type
  const [drafts, setDrafts] = useState<Partial<Record<NoteType, string>>>({});
  const [editing, setEditing] = useState<NoteType | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addNoteType, setAddNoteType] = useState<NoteType>('camera');
  const [addNoteValue, setAddNoteValue] = useState('');

  // Dirty tracking per type
  const dirtyRef = useRef<Set<NoteType>>(new Set());
  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved'>>({});

  // Reset drafts when scene changes
  useEffect(() => {
    setDrafts({});
    setEditing(null);
    dirtyRef.current.clear();
    // Clear all timers
    Object.values(saveTimerRef.current).forEach(clearTimeout);
    saveTimerRef.current = {};
    setSaveStatus({});
  }, [sceneId]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      dirtyRef.current.forEach((noteType) => {
        const val = drafts[noteType];
        if (val !== undefined) {
          onSaveNote(sceneId, noteType, val);
        }
      });
    };
  }, []);

  const getValue = useCallback((type: NoteType): string => {
    return drafts[type] ?? savedNotes[type] ?? '';
  }, [drafts, savedNotes]);

  const handleStartEdit = useCallback((type: NoteType) => {
    setEditing(type);
    setDrafts(prev => ({
      ...prev,
      [type]: prev[type] ?? savedNotes[type] ?? '',
    }));
  }, [savedNotes]);

  const handleDraftChange = useCallback((type: NoteType, value: string) => {
    setDrafts(prev => ({ ...prev, [type]: value }));
    dirtyRef.current.add(type);

    // Debounced autosave — 1200ms
    clearTimeout(saveTimerRef.current[type]);
    setSaveStatus(prev => ({ ...prev, [type]: 'saving' }));
    saveTimerRef.current[type] = setTimeout(() => {
      onSaveNote(sceneId, type, value);
      dirtyRef.current.delete(type);
      setSaveStatus(prev => ({ ...prev, [type]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => {
        const next = { ...prev };
        delete next[type];
        return next;
      }), 1500);
    }, 1200);
  }, [sceneId, onSaveNote]);

  const handleSaveAndClose = useCallback((type: NoteType) => {
    const val = drafts[type] ?? '';
    clearTimeout(saveTimerRef.current[type]);
    onSaveNote(sceneId, type, val);
    dirtyRef.current.delete(type);
    setEditing(null);
    setSaveStatus(prev => ({ ...prev, [type]: 'saved' }));
    setTimeout(() => setSaveStatus(prev => {
      const next = { ...prev };
      delete next[type];
      return next;
    }), 1500);
  }, [drafts, sceneId, onSaveNote]);

  const handleCancel = useCallback((type: NoteType) => {
    clearTimeout(saveTimerRef.current[type]);
    setDrafts(prev => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    dirtyRef.current.delete(type);
    setEditing(null);
    setSaveStatus(prev => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((type: NoteType, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveAndClose(type);
    } else if (e.key === 'Escape') {
      handleCancel(type);
    }
  }, [handleSaveAndClose, handleCancel]);

  // Add dialog handlers
  const handleAddNote = useCallback(() => {
    if (addNoteValue.trim()) {
      onSaveNote(sceneId, addNoteType, addNoteValue);
      setDrafts(prev => ({ ...prev, [addNoteType]: addNoteValue }));
    }
    setShowAddDialog(false);
    setAddNoteValue('');
  }, [addNoteType, addNoteValue, sceneId, onSaveNote]);

  // Which types have content?
  const _activeTypes: NoteType[] = (['camera', 'director', 'sound', 'vfx'] as NoteType[]).filter(
    t => getValue(t)
  );
  const inactiveTypes = (['camera', 'director', 'sound', 'vfx'] as NoteType[]).filter(
    t => !getValue(t)
  );

  return (
    <Box data-testid="pmv-production-notes-panel" sx={{ p: 3, borderBottom: '1px solid #252d3d' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', letterSpacing: 0.5 }}>
          {readThroughMode ? 'READ THROUGH NOTES' : 'PRODUCTION NOTES'}
        </Typography>
        <Tooltip title="Legg til note">
          <IconButton
            size="small"
            data-testid="pmv-production-notes-add"
            onClick={() => {
              setAddNoteType(inactiveTypes[0] ?? 'camera');
              setAddNoteValue('');
              setShowAddDialog(true);
            }}
            sx={{
              color: '#6b7280',
              bgcolor: readThroughMode ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
              '&:hover': { bgcolor: readThroughMode ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)' },
            }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={2}>
        {/* Render all active note types inline */}
        {(['camera', 'director', 'sound', 'vfx'] as NoteType[]).map(type => {
          const meta = NOTE_TYPE_META[type];
          const Icon = NOTE_ICONS[type];
          const value = getValue(type);
          const isEditing = editing === type;
          const status = saveStatus[type];

          // Don't show empty types unless we're editing them
          if (!value && !isEditing) return null;

          return (
            <Box
              key={type}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 2,
                bgcolor: meta.bgAlpha,
                borderRadius: '10px',
                borderLeft: `3px solid ${meta.color}`,
              }}
            >
              <Box sx={{
                width: 28,
                height: 28,
                borderRadius: type === 'director' ? '50%' : '8px',
                bgcolor: type === 'director' ? meta.color : `${meta.color}33`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {type === 'director' ? (
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>R</Typography>
                ) : (
                  <Icon sx={{ fontSize: 14, color: meta.color }} />
                )}
              </Box>

              <Box sx={{ flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontSize: 10, color: meta.color, fontWeight: 600 }}>
                    {meta.labelNo.toUpperCase()}
                  </Typography>
                  {status === 'saving' && (
                    <Typography sx={{ fontSize: 9, color: '#fbbf24', opacity: 0.8 }}>Lagrer…</Typography>
                  )}
                  {status === 'saved' && (
                    <Typography sx={{ fontSize: 9, color: '#4ade80', opacity: 0.8 }}>✓ Lagret</Typography>
                  )}
                </Stack>

                {isEditing ? (
                  <Stack spacing={1}>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      value={drafts[type] ?? value}
                      onChange={(e) => handleDraftChange(type, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(type, e)}
                      placeholder={`Skriv ${meta.labelNo.toLowerCase()} note...`}
                      autoFocus
                      helperText="Cmd+Enter = lagre, Esc = avbryt"
                      sx={{
                        '& .MuiInputBase-input': { color: '#e5e7eb', fontSize: 12 },
                        '& .MuiOutlinedInput-root': { bgcolor: '#0f1318', '& fieldset': { borderColor: meta.color } },
                        '& .MuiFormHelperText-root': { color: '#4b5563', fontSize: 9 },
                      }}
                    />
                    <GlobalMentionHelper
                      text={drafts[type] ?? value}
                      onApplySuggestion={(name) => {
                        const current = drafts[type] ?? value;
                        const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
                        const next = replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
                        handleDraftChange(type, next);
                      }}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="contained" onClick={() => handleSaveAndClose(type)} startIcon={<CheckIcon sx={{ fontSize: 12 }} />} sx={{ bgcolor: meta.color, fontSize: 10 }}>
                        Lagre
                      </Button>
                      <Button size="small" onClick={() => handleCancel(type)} startIcon={<CloseIcon sx={{ fontSize: 12 }} />} sx={{ color: '#6b7280', fontSize: 10 }}>
                        Avbryt
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Typography
                    onClick={() => handleStartEdit(type)}
                    sx={{ fontSize: 12, color: '#9ca3af', cursor: 'pointer', '&:hover': { color: '#e5e7eb' } }}
                  >
                    {value || `Klikk for å legge til ${meta.labelNo.toLowerCase()} note...`}
                  </Typography>
                )}
              </Box>

              {!isEditing && (
                <IconButton
                  size="small"
                  onClick={() => handleStartEdit(type)}
                  sx={{ color: '#4b5563', '&:hover': { color: meta.color } }}
                >
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>
          );
        })}
      </Stack>

      {/* Add Note Dialog — all 4 types */}
      <Dialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        PaperProps={{ 'data-testid': 'pmv-production-notes-dialog', sx: { bgcolor: '#1a1f2e', border: '1px solid #3b82f6', minWidth: 400 } }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AddIcon sx={{ color: '#3b82f6' }} />
            <span>Legg til produksjonsnotis</span>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ color: '#9ca3af', mb: 2, fontSize: 13 }}>
            Velg type notis for scene {sceneNumber}
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#6b7280', mb: 1 }}>Type</Typography>
              <Stack direction="row" spacing={1}>
                {(['camera', 'director', 'sound', 'vfx'] as NoteType[]).map(t => {
                  const meta = NOTE_TYPE_META[t];
                  const Icon = NOTE_ICONS[t];
                  return (
                    <Box
                      key={t}
                      onClick={() => setAddNoteType(t)}
                      sx={{
                        px: 2, py: 1, borderRadius: '8px',
                        bgcolor: addNoteType === t ? `${meta.color}22` : 'rgba(0,0,0,0.2)',
                        border: `1px solid ${addNoteType === t ? meta.color : '#374151'}`,
                        cursor: 'pointer',
                        '&:hover': { borderColor: meta.color },
                      }}
                    >
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Icon sx={{ fontSize: 14, color: meta.color }} />
                        <Typography sx={{ fontSize: 12, color: addNoteType === t ? meta.color : '#9ca3af' }}>{meta.labelNo}</Typography>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Skriv notis..."
              value={addNoteValue}
              onChange={(e) => setAddNoteValue(e.target.value)}
              inputProps={{ 'data-testid': 'pmv-production-notes-input' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote();
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#0d1117', color: '#fff',
                  '& fieldset': { borderColor: '#374151' },
                  '&:hover fieldset': { borderColor: '#3b82f6' },
                  '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                },
              }}
            />
            <GlobalMentionHelper
              text={addNoteValue}
              onApplySuggestion={(name) => {
                setAddNoteValue((previous) => {
                  if (!previous.trim()) return name;
                  const replaced = previous.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
                  return replaced !== previous ? replaced : `${previous.trimEnd()} ${name}`;
                });
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setShowAddDialog(false); setAddNoteValue(''); }} sx={{ color: '#9ca3af' }}>Avbryt</Button>
          <Button
            onClick={handleAddNote}
            variant="contained"
            disabled={!addNoteValue.trim()}
            data-testid="pmv-production-notes-confirm"
            sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' }, '&.Mui-disabled': { bgcolor: '#374151', color: '#6b7280' } }}
          >
            Legg til
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default ProductionNotesPanel;
