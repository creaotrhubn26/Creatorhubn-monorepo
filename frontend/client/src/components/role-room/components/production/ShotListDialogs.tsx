import React, { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Box, Typography, Divider, Chip, Stack, FormControlLabel, Switch, Alert, CircularProgress, Autocomplete } from "@mui/material";
import { FileDownload as ExportIcon, PictureAsPdf as PdfIcon, Warning as WarnIcon } from "@mui/icons-material";
import type { ShotList, ProductionContext, Person } from "../../models/casting";
import type { ShotListSummary } from "../../models/derivedState";
import globalTagService from "../../services/globalTagService";
import GlobalMentionHelper from "../shared/GlobalMentionHelper";

// ─── Shared dialog paper styles ───────────────────────────────────────────────
const PAPER_SX = {
  bgcolor: '#1a1a2e',
  backgroundImage: 'none',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 2,
};

// ═══════════════════════════════════════════════════════════════════════════════
// A) CreateEditShotListDialog
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateEditShotListDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: Partial<ShotList>;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ShotList>) => void;
}

const CONTEXT_OPTIONS: ProductionContext[] = [
  'commercial',
  'music_video',
  'short_film',
  'feature_film',
  'documentary',
  'social_media',
  'event',
  'corporate',
  'wedding',
  'behind_the_scenes',
  'custom',
];

export function CreateEditShotListDialog({
  open,
  mode,
  initial,
  loading = false,
  onClose,
  onSubmit,
}: CreateEditShotListDialogProps) {
  const [form, setForm] = useState<Partial<ShotList>>({
    sceneId: '',
    sceneName: '',
    notes: '',
    productionContext: 'custom',
    equipment: [],
    ...initial,
  });

  useEffect(() => {
    if (open) {
      setForm({
        sceneId: '',
        sceneName: '',
        notes: '',
        productionContext: 'custom',
        equipment: [],
        ...initial,
      });
    }
  }, [open, initial]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const isValid = Boolean(form.sceneName?.trim() || form.sceneId?.trim());

  const handleSubmit = () => {
    const rawNotes = typeof form.notes === 'string' ? form.notes : '';
    if (rawNotes.trim().length > 0) {
      void globalTagService
        .add([
          ...(typeof form.sceneName === 'string' ? [form.sceneName] : []),
          ...globalTagService.parseExplicitMentions(rawNotes),
        ])
        .catch((error) => {
          console.warn('Kunne ikke oppdatere globalt tag-register fra shotlist-notater:', error);
        });
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: PAPER_SX }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>
        {mode === 'create' ? 'New Shot List' : 'Edit Shot List'}
      </DialogTitle>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Scene name */}
        <TextField
          label="Scene name / title"
          fullWidth
          size="small"
          required
          autoFocus
          value={form.sceneName ?? ''}
          onChange={(e) => set({ sceneName: e.target.value })}
        />

        {/* Scene ID (for linking to SceneBreakdown) */}
        <TextField
          label="Scene ID (optional)"
          fullWidth
          size="small"
          placeholder="Links to scene breakdown"
          value={form.sceneId ?? ''}
          onChange={(e) => set({ sceneId: e.target.value })}
          helperText="If left blank, a unique ID will be generated"
        />

        {/* Production context */}
        <FormControl size="small" fullWidth>
          <InputLabel>Production context</InputLabel>
          <Select
            value={form.productionContext ?? 'custom'}
            label="Production context"
            onChange={(e) => set({ productionContext: e.target.value as ProductionContext })}
          >
            {CONTEXT_OPTIONS.map((ctx) => (
              <MenuItem key={ctx} value={ctx}>
                {ctx.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Deadline */}
        <TextField
          label="Deadline (optional)"
          type="datetime-local"
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={form.deadline ?? ''}
          onChange={(e) => set({ deadline: e.target.value })}
        />

        {/* Notes */}
        <TextField
          label="Notes"
          multiline
          minRows={2}
          maxRows={5}
          fullWidth
          size="small"
          placeholder="Any notes about this shot list…"
          value={form.notes ?? ''}
          onChange={(e) => set({ notes: e.target.value })}
        />
        <GlobalMentionHelper
          text={typeof form.notes === 'string' ? form.notes : ''}
          onApplySuggestion={(name) => {
            const current = typeof form.notes === 'string' ? form.notes : '';
            if (!current.trim()) {
              set({ notes: name });
              return;
            }
            const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
            set({ notes: replaced !== current ? replaced : `${current.trimEnd()} ${name}` });
          }}
        />
      </DialogContent>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.5)' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!isValid || loading}
          onClick={handleSubmit}
          startIcon={loading ? <CircularProgress size={14} /> : undefined}
          sx={{ bgcolor: '#e91e63', '&:hover': { bgcolor: '#c2185b' }, textTransform: 'none', fontWeight: 600 }}
        >
          {mode === 'create' ? 'Create' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// B) ExportDialog
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExportDialogProps {
  open: boolean;
  /** If set, exporting a single list. If null, exporting all/selected. */
  shotListId: string | null;
  selectedCount?: number;
  onClose: () => void;
  onExportCSV: (shotListId: string | null) => void;
  onExportPDF: (shotListId: string | null) => void;
}

export function ExportDialog({
  open,
  shotListId,
  selectedCount = 0,
  onClose,
  onExportCSV,
  onExportPDF,
}: ExportDialogProps) {
  const label =
    shotListId
      ? '1 shot list'
      : selectedCount > 0
      ? `${selectedCount} selected`
      : 'all shot lists';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: PAPER_SX }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>Export {label}</DialogTitle>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<ExportIcon />}
          onClick={() => { onExportCSV(shotListId); onClose(); }}
          sx={{ justifyContent: 'flex-start', textTransform: 'none', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)' }}
        >
          Export as CSV
        </Button>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<PdfIcon />}
          onClick={() => { onExportPDF(shotListId); onClose(); }}
          sx={{ justifyContent: 'flex-start', textTransform: 'none', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)' }}
        >
          Export as PDF
        </Button>
      </DialogContent>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.5)' }}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// C) DeleteConfirmDialog
// ═══════════════════════════════════════════════════════════════════════════════

export interface DeleteConfirmDialogProps {
  open: boolean;
  count: number;
  listName?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  open,
  count,
  listName,
  loading = false,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth PaperProps={{ sx: PAPER_SX }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <WarnIcon sx={{ color: '#ef4444', fontSize: 20 }} />
        Delete {count > 1 ? `${count} shot lists` : (listName ?? 'shot list')}?
      </DialogTitle>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="warning" variant="outlined" sx={{ borderColor: '#ef444433', color: 'rgba(255,255,255,0.7)' }}>
          This will permanently delete {count > 1 ? `these ${count} shot lists` : 'this shot list'} and all contained shots.
          This action cannot be undone.
        </Alert>
      </DialogContent>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.5)' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={loading}
          onClick={onConfirm}
          startIcon={loading ? <CircularProgress size={14} /> : undefined}
          sx={{ bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' }, textTransform: 'none', fontWeight: 600 }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// D) BatchAssignDialog
// ═══════════════════════════════════════════════════════════════════════════════

export interface BatchAssignDialogProps {
  open: boolean;
  selectedCount: number;
  /** Summaries of the selected shot lists — displayed as name chips inside the dialog. */
  summaries?: ShotListSummary[];
  crew: Person[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (personId: string, inheritToShots: boolean) => void;
}

export function BatchAssignDialog({
  open,
  selectedCount,
  summaries = [],
  crew,
  loading = false,
  onClose,
  onConfirm,
}: BatchAssignDialogProps) {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [inheritToShots, setInheritToShots] = useState(true);

  useEffect(() => {
    if (!open) setSelectedPerson(null);
  }, [open]);

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: PAPER_SX }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>
        Assign crew to {selectedCount} shot list{selectedCount !== 1 ? 's' : ''}
      </DialogTitle>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Selected list names — shown as Chips so the user sees exactly which lists will be affected */}
        {summaries.length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mb: 0.75, fontSize: '0.72rem' }}>
              Assigning to:
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {summaries.map((s) => (
                <Chip
                  key={s.shotListId}
                  label={s.sceneName ?? s.sceneId}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.68rem',
                    bgcolor: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.75)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        <Autocomplete
          options={crew}
          getOptionLabel={(p) => `${p.name}${p.crewRole ? ` — ${p.crewRole.replace(/_/g, ' ')}` : ''}`}
          value={selectedPerson}
          onChange={(_, val) => setSelectedPerson(val)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select person"
              size="small"
              placeholder="Search crew or cast…"
            />
          )}
          isOptionEqualToValue={(a, b) => a.id === b.id}
        />

        <FormControlLabel
          control={
            <Switch
              checked={inheritToShots}
              onChange={(e) => setInheritToShots(e.target.checked)}
              size="small"
            />
          }
          label={
            <Box>
              <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                Inherit to all shots in list
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>
                Sets as default assignee on each shot
              </Typography>
            </Box>
          }
        />
      </DialogContent>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.5)' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!selectedPerson || loading}
          onClick={() => selectedPerson && onConfirm(selectedPerson.id, inheritToShots)}
          startIcon={loading ? <CircularProgress size={14} /> : undefined}
          sx={{ bgcolor: '#e91e63', '&:hover': { bgcolor: '#c2185b' }, textTransform: 'none', fontWeight: 600 }}
        >
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
}
