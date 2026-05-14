/**
 * Admin-ops-paneler — performance/music/reel/grant/invoice/union.
 * Re-bruker EntityCrudPanel der det er ren CRUD; reel og invoice får
 * egne wrappers for spesielle UX-krav (public-share, line-items).
 */

import React from 'react';
import { Box, Stack, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import { ContentCopy as CopyIcon, Public as PublicIcon } from '@mui/icons-material';
import { EntityCrudPanel, type EntityField } from './EntityCrudPanel';
import * as ops from './danceAdminOpsService';

const PURPLE_LIGHT = '#a78bfa';

export interface AdminPanelProps {
  projectId: string | null;
}

// ─── Performances ──────────────────────────────────────────────────────

export const PerformancesPanel: React.FC<AdminPanelProps> = ({ projectId }) => {
  const fields: EntityField[] = [
    { key: 'title', label: 'Tittel', type: { kind: 'text', required: true } },
    { key: 'performanceDate', label: 'Forestillingsdato', type: { kind: 'datetime' } },
    { key: 'venue', label: 'Sted', type: { kind: 'text' } },
    {
      key: 'status', label: 'Status', type: {
        kind: 'select', options: [
          { value: 'planned', label: 'Planlagt' },
          { value: 'rehearsing', label: 'Prøver' },
          { value: 'tickets_open', label: 'Billettsalg' },
          { value: 'sold_out', label: 'Utsolgt' },
          { value: 'completed', label: 'Avsluttet' },
          { value: 'cancelled', label: 'Avlyst' },
        ],
      },
    },
    { key: 'capacity', label: 'Kapasitet', type: { kind: 'number', min: 0 } },
    { key: 'ticketsSold', label: 'Solgte billetter', type: { kind: 'number', min: 0 } },
    { key: 'ticketUrl', label: 'Billett-URL', type: { kind: 'text', placeholder: 'https://…' } },
    { key: 'notes', label: 'Notater', type: { kind: 'text', multiline: true } },
  ];
  return (
    <EntityCrudPanel<ops.DancePerformance>
      title="Forestillinger"
      description="Forestillings-kalender med status, billettsalg og program."
      fields={fields}
      primaryField="title"
      searchableFields={['title', 'venue']}
      list={() => ops.listPerformances(projectId)}
      create={(input) => ops.createPerformance({
        ...input,
        projectId,
        title: input.title ?? 'Ny forestilling',
        performanceDate: input.performanceDate ?? new Date().toISOString(),
      })}
      patch={ops.patchPerformance}
      remove={ops.deletePerformance}
      newDefaults={{ status: 'planned', ticketsSold: 0 }}
      emptyText="Ingen forestillinger lagt til ennå."
      panelTestId="admin-ops-performances"
    />
  );
};

// ─── Music archive ─────────────────────────────────────────────────────

export const MusicArchivePanel: React.FC<AdminPanelProps> = ({ projectId }) => {
  const fields: EntityField[] = [
    { key: 'title', label: 'Tittel', type: { kind: 'text', required: true } },
    { key: 'composer', label: 'Komponist', type: { kind: 'text' } },
    { key: 'bpm', label: 'BPM', type: { kind: 'number', min: 20, max: 400 } },
    { key: 'musicalKey', label: 'Toneart', type: { kind: 'text', placeholder: 'G dur' } },
    { key: 'durationSec', label: 'Varighet (s)', type: { kind: 'number', min: 0 } },
    {
      key: 'tonoStatus', label: 'TONO-status', type: {
        kind: 'select', options: [
          { value: 'cleared', label: 'Cleared' },
          { value: 'pending', label: 'Venter' },
          { value: 'blocked', label: 'Blokkert' },
          { value: 'unknown', label: 'Ukjent' },
        ],
      },
      renderInList: (value) => {
        const v = value as ops.TonoStatus;
        const map = {
          cleared: { label: 'Cleared', color: '#10b981' },
          pending: { label: 'Venter', color: '#fbbf24' },
          blocked: { label: 'Blokkert', color: '#ef4444' },
          unknown: { label: 'Ukjent', color: '#9ca3af' },
        };
        return <Box component="span" sx={{ color: map[v].color, fontWeight: 700 }}>{map[v].label}</Box>;
      },
    },
    { key: 'tonoReference', label: 'TONO-ref', type: { kind: 'text' } },
    { key: 'sourceUrl', label: 'Lenke', type: { kind: 'text', placeholder: 'Spotify/SoundCloud' } },
    { key: 'tags', label: 'Tags', type: { kind: 'string-array', placeholder: 'energi, instrumental' } },
    { key: 'notes', label: 'Notater', type: { kind: 'text', multiline: true } },
  ];
  return (
    <EntityCrudPanel<ops.DanceMusicArchiveItem>
      title="Musikk-arkiv"
      description="Bibliotek av musikkstykker for koreografier — BPM-tagging og TONO-clearing-status."
      fields={fields}
      primaryField="title"
      searchableFields={['title', 'composer']}
      list={() => ops.listMusicArchive(projectId)}
      create={(input) => ops.createMusicArchive({ ...input, projectId, title: input.title ?? 'Nytt stykke' })}
      patch={ops.patchMusicArchive}
      remove={ops.deleteMusicArchive}
      newDefaults={{ tonoStatus: 'unknown' }}
      emptyText="Ingen musikk i arkivet ennå."
      panelTestId="admin-ops-music"
    />
  );
};

// ─── Reel ──────────────────────────────────────────────────────────────

export const ReelPanel: React.FC<AdminPanelProps> = ({ projectId }) => {
  const [refreshKey, setRefreshKey] = React.useState(0);

  const fields: EntityField[] = [
    { key: 'title', label: 'Tittel', type: { kind: 'text', required: true } },
    { key: 'sourceUrl', label: 'Vimeo/YouTube/URL', type: { kind: 'text', placeholder: 'https://vimeo.com/...' } },
    { key: 'thumbnailUrl', label: 'Thumbnail-URL', type: { kind: 'text' } },
    { key: 'durationSec', label: 'Varighet (s)', type: { kind: 'number', min: 0 } },
    { key: 'tags', label: 'Stiler/ferdigheter', type: { kind: 'string-array', placeholder: 'kontemporær, lift, turn' } },
    { key: 'featureOrder', label: 'Sorterings-tall (høyere = topp)', type: { kind: 'number', min: 0, max: 1000 } },
    { key: 'recordedAt', label: 'Tatt opp', type: { kind: 'datetime' } },
    { key: 'notes', label: 'Notater', type: { kind: 'text', multiline: true } },
  ];

  const togglePublic = async (clip: ops.DanceReelClip): Promise<void> => {
    const nextEnabled = !clip.publicShareToken;
    await ops.patchReel(clip.id, { publicShareEnabled: nextEnabled });
    setRefreshKey((k) => k + 1);
  };

  return (
    <Box>
      <EntityCrudPanel<ops.DanceReelClip>
        key={refreshKey}
        title="Reel-portefølje"
        description="Klipp som ligger i porteføljen din. Public share-toggle gir en delbar URL som casting-team kan se uten konto."
        fields={fields}
        primaryField="title"
        searchableFields={['title', 'tags']}
        list={() => ops.listReel(projectId)}
        create={(input) => ops.createReel({ ...input, projectId, title: input.title ?? 'Nytt klipp' })}
        patch={ops.patchReel}
        remove={ops.deleteReel}
        newDefaults={{ tags: [], featureOrder: 0 }}
        emptyText="Ingen klipp i porteføljen ennå."
        panelTestId="admin-ops-reel"
        rowExpansion={(clip) => <ReelShareControls clip={clip} onToggle={() => void togglePublic(clip)} />}
      />
    </Box>
  );
};

const ReelShareControls: React.FC<{ clip: ops.DanceReelClip; onToggle: () => void }> = ({ clip, onToggle }) => {
  const shareUrl = clip.publicShareToken
    ? `${window.location.origin}/reel/public/${clip.publicShareToken}`
    : null;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip
        size="small"
        icon={<PublicIcon sx={{ fontSize: 14 }} />}
        label={clip.publicShareToken ? 'Public share PÅ' : 'Public share AV'}
        onClick={onToggle}
        sx={{
          height: 24, fontSize: 11, cursor: 'pointer',
          bgcolor: clip.publicShareToken ? 'rgba(16,185,129,0.18)' : 'rgba(229,231,235,0.08)',
          color: clip.publicShareToken ? '#10b981' : 'rgba(229,231,235,0.6)',
          fontWeight: 700,
        }}
      />
      {shareUrl ? (
        <>
          <Typography sx={{ fontSize: 11, color: 'rgba(229,231,235,0.7)', flex: 1, fontFamily: 'monospace' }}>
            {shareUrl}
          </Typography>
          <Tooltip title="Kopier delings-URL">
            <IconButton
              size="small"
              onClick={() => { void navigator.clipboard.writeText(shareUrl); }}
              sx={{ color: PURPLE_LIGHT }}
            >
              <CopyIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </>
      ) : (
        <Typography sx={{ fontSize: 11, color: 'rgba(229,231,235,0.5)', fontStyle: 'italic' }}>
          Aktiver public share for å få en delbar URL.
        </Typography>
      )}
    </Stack>
  );
};

// ─── Grants ────────────────────────────────────────────────────────────

export const GrantsPanel: React.FC<AdminPanelProps> = ({ projectId }) => {
  const fields: EntityField[] = [
    { key: 'title', label: 'Tittel', type: { kind: 'text', required: true } },
    {
      key: 'fundName', label: 'Fond', type: {
        kind: 'select', options: [
          { value: 'kulturradet', label: 'Kulturrådet' },
          { value: 'fond_lyd_bilde', label: 'Fond for lyd og bilde' },
          { value: 'kommunal', label: 'Kommunal' },
          { value: 'fylke', label: 'Fylkeskommunal' },
          { value: 'private', label: 'Privat' },
          { value: 'other', label: 'Annet' },
        ],
      },
    },
    { key: 'amountRequestedKr', label: 'Søkt sum (kr)', type: { kind: 'number', min: 0 } },
    { key: 'amountAwardedKr', label: 'Tildelt sum (kr)', type: { kind: 'number', min: 0 } },
    {
      key: 'status', label: 'Status', type: {
        kind: 'select', options: [
          { value: 'draft', label: 'Utkast' },
          { value: 'submitted', label: 'Sendt' },
          { value: 'in_review', label: 'Til vurdering' },
          { value: 'awarded', label: 'Tildelt' },
          { value: 'rejected', label: 'Avslått' },
          { value: 'withdrawn', label: 'Trukket' },
        ],
      },
    },
    { key: 'deadline', label: 'Søknadsfrist', type: { kind: 'datetime' } },
    { key: 'submittedAt', label: 'Sendt-dato', type: { kind: 'datetime' } },
    { key: 'decidedAt', label: 'Vedtaks-dato', type: { kind: 'datetime' } },
    { key: 'applicationText', label: 'Søknadstekst', type: { kind: 'text', multiline: true } },
    { key: 'notes', label: 'Notater', type: { kind: 'text', multiline: true } },
    { key: 'attachments', label: 'Vedlegg-URLer', type: { kind: 'string-array' } },
  ];
  return (
    <EntityCrudPanel<ops.DanceGrantApplication>
      title="Tilskudd"
      description="Søknader til Kulturrådet, Fond for lyd og bilde, kommunale midler. Følg statusen fra utkast til vedtak."
      fields={fields}
      primaryField="title"
      searchableFields={['title', 'fundName']}
      list={() => ops.listGrants(projectId)}
      create={(input) => ops.createGrant({ ...input, projectId, title: input.title ?? 'Ny søknad' })}
      patch={ops.patchGrant}
      remove={ops.deleteGrant}
      newDefaults={{ status: 'draft', fundName: 'kulturradet', attachments: [] }}
      emptyText="Ingen søknader registrert ennå."
      panelTestId="admin-ops-grants"
    />
  );
};

// ─── Invoices ──────────────────────────────────────────────────────────

export const InvoicesPanel: React.FC<AdminPanelProps> = ({ projectId }) => {
  const fields: EntityField[] = [
    { key: 'customerName', label: 'Kundenavn', type: { kind: 'text', required: true } },
    { key: 'invoiceNumber', label: 'Fakturanr', type: { kind: 'text' } },
    { key: 'amountKr', label: 'Beløp (kr)', type: { kind: 'number', min: 0 } },
    { key: 'vatKr', label: 'MVA (kr)', type: { kind: 'number', min: 0 } },
    {
      key: 'status', label: 'Status', type: {
        kind: 'select', options: [
          { value: 'draft', label: 'Utkast' },
          { value: 'sent', label: 'Sendt' },
          { value: 'paid', label: 'Betalt' },
          { value: 'overdue', label: 'Forfalt' },
          { value: 'void', label: 'Annullert' },
        ],
      },
    },
    {
      key: 'deliveryMethod', label: 'Leveringsmetode', type: {
        kind: 'select', options: [
          { value: 'manual', label: 'Manuell' },
          { value: 'ehf', label: 'EHF' },
          { value: 'kid', label: 'KID-betaling' },
        ],
      },
    },
    { key: 'kidNumber', label: 'KID-nummer', type: { kind: 'text' } },
    { key: 'customerOrgNo', label: 'Org.nr.', type: { kind: 'text' } },
    { key: 'customerEmail', label: 'E-post', type: { kind: 'text' } },
    { key: 'customerAddress', label: 'Adresse', type: { kind: 'text', multiline: true } },
    { key: 'issueDate', label: 'Utstedt', type: { kind: 'datetime' } },
    { key: 'dueDate', label: 'Forfall', type: { kind: 'datetime' } },
    { key: 'paidAt', label: 'Betalt', type: { kind: 'datetime' } },
    { key: 'notes', label: 'Notater', type: { kind: 'text', multiline: true } },
  ];
  return (
    <EntityCrudPanel<ops.DanceInvoice>
      title="Fakturering (kunde)"
      description="Manuelle fakturaer mot kunder (kommune-avtaler, leie-betalinger osv). Stripe-abonnement til CreatorHub er separat — se betalings-panelet."
      fields={fields}
      primaryField="customerName"
      searchableFields={['customerName', 'invoiceNumber', 'customerOrgNo']}
      list={() => ops.listInvoices(projectId)}
      create={(input) => ops.createInvoice({ ...input, projectId, customerName: input.customerName ?? 'Ny kunde' })}
      patch={ops.patchInvoice}
      remove={ops.deleteInvoice}
      newDefaults={{ status: 'draft', deliveryMethod: 'manual', amountKr: 0, vatKr: 0 }}
      emptyText="Ingen fakturaer ennå."
      panelTestId="admin-ops-invoices"
    />
  );
};

// ─── Union ─────────────────────────────────────────────────────────────

export const UnionPanel: React.FC<{ projectId: string | null }> = () => {
  const fields: EntityField[] = [
    {
      key: 'organization', label: 'Organisasjon', type: {
        kind: 'select', options: [
          { value: 'skuda', label: 'Skuda' },
          { value: 'noda', label: 'NoDa' },
          { value: 'sko', label: 'Sko' },
          { value: 'other', label: 'Annet' },
        ],
      },
    },
    { key: 'memberId', label: 'Medlemsnummer', type: { kind: 'text' } },
    {
      key: 'status', label: 'Status', type: {
        kind: 'select', options: [
          { value: 'active', label: 'Aktiv' },
          { value: 'pending', label: 'Venter' },
          { value: 'inactive', label: 'Inaktiv' },
          { value: 'suspended', label: 'Suspendert' },
        ],
      },
    },
    { key: 'joinedAt', label: 'Innmeldt', type: { kind: 'datetime' } },
    { key: 'notes', label: 'Notater', type: { kind: 'text', multiline: true } },
    {
      key: 'workDays', label: 'Loggførte dager (i år)', type: { kind: 'text' }, listOnly: true,
      renderInList: (value) => {
        if (!Array.isArray(value)) return null;
        const yyyy = String(new Date().getFullYear());
        const total = (value as ops.UnionWorkDay[]).filter((d) => d.ymd.startsWith(yyyy)).length;
        return `${total} dager`;
      },
    },
  ];
  return (
    <EntityCrudPanel<ops.DanceUnionMembership>
      title="Forbund"
      description="Skuda/NoDa/Sko-medlemstatus. Loggfør arbeidsdager for tariff-statistikk og sykepenge-grunnlag."
      fields={fields}
      primaryField="organization"
      searchableFields={['memberId']}
      list={ops.listUnion}
      create={(input) => ops.createUnion(input)}
      patch={ops.patchUnion}
      remove={ops.deleteUnion}
      newDefaults={{ organization: 'skuda', status: 'active' }}
      emptyText="Ingen forbund-medlemskap registrert ennå."
      panelTestId="admin-ops-union"
    />
  );
};

export default {
  PerformancesPanel, MusicArchivePanel, ReelPanel, GrantsPanel, InvoicesPanel, UnionPanel,
};
