/**
 * CameraControlsPanel.tsx
 *
 * Kamera-tabs + settings-rad (FPS/SHUTTER/IRIS/ISO/WB/FOCUS/STAB) + presets + scope.
 * Speiler livesetmode.md §16.6, §16.7, §16.8.
 *
 * Når Canon CCAPI-proxy er live, vil endring av FPS/SHUTTER/etc trigge
 * POST /api/ccapi/cameras/:ip/settings som kallene mot iPad's
 * CCAPIClient.swift-pattern. WB/ISO endrer via Canon-spesifikke endepunkter
 * (verified i CCAPI Reference v1.4 §4.4 + §4.5).
 */

import React from 'react';
import {
  Box,
  Button,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { CameraId, CameraSlot, CameraSettings, CameraPreset } from './types';

interface CameraControlsPanelProps {
  cameras: CameraSlot[];
  activeCameraId: CameraId;
  onActiveCameraChange: (id: CameraId) => void;
  settings: CameraSettings;
  onSettingsChange: (patch: Partial<CameraSettings>) => void;
  presets: CameraPreset[];
  onApplyPreset: (preset: CameraPreset) => void;
  onSavePreset: () => void;
  scopeMode: 'waveform' | 'vectorscope';
  onScopeModeChange: (mode: 'waveform' | 'vectorscope') => void;
}

// CCAPI tilbyr discrete settings-verdier via /ccapi/ver100/shooting/settings.
// Mock-verdier matcher typiske Canon-presets.
const FPS_OPTIONS = [24, 25, 30, 50, 60, 120];
const SHUTTER_OPTIONS = [180, 172.8, 90, 45]; // angle
const IRIS_OPTIONS = ['f/1.4', 'f/2.0', 'f/2.8', 'f/4.0', 'f/5.6', 'f/8.0'];
const ISO_OPTIONS = [100, 200, 400, 800, 1600, 3200, 6400];
const WB_OPTIONS = [3200, 4300, 5600, 6500, 7500];

function SettingDropdown<T>({
  label,
  value,
  options,
  onChange,
  format,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>
        {label}
      </Typography>
      <Box
        component="select"
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const num = Number(raw);
          onChange(Number.isFinite(num) && !Number.isNaN(num) && typeof options[0] === 'number'
            ? (num as unknown as T)
            : (raw as unknown as T));
        }}
        sx={{
          width: '100%',
          bgcolor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 0.5,
          color: '#fff',
          py: 0.5,
          px: 1,
          fontSize: 11,
          fontFamily: 'monospace',
          appearance: 'none',
          cursor: 'pointer',
          '&:focus': { outline: 'none', borderColor: '#8b5cf6' },
        }}
      >
        {options.map((opt) => (
          <option key={String(opt)} value={String(opt)} style={{ background: '#1a1a1a' }}>
            {format ? format(opt) : String(opt)}
          </option>
        ))}
      </Box>
    </Box>
  );
}

function PresetChip({
  preset,
  onClick,
}: {
  preset: CameraPreset;
  onClick: () => void;
}) {
  return (
    <Chip
      label={preset.name}
      onClick={onClick}
      size="small"
      sx={{
        bgcolor: 'rgba(139,92,246,0.1)',
        border: '1px solid rgba(139,92,246,0.3)',
        color: '#c4b5fd',
        fontSize: 10,
        fontWeight: 600,
        height: 24,
        '&:hover': { bgcolor: 'rgba(139,92,246,0.2)' },
      }}
    />
  );
}

/** Enkel mock-scope. Reel implementasjon krever HTML5 Canvas + decoded video-frames */
function MockScope({ mode }: { mode: 'waveform' | 'vectorscope' }) {
  // SVG-vis med litt bevegelse for liveness-følelse. Decorative only, so skip
  // it entirely for prefers-reduced-motion users and tick at 200ms rather than
  // ~16fps — two instances re-rendering 60 SVG nodes each is needless churn.
  const [phase, setPhase] = React.useState(0);
  React.useEffect(() => {
    if (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const t = setInterval(() => setPhase((p) => (p + 0.16) % (Math.PI * 2)), 200);
    return () => clearInterval(t);
  }, []);

  if (mode === 'vectorscope') {
    // Sirkulær vectorscope-mock
    return (
      <svg viewBox="0 0 200 100" width="100%" height="100%" style={{ display: 'block' }}>
        <circle cx="100" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        <circle cx="100" cy="50" r="20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        {Array.from({ length: 60 }).map((_, i) => {
          const angle = (i / 60) * Math.PI * 2 + phase * 0.1;
          const r = 15 + Math.sin(i * 0.3 + phase) * 10;
          const x = 100 + Math.cos(angle) * r;
          const y = 50 + Math.sin(angle) * r;
          return <circle key={i} cx={x} cy={y} r="0.7" fill="rgba(139,92,246,0.6)" />;
        })}
      </svg>
    );
  }

  // Waveform — RGB-trace
  const points = (offset: number, color: string) => {
    const pts: string[] = [];
    for (let x = 0; x <= 200; x += 2) {
      const y = 50 + Math.sin((x / 20) + phase + offset) * 15 + Math.sin((x / 7) + phase * 2 + offset) * 8;
      pts.push(`${x},${y}`);
    }
    return pts.join(' ');
  };

  return (
    <svg viewBox="0 0 200 100" width="100%" height="100%" style={{ display: 'block' }} preserveAspectRatio="none">
      {/* gridlines */}
      {[0, 25, 50, 75, 100].map((y) => (
        <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" />
      ))}
      <polyline points={points(0, 'red')} fill="none" stroke="rgba(239,68,68,0.5)" strokeWidth="0.5" />
      <polyline points={points(2, 'green')} fill="none" stroke="rgba(34,197,94,0.6)" strokeWidth="0.5" />
      <polyline points={points(4, 'blue')} fill="none" stroke="rgba(59,130,246,0.5)" strokeWidth="0.5" />
    </svg>
  );
}

export const CameraControlsPanel: React.FC<CameraControlsPanelProps> = ({
  cameras,
  activeCameraId,
  onActiveCameraChange,
  settings,
  onSettingsChange,
  presets,
  onApplyPreset,
  onSavePreset,
  scopeMode,
  onScopeModeChange,
}) => {
  return (
    <Box
      sx={{
        bgcolor: '#0a0a0a',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        p: 1.5,
        display: 'flex',
        gap: 2,
      }}
    >
      {/* Venstre: kamera-controls (60%) */}
      <Box sx={{ flex: '1 1 60%', minWidth: 0 }}>
        {/* Cam-tabs */}
        <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
          {cameras.map((cam) => (
            <Box
              key={cam.id}
              onClick={() => onActiveCameraChange(cam.id)}
              sx={{
                bgcolor: cam.id === activeCameraId ? 'rgba(139,92,246,0.15)' : 'transparent',
                color: cam.id === activeCameraId ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                px: 1.5,
                py: 0.5,
                borderRadius: 0.5,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                transition: 'all 120ms',
                '&:hover': { bgcolor: cam.id === activeCameraId ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)' },
              }}
            >
              KAMERA {cam.label.replace('Cam ', '')}
            </Box>
          ))}
        </Stack>

        {/* Settings-row */}
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <SettingDropdown
            label="FPS"
            value={settings.fps}
            options={FPS_OPTIONS}
            onChange={(fps) => onSettingsChange({ fps })}
          />
          <SettingDropdown
            label="Shutter"
            value={settings.shutterAngle ?? 180}
            options={SHUTTER_OPTIONS}
            onChange={(shutterAngle) => onSettingsChange({ shutterAngle })}
            format={(v) => `${v}°`}
          />
          <SettingDropdown
            label="Iris"
            value={settings.iris}
            options={IRIS_OPTIONS}
            onChange={(iris) => onSettingsChange({ iris })}
          />
          <SettingDropdown
            label="ISO"
            value={settings.iso}
            options={ISO_OPTIONS}
            onChange={(iso) => onSettingsChange({ iso })}
          />
          <SettingDropdown
            label="WB"
            value={settings.whiteBalanceK}
            options={WB_OPTIONS}
            onChange={(whiteBalanceK) => onSettingsChange({ whiteBalanceK })}
            format={(v) => `${v}K`}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>
              Focus
            </Typography>
            <ToggleButtonGroup
              value={settings.focus}
              exclusive
              size="small"
              onChange={(_, v) => v && onSettingsChange({ focus: v })}
              sx={{
                width: '100%',
                '& .MuiToggleButton-root': {
                  flex: 1,
                  py: 0.4,
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)',
                },
                '& .Mui-selected': { bgcolor: 'rgba(139,92,246,0.2) !important', color: '#c4b5fd !important' },
              }}
            >
              <ToggleButton value="auto">AUTO</ToggleButton>
              <ToggleButton value="manual">MAN</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>
              Stab
            </Typography>
            <ToggleButtonGroup
              value={settings.stabilization ? 'on' : 'off'}
              exclusive
              size="small"
              onChange={(_, v) => v && onSettingsChange({ stabilization: v === 'on' })}
              sx={{
                width: '100%',
                '& .MuiToggleButton-root': {
                  flex: 1,
                  py: 0.4,
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)',
                },
                '& .Mui-selected': { bgcolor: 'rgba(139,92,246,0.2) !important', color: '#c4b5fd !important' },
              }}
            >
              <ToggleButton value="on">ON</ToggleButton>
              <ToggleButton value="off">OFF</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Stack>

        {/* Presets */}
        <Box>
          <Typography sx={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
            Presets
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {presets.map((p) => (
              <PresetChip key={p.id} preset={p} onClick={() => onApplyPreset(p)} />
            ))}
            <Tooltip title="Lagre nåværende settings som preset">
              <Box
                component="button"
                onClick={onSavePreset}
                sx={{
                  bgcolor: 'transparent',
                  border: '1px dashed rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.6)',
                  borderRadius: 4,
                  px: 1,
                  py: 0.25,
                  fontSize: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  fontFamily: 'inherit',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                }}
              >
                <AddIcon sx={{ fontSize: 12 }} />
                Lagre preset
              </Box>
            </Tooltip>
          </Stack>
        </Box>
      </Box>

      {/* Høyre: Scope (40%) */}
      <Box sx={{ flex: '1 1 40%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
          <Box
            onClick={() => onScopeModeChange('waveform')}
            sx={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.5,
              cursor: 'pointer',
              color: scopeMode === 'waveform' ? '#fff' : 'rgba(255,255,255,0.4)',
              borderBottom: scopeMode === 'waveform' ? '2px solid #8b5cf6' : '2px solid transparent',
              pb: 0.25,
            }}
          >
            WAVEFORM
          </Box>
          <Box
            onClick={() => onScopeModeChange('vectorscope')}
            sx={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.5,
              cursor: 'pointer',
              color: scopeMode === 'vectorscope' ? '#fff' : 'rgba(255,255,255,0.4)',
              borderBottom: scopeMode === 'vectorscope' ? '2px solid #8b5cf6' : '2px solid transparent',
              pb: 0.25,
            }}
          >
            VECTORSCOPE
          </Box>
        </Stack>
        <Box
          sx={{
            flex: 1,
            bgcolor: '#000',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 0.5,
            minHeight: 110,
            position: 'relative',
          }}
        >
          <MockScope mode={scopeMode} />
          {/* Scale labels for waveform */}
          {scopeMode === 'waveform' && (
            <Stack
              sx={{
                position: 'absolute',
                left: 4,
                top: 4,
                bottom: 4,
                justifyContent: 'space-between',
              }}
            >
              {[100, 75, 50, 25, 0].map((n) => (
                <Typography key={n} sx={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                  {n}
                </Typography>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default CameraControlsPanel;
