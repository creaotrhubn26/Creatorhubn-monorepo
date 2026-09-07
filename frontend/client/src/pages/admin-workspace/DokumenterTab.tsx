/**
 * DokumenterTab — «Dokumenter»-flaten i AdminWorkspace.
 *
 * Var en EmptyState med TODO-en «koble på vendor_documents + contracts +
 * role_room_briefs til én bibliotek-visning». Backend
 * (/api/admin-room/workspace/documents) unionerer nå tre ekte kilder:
 *
 *   - workspace_participant_documents — kontrakter, samtykker, NDA-er
 *   - role_room_client_materials       — materiell klienten har levert
 *   - legal_documents                  — selskapets juridiske dokumenter
 *
 * Sortert på sist endret, filtrerbart på kategori. Dokumenter som
 * utløper snart løftes fram, siden det er den ene tilstanden som
 * krever handling.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import InventoryOutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';

import {
  workspaceModulesApi,
  type WorkspaceDocument,
  type WorkspaceProductScope,
} from '../../services/adminRoomApi';
import { BRAND } from './brand';
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
  UnavailableSources,
  formatDate,
} from './panelKit';

type SourceFilter = 'all' | WorkspaceDocument['source'];

const SOURCE_FILTERS: Array<{ id: SourceFilter; label: string }> = [
  { id: 'all', label: 'Alle' },
  { id: 'participant_document', label: 'Kontrakter' },
  { id: 'client_material', label: 'Klientmateriell' },
  { id: 'legal_document', label: 'Juridisk' },
];

const SOURCE_ICON: Record<WorkspaceDocument['source'], JSX.Element> = {
  participant_document: <GavelOutlinedIcon sx={{ fontSize: 16 }} />,
  client_material: <InventoryOutlinedIcon sx={{ fontSize: 16 }} />,
  legal_document: <AccountBalanceOutlinedIcon sx={{ fontSize: 16 }} />,
};

const SOURCE_COLOR: Record<WorkspaceDocument['source'], string> = {
  participant_document: BRAND.accent,
  client_material: '#22d3ee',
  legal_document: '#fbbf24',
};

const STATUS_COLOR: Record<string, string> = {
  signed: '#22c55e',
  published: '#22c55e',
  issued: '#fbbf24',
  viewed: '#fbbf24',
  draft: BRAND.textDim,
  declined: '#ef4444',
  withdrawn: '#ef4444',
  expired: '#ef4444',
};

/** Utløper innen 30 dager — den ene tilstanden som krever handling nå. */
function expiringSoon(doc: WorkspaceDocument): boolean {
  if (!doc.expires_at) return false;
  const expires = new Date(doc.expires_at).getTime();
  if (Number.isNaN(expires)) return false;
  const days = (expires - Date.now()) / 86_400_000;
  return days >= 0 && days <= 30;
}

export function DokumenterTab({ product }: { product: WorkspaceProductScope }) {
  const [items, setItems] = useState<WorkspaceDocument[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workspaceModulesApi.documents(product);
      setItems(data.items);
      setUnavailable(data.unavailable ?? []);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke laste dokumenter');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (sourceFilter === 'all' ? items : items.filter((d) => d.source === sourceFilter)),
    [items, sourceFilter],
  );

  const expiring = useMemo(() => items.filter(expiringSoon), [items]);

  if (loading) return <PanelLoading />;

  return (
    <Stack spacing={2}>
      {error ? <PanelError message={error} onClose={() => setError(null)} /> : null}
      <UnavailableSources sources={unavailable} />

      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={sourceFilter}
          onChange={(_, v) => {
            if (v) setSourceFilter(v as SourceFilter);
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
          {SOURCE_FILTERS.map((f) => (
            <ToggleButton key={f.id} value={f.id}>
              {f.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        {expiring.length > 0 ? (
          <Chip
            icon={<WarningAmberOutlinedIcon sx={{ fontSize: 14 }} />}
            label={`${expiring.length} utløper snart`}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.72rem',
              fontWeight: 700,
              bgcolor: 'rgba(251, 191, 36, 0.16)',
              color: '#fcd34d',
            }}
          />
        ) : null}
      </Stack>

      {visible.length === 0 ? (
        <PanelEmpty
          icon={<DescriptionOutlinedIcon />}
          title="Ingen dokumenter"
          description="Kontrakter og samtykker fra prosjekter, materiell klienten har levert, og selskapets juridiske dokumenter samles her etter hvert som de opprettes."
        />
      ) : (
        <Stack spacing={0.75}>
          {visible.map((doc) => {
            const soon = expiringSoon(doc);
            return (
              <Stack
                key={doc.id}
                direction="row"
                alignItems="center"
                spacing={1.25}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: BRAND.panelBg,
                  border: `1px solid ${soon ? 'rgba(251, 191, 36, 0.4)' : BRAND.border}`,
                  borderLeft: `3px solid ${SOURCE_COLOR[doc.source]}`,
                  '&:hover': { borderColor: BRAND.borderHover },
                }}
              >
                <Box sx={{ color: SOURCE_COLOR[doc.source], display: 'flex' }}>
                  {SOURCE_ICON[doc.source]}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography
                      sx={{
                        color: BRAND.text,
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {doc.title}
                    </Typography>
                    {doc.version ? (
                      <Typography sx={{ color: BRAND.textDim, fontSize: '0.72rem' }}>
                        v{doc.version}
                      </Typography>
                    ) : null}
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    {doc.context ? (
                      <Typography
                        sx={{
                          color: BRAND.textDim,
                          fontSize: '0.74rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {doc.context}
                      </Typography>
                    ) : null}
                    {doc.category ? (
                      <Chip
                        label={doc.category}
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: '0.62rem',
                          bgcolor: 'rgba(241, 245, 249, 0.08)',
                          color: BRAND.textDim,
                        }}
                      />
                    ) : null}
                  </Stack>
                </Box>

                {doc.expires_at ? (
                  <Tooltip title={soon ? 'Utløper innen 30 dager' : 'Utløpsdato'}>
                    <Typography
                      sx={{
                        color: soon ? '#fcd34d' : BRAND.textDim,
                        fontSize: '0.74rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(doc.expires_at)}
                    </Typography>
                  </Tooltip>
                ) : (
                  <Typography sx={{ color: BRAND.textDim, fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                    {formatDate(doc.updated_at)}
                  </Typography>
                )}

                <Chip
                  label={doc.status}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.64rem',
                    bgcolor: `${STATUS_COLOR[doc.status] ?? BRAND.textDim}22`,
                    color: STATUS_COLOR[doc.status] ?? BRAND.textMuted,
                  }}
                />

                {doc.external_url ? (
                  <Chip
                    icon={<OpenInNewOutlinedIcon sx={{ fontSize: 13 }} />}
                    label="Åpne"
                    size="small"
                    component="a"
                    href={doc.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      bgcolor: 'rgba(167, 139, 250, 0.16)',
                      color: '#ddd6fe',
                    }}
                  />
                ) : null}
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

export default DokumenterTab;
