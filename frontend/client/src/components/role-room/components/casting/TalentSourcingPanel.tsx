import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AssignmentTurnedInOutlined as RequestIcon,
  CloseOutlined as CancelIcon,
  GroupsOutlined as PartnersIcon,
  HowToRegOutlined as CandidateIcon,
  LockOutlined as ConsentIcon,
  SearchOutlined as SearchIcon,
  SendOutlined as SendIcon,
} from '@mui/icons-material';

import type { Role } from '../../models/casting';
import { MOBILE_TOUCH_TARGET_SIZE, focusVisibleStyles } from '../../constants/accessibility';
import {
  cancelTalentRequest,
  createTalentRequest,
  projectTalentRequests,
  searchProjectTalents,
  type ProjectSourcedTalent,
  type ProjectTalentSearchResult,
  type TalentRequest,
  type TalentRequestStatus,
} from '../../services/roleRoomPartnershipsService';
import IncomingTalentProposalsList from '../IncomingTalentProposalsList';

interface TalentSourcingPanelProps {
  projectId: string;
  roles: Role[];
  onCandidatesChanged: () => void | Promise<void>;
  onOpenCandidates: () => void;
}

const REQUEST_STATUS: Record<TalentRequestStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Sendt', color: '#fbbf24', bg: 'rgba(251,191,36,.14)' },
  acknowledged: { label: 'Mottatt av byrå', color: '#7dd3fc', bg: 'rgba(14,165,233,.14)' },
  fulfilled: { label: 'Forslag mottatt', color: '#6ee7b7', bg: 'rgba(16,185,129,.14)' },
  declined: { label: 'Avslått av byrå', color: '#fda4af', bg: 'rgba(244,63,94,.14)' },
  cancelled: { label: 'Avbrutt', color: '#cbd5e1', bg: 'rgba(148,163,184,.14)' },
  expired: { label: 'Frist utløpt', color: '#cbd5e1', bg: 'rgba(148,163,184,.14)' },
};

function ageLine(talent: ProjectSourcedTalent): string {
  if (talent.playing_age_min && talent.playing_age_max) {
    return `Spillealder ${talent.playing_age_min}–${talent.playing_age_max}`;
  }
  if (talent.playing_age_min) return `Spillealder fra ${talent.playing_age_min}`;
  if (talent.playing_age_max) return `Spillealder til ${talent.playing_age_max}`;
  return '';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function defaultDeadline(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function TalentSourcingPanel({
  projectId,
  roles,
  onCandidatesChanged,
  onOpenCandidates,
}: TalentSourcingPanelProps) {
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [roleId, setRoleId] = useState('');
  const [result, setResult] = useState<ProjectTalentSearchResult | null>(null);
  const [requests, setRequests] = useState<TalentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [requestTalent, setRequestTalent] = useState<ProjectSourcedTalent | null>(null);
  const [requestRoleId, setRequestRoleId] = useState('');
  const [requestBrief, setRequestBrief] = useState('');
  const [requestDeadline, setRequestDeadline] = useState(defaultDeadline);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [talentResult, requestResult] = await Promise.all([
        searchProjectTalents(projectId, {
          q: query || undefined,
          roleId: roleId || undefined,
          limit: 50,
        }),
        projectTalentRequests(projectId),
      ]);
      setResult(talentResult);
      setRequests(requestResult.requests);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Klarte ikke å hente talenter');
    } finally {
      setLoading(false);
    }
  }, [projectId, query, roleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingProposalCount = useMemo(
    () => result?.sources.reduce((sum, source) => sum + Number(source.pending_proposal_count || 0), 0) ?? 0,
    [result?.sources],
  );
  const openRequestCount = useMemo(
    () => requests.filter((request) => request.status === 'pending' || request.status === 'acknowledged').length,
    [requests],
  );

  const rolesForRequest = useMemo(() => {
    if (!requestTalent || !result) return [];
    const source = result.sources.find((item) => item.invitation_id === requestTalent.invitation_id);
    if (!source?.role_ids?.length) return roles;
    const allowed = new Set(source.role_ids);
    return roles.filter((role) => allowed.has(role.id));
  }, [requestTalent, result, roles]);

  const openRequestDialog = useCallback((talent: ProjectSourcedTalent) => {
    const source = result?.sources.find((item) => item.invitation_id === talent.invitation_id);
    const allowedRoles = source?.role_ids?.length
      ? roles.filter((role) => source.role_ids?.includes(role.id))
      : roles;
    const preferredRole = allowedRoles.find((role) => role.id === roleId) ?? allowedRoles[0];
    setRequestTalent(talent);
    setRequestRoleId(preferredRole?.id ?? '');
    setRequestBrief('');
    setRequestDeadline(defaultDeadline());
    setError(null);
    setRequestError(null);
  }, [result?.sources, roleId, roles]);

  const submitRequest = useCallback(async () => {
    if (!requestTalent || !requestRoleId || !requestBrief.trim() || !requestDeadline) return;
    setRequestBusy(true);
    setRequestError(null);
    try {
      await createTalentRequest(projectId, {
        invitation_id: requestTalent.invitation_id,
        talent_id: requestTalent.id,
        casting_role_id: requestRoleId,
        brief: requestBrief.trim(),
        response_deadline: `${requestDeadline}T23:59:59.000Z`,
      });
      setInfo(`Forespørselen om ${requestTalent.display_name} er sendt til ${requestTalent.agency_name}.`);
      setRequestTalent(null);
      await load();
    } catch (caught) {
      setRequestError(caught instanceof Error ? caught.message : 'Klarte ikke å sende forespørselen');
    } finally {
      setRequestBusy(false);
    }
  }, [load, projectId, requestBrief, requestDeadline, requestRoleId, requestTalent]);

  const cancelRequest = useCallback(async (requestId: string) => {
    setRequestBusy(true);
    setError(null);
    try {
      await cancelTalentRequest(requestId);
      setInfo('Forespørselen er avbrutt.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Klarte ikke å avbryte forespørselen');
    } finally {
      setRequestBusy(false);
    }
  }, [load]);

  return (
    <Box component="section" aria-labelledby="talent-sourcing-title" data-testid="talent-sourcing-panel">
      <Box
        sx={{
          p: { xs: 1.5, sm: 2, md: 2.5 },
          mb: 2,
          borderRadius: 2.5,
          border: '1px solid rgba(236,72,153,.24)',
          background: 'linear-gradient(135deg, rgba(236,72,153,.1), rgba(15,23,42,.82))',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: .6 }}>
              <PartnersIcon sx={{ color: '#f9a8d4' }} />
              <Typography id="talent-sourcing-title" component="h1" sx={{ color: '#f8fafc', fontSize: { xs: '1.25rem', md: '1.55rem' }, fontWeight: 800 }}>
                Talenter
              </Typography>
            </Stack>
            <Typography sx={{ color: 'rgba(226,232,240,.76)', maxWidth: 760 }}>
              Søk i basisprofiler som prosjektets godkjente partnerbyråer har aktivt samtykke til å dele.
              Kontaktdata og utvidet materiale åpnes ikke av dette søket.
            </Typography>
          </Box>
          <Chip
            icon={<ConsentIcon sx={{ color: '#6ee7b7 !important' }} />}
            label="Prosjektavgrenset og samtykkestyrt"
            sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, color: '#a7f3d0', bgcolor: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.22)' }}
          />
        </Stack>

        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(queryDraft.trim());
          }}
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 1fr) minmax(190px, .45fr) auto' }, gap: 1.25, mt: 2 }}
        >
          <TextField
            label="Søk etter navn eller sted"
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            inputProps={{ maxLength: 120 }}
            size="small"
            fullWidth
          />
          <FormControl size="small" fullWidth>
            <InputLabel id="talent-role-filter-label">Rolle</InputLabel>
            <Select
              labelId="talent-role-filter-label"
              label="Rolle"
              value={roleId}
              onChange={(event) => setRoleId(String(event.target.value))}
            >
              <MenuItem value="">Alle inviterte roller</MenuItem>
              {roles.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button
            type="submit"
            variant="contained"
            startIcon={<SearchIcon />}
            sx={{ minHeight: MOBILE_TOUCH_TARGET_SIZE, bgcolor: '#db2777', '&:hover': { bgcolor: '#be185d' }, ...focusVisibleStyles }}
          >
            Søk
          </Button>
        </Box>
      </Box>

      {error ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Prøv igjen</Button>} sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {info ? <Alert severity="success" onClose={() => setInfo(null)} sx={{ mb: 2 }}>{info}</Alert> : null}

      <IncomingTalentProposalsList
        castingProjectId={projectId}
        onCandidateAccepted={async () => {
          await onCandidatesChanged();
          await load();
        }}
      />

      {requests.length > 0 ? (
        <Box sx={{ mb: 2.5 }} data-testid="talent-request-queue">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <RequestIcon sx={{ color: '#f9a8d4' }} />
            <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 800 }}>
              Forespørsler til byrå
            </Typography>
            {openRequestCount > 0 ? <Chip size="small" label={`${openRequestCount} åpne`} /> : null}
          </Stack>
          <Stack spacing={1}>
            {requests.slice(0, 8).map((request) => {
              const status = REQUEST_STATUS[request.status];
              const isOpen = request.status === 'pending' || request.status === 'acknowledged';
              return (
                <Box
                  key={request.id}
                  data-testid={`talent-request-${request.id}`}
                  sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(255,255,255,.1)', bgcolor: 'rgba(15,23,42,.72)' }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: '#f8fafc', fontWeight: 750 }}>
                        {request.talent_display_name} · {request.role_name}
                      </Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,.65)', fontSize: '.78rem' }}>
                        {request.agency_name} · svarfrist {formatDate(request.response_deadline)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={status.label} sx={{ color: status.color, bgcolor: status.bg }} />
                      {isOpen ? (
                        <Button
                          size="small"
                          disabled={requestBusy}
                          onClick={() => void cancelRequest(request.id)}
                          startIcon={<CancelIcon />}
                          sx={{ minHeight: MOBILE_TOUCH_TARGET_SIZE, color: '#cbd5e1', ...focusVisibleStyles }}
                        >
                          Avbryt
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                  <Typography sx={{ color: 'rgba(226,232,240,.72)', fontSize: '.82rem', mt: 1 }}>
                    {request.brief}
                  </Typography>
                  {request.response_note ? (
                    <Typography sx={{ color: '#c3cbe6', fontSize: '.8rem', mt: .75 }}>
                      Byråets svar: «{request.response_note}»
                    </Typography>
                  ) : null}
                </Box>
              );
            })}
          </Stack>
        </Box>
      ) : null}

      {loading && !result ? (
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 220 }}>
          <CircularProgress size={28} sx={{ color: '#f472b6' }} />
        </Box>
      ) : result ? (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1, mb: 2 }}>
            {[
              { label: 'Partnerbyråer', value: result.sources.length },
              { label: 'Synlige talenter', value: result.talents.length },
              { label: 'Åpne forespørsler', value: openRequestCount },
              { label: 'Forslag til behandling', value: pendingProposalCount },
            ].map((stat) => (
              <Box key={stat.label} sx={{ p: 1.4, borderRadius: 2, border: '1px solid rgba(255,255,255,.08)', bgcolor: 'rgba(15,23,42,.7)' }}>
                <Typography sx={{ color: '#f8fafc', fontSize: '1.35rem', fontWeight: 800 }}>{stat.value}</Typography>
                <Typography sx={{ color: 'rgba(226,232,240,.65)', fontSize: '.75rem' }}>{stat.label}</Typography>
              </Box>
            ))}
          </Box>

          {result.sources.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Ingen godkjente partnerbyråer er koblet til dette prosjektet. Produsenten må etablere partnerskapet og invitere byrået til prosjektet først.
            </Alert>
          ) : (
            <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: 'auto', pb: .5 }}>
              {result.sources.map((source) => (
                <Chip
                  key={source.invitation_id}
                  avatar={<Avatar src={source.agency_logo_url ?? undefined}>{source.agency_name.charAt(0)}</Avatar>}
                  label={`${source.agency_name}${source.agency_verified ? ' · verifisert' : ''} · ${source.visible_talent_count}`}
                  sx={{ flexShrink: 0, color: '#e2e8f0', bgcolor: 'rgba(93,118,203,.12)', border: '1px solid rgba(93,118,203,.25)' }}
                />
              ))}
            </Stack>
          )}

          {result.sources.length > 0 && result.talents.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', borderRadius: 2.5, border: '1px dashed rgba(255,255,255,.16)' }}>
              <Typography sx={{ color: '#f8fafc', fontWeight: 750 }}>Ingen profiler matcher søket</Typography>
              <Typography sx={{ color: 'rgba(226,232,240,.66)', mt: .5 }}>
                Prøv et bredere søk eller velg alle inviterte roller.
              </Typography>
            </Box>
          ) : result.sources.length > 0 ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
              {result.talents.map((talent) => {
                const details = [talent.city, ageLine(talent), talent.gender].filter(Boolean).join(' · ');
                return (
                  <Card key={talent.id} variant="outlined" data-testid={`sourced-talent-${talent.id}`} sx={{ bgcolor: 'rgba(15,23,42,.78)', color: '#f8fafc', borderColor: 'rgba(255,255,255,.1)' }}>
                    <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1.25, p: 1.75, '&:last-child': { pb: 1.75 } }}>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Avatar src={talent.headshot_url ?? undefined} sx={{ width: 56, height: 56, bgcolor: '#2a3d56' }}>
                          {talent.display_name.charAt(0)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography component="h2" sx={{ fontWeight: 780, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {talent.display_name}
                          </Typography>
                          <Typography sx={{ color: 'rgba(226,232,240,.65)', fontSize: '.78rem' }}>
                            {details || 'Basisprofil'}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={.6} useFlexGap flexWrap="wrap">
                        <Chip size="small" label={talent.agency_name} sx={{ color: '#c3cbe6', bgcolor: 'rgba(93,118,203,.14)' }} />
                        {talent.availability_status ? <Chip size="small" label={`Tilgjengelighet: ${talent.availability_status}`} /> : null}
                      </Stack>
                      <Box sx={{ mt: 'auto' }}>
                        {talent.already_candidate ? (
                          <Button fullWidth startIcon={<CandidateIcon />} onClick={onOpenCandidates} sx={{ minHeight: MOBILE_TOUCH_TARGET_SIZE, color: '#6ee7b7', ...focusVisibleStyles }}>
                            Åpne i kandidatlisten
                          </Button>
                        ) : talent.already_proposed ? (
                          <Alert severity="info" icon={false} sx={{ py: .35 }}>Forslag er mottatt og behandles over.</Alert>
                        ) : talent.active_request_id ? (
                          <Alert severity="info" icon={false} sx={{ py: .35 }}>
                            {talent.active_request_status === 'acknowledged' ? 'Byrået har mottatt forespørselen.' : 'Forespørsel sendt til byrået.'}
                          </Alert>
                        ) : (
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<SendIcon />}
                            onClick={() => openRequestDialog(talent)}
                            sx={{ minHeight: MOBILE_TOUCH_TARGET_SIZE, color: '#f9a8d4', borderColor: 'rgba(236,72,153,.4)', ...focusVisibleStyles }}
                          >
                            Be byrået foreslå
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          ) : null}
        </>
      ) : null}

      <Dialog
        open={Boolean(requestTalent)}
        onClose={() => !requestBusy && setRequestTalent(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { bgcolor: '#111827', color: '#f8fafc', border: '1px solid rgba(236,72,153,.3)' } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Be byrået foreslå talent</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {requestError ? <Alert severity="error">{requestError}</Alert> : null}
            <Alert severity="info" icon={<ConsentIcon />}>
              Forespørselen går til {requestTalent?.agency_name}. Talentet blir ikke kandidat før byrået sender et forslag og castingteamet godkjenner det.
            </Alert>
            <Box>
              <Typography sx={{ fontWeight: 750 }}>{requestTalent?.display_name}</Typography>
              <Typography sx={{ color: 'rgba(226,232,240,.65)', fontSize: '.82rem' }}>{requestTalent?.agency_name}</Typography>
            </Box>
            <FormControl fullWidth required>
              <InputLabel id="talent-request-role-label">Rolle</InputLabel>
              <Select
                labelId="talent-request-role-label"
                label="Rolle"
                value={rolesForRequest.some((role) => role.id === requestRoleId) ? requestRoleId : ''}
                onChange={(event) => setRequestRoleId(String(event.target.value))}
              >
                {rolesForRequest.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}
              </Select>
            </FormControl>
            {rolesForRequest.length === 0 ? <Alert severity="warning">Prosjektinvitasjonen har ingen tilgjengelige roller.</Alert> : null}
            <TextField
              required
              label="Castingbrief"
              value={requestBrief}
              onChange={(event) => setRequestBrief(event.target.value)}
              inputProps={{ maxLength: 2000 }}
              multiline
              minRows={3}
              helperText={`${requestBrief.length}/2000 · Beskriv hvorfor profilen er relevant og hva byrået skal vurdere.`}
            />
            <TextField
              required
              type="date"
              label="Svarfrist"
              value={requestDeadline}
              onChange={(event) => setRequestDeadline(event.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: new Date().toISOString().slice(0, 10) }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button disabled={requestBusy} onClick={() => setRequestTalent(null)} sx={{ minHeight: MOBILE_TOUCH_TARGET_SIZE, color: '#cbd5e1' }}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            disabled={requestBusy || !requestRoleId || !requestBrief.trim() || !requestDeadline}
            onClick={() => void submitRequest()}
            startIcon={requestBusy ? <CircularProgress size={16} /> : <SendIcon />}
            sx={{ minHeight: MOBILE_TOUCH_TARGET_SIZE, bgcolor: '#db2777', '&:hover': { bgcolor: '#be185d' }, ...focusVisibleStyles }}
          >
            Send forespørsel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TalentSourcingPanel;
