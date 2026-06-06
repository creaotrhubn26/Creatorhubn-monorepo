/**
 * ContentProducerWorkflowStepper — visualisering av content-producer-pipeline.
 *
 * 6 faser: Brief → Story → Storyboard → Klient → Levering → Økonomi.
 * Aktivt steg utledes fra hvilken planner-surface (+ workspace) brukeren
 * jobber i akkurat nå. Hver step er klikkbar og navigerer dit.
 */

import { useMemo, type ComponentType } from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import {
  Description as DescriptionIcon,
  AutoStories as StoryIcon,
  CollectionsBookmark as StoryboardIcon,
  CheckCircleOutline as ApprovalIcon,
  LocalShipping as DeliveryIcon,
  Paid as EconomyIcon,
  CheckCircle as CheckCircleFilledIcon,
} from '@mui/icons-material';

export type WorkflowStepKey = 'brief' | 'story' | 'storyboard' | 'approval' | 'delivery' | 'economy';

export type WorkflowApprovalStatus =
  | 'planning'
  | 'awaiting_client'
  | 'changes_requested'
  | 'approved'
  | null;

interface WorkflowStepDefinition {
  key: WorkflowStepKey;
  label: string;
  description: string;
  icon: ComponentType<{ sx?: object }>;
}

const WORKFLOW_STEPS: ReadonlyArray<WorkflowStepDefinition> = [
  {
    key: 'brief',
    label: 'Brief',
    description: 'Klient-brief, branding-input og prosjekt-grunnlag.',
    icon: DescriptionIcon,
  },
  {
    key: 'story',
    label: 'Story',
    description: 'Story logic, manus og scene-oppbygging.',
    icon: StoryIcon,
  },
  {
    key: 'storyboard',
    label: 'Storyboard',
    description: 'Visuell planlegging av hver shot.',
    icon: StoryboardIcon,
  },
  {
    key: 'approval',
    label: 'Klient',
    description: 'Klient-godkjenning og endringskommentarer.',
    icon: ApprovalIcon,
  },
  {
    key: 'delivery',
    label: 'Levering',
    description: 'Eksport og overlevering til klient.',
    icon: DeliveryIcon,
  },
  {
    key: 'economy',
    label: 'Økonomi',
    description: 'Budsjett, fakturering og kommersielle beslutninger.',
    icon: EconomyIcon,
  },
];

interface ContentProducerWorkflowStepperProps {
  /** Hvilket steg er aktivt nå. Null → ingen highlight. */
  activeStep: WorkflowStepKey | null;
  /** Hvilke steg betraktes som fullført (vises med check-ikon). */
  completedSteps?: ReadonlyArray<WorkflowStepKey>;
  /** Klient-status for å vise badge på Klient-steget. */
  approvalStatus?: WorkflowApprovalStatus;
  onSelectStep: (step: WorkflowStepKey) => void;
  /** Skjul komponenten helt (f.eks. ved Live Set fullskjerm). */
  hidden?: boolean;
}

const APPROVAL_BADGE_CONFIG: Record<NonNullable<WorkflowApprovalStatus>, { label: string; bg: string; color: string; hint: string }> = {
  planning: {
    label: 'Planlegging',
    bg: 'rgba(148,163,184,0.18)',
    color: '#cbd5e1',
    hint: 'Ikke sendt til klient ennå. Åpne Klient-steget for å sende en godkjenningsforespørsel.',
  },
  awaiting_client: {
    label: 'Sendt til klient',
    bg: 'rgba(59,130,246,0.18)',
    color: '#bfdbfe',
    hint: 'Sendt til klient — venter på tilbakemelding. Klikk for å se status og purre.',
  },
  changes_requested: {
    label: 'Endringer ønsket',
    bg: 'rgba(251,146,60,0.2)',
    color: '#fed7aa',
    hint: 'Klienten har bedt om endringer. Åpne Klient-steget for å se kommentarene og sende på nytt.',
  },
  approved: {
    label: 'Godkjent',
    bg: 'rgba(34,197,94,0.2)',
    color: '#bbf7d0',
    hint: 'Klienten har godkjent. Du kan gå videre til Levering.',
  },
};

export const ContentProducerWorkflowStepper = ({
  activeStep,
  completedSteps = [],
  approvalStatus,
  onSelectStep,
  hidden,
}: ContentProducerWorkflowStepperProps) => {
  const completedSet = useMemo(() => new Set(completedSteps), [completedSteps]);

  if (hidden) return null;

  return (
    <Box
      role="navigation"
      aria-label="Content-producer workflow"
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        px: { xs: 1, sm: 1.75 },
        py: { xs: 1, sm: 1.25 },
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        bgcolor: 'rgba(15,23,42,0.55)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {WORKFLOW_STEPS.map((step, index) => {
        const isActive = activeStep === step.key;
        const isCompleted = completedSet.has(step.key);
        const isLast = index === WORKFLOW_STEPS.length - 1;
        const StepIcon = isCompleted ? CheckCircleFilledIcon : step.icon;
        // Klient-steget: vis det forklarende status-hintet i tooltip så Stig
        // forstår hva «Sendt til klient» / «Endringer ønsket» betyr og hva han gjør nå.
        const approvalHint =
          step.key === 'approval' && approvalStatus ? APPROVAL_BADGE_CONFIG[approvalStatus]?.hint : undefined;
        const tooltipTitle = approvalHint ?? step.description;

        const stateColor = isActive
          ? '#b86bff'
          : isCompleted
            ? '#4ade80'
            : 'rgba(255,255,255,0.45)';

        return (
          <Box
            key={step.key}
            sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <Tooltip title={tooltipTitle} placement="bottom" arrow>
              <Box
                component="button"
                type="button"
                onClick={() => onSelectStep(step.key)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${index + 1}. ${step.label}${isActive ? ' (nåværende)' : ''}${isCompleted ? ' (fullført)' : ''}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: { xs: 0.9, sm: 1.2 },
                  py: 0.6,
                  border: 'none',
                  background: isActive ? 'rgba(184,107,255,0.14)' : 'transparent',
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  color: stateColor,
                  fontFamily: 'inherit',
                  transition: 'background 120ms, color 120ms',
                  '&:hover': {
                    background: isActive ? 'rgba(184,107,255,0.2)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.85)',
                  },
                  '&:focus-visible': {
                    outline: '2px solid rgba(184,107,255,0.6)',
                    outlineOffset: 2,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isActive
                      ? '#b86bff'
                      : isCompleted
                        ? 'rgba(34,197,94,0.18)'
                        : 'rgba(255,255,255,0.06)',
                    color: isActive ? '#fff' : stateColor,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  {isCompleted ? (
                    <StepIcon sx={{ fontSize: 14 }} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography
                    sx={{
                      fontSize: { xs: '0.74rem', sm: '0.82rem' },
                      fontWeight: isActive ? 700 : 500,
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.label}
                  </Typography>
                  {step.key === 'approval' && approvalStatus && APPROVAL_BADGE_CONFIG[approvalStatus] && (
                    <Chip
                      label={APPROVAL_BADGE_CONFIG[approvalStatus].label}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        ml: 0.25,
                        bgcolor: APPROVAL_BADGE_CONFIG[approvalStatus].bg,
                        color: APPROVAL_BADGE_CONFIG[approvalStatus].color,
                        fontWeight: 600,
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Tooltip>
            {!isLast && (
              <Box
                aria-hidden
                sx={{
                  width: { xs: 14, sm: 20 },
                  height: 1,
                  mx: { xs: 0.25, sm: 0.5 },
                  bgcolor: 'rgba(255,255,255,0.18)',
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default ContentProducerWorkflowStepper;
