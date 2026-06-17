/**
 * ProducerReceivedMaterialsPanel — produsentens «Mottatt fra klient»-panel i
 * prosjektrommet. Viser merkevare-/materialfiler klienten har lastet opp (fra
 * Merkevare-fanen), med «Bruk i prosjekt» (status→approved) + «Last ned alle».
 * Matcher mockupens høyre/nederste «Mottatt fra klient»-panel.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, Chip, CircularProgress, Snackbar,
} from '@mui/material';
import {
  CloudDoneOutlined as ReceivedIcon,
  DownloadOutlined as DownloadIcon,
  PlaylistAddCheckOutlined as UseIcon,
  CheckCircle as UsedIcon,
  InsertDriveFileOutlined as FileIcon,
} from '@mui/icons-material';
import {
  listMaterials, setMaterialStatus, downloadMaterialFile,
  type RoleRoomMaterial,
} from '../../services/roleRoomMaterialsApi';

const CATEGORY_LABEL: Record<string, string> = {
  brand_logo: 'Logo', brand_colors: 'Farger / profil', brand_fonts: 'Fonter',
  brand_asset: 'Merkevare', reference: 'Referanse', document: 'Dokument', other: 'Annet',
};

function fmtSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProducerReceivedMaterialsPanel({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<RoleRoomMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listMaterials(projectId);
      setItems(all.filter((m) => m.uploadedByClient || m.createdByRole === 'client_reviewer' || m.createdByRole === 'client'));
    } catch {
      /* tom */
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const downloadable = useMemo(() => items.filter((m) => m.originalName), [items]);

  const useInProject = useCallback(async (m: RoleRoomMaterial) => {
    setBusyId(m.id);
    try {
      await setMaterialStatus(projectId, m.id, 'approved');
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: 'approved' } : x)));
      setToast(`${m.originalName ?? m.title} tatt inn i prosjektet.`);
    } catch {
      setToast('Kunne ikke ta inn filen.');
    } finally {
      setBusyId(null);
    }
  }, [projectId]);

  const downloadAll = useCallback(async () => {
    for (const m of downloadable) {
      try { await downloadMaterialFile(m); } catch { /* hopp over */ }
    }
  }, [downloadable]);

  if (!loading && items.length === 0) return null;

  return (
    <Box sx={{ borderRadius: 2, border: '1px solid rgba(168,85,247,0.28)', background: 'rgba(124,58,237,0.06)', p: { xs: 1.25, md: 1.5 }, mb: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <ReceivedIcon sx={{ fontSize: 20, color: '#c4b5fd' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: '#f5f3ff', fontWeight: 800, fontSize: '0.95rem' }}>Mottatt fra klient</Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.78rem' }}>
            {loading ? 'Laster…' : `${items.length} fil${items.length === 1 ? '' : 'er'} delt av klienten — klare til å tas inn.`}
          </Typography>
        </Box>
        {downloadable.length > 0 ? (
          <Button
            size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => void downloadAll()}
            sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40, color: '#c4b5fd', borderColor: 'rgba(168,85,247,0.4)' }}
          >
            Last ned alle
          </Button>
        ) : null}
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} sx={{ color: '#a855f7' }} /></Box>
      ) : (
        <Stack spacing={0.8}>
          {items.map((m) => {
            const used = m.status === 'approved';
            return (
              <Box key={m.id} sx={{ borderRadius: '9px', border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(2,6,23,0.4)', p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 34, height: 34, flexShrink: 0, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(148,163,184,0.1)' }}>
                  <FileIcon sx={{ fontSize: 18, color: '#c4b5fd' }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ color: '#f1f5f9', fontSize: '0.84rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.title}>
                    {m.originalName ?? m.title}
                  </Typography>
                  <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.15 }}>
                    <Chip label={CATEGORY_LABEL[m.entryType] ?? 'Annet'} size="small" sx={{ height: 17, fontSize: '0.6rem', fontWeight: 700, color: 'rgba(196,181,253,0.95)', background: 'rgba(168,85,247,0.14)' }} />
                    {m.fileSize ? <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem' }}>{fmtSize(m.fileSize)}</Typography> : null}
                  </Stack>
                </Box>
                {used ? (
                  <Stack direction="row" spacing={0.4} alignItems="center" sx={{ flexShrink: 0, px: 1 }}>
                    <UsedIcon sx={{ fontSize: 16, color: '#6ee7b7' }} />
                    <Typography sx={{ color: '#6ee7b7', fontSize: '0.74rem', fontWeight: 700 }}>I prosjektet</Typography>
                  </Stack>
                ) : (
                  <Button
                    size="small" variant="contained" disabled={busyId === m.id}
                    startIcon={busyId === m.id ? <CircularProgress size={13} color="inherit" /> : <UseIcon sx={{ fontSize: 16 }} />}
                    onClick={() => void useInProject(m)}
                    sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 700, fontSize: '0.76rem', minHeight: 40, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)', '&:hover': { background: 'linear-gradient(135deg,#9333ea,#c026d3)' } }}
                  >
                    Bruk i prosjekt
                  </Button>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
      <Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
