/**
 * LeadgridExperienceMediaPanel.tsx
 *
 * Super-admin velger HVA som vises inne i hver mockup i landing-scrollfilmen,
 * og ser en LIVE preview av hvordan det ser ut inni enhets-rammen FØR
 * publisering. Lagrer til PUT /api/leadgrid/experience-config → landing plukker
 * det opp (leadgrid.no) uten ny utrulling.
 *
 * Media kan være bilde (png/webp/jpg), GIF (i bilde-feltet) eller video (mp4).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Card, CardContent, Divider, Grid, Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import { Movie as MovieIcon, Refresh as RefreshIcon, Save as SaveIcon } from '@mui/icons-material';
import { AdminButton, AdminLoading, AdminError, useIsMobile } from './design-system';
import {
  EXPERIENCE_SCENE_MANIFEST, WATCH_SCREEN_RECT,
  type LeadgridExperienceConfig, type ExperienceSceneInfo,
} from '@shared/leadgridExperienceConfig';

function bearer(): string {
  return typeof window !== 'undefined' && localStorage.getItem('rr_bearer')
    ? `Bearer ${localStorage.getItem('rr_bearer')}` : '';
}

// Live-preview av media inne i riktig enhets-ramme.
function MockupPreview({ scene, image, video }: { scene: ExperienceSceneInfo; image: string; video?: string }) {
  const media = video
    ? <video src={video} poster={image} muted loop autoPlay playsInline
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
    : <img src={image} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />;

  if (scene.kind === 'cinematic') {
    return (
      <Box sx={{ width: 220, aspectRatio: '16 / 10', borderRadius: 2, overflow: 'hidden', bgcolor: '#0b0518' }}>
        {media}
      </Box>
    );
  }
  if (scene.kind === 'framed') {
    // Watch: media bak transparent ramme, klippet til skjerm-rektangelet.
    return (
      <Box sx={{ position: 'relative', width: 150, aspectRatio: '560 / 880' }}>
        <Box sx={{ position: 'absolute', ...WATCH_SCREEN_RECT, overflow: 'hidden', borderRadius: '13%', bgcolor: '#0b0518' }}>
          {media}
        </Box>
        <Box component="img" src={scene.bezel} alt="" aria-hidden
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      </Box>
    );
  }
  // device: CSS-bezel (rundet mørk ramme) med media inni.
  const w = scene.landscape ? 260 : 150;
  return (
    <Box sx={{
      width: w, borderRadius: 3, p: '8px',
      background: 'linear-gradient(160deg, #23203a, #0c0a18)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    }}>
      <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: '#0b0518', aspectRatio: scene.landscape ? '4 / 3' : '3 / 4' }}>
        {media}
      </Box>
    </Box>
  );
}

export default function LeadgridExperienceMediaPanel() {
  const [config, setConfig] = useState<LeadgridExperienceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const fetchConfig = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/leadgrid/experience-config', { credentials: 'include' });
      if (!r.ok) { setError(`HTTP ${r.status}`); return; }
      const c = await r.json();
      setConfig({ scenes: c?.scenes ?? {} });
      setDirty(false);
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const patch = (id: string, field: 'image' | 'video', value: string) => {
    setConfig((c) => {
      const scenes = { ...(c?.scenes ?? {}) };
      const entry = { ...(scenes[id] ?? {}) };
      if (value.trim() === '') delete entry[field];
      else entry[field] = value.trim();
      if (!entry.image && !entry.video) delete scenes[id];
      else scenes[id] = entry;
      return { scenes };
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const r = await fetch('/api/leadgrid/experience-config', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: bearer() },
        body: JSON.stringify({ config }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) setSnackbar(`Feil: ${body.error || `HTTP ${r.status}`}`);
      else { setSnackbar('Lagret — endringene er nå live på leadgrid.no'); setDirty(false); }
    } catch (e) { setSnackbar(`Feil: ${String(e)}`); } finally { setSaving(false); }
  };

  if (loading) return <AdminLoading />;
  if (error || !config) return <AdminError message={error ?? 'Ingen data'} onRetry={fetchConfig} />;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }} flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <MovieIcon aria-hidden sx={{ color: '#a78bfa' }} />
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>Leadgrid — Mockup-innhold</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <AdminButton tone="ghost" startIcon={<RefreshIcon />} onClick={fetchConfig} size="small">Hent på nytt</AdminButton>
          <AdminButton tone="primary" startIcon={<SaveIcon />} onClick={handleSave} loading={saving} disabled={saving || !dirty}>
            {dirty ? 'Lagre & publiser' : 'Lagret'}
          </AdminButton>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2.5 }}>
        Velg hva som vises <strong>inne i hver mockup</strong> i scrollfilmen på leadgrid.no. Preview-en til
        venstre viser hvordan det ser ut i enhets-rammen. Media kan være bilde, <strong>GIF</strong> (i bilde-feltet)
        eller <strong>video (mp4)</strong>. Tomt felt = bruk standard. Lagre → live på leadgrid.no (kan ta ~60 sek).
      </Alert>

      <Stack spacing={2}>
        {EXPERIENCE_SCENE_MANIFEST.map((scene) => {
          const o = config.scenes[scene.id] ?? {};
          const image = o.image || scene.defaultImage;
          const video = o.video !== undefined ? (o.video || undefined) : scene.defaultVideo;
          return (
            <Card key={scene.id} sx={{ border: '1px solid rgba(167,139,250,0.22)' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{scene.title}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    <code>{scene.id}</code> · {scene.kind}{scene.landscape ? ' · liggende' : ''}
                  </Typography>
                </Stack>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm="auto">
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <MockupPreview scene={scene} image={image} video={video} />
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm>
                    <Stack spacing={1.5}>
                      <TextField
                        fullWidth size="small" label="Bilde / GIF (URL)"
                        placeholder={scene.defaultImage}
                        value={o.image ?? ''}
                        onChange={(e) => patch(scene.id, 'image', e.target.value)}
                        helperText={o.image ? 'Overstyrt' : `Standard: ${scene.defaultImage}`}
                      />
                      {scene.kind !== 'cinematic' && (
                        <TextField
                          fullWidth size="small" label="Video mp4 (URL) — valgfritt"
                          placeholder={scene.defaultVideo ?? '(ingen)'}
                          value={o.video ?? ''}
                          onChange={(e) => patch(scene.id, 'video', e.target.value)}
                          helperText={
                            o.video !== undefined
                              ? (o.video ? 'Overstyrt' : 'Fjernet — kun bilde')
                              : (scene.defaultVideo ? `Standard: ${scene.defaultVideo}` : 'Ingen video')
                          }
                        />
                      )}
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Divider sx={{ my: 2.5 }} />
      <Stack direction="row" justifyContent="flex-end">
        <AdminButton tone="primary" startIcon={<SaveIcon />} onClick={handleSave} loading={saving} disabled={saving || !dirty}>
          {dirty ? 'Lagre & publiser' : 'Lagret'}
        </AdminButton>
      </Stack>

      <Snackbar open={!!snackbar} autoHideDuration={6000} onClose={() => setSnackbar(null)} message={snackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }} />
    </Box>
  );
}
