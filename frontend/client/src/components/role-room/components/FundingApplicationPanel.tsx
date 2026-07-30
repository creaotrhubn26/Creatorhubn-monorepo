/**
 * FundingApplicationPanel — søknad om tilskudd (Del A punkt 114).
 *
 * Skjermen svarer på ett spørsmål: **er søknaden klar til å sendes?**
 *
 * Designvalg som følger av det:
 *
 *   - Kravlista er hovedinnholdet, ikke en fane. Det er den produsenten
 *     jobber seg gjennom.
 *   - Krav systemet avgjør selv er merket «auto» og kan ikke krysses av. En
 *     avkryssing der ville skjult at dataene mangler.
 *   - Hvert uoppfylt krav sier HVA som mangler, ikke bare at noe mangler.
 *     «50 % bekreftet — det mangler 540 000» er handlingsrettet; et rødt
 *     kryss er det ikke.
 *   - Finansieringen får egen fremdriftslinje mot 80 %-kravet, fordi det er
 *     det ene tallet som oftest avgjør om søknaden i det hele tatt kan sendes.
 *
 * Bruker de kanoniske primitivene (RolePanelHeader, RoleCard) framfor egne
 * kort — se primitives/index.ts.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  ErrorOutline as ErrorOutlineIcon,
  Event as EventIcon,
  Handshake as HandshakeIcon,
  Payments as PaymentsIcon,
  RemoveCircleOutline as RemoveCircleOutlineIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';

import { apiRequest } from '../../../lib/queryClient';
import { RoleCard, RolePanelHeader } from './primitives';

// ── Typer (speiler role-room-funding-application-service.ts) ────────────────

type RequirementState = 'met' | 'unmet' | 'manual_pending' | 'not_applicable';

interface RequirementStatus {
  key: string;
  label: string;
  description: string | null;
  mandatory: boolean;
  state: RequirementState;
  detail: string;
  automatic: boolean;
}

interface FinancingSummary {
  total: number;
  confirmed: number;
  unconfirmed: number;
  confirmedRatio: number | null;
  public: number;
  private: number;
  meetsThreshold: boolean;
  shortfallToThreshold: number;
  sources: Array<{ name: string; type: string; amount: number; confirmed: boolean }>;
}

interface WindowStatus {
  state: 'rolling' | 'upcoming' | 'open' | 'closed';
  message: string;
  canSubmitNow: boolean;
}

interface PartnerCoverage {
  role: string;
  label: string;
  confirmed: boolean;
  amount: number;
  names: string[];
}

interface Readiness {
  applicationId: string;
  label: string;
  schemeName: string;
  deadlineAt: string | null;
  daysToDeadline: number | null;
  status: string;
  requirements: RequirementStatus[];
  ready: boolean;
  mandatoryTotal: number;
  mandatoryMet: number;
  blockers: string[];
  financing: FinancingSummary;
  window: WindowStatus;
  partners: { coverage: PartnerCoverage[]; missingSuggested: string[] };
  warnings: string[];
}

interface ApplicationSummary {
  id: string;
  label: string;
  status: string;
  deadline_at: string | null;
  scheme_key: string;
  scheme_name: string;
}

const nok = (n: number) => `${Math.round(n).toLocaleString('nb-NO')} kr`;

// ── Krav-rad ────────────────────────────────────────────────────────────────

const STATE_STYLE: Record<RequirementState, { color: string; icon: React.ReactNode; label: string }> = {
  met: { color: '#10b981', icon: <CheckCircleIcon fontSize="small" />, label: 'Oppfylt' },
  unmet: { color: '#ef4444', icon: <ErrorOutlineIcon fontSize="small" />, label: 'Mangler' },
  manual_pending: { color: '#f59e0b', icon: <UploadFileIcon fontSize="small" />, label: 'Må lastes opp' },
  not_applicable: { color: '#94a3b8', icon: <RemoveCircleOutlineIcon fontSize="small" />, label: 'Ikke aktuelt' },
};

interface RequirementRowProps {
  requirement: RequirementStatus;
  busy: boolean;
  onSetStatus: (key: string, status: 'pending' | 'ready' | 'not_applicable') => void;
}

const RequirementRow: React.FC<RequirementRowProps> = ({ requirement, busy, onSetStatus }) => {
  const style = STATE_STYLE[requirement.state];
  const done = requirement.state === 'met' || requirement.state === 'not_applicable';

  return (
    <RoleCard sx={{ p: 2, opacity: requirement.state === 'not_applicable' ? 0.65 : 1 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ color: style.color, mt: 0.25, display: 'flex' }}>{style.icon}</Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
              {requirement.label}
            </Typography>
            {!requirement.mandatory && (
              <Chip label="Valgfritt" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
            )}
            {requirement.automatic && (
              // Gjør det tydelig hvorfor kravet ikke har en avkryssingsboks.
              <Tooltip title="Avgjøres automatisk fra data i prosjektet. Fyll inn dataene for å oppfylle kravet.">
                <Chip
                  icon={<AutoAwesomeIcon sx={{ fontSize: '0.8rem !important' }} />}
                  label="auto"
                  size="small"
                  sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}
                />
              </Tooltip>
            )}
          </Stack>

          {/* Detaljen er poenget: den sier hva som mangler, ikke bare at noe gjør det. */}
          <Typography sx={{ fontSize: '0.85rem', color: done ? 'text.secondary' : style.color, mt: 0.25 }}>
            {requirement.detail}
          </Typography>

          {requirement.description && requirement.state !== 'met' && (
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.5 }}>
              {requirement.description}
            </Typography>
          )}
        </Box>

        {/* Kun manuelle krav kan kvitteres ut her. */}
        {!requirement.automatic && (
          <Stack direction="row" spacing={0.5}>
            {requirement.state !== 'met' && (
              <Button size="small" variant="outlined" disabled={busy}
                onClick={() => onSetStatus(requirement.key, 'ready')}>
                Bekreft
              </Button>
            )}
            {requirement.state === 'met' && (
              <Button size="small" variant="text" disabled={busy}
                onClick={() => onSetStatus(requirement.key, 'pending')}>
                Angre
              </Button>
            )}
            {requirement.state !== 'not_applicable' && (
              <Button size="small" variant="text" color="inherit" disabled={busy}
                onClick={() => onSetStatus(requirement.key, 'not_applicable')}>
                Ikke aktuelt
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </RoleCard>
  );
};

// ── Finansieringskort ───────────────────────────────────────────────────────

const FinancingCard: React.FC<{ financing: FinancingSummary }> = ({ financing }) => {
  const pct = Math.round((financing.confirmedRatio ?? 0) * 100);
  const barColor = financing.meetsThreshold ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <RoleCard sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <PaymentsIcon sx={{ color: '#a78bfa' }} />
        <Typography sx={{ fontWeight: 700 }}>Finansiering</Typography>
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
          {nok(financing.confirmed)} bekreftet av {nok(financing.total)}
        </Typography>
        <Typography sx={{ fontWeight: 700, color: barColor }}>{pct} %</Typography>
      </Stack>

      {/* Terskelen er det tallet som oftest avgjør om søknaden kan sendes,
          så den vises som en linje man ser at man er over eller under. */}
      <Box sx={{ position: 'relative' }}>
        <LinearProgress
          variant="determinate"
          value={Math.min(pct, 100)}
          sx={{
            height: 10, borderRadius: 5,
            bgcolor: 'rgba(148,163,184,0.2)',
            '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 5 },
          }}
        />
        <Tooltip title="NFI krever minimum 80 % bekreftet finansiering">
          <Box sx={{
            position: 'absolute', left: '80%', top: -3, height: 16, width: 2,
            bgcolor: 'text.primary', opacity: 0.7,
          }} />
        </Tooltip>
      </Box>

      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
        Kravet er 80 % bekreftet
      </Typography>

      {!financing.meetsThreshold && financing.shortfallToThreshold > 0 && (
        // Kronebeløp framfor prosent — det er beløpet som må skaffes.
        <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
          Det mangler <strong>{nok(financing.shortfallToThreshold)}</strong> i bekreftet finansiering.
        </Alert>
      )}

      <Divider sx={{ my: 1.5 }} />

      <Stack direction="row" spacing={3}>
        <Box>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Offentlig</Typography>
          <Typography sx={{ fontWeight: 600 }}>{nok(financing.public)}</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Privat</Typography>
          <Typography sx={{ fontWeight: 600 }}>{nok(financing.private)}</Typography>
        </Box>
      </Stack>

      {financing.sources.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          {financing.sources.map((s, i) => (
            <Stack key={`${s.name}-${i}`} direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                <Box sx={{
                  width: 6, height: 6, borderRadius: '50%',
                  bgcolor: s.confirmed ? '#10b981' : '#94a3b8', flexShrink: 0,
                }} />
                <Typography noWrap sx={{ fontSize: '0.82rem' }}>{s.name}</Typography>
              </Stack>
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', whiteSpace: 'nowrap', pl: 1 }}>
                {nok(s.amount)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </RoleCard>
  );
};

// ── Samarbeidskort ──────────────────────────────────────────────────────────

/**
 * Gjør «det mangler 540 000» om til «du har ikke distributør ennå».
 * Beløpet sier at noe mangler; partneren sier hvem man skal snakke med.
 */
const PartnerCard: React.FC<{ partners: Readiness['partners'] }> = ({ partners }) => (
  <RoleCard sx={{ p: 2.5 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
      <HandshakeIcon sx={{ color: '#a78bfa' }} />
      <Typography sx={{ fontWeight: 700 }}>Samarbeid</Typography>
    </Stack>

    {partners.coverage.length === 0 ? (
      <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
        Ingen medfinansiører er registrert ennå.
      </Typography>
    ) : (
      <Stack spacing={0.75}>
        {partners.coverage.map((c) => (
          <Stack key={c.role} direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
              <Box sx={{
                width: 6, height: 6, borderRadius: '50%',
                bgcolor: c.confirmed ? '#10b981' : '#94a3b8', flexShrink: 0,
              }} />
              <Typography noWrap sx={{ fontSize: '0.82rem' }}>{c.label}</Typography>
            </Stack>
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', whiteSpace: 'nowrap', pl: 1 }}>
              {nok(c.amount)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    )}

    {partners.missingSuggested.length > 0 && (
      // Veiledning, ikke krav — derfor nøytral tone og ingen rødt.
      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 0.75 }}>
          Typisk medfinansiering som ikke er på plass:
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {partners.missingSuggested.map((m) => (
            <Chip key={m} label={m} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.72rem' }} />
          ))}
        </Stack>
      </Box>
    )}
  </RoleCard>
);

// ── Panelet ─────────────────────────────────────────────────────────────────

export interface FundingApplicationPanelProps {
  projectId: string;
}

export const FundingApplicationPanel: React.FC<FundingApplicationPanelProps> = ({ projectId }) => {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const applicationsQuery = useQuery<{ applications: ApplicationSummary[] }>({
    queryKey: ['funding-applications', projectId],
    queryFn: async () => {
      const res = await apiRequest(`/api/role-room/projects/${projectId}/funding/applications`);
      return res.json();
    },
    enabled: Boolean(projectId),
  });

  const applications = applicationsQuery.data?.applications ?? [];
  // Førstevalget er den med nærmeste frist — listen kommer sortert.
  const activeId = selectedId ?? applications[0]?.id ?? null;

  const readinessQuery = useQuery<Readiness>({
    queryKey: ['funding-readiness', activeId],
    queryFn: async () => {
      const res = await apiRequest(`/api/role-room/funding/applications/${activeId}/readiness`);
      return res.json();
    },
    enabled: Boolean(activeId),
  });

  const setStatus = useMutation({
    mutationFn: async (vars: { key: string; status: 'pending' | 'ready' | 'not_applicable' }) => {
      const res = await apiRequest(
        `/api/role-room/funding/applications/${activeId}/requirements/${vars.key}`,
        { method: 'PUT', body: JSON.stringify({ status: vars.status }) },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Kunne ikke oppdatere');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['funding-readiness', activeId] }),
  });

  const readiness = readinessQuery.data;

  if (!projectId) {
    return <Alert severity="info">Velg et prosjekt for å se tilskuddssøknader.</Alert>;
  }

  if (applicationsQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (applications.length === 0) {
    return (
      <Box>
        <RolePanelHeader
          title="Tilskudd"
          subtitle="Søknader om produksjonstilskudd"
          icon={<PaymentsIcon />}
        />
        <Alert severity="info" sx={{ mt: 2 }}>
          Ingen søknader er opprettet på dette prosjektet ennå.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <RolePanelHeader
        title="Tilskudd"
        subtitle={readiness ? `${readiness.schemeName}` : 'Søknader om produksjonstilskudd'}
        icon={<PaymentsIcon />}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            {applications.length > 1 && (
              <TextField
                select size="small" value={activeId ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                {applications.map((a) => (
                  <MenuItem key={a.id} value={a.id}>{a.label}</MenuItem>
                ))}
              </TextField>
            )}
            <Button
              size="small" variant="outlined" startIcon={<DownloadIcon />}
              href={`/api/role-room/funding/applications/${activeId}/export.csv`}
              disabled={!activeId}
            >
              Last ned budsjett
            </Button>
          </Stack>
        }
      />

      {readinessQuery.isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {readiness && (
        <Box sx={{ mt: 2 }}>
          {/* Vinduet først: en ferdig søknad er ikke nødvendigvis mulig å
              sende, og det er verdiløst å oppdage kvelden før fristen. */}
          <Alert
            severity={readiness.window.canSubmitNow ? 'success' : 'warning'}
            icon={<EventIcon fontSize="inherit" />}
            sx={{ mb: 1 }}
          >
            {readiness.window.message}
          </Alert>

          {/* Konklusjonen — hele grunnen til at skjermen finnes. */}
          <Alert
            severity={readiness.ready ? 'success' : 'warning'}
            sx={{ mb: 2 }}
          >
            {readiness.ready
              ? 'Alle obligatoriske krav er oppfylt. Søknaden kan sendes.'
              : `${readiness.blockers.length} av ${readiness.mandatoryTotal} krav gjenstår før søknaden kan sendes.`}
            {/* Fristen hører hjemme her framfor i en egen rute — den er en del
                av konklusjonen, ikke et løsrevet nøkkeltall. */}
            {readiness.daysToDeadline !== null && (
              <> {readiness.daysToDeadline < 0
                ? `Fristen gikk ut for ${Math.abs(readiness.daysToDeadline)} dager siden.`
                : `${readiness.daysToDeadline} dager til frist.`}</>
            )}
          </Alert>

          {readiness.warnings.map((w, i) => (
            <Alert key={i} severity="info" sx={{ mb: 1 }}>{w}</Alert>
          ))}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
              gap: 2,
              mt: 2,
            }}
          >
            <Stack spacing={1.25}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Krav i ordningen
              </Typography>
              {readiness.requirements.map((r) => (
                <RequirementRow
                  key={r.key}
                  requirement={r}
                  busy={setStatus.isPending}
                  onSetStatus={(key, status) => setStatus.mutate({ key, status })}
                />
              ))}
              {setStatus.isError && (
                <Alert severity="error">{(setStatus.error as Error).message}</Alert>
              )}
            </Stack>

            <Stack spacing={2}>
              <FinancingCard financing={readiness.financing} />
              <PartnerCard partners={readiness.partners} />
            </Stack>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default FundingApplicationPanel;
