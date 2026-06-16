/**
 * SharedMaterialsCard — polert «Delte filer»-oversikt i prosjektrommet
 * (porter ws-materials-designet). Viser delte prosjektfiler med type-ikon
 * (dok/video/bilde/lyd), filnavn, «delt av <rolle>» og størrelse, pluss en
 * totalstripe (antall filer · samlet størrelse).
 *
 * Presentasjon — tar materialene ProducerMediaPanel allerede har hentet
 * (role_room_client_materials), filtrert til de med faktisk opplastet fil.
 */

import * as React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import DescriptionIcon from '@mui/icons-material/Description';
import MovieIcon from '@mui/icons-material/Movie';
import ImageIcon from '@mui/icons-material/Image';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import type { ProducerClientMaterial } from '../../models/casting';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

interface FileEntry { name: string; bytes: number; by: string; kind: 'doc' | 'video' | 'image' | 'audio' }

function roleLabel(material: ProducerClientMaterial): string {
  const meta = (material.metadata ?? {}) as Record<string, any>;
  if (meta.uploadedByClient || meta.clientName) return meta.clientName || 'Klient';
  const role = (material.created_by_role || '').toLowerCase();
  if (role.includes('client') || role.includes('klient')) return 'Klient';
  if (role.includes('producer') || role.includes('produsent') || role.includes('director')) return 'Produsent';
  if (role.includes('audio') || role.includes('lyd')) return 'Lydtekniker';
  return material.created_by_role ? material.created_by_role : 'Teamet';
}

function kindOf(mime: string | undefined, name: string): FileEntry['kind'] {
  const m = (mime || '').toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|svg)$/.test(n)) return 'image';
  if (m.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/.test(n)) return 'video';
  if (m.startsWith('audio/') || /\.(wav|mp3|aiff?|flac|m4a)$/.test(n)) return 'audio';
  return 'doc';
}

const KIND_ICON: Record<FileEntry['kind'], React.ReactElement> = {
  doc: <DescriptionIcon sx={{ fontSize: 18 }} />,
  video: <MovieIcon sx={{ fontSize: 18 }} />,
  image: <ImageIcon sx={{ fontSize: 18 }} />,
  audio: <GraphicEqIcon sx={{ fontSize: 18 }} />,
};

function fmtSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 10) return `${Math.round(mb)} MB`;
  if (mb >= 0.1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export interface SharedMaterialsCardProps {
  materials: ProducerClientMaterial[];
}

export default function SharedMaterialsCard({ materials }: SharedMaterialsCardProps): React.ReactElement | null {
  const files: FileEntry[] = [];
  for (const m of materials) {
    const f = (m.metadata as Record<string, any> | undefined)?.file;
    if (!f) continue;
    const name = String(f.originalName || f.fileName || m.title || 'fil');
    const bytes = Number(f.fileSize) || 0;
    files.push({ name, bytes, by: roleLabel(m), kind: kindOf(f.mimeType, name) });
  }
  if (files.length === 0) return null;

  const totalBytes = files.reduce((a, f) => a + f.bytes, 0);

  return (
    <Box
      sx={{
        position: 'relative', borderRadius: 3, p: { xs: 2, md: 2.4 }, mb: 1.5, overflow: 'hidden',
        border: '1px solid rgba(167,139,250,0.2)',
        background: 'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.18), transparent 55%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
        boxShadow: '0 14px 40px rgba(124,58,237,0.22)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.1} sx={{ mb: 1.6 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
          <FolderSharedIcon sx={{ fontSize: 17, color: '#fff' }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: INK, lineHeight: 1.1 }}>Materialer</Typography>
          <Typography sx={{ fontSize: 11.5, color: MUTED }}>Delte filer i prosjektrommet</Typography>
        </Box>
      </Stack>

      <Stack spacing={0.8}>
        {files.map((f, i) => (
          <Stack key={`${f.name}-${i}`} direction="row" alignItems="center" spacing={1.2}
            sx={{ p: 1.1, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.12)' }}>
            <Box sx={{ width: 34, height: 34, borderRadius: 1.6, display: 'grid', placeItems: 'center', flexShrink: 0, color: '#fff', background: GRAD }}>
              {KIND_ICON[f.kind]}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</Typography>
              <Typography sx={{ fontSize: 11.5, color: MUTED }}>Delt av {f.by}</Typography>
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(226,232,240,0.78)', fontFamily: 'monospace', flexShrink: 0 }}>{fmtSize(f.bytes)}</Typography>
          </Stack>
        ))}
      </Stack>

      {/* Totalstripe */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.6, pt: 1.4, borderTop: '1px solid rgba(148,163,184,0.12)' }}>
        <CloudDoneIcon sx={{ fontSize: 17, color: ACCENT }} />
        <Typography sx={{ fontSize: 12.5, color: MUTED, flex: 1 }}>Totalt delt</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: INK }}>{files.length} filer · {fmtSize(totalBytes)}</Typography>
      </Stack>
    </Box>
  );
}
