/**
 * FilerTab — «Filer»-flaten i AdminWorkspace.
 *
 * Var en EmptyState med TODO-en «koble på B2-bucket-lister +
 * showcase-galleri-filer». role_room_user_files ER B2-indeksen (b2_key,
 * størrelse, content-type, hvilken modul filen kom fra), så backend
 * (/api/admin-room/workspace/files) leser den direkte.
 *
 * Flaten svarer på de to spørsmålene en fil-oversikt faktisk stilles:
 * hvor mye plass går med, og hvor kommer den fra.
 */

import { useMemo, useState } from 'react';
import {
  Box,
  Chip,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import AudiotrackOutlinedIcon from '@mui/icons-material/AudiotrackOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';

import {
  type WorkspaceProductScope,
} from '../../services/adminRoomApi';
import { BRAND } from './brand';
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
  SectionHeading,
  UnavailableSources,
  formatBytes,
  formatDateTime,
} from './panelKit';
import { queryError, useWorkspaceFiles } from './useWorkspaceData';

function fileIcon(contentType: string | null) {
  const t = (contentType ?? '').toLowerCase();
  if (t.startsWith('image/')) return <ImageOutlinedIcon sx={{ fontSize: 16 }} />;
  if (t.startsWith('video/')) return <MovieOutlinedIcon sx={{ fontSize: 16 }} />;
  if (t.startsWith('audio/')) return <AudiotrackOutlinedIcon sx={{ fontSize: 16 }} />;
  if (t.includes('pdf')) return <PictureAsPdfOutlinedIcon sx={{ fontSize: 16 }} />;
  return <InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} />;
}

export function FilerTab({ product }: { product: WorkspaceProductScope }) {
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const query = useWorkspaceFiles(product);
  const items = query.data?.items ?? [];
  const unavailable = query.data?.unavailable ?? [];
  const totalBytes = query.data?.totalBytes ?? 0;
  const loading = query.isPending;
  const error = queryError(query.error, 'Kunne ikke laste filer');

  // Forbruk per modul — svarer på «hva spiser plassen».
  const byModule = useMemo(() => {
    const map = new Map<string, { count: number; bytes: number }>();
    for (const f of items) {
      const key = f.source_module ?? 'ukjent';
      const entry = map.get(key) ?? { count: 0, bytes: 0 };
      entry.count += 1;
      entry.bytes += f.size_bytes;
      map.set(key, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
  }, [items]);

  const visible = useMemo(
    () =>
      moduleFilter === 'all'
        ? items
        : items.filter((f) => (f.source_module ?? 'ukjent') === moduleFilter),
    [items, moduleFilter],
  );

  if (loading) return <PanelLoading />;

  return (
    <Stack spacing={3}>
      {error ? <PanelError message={error} /> : null}
      <UnavailableSources sources={unavailable} />

      {items.length === 0 ? (
        <PanelEmpty
          icon={<InsertDriveFileOutlinedIcon />}
          title="Ingen filer ennå"
          description="Filer du laster opp fra Role Room — selftapes, decks, castingplakater, lyd — indekseres i B2 og vises her med størrelse og opprinnelse."
        />
      ) : (
        <>
          {/* Forbruk */}
          <Box>
            <SectionHeading icon={<StorageOutlinedIcon />} label="Lagringsforbruk" />
            <Stack
              direction="row"
              alignItems="baseline"
              spacing={1}
              sx={{ mb: 1.5 }}
            >
              <Typography sx={{ color: BRAND.text, fontWeight: 800, fontSize: '1.6rem' }}>
                {formatBytes(totalBytes)}
              </Typography>
              <Typography sx={{ color: BRAND.textDim, fontSize: '0.82rem' }}>
                fordelt på {items.length} filer
              </Typography>
            </Stack>

            <Stack spacing={1}>
              {byModule.slice(0, 6).map(([mod, stat]) => {
                const pct = totalBytes > 0 ? (stat.bytes / totalBytes) * 100 : 0;
                return (
                  <Box key={mod}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                      <Typography sx={{ color: BRAND.textMuted, fontSize: '0.78rem' }}>
                        {mod} · {stat.count}
                      </Typography>
                      <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>
                        {formatBytes(stat.bytes)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        height: 5,
                        borderRadius: 3,
                        bgcolor: 'rgba(241, 245, 249, 0.06)',
                        '& .MuiLinearProgress-bar': { bgcolor: BRAND.accent, borderRadius: 3 },
                      }}
                    />
                  </Box>
                );
              })}
            </Stack>
          </Box>

          {/* Fil-liste */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={moduleFilter}
                onChange={(_, v) => {
                  if (v) setModuleFilter(v as string);
                }}
                sx={{
                  flexWrap: 'wrap',
                  '& .MuiToggleButton-root': {
                    color: BRAND.textMuted,
                    borderColor: BRAND.border,
                    fontSize: '0.72rem',
                    py: 0.25,
                    px: 1.25,
                    textTransform: 'none',
                    '&.Mui-selected': { bgcolor: BRAND.selectedBg, color: BRAND.text },
                  },
                }}
              >
                <ToggleButton value="all">Alle</ToggleButton>
                {byModule.slice(0, 5).map(([mod]) => (
                  <ToggleButton key={mod} value={mod}>
                    {mod}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>

            <Stack spacing={0.5}>
              {visible.map((f) => (
                <Stack
                  key={f.id}
                  direction="row"
                  alignItems="center"
                  spacing={1.25}
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: BRAND.panelBg,
                    border: `1px solid ${BRAND.border}`,
                    '&:hover': { borderColor: BRAND.borderHover },
                  }}
                >
                  <Box sx={{ color: BRAND.accent, display: 'flex' }}>{fileIcon(f.content_type)}</Box>
                  <Typography
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      color: BRAND.text,
                      fontSize: '0.84rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={f.display_name}
                  >
                    {f.display_name}
                  </Typography>
                  {f.source_module ? (
                    <Chip
                      label={f.source_module}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.64rem',
                        bgcolor: 'rgba(241, 245, 249, 0.08)',
                        color: BRAND.textDim,
                      }}
                    />
                  ) : null}
                  <Typography
                    sx={{
                      color: BRAND.textMuted,
                      fontSize: '0.76rem',
                      fontVariantNumeric: 'tabular-nums',
                      minWidth: 64,
                      textAlign: 'right',
                    }}
                  >
                    {formatBytes(f.size_bytes)}
                  </Typography>
                  <Typography
                    sx={{ color: BRAND.textDim, fontSize: '0.74rem', whiteSpace: 'nowrap' }}
                  >
                    {formatDateTime(f.uploaded_at)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </>
      )}
    </Stack>
  );
}

export default FilerTab;
