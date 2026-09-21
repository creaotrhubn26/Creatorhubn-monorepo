import { useEffect, useMemo, useState } from 'react';
import {
  AddTaskOutlined as AddIcon,
  ArrowBack as FullWorkspaceIcon,
  AssignmentTurnedInOutlined as AcceptedIcon,
  FactCheckOutlined as QcIcon,
  HistoryOutlined as ActivityIcon,
  Inventory2Outlined as TurnoverIcon,
  MovieOutlined as PictureIcon,
  RefreshOutlined as RefreshIcon,
  SendOutlined as SendIcon,
  WarningAmberOutlined as WarningIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type {
  CastingProject,
  PostPictureSourceCatalog,
  PostProductionRecord,
  PostQcSeverity,
  PostTurnoverManifest,
  ProductionSoundMedia,
} from '../../models/casting';
import { MOBILE_TOUCH_TARGET_SIZE, TOUCH_TARGET_SIZE, focusVisibleStyles } from '../../constants/accessibility';
import { PostProductionConflictError, postProductionService, type PostProductionCommand } from '../../services/postProductionService';
import { productionSoundService } from '../../services/productionSoundService';
import { roleTokens } from '../../theme/roleTokens';
import { useScreenTier } from '../production/useScreenTier';
import {
  POST_PRODUCTION_SURFACES,
  POST_TURNOVER_STATUS_LABELS,
  buildPostProductionBrief,
  nextTurnoverAction,
  productionDayLabel,
  type PostProductionSurface,
} from './postProductionWorkspaceModel';

interface Props {
  project: CastingProject;
  activeSurface: PostProductionSurface;
  canPrepare: boolean;
  canReview: boolean;
  dataLoading?: boolean;
  onNavigate: (surface: PostProductionSurface) => void;
  onOpenProductionSound: () => void;
  onOpenSchedule: () => void;
  onOpenFullWorkspace: () => void;
}

const surfaceMeta: Record<PostProductionSurface, { label: string; icon: typeof TurnoverIcon }> = {
  overview: { label: 'Oversikt', icon: AcceptedIcon },
  turnovers: { label: 'Turnovers', icon: TurnoverIcon },
  qc: { label: 'QC', icon: QcIcon },
  activity: { label: 'Historikk', icon: ActivityIcon },
};

const statusColor: Record<PostTurnoverManifest['status'], string> = {
  draft: '#94a3b8',
  ready: '#38bdf8',
  received: '#a78bfa',
  qc_issues: '#f59e0b',
  accepted: '#22c55e',
  superseded: '#64748b',
};

const panelSx = {
  bgcolor: 'rgba(8,13,24,.92)',
  border: '1px solid rgba(129,140,248,.18)',
  borderRadius: 2.5,
  color: roleTokens.text,
};

const fieldSx = {
  '& .MuiInputBase-root': { color: roleTokens.text, bgcolor: 'rgba(255,255,255,.025)', minHeight: TOUCH_TARGET_SIZE },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,.68)' },
  '& fieldset': { borderColor: 'rgba(129,140,248,.24)' },
};

type TurnoverSourceKind = 'production_sound' | 'picture';

const emptyPictureCatalog: PostPictureSourceCatalog = {
  binding: { status: 'unlinked' },
  versions: [],
};

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : value;
}

function formatBytes(value: number): string {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

export function PostProductionWorkspace({
  project,
  activeSurface,
  canPrepare,
  canReview,
  dataLoading = false,
  onNavigate,
  onOpenProductionSound,
  onOpenSchedule,
  onOpenFullWorkspace,
}: Props) {
  const { isMobile } = useScreenTier();
  const targetSize = isMobile ? MOBILE_TOUCH_TARGET_SIZE : TOUCH_TARGET_SIZE;
  const days = useMemo(() => [...(project.productionDays ?? [])]
    .sort((left, right) => String(left.date ?? '').localeCompare(String(right.date ?? ''))), [project.productionDays]);
  const [record, setRecord] = useState<PostProductionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id ?? '');
  const [sourceKind, setSourceKind] = useState<TurnoverSourceKind>('production_sound');
  const [media, setMedia] = useState<ProductionSoundMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [pictureCatalog, setPictureCatalog] = useState<PostPictureSourceCatalog>(emptyPictureCatalog);
  const [pictureLoading, setPictureLoading] = useState(false);
  const [selectedPictureVersionId, setSelectedPictureVersionId] = useState('');
  const [label, setLabel] = useState('');
  const [recipient, setRecipient] = useState('Post Sound');
  const [notes, setNotes] = useState('');
  const [qcDraft, setQcDraft] = useState<Record<string, { severity: PostQcSeverity; message: string }>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    postProductionService.get(project.id)
      .then((next) => { if (active) setRecord(next); })
      .catch((error) => {
        if (active) setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke hente post-produksjonsgrunnlaget.' });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [project.id]);

  useEffect(() => {
    if (!canPrepare) return undefined;
    let active = true;
    setPictureLoading(true);
    postProductionService.getPictureSources(project.id)
      .then((catalog) => {
        if (!active) return;
        setPictureCatalog(catalog);
        setSelectedPictureVersionId((current) => (
          catalog.versions.some((version) => version.id === current)
            ? current
            : catalog.versions[0]?.id ?? ''
        ));
      })
      .catch((error) => {
        if (active) setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke hente picture-kilder.' });
      })
      .finally(() => { if (active) setPictureLoading(false); });
    return () => { active = false; };
  }, [canPrepare, project.id]);

  useEffect(() => {
    if (sourceKind !== 'production_sound') return undefined;
    if (!selectedDayId) {
      setMedia([]);
      setSelectedMediaIds([]);
      return undefined;
    }
    let active = true;
    setMediaLoading(true);
    productionSoundService.listMedia(project.id, selectedDayId)
      .then((items) => {
        if (!active) return;
        setMedia(items);
        setSelectedMediaIds(items.map((item) => item.id));
        if (!label.trim()) setLabel(`${productionDayLabel(project, selectedDayId)} · Production Sound`);
      })
      .catch((error) => {
        if (active) setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke hente recorderfiler.' });
      })
      .finally(() => { if (active) setMediaLoading(false); });
    return () => { active = false; };
  // Label should only be seeded when the day changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, selectedDayId, sourceKind]);

  useEffect(() => {
    if (sourceKind !== 'picture') return;
    const selected = pictureCatalog.versions.find((version) => version.id === selectedPictureVersionId);
    if (!selected) return;
    setLabel(`${selected.versionLabel} · Picture`);
  }, [pictureCatalog.versions, selectedPictureVersionId, sourceKind]);

  const brief = useMemo(() => buildPostProductionBrief(record), [record]);
  const turnovers = record?.operations.turnovers ?? [];

  const run = async (command: PostProductionCommand, success: string) => {
    if (!record || busy) return false;
    setBusy(true);
    setFeedback(null);
    try {
      const next = await postProductionService.command(project.id, record.version, command);
      setRecord(next);
      setFeedback({ type: 'success', text: success });
      return true;
    } catch (error) {
      if (error instanceof PostProductionConflictError && error.postProduction) {
        setRecord(error.postProduction);
        setFeedback({ type: 'warning', text: `${error.message} Nyeste versjon er lastet inn; kontroller før du prøver igjen.` });
      } else {
        setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Handlingen mislyktes.' });
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createTurnover = async () => {
    if (!canPrepare || !label.trim()) return;
    const command: PostProductionCommand = sourceKind === 'picture'
      ? {
          type: 'create_picture_turnover',
          label: label.trim(),
          recipient: recipient.trim() || undefined,
          notes: notes.trim() || undefined,
          pictureVersionId: selectedPictureVersionId,
        }
      : {
          type: 'create_turnover',
          label: label.trim(),
          recipient: recipient.trim() || undefined,
          notes: notes.trim() || undefined,
          productionDayId: selectedDayId,
          mediaIds: selectedMediaIds,
        };
    const sourceReady = sourceKind === 'picture'
      ? Boolean(selectedPictureVersionId)
      : Boolean(selectedDayId && selectedMediaIds.length > 0);
    if (!sourceReady) return;
    const saved = await run(command, 'Turnover-manifestet er opprettet som et sporbart utkast.');
    if (saved) setNotes('');
  };

  const turnoverCard = (turnover: PostTurnoverManifest, includeQc = false) => {
    const action = nextTurnoverAction(turnover);
    const canRunAction = action?.authority === 'prepare' ? canPrepare : canReview;
    const draft = qcDraft[turnover.id] ?? { severity: 'warning' as const, message: '' };
    const openIssues = turnover.issues.filter((issue) => issue.status === 'open');
    return (
      <Card key={turnover.id} data-testid={`post-turnover-${turnover.id}`} variant="outlined" sx={panelSx}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                <Typography sx={{ color: '#f8fafc', fontWeight: 800, overflowWrap: 'anywhere' }}>{turnover.label}</Typography>
                <Chip
                  size="small"
                  icon={turnover.source.sourceType === 'picture' ? <PictureIcon /> : <TurnoverIcon />}
                  label={turnover.source.sourceType === 'picture' ? 'Picture' : 'Opptakslyd'}
                  variant="outlined"
                  sx={{ color: '#c4b5fd', borderColor: 'rgba(167,139,250,.38)' }}
                />
                <Chip size="small" label={POST_TURNOVER_STATUS_LABELS[turnover.status]} sx={{ color: statusColor[turnover.status], border: `1px solid ${statusColor[turnover.status]}66`, bgcolor: `${statusColor[turnover.status]}14` }} />
                {turnover.impact.stale ? <Chip size="small" icon={<WarningIcon />} label="Kilden er endret" color="warning" variant="outlined" /> : null}
              </Stack>
              <Typography sx={{ mt: .7, color: 'rgba(226,232,240,.68)', fontSize: '.82rem' }}>
                {turnover.source.sourceType === 'picture'
                  ? `${turnover.source.versionLabel} · V${turnover.source.versionNumber} · ${turnover.source.displayName}`
                  : `${productionDayLabel(project, turnover.source.productionDayId)} · ${turnover.source.media.length} filer · versjon ${turnover.source.soundVersion}`}
                {turnover.recipient ? ` · ${turnover.recipient}` : ''}
              </Typography>
              {turnover.notes ? <Typography sx={{ mt: .75, color: 'rgba(226,232,240,.78)', fontSize: '.86rem' }}>{turnover.notes}</Typography> : null}
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ flexShrink: 0 }}>
              {turnover.impact.stale && canPrepare && turnover.status !== 'superseded' ? (
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  disabled={busy}
                  onClick={() => void run({ type: 'refresh_turnover', turnoverId: turnover.id }, 'Manifestet er oppdatert mot gjeldende kildegrunnlag.')}
                  sx={{ minHeight: targetSize, ...focusVisibleStyles }}
                >Oppdater kilde</Button>
              ) : null}
              {action && canRunAction ? (
                <Button
                  variant="contained"
                  startIcon={action.status === 'ready' ? <SendIcon /> : <AcceptedIcon />}
                  disabled={busy || turnover.impact.stale}
                  onClick={() => void run({ type: 'transition_turnover', turnoverId: turnover.id, status: action.status }, `${action.label} er registrert.`)}
                  sx={{ minHeight: targetSize, bgcolor: '#6366f1', ...focusVisibleStyles }}
                >{action.label}</Button>
              ) : null}
              {turnover.status !== 'superseded' && (canPrepare || canReview) ? (
                <Button
                  variant="text"
                  disabled={busy}
                  onClick={() => void run({ type: 'transition_turnover', turnoverId: turnover.id, status: 'superseded' }, 'Manifestet er markert som erstattet. Historikken er bevart.')}
                  sx={{ minHeight: targetSize, color: '#94a3b8', ...focusVisibleStyles }}
                >Marker erstattet</Button>
              ) : null}
            </Stack>
          </Stack>

          {turnover.impact.items.length > 0 ? (
            <Alert severity={turnover.impact.blocking ? 'error' : 'warning'} sx={{ mt: 1.5 }}>
              {turnover.impact.items.map((item) => <Box key={`${item.code}-${item.mediaId ?? ''}`}>{item.message}</Box>)}
            </Alert>
          ) : null}

          <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', xl: 'repeat(3,minmax(0,1fr))' }, gap: 1 }}>
            {turnover.source.sourceType === 'picture' ? (
              <Box sx={{ p: 1.1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.025)', border: '1px solid rgba(148,163,184,.14)', minWidth: 0 }}>
                <Typography sx={{ color: '#e2e8f0', fontSize: '.8rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{turnover.source.displayName}</Typography>
                <Typography sx={{ color: 'rgba(226,232,240,.55)', fontSize: '.72rem' }}>
                  {formatBytes(turnover.source.sizeBytes)} · {turnover.source.contentType || 'video'}
                  {turnover.source.durationSeconds !== undefined ? ` · ${Math.round(turnover.source.durationSeconds)} sek` : ''}
                </Typography>
              </Box>
            ) : turnover.source.media.map((item) => (
              <Box key={item.mediaId} sx={{ p: 1.1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.025)', border: '1px solid rgba(148,163,184,.14)', minWidth: 0 }}>
                <Typography sx={{ color: '#e2e8f0', fontSize: '.8rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.displayName}</Typography>
                <Typography sx={{ color: 'rgba(226,232,240,.55)', fontSize: '.72rem' }}>
                  {formatBytes(item.sizeBytes)} · {item.reconciliationStatus === 'matched' ? 'take-koblet' : 'ikke take-koblet'}
                </Typography>
              </Box>
            ))}
          </Box>

          {includeQc ? (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(148,163,184,.14)' }}>
              <Stack gap={1}>
                {turnover.issues.map((issue) => (
                  <Stack key={issue.id} direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ p: 1.2, borderRadius: 1.5, bgcolor: issue.status === 'open' ? 'rgba(245,158,11,.08)' : 'rgba(34,197,94,.06)' }}>
                    <Box>
                      <Typography sx={{ color: '#f8fafc', fontSize: '.84rem', fontWeight: 700 }}>{issue.message}</Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,.55)', fontSize: '.72rem' }}>{issue.severity} · {issue.status === 'open' ? 'Åpen' : 'Løst'} · {formatTime(issue.createdAt)}</Typography>
                    </Box>
                    {issue.status === 'open' && canReview ? (
                      <Button variant="outlined" disabled={busy} onClick={() => void run({ type: 'resolve_qc_issue', turnoverId: turnover.id, issueId: issue.id }, 'QC-avviket er løst.')} sx={{ minHeight: targetSize, ...focusVisibleStyles }}>Marker løst</Button>
                    ) : null}
                  </Stack>
                ))}
              </Stack>
              {canReview && ['received', 'qc_issues'].includes(turnover.status) ? (
                <Stack direction={{ xs: 'column', md: 'row' }} gap={1} sx={{ mt: 1.5 }}>
                  <FormControl size="small" sx={{ minWidth: 150, ...fieldSx }}>
                    <InputLabel id={`qc-severity-${turnover.id}`}>Alvorlighet</InputLabel>
                    <Select
                      labelId={`qc-severity-${turnover.id}`}
                      value={draft.severity}
                      label="Alvorlighet"
                      onChange={(event) => setQcDraft((current) => ({ ...current, [turnover.id]: { ...draft, severity: event.target.value as PostQcSeverity } }))}
                    >
                      <MenuItem value="note">Merknad</MenuItem>
                      <MenuItem value="warning">Advarsel</MenuItem>
                      <MenuItem value="blocker">Blokkerende</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Nytt QC-avvik"
                    value={draft.message}
                    onChange={(event) => setQcDraft((current) => ({ ...current, [turnover.id]: { ...draft, message: event.target.value } }))}
                    sx={{ flex: 1, ...fieldSx }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    disabled={busy || !draft.message.trim()}
                    onClick={() => {
                      void run(
                        { type: 'add_qc_issue', turnoverId: turnover.id, severity: draft.severity, message: draft.message.trim() },
                        'QC-avviket er registrert.',
                      ).then((saved) => {
                        if (!saved) return;
                        setQcDraft((current) => ({
                          ...current,
                          [turnover.id]: { ...draft, message: '' },
                        }));
                      });
                    }}
                    sx={{ minHeight: targetSize, bgcolor: '#d97706', ...focusVisibleStyles }}
                  >Legg til</Button>
                </Stack>
              ) : null}
              {openIssues.length === 0 && turnover.issues.length > 0 ? <Alert severity="success" sx={{ mt: 1.5 }}>Alle QC-avvik er løst.</Alert> : null}
            </Box>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  const renderOverview = () => (
    <Stack gap={2}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(6,minmax(0,1fr))' }, gap: 1.25 }}>
        {[
          ['Aktive', brief.activeCount, '#c4b5fd'],
          ['Klar', brief.readyCount, '#38bdf8'],
          ['I QC', brief.receivedCount, '#f59e0b'],
          ['Godkjent', brief.acceptedCount, '#22c55e'],
          ['Kildeendret', brief.staleCount, '#fb7185'],
          ['Åpne avvik', brief.openIssueCount, '#fbbf24'],
        ].map(([name, value, color]) => (
          <Card key={String(name)} variant="outlined" sx={panelSx}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography sx={{ color: 'rgba(226,232,240,.58)', fontSize: '.73rem' }}>{name}</Typography>
              <Typography sx={{ color, fontSize: '1.65rem', fontWeight: 850, lineHeight: 1.15 }}>{value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      {brief.staleCount > 0 ? <Alert severity="warning">{brief.staleCount} manifest har endret kildegrunnlag. Ingen overgang tillates før manifestet er kontrollert og oppdatert.</Alert> : null}
      {brief.blockingIssueCount > 0 ? <Alert severity="error">{brief.blockingIssueCount} blokkerende QC-avvik må løses før ny levering.</Alert> : null}
      <Stack gap={1.25}>
        <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>Sist oppdatert</Typography>
        {brief.latestTurnovers.length > 0
          ? brief.latestTurnovers.map((turnover) => turnoverCard(turnover))
          : <Alert severity="info">Ingen turnover er opprettet ennå. Klargjør første dagsleveranse under Turnovers.</Alert>}
      </Stack>
    </Stack>
  );

  const renderTurnovers = () => (
    <Stack gap={2}>
      {canPrepare ? (
        <Card variant="outlined" sx={panelSx} data-testid="post-turnover-create">
          <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography sx={{ color: '#f8fafc', fontWeight: 850, fontSize: '1rem' }}>Nytt turnover-manifest</Typography>
            <Typography sx={{ mt: .4, color: 'rgba(226,232,240,.62)', fontSize: '.8rem' }}>Refererer verifiserte private filer fra opptakslyd eller Video Room. Ingen filer kopieres eller flyttes.</Typography>
            <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(190px,.65fr) minmax(230px,.85fr) minmax(250px,1fr) minmax(210px,.7fr)' }, gap: 1.25 }}>
              <FormControl size="small" sx={fieldSx}>
                <InputLabel id="post-source-kind-label">Kildetype</InputLabel>
                <Select
                  data-testid="post-source-kind"
                  labelId="post-source-kind-label"
                  label="Kildetype"
                  value={sourceKind}
                  onChange={(event) => {
                    const next = event.target.value as TurnoverSourceKind;
                    setSourceKind(next);
                    setLabel('');
                    setRecipient(next === 'picture' ? 'Editorial' : 'Post Sound');
                  }}
                >
                  <MenuItem value="production_sound">Opptakslyd</MenuItem>
                  <MenuItem value="picture">Picture / klipp</MenuItem>
                </Select>
              </FormControl>
              {sourceKind === 'picture' ? (
                <FormControl size="small" sx={fieldSx} disabled={pictureLoading || pictureCatalog.versions.length === 0}>
                  <InputLabel id="post-picture-version-label">Video Room-versjon</InputLabel>
                  <Select
                    data-testid="post-picture-version"
                    labelId="post-picture-version-label"
                    label="Video Room-versjon"
                    value={selectedPictureVersionId}
                    onChange={(event) => setSelectedPictureVersionId(event.target.value)}
                  >
                    {pictureCatalog.versions.map((version) => (
                      <MenuItem key={version.id} value={version.id}>
                        V{version.versionNumber} · {version.versionLabel}{version.isLatest ? ' · Nyeste' : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <FormControl size="small" sx={fieldSx}>
                  <InputLabel id="post-day-label">Produksjonsdag</InputLabel>
                  <Select labelId="post-day-label" label="Produksjonsdag" value={selectedDayId} onChange={(event) => { setSelectedDayId(event.target.value); setLabel(''); }}>
                    {days.map((day) => <MenuItem key={day.id} value={day.id}>{productionDayLabel(project, day.id)}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              <TextField size="small" label="Manifestnavn" value={label} onChange={(event) => setLabel(event.target.value)} sx={fieldSx} />
              <TextField size="small" label="Mottaker" value={recipient} onChange={(event) => setRecipient(event.target.value)} sx={fieldSx} />
            </Box>
            <TextField multiline minRows={2} fullWidth label="Leveringsnotat" value={notes} onChange={(event) => setNotes(event.target.value)} sx={{ mt: 1.25, ...fieldSx }} />
            {sourceKind === 'picture' ? (
              <Box sx={{ mt: 1.5 }}>
                {pictureLoading ? <CircularProgress size={22} />
                  : pictureCatalog.binding.status === 'unlinked' ? (
                    <Alert severity="info">Koble Role Room-prosjektet til et CreatorHub-prosjekt før picture kan leveres.</Alert>
                  ) : pictureCatalog.binding.status === 'unavailable' ? (
                    <Alert severity="warning">Prosjektkoblingen kan ikke brukes til en sikker picture-turnover. Kontroller prosjektets CreatorHub-kobling.</Alert>
                  ) : pictureCatalog.versions.length === 0 ? (
                    <Alert severity="info">Video Room har ingen aktiv, S3-verifisert versjon med kontrollsum og filstørrelse ennå.</Alert>
                  ) : (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 1 }}>
                      {pictureCatalog.versions.map((version) => (
                        <Box
                          component="button"
                          type="button"
                          key={version.id}
                          aria-pressed={selectedPictureVersionId === version.id}
                          onClick={() => setSelectedPictureVersionId(version.id)}
                          sx={{ textAlign: 'left', color: 'inherit', font: 'inherit', p: 1.2, borderRadius: 1.5, cursor: 'pointer', bgcolor: selectedPictureVersionId === version.id ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.02)', border: '1px solid rgba(129,140,248,.18)', minHeight: targetSize, ...focusVisibleStyles }}
                        >
                          <Typography sx={{ color: '#e2e8f0', fontSize: '.82rem', fontWeight: 750 }}>V{version.versionNumber} · {version.versionLabel}</Typography>
                          <Typography sx={{ color: 'rgba(226,232,240,.52)', fontSize: '.71rem' }}>{version.displayName} · {formatBytes(version.sizeBytes)} · {version.status}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
              </Box>
            ) : <Box sx={{ mt: 1.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 750, fontSize: '.83rem' }}>Recorderfiler ({selectedMediaIds.length}/{media.length})</Typography>
                {media.length > 0 ? (
                  <Button size="small" onClick={() => setSelectedMediaIds(selectedMediaIds.length === media.length ? [] : media.map((item) => item.id))} sx={{ minHeight: targetSize, ...focusVisibleStyles }}>
                    {selectedMediaIds.length === media.length ? 'Fjern alle' : 'Velg alle'}
                  </Button>
                ) : null}
              </Stack>
              {mediaLoading ? <CircularProgress size={22} sx={{ mt: 1 }} /> : media.length === 0 ? (
                <Alert severity="info" sx={{ mt: 1 }}>Denne dagen har ingen aktive recorderfiler. Last opp og avstem opptakslyden først.</Alert>
              ) : (
                <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 1 }}>
                  {media.map((item) => (
                    <Box component="label" key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: .75, p: 1, borderRadius: 1.5, cursor: 'pointer', bgcolor: selectedMediaIds.includes(item.id) ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.02)', border: '1px solid rgba(129,140,248,.18)', minHeight: targetSize }}>
                      <Checkbox checked={selectedMediaIds.includes(item.id)} onChange={() => setSelectedMediaIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: '#e2e8f0', fontSize: '.8rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.displayName}</Typography>
                        <Typography sx={{ color: 'rgba(226,232,240,.5)', fontSize: '.7rem' }}>{formatBytes(item.sizeBytes)} · {item.reconciliationStatus === 'matched' ? 'take-koblet' : 'ikke take-koblet'}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>}
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" gap={1} sx={{ mt: 1.5 }}>
              {sourceKind === 'picture' && pictureCatalog.binding.workspaceProjectId ? (
                <Button component="a" href={`/workspace/${encodeURIComponent(pictureCatalog.binding.workspaceProjectId)}/video-room`} variant="outlined" startIcon={<PictureIcon />} sx={{ minHeight: targetSize, ...focusVisibleStyles }}>Åpne Video Room</Button>
              ) : sourceKind === 'production_sound' ? (
                <Button variant="outlined" onClick={onOpenProductionSound} sx={{ minHeight: targetSize, ...focusVisibleStyles }}>Åpne opptakslyd</Button>
              ) : null}
              <Button
                data-testid="create-post-turnover"
                variant="contained"
                startIcon={busy ? <CircularProgress size={17} /> : <AddIcon />}
                disabled={busy || !label.trim() || (sourceKind === 'picture' ? !selectedPictureVersionId : !selectedDayId || selectedMediaIds.length === 0)}
                onClick={() => void createTurnover()}
                sx={{ minHeight: targetSize, bgcolor: '#6366f1', ...focusVisibleStyles }}
              >Opprett utkast</Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
      {turnovers.length > 0 ? turnovers.map((turnover) => turnoverCard(turnover)) : <Alert severity="info">Ingen turnover-manifester finnes.</Alert>}
    </Stack>
  );

  const renderQc = () => {
    const qcTurnovers = turnovers.filter((turnover) => turnover.status === 'received' || turnover.status === 'qc_issues' || turnover.issues.length > 0);
    return <Stack gap={1.5}>{qcTurnovers.length > 0 ? qcTurnovers.map((turnover) => turnoverCard(turnover, true)) : <Alert severity="info">Ingen mottatte turnovere eller QC-avvik ennå.</Alert>}</Stack>;
  };

  const renderActivity = () => {
    const events = turnovers.flatMap((turnover) => turnover.events.map((event) => ({ ...event, turnoverLabel: turnover.label })))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    return (
      <Card variant="outlined" sx={panelSx}>
        <CardContent>
          <Stack gap={1.2}>
            {events.length > 0 ? events.map((event) => (
              <Box key={event.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '160px minmax(0,1fr)' }, gap: .8, pb: 1.2, borderBottom: '1px solid rgba(148,163,184,.12)' }}>
                <Typography sx={{ color: 'rgba(226,232,240,.5)', fontSize: '.74rem' }}>{formatTime(event.createdAt)}</Typography>
                <Box>
                  <Typography sx={{ color: '#f8fafc', fontSize: '.83rem', fontWeight: 700 }}>{event.message}</Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,.5)', fontSize: '.72rem' }}>{event.turnoverLabel} · {event.actorUserId}</Typography>
                </Box>
              </Box>
            )) : <Alert severity="info">Aktivitet vises når første manifest opprettes.</Alert>}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box data-testid="post-production-workspace" sx={{ minHeight: '100%', bgcolor: '#050812', color: roleTokens.text, pb: 5 }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 4, px: { xs: 1.5, sm: 2.5 }, py: 1.5, bgcolor: 'rgba(5,8,18,.94)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(129,140,248,.16)' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} gap={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }}>
          <Box>
            <Typography sx={{ color: '#f8fafc', fontSize: { xs: '1.1rem', sm: '1.35rem' }, fontWeight: 900 }}>Post Supervisor · {project.name}</Typography>
            <Typography sx={{ color: 'rgba(226,232,240,.62)', fontSize: '.78rem' }}>Opptakslyd og picture → mottak → QC → sporbar godkjenning</Typography>
          </Box>
          <Stack direction="row" gap={1} sx={{ overflowX: 'auto', pb: .25 }}>
            <Button variant="outlined" startIcon={<FullWorkspaceIcon />} onClick={onOpenFullWorkspace} sx={{ minHeight: targetSize, flexShrink: 0, ...focusVisibleStyles }}>Full arbeidsflate</Button>
            <Button variant="outlined" onClick={onOpenSchedule} sx={{ minHeight: targetSize, flexShrink: 0, ...focusVisibleStyles }}>Opptaksplan</Button>
          </Stack>
        </Stack>
        <Stack component="nav" aria-label="Post-produksjonsflater" direction="row" gap={.75} sx={{ mt: 1.25, overflowX: 'auto', pb: .25 }}>
          {POST_PRODUCTION_SURFACES.map((surface) => {
            const Icon = surfaceMeta[surface].icon;
            return <Button key={surface} data-testid={`post-surface-${surface}`} startIcon={<Icon />} variant={activeSurface === surface ? 'contained' : 'text'} onClick={() => onNavigate(surface)} sx={{ minHeight: targetSize, flexShrink: 0, color: activeSurface === surface ? '#fff' : 'rgba(226,232,240,.72)', bgcolor: activeSurface === surface ? '#4f46e5' : 'transparent', ...focusVisibleStyles }}>{surfaceMeta[surface].label}</Button>;
          })}
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1500, mx: 'auto' }}>
        {feedback ? <Alert severity={feedback.type} onClose={() => setFeedback(null)} sx={{ mb: 1.5 }}>{feedback.text}</Alert> : null}
        {!canPrepare && !canReview ? <Alert severity="info" sx={{ mb: 1.5 }}>Du har lesetilgang. En Production Sound- eller postrolle må utføre statusendringer.</Alert> : null}
        {dataLoading || loading ? (
          <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: '#818cf8' }} /></Box>
        ) : activeSurface === 'overview' ? renderOverview()
          : activeSurface === 'turnovers' ? renderTurnovers()
            : activeSurface === 'qc' ? renderQc()
              : renderActivity()}
      </Box>
    </Box>
  );
}
