// @ts-nocheck
import React from "react";
// WizardStepper - Vertical stepper for project creation wizard
import { Stepper, Step, StepLabel, StepContent, StepIcon, Box, Typography, Button, Stack, Chip } from '@mui/material';
import { useProjectWizard } from '../hooks/useProjectWizard';
import { PROJECT_PHASES } from '../../constants/project';
import { Timeline } from '@mui/icons-material';

interface WizardStepperProps {
  onPhaseChange?: (phase: string) => void;
  currentPhase?: string;
}

export function WizardStepper({ onPhaseChange, currentPhase }: { onPhaseChange?: (phase: string) => void; currentPhase?: string }) {
  const wizard = useProjectWizard();

  const stepLabels = [
    { key: 'basic-info', label: 'Grunninfo', icon: '📋' },
    { key: 'project-type', label: 'Prosjekttype', icon: '🎯' },
    { key: 'location', label: 'Lokasjon', icon: '📍' },
    { key: 'shot-list', label: 'Shot List', icon: '📸' },
    { key: 'memory-cards', label: 'Minnekort', icon: '💾' },
    { key: 'backup', label: 'Backup', icon: '☁️' },
    { key: 'collaborators', label: 'Samarbeid', icon: '👥' },
    { key: 'worklog', label: 'Arbeidstid', icon: '⏱️' },
    { key: 'preview', label: 'Forhåndsvisning', icon: '👁️' },
    { key: 'confirm', label: 'Bekreft', icon: '✅' },
  ];

  const steps = [
    'basic-info',
    'project-type',
    'location',
    'shot-list',
    'memory-cards',
    'backup',
    'collaborators',
    'worklog',
    'preview',
    'confirm',
  ];

  return (
    <div style={{ minWidth: 280 }}>
      <Stepper
        orientation="vertical"
        activeStep={wizard.currentStepIndex}
        alternativeLabel
        connector={null}
      >
        {steps.map((step, index) => {
          const label = stepLabels.find(s => s.key === step);
          const isActive = index === wizard.currentStepIndex;
          const isCompleted = index < wizard.currentStepIndex;

          return (
            <Step key={step} completed={isCompleted}>
              <StepLabel
                StepIconComponent={({ completed, active }) => (
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isActive ? '#1565c0' : completed ? '#4caf50' : 'rgba(255,255,255,0.1)',
                      color: isActive || completed ? '#fff' : 'rgba(255,255,255,0.5)',
                      fontWeight: 700,
                      fontSize: 14,
                      border: isActive ? '2px solid #fff' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {completed ? '✓' : label?.icon || String(index + 1)}
                  </Box>
                )}
                onClick={() => wizard.goToStep(step)}
                sx={{ cursor: 'pointer' }}
              >
                <Typography variant="subtitle2" fontWeight={600}>
                  {label?.label}
                </Typography>
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>
    </div>
  );
}

export default WizardStepper;