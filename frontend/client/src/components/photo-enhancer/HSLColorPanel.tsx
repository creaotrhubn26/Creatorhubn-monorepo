import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Slider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Colorize as ColorizeIcon,
  RestartAlt as RestartAltIcon,
} from '@mui/icons-material';
import {
  cloneHsl,
  HSL_BAND_LABELS,
  HSL_BAND_NAMES,
  HSL_BAND_SWATCHES,
  HSL_IDENTITY,
  type HslAdjustments,
  type HslBand,
  type HslBandName,
} from '../../lib/enhancer-session/module-contract';
import type { SampledPixel } from '../../lib/enhancer-session/hsl-band-math';

export interface HSLColorPanelProps {
  value: HslAdjustments;
  onChange: (next: HslAdjustments) => void;
  /** Fires at the end of an interactive gesture (slider release, reset,
   *  dbl-click). Parents wire this to history commit so HSL edits appear
   *  as discrete undoable steps. */
  onCommit?: (label?: string) => void;
  /** Triggered when the user clicks the eyedropper button. Parent wires
   *  the overlay on the preview canvas and calls `onSample` with the
   *  sampled pixel info; the panel then auto-selects the dominant band. */
  onEyedropperStart: () => void;
  /** True while an eyedropper selection is pending. */
  eyedropperActive: boolean;
  /** Latest sampled pixel (optional). When present we show a swatch + hint. */
  sampledPixel?: SampledPixel | null;
}

type Channel = 'h' | 's' | 'l';

const CHANNEL_LABELS: Record<Channel, string> = {
  h: 'Fargetone',
  s: 'Metning',
  l: 'Lysstyrke',
};

const MICRO_STEP = 0.5;
const COARSE_STEP = 1;

export function HSLColorPanel(props: HSLColorPanelProps) {
  const { value, onChange, onCommit, onEyedropperStart, eyedropperActive, sampledPixel } = props;
  const [activeBand, setActiveBand] = useState<HslBandName>('red');
  const [micro, setMicro] = useState(false);

  // Auto-select the dominant band whenever the parent feeds us a fresh
  // eyedropper sample. A brand-new sampledPixel arrives → we jump the
  // panel to its band so the sliders the photographer reaches for are
  // already the relevant ones.
  const lastSampleRef = React.useRef<SampledPixel | null>(null);
  React.useEffect(() => {
    if (!sampledPixel) return;
    if (lastSampleRef.current === sampledPixel) return;
    lastSampleRef.current = sampledPixel;
    setActiveBand(sampledPixel.dominantBand);
  }, [sampledPixel]);

  const activeValues: HslBand = value[activeBand];

  const updateChannel = (channel: Channel, next: number) => {
    const rounded = Math.round(next * 10) / 10;
    const band: HslBand = { ...activeValues, [channel]: rounded };
    const nextHsl = cloneHsl(value);
    nextHsl[activeBand] = band;
    onChange(nextHsl);
  };

  const resetBand = () => {
    const nextHsl = cloneHsl(value);
    nextHsl[activeBand] = { h: 0, s: 0, l: 0 };
    onChange(nextHsl);
    onCommit?.('HSL reset');
  };

  const resetAll = () => {
    onChange(cloneHsl(HSL_IDENTITY));
    onCommit?.('HSL reset alle');
  };

  const bandsTouched = useMemo(() => {
    const set = new Set<HslBandName>();
    for (const name of HSL_BAND_NAMES) {
      const v = value[name];
      if (v.h !== 0 || v.s !== 0 || v.l !== 0) set.add(name);
    }
    return set;
  }, [value]);

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">HSL — 8 fargebånd</Typography>
          {bandsTouched.size > 0 && (
            <Chip size="small" label={`${bandsTouched.size} justert`} color="primary" variant="outlined" />
          )}
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={eyedropperActive ? 'Velg piksel i forhåndsvisningen' : 'Klikk et område i bildet for å velge bånd'}>
            <IconButton
              size="small"
              color={eyedropperActive ? 'primary' : 'default'}
              onClick={onEyedropperStart}
              sx={{
                border: '1px solid',
                borderColor: eyedropperActive ? 'primary.main' : 'divider',
              }}
            >
              <ColorizeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Nullstill alle bånd">
            <IconButton size="small" onClick={resetAll} disabled={bandsTouched.size === 0}>
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
        {HSL_BAND_NAMES.map((band) => {
          const isActive = band === activeBand;
          const touched = bandsTouched.has(band);
          return (
            <Tooltip key={band} title={HSL_BAND_LABELS[band]} placement="top">
              <IconButton
                size="small"
                onClick={() => setActiveBand(band)}
                aria-label={`Velg ${HSL_BAND_LABELS[band]} bånd`}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: isActive ? 'primary.main' : touched ? 'text.secondary' : 'divider',
                  bgcolor: HSL_BAND_SWATCHES[band],
                  position: 'relative',
                  '&:hover': { bgcolor: HSL_BAND_SWATCHES[band] },
                  outline: isActive ? '2px solid' : 'none',
                  outlineColor: 'primary.light',
                  outlineOffset: 2,
                }}
              >
                {touched ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: -3,
                      right: -3,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'warning.main',
                      border: '1px solid',
                      borderColor: 'background.paper',
                    }}
                  />
                ) : null}
              </IconButton>
            </Tooltip>
          );
        })}
      </Stack>

      {sampledPixel && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: '4px',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: `rgb(${sampledPixel.r}, ${sampledPixel.g}, ${sampledPixel.b})`,
            }}
            aria-hidden
          />
          <Typography variant="caption" color="text.secondary">
            Prøve: H {Math.round(sampledPixel.hueDeg)}° · nærmeste bånd {HSL_BAND_LABELS[sampledPixel.dominantBand]}
          </Typography>
        </Stack>
      )}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
        <Typography variant="caption" color="text.secondary">
          {HSL_BAND_LABELS[activeBand]} — steg {micro ? MICRO_STEP : COARSE_STEP}
        </Typography>
        <Chip
          size="small"
          label={micro ? 'Fin-justering' : 'Normal'}
          clickable
          color={micro ? 'primary' : 'default'}
          variant={micro ? 'filled' : 'outlined'}
          onClick={() => setMicro((m) => !m)}
        />
        <Button
          size="small"
          onClick={resetBand}
          sx={{ ml: 'auto', minWidth: 'auto', px: 1, fontSize: 11 }}
          disabled={activeValues.h === 0 && activeValues.s === 0 && activeValues.l === 0}
        >
          Nullstill
        </Button>
      </Stack>

      {(['h', 's', 'l'] as const).map((channel) => (
        <Box key={channel} sx={{ mt: 0.75 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption">{CHANNEL_LABELS[channel]}</Typography>
            <Typography variant="caption">{activeValues[channel]}</Typography>
          </Stack>
          <Slider
            size="small"
            min={-100}
            max={100}
            step={micro ? MICRO_STEP : COARSE_STEP}
            value={activeValues[channel]}
            marks={[{ value: 0, label: '' }]}
            onChange={(_, next) => {
              const numeric = Array.isArray(next) ? next[0] : next;
              updateChannel(channel, numeric);
            }}
            onChangeCommitted={() => onCommit?.(`HSL ${HSL_BAND_LABELS[activeBand]}`)}
            onDoubleClick={() => {
              updateChannel(channel, 0);
              onCommit?.(`HSL reset ${HSL_BAND_LABELS[activeBand]}`);
            }}
            valueLabelDisplay="auto"
            aria-label={`${HSL_BAND_LABELS[activeBand]} ${CHANNEL_LABELS[channel]}`}
          />
        </Box>
      ))}
    </Paper>
  );
}
