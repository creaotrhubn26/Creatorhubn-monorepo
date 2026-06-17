/**
 * ClientMerkevareView — merkevare-/filopplasting i klient-workspace. Klienten
 * deler logo, farger/profil, fonter og referanser med produksjonsteamet; filene
 * synker til produsenten (created_by_role=client, auto-varsel). Matcher
 * «Last opp logo & merkevare»-mockupen: kategori-faner, drag-drop med fremdrift,
 * fil-liste med status. Responsiv (desktop/iPad/mobil — én kolonne som stables).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Button, Chip, LinearProgress, CircularProgress, Snackbar,
} from '@mui/material';
import {
  CloudUploadOutlined as UploadIcon,
  CheckCircleOutline as DoneIcon,
  HourglassEmptyOutlined as ProcessingIcon,
  StarOutline as ImportantIcon,
  InsertDriveFileOutlined as FileIcon,
  NotificationsActiveOutlined as NotifyIcon,
} from '@mui/icons-material';
import {
  MATERIAL_CATEGORIES, listMaterials, uploadMaterialFile,
  type MaterialCategory, type RoleRoomMaterial,
} from '../../services/roleRoomMaterialsApi';

type Upload = { tempId: string; name: string; pct: number; error?: string };

function fmtSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  MATERIAL_CATEGORIES.map((c) => [c.key, c.label]),
);

export default function ClientMerkevareView({ projectId }: { projectId: string }) {
  const [category, setCategory] = useState<MaterialCategory>('brand_logo');
  const [items, setItems] = useState<RoleRoomMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const activeCat = MATERIAL_CATEGORIES.find((c) => c.key === category) ?? MATERIAL_CATEGORIES[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listMaterials(projectId));
    } catch {
      /* tom liste hvis feil */
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      const tempId = `${file.name}-${file.size}-${list.indexOf(file)}`;
      setUploads((prev) => [...prev, { tempId, name: file.name, pct: 0 }]);
      try {
        await uploadMaterialFile(projectId, file, category, {
          onProgress: (pct) => setUploads((prev) => prev.map((u) => (u.tempId === tempId ? { ...u, pct } : u))),
        });
        setUploads((prev) => prev.filter((u) => u.tempId !== tempId));
        setToast('Lastet opp — produsenten er varslet.');
        await load();
      } catch (e) {
        setUploads((prev) => prev.map((u) => (u.tempId === tempId ? { ...u, error: e instanceof Error ? e.message : 'Feil' } : u)));
      }
    }
  }, [projectId, category, load]);

  return (
    <Stack spacing={1.75}>
      <Box>
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc' }}>
          Last opp logo &amp; merkevare
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'rgba(226,232,240,0.66)', mt: 0.3 }}>
          Del logoen din, fargeprofil, fonter og referanser med produksjonsteamet.
          Velg kategori, slipp filene — produsenten ser dem med en gang.
        </Typography>
      </Box>

      {/* Kategori-faner */}
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        {MATERIAL_CATEGORIES.map((c) => {
          const active = c.key === category;
          return (
            <Button
              key={c.key}
              onClick={() => setCategory(c.key)}
              aria-pressed={active}
              sx={{
                textTransform: 'none', fontWeight: 700, fontSize: '0.82rem', minHeight: 44, px: 1.6,
                borderRadius: '10px',
                color: active ? '#fff' : 'rgba(226,232,240,0.82)',
                background: active ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? 'transparent' : 'rgba(148,163,184,0.2)'}`,
                '&:hover': { background: active ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'rgba(255,255,255,0.06)' },
                '&:focus-visible': { outline: '2px solid #22d3ee', outlineOffset: 2 },
              }}
            >
              {c.label}
            </Button>
          );
        })}
      </Stack>

      {/* Kategori-tittel + viktig-merke for logo */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#e2e8f0' }}>{activeCat.label}</Typography>
        {category === 'brand_logo' ? (
          <Chip
            icon={<ImportantIcon sx={{ fontSize: 14, color: '#fcd34d !important' }} />}
            label="VIKTIGST" size="small"
            sx={{ height: 22, fontSize: '0.65rem', fontWeight: 800, letterSpacing: 0.4, color: '#fcd34d', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.4)' }}
          />
        ) : null}
      </Stack>

      {/* Drag-drop sone */}
      <Box
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files); }}
        sx={{
          borderRadius: '14px', border: `1.5px dashed ${dragOver ? '#a855f7' : 'rgba(148,163,184,0.32)'}`,
          background: dragOver ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.015)',
          px: 2, py: { xs: 4, md: 5 }, textAlign: 'center', transition: 'all 0.15s',
        }}
      >
        <Box sx={{ width: 56, height: 56, mx: 'auto', mb: 1.5, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}>
          <UploadIcon sx={{ fontSize: 28, color: '#fff' }} />
        </Box>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9' }}>
          Slipp filer her eller bla gjennom
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.62)', mt: 0.4, maxWidth: 440, mx: 'auto' }}>
          {activeCat.hint}
        </Typography>
        <Button
          onClick={() => inputRef.current?.click()}
          startIcon={<UploadIcon />}
          sx={{ mt: 2, textTransform: 'none', fontWeight: 700, minHeight: 44, px: 3, borderRadius: '10px', color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)', '&:hover': { background: 'linear-gradient(135deg,#9333ea,#c026d3)' }, '&:focus-visible': { outline: '2px solid #22d3ee', outlineOffset: 2 } }}
        >
          Bla gjennom filer
        </Button>
        <Stack direction="row" spacing={0.6} justifyContent="center" sx={{ mt: 2, flexWrap: 'wrap', gap: 0.6 }}>
          {activeCat.accepts.map((a) => (
            <Chip key={a} label={a} size="small" sx={{ height: 22, fontSize: '0.66rem', fontWeight: 700, color: 'rgba(226,232,240,0.78)', background: 'rgba(148,163,184,0.12)' }} />
          ))}
        </Stack>
        <input
          ref={inputRef} type="file" multiple hidden
          onChange={(e) => { if (e.target.files?.length) void handleFiles(e.target.files); e.target.value = ''; }}
        />
      </Box>

      {/* Auto-varsel-banner */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 1.1, borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.24)' }}>
        <NotifyIcon sx={{ fontSize: 18, color: '#6ee7b7' }} />
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.88)' }}>
          Produsenten varsles automatisk når du laster opp.
        </Typography>
      </Stack>

      {/* Pågående opplastinger */}
      {uploads.map((u) => (
        <Box key={u.tempId} sx={{ borderRadius: '10px', border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(2,6,23,0.4)', p: 1.25 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
            <Typography sx={{ color: '#f1f5f9', fontSize: '0.84rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</Typography>
            <Typography sx={{ color: u.error ? '#fca5a5' : '#c4b5fd', fontSize: '0.78rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {u.error ? 'Feilet' : `${u.pct} %`}
            </Typography>
          </Stack>
          {u.error ? (
            <Typography sx={{ color: '#fca5a5', fontSize: '0.74rem' }}>{u.error}</Typography>
          ) : (
            <LinearProgress variant="determinate" value={u.pct} sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(148,163,184,0.16)', '& .MuiLinearProgress-bar': { borderRadius: 3, background: 'linear-gradient(90deg,#a855f7,#d946ef)' } }} />
          )}
        </Box>
      ))}

      {/* Opplastede filer */}
      <Box>
        <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.82rem', fontWeight: 800, mb: 1 }}>
          Dine opplastinger {loading ? '' : `· ${items.length} filer`}
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} sx={{ color: '#a855f7' }} /></Box>
        ) : items.length === 0 ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.82rem', py: 2, textAlign: 'center' }}>
            Ingen filer ennå. Velg en kategori og last opp.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {items.map((m) => <MaterialRow key={m.id} m={m} />)}
          </Stack>
        )}
      </Box>

      <Snackbar open={Boolean(toast)} autoHideDuration={3500} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Stack>
  );
}

function MaterialRow({ m }: { m: RoleRoomMaterial }) {
  const processing = m.status === 'in_review';
  const StatusIcon = processing ? ProcessingIcon : DoneIcon;
  const statusColor = processing ? '#fbbf24' : '#6ee7b7';
  const statusLabel = processing ? 'Behandles' : 'Lastet opp';
  return (
    <Box sx={{ borderRadius: '10px', border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(2,6,23,0.35)', p: 1.1, display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(148,163,184,0.1)' }}>
        <FileIcon sx={{ fontSize: 20, color: '#c4b5fd' }} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ color: '#f1f5f9', fontSize: '0.86rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.title}>
          {m.originalName ?? m.title}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.2, flexWrap: 'wrap', rowGap: 0.2 }}>
          <Chip label={CATEGORY_LABEL[m.entryType] ?? 'Annet'} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, color: 'rgba(196,181,253,0.95)', background: 'rgba(168,85,247,0.14)' }} />
          {m.fileSize ? <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.72rem' }}>{fmtSize(m.fileSize)}</Typography> : null}
        </Stack>
      </Box>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0, px: 1, py: 0.5, borderRadius: '8px', background: processing ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)' }}>
        <StatusIcon sx={{ fontSize: 15, color: statusColor }} />
        <Typography sx={{ color: statusColor, fontSize: '0.74rem', fontWeight: 700 }}>{statusLabel}</Typography>
      </Stack>
    </Box>
  );
}
