// @ts-nocheck
/**
 * MinProfil — samlet profil- + tilgangs-hub («/profil», alle profesjoner).
 *
 * Branding: KANONISK dark CreatorHub-tema (workspaceTheme `ws` + workspaceDarkTheme)
 * — oransje aksent (#ff8c00) på mørk navy (#0a0f1a), glassmorphism, hvit tekst.
 * Samme skall som Team Workspace / resten av CreatorHub. Profesjonsfargen brukes
 * kun på profesjons-badgen; brukerens egen merkefarge vises som redigerbar data
 * (deres bedriftsbrand — ikke app-chrome).
 *
 * - Fritt redigerbart: avatar, navn, telefon, business-identitet, merkefarge.
 * - Profesjon er GATED (låst) — endring krever betaling / Enterprise-oppgradering,
 *   ikke fri redigering (backend håndhever via COALESCE-guard).
 * - «Tjenester du har tilgang til»: abonnement/plan + workspace-flatene som
 *   profesjonen din låser opp (utledet av navForCategory).
 *
 * Leser: GET /api/user/profile, /api/branding/business-info,
 *        /api/user/subscription-status.
 * Skriver: PATCH /api/user/profile, PUT /api/branding/business-info.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Container, Stack, Typography, Avatar, IconButton, TextField, Button,
  Chip, Divider, CircularProgress, Snackbar, Alert, Card, Grid, ThemeProvider,
} from '@mui/material';
import Lock from '@mui/icons-material/Lock';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Check from '@mui/icons-material/Check';
import Upgrade from '@mui/icons-material/Upgrade';
import WorkspacePremium from '@mui/icons-material/WorkspacePremium';
import OpenInNew from '@mui/icons-material/OpenInNew';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { ws, workspaceDarkTheme, workspaceCategoryFor, navForCategory } from '@/components/workspace/workspaceTheme';
import { getProfessionDisplayName, getProfessionIconColor } from '@shared/profession-types';

const BG = ws.bg;                 // #0a0f1a
const PANEL = ws.panel;           // glassmorphism
const BORDER = ws.border;
const TEXT = ws.text;
const DIM = ws.textDim;
const FAINT = ws.textFaint;
const ACCENT = ws.accent;         // CreatorHub oransje #ff8c00
const GROUP_LABEL = { hoved: 'Hovedmeny', rom: 'Smart rom', klient: 'Kundeportal' };

const MinProfil: React.FC = () => {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', businessName: '', tagline: '',
    organizationNumber: '', businessAddress: '', website: '', brandingColor: ACCENT,
  });

  useEffect(() => {
    (async () => {
      try {
        const [p, b, s] = await Promise.all([
          apiRequest('/api/user/profile').catch(() => null),
          apiRequest('/api/branding/business-info').catch(() => null),
          apiRequest('/api/user/subscription-status').catch(() => null),
        ]);
        const prof = p?.profile || null; setProfile(prof);
        const bi = b?.businessInfo || b || {};
        setPlan(s || null);
        setAvatar(prof?.avatarUrl || null);
        setForm({
          firstName: prof?.firstName || '', lastName: prof?.lastName || '', phone: prof?.phone || '',
          businessName: bi?.businessName || prof?.companyName || '', tagline: bi?.tagline || '',
          organizationNumber: bi?.organizationNumber || '', businessAddress: bi?.businessAddress || '',
          website: bi?.website || '',
          brandingColor: bi?.brandingColor || getProfessionIconColor(prof?.profession) || ACCENT,
        });
      } finally { setLoading(false); }
    })();
  }, []);

  const profession = profile?.profession || user?.profession;
  const category = workspaceCategoryFor(profession);
  const professionLabel = profession ? getProfessionDisplayName(profession) : 'Ikke satt';
  const professionColor = getProfessionIconColor(profession) || ACCENT;
  const services = useMemo(() => navForCategory(category), [category]);

  const completeness = (() => {
    const req: Array<[string, boolean]> = [
      ['Profilbilde', !!avatar], ['Navn', !!(form.firstName || form.lastName).trim()],
      ['Profesjon', !!profession], ['Firmanavn', !!form.businessName.trim()],
    ];
    return { items: req, done: req.filter(([, ok]) => ok).length, total: req.length };
  })();

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const onAvatar = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setAvatar(typeof r.result === 'string' ? r.result : null);
    r.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest('/api/user/profile', { method: 'PATCH', body: {
        firstName: form.firstName, lastName: form.lastName, phone: form.phone, companyName: form.businessName,
        ...(avatar && avatar.startsWith('data:') ? { avatarUrl: avatar } : {}),
      } });
      await apiRequest('/api/branding/business-info', { method: 'PUT', body: {
        businessName: form.businessName, tagline: form.tagline, organizationNumber: form.organizationNumber,
        businessAddress: form.businessAddress, website: form.website, brandingColor: form.brandingColor,
      } });
      setToast('Profil lagret ✓');
    } catch (e: any) { setToast(e?.message || 'Kunne ikke lagre'); }
    finally { setSaving(false); }
  };

  const fieldSx = {
    '& .MuiInputLabel-root': { color: FAINT }, '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
    '& .MuiOutlinedInput-root': { color: TEXT, bgcolor: ws.panelInput, '& fieldset': { borderColor: BORDER }, '&:hover fieldset': { borderColor: ws.accentBorder }, '&.Mui-focused fieldset': { borderColor: ACCENT } },
  };

  if (loading) return (
    <ThemeProvider theme={workspaceDarkTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    </ThemeProvider>
  );

  return (
    <ThemeProvider theme={workspaceDarkTheme}>
    <Box sx={{ minHeight: '100vh', bgcolor: BG, color: TEXT, py: 4 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <IconButton onClick={() => navigate('/dashboard')} sx={{ color: DIM }} aria-label="Tilbake"><ArrowBack /></IconButton>
          <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: '"Space Grotesk", sans-serif' }}>Min profil</Typography>
        </Stack>

        {/* Hero: profilkort + fullføringsgrad */}
        <Card sx={{ p: 3, mb: 3, bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: `${ws.radius}px`,
          background: `linear-gradient(135deg, ${ws.accentSoft}, ${ws.panelSolid})` }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar src={avatar || undefined} sx={{ width: 96, height: 96, bgcolor: ws.accentSoft, color: ACCENT, fontSize: 38, fontWeight: 800 }}>
                {(form.firstName || '?').charAt(0).toUpperCase()}
              </Avatar>
              <IconButton component="label" size="small" sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: ACCENT, color: ws.accentContrast, '&:hover': { bgcolor: ws.accentHover } }} aria-label="Last opp profilbilde">
                <PhotoCamera sx={{ fontSize: 17 }} />
                <input type="file" accept="image/*" hidden onChange={(e) => { onAvatar(e.target.files?.[0]); e.target.value = ''; }} />
              </IconButton>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{`${form.firstName} ${form.lastName}`.trim() || 'Ditt navn'}</Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                <Chip icon={<Lock sx={{ fontSize: 14, color: `${professionColor} !important` }} />} label={professionLabel} size="small"
                  sx={{ bgcolor: `${professionColor}24`, color: professionColor, fontWeight: 700 }} />
                {form.businessName && <Typography variant="body2" sx={{ color: DIM }}>· {form.businessName}</Typography>}
              </Stack>
              {/* Fullføringsgrad */}
              <Box sx={{ mt: 1.5, maxWidth: 460 }}>
                <Typography variant="caption" sx={{ color: ACCENT, fontWeight: 700, letterSpacing: '0.06em' }}>PROFIL {completeness.done}/{completeness.total} KOMPLETT</Typography>
                <Stack direction="row" spacing={0.75} sx={{ my: 0.75 }}>
                  {completeness.items.map(([label, ok]) => <Box key={label} sx={{ flex: 1, height: 5, borderRadius: 3, bgcolor: ok ? ws.green : 'rgba(255,255,255,0.12)' }} />)}
                </Stack>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  {completeness.items.map(([label, ok]) => (
                    <Stack key={label} direction="row" spacing={0.4} alignItems="center">
                      <Check sx={{ fontSize: 13, color: ok ? ws.green : FAINT }} />
                      <Typography variant="caption" sx={{ color: ok ? TEXT : FAINT }}>{label}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Stack>
        </Card>

        <Grid container spacing={3}>
          {/* Venstre: redigerbare profil-innstillinger */}
          <Grid item xs={12} md={7}>
            <Card sx={{ p: 3, bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: `${ws.radius}px`, boxShadow: 'none' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Profil-innstillinger</Typography>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label="Fornavn" fullWidth size="small" value={form.firstName} onChange={set('firstName')} sx={fieldSx} />
                  <TextField label="Etternavn" fullWidth size="small" value={form.lastName} onChange={set('lastName')} sx={fieldSx} />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label="Telefon" fullWidth size="small" value={form.phone} onChange={set('phone')} sx={fieldSx} />
                  <TextField label="Firmanavn" fullWidth size="small" value={form.businessName} onChange={set('businessName')} sx={fieldSx} />
                </Stack>
                <TextField label="Tagline" fullWidth size="small" value={form.tagline} onChange={set('tagline')} sx={fieldSx} placeholder="Kort setning om deg/bedriften" />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label="Org.nr" fullWidth size="small" value={form.organizationNumber} onChange={set('organizationNumber')} sx={fieldSx} />
                  <TextField label="Nettside" fullWidth size="small" value={form.website} onChange={set('website')} sx={fieldSx} />
                </Stack>
                <TextField label="Forretningsadresse" fullWidth size="small" value={form.businessAddress} onChange={set('businessAddress')} sx={fieldSx} />
                <Box>
                  <Typography variant="caption" sx={{ color: DIM }}>Merkefarge (din bedriftsbrand)</Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: form.brandingColor, border: `1px solid ${BORDER}` }} />
                    <TextField size="small" value={form.brandingColor} onChange={set('brandingColor')} sx={{ ...fieldSx, maxWidth: 160 }} />
                  </Stack>
                </Box>
              </Stack>
              <Box sx={{ mt: 3, textAlign: 'right' }}>
                <Button variant="contained" onClick={save} disabled={saving}
                  sx={{ borderRadius: 999, px: 3, fontWeight: 700, textTransform: 'none', bgcolor: ACCENT, color: ws.accentContrast, '&:hover': { bgcolor: ws.accentHover } }}>
                  {saving ? 'Lagrer…' : 'Lagre endringer'}
                </Button>
              </Box>
            </Card>
          </Grid>

          {/* Høyre: profesjon (låst) + tjenester */}
          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              {/* Profesjon — GATED */}
              <Card sx={{ p: 3, bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: `${ws.radius}px`, boxShadow: 'none' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Lock sx={{ fontSize: 18, color: FAINT }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Profesjon</Typography>
                </Stack>
                <Chip label={professionLabel} sx={{ bgcolor: `${professionColor}24`, color: professionColor, fontWeight: 800, fontSize: '0.9rem', height: 34, mb: 1.5 }} />
                <Typography variant="caption" sx={{ color: DIM, display: 'block', mb: 2 }}>
                  Profesjon er låst — den skiller flatene og verktøyene fra hverandre. Å bytte krever betaling, eller oppgradering til Enterprise (som også gir team).
                </Typography>
                <Stack spacing={1}>
                  <Button variant="outlined" startIcon={<Upgrade />} onClick={() => navigate('/subscription')}
                    sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 700, borderColor: BORDER, color: TEXT, '&:hover': { borderColor: ACCENT, bgcolor: ws.accentSoft } }}>
                    Endre profesjon (mot betaling)
                  </Button>
                  <Button variant="contained" startIcon={<WorkspacePremium />} onClick={() => navigate('/subscription')}
                    sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 700, bgcolor: ACCENT, color: ws.accentContrast, '&:hover': { bgcolor: ws.accentHover } }}>
                    Oppgrader til Enterprise (team)
                  </Button>
                </Stack>
              </Card>

              {/* Tjenester du har tilgang til */}
              <Card sx={{ p: 3, bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: `${ws.radius}px`, boxShadow: 'none' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Tjenester du har tilgang til</Typography>
                {/* Plan */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ my: 1.5 }}>
                  <Chip label={plan?.planName || plan?.tier || plan?.status || 'CreatorHub Standard'} size="small"
                    sx={{ bgcolor: ws.accentSoft, color: ACCENT, fontWeight: 700 }} />
                  <Button size="small" endIcon={<OpenInNew sx={{ fontSize: 14 }} />} onClick={() => navigate('/pricing')}
                    sx={{ textTransform: 'none', color: DIM }}>Se planer</Button>
                </Stack>
                <Divider sx={{ borderColor: BORDER, my: 1.5 }} />
                {/* Workspace-flater profesjonen låser opp */}
                <Typography variant="caption" sx={{ color: FAINT, fontWeight: 700, letterSpacing: '0.06em' }}>
                  WORKSPACE-FLATER ({professionLabel})
                </Typography>
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  {(['hoved', 'rom', 'klient'] as const).map((g) => {
                    const items = services.filter((n: any) => n.group === g);
                    if (!items.length) return null;
                    return (
                      <Box key={g}>
                        <Typography variant="caption" sx={{ color: FAINT }}>{GROUP_LABEL[g]}</Typography>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                          {items.map((n: any) => (
                            <Chip key={n.key} label={n.label} size="small"
                              sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: TEXT, fontWeight: 600, '& .MuiChip-label': { px: 1 } }} />
                          ))}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={/kunne ikke|feil/i.test(toast) ? 'error' : 'success'} variant="filled" onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </Box>
    </ThemeProvider>
  );
};

export default MinProfil;
