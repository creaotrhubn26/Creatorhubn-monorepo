import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  CheckCircleOutline as ApproveIcon,
  ExpandMoreOutlined as ExpandMoreIcon,
  FactCheckOutlined as EvidenceIcon,
  LockOpenOutlined as ReopenIcon,
  LockOutlined as LockIcon,
  RateReviewOutlined as ReviewIcon,
  SwapHorizOutlined as CompareIcon,
  WarningAmberOutlined as WarningIcon,
} from '@mui/icons-material';
import type {
  CastingProject,
  Location,
  LocationDecisionApprovalRole,
  LocationDecisionCriterionStatus,
  LocationManagerOperations,
} from '../../models/casting';
import type { LocationDecisionAction } from '../../services/locationManagerService';
import {
  buildLocationManagerOperations,
  locationDecisionSummary,
} from './locationManagerWorkspaceModel';

interface Props {
  project: CastingProject;
  locations: Location[];
  selectedLocationId: string;
  operations: LocationManagerOperations;
  readOnly: boolean;
  dirty: boolean;
  actionPending: boolean;
  actorRole?: LocationDecisionApprovalRole;
  canLockDecision: boolean;
  canReopenDecision: boolean;
  onSelectLocation: (locationId: string) => void;
  onUpdateOperations: (updater: (current: LocationManagerOperations) => LocationManagerOperations) => void;
  onDecisionAction: (action: LocationDecisionAction, note?: string) => Promise<void>;
  onOpenSchedule: () => void;
}

const panelSx = {
  bgcolor: 'rgba(7, 17, 31, .92)',
  border: '1px solid rgba(45, 212, 191, .18)',
  color: '#f8fafc',
  borderRadius: 3,
};

const fieldSx = {
  '& .MuiInputBase-root': { color: '#f8fafc', bgcolor: 'rgba(255,255,255,.025)', minHeight: 48 },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,.68)' },
  '& .MuiFormHelperText-root': { color: 'rgba(226,232,240,.55)' },
  '& fieldset': { borderColor: 'rgba(94,234,212,.25)' },
};

const CRITERION_STATUS_LABELS: Record<LocationDecisionCriterionStatus, string> = {
  unknown: 'Ikke vurdert',
  pass: 'Godkjent',
  concern: 'Forbehold',
  blocker: 'Blokkering',
  not_applicable: 'Ikke relevant',
};

const ROLE_LABELS: Record<LocationDecisionApprovalRole, string> = {
  director: 'Regissør',
  cinematographer: 'Filmfotograf',
  producer: 'Produsent',
};

const SIGNOFF_LABELS = {
  pending: 'Venter',
  approved: 'Godkjent',
  changes_requested: 'Endring ønsket',
} as const;

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString('nb-NO')} ${currency}`;
  }
}

function statusColor(status: LocationDecisionCriterionStatus): string {
  if (status === 'pass') return '#34d399';
  if (status === 'blocker') return '#fb7185';
  if (status === 'concern') return '#fbbf24';
  return '#94a3b8';
}

export function LocationDecisionRoom({
  project,
  locations,
  selectedLocationId,
  operations,
  readOnly,
  dirty,
  actionPending,
  actorRole,
  canLockDecision,
  canReopenDecision,
  onSelectLocation,
  onUpdateOperations,
  onDecisionAction,
  onOpenSchedule,
}: Props) {
  const [decisionNote, setDecisionNote] = useState('');
  const theme = useTheme();
  const compactCriteria = useMediaQuery(theme.breakpoints.down('md'));
  const summary = useMemo(() => locationDecisionSummary(operations), [operations]);
  const locked = summary.locked;

  useEffect(() => setDecisionNote(''), [actorRole, selectedLocationId]);

  const decisionEvents = operations.activity
    .filter((entry) => entry.type !== 'workspace_saved')
    .slice(-6)
    .reverse();

  return (
    <Card data-testid="location-decision-room" variant="outlined" sx={{ ...panelSx, overflow: 'hidden' }}>
      <Box sx={{ p: { xs: 1.5, sm: 2.25 }, borderBottom: '1px solid rgba(45,212,191,.14)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5} alignItems={{ md: 'center' }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <CompareIcon sx={{ color: '#5eead4' }} />
              <Typography component="h2" variant="h5" fontWeight={850}>Location Decision Room</Typography>
              {locked && <Chip size="small" icon={<LockIcon />} label="Låst" sx={{ bgcolor: 'rgba(52,211,153,.12)', color: '#6ee7b7' }} />}
            </Stack>
            <Typography sx={{ color: 'rgba(226,232,240,.62)', fontSize: '.84rem', mt: .55, maxWidth: 760 }}>
              Sammenlign dokumenterte forhold, avklar forbehold og la regissør, filmfotograf og produsent signere samme beslutning.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip icon={<EvidenceIcon />} label={`${summary.verifiedCriteria}/${summary.totalRequiredCriteria} vurdert med evidens`} sx={{ color: '#ccfbf1', bgcolor: 'rgba(45,212,191,.09)' }} />
            <Chip icon={<ReviewIcon />} label={`${summary.approvals}/${summary.requiredApprovals} godkjenninger`} sx={{ color: '#dfe4f3', bgcolor: 'rgba(147, 164, 220,.1)' }} />
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 1.25, sm: 2 }, bgcolor: 'rgba(2,8,18,.52)' }}>
        <Typography sx={{ color: 'rgba(226,232,240,.56)', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 800, mb: 1 }}>
          Sammenlign kandidater
        </Typography>
        <Box
          role="list"
          aria-label="Lokasjonskandidater"
          sx={{ display: 'flex', gap: 1.15, overflowX: 'auto', pb: 1, scrollSnapType: 'x mandatory' }}
        >
          {locations.map((location) => {
            const selected = location.id === selectedLocationId;
            const itemOperations = selected ? operations : buildLocationManagerOperations(location, project);
            const itemSummary = locationDecisionSummary(itemOperations);
            return (
              <Card
                key={location.id}
                component="button"
                type="button"
                role="listitem"
                onClick={() => onSelectLocation(location.id)}
                aria-pressed={selected}
                sx={{
                  ...panelSx,
                  appearance: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  flex: '0 0 clamp(250px, 31vw, 340px)',
                  minHeight: 174,
                  p: 1.5,
                  scrollSnapAlign: 'start',
                  borderColor: selected ? '#2dd4bf' : 'rgba(148,163,184,.18)',
                  boxShadow: selected ? '0 0 0 1px rgba(45,212,191,.25)' : 'none',
                  '&:focus-visible': { outline: '3px solid #93a4dc', outlineOffset: 2 },
                }}
              >
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap fontWeight={820}>{location.name}</Typography>
                    <Typography noWrap sx={{ color: 'rgba(226,232,240,.5)', fontSize: '.72rem' }}>{location.address || 'Adresse ikke registrert'}</Typography>
                  </Box>
                  {itemSummary.locked && <LockIcon fontSize="small" sx={{ color: '#6ee7b7' }} />}
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.35 }}>
                  <Typography sx={{ color: '#99f6e4', fontWeight: 800, fontSize: '.78rem' }}>{itemSummary.evidenceScore}% dokumentert pass</Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,.55)', fontSize: '.72rem' }}>{itemSummary.approvals}/3 signert</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={itemSummary.evidenceScore}
                  aria-label={`${location.name} dokumentert beslutningsscore`}
                  sx={{ mt: .6, height: 5, borderRadius: 5, bgcolor: 'rgba(148,163,184,.12)', '& .MuiLinearProgress-bar': { bgcolor: itemSummary.blockers.length > 0 ? '#fb7185' : '#2dd4bf' } }}
                />
                <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mt: 1.25 }}>
                  <Chip size="small" label={itemSummary.blockers.length > 0 ? `${itemSummary.blockers.length} blokkeringer` : 'Ingen eksplisitt blokkering'} sx={{ maxWidth: '62%', color: itemSummary.blockers.length > 0 ? '#fecdd3' : '#a7f3d0', bgcolor: itemSummary.blockers.length > 0 ? 'rgba(251,113,133,.1)' : 'rgba(52,211,153,.08)' }} />
                  <Typography sx={{ color: '#e2e8f0', fontSize: '.75rem', fontWeight: 750, alignSelf: 'center' }}>{formatMoney(itemSummary.explicitCost, itemOperations.finance.currency)}</Typography>
                </Stack>
              </Card>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ p: { xs: 1.5, sm: 2.25 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0,1.5fr) minmax(320px,.7fr)' }, gap: 2 }}>
          <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} sx={{ mb: 1.2 }}>
              <Box>
                <Typography component="h3" variant="h6" fontWeight={820}>Beslutningsgrunnlag</Typography>
                <Typography sx={{ color: 'rgba(226,232,240,.54)', fontSize: '.78rem' }}>
                  Et resultat teller bare når status er valgt eksplisitt og evidens er oppgitt.
                </Typography>
              </Box>
              <Chip label={`${summary.evidenceScore}% dokumentert pass`} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, color: '#99f6e4', bgcolor: 'rgba(45,212,191,.1)', fontWeight: 800 }} />
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 1 }}>
              {operations.decisionReview.criteria.map((criterion) => {
                const header = (
                  <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={760}>{criterion.label}</Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,.45)', fontSize: '.68rem' }}>{criterion.required ? 'Påkrevd før låsing' : 'Ved behov'}</Typography>
                    </Box>
                    <Box aria-hidden sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: statusColor(criterion.status), flexShrink: 0 }} />
                  </Stack>
                );
                const controls = (
                  <>
                  <FormControl fullWidth size="small" sx={{ ...fieldSx, mt: 1 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      aria-label={`${criterion.label} beslutningsstatus`}
                      value={criterion.status}
                      disabled={readOnly || locked}
                      onChange={(event) => onUpdateOperations((current) => ({
                        ...current,
                        decisionReview: {
                          ...current.decisionReview,
                          criteria: current.decisionReview.criteria.map((item) => item.id === criterion.id
                            ? { ...item, status: event.target.value as LocationDecisionCriterionStatus }
                            : item),
                        },
                      }))}
                    >
                      {Object.entries(CRITERION_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    size="small"
                    label="Evidens / kilde"
                    value={criterion.evidence ?? ''}
                    disabled={readOnly || locked}
                    onChange={(event) => onUpdateOperations((current) => ({
                      ...current,
                      decisionReview: {
                        ...current.decisionReview,
                        criteria: current.decisionReview.criteria.map((item) => item.id === criterion.id
                          ? { ...item, evidence: event.target.value }
                          : item),
                      },
                    }))}
                    helperText={criterion.mediaIds.length > 0 ? `${criterion.mediaIds.length} mediefiler koblet` : 'Skriv observasjon, måling eller dokumentreferanse'}
                    sx={{ ...fieldSx, mt: 1 }}
                  />
                  </>
                );
                if (compactCriteria) {
                  return (
                    <Accordion
                      key={criterion.id}
                      disableGutters
                      defaultExpanded={criterion.status !== 'unknown'}
                      sx={{
                        bgcolor: 'rgba(255,255,255,.02)', color: '#f8fafc',
                        border: `1px solid ${statusColor(criterion.status)}33`, borderRadius: '8px !important',
                        '&::before': { display: 'none' }, '&.Mui-expanded': { my: 0 },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon sx={{ color: '#cbd5e1' }} />}
                        aria-label={`Åpne ${criterion.label}`}
                        sx={{ minHeight: 56, px: 1.3, '&.Mui-expanded': { minHeight: 56 }, '& .MuiAccordionSummary-content': { my: 1 } }}
                      >
                        <Box sx={{ width: '100%', pr: .75 }}>{header}</Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 1.3, pt: 0, pb: 1.3 }}>{controls}</AccordionDetails>
                    </Accordion>
                  );
                }
                return (
                  <Box key={criterion.id} sx={{ p: 1.3, border: `1px solid ${statusColor(criterion.status)}33`, borderRadius: 2, bgcolor: 'rgba(255,255,255,.02)' }}>
                    {header}
                    {controls}
                  </Box>
                );
              })}
            </Box>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Anbefaling og konsekvens"
              value={operations.decisionReview.recommendationNote ?? ''}
              disabled={readOnly || locked}
              onChange={(event) => onUpdateOperations((current) => ({
                ...current,
                decisionReview: { ...current.decisionReview, recommendationNote: event.target.value },
              }))}
              helperText="Oppsummer hvorfor lokasjonen anbefales, hva som må aksepteres og hvilken produksjonskonsekvens valget har."
              sx={{ ...fieldSx, mt: 1.25 }}
            />
          </Box>

          <Stack spacing={1.25}>
            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: 'rgba(147, 164, 220,.045)', border: '1px solid rgba(147, 164, 220,.18)' }}>
              <Typography component="h3" variant="h6" fontWeight={820}>Felles sign-off</Typography>
              <Typography sx={{ color: 'rgba(226,232,240,.54)', fontSize: '.76rem', mb: 1.25 }}>
                Hver beslutning signeres av riktig prosjektrolle på serveren.
              </Typography>
              <Stack spacing={.85}>
                {operations.decisionReview.signoffs.map((signoff) => (
                  <Box key={signoff.role} sx={{ p: 1.15, borderRadius: 2, bgcolor: 'rgba(255,255,255,.025)', border: '1px solid rgba(148,163,184,.12)' }}>
                    <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                      <Typography fontWeight={750}>{ROLE_LABELS[signoff.role]}</Typography>
                      <Chip
                        size="small"
                        label={SIGNOFF_LABELS[signoff.status]}
                        sx={{ color: signoff.status === 'approved' ? '#6ee7b7' : signoff.status === 'changes_requested' ? '#fecdd3' : '#cbd5e1', bgcolor: signoff.status === 'approved' ? 'rgba(52,211,153,.1)' : signoff.status === 'changes_requested' ? 'rgba(251,113,133,.1)' : 'rgba(148,163,184,.09)' }}
                      />
                    </Stack>
                    {signoff.note && <Typography sx={{ color: 'rgba(226,232,240,.65)', fontSize: '.74rem', mt: .6 }}>{signoff.note}</Typography>}
                    {actorRole === signoff.role && !locked && (
                      <Stack spacing={.75} sx={{ mt: 1 }}>
                        <TextField
                          size="small"
                          label="Beslutningsnotat"
                          value={decisionNote}
                          onChange={(event) => setDecisionNote(event.target.value)}
                          disabled={actionPending || dirty}
                          sx={fieldSx}
                        />
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={.75}>
                          <Button
                            fullWidth
                            variant="contained"
                            startIcon={<ApproveIcon />}
                            disabled={actionPending || dirty}
                            onClick={() => void onDecisionAction('approve', decisionNote.trim() || undefined)}
                            sx={{ minHeight: 48, bgcolor: '#0f9f92' }}
                          >Godkjenn</Button>
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<WarningIcon />}
                            disabled={actionPending || dirty || !decisionNote.trim()}
                            onClick={() => void onDecisionAction('request_changes', decisionNote.trim())}
                            sx={{ minHeight: 48, color: '#fecdd3', borderColor: 'rgba(251,113,133,.4)' }}
                          >Be om endring</Button>
                        </Stack>
                      </Stack>
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>

            {summary.lockReasons.length > 0 && !locked && (
              <Alert severity="warning" icon={<WarningIcon />} sx={{ '& .MuiAlert-message': { minWidth: 0 } }}>
                <Typography fontWeight={800}>Kan ikke låses ennå</Typography>
                <Box component="ul" sx={{ pl: 2.2, my: .5, maxHeight: 150, overflowY: 'auto' }}>
                  {summary.lockReasons.slice(0, 8).map((reason) => <li key={reason}><Typography sx={{ fontSize: '.76rem' }}>{reason}</Typography></li>)}
                </Box>
                {summary.lockReasons.length > 8 && <Typography sx={{ fontSize: '.72rem' }}>+ {summary.lockReasons.length - 8} flere krav</Typography>}
              </Alert>
            )}

            {!locked ? (
              <Button
                fullWidth
                variant="contained"
                startIcon={<LockIcon />}
                disabled={!canLockDecision || !summary.canLock || dirty || actionPending}
                onClick={() => void onDecisionAction('lock')}
                sx={{ minHeight: 52, bgcolor: '#14b8a6', '&:hover': { bgcolor: '#0f9f92' } }}
              >Lås som primærlokasjon</Button>
            ) : (
              <Stack spacing={1}>
                <Alert severity="success">
                  <Typography fontWeight={800}>Produksjonsgrunnlaget er låst</Typography>
                  <Typography sx={{ fontSize: '.76rem' }}>Valgt lokasjon, backup, kostnad og godkjenninger er sporbare i samme versjon.</Typography>
                </Alert>
                <Button variant="outlined" onClick={onOpenSchedule} sx={{ minHeight: 48, color: '#99f6e4', borderColor: 'rgba(45,212,191,.35)' }}>Åpne opptaksplan</Button>
                {canReopenDecision && (
                  <Button
                    variant="text"
                    startIcon={<ReopenIcon />}
                    disabled={actionPending || dirty}
                    onClick={() => void onDecisionAction('reopen')}
                    sx={{ minHeight: 48, color: '#fcd34d' }}
                  >Gjenåpne beslutning</Button>
                )}
              </Stack>
            )}
            {!canLockDecision && !locked && <Typography sx={{ color: 'rgba(226,232,240,.48)', fontSize: '.72rem', textAlign: 'center' }}>Kun prosjektets produsent kan låse det endelige valget.</Typography>}
            {dirty && <Typography sx={{ color: '#fde68a', fontSize: '.72rem', textAlign: 'center' }}>Lagre grunnlaget før sign-off eller låsing.</Typography>}
          </Stack>
        </Box>

        <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(148,163,184,.12)' }}>
          <Typography component="h3" fontWeight={800}>Beslutningslogg</Typography>
          {decisionEvents.length === 0 ? (
            <Typography sx={{ color: 'rgba(226,232,240,.45)', fontSize: '.76rem', mt: .5 }}>Ingen signeringer eller låsehandlinger ennå.</Typography>
          ) : (
            <Stack spacing={.65} sx={{ mt: .8 }}>
              {decisionEvents.map((event) => (
                <Stack key={event.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={.3} sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.02)' }}>
                  <Typography sx={{ fontSize: '.77rem' }}>{event.message}</Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,.42)', fontSize: '.68rem', flexShrink: 0 }}>{new Date(event.createdAt).toLocaleString('nb-NO')}</Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Card>
  );
}
