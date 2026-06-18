/**
 * EntityAttachmentsPanel.tsx
 *
 * L6 — Gjenbrukbar panel som viser filer knyttet til en spesifikk entitet
 * (storyboard / role / scene / role_research / casting_project).
 *
 * Brukes inline i:
 *   - Storyboard editor — referansebilder per skisse
 *   - Role-research-tab — vedlegg per rolle
 *   - Scene/lokasjon — fotos + plantegninger
 *
 * Mount-eksempel:
 *   <EntityAttachmentsPanel
 *     entityType="storyboard"
 *     entityId={storyboard.id}
 *     projectId={project.id}
 *     sceneId={scene?.id}
 *     entityLabel="Storyboard"
 *   />
 *
 * Filer som lastes opp herfra blir automatisk koblet til (entityType,
 * entityId, projectId, sceneId) i role_room_user_files. Panelet trekker
 * også på samme per-bruker storage-quota — feiler med 507 hvis full.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton,
  Stack, Tooltip, Typography,
} from '@mui/material';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';

const palette = {
  bg: 'rgba(168,85,247,0.04)',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accent: '#c084fc',
  accentBright: '#a855f7',
  danger: '#f87171',
};

interface AttachmentFile {
  id: string;
  displayName: string;
  sizeBytes: number;
  contentType: string | null;
  uploadedAt: string;
  attachmentNote: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rr_bearer') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function EntityAttachmentsPanel({
  entityType,
  entityId,
  projectId,
  sceneId,
  entityLabel,
  acceptedFileTypes,
  compact = false,
  onChange,
}: {
  /** Polymorfisk type: 'storyboard' | 'role' | 'role_research' | 'scene' | ... */
  entityType: string;
  /** Entity-ID som filene knyttes mot */
  entityId: string;
  /** Prosjekt-ID som filene tilhører (gir totaltelling per prosjekt) */
  projectId?: string;
  /** Scene-ID (valgfri) */
  sceneId?: string;
  /** Menneskelig navn brukt i upload-prompt: "Last opp til Storyboard" */
  entityLabel?: string;
  /** F.eks. 'image/*' for å bare tillate bilder. Default = alle filer */
  acceptedFileTypes?: string;
  /** Kompakt versjon — bare ikon + antall, brukt i lister */
  compact?: boolean;
  /** Callback når antall filer endrer seg (for parent å oppdatere badge) */
  onChange?: (count: number) => void;
}) {
  const [files, setFiles] = useState<AttachmentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setError(null);
    try {
      const r = await fetch(
        `/api/role-room/storage/entity-files?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
        { headers: authHeaders() },
      );
      if (!r.ok) {
        setError(r.status === 401 ? 'Logg inn for å se vedlegg' : `HTTP ${r.status}`);
        return;
      }
      const body = await r.json();
      setFiles(body.files ?? []);
      onChange?.(body.files?.length ?? 0);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityType && entityId) refresh();
  }, [entityType, entityId]);

  const handleUpload = async (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(selected)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('sourceModule', entityType);
        fd.append('attachedToEntityType', entityType);
        fd.append('attachedToEntityId', entityId);
        if (projectId) fd.append('projectId', projectId);
        if (sceneId) fd.append('sceneId', sceneId);
        if (entityLabel) fd.append('attachmentNote', entityLabel);

        const r = await fetch('/api/role-room/storage/upload', {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(),
          body: fd,
        });
        if (r.status === 507) {
          const body = await r.json();
          setError(body.detail ?? 'Kvoten på 1 GB er nådd.');
          break;
        }
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          setError(body.detail ?? `Opplasting feilet (HTTP ${r.status})`);
          break;
        }
      }
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Slett vedlegget?')) return;
    try {
      const r = await fetch(`/api/role-room/storage/files/${fileId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (r.ok) await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDownload = (fileId: string) => {
    const token = localStorage.getItem('rr_bearer');
    const url = `/api/role-room/storage/files/${fileId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    window.location.href = url;
  };

  // Compact-versjon: ett ikon + tall + klikk-for-upload
  if (compact) {
    return (
      <Stack direction="row" alignItems="center" spacing={0.6} sx={{ cursor: 'pointer' }}>
        <input
          ref={fileInputRef} type="file" multiple
          accept={acceptedFileTypes}
          style={{ display: 'none' }}
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Tooltip title={`${files.length} vedlegg — klikk for å laste opp`}>
          <Box
            onClick={() => fileInputRef.current?.click()}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.4,
              px: 0.8, py: 0.4, borderRadius: 1,
              bgcolor: files.length > 0 ? 'rgba(168,85,247,0.18)' : 'transparent',
              border: `1px solid ${files.length > 0 ? palette.borderStrong : palette.border}`,
              color: files.length > 0 ? palette.accent : palette.textMuted,
              '&:hover': { bgcolor: 'rgba(168,85,247,0.12)' },
            }}
          >
            <AttachFileOutlinedIcon sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>
              {files.length}
            </Typography>
          </Box>
        </Tooltip>
      </Stack>
    );
  }

  return (
    <Box sx={{
      p: 1.6, borderRadius: 1.4,
      bgcolor: palette.bg,
      border: `1px solid ${palette.border}`,
    }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AttachFileOutlinedIcon sx={{ color: palette.accent, fontSize: 18 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.86rem', color: palette.textPrimary }}>
            Vedlegg {files.length > 0 && <Chip
              label={files.length}
              size="small"
              sx={{ ml: 0.6, height: 18, fontSize: '0.68rem', bgcolor: 'rgba(168,85,247,0.18)', color: palette.accent, fontWeight: 700 }}
            />}
          </Typography>
        </Stack>
        <input
          ref={fileInputRef} type="file" multiple
          accept={acceptedFileTypes}
          style={{ display: 'none' }}
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Button
          size="small" variant="text"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          startIcon={uploading ? <CircularProgress size={12} /> : <CloudUploadOutlinedIcon sx={{ fontSize: 14 }} />}
          sx={{ color: palette.accent, fontSize: '0.74rem', fontWeight: 700 }}
        >
          {uploading ? 'Laster opp…' : 'Last opp'}
        </Button>
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 1.2, fontSize: '0.78rem' }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.2 }}>
          <CircularProgress size={18} sx={{ color: palette.accent }} />
        </Box>
      ) : files.length === 0 ? (
        <Typography sx={{ fontSize: '0.78rem', color: palette.textMuted, fontStyle: 'italic' }}>
          Ingen vedlegg ennå. Klikk "Last opp" for å feste et bilde, PDF eller annen fil
          {entityLabel ? ` til denne ${entityLabel.toLowerCase()}` : ''}.
        </Typography>
      ) : (
        <Stack spacing={0.6}>
          {files.map((f) => {
            const isImage = f.contentType?.startsWith('image/');
            return (
              <Box key={f.id} sx={{
                p: 0.8, borderRadius: 1,
                bgcolor: 'rgba(168,85,247,0.06)',
                border: `1px solid ${palette.border}`,
                display: 'flex', alignItems: 'center', gap: 1,
              }}>
                {isImage ? (
                  <ImageOutlinedIcon sx={{ color: palette.accent, fontSize: 18 }} />
                ) : (
                  <InsertDriveFileOutlinedIcon sx={{ color: palette.textMuted, fontSize: 18 }} />
                )}
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{
                    fontSize: '0.8rem', fontWeight: 600, color: palette.textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.displayName}
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: palette.textMuted }}>
                    {formatBytes(f.sizeBytes)}
                  </Typography>
                </Stack>
                <IconButton size="small" onClick={() => handleDownload(f.id)} sx={{ color: palette.textSecondary, p: 0.4 }}>
                  <DownloadOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton size="small" onClick={() => handleDelete(f.id)} sx={{ color: palette.danger, p: 0.4 }}>
                  <DeleteOutlineOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
