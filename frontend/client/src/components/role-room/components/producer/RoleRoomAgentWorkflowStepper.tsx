import { Box, Stack, Tooltip, Typography } from '@mui/material';
import {
  AutoFixHigh as AnalyzeIcon,
  Rocket as PlanIcon,
  CloudUpload as PublishIcon,
  MoveToInbox as ListenIcon,
  QueryStats as MeasureIcon,
} from '@mui/icons-material';

export type RoleRoomAgentPhase = 'analyze' | 'plan' | 'publish' | 'listen' | 'measure';

const PHASES: Array<{
  id: RoleRoomAgentPhase;
  label: string;
  caption: string;
  icon: React.ReactElement;
  tabs: string[];
}> = [
  {
    id: 'analyze',
    label: 'Analyze',
    caption: 'Forstå bedriften',
    icon: <AnalyzeIcon fontSize="small" />,
    tabs: ['research', 'meta-page'],
  },
  {
    id: 'plan',
    label: 'Plan',
    caption: 'Strategi + posts',
    icon: <PlanIcon fontSize="small" />,
    tabs: ['marketing-plan', 'feed-planner'],
  },
  {
    id: 'publish',
    label: 'Publish',
    caption: 'På tvers av plattformer',
    icon: <PublishIcon fontSize="small" />,
    tabs: ['fb-publish', 'fb-mention', 'page-content'],
  },
  {
    id: 'listen',
    label: 'Listen',
    caption: 'Inbox + sentiment',
    icon: <ListenIcon fontSize="small" />,
    tabs: ['social-inbox'],
  },
  {
    id: 'measure',
    label: 'Measure',
    caption: 'Analytics',
    icon: <MeasureIcon fontSize="small" />,
    tabs: ['social-analytics', 'ads-attribution'],
  },
];

export function phaseFromTab(tab: string | null | undefined): RoleRoomAgentPhase | null {
  if (!tab) return null;
  for (const phase of PHASES) {
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
  const activePhase = phaseFromTab(activeTab);

  return (
    <Stack
      direction="row"
      spacing={0}
      alignItems="stretch"
      data-testid="role-room-agent-workflow-stepper"
      sx={{
        px: { xs: 1, md: 2 },
        py: 1,
        bgcolor: 'rgba(15,23,42,0.55)',
        borderBottom: '1px solid rgba(148,163,184,0.18)',
        overflowX: 'auto',
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
            <Tooltip title={`Gå til ${phase.label}`} disableInteractive>
              <Box
                role={onJump ? 'button' : undefined}
                tabIndex={onJump ? 0 : -1}
                onClick={() => onJump?.(phase.tabs[0])}
                onKeyDown={(e) => {
                  if (onJump && (e.key === 'Enter' || e.key === ' ')) onJump(phase.tabs[0]);
                }}
                data-testid={`workflow-step-${phase.id}`}
                data-active={isActive ? 'true' : 'false'}
                sx={{
                  flex: '1 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: { xs: 1, md: 1.4 },
                  py: 0.6,
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
                      ? '#22d3ee'
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
                >
                  {phase.icon}
                </Box>
                <Stack spacing={0} sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      color: isActive ? '#22d3ee' : '#e2e8f0',
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
