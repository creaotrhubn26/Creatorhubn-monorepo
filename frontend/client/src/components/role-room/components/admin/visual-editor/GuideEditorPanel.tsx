/**
 * GuideEditorPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Admin section inside the Role Room visual editor for managing all
 * Role Room guide dialogs (Shot List, Stripboard, Screenplay Editor).
 *
 * Layout:
 *   ┌─────────────┬────────────────────────┬──────────────────────────────┐
 *   │ Guide cards │  Step list             │  Step / Guide editor         │
 *   │  (3 guides) │  (for selected guide)  │  (fields + preview)          │
 *   └─────────────┴────────────────────────┴──────────────────────────────┘
 *
 * All changes are held in-memory until the admin clicks "Save".
 * "Export JSON" / "Import JSON" support full round-trip config backup.
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback, useRef, DragEvent } from 'react';
import { ContextualNudgeBanner } from '../../ContextualNudgeBanner';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Switch,
  TextField,
  Tooltip,
  Chip,
  Divider,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Badge,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Save as SaveIcon,
  RestartAlt as ResetIcon,
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
  BugReport as PreviewIcon,
  DragIndicator as DragHandleIcon,
  VisibilityOff as HideIcon,
  Visibility as ShowIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Palette as PaletteIcon,
  MenuBook as GuideBookIcon,
  Movie as ScreenplayIcon,
  ViewList as StripboardIcon,
  PhotoCamera as ShotListIcon,
  NotificationsActive as BadgeIcon,
  Notes as NoteIcon,
  LiveTv as LiveSetIcon,
  Place as LocationManagementIcon,
  Analytics as LocationAnalysisIcon,
  Groups as CrewIcon,
  TheaterComedy as AuditionIcon,
} from '@mui/icons-material';

import {
  GUIDE_META,
  type GuideId,
  type GuideMeta,
  type GuideConfig,
  type GuideStepOverride,
  buildDefaultRegistry,
} from './guideTypes';
import { useGuideConfig } from './useGuideConfig';

// ── Lazy imports for guide preview ────────────────────────────────────────
// Using React.lazy to avoid circular-dep issues and keep the admin bundle lean.
import { ShotListGuide } from '../../production/ShotListGuide';
import { StripboardGuide } from '../../production/StripboardGuide';
import { ScreenplayGuide } from '../../ScreenplayGuide';
import { LiveSetModeGuide } from '../../production/LiveSetModeGuide';
import { LocationManagementGuide } from '../../LocationManagementGuide';
import { LocationAnalysisGuide } from '../../LocationAnalysisGuide';

// ── Constants ─────────────────────────────────────────────────────────────

const GUIDE_ICONS: Record<GuideId, React.ReactNode> = {
  'shot-list':    <ShotListIcon   sx={{ fontSize: 20 }} />,
  'stripboard':   <StripboardIcon sx={{ fontSize: 20 }} />,
  'screenplay':   <ScreenplayIcon sx={{ fontSize: 20 }} />,
  'live-set-mode': <LiveSetIcon   sx={{ fontSize: 20 }} />,
  'crew-management': <CrewIcon    sx={{ fontSize: 20 }} />,
  'audition':      <AuditionIcon  sx={{ fontSize: 20 }} />,
  'location-management': <LocationManagementIcon sx={{ fontSize: 20 }} />,
  'location-analysis': <LocationAnalysisIcon sx={{ fontSize: 20 }} />,
};

const BADGE_PRESETS = ['New', 'Updated', 'Beta', 'Planned', '!'];
const NOTE_COLOR_PRESETS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];

// ── HEX color input ───────────────────────────────────────────────────────

function ColorSwatch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        component="input"
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        sx={{
          width: 36,
          height: 36,
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 1,
          bgcolor: 'transparent',
          cursor: 'pointer',
          p: 0,
        }}
      />
      <TextField
        size="small"
        value={value}
        onChange={e => onChange(e.target.value)}
        sx={{
          width: 100,
          '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.87)' },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
        }}
      />
    </Box>
  );
}

// ── SectionLabel ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.65rem', mb: 0.75, display: 'block' }}
    >
      {children}
    </Typography>
  );
}

// ── GuideCard (left column item) ──────────────────────────────────────────

function GuideCard({
  meta,
  config,
  isSelected,
  onSelect,
  onToggle,
}: {
  meta: GuideMeta;
  config: GuideConfig;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const enabledCount = config.steps.filter(s => s.enabled !== false).length;
  const totalCount   = meta.steps.length;

  return (
    <Paper
      elevation={0}
      onClick={onSelect}
      sx={{
        p: 1.5,
        mb: 1,
        cursor: 'pointer',
        bgcolor: isSelected ? `${meta.accentColor}18` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isSelected ? meta.accentColor + '55' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 2,
        transition: 'all 0.15s',
        '&:hover': { bgcolor: `${meta.accentColor}0f`, borderColor: `${meta.accentColor}44` },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
        <Box sx={{ color: meta.accentColor, mt: 0.25, flexShrink: 0 }}>
          {GUIDE_ICONS[meta.id]}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>
            {meta.title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', lineHeight: 1.4, display: 'block', mt: 0.25 }}>
            {enabledCount}/{totalCount} steg aktive
          </Typography>
        </Box>
        <Tooltip title={config.enabled ? 'Skjul guide for brukere' : 'Vis guide for brukere'}>
          <Switch
            size="small"
            checked={config.enabled}
            onChange={e => { e.stopPropagation(); onToggle(); }}
            sx={{ '& .MuiSwitch-thumb': { bgcolor: config.enabled ? meta.accentColor : undefined } }}
          />
        </Tooltip>
      </Box>
    </Paper>
  );
}

// ── StepRow (middle column item) ──────────────────────────────────────────

function StepRow({
  meta,
  override,
  isSelected,
  onSelect,
  onToggle,
  onDragStart,
  onDragOver,
  onDrop,
  dragIdx,
  idx,
  accentColor,
}: {
  meta: { id: string; label: string; sectionCount: number };
  override: GuideStepOverride;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDragStart: (idx: number) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (toIdx: number) => void;
  dragIdx: number | null;
  idx: number;
  accentColor: string;
}) {
  const isDragging = dragIdx === idx;

  return (
    <Box
      draggable
      onDragStart={() => onDragStart(idx)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(idx)}
      onClick={onSelect}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: '6px 10px',
        borderRadius: 1.5,
        cursor: 'pointer',
        opacity: isDragging ? 0.4 : override.enabled === false ? 0.45 : 1,
        bgcolor: isSelected ? `${accentColor}1a` : 'transparent',
        border: `1px solid ${isSelected ? accentColor + '44' : 'transparent'}`,
        '&:hover': { bgcolor: isSelected ? `${accentColor}1a` : 'rgba(255,255,255,0.04)' },
        transition: 'background-color 0.12s',
        mb: 0.25,
      }}
    >
      <DragHandleIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.2)', cursor: 'grab', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 400, color: override.enabled === false ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.87)', lineHeight: 1.3, textDecoration: override.enabled === false ? 'line-through' : 'none' }}
        >
          {override.labelOverride ?? meta.label}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.3)' }}>
          {meta.sectionCount} seksjon{meta.sectionCount !== 1 ? 'er' : ''}
        </Typography>
      </Box>
      {override.badge && (
        <Chip
          label={override.badge}
          size="small"
          sx={{ height: 16, fontSize: '0.58rem', bgcolor: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44`, px: 0.5 }}
        />
      )}
      {override.screenshotUrl && (
        <Tooltip title="Har bilde-URL">
          <ImageIcon sx={{ fontSize: 12, color: '#10b981' }} />
        </Tooltip>
      )}
      {override.adminNote && (
        <Tooltip title="Har admin-notat">
          <NoteIcon sx={{ fontSize: 12, color: '#f59e0b' }} />
        </Tooltip>
      )}
      <Tooltip title={override.enabled === false ? 'Aktiver steg' : 'Deaktiver steg'}>
        <IconButton
          size="small"
          onClick={e => { e.stopPropagation(); onToggle(); }}
          sx={{ p: 0.25, color: 'rgba(255,255,255,0.25)', '&:hover': { color: 'rgba(255,255,255,0.7)' } }}
        >
          {override.enabled === false
            ? <ShowIcon sx={{ fontSize: 14 }} />
            : <HideIcon sx={{ fontSize: 14 }} />
          }
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ── StepEditor (right column) ─────────────────────────────────────────────

function StepEditor({
  stepMeta,
  override,
  accentColor,
  onSave,
}: {
  stepMeta: { id: string; label: string; sectionCount: number };
  override: GuideStepOverride;
  accentColor: string;
  onSave: (partial: Partial<GuideStepOverride>) => void;
}) {
  const [labelOverride, setLabelOverride] = useState(override.labelOverride ?? '');
  const [adminNote, setAdminNote]         = useState(override.adminNote ?? '');
  const [noteColor, setNoteColor]         = useState(override.adminNoteColor ?? '#f59e0b');
  const [screenshotUrl, setScreenshotUrl] = useState(override.screenshotUrl ?? '');
  const [videoUrl, setVideoUrl]           = useState(override.videoUrl ?? '');
  const [badge, setBadge]                 = useState(override.badge ?? '');
  const [dirty, setDirty]                 = useState(false);

  // Reset local state when the selected step changes
  React.useEffect(() => {
    setLabelOverride(override.labelOverride ?? '');
    setAdminNote(override.adminNote ?? '');
    setNoteColor(override.adminNoteColor ?? '#f59e0b');
    setScreenshotUrl(override.screenshotUrl ?? '');
    setVideoUrl(override.videoUrl ?? '');
    setBadge(override.badge ?? '');
    setDirty(false);
  }, [override]);

  function handleSave() {
    onSave({
      labelOverride:   labelOverride || undefined,
      adminNote:       adminNote || undefined,
      adminNoteColor:  adminNote ? noteColor : undefined,
      screenshotUrl:   screenshotUrl || undefined,
      videoUrl:        videoUrl || undefined,
      badge:           badge || undefined,
    });
    setDirty(false);
  }

  const field = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    setDirty(true);
  };

  const inputSx = {
    '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.87)', fontSize: '0.83rem' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' },
    '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
  };

  return (
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5, overflowY: 'auto', flex: 1 }}>
      {/* Header */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ width: 4, height: 16, bgcolor: accentColor, borderRadius: 1 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)' }}>
            {override.labelOverride ?? stepMeta.label}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem' }}>
          Steg-ID: <code style={{ color: accentColor }}>{stepMeta.id}</code>
          {' · '}{stepMeta.sectionCount} seksjon{stepMeta.sectionCount !== 1 ? 'er' : ''}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* Label override */}
      <Box>
        <SectionLabel>Steg-tittel (valgfritt)</SectionLabel>
        <TextField
          fullWidth
          size="small"
          placeholder={stepMeta.label}
          value={labelOverride}
          onChange={field(setLabelOverride)}
          sx={inputSx}
          helperText="Tomt = bruk original tittel fra kodebasen."
          FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem' } }}
        />
      </Box>

      {/* Badge */}
      <Box>
        <SectionLabel>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <BadgeIcon sx={{ fontSize: 11, verticalAlign: 'middle' }} />
            Badge-tekst
          </Box>
        </SectionLabel>
        <TextField
          fullWidth
          size="small"
          placeholder="f.eks. Ny, Oppdatert, Beta"
          value={badge}
          onChange={field(setBadge)}
          sx={inputSx}
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
          {BADGE_PRESETS.map(p => (
            <Chip
              key={p}
              label={p}
              size="small"
              clickable
              onClick={() => { setBadge(p); setDirty(true); }}
              sx={{ height: 20, fontSize: '0.63rem', bgcolor: badge === p ? `${accentColor}22` : 'rgba(255,255,255,0.05)', color: badge === p ? accentColor : 'rgba(255,255,255,0.5)', border: badge === p ? `1px solid ${accentColor}44` : '1px solid transparent' }}
            />
          ))}
          {badge && (
            <Chip
              label="× Fjern"
              size="small"
              clickable
              onClick={() => { setBadge(''); setDirty(true); }}
              sx={{ height: 20, fontSize: '0.63rem', bgcolor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
            />
          )}
        </Box>
      </Box>

      {/* Admin note */}
      <Box>
        <SectionLabel>Admin-notat (vises som callout nederst i steget)</SectionLabel>
        <TextField
          fullWidth
          multiline
          minRows={3}
          size="small"
          placeholder="Skriv en ekstra merknad som vises for alle brukere i dette steget…"
          value={adminNote}
          onChange={field(setAdminNote)}
          sx={inputSx}
        />
        {adminNote && (
          <Box sx={{ mt: 1 }}>
            <SectionLabel>Notat-farge</SectionLabel>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 0.5 }}>
              {NOTE_COLOR_PRESETS.map(c => (
                <Box
                  key={c}
                  onClick={() => { setNoteColor(c); setDirty(true); }}
                  sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: c, cursor: 'pointer', border: noteColor === c ? '2px solid white' : '2px solid transparent', flexShrink: 0 }}
                />
              ))}
            </Box>
            <ColorSwatch value={noteColor} onChange={v => { setNoteColor(v); setDirty(true); }} />

            {/* Live preview of the note */}
            <Box sx={{ mt: 1.25, p: 1.5, borderLeft: `3px solid ${noteColor}`, bgcolor: `${noteColor}14`, borderRadius: '0 8px 8px 0' }}>
              <Typography variant="caption" sx={{ color: noteColor, fontWeight: 700, display: 'block', fontSize: '0.7rem', mb: 0.5 }}>Admin-notat (forhåndsvisning)</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {adminNote}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Screenshot URL */}
      <Box>
        <SectionLabel>Bilde-URL (erstatter screenshot-plassholder)</SectionLabel>
        <TextField
          fullWidth
          size="small"
          placeholder="https://… eller data:image/…"
          value={screenshotUrl}
          onChange={field(setScreenshotUrl)}
          sx={inputSx}
        />
        {screenshotUrl && (
          <Box
            component="img"
            src={screenshotUrl}
            alt="preview"
            sx={{ mt: 1, width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.1)' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </Box>

      {/* Video URL */}
      <Box>
        <SectionLabel>Video-URL (erstatter video-plassholder)</SectionLabel>
        <TextField
          fullWidth
          size="small"
          placeholder="https://… .mp4 eller .webm"
          value={videoUrl}
          onChange={field(setVideoUrl)}
          sx={inputSx}
        />
        {videoUrl && (
          <Box
            component="video"
            src={videoUrl}
            controls
            sx={{ mt: 1, width: '100%', maxHeight: 160, borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.1)', display: 'block' }}
          />
        )}
      </Box>

      {/* Save / discard */}
      <Box sx={{ display: 'flex', gap: 1, pt: 0.5, flexShrink: 0 }}>
        <Button
          size="small"
          variant="contained"
          disabled={!dirty}
          onClick={handleSave}
          startIcon={<CheckCircleIcon sx={{ fontSize: 15 }} />}
          sx={{ bgcolor: accentColor, '&:hover': { filter: 'brightness(1.15)' }, textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', px: 2 }}
        >
          Bruk endringer
        </Button>
        {dirty && (
          <Button
            size="small"
            onClick={() => {
              setLabelOverride(override.labelOverride ?? '');
              setAdminNote(override.adminNote ?? '');
              setNoteColor(override.adminNoteColor ?? '#f59e0b');
              setScreenshotUrl(override.screenshotUrl ?? '');
              setVideoUrl(override.videoUrl ?? '');
              setBadge(override.badge ?? '');
              setDirty(false);
            }}
            sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}
          >
            Angre
          </Button>
        )}
      </Box>
    </Box>
  );
}

// ── GuideSettingsEditor (right column — guide-level settings) ─────────────

function GuideSettingsEditor({
  meta,
  config,
  onUpdate,
}: {
  meta: GuideMeta;
  config: GuideConfig;
  onUpdate: <K extends Exclude<keyof GuideConfig, 'id' | 'steps'>>(field: K, value: GuideConfig[K]) => void;
}) {
  const inputSx = {
    '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.87)', fontSize: '0.83rem' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' },
    '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
  };

  return (
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5, overflowY: 'auto', flex: 1 }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ color: meta.accentColor }}>{GUIDE_ICONS[meta.id]}</Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)' }}>
            {meta.title} — Guide-innstillinger
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem' }}>
          Sist endret: {new Date(config.lastModified).toLocaleString('nb-NO')}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* Intro banner */}
      <Box>
        <SectionLabel>Intro-banner-tekst (vises øverst i guide-dialogen)</SectionLabel>
        <TextField
          fullWidth
          multiline
          minRows={2}
          size="small"
          placeholder="Annonsering, oppdateringsinfo e.l. — tomt = ingen banner."
          value={config.introBanner ?? ''}
          onChange={e => onUpdate('introBanner', e.target.value || undefined)}
          sx={inputSx}
        />
        {config.introBanner && (
          <Box>
            <SectionLabel>Banner-farge</SectionLabel>
            <ColorSwatch
              value={config.introBannerColor ?? '#f59e0b'}
              onChange={v => onUpdate('introBannerColor', v)}
            />
          </Box>
        )}
      </Box>

      {/* Accent color override */}
      <Box>
        <SectionLabel>Aksent-fargeoverskrivning (valgfritt)</SectionLabel>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <ColorSwatch
            value={config.accentColorOverride ?? meta.accentColor}
            onChange={v => onUpdate('accentColorOverride', v)}
          />
          {config.accentColorOverride && (
            <Button
              size="small"
              onClick={() => onUpdate('accentColorOverride', undefined)}
              sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}
            >
              Tilbakestill til standard ({meta.accentColor})
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────

export function GuideEditorPanel() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const {
    registry,
    getConfig,
    toggleGuide,
    updateGuideField,
    setStepOverride,
    reorderSteps,
    save,
    exportJson,
    importJson,
    resetToDefaults,
    stats,
  } = useGuideConfig();

  const [selectedGuideId, setSelectedGuideId] = useState<GuideId>('shot-list');
  const [selectedStepId, setSelectedStepId]   = useState<string | null>(null);
  const [showGuideSettings, setShowGuideSettings] = useState(false);

  // Preview state
  const [previewGuide, setPreviewGuide] = useState<GuideId | null>(null);
  const [previewStep,  setPreviewStep]  = useState<string | undefined>(undefined);

  // Feedback
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  // Drag state for step reordering
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const selectedMeta   = GUIDE_META.find(m => m.id === selectedGuideId)!;
  const selectedConfig = getConfig(selectedGuideId);

  // Sorted step list for the selected guide
  const sortedSteps = [...selectedMeta.steps]
    .map((sm, originalIdx) => ({
      sm,
      override: selectedConfig.steps.find(s => s.stepId === sm.id) ?? { stepId: sm.id, enabled: true, sortOrder: originalIdx },
    }))
    .sort((a, b) => (a.override.sortOrder ?? 0) - (b.override.sortOrder ?? 0));

  const selectedStepMeta = selectedStepId
    ? selectedMeta.steps.find(s => s.id === selectedStepId)!
    : null;
  const selectedStepOverride = selectedStepId
    ? (selectedConfig.steps.find(s => s.stepId === selectedStepId) ?? { stepId: selectedStepId, enabled: true })
    : null;

  // ── Handlers ────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const ts = save();
    setSnack({ msg: `Lagret kl. ${new Date(ts).toLocaleTimeString('nb-NO')}`, severity: 'success' });
  }, [save]);

  const handleExport = useCallback(() => {
    const json = exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `roleroom-guide-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSnack({ msg: 'Konfigurasjon eksportert som JSON.', severity: 'info' });
  }, [exportJson]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setImportText(ev.target?.result as string ?? '');
      setImportOpen(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleImportConfirm = useCallback(() => {
    const result = importJson(importText);
    if (result.ok) {
      setSnack({ msg: 'Konfigurasjon importert.', severity: 'success' });
      setImportOpen(false);
      setImportText('');
    } else {
      setSnack({ msg: `Importfeil: ${result.error}`, severity: 'error' });
    }
  }, [importJson, importText]);

  const handleReset = useCallback(() => {
    const defaults = buildDefaultRegistry();
    const guideCount = (Object.keys(defaults.configs) as GuideId[]).length;
    if (!window.confirm(`Tilbakestille alle guide-innstillinger til standard (${guideCount} guider)? Dette kan ikke angres.`)) return;
    resetToDefaults();
    setSnack({ msg: 'Tilbakestilt til fabrikk-standard.', severity: 'info' });
  }, [resetToDefaults]);

  const handleStepSave = useCallback(
    (partial: Partial<GuideStepOverride>) => {
      if (!selectedStepId) return;
      setStepOverride(selectedGuideId, { stepId: selectedStepId, ...partial });
    },
    [selectedGuideId, selectedStepId, setStepOverride],
  );

  const handleDrop = useCallback(
    (toIdx: number) => {
      if (dragIdx === null || dragIdx === toIdx) return;
      reorderSteps(selectedGuideId, dragIdx, toIdx);
      setDragIdx(null);
    },
    [dragIdx, reorderSteps, selectedGuideId],
  );

  // ── Layout helpers ────────────────────────────────────────────────────

  const colSx = {
    base: {
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#0d0d1a',
      borderRadius: 2,
      border: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
    },
    header: {
      px: 2,
      py: 1.25,
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      flexShrink: 0,
    },
    body: {
      flex: 1,
      overflowY: 'auto',
      p: 1.5,
    },
  } as const;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      <ContextualNudgeBanner context="guide-editor" accentColor="#3b82f6" />

      {/* ── Top toolbar ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.25,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <GuideBookIcon sx={{ color: '#8b5cf6', fontSize: 18 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'rgba(255,255,255,0.87)', flex: 1 }}>
          Guide-editor
        </Typography>

        {/* Stats chips */}
        <Chip label={`${stats.totalSteps - stats.disabledSteps}/${stats.totalSteps} steg aktive`} size="small"
          sx={{ height: 20, fontSize: '0.62rem', bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }} />
        {stats.guidesWithNotes > 0 && (
          <Chip label={`${stats.guidesWithNotes} guide${stats.guidesWithNotes !== 1 ? 'r' : ''} med noter`} size="small"
            icon={<NoteIcon sx={{ fontSize: '10px !important' }} />}
            sx={{ height: 20, fontSize: '0.62rem', bgcolor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }} />
        )}
        {registry.savedAt && (
          <Chip label={`Sist lagret ${new Date(registry.savedAt).toLocaleTimeString('nb-NO')}`} size="small"
            sx={{ height: 20, fontSize: '0.62rem', bgcolor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }} />
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* Action buttons */}
        <Tooltip title="Forhåndsvis valgt guide">
          <Button
            size="small"
            startIcon={<PreviewIcon sx={{ fontSize: 14 }} />}
            onClick={() => { setPreviewGuide(selectedGuideId); setPreviewStep(undefined); }}
            sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', minHeight: 30 }}
          >
            Forhåndsvis
          </Button>
        </Tooltip>

        <Tooltip title="Importer konfigurasjon fra JSON-fil">
          <>
            <Button
              size="small"
              startIcon={<ImportIcon sx={{ fontSize: 14 }} />}
              onClick={() => importRef.current?.click()}
              sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', minHeight: 30 }}
            >
              Importer
            </Button>
            <input ref={importRef} type="file" accept=".json" hidden onChange={handleImportFile} />
          </>
        </Tooltip>

        <Tooltip title="Eksporter konfigurasjon som JSON-fil">
          <Button
            size="small"
            startIcon={<ExportIcon sx={{ fontSize: 14 }} />}
            onClick={handleExport}
            sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', minHeight: 30 }}
          >
            Eksporter
          </Button>
        </Tooltip>

        <Tooltip title="Tilbakestill alt til standard">
          <Button
            size="small"
            startIcon={<ResetIcon sx={{ fontSize: 14 }} />}
            onClick={handleReset}
            sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', minHeight: 30 }}
          >
            Tilbakestill
          </Button>
        </Tooltip>

        <Button
          size="small"
          variant="contained"
          startIcon={<SaveIcon sx={{ fontSize: 14 }} />}
          onClick={handleSave}
          sx={{
            bgcolor: '#8b5cf6',
            '&:hover': { bgcolor: '#7c3aed' },
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.78rem',
            minHeight: 30,
            px: 2,
          }}
        >
          Lagre
        </Button>
      </Box>

      {/* ── Three columns ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '220px 220px 1fr',
          gap: 1.5,
          p: 1.5,
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* ── Column 1: Guide list ── */}
        <Box sx={{ ...colSx.base }}>
          <Box sx={colSx.header}>
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Guider
            </Typography>
          </Box>
          <Box sx={colSx.body}>
            {GUIDE_META.map(meta => (
              <GuideCard
                key={meta.id}
                meta={meta}
                config={getConfig(meta.id)}
                isSelected={selectedGuideId === meta.id}
                onSelect={() => { setSelectedGuideId(meta.id); setSelectedStepId(null); setShowGuideSettings(false); }}
                onToggle={() => toggleGuide(meta.id)}
              />
            ))}

            {/* Guide-level settings entry */}
            <Button
              fullWidth
              size="small"
              startIcon={<PaletteIcon sx={{ fontSize: 14 }} />}
              onClick={() => { setShowGuideSettings(true); setSelectedStepId(null); }}
              sx={{
                mt: 1,
                textTransform: 'none',
                justifyContent: 'flex-start',
                color: showGuideSettings ? selectedMeta.accentColor : 'rgba(255,255,255,0.4)',
                fontSize: '0.75rem',
                bgcolor: showGuideSettings ? `${selectedMeta.accentColor}12` : 'transparent',
                border: `1px solid ${showGuideSettings ? selectedMeta.accentColor + '33' : 'transparent'}`,
                borderRadius: 1.5,
              }}
            >
              Guide-innstillinger
            </Button>
          </Box>
        </Box>

        {/* ── Column 2: Step list ── */}
        <Box sx={{ ...colSx.base }}>
          <Box sx={{ ...colSx.header, justifyContent: 'space-between' }}>
            <Badge
              badgeContent={sortedSteps.filter(s => s.override.enabled !== false).length}
              max={99}
              sx={{ '& .MuiBadge-badge': { fontSize: '0.58rem', height: 14, minWidth: 14, bgcolor: selectedMeta.accentColor } }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em', textTransform: 'uppercase', pr: 1.5 }}>
                Steg i {selectedMeta.title}
              </Typography>
            </Badge>
            <Tooltip title="Forhåndsvis denne guiden">
              <IconButton size="small" onClick={() => setPreviewGuide(selectedGuideId)} sx={{ p: 0.25, color: 'rgba(255,255,255,0.3)' }}>
                <PreviewIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ ...colSx.body, p: 1 }}>
            {sortedSteps.map(({ sm, override }, idx) => (
              <StepRow
                key={sm.id}
                meta={sm}
                override={override}
                idx={idx}
                dragIdx={dragIdx}
                isSelected={selectedStepId === sm.id}
                accentColor={selectedMeta.accentColor}
                onSelect={() => { setSelectedStepId(sm.id); setShowGuideSettings(false); }}
                onToggle={() =>
                  setStepOverride(selectedGuideId, { stepId: sm.id, enabled: override.enabled === false ? true : false })
                }
                onDragStart={i => setDragIdx(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
              />
            ))}
            {sortedSteps.every(s => s.override.enabled === false) && (
              <Box sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <WarningIcon sx={{ fontSize: 13, color: '#f59e0b', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: '#f59e0b', fontSize: '0.7rem', lineHeight: 1.4 }}>
                  Alle steg er skjult — guiden vises uten steg for brukerne.
                </Typography>
              </Box>
            )}
            <Tooltip title="Tilpassede steg (fremtidig funksjon)">
              <span>
                <Button
                  fullWidth
                  size="small"
                  startIcon={<AddIcon sx={{ fontSize: 13 }} />}
                  disabled
                  sx={{ mt: 1, textTransform: 'none', justifyContent: 'flex-start', color: 'rgba(255,255,255,0.2)', fontSize: '0.72rem', borderRadius: 1 }}
                >
                  Legg til steg
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* ── Column 3: Step / guide settings editor ── */}
        <Box sx={{ ...colSx.base }}>
          <Box sx={colSx.header}>
            {selectedStepMeta && !showGuideSettings && (
              <EditIcon sx={{ fontSize: 13, color: selectedMeta.accentColor, flexShrink: 0 }} />
            )}
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {showGuideSettings
                ? 'Guide-innstillinger'
                : selectedStepMeta
                ? `Steg: ${selectedStepOverride?.labelOverride ?? selectedStepMeta.label}`
                : 'Velg et steg'}
            </Typography>
            {selectedStepId && !showGuideSettings && (
              <Tooltip title="Forhåndsvis dette steget i dialogen">
                <Button
                  size="small"
                  onClick={() => { setPreviewGuide(selectedGuideId); setPreviewStep(selectedStepId); }}
                  sx={{ ml: 'auto', textTransform: 'none', color: selectedMeta.accentColor, fontSize: '0.72rem', minHeight: 0, py: 0.25 }}
                >
                  Forhåndsvis steg →
                </Button>
              </Tooltip>
            )}
          </Box>

          {showGuideSettings ? (
            <GuideSettingsEditor
              meta={selectedMeta}
              config={selectedConfig}
              onUpdate={(field, value) => updateGuideField(selectedGuideId, field, value)}
            />
          ) : selectedStepMeta && selectedStepOverride ? (
            <StepEditor
              stepMeta={selectedStepMeta}
              override={selectedStepOverride}
              accentColor={selectedMeta.accentColor}
              onSave={handleStepSave}
            />
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
              <Box sx={{ textAlign: 'center', maxWidth: 240 }}>
                <InfoIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.15)', mb: 1.5 }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                  Klikk et steg i midtkolonnen for å redigere etiketter, admin-noter, bilde-URL og badge-tekst.
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem', mt: 1, display: 'block' }}>
                  Dra steg for å endre rekkefølgen. Bruk øye-ikonet for å skjule/vise steg.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Guide preview dialogs ── */}
      {previewGuide === 'shot-list' && (
        <ShotListGuide
          open
          onClose={() => { setPreviewGuide(null); setPreviewStep(undefined); }}
          initialStepId={previewStep}
        />
      )}
      {previewGuide === 'stripboard' && (
        <StripboardGuide
          open
          onClose={() => { setPreviewGuide(null); setPreviewStep(undefined); }}
          initialStepId={previewStep}
        />
      )}
      {previewGuide === 'screenplay' && (
        <ScreenplayGuide
          open
          onClose={() => { setPreviewGuide(null); setPreviewStep(undefined); }}
          initialStepId={previewStep}
        />
      )}
      {previewGuide === 'live-set-mode' && (
        <LiveSetModeGuide
          open
          onClose={() => { setPreviewGuide(null); setPreviewStep(undefined); }}
          initialStepId={previewStep}
        />
      )}
      {previewGuide === 'location-management' && (
        <LocationManagementGuide
          open
          onClose={() => { setPreviewGuide(null); setPreviewStep(undefined); }}
          initialStepId={previewStep}
        />
      )}
      {previewGuide === 'location-analysis' && (
        <LocationAnalysisGuide
          open
          onClose={() => { setPreviewGuide(null); setPreviewStep(undefined); }}
          initialStepId={previewStep}
        />
      )}

      {/* ── Import JSON dialog ── */}
      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#12121e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <ImportIcon sx={{ color: '#8b5cf6', fontSize: 18 }} />
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 700, fontSize: '0.9rem' }}>Importer guide-konfigurasjon</Typography>
          <IconButton size="small" onClick={() => setImportOpen(false)} sx={{ color: 'rgba(255,255,255,0.4)' }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2, bgcolor: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.78rem' }}>
            Dette vil erstatte alle gjeldende innstillinger. Lagre en eksport-backup først.
          </Alert>
          <TextField
            fullWidth
            multiline
            minRows={8}
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Lim inn JSON her…"
            sx={{
              '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.87)', fontSize: '0.75rem', fontFamily: 'monospace' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid rgba(255,255,255,0.07)', gap: 1 }}>
          <Button size="small" onClick={() => setImportOpen(false)} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.4)' }}>Avbryt</Button>
          <Button
            size="small"
            variant="contained"
            disabled={!importText.trim()}
            onClick={handleImportConfirm}
            sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 600 }}
          >
            Importer
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={!!snack}
        autoHideDuration={3500}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack?.severity ?? 'success'}
          onClose={() => setSnack(null)}
          sx={{ bgcolor: snack?.severity === 'success' ? '#064e3b' : snack?.severity === 'error' ? '#450a0a' : '#1e1b4b', color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem' }}
        >
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
