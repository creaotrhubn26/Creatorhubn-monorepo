/**
 * ProsjekterTab — «Prosjekter»-flaten i AdminWorkspace.
 *
 * Var en EmptyState med TODO-en «aggregér casting_projects +
 * showcase_galleries + role_room_projects til én feed». Backend
 * (/api/admin-room/workspace/projects) gjør nå det aggregatet og
 * returnerer per prosjekt: antall roller, kommende møter, åpne
 * leveranser og neste frist — altså det som avgjør hva du skal se på
 * først, ikke bare en liste med navn.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';

import {
  workspaceModulesApi,
  type WorkspaceProductScope,
  type WorkspaceProjectSummary,
} from '../../services/adminRoomApi';
import { BRAND } from './brand';
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
  UnavailableSources,
  formatDate,
} from './panelKit';

type StatusFilter = 'active' | 'all' | 'archived';

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'active', label: 'Aktive' },
  { id: 'all', label: 'Alle' },
  { id: 'archived', label: 'Avsluttede' },
];

function isArchived(status: string): boolean {
  return ['archived', 'completed', 'closed', 'done'].includes(status.toLowerCase());
}

export function ProsjekterTab({ product }: { product: WorkspaceProductScope }) {
  const [items, setItems] = useState<WorkspaceProjectSummary[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workspaceModulesApi.projects(product);
      setItems(data.items);
      setUnavailable(data.unavailable ?? []);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke laste prosjekter');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (statusFilter === 'all') return items;
    if (statusFilter === 'archived') return items.filter((p) => isArchived(p.status));
    return items.filter((p) => !isArchived(p.status));
  }, [items, statusFilter]);

  if (loading) return <PanelLoading />;

  return (
    <Stack spacing={2}>
      {error ? <PanelError message={error} onClose={() => setError(null)} /> : null}
      <UnavailableSources sources={unavailable} />

      <Stack direction="row" alignItems="center" spacing={1}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={statusFilter}
          onChange={(_, v) => {
            if (v) setStatusFilter(v as StatusFilter);
          }}
          sx={{
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
          {STATUS_FILTERS.map((f) => (
            <ToggleButton key={f.id} value={f.id}>
              {f.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ color: BRAND.textDim, fontSize: '0.76rem' }}>
          {visible.length} av {items.length}
        </Typography>
      </Stack>

      {product === 'leadgrid' ? (
        <Typography sx={{ color: BRAND.textDim, fontSize: '0.82rem' }}>
          Prosjekter er en Role Room-flate — Leadgrid jobber mot leads og kampanjer.
          Bytt produkt i sidebaren for å se prosjektene.
        </Typography>
      ) : visible.length === 0 ? (
        <PanelEmpty
          icon={<FolderOpenOutlinedIcon />}
          title="Ingen prosjekter her"
          description="Prosjekter kommer fra Role Room. Når du oppretter et casting-prosjekt dukker det opp her med roller, møter og leveranser samlet."
        />
      ) : (
        <Stack spacing={1}>
          {visible.map((p) => (
            <Box
              key={p.id}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: BRAND.panelBg,
                border: `1px solid ${BRAND.border}`,
                '&:hover': { borderColor: BRAND.borderHover },
              }}
            >
              <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                    <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.94rem' }}>
                      {p.name}
                    </Typography>
                    <Chip
                      label={p.status}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.64rem',
                        bgcolor: isArchived(p.status)
                          ? 'rgba(241, 245, 249, 0.08)'
                          : 'rgba(34, 197, 94, 0.16)',
                        color: isArchived(p.status) ? BRAND.textDim : '#86efac',
                      }}
                    />
                    {p.project_type ? (
                      <Chip
                        label={p.project_type}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.64rem',
                          bgcolor: 'rgba(167, 139, 250, 0.14)',
                          color: '#ddd6fe',
                        }}
                      />
                    ) : null}
                  </Stack>

                  {p.description ? (
                    <Typography
                      sx={{
                        color: BRAND.textMuted,
                        fontSize: '0.8rem',
                        mb: 1,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {p.description}
                    </Typography>
                  ) : null}

                  <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" useFlexGap>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <GroupsOutlinedIcon sx={{ fontSize: 14, color: BRAND.textDim }} />
                      <Typography sx={{ color: BRAND.textMuted, fontSize: '0.76rem' }}>
                        {p.role_count} roller
                      </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <VideocamOutlinedIcon sx={{ fontSize: 14, color: BRAND.textDim }} />
                      <Typography sx={{ color: BRAND.textMuted, fontSize: '0.76rem' }}>
                        {p.upcoming_meetings} møter
                      </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <LocalShippingOutlinedIcon sx={{ fontSize: 14, color: BRAND.textDim }} />
                      <Typography
                        sx={{
                          color: p.open_deliverables > 0 ? '#fcd34d' : BRAND.textMuted,
                          fontSize: '0.76rem',
                        }}
                      >
                        {p.open_deliverables} åpne leveranser
                      </Typography>
                    </Stack>
                    {p.next_due_at ? (
                      <Typography sx={{ color: BRAND.textDim, fontSize: '0.76rem' }}>
                        Neste frist {formatDate(p.next_due_at)}
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>

                {p.link_path ? (
                  <Chip
                    icon={<OpenInNewOutlinedIcon sx={{ fontSize: 14 }} />}
                    label="Åpne"
                    size="small"
                    component="a"
                    href={p.link_path}
                    clickable
                    sx={{
                      height: 24,
                      fontSize: '0.72rem',
                      bgcolor: 'rgba(167, 139, 250, 0.16)',
                      color: '#ddd6fe',
                    }}
                  />
                ) : null}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export default ProsjekterTab;
