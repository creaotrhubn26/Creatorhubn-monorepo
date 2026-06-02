/**
 * Admin-ops-paneler — performance/music/reel/grant/invoice/union.
 * Re-bruker EntityCrudPanel der det er ren CRUD; reel og invoice får
 * egne wrappers for spesielle UX-krav (public-share, line-items).
 */

import { danceFlowColors } from './danceFlowTheme';
import React from 'react';
import { Box, Stack, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import { ContentCopy as CopyIcon, Public as PublicIcon, Warning as WarningIcon } from '@mui/icons-material';
import { EntityCrudPanel, type EntityField } from './EntityCrudPanel';
import * as ops from './danceAdminOpsService';
import { MusicWaveformTrack } from './MusicWaveformTrack';

const PURPLE_LIGHT = danceFlowColors.lavender;

export interface AdminPanelProps {
  projectId: string | null;
}

// ─── Performances ──────────────────────────────────────────────────────

const PERFORMANCE_STATUS_META: Record<string, { label: string; color: string }> = {
  planned:       { label: 'Planlagt',     color: danceFlowColors.textMuted },
  rehearsing:    { label: 'Prøver',       color: danceFlowColors.lavender },
  tickets_open:  { label: 'Billettsalg',  color: '#60a5fa' },
  sold_out:      { label: 'Utsolgt',      color: danceFlowColors.successDark },
  completed:     { label: 'Avsluttet',    color: danceFlowColors.successPrimary },
  cancelled:     { label: 'Avlyst',       color: '#ef4444' },
};

interface PerformanceStripboardProps {
  performances: ops.DancePerformance[];
}

const PerformanceStripboard: React.FC<PerformanceStripboardProps> = ({ performances }) => {
  const sorted = React.useMemo(
    () => [...performances].sort(
      (a, b) => new Date(a.performanceDate ?? 0).getTime() - new Date(b.performanceDate ?? 0).getTime(),
    ),
    [performances],
  );
  if (sorted.length === 0) {
    return (
      <Typography
        sx={{ fontSize: 12, color: danceFlowColors.textDisabled, fontStyle: 'italic', textAlign: 'center', py: 6 }}
        data-testid="performance-stripboard-empty"
      >
        Ingen forestillinger lagt til ennå.
      </Typography>
    );
  }
  return (
    <Stack spacing={1} data-testid="performance-stripboard">
      {sorted.map((p) => {
        const meta = PERFORMANCE_STATUS_META[p.status ?? 'planned'] ?? PERFORMANCE_STATUS_META.planned;
        const cap = p.capacity ?? 0;
        const sold = p.ticketsSold ?? 0;
        const fillPct = cap > 0 ? Math.min(100, Math.round((sold / cap) * 100)) : 0;
        return (
          <Box
            key={p.id}
            data-testid={`performance-stripboard-row-${p.id}`}
            sx={{
              p: 1.25,
              borderRadius: 1,
              border: '1px solid #1e2536',
              borderLeft: `4px solid ${meta.color}`,
              bgcolor: danceFlowColors.bgPanel,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr 1fr 0.7fr' },
              gap: 1,
              alignItems: 'center',
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }} noWrap>
                {p.title}
              </Typography>
              {p.venue ? (
                <Typography sx={{ fontSize: 11, color: danceFlowColors.textMuted }} noWrap>{p.venue}</Typography>
              ) : null}
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                size="small"
                label={p.performanceDate ? new Date(p.performanceDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '—'}
                sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(167,139,250,0.18)', color: danceFlowColors.lavenderLight }}
              />
              <Chip
                size="small"
                label={meta.label}
                sx={{ height: 20, fontSize: 10, bgcolor: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}55` }}
              />
            </Stack>
            <Box>
              {cap > 0 ? (
                <>
                  <Typography sx={{ fontSize: 10, color: danceFlowColors.textDisabled, mb: 0.25 }}>
                    {sold} / {cap} billetter ({fillPct}%)
                  </Typography>
                  <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                    <Box sx={{
                      width: `${fillPct}%`,
                      height: '100%',
                      bgcolor: fillPct >= 90 ? danceFlowColors.successDark : fillPct >= 50 ? danceFlowColors.gold : '#60a5fa',
                    }} />
                  </Box>
                </>
              ) : (
                <Typography sx={{ fontSize: 10, color: danceFlowColors.textDisabled, fontStyle: 'italic' }}>
                  Kapasitet ikke satt
                </Typography>
              )}
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              {p.ticketUrl ? (
                <Tooltip title="Åpne billett-URL">
                  <IconButton
                    size="small"
                    onClick={() => window.open(p.ticketUrl ?? '#', '_blank', 'noopener')}
                    sx={{ color: PURPLE_LIGHT }}
                  >
                    <PublicIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
};

export const PerformancesPanel: React.FC<AdminPanelProps> = ({ projectId }) => {
  const [mode, setMode] = React.useState<'table' | 'stripboard'>('stripboard');
  const [performances, setPerformances] = React.useState<ops.DancePerformance[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void ops.listPerformances(projectId).then((list) => {
      if (!cancelled) setPerformances(list);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectId]);

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
    <Box data-testid="admin-ops-performances-shell" sx={{ p: 0 }}>
      <Stack direction="row" spacing={0.5} sx={{ px: 2, pt: 2, pb: 1 }} data-testid="performance-view-toggle">
        {(['stripboard', 'table'] as const).map((m) => (
          <Box
            key={m}
            role="tab"
            tabIndex={0}
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMode(m); } }}
            data-testid={`performance-view-${m}`}
            sx={{
              cursor: 'pointer', px: 1.5, py: 0.5, fontSize: 11, fontWeight: 700, letterSpacing: 1,
              color: mode === m ? '#fff' : 'rgba(229,231,235,0.5)',
              bgcolor: mode === m ? 'rgba(167,139,250,0.22)' : 'transparent',
              border: `1px solid ${mode === m ? danceFlowColors.lavender : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 0.5,
              textTransform: 'uppercase',
            }}
          >
            {m === 'stripboard' ? 'Stripboard' : 'Tabell'}
          </Box>
        ))}
      </Stack>
      {mode === 'stripboard' ? (
        <Box sx={{ px: 2, pb: 2 }}>
          <PerformanceStripboard performances={performances} />
        </Box>
      ) : (
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
      )}
    </Box>
  );
};

// ─── Music archive ─────────────────────────────────────────────────────

interface MusicRowExpansionProps {
  item: ops.DanceMusicArchiveItem;
}

const MusicRowExpansion: React.FC<MusicRowExpansionProps> = ({ item }) => {
  const audioUrl = item.signedUrl;
  const tonoMeta: Record<string, { label: string; color: string }> = {
    cleared: { label: 'Cleared', color: danceFlowColors.successDark },
    pending: { label: 'Venter på TONO', color: danceFlowColors.gold },
    blocked: { label: 'Blokkert', color: '#ef4444' },
    unknown: { label: 'Ukjent', color: danceFlowColors.textMuted },
  };
  const meta = tonoMeta[item.tonoStatus] ?? tonoMeta.unknown;
  return (
    <Box
      data-testid={`music-archive-expansion-${item.id}`}
      sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderTop: '1px solid #1e2536' }}
    >
      <Stack spacing={1.5}>
        {audioUrl ? (
          <Box>
            <Typography sx={{ fontSize: 10, letterSpacing: 1.5, color: danceFlowColors.gold, fontWeight: 700, mb: 0.5 }}>
              WAVEFORM
            </Typography>
            <MusicWaveformTrack musicUrl={audioUrl} />
          </Box>
        ) : item.sourceUrl ? (
          <Typography sx={{ fontSize: 11, color: danceFlowColors.textMuted }}>
            Ekstern lenke: <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>{item.sourceUrl}</a>
            {' · '}<em>Last opp lydfil for waveform-preview</em>
          </Typography>
        ) : (
          <Typography sx={{ fontSize: 11, color: danceFlowColors.textDisabled, fontStyle: 'italic' }}>
            Ingen lydfil eller lenke ennå.
          </Typography>
        )}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={meta.label}
            sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}55` }}
          />
          {item.bpm ? (
            <Chip size="small" label={`${item.bpm} BPM`} sx={{ height: 20, fontSize: 10.5, bgcolor: 'rgba(167,139,250,0.18)', color: danceFlowColors.lavenderLight }} />
          ) : null}
          {item.musicalKey ? (
            <Chip size="small" label={item.musicalKey} sx={{ height: 20, fontSize: 10.5, bgcolor: 'rgba(96,165,250,0.18)', color: '#93c5fd' }} />
          ) : null}
          {item.durationSec ? (
            <Chip
              size="small"
              label={`${Math.floor(item.durationSec / 60)}:${String(Math.round(item.durationSec % 60)).padStart(2, '0')}`}
              sx={{ height: 20, fontSize: 10.5, bgcolor: 'rgba(255,255,255,0.08)', color: danceFlowColors.textSecondary, fontFamily: 'monospace' }}
            />
          ) : null}
          {(item.tags ?? []).map((t) => (
            <Chip key={t} size="small" label={t} sx={{ height: 20, fontSize: 10.5, bgcolor: 'rgba(251,191,36,0.12)', color: danceFlowColors.gold }} />
          ))}
        </Stack>
        {item.notes ? (
          <Typography sx={{ fontSize: 11, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
            {item.notes}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
};

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
          cleared: { label: 'Cleared', color: danceFlowColors.successDark },
          pending: { label: 'Venter', color: danceFlowColors.gold },
          blocked: { label: 'Blokkert', color: '#ef4444' },
          unknown: { label: 'Ukjent', color: danceFlowColors.textMuted },
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
      rowExpansion={(row) => <MusicRowExpansion item={row} />}
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
          color: clip.publicShareToken ? danceFlowColors.successDark : 'rgba(229,231,235,0.6)',
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

// F9-1: norske stipend-templates
const GRANT_TEMPLATES: ReadonlyArray<{
  id: string;
  label: string;
  fundName: string;
  defaults: { title?: string; applicationText?: string };
}> = [
  {
    id: 'kulturradet_fri_scenekunst',
    label: 'Kulturrådet · Fri scenekunst — dans',
    fundName: 'kulturradet',
    defaults: {
      title: 'Fri scenekunst — dans 2026',
      applicationText: 'Prosjektbeskrivelse:\n\nKunstnerisk forankring:\n\nMålgruppe:\n\nBudsjett-oversikt:\n',
    },
  },
  {
    id: 'fond_lyd_bilde',
    label: 'Fond for lyd og bilde',
    fundName: 'fond_lyd_bilde',
    defaults: {
      title: 'Fond for lyd og bilde — produksjon',
      applicationText: 'Produksjonsbeskrivelse:\n\nLeveranseplan:\n\nMedvirkende:\n',
    },
  },
  {
    id: 'skuda_residens',
    label: 'Skuda · Sommer-residens',
    fundName: 'other',
    defaults: { title: 'Skuda sommer-residens', applicationText: 'Residensplan:\n' },
  },
  {
    id: 'kommunal',
    label: 'Kommunalt tilskudd',
    fundName: 'kommunal',
    defaults: { title: 'Kommunalt prosjekttilskudd', applicationText: '' },
  },
];

interface GrantsStatProps {
  list: ops.DanceGrantApplication[];
}

const GrantsStatStrip: React.FC<GrantsStatProps> = ({ list }) => {
  const stats = React.useMemo(() => {
    let drafts = 0, submitted = 0, awarded = 0, rejected = 0;
    let totalAwardedKr = 0;
    for (const g of list) {
      if (g.status === 'draft') drafts += 1;
      else if (g.status === 'submitted' || g.status === 'in_review') submitted += 1;
      else if (g.status === 'awarded') { awarded += 1; totalAwardedKr += g.amountAwardedKr ?? 0; }
      else if (g.status === 'rejected') rejected += 1;
    }
    return { drafts, submitted, awarded, rejected, totalAwardedKr };
  }, [list]);
  const formatNok = (n: number): string =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(n);
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ p: 1.5, pb: 0 }} data-testid="grants-stat-strip">
      <Chip size="small" label={`Utkast: ${stats.drafts}`} sx={{ bgcolor: 'rgba(156,163,175,0.18)', color: danceFlowColors.textMuted }} />
      <Chip size="small" label={`Sendt: ${stats.submitted}`} sx={{ bgcolor: 'rgba(96,165,250,0.18)', color: '#60a5fa' }} />
      <Chip size="small" label={`Innvilget: ${stats.awarded}`} sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: danceFlowColors.successPrimary }} />
      <Chip size="small" label={`Avslått: ${stats.rejected}`} sx={{ bgcolor: 'rgba(239,68,68,0.18)', color: danceFlowColors.errorPrimary }} />
      {stats.totalAwardedKr > 0 ? (
        <Chip
          size="small"
          label={`Tildelt totalt: ${formatNok(stats.totalAwardedKr)}`}
          sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: danceFlowColors.lavenderLight, fontWeight: 700 }}
        />
      ) : null}
    </Stack>
  );
};

export const GrantsPanel: React.FC<AdminPanelProps> = ({ projectId }) => {
  const [grants, setGrants] = React.useState<ops.DanceGrantApplication[]>([]);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    void ops.listGrants(projectId).then((rows) => {
      if (!cancelled) setGrants(rows);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectId, refreshKey]);

  const applyTemplate = async (templateId: string): Promise<void> => {
    const t = GRANT_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    try {
      await ops.createGrant({
        projectId,
        title: t.defaults.title ?? 'Ny søknad',
        fundName: t.fundName,
        status: 'draft',
        applicationText: t.defaults.applicationText ?? null,
      });
      setRefreshKey((k) => k + 1);
    } catch { /* silent */ }
  };

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
    <Box data-testid="admin-ops-grants-shell">
      <GrantsStatStrip list={grants} />
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ p: 1.5, pb: 0 }} data-testid="grants-templates">
        <Typography sx={{ fontSize: 10, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700, alignSelf: 'center', mr: 0.5 }}>
          MAL
        </Typography>
        {GRANT_TEMPLATES.map((t) => (
          <Chip
            key={t.id}
            size="small"
            label={t.label}
            onClick={() => void applyTemplate(t.id)}
            data-testid={`grants-template-${t.id}`}
            sx={{
              height: 22, fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
              bgcolor: 'rgba(167,139,250,0.12)',
              color: danceFlowColors.lavenderLight,
              border: '1px solid rgba(167,139,250,0.35)',
              '&:hover': { bgcolor: 'rgba(167,139,250,0.22)' },
            }}
          />
        ))}
      </Stack>
      <EntityCrudPanel<ops.DanceGrantApplication>
        key={refreshKey}
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
    </Box>
  );
};

// ─── Invoices ──────────────────────────────────────────────────────────

const InvoicesStatStrip: React.FC<{ list: ops.DanceInvoice[] }> = ({ list }) => {
  const stats = React.useMemo(() => {
    let draft = 0, sent = 0, paid = 0, overdue = 0;
    let totalSent = 0, totalPaid = 0, totalOutstanding = 0;
    for (const i of list) {
      const total = (i.amountKr ?? 0) + (i.vatKr ?? 0);
      if (i.status === 'draft') draft += 1;
      else if (i.status === 'sent') { sent += 1; totalSent += total; totalOutstanding += total; }
      else if (i.status === 'paid') { paid += 1; totalPaid += total; }
      else if (i.status === 'overdue') { overdue += 1; totalOutstanding += total; }
    }
    return { draft, sent, paid, overdue, totalSent, totalPaid, totalOutstanding };
  }, [list]);
  const formatNok = (n: number): string =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(n);
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ p: 1.5, pb: 0 }} data-testid="invoices-stat-strip">
      <Chip size="small" label={`Utkast: ${stats.draft}`} sx={{ bgcolor: 'rgba(156,163,175,0.18)', color: danceFlowColors.textMuted }} />
      <Chip size="small" label={`Sendt: ${stats.sent}`} sx={{ bgcolor: 'rgba(96,165,250,0.18)', color: '#60a5fa' }} />
      <Chip size="small" label={`Betalt: ${stats.paid}`} sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: danceFlowColors.successPrimary }} />
      {stats.overdue > 0 ? (
        <Chip
          size="small"
          icon={<WarningIcon sx={{ fontSize: 14 }} />}
          label={`Forfalt: ${stats.overdue}`}
          sx={{ bgcolor: 'rgba(239,68,68,0.22)', color: danceFlowColors.errorSoft, fontWeight: 700, border: '1px solid rgba(239,68,68,0.45)' }}
        />
      ) : null}
      <Chip
        size="small"
        label={`Betalt totalt: ${formatNok(stats.totalPaid)}`}
        sx={{ bgcolor: 'rgba(52,211,153,0.12)', color: '#86efac' }}
      />
      {stats.totalOutstanding > 0 ? (
        <Chip
          size="small"
          label={`Utestående: ${formatNok(stats.totalOutstanding)}`}
          sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: danceFlowColors.gold, fontWeight: 700 }}
        />
      ) : null}
    </Stack>
  );
};

export const InvoicesPanel: React.FC<AdminPanelProps> = ({ projectId }) => {
  const [invoices, setInvoices] = React.useState<ops.DanceInvoice[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    void ops.listInvoices(projectId).then((rows) => {
      if (!cancelled) setInvoices(rows);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectId]);
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
    <Box data-testid="admin-ops-invoices-shell">
      <InvoicesStatStrip list={invoices} />
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
    </Box>
  );
};

// ─── Union ─────────────────────────────────────────────────────────────

const UnionWorkDaysStrip: React.FC<{ memberships: ops.DanceUnionMembership[] }> = ({ memberships }) => {
  const stats = React.useMemo(() => {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const quarters: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    let totalThisYear = 0;
    for (const m of memberships) {
      for (const d of (m.workDays ?? []) as ops.UnionWorkDay[]) {
        if (!d.ymd.startsWith(yyyy)) continue;
        totalThisYear += 1;
        const mm = parseInt(d.ymd.slice(5, 7), 10);
        const q = mm <= 3 ? 'Q1' : mm <= 6 ? 'Q2' : mm <= 9 ? 'Q3' : 'Q4';
        quarters[q] += 1;
      }
    }
    return { totalThisYear, quarters };
  }, [memberships]);
  const max = Math.max(1, ...Object.values(stats.quarters));
  return (
    <Box data-testid="union-workdays-strip" sx={{ p: 1.5, pb: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 10, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700 }}>
          ARBEIDSDAGER {new Date().getFullYear()}
        </Typography>
        <Chip
          size="small"
          label={`${stats.totalThisYear} dager`}
          sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: 'rgba(167,139,250,0.18)', color: danceFlowColors.lavenderLight }}
        />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => {
          const count = stats.quarters[q];
          const pct = (count / max) * 100;
          return (
            <Box key={q} sx={{ flex: 1 }} data-testid={`union-quarter-${q}`}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                <Typography sx={{ fontSize: 9.5, color: danceFlowColors.textMuted, fontWeight: 700 }}>{q}</Typography>
                <Typography sx={{ fontSize: 10, color: danceFlowColors.textSecondary }}>{count}</Typography>
              </Stack>
              <Box sx={{ height: 4, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: danceFlowColors.lavender }} />
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

export const UnionPanel: React.FC<{ projectId: string | null }> = () => {
  const [memberships, setMemberships] = React.useState<ops.DanceUnionMembership[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    void ops.listUnion().then((rows) => {
      if (!cancelled) setMemberships(rows);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
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
    <Box data-testid="admin-ops-union-shell">
      <UnionWorkDaysStrip memberships={memberships} />
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
    </Box>
  );
};

export default {
  PerformancesPanel, MusicArchivePanel, ReelPanel, GrantsPanel, InvoicesPanel, UnionPanel,
};
