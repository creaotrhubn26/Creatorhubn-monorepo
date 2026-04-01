import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Box, Typography, Divider, Chip, Stack, FormControlLabel, Switch, Alert, CircularProgress, Autocomplete } from "@mui/material";
import { FileDownload as ExportIcon, PictureAsPdf as PdfIcon, Warning as WarnIcon } from "@mui/icons-material";
import type { ShotList, ProductionContext, Person, CastingShot, ShotType, CameraAngle, CameraMovement } from "../../models/casting";
import type { ShotListSummary } from "../../models/derivedState";
import globalTagService from "../../services/globalTagService";
import GlobalMentionHelper from "../shared/GlobalMentionHelper";
import type { StoryboardSeedCandidate } from "../../services/storyboardLibraryService";

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
  sceneCatalog?: ShotListSceneCatalogEntry[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ShotList>) => void;
}

export interface ShotListSceneCatalogEntry {
  sceneId: string;
  sceneName: string;
  sceneHeading?: string;
  thumbnail?: string;
  storyboardFrameCount: number;
  storyboardLibraryCount: number;
  storyboardCandidates: StoryboardSeedCandidate[];
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

const toStoryboardShotType = (candidate?: StoryboardSeedCandidate): ShotType => {
  if (candidate?.shotType) {
    return candidate.shotType;
  }
  const normalized = (candidate?.cameraAngle || '').trim().toLowerCase();
  if (normalized.includes('close')) return 'Close-up';
  if (normalized.includes('over shoulder')) return 'Over Shoulder';
  if (normalized.includes('wide')) return 'Wide';
  if (normalized.includes('insert') || normalized.includes('detail')) return 'Detail';
  if (normalized.includes('two')) return 'Two Shot';
  return 'Medium';
};

const TECHNICAL_CAMERA_ANGLES = new Set([
  'eye level',
  'high angle',
  'low angle',
  'birds eye',
  'worms eye',
  'dutch angle',
  'overhead',
]);

const toStoryboardCameraAngle = (cameraAngle?: string): CameraAngle =>
  (
    cameraAngle && TECHNICAL_CAMERA_ANGLES.has(cameraAngle.trim().toLowerCase())
      ? cameraAngle
      : 'Eye Level'
  ) as CameraAngle;

const toStoryboardCameraMovement = (movement?: string): CameraMovement =>
  (movement && movement.trim().length > 0 ? movement : 'Static') as CameraMovement;

const buildSeededShots = (
  scene: ShotListSceneCatalogEntry,
  candidates: StoryboardSeedCandidate[],
): CastingShot[] => {
  const now = new Date().toISOString();
  return candidates.map((candidate, index) => ({
    id: `shot-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`}`,
    sceneId: scene.sceneId,
    shotType: toStoryboardShotType(candidate),
    cameraAngle: toStoryboardCameraAngle(candidate.cameraAngle),
    cameraMovement: toStoryboardCameraMovement(candidate.movement),
    description: candidate.description || candidate.title || `${candidate.shotNumber} storyboard shot`,
    duration: Math.max(1, Math.round(candidate.duration ?? 5)),
    imageUrl: candidate.thumbnailUrl || candidate.imageUrl,
    notes: `${candidate.sourceLabel} · ${candidate.shotNumber}`,
    status: 'not_started',
    priority: 'important',
    mediaType: 'photo',
    storyboardFrameId: candidate.frameId,
    storyboardLibraryItemId: candidate.libraryItemId,
    storyboardLinkedSceneId: scene.sceneId,
    storyboardSourceType: candidate.sourceType,
    createdAt: now,
    updatedAt: now,
  }));
};

export function CreateEditShotListDialog({
  open,
  mode,
  initial,
  sceneCatalog = [],
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
      setSelectedStoryboardIds([]);
    }
  }, [open, initial]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const [selectedStoryboardIds, setSelectedStoryboardIds] = useState<string[]>([]);

  const selectedScene = useMemo(
    () => sceneCatalog.find((entry) => entry.sceneId === form.sceneId) || null,
    [sceneCatalog, form.sceneId],
  );
  const selectedCandidates = useMemo(
    () => (selectedScene
      ? selectedScene.storyboardCandidates.filter((candidate) => selectedStoryboardIds.includes(candidate.id))
      : []),
    [selectedScene, selectedStoryboardIds],
  );

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

    const submitPayload: Partial<ShotList> = {
      ...form,
      sceneId: selectedScene?.sceneId ?? form.sceneId,
      sceneName: selectedScene?.sceneName ?? form.sceneName,
    };

    if (mode === 'create' && selectedScene && selectedCandidates.length > 0) {
      submitPayload.shots = buildSeededShots(selectedScene, selectedCandidates);
    }

    onSubmit(submitPayload);
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: PAPER_SX }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>
        {mode === 'create' ? 'New Shot List' : 'Edit Shot List'}
      </DialogTitle>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Autocomplete
          options={sceneCatalog}
          value={selectedScene}
          onChange={(_, nextScene) => {
            set({
              sceneId: nextScene?.sceneId ?? '',
              sceneName: nextScene?.sceneName ?? '',
            });
            setSelectedStoryboardIds([]);
          }}
          getOptionLabel={(option) => option.sceneName}
          isOptionEqualToValue={(option, value) => option.sceneId === value.sceneId}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Koble til scene"
              fullWidth
              size="small"
              required
              autoFocus
              helperText="Shotlisten skal bindes til en scene, ikke en løs sceneId-streng."
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              {option.thumbnail ? (
                <Box
                  component="img"
                  src={option.thumbnail}
                  alt={option.sceneName}
                  sx={{ width: 44, height: 30, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
                />
              ) : (
                <Box
                  sx={{
                    width: 44,
                    height: 30,
                    borderRadius: 1,
                    bgcolor: 'rgba(59,130,246,0.12)',
                    color: '#60a5fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  SCENE
                </Box>
              )}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{option.sceneName}</Typography>
                <Typography sx={{ fontSize: 11, color: '#6b7280' }}>
                  {option.sceneHeading || option.sceneId}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <Chip size="small" label={`${option.storyboardFrameCount} scene frames`} />
                <Chip size="small" label={`${option.storyboardLibraryCount} library`} />
              </Stack>
            </Box>
          )}
        />

        {!selectedScene && (
          <>
            <TextField
              label="Scene name / title"
              fullWidth
              size="small"
              value={form.sceneName ?? ''}
              onChange={(e) => set({ sceneName: e.target.value })}
            />
            <TextField
              label="Scene ID"
              fullWidth
              size="small"
              placeholder="Links to scene breakdown"
              value={form.sceneId ?? ''}
              onChange={(e) => set({ sceneId: e.target.value })}
              helperText="Bruk dette bare hvis scenen ikke finnes i prosjektets sceneliste ennå."
            />
          </>
        )}

        {selectedScene && (
          <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Typography sx={{ fontWeight: 600, fontSize: 12 }}>
                {selectedScene.sceneName}
              </Typography>
              <Chip size="small" label={`${selectedScene.storyboardFrameCount} storyboard frames`} />
              <Chip size="small" label={`${selectedScene.storyboardLibraryCount} scene-matchede library items`} />
            </Stack>
          </Alert>
        )}

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

        {mode === 'create' && selectedScene && (
          <Box
            sx={{
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(255,255,255,0.02)',
              p: 2,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                  Seed fra storyboard
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>
                  Velg scene-knyttede storyboard frames eller bibliotekelementer som skal bli shots i denne shotlisten.
                </Typography>
              </Box>
              {selectedScene.storyboardCandidates.length > 0 ? (
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    onClick={() => setSelectedStoryboardIds(selectedScene.storyboardCandidates.map((candidate) => candidate.id))}
                  >
                    Velg alle
                  </Button>
                  <Button size="small" onClick={() => setSelectedStoryboardIds([])}>
                    Tøm
                  </Button>
                </Stack>
              ) : null}
            </Stack>

            {selectedScene.storyboardCandidates.length === 0 ? (
              <Alert severity="warning">
                Scenen har ingen storyboard frames eller scene-matchede bibliotekselementer ennå.
              </Alert>
            ) : (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 1.5,
                  }}
                >
                  {selectedScene.storyboardCandidates.map((candidate) => {
                    const isSelected = selectedStoryboardIds.includes(candidate.id);
                    return (
                      <Box
                        key={candidate.id}
                        onClick={() => {
                          setSelectedStoryboardIds((current) =>
                            current.includes(candidate.id)
                              ? current.filter((entry) => entry !== candidate.id)
                              : [...current, candidate.id],
                          );
                        }}
                        sx={{
                          borderRadius: 2,
                          border: isSelected ? '2px solid #e91e63' : '1px solid rgba(255,255,255,0.08)',
                          bgcolor: isSelected ? 'rgba(233,30,99,0.12)' : 'rgba(255,255,255,0.03)',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          transition: 'border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease',
                          '&:hover': {
                            transform: 'translateY(-1px)',
                            borderColor: isSelected ? '#e91e63' : 'rgba(233,30,99,0.45)',
                          },
                        }}
                      >
                        {candidate.thumbnailUrl || candidate.imageUrl ? (
                          <Box
                            component="img"
                            src={candidate.thumbnailUrl || candidate.imageUrl}
                            alt={candidate.title}
                            sx={{ width: '100%', height: 96, objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: '100%',
                              height: 96,
                              bgcolor: 'rgba(59,130,246,0.12)',
                              color: '#60a5fa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            {candidate.shotNumber}
                          </Box>
                        )}
                        <Box sx={{ p: 1.25 }}>
                          <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.75 }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                              {candidate.shotNumber}
                            </Typography>
                            <Chip size="small" label={candidate.sourceLabel} sx={{ maxWidth: 120 }} />
                          </Stack>
                          <Typography sx={{ fontSize: 12, color: '#f8fafc', fontWeight: 600 }} noWrap>
                            {candidate.description}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.5 }}>
                            {candidate.cameraAngle || 'Eye Level'} · {candidate.movement || 'Static'}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
                <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 1.25 }}>
                  {selectedStoryboardIds.length > 0
                    ? `${selectedStoryboardIds.length} storyboardvalg blir opprettet som shots i denne listen.`
                    : 'Hvis du ikke velger noe her, opprettes shotlisten tom men fortsatt bundet til scenen.'}
                </Typography>
              </>
            )}
          </Box>
        )}
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
  onExportBoardPDF: (shotListId: string | null) => void;
  onExportContactSheet: (shotListId: string | null) => void;
  onExportShotDeck: (shotListId: string | null) => void;
  onExportCleanStills: (shotListId: string | null) => void;
}

export function ExportDialog({
  open,
  shotListId,
  selectedCount = 0,
  onClose,
  onExportCSV,
  onExportBoardPDF,
  onExportContactSheet,
  onExportShotDeck,
  onExportCleanStills,
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
          onClick={() => { onExportBoardPDF(shotListId); onClose(); }}
          sx={{ justifyContent: 'flex-start', textTransform: 'none', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)' }}
        >
          Board PDF
        </Button>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<PdfIcon />}
          onClick={() => { onExportContactSheet(shotListId); onClose(); }}
          sx={{ justifyContent: 'flex-start', textTransform: 'none', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)' }}
        >
          Contact Sheet
        </Button>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<PdfIcon />}
          onClick={() => { onExportShotDeck(shotListId); onClose(); }}
          sx={{ justifyContent: 'flex-start', textTransform: 'none', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)' }}
        >
          Shot Deck
        </Button>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<ExportIcon />}
          onClick={() => { onExportCleanStills(shotListId); onClose(); }}
          sx={{ justifyContent: 'flex-start', textTransform: 'none', borderColor: 'rgba(255,255,255,0.2)', color: '#c4b5fd' }}
        >
          Clean Stills (.zip)
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
