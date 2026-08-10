import { Box, Stack, Tooltip, Typography } from '@mui/material';
import {
  AutoFixHigh as ResearchIcon,
  Rocket as PlanIcon,
  CloudUpload as PublishIcon,
  MoveToInbox as InboxIcon,
  ContactPage as LeadsIcon,
  QueryStats as MeasureIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useMemo } from 'react';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

export type RoleRoomAgentPhase = 'research' | 'plan' | 'publish' | 'inbox' | 'leads' | 'measure';

// Mirrors the guided tab flow in RoleRoomAgentDialog (research → markedsplan →
// feed-planner → inbox → leads → analytics). Labels match the tab names and
// captions are Norwegian throughout (bestemor-vennlig, ingen språk-miks).
// Each phase's `tabs` also lists the related power-tools so the step lights up
// when the producer is in one of them.
const buildPHASES = (t: TFn): Array<{
  id: RoleRoomAgentPhase;
  label: string;
  caption: string;
  icon: React.ReactElement;
  tabs: string[];
}> => ([
  {
    id: 'research',
    label: 'Research',
    caption: t('agentStepper.s006'),
    icon: <ResearchIcon fontSize="small" />,
    tabs: ['research', 'discovery', 'meta-page', 'page-content'],
  },
  {
    id: 'plan',
    label: t('agentStepper.s009'),
    caption: t('agentStepper.s011'),
    icon: <PlanIcon fontSize="small" />,
    tabs: ['marketing-plan'],
  },
  {
    id: 'publish',
    label: t('agentStepper.s005'),
    caption: t('agentStepper.s008'),
    icon: <PublishIcon fontSize="small" />,
    tabs: ['feed-planner', 'fb-publish'],
  },
  {
    id: 'inbox',
    label: 'Inbox',
    caption: t('agentStepper.s012'),
    icon: <InboxIcon fontSize="small" />,
    tabs: ['social-inbox', 'mentions', 'fb-mention', 'ig-hashtag'],
  },
  {
    id: 'leads',
    label: 'Leads',
    caption: t('agentStepper.s007'),
    icon: <LeadsIcon fontSize="small" />,
    tabs: ['leads', 'events'],
  },
  {
    id: 'measure',
    label: t('agentStepper.s004'),
    caption: t('agentStepper.s010'),
    icon: <MeasureIcon fontSize="small" />,
    tabs: ['social-analytics', 'ads-attribution'],
  },
]);

// Tab → phase mapping, kept language-independent so phaseFromTab stays a pure
// module function (the labels/captions live in buildPHASES, which needs `t`).
const PHASE_TABS: Array<{ id: RoleRoomAgentPhase; tabs: string[] }> = [
  { id: 'research', tabs: ['research', 'discovery', 'meta-page', 'page-content'] },
  { id: 'plan', tabs: ['marketing-plan'] },
  { id: 'publish', tabs: ['feed-planner', 'fb-publish'] },
  { id: 'inbox', tabs: ['social-inbox', 'mentions', 'fb-mention', 'ig-hashtag'] },
  { id: 'leads', tabs: ['leads', 'events'] },
  { id: 'measure', tabs: ['social-analytics', 'ads-attribution'] },
];

export function phaseFromTab(tab: string | null | undefined): RoleRoomAgentPhase | null {
  if (!tab) return null;
  for (const phase of PHASE_TABS) {
    if (phase.tabs.includes(tab)) return phase.id;
  }
  return null;
}

export interface RoleRoomAgentWorkflowStepperProps {
  activeTab: string | null;
  onJump?: (firstTabOfPhase: string) => void;
}

export default function RoleRoomAgentWorkflowStepper({
  activeTab,
  onJump,
}: RoleRoomAgentWorkflowStepperProps): React.ReactElement {
  const { t } = useT();
  const PHASES = useMemo(() => buildPHASES(t), [t]);
  const activePhase = phaseFromTab(activeTab);

  return (
    <Stack
      direction="row"
      spacing={0}
      alignItems="stretch"
      data-testid="role-room-agent-workflow-stepper"
      role="list"
      aria-label={t('agentStepper.s013')}
      sx={{
        px: { xs: 1, md: 2 },
        py: 1.25,
        bgcolor: 'rgba(15,23,42,0.55)',
        borderBottom: '1px solid rgba(148,163,184,0.18)',
        overflowX: 'auto',
        flexShrink: 0, // don't get squished when the dialog content is tall
      }}
    >
      {PHASES.map((phase, idx) => {
        const isActive = activePhase === phase.id;
        const isPast = activePhase != null && PHASES.findIndex((p) => p.id === activePhase) > idx;
        return (
          <Stack
            key={phase.id}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ flex: '1 0 auto', minWidth: 0 }}
          >
            <Tooltip
              title={t('agentStepper.p00', { v0: phase.label, v1: isActive ? t('agentStepper.s000') : isPast ? t('agentStepper.s002') : '' })}
              disableInteractive
            >
              <Box
                role={onJump ? 'button' : 'listitem'}
                tabIndex={onJump ? 0 : -1}
                aria-current={isActive ? 'step' : undefined}
                aria-label={t('agentStepper.p01', { v0: idx + 1, v1: PHASES.length, v2: phase.label, v3: phase.caption, v4: isActive ? t('agentStepper.s001') : isPast ? t('agentStepper.s002') : t('agentStepper.s003') })}
                onClick={() => onJump?.(phase.tabs[0])}
                onKeyDown={(e) => {
                  if (onJump && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onJump(phase.tabs[0]);
                  }
                }}
                data-testid={`workflow-step-${phase.id}`}
                data-active={isActive ? 'true' : 'false'}
                sx={{
                  flex: '1 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: { xs: 1, md: 1.4 },
                  py: 0.75,
                  borderRadius: 1.4,
                  cursor: onJump ? 'pointer' : 'default',
                  border: isActive
                    ? '1px solid rgba(34,211,238,0.55)'
                    : '1px solid transparent',
                  bgcolor: isActive
                    ? 'rgba(34,211,238,0.10)'
                    : isPast
                      ? 'rgba(134,239,172,0.05)'
                      : 'transparent',
                  transition: 'all .15s ease',
                  '&:hover': onJump
                    ? {
                        bgcolor: isActive
                          ? 'rgba(34,211,238,0.18)'
                          : 'rgba(148,163,184,0.08)',
                      }
                    : undefined,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    bgcolor: isActive
                      ? 'var(--role-cyan, #22d3ee)'
                      : isPast
                        ? 'rgba(134,239,172,0.18)'
                        : 'rgba(148,163,184,0.18)',
                    color: isActive
                      ? '#0f172a'
                      : isPast
                        ? '#86efac'
                        : 'rgba(226,232,240,0.7)',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  {isPast ? <CheckIcon fontSize="small" /> : phase.icon}
                </Box>
                <Stack spacing={0} sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      color: isActive ? 'var(--role-cyan, #22d3ee)' : '#e2e8f0',
                      fontSize: { xs: '0.74rem', md: '0.82rem' },
                      fontWeight: 700,
                      lineHeight: 1.1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {idx + 1}. {phase.label}
                  </Typography>
                  <Typography
                    sx={{
                      color: 'rgba(226,232,240,0.55)',
                      fontSize: { xs: '0.6rem', md: '0.66rem' },
                      lineHeight: 1.1,
                      display: { xs: 'none', md: 'block' },
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {phase.caption}
                  </Typography>
                </Stack>
              </Box>
            </Tooltip>
            {idx < PHASES.length - 1 ? (
              <Box
                sx={{
                  flex: '0 0 auto',
                  height: 1,
                  width: { xs: 8, md: 18 },
                  bgcolor: isPast ? 'rgba(134,239,172,0.4)' : 'rgba(148,163,184,0.25)',
                }}
              />
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}
