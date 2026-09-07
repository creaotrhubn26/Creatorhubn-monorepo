/**
 * KundeprosjektTab — teamspace-flaten for klientarbeid.
 *
 * Var en EmptyState som pekte videre til Creative Sync Workspace. Den
 * henvisningen var problemet: for å vite om noe ventet på deg måtte du
 * åpne hvert prosjekt for seg. Backend
 * (/api/admin-room/workspace/client-projects) teller nå det som faktisk
 * står og venter — åpne klient-forespørsler og leveranser til
 * klientgodkjenning — per prosjekt.
 *
 * Forskjellen fra Prosjekter-flaten: Prosjekter er inventaret (roller,
 * møter, budsjett). Kundeprosjekt er utestående mot klient.
 */

import { useMemo } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import MarkEmailUnreadOutlinedIcon from '@mui/icons-material/MarkEmailUnreadOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import type { WorkspaceClientProject } from '../../services/adminRoomApi';
import { BRAND } from './brand';
import {
  PanelEmpty,
  PanelError,
  PanelLoading,
  SectionHeading,
  formatDate,
} from './panelKit';
import { queryError, useWorkspaceClientProjects } from './useWorkspaceData';

export function KundeprosjektTab() {
  const query = useWorkspaceClientProjects();
  const items = query.data ?? [];
  const loading = query.isPending;
  const error = queryError(query.error, 'Kunne ikke laste kundeprosjekter');

  // Prosjekter med utestående først — det er hele poenget med flaten.
  const { needsAttention, rest } = useMemo(() => {
    const attention: WorkspaceClientProject[] = [];
    const others: WorkspaceClientProject[] = [];
    for (const p of items) {
      if (p.openClientRequests > 0 || p.awaitingClientReview > 0) attention.push(p);
      else others.push(p);
    }
    attention.sort(
      (a, b) =>
        b.openClientRequests + b.awaitingClientReview -
        (a.openClientRequests + a.awaitingClientReview),
    );
    return { needsAttention: attention, rest: others };
  }, [items]);

  if (loading) return <PanelLoading />;

  const renderProject = (p: WorkspaceClientProject, highlight: boolean) => (
    <Stack
      key={p.id}
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        p: 1.75,
        borderRadius: 2,
        bgcolor: BRAND.panelBg,
        border: `1px solid ${highlight ? 'rgba(251, 191, 36, 0.35)' : BRAND.border}`,
        '&:hover': { borderColor: BRAND.borderHover },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.92rem' }}>
          {p.name}
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ mt: 0.25 }} flexWrap="wrap" useFlexGap>
          <Typography sx={{ color: BRAND.textDim, fontSize: '0.76rem' }}>{p.status}</Typography>
          {p.endDate ? (
            <Typography sx={{ color: BRAND.textDim, fontSize: '0.76rem' }}>
              Sluttdato {formatDate(p.endDate)}
            </Typography>
          ) : null}
          <Typography sx={{ color: BRAND.textDim, fontSize: '0.76rem' }}>
            Endret {formatDate(p.updatedAt)}
          </Typography>
        </Stack>
      </Box>

      {p.openClientRequests > 0 ? (
        <Chip
          icon={<MarkEmailUnreadOutlinedIcon sx={{ fontSize: 13 }} />}
          label={`${p.openClientRequests} forespørsler`}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.7rem',
            fontWeight: 700,
            bgcolor: 'rgba(251, 191, 36, 0.16)',
            color: '#fcd34d',
          }}
        />
      ) : null}

      {p.awaitingClientReview > 0 ? (
        <Chip
          icon={<RateReviewOutlinedIcon sx={{ fontSize: 13 }} />}
          label={`${p.awaitingClientReview} til godkjenning`}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.7rem',
            fontWeight: 700,
            bgcolor: 'rgba(34, 211, 238, 0.16)',
            color: '#67e8f9',
          }}
        />
      ) : null}

      {p.linkPath ? (
        <Chip
          icon={<OpenInNewOutlinedIcon sx={{ fontSize: 13 }} />}
          label="Åpne"
          size="small"
          component="a"
          href={p.linkPath}
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

  return (
    <Stack spacing={3}>
      {error ? <PanelError message={error} /> : null}

      {items.length === 0 ? (
        <PanelEmpty
          icon={<GroupsOutlinedIcon />}
          title="Ingen kundeprosjekter"
          description="Når du har prosjekter med klienter viser denne flaten hva som venter på deg: ubesvarte forespørsler og leveranser som ligger til klientgodkjenning."
        />
      ) : (
        <>
          <Box>
            <SectionHeading
              icon={<MarkEmailUnreadOutlinedIcon />}
              label="Venter på deg"
              count={needsAttention.length}
            />
            {needsAttention.length === 0 ? (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
                <CheckCircleOutlineIcon sx={{ color: '#22c55e', fontSize: 18 }} />
                <Typography sx={{ color: BRAND.textMuted, fontSize: '0.84rem' }}>
                  Ingenting utestående mot klient på tvers av {items.length} prosjekter.
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={1}>{needsAttention.map((p) => renderProject(p, true))}</Stack>
            )}
          </Box>

          {rest.length > 0 ? (
            <Box>
              <SectionHeading icon={<GroupsOutlinedIcon />} label="Øvrige prosjekter" count={rest.length} />
              <Stack spacing={1}>{rest.map((p) => renderProject(p, false))}</Stack>
            </Box>
          ) : null}
        </>
      )}
    </Stack>
  );
}

export default KundeprosjektTab;
