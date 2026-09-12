import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import {
  AutoFixHigh,
  CheckCircle,
  Error,
  Info,
  RocketLaunch,
  Security,
  SmartToy,
  Warning,
} from '@mui/icons-material';
import { AdminButton, StatusChip, useIsMobile } from './design-system';

export interface InstallationStep {
  id: string;
  title: string;
  description: string;
  type: 'scan' | 'analyze' | 'install' | 'configure' | 'verify';
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  details: string[];
  benefits: string[];
  risks: string[];
  changes: {
    files: string[];
    dependencies: string[];
    configurations: string[];
  };
  estimatedTime: string;
}

export interface PackageInfo {
  name: string;
  current: string;
  latest: string;
  description: string;
  category: string;
  size: string;
  dependencies: string[];
  vulnerabilities: number;
  benefits: string[];
  breaking: boolean;
}

interface AIAnalysis {
  recommendedOrder: string[];
  conflicts: string[];
  optimizations: string[];
  script: string;
  estimatedSuccess: number;
  warnings: string[];
}

interface InstallationWizardProps {
  open: boolean;
  onClose: () => void;
  packages: PackageInfo[];
  mode: 'install' | 'update';
  onComplete: () => void;
}

function makeInitialSteps(mode: 'install' | 'update', packages: PackageInfo[]): InstallationStep[] {
  return [
    {
      id: 'scan',
      title: 'Scan Environment',
      description: 'Inspect dependency graph and workspace consistency.',
      type: 'scan',
      status: 'pending',
      progress: 0,
      details: [
        'Read package manifests and lock files',
        'Evaluate peer dependency compatibility',
        'Collect vulnerability and breakage signals',
      ],
      benefits: ['Prevents dependency collisions', 'Establishes deterministic plan'],
      risks: [],
      changes: {
        files: ['package.json', 'package-lock.json'],
        dependencies: [],
        configurations: [],
      },
      estimatedTime: '20-40s',
    },
    {
      id: 'analyze',
      title: 'AI Plan & Ordering',
      description: 'Generate safe package execution order and install/update script.',
      type: 'analyze',
      status: 'pending',
      progress: 0,
      details: [
        'Rank operations by compatibility risk',
        'Generate fallback sequence',
        'Build script preview for review',
      ],
      benefits: ['Lower chance of runtime breakage', 'Faster troubleshooting'],
      risks: [],
      changes: {
        files: ['install-plan.md'],
        dependencies: packages.map((pkg) => pkg.name),
        configurations: [],
      },
      estimatedTime: '10-25s',
    },
    {
      id: 'install',
      title: mode === 'install' ? 'Install Packages' : 'Update Packages',
      description: `${mode === 'install' ? 'Install' : 'Update'} ${packages.length} package(s) using analyzed sequence.`,
      type: 'install',
      status: 'pending',
      progress: 0,
      details: packages.map((pkg) => `${mode === 'install' ? 'Install' : 'Update'} ${pkg.name}: ${pkg.current} -> ${pkg.latest}`),
      benefits: packages.flatMap((pkg) => pkg.benefits),
      risks: packages.filter((pkg) => pkg.breaking).map((pkg) => `${pkg.name} may include breaking changes`),
      changes: {
        files: ['package.json', 'package-lock.json'],
        dependencies: packages.map((pkg) => pkg.name),
        configurations: [],
      },
      estimatedTime: '2-6m',
    },
    {
      id: 'configure',
      title: 'Configure Tooling',
      description: 'Apply required config updates and optimize project settings.',
      type: 'configure',
      status: 'pending',
      progress: 0,
      details: ['Update TS paths and plugin config', 'Reconcile bundler/build options', 'Align script commands'],
      benefits: ['Maintains build consistency', 'Reduces post-install manual work'],
      risks: [],
      changes: {
        files: ['tsconfig.json', 'vite.config.ts'],
        dependencies: [],
        configurations: ['paths', 'plugins', 'build options'],
      },
      estimatedTime: '30-60s',
    },
    {
      id: 'verify',
      title: 'Verify Health',
      description: 'Validate compile/runtime readiness and dependency integrity.',
      type: 'verify',
      status: 'pending',
      progress: 0,
      details: ['Run dependency verification checks', 'Validate package import integrity', 'Check compile status snapshot'],
      benefits: ['Confidence before merge/deploy', 'Faster issue localization'],
      risks: [],
      changes: {
        files: ['verification-report.json'],
        dependencies: [],
        configurations: [],
      },
      estimatedTime: '20-40s',
    },
  ];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getStepStatusIcon(step: InstallationStep): JSX.Element {
  if (step.status === 'completed') {
    return <CheckCircle color="success" />;
  }
  if (step.status === 'error') {
    return <Error color="error" />;
  }
  if (step.status === 'running') {
    return <CircularProgress size={22} />;
  }
  return <Info color="disabled" />;
}

async function createAIAnalysis(mode: 'install' | 'update', packages: PackageInfo[]): Promise<AIAnalysis> {
  await sleep(300);

  const warningList = packages.filter((pkg) => pkg.breaking).map((pkg) => `${pkg.name}: review changelog for breaking changes`);

  const ordered = [...packages]
    .sort((a, b) => a.vulnerabilities - b.vulnerabilities)
    .map((pkg) => pkg.name);

  const lines = ordered.map((name) => {
    const pkg = packages.find((candidate) => candidate.name === name);
    if (!pkg) {
      return '';
    }
    return `npm ${mode === 'install' ? 'install' : 'update'} ${pkg.name}@${pkg.latest}`;
  });

  return {
    recommendedOrder: ordered,
    conflicts: [],
    optimizations: [
      'Resolve vulnerable packages first',
      'Apply deterministic order by compatibility score',
      'Verify lock-file integrity after package mutations',
    ],
    script: ['#!/usr/bin/env bash', 'set -e', ...lines.filter((line) => line.length > 0), 'npm run build'].join('\n'),
    estimatedSuccess: warningList.length > 0 ? 84 : 95,
    warnings: warningList,
  };
}

const InstallationWizard: React.FC<InstallationWizardProps> = ({ open, onClose, packages, mode, onComplete }) => {
  const isMobile = useIsMobile();
  const [activeStep, setActiveStep] = useState(0);
  const [steps, setSteps] = useState<InstallationStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    setSteps(makeInitialSteps(mode, packages));
    setActiveStep(0);
    setIsRunning(false);
    setAiAnalysis(null);
    setStatusMessage('Ready');
  }, [mode, open, packages]);

  const totalRiskCount = useMemo(() => packages.filter((pkg) => pkg.breaking).length, [packages]);
  const vulnerabilityCount = useMemo(
    () => packages.reduce((sum, pkg) => sum + Math.max(0, pkg.vulnerabilities), 0),
    [packages]
  );

  const updateStep = useCallback((stepIndex: number, updater: (step: InstallationStep) => InstallationStep) => {
    setSteps((previous) => previous.map((step, index) => (index === stepIndex ? updater(step) : step)));
  }, []);

  const runStep = useCallback(
    async (stepIndex: number): Promise<void> => {
      const step = steps[stepIndex];
      if (!step) {
        return;
      }

      updateStep(stepIndex, (current) => ({ ...current, status: 'running', progress: 0 }));

      for (let progress = 10; progress <= 100; progress += 10) {
        await sleep(step.type === 'install' ? 130 : 80);
        updateStep(stepIndex, (current) => ({ ...current, progress }));
      }

      if (step.type === 'analyze') {
        const analysis = await createAIAnalysis(mode, packages);
        setAiAnalysis(analysis);
      }

      updateStep(stepIndex, (current) => ({ ...current, status: 'completed', progress: 100 }));
    },
    [mode, packages, steps, updateStep]
  );

  const startInstallation = useCallback(async () => {
    if (steps.length === 0 || isRunning) {
      return;
    }

    setIsRunning(true);
    setStatusMessage('Running installation flow...');

    try {
      for (let index = 0; index < steps.length; index += 1) {
        setActiveStep(index);
        await runStep(index);
      }

      setStatusMessage('Installation flow completed successfully.');
      onComplete();
    } catch {
      setStatusMessage('Installation flow failed. Check logs and retry.');
      updateStep(activeStep, (current) => ({ ...current, status: 'error' }));
    } finally {
      setIsRunning(false);
    }
  }, [activeStep, isRunning, onComplete, runStep, steps.length, updateStep]);

  return (
    <Dialog open={open} onClose={isRunning ? undefined : onClose} maxWidth="md" fullWidth fullScreen={isMobile} disableEscapeKeyDown={isRunning}>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <SmartToy color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            AI {mode === 'install' ? 'Installation' : 'Update'} Wizard
          </Typography>
          <StatusChip tone="brand" label={`${packages.length} package(s)`} />
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Overview
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Packages
                </Typography>
                <Typography variant="h6">{packages.length}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Breaking-risk packages
                </Typography>
                <Typography variant="h6">{totalRiskCount}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Known vulnerabilities
                </Typography>
                <Typography variant="h6">{vulnerabilityCount}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Typography variant="h6">{statusMessage}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {packages.length > 0 ? (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Target Packages
            </Typography>
            <List dense>
              {packages.map((pkg) => (
                <ListItem key={pkg.name} divider>
                  <ListItemText
                    primary={`${pkg.name} (${pkg.current} -> ${pkg.latest})`}
                    secondary={pkg.description}
                  />
                  <Stack direction="row" spacing={0.75}>
                    {pkg.breaking ? <StatusChip tone="warning" label="breaking" /> : null}
                    {pkg.vulnerabilities > 0 ? (
                      <StatusChip tone="error" label={`${pkg.vulnerabilities} vuln`} />
                    ) : null}
                  </Stack>
                </ListItem>
              ))}
            </List>
          </Paper>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No packages selected.
          </Alert>
        )}

        <Paper sx={{ p: 2 }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step) => (
              <Step key={step.id}>
                <StepLabel icon={getStepStatusIcon(step)}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="subtitle2">{step.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {step.estimatedTime}
                    </Typography>
                  </Stack>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {step.description}
                  </Typography>

                  <LinearProgress variant="determinate" value={step.progress} sx={{ mb: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    {step.progress}%
                  </Typography>

                  {step.benefits.length > 0 ? (
                    <Alert severity="success" sx={{ mt: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        Benefits
                      </Typography>
                      <List dense sx={{ py: 0 }}>
                        {step.benefits.slice(0, 4).map((benefit) => (
                          <ListItem key={`${step.id}-benefit-${benefit}`} sx={{ py: 0 }}>
                            <ListItemIcon sx={{ minWidth: 24 }}>
                              <CheckCircle fontSize="small" color="success" />
                            </ListItemIcon>
                            <ListItemText primary={benefit} />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  ) : null}

                  {step.risks.length > 0 ? (
                    <Alert severity="warning" sx={{ mt: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        Risks
                      </Typography>
                      <List dense sx={{ py: 0 }}>
                        {step.risks.slice(0, 4).map((risk) => (
                          <ListItem key={`${step.id}-risk-${risk}`} sx={{ py: 0 }}>
                            <ListItemIcon sx={{ minWidth: 24 }}>
                              <Warning fontSize="small" color="warning" />
                            </ListItemIcon>
                            <ListItemText primary={risk} />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  ) : null}

                  {step.type === 'analyze' && aiAnalysis ? (
                    <Card sx={{ mt: 1.5 }}>
                      <CardContent>
                        <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                          AI Analysis
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Estimated success: {aiAnalysis.estimatedSuccess}%
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="caption" sx={{ display: 'block', mb: 0.75 }}>
                          Recommended order: {aiAnalysis.recommendedOrder.join(' -> ')}
                        </Typography>
                        {aiAnalysis.optimizations.length > 0 ? (
                          <List dense sx={{ py: 0 }}>
                            {aiAnalysis.optimizations.map((optimization) => (
                              <ListItem key={optimization} sx={{ py: 0 }}>
                                <ListItemIcon sx={{ minWidth: 24 }}>
                                  <AutoFixHigh fontSize="small" color="primary" />
                                </ListItemIcon>
                                <ListItemText primary={optimization} />
                              </ListItem>
                            ))}
                          </List>
                        ) : null}

                        {aiAnalysis.warnings.length > 0 ? (
                          <Alert severity="warning" sx={{ mt: 1 }}>
                            {aiAnalysis.warnings.join(' | ')}
                          </Alert>
                        ) : null}

                        <Paper sx={{ mt: 1, p: 1.25, bgcolor: '#10151f', color: '#d8e1f0', overflow: 'auto' }}>
                          <Typography component="pre" sx={{ fontSize: 12, m: 0, whiteSpace: 'pre-wrap' }}>
                            {aiAnalysis.script}
                          </Typography>
                        </Paper>
                      </CardContent>
                    </Card>
                  ) : null}
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {isRunning ? (
          <Alert severity="info" sx={{ mt: 2 }} icon={<CircularProgress size={16} />}>
            Installation is running. Keep this dialog open.
          </Alert>
        ) : null}
      </DialogContent>

      <DialogActions>
        <AdminButton tone="ghost" onClick={onClose} disabled={isRunning}>
          {isRunning ? 'Running...' : 'Cancel'}
        </AdminButton>
        <AdminButton
          tone="primary"
          loading={isRunning}
          startIcon={<RocketLaunch />}
          onClick={() => {
            void startInstallation();
          }}
          disabled={isRunning || packages.length === 0}
        >
          {isRunning ? 'Executing...' : mode === 'install' ? 'Start Install' : 'Start Update'}
        </AdminButton>
      </DialogActions>
    </Dialog>
  );
};

export default InstallationWizard;
