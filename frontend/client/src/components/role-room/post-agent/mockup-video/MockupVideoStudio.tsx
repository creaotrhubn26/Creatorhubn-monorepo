/**
 * MockupVideoStudio — Post Agent-flate for å pakke en video inn i en device-
 * mockup og eksportere den polert.
 *
 * ALT er konfigurerbart via toggles/slidere (MockupConfig): enhet, bakgrunn
 * (inkl. transparent), skygge, statuslinje-crop, fade, og hele lyd-kjeden
 * (noise gate, polish, loudness-normalisering). Samme config driver både
 * live-preview og eksport.
 *
 * UI følger repo-konvensjonen: MUI + @mui/icons-material (ingen emoji).
 *
 * NB: Live-preview og nettleser-eksport dekker de VISUELLE valgene + grunnleggende
 * lyd. De avanserte lyd-stegene (noise gate, two-pass loudness, Post Agents
 * apply_audio_polish) og ProRes 4444-alfa kjøres av den native pipelinen
 * (scripts/mockup-polish-pro.mts) — togglene her produserer samme MockupConfig
 * som den pipelinen leser, så Post Agent-klienten kan sende den videre.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import LaptopMacIcon from '@mui/icons-material/LaptopMac';
import TabletMacIcon from '@mui/icons-material/TabletMac';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import MovieCreationIcon from '@mui/icons-material/MovieCreation';
import DownloadIcon from '@mui/icons-material/Download';
import CropFreeIcon from '@mui/icons-material/CropFree';
import FitScreenIcon from '@mui/icons-material/FitScreen';

import { renderMockupFrame } from './renderMockupFrame';
import { getDeviceGeometry } from './deviceGeometry';
import { useMockupVideoExporter } from './useMockupVideoExporter';
import {
  DEFAULT_MOCKUP_CONFIG,
  BACKGROUND_PRESETS,
  toRenderOptions,
  type MockupConfig,
} from './mockupConfig';

export default function MockupVideoStudio() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [cfg, setCfg] = useState<MockupConfig>(DEFAULT_MOCKUP_CONFIG);

  const sourceRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const exporter = useMockupVideoExporter();

  // Hjelpere for å oppdatere nøstede config-seksjoner.
  const setVisual = useCallback(
    <K extends keyof MockupConfig['visual']>(k: K, v: MockupConfig['visual'][K]) =>
      setCfg((c) => ({ ...c, visual: { ...c.visual, [k]: v } })),
    [],
  );
  const setAudio = useCallback(
    <K extends keyof MockupConfig['audio']>(k: K, v: MockupConfig['audio'][K]) =>
      setCfg((c) => ({ ...c, audio: { ...c.audio, [k]: v } })),
    [],
  );
  const setMusic = useCallback(
    <K extends keyof MockupConfig['music']>(k: K, v: MockupConfig['music'][K]) =>
      setCfg((c) => ({ ...c, music: { ...c.music, [k]: v } })),
    [],
  );

  const renderOpts = useMemo(() => toRenderOptions(cfg.visual), [cfg.visual]);
  const isTransparent = cfg.visual.background === 'transparent';

  // Live-preview: samme renderer som eksporten.
  useEffect(() => {
    const canvas = previewRef.current;
    const source = sourceRef.current;
    if (!canvas || !source || !videoUrl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const geom = getDeviceGeometry(cfg.visual.device, 1.5);
    const hasBg = renderOpts.background.kind !== 'none';
    const pad = hasBg ? 0.08 : 0;
    const w = Math.round(geom.width / (1 - pad * 2));
    const h = Math.round(geom.height / (1 - pad * 2));
    canvas.width = w;
    canvas.height = h;

    const draw = () => {
      renderMockupFrame(ctx, source, w, h, renderOpts);
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [videoUrl, cfg.visual.device, renderOpts]);

  const onPickFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  const onExport = useCallback(() => {
    const source = sourceRef.current;
    if (!source) return;
    exporter.start(source, {
      ...renderOpts,
      pixelRatio: cfg.export.pixelRatio,
      frameRate: cfg.export.frameRate,
      includeAudio: cfg.audio.enabled,
    });
  }, [exporter, renderOpts, cfg.export, cfg.audio.enabled]);

  const busy = exporter.state !== 'idle';

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Mockup Video Studio
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Pakk en screen recording inn i en enhets-ramme og eksporter den polert. Alt nedenfor kan slås av og på.
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
        {/* ── Kontroller ── */}
        <Stack spacing={2.5} sx={{ minWidth: 320 }}>
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={busy}>
            Velg video
            <input hidden type="file" accept="video/*" onChange={onPickFile} />
          </Button>

          {/* Enhet */}
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>Enhet</Typography>
            <ToggleButtonGroup
              exclusive fullWidth size="small"
              value={cfg.visual.device}
              onChange={(_, v) => v && setVisual('device', v)}
              disabled={busy}
            >
              <ToggleButton value="macbook"><LaptopMacIcon sx={{ mr: 0.5 }} fontSize="small" />Mac</ToggleButton>
              <ToggleButton value="ipad"><TabletMacIcon sx={{ mr: 0.5 }} fontSize="small" />iPad</ToggleButton>
              <ToggleButton value="iphone"><PhoneIphoneIcon sx={{ mr: 0.5 }} fontSize="small" />iPhone</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Fyll-modus */}
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>Fyll-modus</Typography>
            <ToggleButtonGroup
              exclusive fullWidth size="small"
              value={cfg.visual.fit}
              onChange={(_, v) => v && setVisual('fit', v)}
              disabled={busy}
            >
              <ToggleButton value="cover"><CropFreeIcon sx={{ mr: 0.5 }} fontSize="small" />Cover</ToggleButton>
              <ToggleButton value="contain"><FitScreenIcon sx={{ mr: 0.5 }} fontSize="small" />Contain</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Bakgrunn */}
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>Bakgrunn</Typography>
            <Select
              fullWidth size="small"
              value={cfg.visual.background}
              onChange={(e) => setVisual('background', e.target.value)}
              disabled={busy}
            >
              {Object.keys(BACKGROUND_PRESETS).map((k) => (
                <MenuItem key={k} value={k}>
                  {k === 'transparent' ? 'Transparent (alfa, ProRes)' : k.charAt(0).toUpperCase() + k.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Divider />

          {/* Visuelle toggles */}
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>Visuell polish</Typography>
          <FormControlLabel
            control={<Switch checked={cfg.visual.shadow} disabled={busy || isTransparent}
              onChange={(e) => setVisual('shadow', e.target.checked)} />}
            label="Droppskygge"
          />
          <FormControlLabel
            control={<Switch checked={cfg.visual.statusBarCrop > 0} disabled={busy}
              onChange={(e) => setVisual('statusBarCrop', e.target.checked ? 0.045 : 0)} />}
            label="Skjul statuslinje (tid/5G/batteri)"
          />
          <FormControlLabel
            control={<Switch checked={cfg.visual.fadeSeconds > 0} disabled={busy}
              onChange={(e) => setVisual('fadeSeconds', e.target.checked ? 0.5 : 0)} />}
            label="Fade inn/ut"
          />

          <Divider />

          {/* Lyd-toggles */}
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>Lyd</Typography>
          <FormControlLabel
            control={<Switch checked={cfg.audio.enabled} disabled={busy}
              onChange={(e) => setAudio('enabled', e.target.checked)} />}
            label="Ta med lyd"
          />
          <FormControlLabel
            control={<Switch checked={cfg.audio.noiseGate} disabled={busy || !cfg.audio.enabled}
              onChange={(e) => setAudio('noiseGate', e.target.checked)} />}
            label="Noise gate (stille når ingen snakker)"
          />
          <FormControlLabel
            control={<Switch checked={cfg.audio.polish} disabled={busy || !cfg.audio.enabled}
              onChange={(e) => setAudio('polish', e.target.checked)} />}
            label="Lyd-polish (Post Agent: de-ess, voice-boost)"
          />
          <FormControlLabel
            control={<Switch checked={cfg.audio.loudnessNormalize} disabled={busy || !cfg.audio.enabled}
              onChange={(e) => setAudio('loudnessNormalize', e.target.checked)} />}
            label={`Loudness-normalisering (${cfg.audio.loudnessTarget} LUFS)`}
          />

          <Divider />

          {/* Musikk-toggles */}
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>Bakgrunnsmusikk</Typography>
          <FormControlLabel
            control={<Switch checked={cfg.music.enabled} disabled={busy}
              onChange={(e) => setMusic('enabled', e.target.checked)} />}
            label="Legg til sang/musikk"
          />
          {cfg.music.enabled && (
            <Button component="label" variant="outlined" size="small" startIcon={<UploadFileIcon />} disabled={busy}>
              {cfg.music.source ? 'Bytt sang' : 'Velg sang'}
              <input hidden type="file" accept="audio/*"
                onChange={(e) => setMusic('source', e.target.files?.[0]?.name ?? null)} />
            </Button>
          )}
          <FormControlLabel
            control={<Switch checked={cfg.music.ducking} disabled={busy || !cfg.music.enabled}
              onChange={(e) => setMusic('ducking', e.target.checked)} />}
            label="Ducking (demp musikk under tale)"
          />

          <Divider />

          {/* Eksport */}
          <Stack spacing={1}>
            <Button
              variant="contained" startIcon={<MovieCreationIcon />} onClick={onExport}
              disabled={!videoUrl || busy || !exporter.isSupported}
            >
              {exporter.state === 'recording'
                ? `Eksporterer… ${Math.round(exporter.progress * 100)}%`
                : 'Eksporter video'}
            </Button>
            {busy && <LinearProgress variant="determinate" value={exporter.progress * 100} />}
            {exporter.lastBlob && !busy && (
              <Button variant="outlined" startIcon={<DownloadIcon />}
                onClick={() => exporter.downloadLastBlob(`mockup-${cfg.visual.device}.webm`)}>
                Last ned resultat
              </Button>
            )}
            {isTransparent && (
              <Typography variant="caption" sx={{ color: 'info.main' }}>
                Transparent + avansert lyd (noise gate, two-pass, polish) krever den native
                pipelinen i Post Agent. Nettleser-eksporten viser preview uten alfa.
              </Typography>
            )}
            {!exporter.isSupported && (
              <Typography variant="caption" sx={{ color: 'warning.main' }}>
                Nettleseren støtter ikke MediaRecorder-eksport.
              </Typography>
            )}
            {exporter.error && (
              <Typography variant="caption" sx={{ color: 'error.main' }}>{exporter.error}</Typography>
            )}
          </Stack>
        </Stack>

        {/* ── Preview ── */}
        <Box
          sx={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 480,
            // Sjakkbrett-bakgrunn så transparent-modus vises tydelig.
            backgroundColor: '#1e1e1e',
            backgroundImage: isTransparent
              ? 'linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)'
              : 'none',
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
            borderRadius: 2, p: 2,
          }}
        >
          {videoUrl ? (
            <canvas ref={previewRef} style={{ maxWidth: '100%', maxHeight: 520, borderRadius: 8 }} />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Velg en video for å se preview
            </Typography>
          )}
        </Box>
      </Stack>

      {videoUrl && (
        <video
          ref={sourceRef}
          src={videoUrl}
          muted loop autoPlay playsInline crossOrigin="anonymous"
          style={{ display: 'none' }}
        />
      )}
    </Box>
  );
}
