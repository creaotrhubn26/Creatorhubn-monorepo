import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined';
import PublishedWithChangesOutlinedIcon from '@mui/icons-material/PublishedWithChangesOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

import {
  workspaceFundingOpportunitiesApi,
  type WorkspaceFundingApplicationPlan,
  type WorkspaceFundingOpportunity,
  type WorkspaceFundingOpportunityInput,
  type WorkspaceFundingOpportunityStatus,
} from '../../services/adminRoomApi';

const BRAND = {
  panel: 'rgba(26, 10, 46, 0.72)',
  solid: '#1a0a2e',
  border: 'rgba(249, 115, 22, 0.24)',
  text: '#f1f5f9',
  muted: 'rgba(241, 245, 249, 0.74)',
  dim: 'rgba(241, 245, 249, 0.5)',
  orange: '#f97316',
  green: '#22c55e',
};

const STATUS_LABELS: Record<WorkspaceFundingOpportunityStatus, string> = {
  watching: 'Følger med',
  planned: 'Skal vurderes',
  applying: 'Søknad pågår',
  submitted: 'Sendt inn',
  not_relevant: 'Ikke relevant',
  closed: 'Stengt',
};

type Draft = {
  provider: string;
  schemeName: string;
  productKey: 'role_room' | 'leadgrid' | 'internal';
  description: string;
  deadline: string;
  isRolling: boolean;
  deadlineNote: string;
  status: WorkspaceFundingOpportunityStatus;
  sourceUrl: string;
  applicationUrl: string;
  nextCheckDate: string;
  assignee: string;
  fitNotes: string;
  tags: string;
};

interface FundingDeadlineRadarProps {
  parentProduct: 'roleroom' | 'leadgrid';
  onChanged?: () => void;
}

function emptyDraft(parentProduct: FundingDeadlineRadarProps['parentProduct']): Draft {
  return {
    provider: '',
    schemeName: '',
    productKey: parentProduct === 'roleroom' ? 'role_room' : 'leadgrid',
    description: '',
    deadline: '',
    isRolling: false,
    deadlineNote: '',
    status: 'watching',
    sourceUrl: '',
    applicationUrl: '',
    nextCheckDate: '',
    assignee: '',
    fitNotes: '',
    tags: '',
  };
}

function itemDraft(item: WorkspaceFundingOpportunity): Draft {
  return {
    provider: item.provider,
    schemeName: item.scheme_name,
    productKey: item.product_key ?? 'internal',
    description: item.description ?? '',
    deadline: item.deadline ?? '',
    isRolling: item.is_rolling,
    deadlineNote: item.deadline_note ?? '',
    status: item.status,
    sourceUrl: item.source_url,
    applicationUrl: item.application_url ?? '',
    nextCheckDate: item.next_check_date ?? '',
    assignee: item.assignee ?? '',
    fitNotes: item.fit_notes ?? '',
    tags: item.tags.join(', '),
  };
}

function inputFromDraft(draft: Draft): WorkspaceFundingOpportunityInput {
  return {
    provider: draft.provider.trim(),
    schemeName: draft.schemeName.trim(),
    productKey: draft.productKey === 'internal' ? null : draft.productKey,
    description: draft.description.trim() || null,
    deadline: draft.deadline || null,
    isRolling: draft.isRolling,
    deadlineNote: draft.deadlineNote.trim() || null,
    status: draft.status,
    sourceUrl: draft.sourceUrl.trim(),
    applicationUrl: draft.applicationUrl.trim() || null,
    lastVerifiedAt: new Date().toISOString(),
    nextCheckDate: draft.nextCheckDate || null,
    assignee: draft.assignee.trim() || null,
    fitNotes: draft.fitNotes.trim() || null,
    tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
  };
}

function productLabel(value: WorkspaceFundingOpportunity['product_key']): string {
  if (value === 'role_room') return 'The Role Room';
  if (value === 'leadgrid') return 'Leadgrid';
  return 'Creatorhub / begge';
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(value: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${value}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

function deadlineText(item: WorkspaceFundingOpportunity): string {
  if (item.is_rolling) return 'Løpende søknadsfrist';
  if (!item.deadline) return 'Frist ikke publisert';
  const days = daysUntil(item.deadline);
  if (days < 0) return `${formatDate(item.deadline)} · passert`;
  if (days === 0) return `${formatDate(item.deadline)} · i dag`;
  return `${formatDate(item.deadline)} · ${days} dager igjen`;
}

function needsVerification(item: WorkspaceFundingOpportunity): boolean {
  if (!item.last_verified_at) return true;
  return Date.now() - new Date(item.last_verified_at).getTime() > 30 * 86_400_000;
}

function applicationPlan(item: WorkspaceFundingOpportunity): WorkspaceFundingApplicationPlan | null {
  const candidate = item.metadata?.applicationPlan;
  if (!candidate || typeof candidate !== 'object') return null;
  const plan = candidate as Partial<WorkspaceFundingApplicationPlan>;
  if (typeof plan.projectId !== 'string' || typeof plan.documentId !== 'string' || typeof plan.fundingAppId !== 'string') return null;
  return plan as WorkspaceFundingApplicationPlan;
}

const fieldSx = {
  '& .MuiInputBase-root': { color: BRAND.text },
  '& .MuiInputLabel-root': { color: BRAND.dim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.border },
  '& .MuiSvgIcon-root': { color: BRAND.dim },
  '& .MuiFormHelperText-root': { color: BRAND.dim },
};

export function FundingDeadlineRadar({ parentProduct, onChanged }: FundingDeadlineRadarProps) {
  const [items, setItems] = useState<WorkspaceFundingOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startingPlanId, setStartingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => emptyDraft(parentProduct));
  const product = parentProduct === 'roleroom' ? 'role_room' : 'leadgrid';

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await workspaceFundingOpportunitiesApi.list(product));
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke hente støttefristene');
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => { void refresh(); }, [refresh]);

  const stats = useMemo(() => ({
    exact: items.filter((item) => item.deadline && item.status !== 'closed').length,
    rolling: items.filter((item) => item.is_rolling && item.status !== 'closed').length,
    urgent: items.filter((item) => item.deadline && daysUntil(item.deadline) >= 0 && daysUntil(item.deadline) <= 30).length,
    verify: items.filter(needsVerification).length,
  }), [items]);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft(parentProduct));
    setDialogOpen(true);
  };

  const openEdit = (item: WorkspaceFundingOpportunity) => {
    setEditingId(item.id);
    setDraft(itemDraft(item));
    setDialogOpen(true);
  };

  const save = async () => {
    if (!draft.provider.trim() || !draft.schemeName.trim() || !draft.sourceUrl.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) await workspaceFundingOpportunitiesApi.update(editingId, inputFromDraft(draft));
      else await workspaceFundingOpportunitiesApi.create(inputFromDraft(draft));
      setDialogOpen(false);
      await refresh();
      onChanged?.();
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lagre støtteordningen');
    } finally {
      setSaving(false);
    }
  };

  const seed = async () => {
    setSaving(true);
    setError(null);
    try {
      await workspaceFundingOpportunitiesApi.seed();
      await refresh();
      onChanged?.();
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke oppdatere standardordningene');
    } finally {
      setSaving(false);
    }
  };

  const verify = async (item: WorkspaceFundingOpportunity) => {
    await workspaceFundingOpportunitiesApi.update(item.id, {
      lastVerifiedAt: new Date().toISOString(),
      nextCheckDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    });
    await refresh();
  };

  const startApplicationPlan = async (item: WorkspaceFundingOpportunity) => {
    setStartingPlanId(item.id);
    setError(null);
    try {
      const target = new Date();
      target.setDate(target.getDate() + 21);
      const { plan } = await workspaceFundingOpportunitiesApi.startPlan(item.id, {
        productKey: product,
        projectTitle: `Oppstartstilskudd 1 — ${parentProduct === 'leadgrid' ? 'Leadgrid' : 'The Role Room'} markedsavklaring`,
        targetDate: target.toISOString().slice(0, 10),
      });
      await refresh();
      onChanged?.();
      window.location.assign(`/admin-workspace?view=documents&product=${parentProduct}&document=${encodeURIComponent(plan.documentId)}`);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke starte søknadsløpet');
    } finally {
      setStartingPlanId(null);
    }
  };

  const remove = async () => {
    if (!editingId || !window.confirm('Slette denne støtteordningen fra radaren?')) return;
    setSaving(true);
    try {
      await workspaceFundingOpportunitiesApi.delete(editingId);
      setDialogOpen(false);
      await refresh();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box data-testid="funding-deadline-radar" sx={{ mb: 2, borderRadius: 2, bgcolor: BRAND.panel, border: `1px solid ${BRAND.border}`, overflow: 'hidden' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5} sx={{ p: 1.6, borderBottom: `1px solid ${BRAND.border}` }}>
        <Box>
          <Stack direction="row" gap={0.8} alignItems="center">
            <AccountBalanceOutlinedIcon sx={{ color: BRAND.orange }} />
            <Typography sx={{ color: BRAND.text, fontWeight: 800 }}>Støttefrist-radar</Typography>
          </Stack>
          <Typography sx={{ color: BRAND.muted, fontSize: 13, mt: 0.35 }}>Innovasjon Norge, Forskningsrådet og andre ordninger — med offisiell kilde og kontroll-dato.</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <Button data-testid="funding-radar-seed" variant="outlined" startIcon={<PublishedWithChangesOutlinedIcon />} onClick={() => void seed()} disabled={saving} sx={{ color: BRAND.orange, borderColor: BRAND.border }}>Oppdater standardordninger</Button>
          <Button data-testid="funding-radar-create" variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ bgcolor: '#c2410c' }}>Ny støttefrist</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ m: 1.5 }}>{error}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1, p: 1.5 }}>
        {[
          ['Faste frister', stats.exact], ['Løpende', stats.rolling], ['Neste 30 dager', stats.urgent], ['Må kontrolleres', stats.verify],
        ].map(([label, value]) => <Box key={String(label)} sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.15)' }}><Typography sx={{ color: BRAND.dim, fontSize: 11 }}>{label}</Typography><Typography sx={{ color: label === 'Må kontrolleres' && Number(value) ? '#fbbf24' : BRAND.text, fontWeight: 800, fontSize: 20 }}>{value}</Typography></Box>)}
      </Box>

      {loading ? <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress size={22} /></Stack> : items.length === 0 ? (
        <Stack alignItems="center" textAlign="center" sx={{ px: 2, pb: 3 }}><Typography sx={{ color: BRAND.muted }}>Ingen støtteordninger følges ennå.</Typography><Typography sx={{ color: BRAND.dim, fontSize: 12 }}>Hent de kontrollerte standardordningene eller registrer en egen frist.</Typography></Stack>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1, px: 1.5, pb: 1.5 }}>
          {items.map((item) => {
            const stale = needsVerification(item);
            const plan = applicationPlan(item);
            const isOppstartstilskuddOne = item.catalog_key === 'innovation-norway-startup-grant-1';
            return <Box key={item.id} data-testid={`funding-radar-item-${item.id}`} sx={{ p: 1.3, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.16)', border: `1px solid ${stale ? 'rgba(251,191,36,0.35)' : 'rgba(34,197,94,0.2)'}` }}>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0 }}><Typography sx={{ color: BRAND.orange, fontSize: 11, fontWeight: 700 }}>{item.provider}</Typography><Typography sx={{ color: BRAND.text, fontWeight: 750 }}>{item.scheme_name}</Typography></Box>
                <Tooltip title="Rediger"><IconButton size="small" onClick={() => openEdit(item)} sx={{ color: BRAND.muted }}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
              </Stack>
              <Typography sx={{ color: item.deadline && daysUntil(item.deadline) <= 30 ? '#fbbf24' : BRAND.muted, fontSize: 13, fontWeight: 700, mt: 0.6 }}>{deadlineText(item)}</Typography>
              {item.deadline_note && <Typography sx={{ color: BRAND.dim, fontSize: 11.5, mt: 0.45 }}>{item.deadline_note}</Typography>}
              {isOppstartstilskuddOne && <Box data-testid="oppstartstilskudd-1-playbook" sx={{ mt: 1, p: 1, borderRadius: 1.5, bgcolor: 'rgba(249,115,22,0.08)', border: `1px solid ${BRAND.border}` }}>
                <Typography sx={{ color: BRAND.text, fontWeight: 750, fontSize: 13 }}>Målet nå: lag den innsendingsklare søknaden</Typography>
                <Typography sx={{ color: BRAND.muted, fontSize: 11.5, mt: 0.45 }}>Arbeidsdokumentet følger Innovasjon Norges søknadsdeler: Ideen, Nyhetsverdi, Langsiktige mål, Fremdrift og aktiviteter, kostnader og Team. Kundeinnsikt og markedspåstander skal dokumenteres — ikke antas.</Typography>
                <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.8 }}>
                  <Chip size="small" label="Løpende" sx={{ color: BRAND.muted }} />
                  <Chip size="small" label="Maks 150 000 kr" sx={{ color: BRAND.muted }} />
                  <Chip size="small" label="3–4 uker behandling" sx={{ color: BRAND.muted }} />
                  <Chip size="small" label="Kun eksterne kostnader" sx={{ color: BRAND.muted }} />
                </Stack>
                {plan ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} sx={{ mt: 1 }}>
                    {/* Dokument-flaten ligger fortsatt i stashen
                        (arkiv/admin-workspace-stash-20260826). Knappen ville ført
                        til «kommer snart», så den er nedtonet og forklart i stedet
                        for å sende deg i en blindvei. */}
                    <Tooltip title="Søknadsskrivingen hører til dokument-flaten, som ikke er gjenopprettet ennå.">
                      <span>
                        <Button data-testid="oppstartstilskudd-open-application" size="small" variant="contained" disabled sx={{ bgcolor: '#c2410c' }}>Skriv søknaden</Button>
                      </span>
                    </Tooltip>
                    <Button data-testid="oppstartstilskudd-open-plan" size="small" variant="outlined" onClick={() => window.location.assign(`/admin-workspace?view=projects&product=${parentProduct}&project=${encodeURIComponent(plan.projectId)}`)} sx={{ color: BRAND.muted, borderColor: BRAND.border }}>Prosjekt og oppgaver</Button>
                  </Stack>
                ) : (
                  <Tooltip title="Søknadsløpet oppretter et dokument, og dokument-flaten er ikke gjenopprettet ennå.">
                    <span>
                      <Button data-testid="oppstartstilskudd-start-plan" size="small" variant="contained" disabled sx={{ mt: 1, bgcolor: '#c2410c' }}>Start søknadsløp</Button>
                    </span>
                  </Tooltip>
                )}
              </Box>}
              <Stack direction="row" gap={0.6} flexWrap="wrap" sx={{ mt: 0.9 }}><Chip size="small" label={STATUS_LABELS[item.status]} sx={{ color: BRAND.muted }} /><Chip size="small" label={productLabel(item.product_key)} sx={{ color: BRAND.muted }} />{stale && <Chip size="small" icon={<WarningAmberOutlinedIcon />} label="Kontroller kilde" sx={{ color: '#fbbf24' }} />}</Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.7} sx={{ mt: 1 }}>
                <Button component="a" href={item.source_url} target="_blank" rel="noopener noreferrer" size="small" startIcon={<LaunchOutlinedIcon />} sx={{ color: BRAND.orange }}>Offisiell kilde</Button>
                <Button size="small" startIcon={<VerifiedOutlinedIcon />} onClick={() => void verify(item)} sx={{ color: BRAND.green }}>Kontrollert nå</Button>
              </Stack>
            </Box>;
          })}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: BRAND.solid, color: BRAND.text } }}>
        <DialogTitle>{editingId ? 'Rediger støtteordning' : 'Ny støtteordning'}</DialogTitle>
        <DialogContent><Stack gap={1.3} sx={{ mt: 1 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}><TextField label="Tilbyder" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} required sx={fieldSx} /><TextField label="Ordning" value={draft.schemeName} onChange={(e) => setDraft({ ...draft, schemeName: e.target.value })} required sx={fieldSx} /></Box>
          <TextField label="Beskrivelse" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} multiline minRows={2} sx={fieldSx} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.2 }}><TextField label="Frist" type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} InputLabelProps={{ shrink: true }} disabled={draft.isRolling} sx={fieldSx} /><FormControlLabel control={<Checkbox checked={draft.isRolling} onChange={(e) => setDraft({ ...draft, isRolling: e.target.checked, deadline: e.target.checked ? '' : draft.deadline })} />} label="Løpende frist" /><TextField select label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as WorkspaceFundingOpportunityStatus })} sx={fieldSx}>{Object.entries(STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField><TextField select label="Arbeidsområde" value={draft.productKey} onChange={(e) => setDraft({ ...draft, productKey: e.target.value as Draft['productKey'] })} sx={fieldSx}><MenuItem value="role_room">The Role Room</MenuItem><MenuItem value="leadgrid">Leadgrid</MenuItem><MenuItem value="internal">Creatorhub / begge</MenuItem></TextField></Box>
          <TextField label="Fristnotat" value={draft.deadlineNote} onChange={(e) => setDraft({ ...draft, deadlineNote: e.target.value })} sx={fieldSx} />
          <Divider sx={{ borderColor: BRAND.border }} />
          <TextField label="Offisiell kilde" value={draft.sourceUrl} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} placeholder="https://…" required sx={fieldSx} />
          <TextField label="Søknadslenke" value={draft.applicationUrl} onChange={(e) => setDraft({ ...draft, applicationUrl: e.target.value })} placeholder="https://…" sx={fieldSx} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}><TextField label="Neste kildekontroll" type="date" value={draft.nextCheckDate} onChange={(e) => setDraft({ ...draft, nextCheckDate: e.target.value })} InputLabelProps={{ shrink: true }} sx={fieldSx} /><TextField label="Ansvarlig" value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })} sx={fieldSx} /></Box>
          <TextField label="Relevans / vurdering" value={draft.fitNotes} onChange={(e) => setDraft({ ...draft, fitNotes: e.target.value })} multiline minRows={2} sx={fieldSx} />
          <TextField label="Etiketter" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} helperText="Skill med komma" sx={fieldSx} />
        </Stack></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>{editingId && <Button startIcon={<DeleteOutlineIcon />} onClick={() => void remove()} disabled={saving} sx={{ color: '#f87171', mr: 'auto' }}>Slett</Button>}<Button onClick={() => setDialogOpen(false)} disabled={saving} sx={{ color: BRAND.muted }}>Avbryt</Button><Button variant="contained" onClick={() => void save()} disabled={saving || !draft.provider.trim() || !draft.schemeName.trim() || !draft.sourceUrl.trim()} sx={{ bgcolor: '#c2410c' }}>{saving ? 'Lagrer…' : 'Lagre ordning'}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
