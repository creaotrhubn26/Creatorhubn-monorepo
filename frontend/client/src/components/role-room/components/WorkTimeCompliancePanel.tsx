/**
 * WorkTimeCompliancePanel — arbeidstid mot arbeidsmiljøloven (Del A punkt 74 og 80).
 *
 * Regelmotoren og vaktene fantes allerede, men bare bak MCP. En agent kunne
 * altså svare på om opptaksdagen var lovlig, mens produsenten som planla den
 * ikke kunne se det noe sted.
 *
 * Skjermens ene jobb er å ikke lyve om hva den vet:
 *
 *   - Dekningen står øverst, ikke funnene. «0 brudd» betyr ingenting før man
 *     vet hvor mange dager sjekken faktisk har sett. Et grønt felt som
 *     egentlig betyr «ingen data» er den farligste tilstanden et
 *     etterlevelsesverktøy kan ha — ingen leter etter et funn som aldri kom.
 *   - Dager uten vakter får en knapp, ikke en advarsel. Hullet skal kunne
 *     tettes der det oppdages; en melding om at noe mangler er halve jobben.
 *   - Hvert funn viser paragrafen. Den som skal utfordre eller etterleve et
 *     varsel må kunne slå det opp selv.
 *   - Forbeholdet står nederst og alltid: dette er beslutningsstøtte, ikke
 *     juridisk rådgivning, og tariffavtale kan utvide flere av grensene.
 */

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
  EventBusy as EventBusyIcon,
  Gavel as GavelIcon,
  HelpOutline as HelpOutlineIcon,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';

import { apiRequest } from '../../../lib/queryClient';
import { RoleCard, RolePanelHeader } from './primitives';

// ── Typer (speiler role-room-work-time-service.ts) ──────────────────────────

type WorkTimeStatus = 'no_data' | 'partial' | 'violations' | 'ok';

interface WorkTimeFinding {
  severity: 'violation' | 'warning';
  code: string;
  reference: string;
  message: string;
  shiftLabel?: string;
}

interface PersonReport {
  person: string;
  ageAtShoot?: number;
  ruleSet: 'adult' | 'minor_15_18' | 'minor_under_15' | 'unknown';
  totalHours: number;
  findings: WorkTimeFinding[];
  violations: number;
  warnings: number;
}

interface Coverage {
  productionDays: number;
  daysWithShifts: number;
  daysMissingShifts: Array<{ id: string; date: string }>;
  shiftsWithoutDay: number;
  peopleMissingBirthDate: number;
}

interface WorkTimeReport {
  projectId: string;
  people: PersonReport[];
  totalViolations: number;
  totalWarnings: number;
  peopleWithViolations: string[];
  coverage: Coverage;
  status: WorkTimeStatus;
  statusMessage: string;
  disclaimer: string;
}

// ── Presentasjon ────────────────────────────────────────────────────────────

const RULE_SET_LABELS: Record<PersonReport['ruleSet'], string> = {
  adult: 'Voksen — kap. 10',
  minor_15_18: '15–18 år — kap. 11',
  minor_under_15: 'Under 15 / grunnskolepliktig — kap. 11',
  unknown: 'Alder ukjent',
};

const STATUS_TONE: Record<WorkTimeStatus, { fg: string; bg: string; border: string; Icon: typeof CheckCircleIcon }> = {
  // Ikke grønt. «Ingen data» er en ukjent tilstand, ikke en godkjent én.
  no_data: { fg: '#cbd5e1', bg: 'rgba(148,163,184,0.14)', border: 'rgba(148,163,184,0.4)', Icon: HelpOutlineIcon },
  partial: { fg: '#fde68a', bg: 'rgba(251,191,36,0.14)', border: 'rgba(252,211,77,0.45)', Icon: WarningAmberIcon },
  violations: { fg: '#fca5a5', bg: 'rgba(248,113,113,0.14)', border: 'rgba(248,113,113,0.45)', Icon: ErrorOutlineIcon },
  ok: { fg: '#86efac', bg: 'rgba(74,222,128,0.14)', border: 'rgba(74,222,128,0.42)', Icon: CheckCircleIcon },
};

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  // Bygges fra datodelene, ikke fra `new Date(iso)` — en ren dato tolket som
  // UTC ville vist gårsdagen i norsk tid.
  return new Date(y, m - 1, d).toLocaleDateString('nb-NO', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
};

export interface WorkTimeCompliancePanelProps {
  projectId: string;
  readOnly?: boolean;
}

export const WorkTimeCompliancePanel: React.FC<WorkTimeCompliancePanelProps> = ({
  projectId,
  readOnly = false,
}) => {
  const queryClient = useQueryClient();

  const reportQuery = useQuery<WorkTimeReport>({
    queryKey: ['work-time-check', projectId],
    queryFn: async () => {
      const res = await apiRequest(`/api/role-room/projects/${projectId}/work-time/check`);
      return res.json();
    },
    enabled: Boolean(projectId),
  });

  const generate = useMutation({
    mutationFn: async (productionDayId: string) => {
      const res = await apiRequest(`/api/role-room/projects/${projectId}/work-time/generate`, {
        method: 'POST',
        body: JSON.stringify({ productionDayId }),
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error ?? 'Kunne ikke generere vakter');
      }
      return res.json() as Promise<{ created: number; callTime: string; wrapTime: string }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work-time-check', projectId] }),
  });

  if (!projectId) {
    return <Alert severity="info">Velg et prosjekt for å se arbeidstidssjekken.</Alert>;
  }

  if (reportQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (reportQuery.isError || !reportQuery.data) {
    return <Alert severity="error">Kunne ikke hente arbeidstidssjekken.</Alert>;
  }

  const report = reportQuery.data;
  const { coverage } = report;
  const tone = STATUS_TONE[report.status];
  const StatusIcon = tone.Icon;
  const coveragePct =
    coverage.productionDays > 0
      ? Math.round((coverage.daysWithShifts / coverage.productionDays) * 100)
      : 0;

  return (
    <Stack spacing={2}>
      <RolePanelHeader
        title="Arbeidstid og AML"
        subtitle="Daglig og ukentlig arbeidstid, hviletid, pause, nattarbeid og reglene for barn."
        icon={<GavelIcon />}
      />

      {/* ── Konklusjonen, med dekningen som premiss ────────────────────── */}
      <Box
        sx={{
          p: { xs: 1.5, md: 2 },
          borderRadius: 2,
          border: `1px solid ${tone.border}`,
          background: tone.bg,
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <StatusIcon sx={{ color: tone.fg, mt: 0.25 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: tone.fg, fontWeight: 800, fontSize: '1rem', mb: 0.25 }}>
              {report.statusMessage}
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.85rem' }}>
              {`Sjekken har sett ${coverage.daysWithShifts} av ${coverage.productionDays} opptaksdag${coverage.productionDays === 1 ? '' : 'er'}.`}
              {report.totalWarnings > 0
                ? ` ${report.totalWarnings} advarsel${report.totalWarnings === 1 ? '' : 'er'} i tillegg til bruddene.`
                : ''}
            </Typography>
          </Box>
        </Stack>

        {coverage.productionDays > 0 ? (
          <Box sx={{ mt: 1.25 }}>
            <LinearProgress
              variant="determinate"
              value={coveragePct}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'rgba(148,163,184,0.18)',
                '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: tone.fg },
              }}
            />
          </Box>
        ) : null}
      </Box>

      {/* ── Hullene, med en knapp for å tette dem ───────────────────────── */}
      {coverage.daysMissingShifts.length > 0 ? (
        <RoleCard sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <EventBusyIcon sx={{ color: '#fcd34d', fontSize: 20 }} />
            <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
              Opptaksdager uten registrerte vakter
            </Typography>
          </Stack>
          <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.86rem', mb: 1.5 }}>
            Vaktene lages fra dagens egen innkalling og wrap — du trenger ikke fylle inn tidene på
            nytt. Alle på dagen får vakt: crew fra bemanningen, cast fra scenene som er lagt til.
          </Typography>

          {generate.isError ? (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {generate.error instanceof Error ? generate.error.message : 'Kunne ikke generere vakter'}
            </Alert>
          ) : null}

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {coverage.daysMissingShifts.map((day) => (
              <Button
                key={day.id}
                size="small"
                variant="outlined"
                disabled={readOnly || generate.isPending}
                onClick={() => generate.mutate(day.id)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#fde68a',
                  borderColor: 'rgba(252,211,77,0.45)',
                  '&:hover': { borderColor: 'rgba(252,211,77,0.85)', background: 'rgba(251,191,36,0.08)' },
                }}
              >
                {`Generer vakter — ${formatDate(day.date)}`}
              </Button>
            ))}
          </Stack>
        </RoleCard>
      ) : null}

      {/* ── Funnene, per person ─────────────────────────────────────────── */}
      {report.people.length > 0 ? (
        <Stack spacing={1.25}>
          {[...report.people]
            // Den som har brudd må sees først; deretter advarsler.
            .sort((a, b) => b.violations - a.violations || b.warnings - a.warnings)
            .map((person) => (
              <RoleCard key={`${person.person}:${person.ruleSet}`} sx={{ p: 2 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                  justifyContent="space-between"
                  sx={{ mb: person.findings.length > 0 ? 1.25 : 0 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>{person.person}</Typography>
                    <Chip
                      size="small"
                      label={RULE_SET_LABELS[person.ruleSet]}
                      sx={{
                        height: 22,
                        bgcolor: person.ruleSet === 'unknown' ? 'rgba(148,163,184,0.18)' : 'rgba(56,189,248,0.16)',
                        color: person.ruleSet === 'unknown' ? '#cbd5e1' : '#bae6fd',
                      }}
                    />
                    {person.ageAtShoot !== undefined ? (
                      <Tooltip title="Alder på opptaksdagen — ikke i dag. Grensene i kap. 11 følger den.">
                        <Chip
                          size="small"
                          label={`${person.ageAtShoot} år`}
                          sx={{ height: 22, bgcolor: 'rgba(148,163,184,0.14)', color: '#e2e8f0' }}
                        />
                      </Tooltip>
                    ) : null}
                  </Stack>
                  <Stack direction="row" spacing={0.75}>
                    <Chip
                      size="small"
                      label={`${person.totalHours} t`}
                      sx={{ height: 22, bgcolor: 'rgba(148,163,184,0.14)', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}
                    />
                    {person.violations > 0 ? (
                      <Chip size="small" label={`${person.violations} brudd`}
                        sx={{ height: 22, bgcolor: 'rgba(248,113,113,0.18)', color: '#fca5a5', fontWeight: 700 }} />
                    ) : null}
                    {person.warnings > 0 ? (
                      <Chip size="small" label={`${person.warnings} advarsel`}
                        sx={{ height: 22, bgcolor: 'rgba(251,191,36,0.18)', color: '#fde68a', fontWeight: 700 }} />
                    ) : null}
                    {person.findings.length === 0 ? (
                      <Chip size="small" label="Ingen funn"
                        sx={{ height: 22, bgcolor: 'rgba(74,222,128,0.16)', color: '#86efac' }} />
                    ) : null}
                  </Stack>
                </Stack>

                <Stack spacing={0.75}>
                  {person.findings.map((finding, index) => (
                    <Box
                      key={`${finding.code}:${finding.shiftLabel ?? index}`}
                      sx={{
                        p: 1,
                        borderRadius: 1.25,
                        borderLeft: `3px solid ${finding.severity === 'violation' ? '#f87171' : '#fbbf24'}`,
                        background: 'rgba(2,6,23,0.42)',
                      }}
                    >
                      <Typography sx={{ color: 'rgba(241,245,249,0.94)', fontSize: '0.88rem' }}>
                        {finding.message}
                      </Typography>
                      <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                        {/* Paragrafen er ikke pynt: den som skal utfordre eller
                            etterleve varselet må kunne slå det opp selv. */}
                        <Chip size="small" label={finding.reference}
                          sx={{ height: 20, bgcolor: 'rgba(148,163,184,0.14)', color: '#cbd5e1', fontSize: '0.7rem' }} />
                        {finding.shiftLabel ? (
                          <Chip size="small" label={finding.shiftLabel}
                            sx={{ height: 20, bgcolor: 'rgba(148,163,184,0.1)', color: 'rgba(203,213,225,0.8)', fontSize: '0.7rem' }} />
                        ) : null}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </RoleCard>
            ))}
        </Stack>
      ) : null}

      <Divider sx={{ borderColor: 'rgba(148,163,184,0.18)' }} />
      <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.78rem', lineHeight: 1.6 }}>
        {report.disclaimer}
      </Typography>
    </Stack>
  );
};

export default WorkTimeCompliancePanel;
