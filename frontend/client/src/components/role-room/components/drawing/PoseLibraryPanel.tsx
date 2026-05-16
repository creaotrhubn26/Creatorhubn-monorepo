// @ts-nocheck
/**
 * PoseLibraryPanel — quick-select av stick-figure-poser for å starte
 * et frame med god proporsjon. Artisten tegner over den lette grå-
 * skissen, og kan velge speilvending / skala / posisjon ved innsetting.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Paper,
  TextField,
  Chip,
  Tooltip,
  IconButton,
  ButtonBase,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Slider,
} from '@mui/material';
import {
  Search,
  Accessibility,
  FlipOutlined,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  POSE_LIBRARY,
  searchPoses,
  getPosesByCategory,
  buildStrokesFromPose,
  type Pose,
  type PoseStroke,
} from './poseLibrary';

export interface PoseLibraryPanelProps {
  canvasWidth: number;
  canvasHeight: number;
  onInsertPose?: (strokes: PoseStroke[], pose: Pose) => void;
  compact?: boolean;
}

const CATEGORIES: Array<{ value: 'all' | Pose['category']; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'rest', label: 'Hvile' },
  { value: 'gesture', label: 'Gester' },
  { value: 'action', label: 'Action' },
  { value: 'conversation', label: 'Dialog' },
  { value: 'special', label: 'Spesiell' },
];

function PoseThumb({ pose, size = 64 }: { pose: Pose; size?: number }): JSX.Element {
  // Render stick-figure SVG fra normaliserte koordinater (0..1).
  return (
    <svg width={size} height={size} viewBox="0 0 1 1" style={{ display: 'block' }}>
      <rect width="1" height="1" fill="rgba(0,0,0,0.02)" />
      {pose.limbs.map((limb, idx) => {
        if (limb.points.length < 2) return null;
        const d = limb.points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
          .join(' ');
        return (
          <path
            key={`${limb.name}-${idx}`}
            d={d}
            stroke="#374151"
            strokeWidth={0.015 * (limb.weight ?? 1)}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

export const PoseLibraryPanel: React.FC<PoseLibraryPanelProps> = ({
  canvasWidth,
  canvasHeight,
  onInsertPose,
  compact = false,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | Pose['category']>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.4);
  const [flip, setFlip] = useState(false);

  const visiblePoses = useMemo(() => {
    const base = query.trim() ? searchPoses(query) : POSE_LIBRARY;
    if (category === 'all') return base;
    return base.filter((p) => p.category === category);
  }, [query, category]);

  const selected = selectedId ? POSE_LIBRARY.find((p) => p.id === selectedId) ?? null : null;

  const handleInsert = () => {
    if (!selected || !onInsertPose) return;
    const strokes = buildStrokesFromPose(selected, {
      canvasWidth,
      canvasHeight,
      scale,
      flipHorizontal: flip,
    });
    onInsertPose(strokes, selected);
  };

  const padding = compact ? 1 : 2;

  return (
    <Paper
      elevation={0}
      sx={{
        p: padding,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
      data-testid="pose-library-panel"
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Accessibility fontSize="small" color="action" />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
          Pose-bibliotek
        </Typography>
      </Stack>

      <TextField
        size="small"
        placeholder="Søk (løp, peker, sittende…)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        fullWidth
        InputProps={{
          startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
        }}
        sx={{ mb: 1 }}
      />

      <Box sx={{ mb: 1, overflowX: 'auto' }}>
        <Stack direction="row" spacing={0.5}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              size="small"
              onClick={() => setCategory(c.value)}
              variant={category === c.value ? 'filled' : 'outlined'}
              color={category === c.value ? 'primary' : 'default'}
            />
          ))}
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: compact ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(72px, 1fr))',
          gap: 0.5,
          maxHeight: 280,
          overflowY: 'auto',
          mb: 1,
        }}
      >
        {visiblePoses.map((pose) => (
          <Tooltip key={pose.id} title={`${pose.name} — ${pose.description}`} placement="top">
            <ButtonBase
              onClick={() => setSelectedId(pose.id)}
              sx={{
                p: 0.5,
                borderRadius: 1,
                border: '2px solid',
                borderColor: selectedId === pose.id ? 'primary.main' : 'transparent',
                bgcolor: selectedId === pose.id ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              data-testid={`pose-thumb-${pose.id}`}
            >
              <PoseThumb pose={pose} size={compact ? 48 : 64} />
              <Typography variant="caption" sx={{ fontSize: '0.65rem', mt: 0.25 }} noWrap>
                {pose.name}
              </Typography>
            </ButtonBase>
          </Tooltip>
        ))}
        {visiblePoses.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 2 }}>
            Ingen poser matcher søket.
          </Typography>
        )}
      </Box>

      {selected && (
        <Stack spacing={1} sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {selected.name}
          </Typography>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Skala
            </Typography>
            <Slider
              size="small"
              min={0.15}
              max={0.9}
              step={0.05}
              value={scale}
              onChange={(_, v) => setScale(v as number)}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${Math.round(v * 100)} %`}
            />
          </Box>
          <Stack direction="row" spacing={1}>
            <ToggleButton
              size="small"
              value="flip"
              selected={flip}
              onChange={() => setFlip((f) => !f)}
            >
              <FlipOutlined fontSize="small" />
            </ToggleButton>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleInsert}
              disabled={!onInsertPose}
              fullWidth
              data-testid="pose-insert-button"
            >
              Sett inn
            </Button>
          </Stack>
          {!onInsertPose && (
            <Typography variant="caption" color="text.secondary">
              Innsetting ikke koblet til editor.
            </Typography>
          )}
        </Stack>
      )}
    </Paper>
  );
};

export default PoseLibraryPanel;
