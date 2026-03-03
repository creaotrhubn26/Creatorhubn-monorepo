import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  ExpandLess,
  ExpandMore,
  RadioButtonUnchecked,
  Speed,
  Timer,
  TrendingUp,
} from '@mui/icons-material';

interface ProgressStep {
  name: string;
  description: string;
  completed: boolean;
  startTime?: number;
  endTime?: number;
  quality?: Record<string, number>;
}

interface ProgressData {
  sessionId: string;
  currentStep: string;
  progress: number;
  steps: ProgressStep[];
}

interface ProgressTrackingProps {
  sessionId: string;
  onComplete?: (result: unknown) => void;
  onError?: (error: string) => void;
}

interface ProgressMessage {
  type: 'connected' | 'progress' | 'complete' | 'error';
  sessionId?: string;
  currentStep?: string;
  progress?: number;
  steps?: ProgressStep[];
  result?: unknown;
  error?: string;
}

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

const getStepDuration = (step: ProgressStep): string => {
  if (typeof step.startTime !== 'number' || typeof step.endTime !== 'number') {
    return '-';
  }
  return formatTime(Math.max(0, step.endTime - step.startTime));
};

const clampProgress = (value: number): number => Math.max(0, Math.min(100, value));

export default function ProgressTracking({
  sessionId,
  onComplete,
  onError,
}: ProgressTrackingProps): React.ReactElement {
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    startedAtRef.current = Date.now();
    setElapsedTime(0);

    const eventSource = new EventSource(`/api/photo-enhancer/progress/${encodeURIComponent(sessionId)}`);

    const tick = window.setInterval(() => {
      setElapsedTime(Date.now() - startedAtRef.current);
    }, 1000);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      let parsed: ProgressMessage | null = null;
      try {
        parsed = JSON.parse(event.data) as ProgressMessage;
      } catch {
        onError?.('Kunne ikke lese fremdriftsdata.');
      }

      if (!parsed) {
        return;
      }

      if (parsed.type === 'error') {
        setIsConnected(false);
        onError?.(parsed.error ?? 'Ukjent fremdriftsfeil.');
        return;
      }

      if (parsed.type === 'progress' || parsed.type === 'complete') {
        const nextProgress = clampProgress(parsed.progress ?? 0);
        const nextData: ProgressData = {
          sessionId: parsed.sessionId ?? sessionId,
          currentStep: parsed.currentStep ?? progressData?.currentStep ?? 'Starter...',
          progress: nextProgress,
          steps: parsed.steps ?? progressData?.steps ?? [],
        };
        setProgressData(nextData);

        if (parsed.type === 'complete' || nextProgress >= 100) {
          onComplete?.(parsed.result ?? nextData);
          eventSource.close();
          setIsConnected(false);
        }
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      onError?.('Tilkobling til progress tracking feilet.');
    };

    return () => {
      eventSource.close();
      window.clearInterval(tick);
    };
  }, [sessionId, onComplete, onError]);

  const completedSteps = useMemo(
    () => progressData?.steps.filter((step) => step.completed).length ?? 0,
    [progressData],
  );

  const totalSteps = progressData?.steps.length ?? 0;

  const qualitySummary = useMemo(() => {
    const metrics = (progressData?.steps ?? [])
      .flatMap((step) => Object.entries(step.quality ?? {}))
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number');

    if (metrics.length === 0) {
      return [] as Array<{ key: string; value: number }>;
    }

    const aggregate = new Map<string, number[]>();
    metrics.forEach(([key, value]) => {
      const existing = aggregate.get(key) ?? [];
      existing.push(value);
      aggregate.set(key, existing);
    });

    return Array.from(aggregate.entries()).map(([key, values]) => ({
      key,
      value: values.reduce((sum, current) => sum + current, 0) / values.length,
    }));
  }, [progressData]);

  return (
    <Box sx={{ width: '100%', maxWidth: 900, mx: 'auto', p: 2 }}>
      <Card elevation={3} sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1.5 }}>
            <Speed color="primary" />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              AI Bildeforbedring Pågår
            </Typography>
            <Chip icon={<Timer />} label={formatTime(elapsedTime)} size="small" />
            <Chip
              label={isConnected ? 'Tilkoblet' : 'Kobler til...'}
              color={isConnected ? 'success' : 'warning'}
              size="small"
            />
          </Box>

          {progressData ? (
            <Alert severity="info" icon={<Speed />} sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {progressData.currentStep}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {completedSteps}/{totalSteps} steg fullført
              </Typography>
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              Venter på fremdriftsdata...
            </Alert>
          )}

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Fremgang
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {progressData?.progress ?? 0}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progressData?.progress ?? 0}
              sx={{
                height: 8,
                borderRadius: 4,
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(45deg, #ff8c00 30%, #ffa500 90%)',
                },
              }}
            />
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => setShowDetails((prev) => !prev)}
          >
            <Typography variant="body2" color="text.secondary">
              Steg: {completedSteps} av {totalSteps} fullført
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
              <Typography variant="body2" sx={{ mr: 0.5 }}>
                {showDetails ? 'Skjul detaljer' : 'Vis detaljer'}
              </Typography>
              {showDetails ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Collapse in={showDetails}>
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Detaljert fremgang
            </Typography>

            <List dense>
              {(progressData?.steps ?? []).map((step) => {
                const isCurrent = progressData?.currentStep === step.name;
                return (
                  <ListItem
                    key={step.name}
                    sx={{
                      borderLeft: step.completed ? '4px solid #4caf50' : '4px solid #e0e0e0',
                      backgroundColor: step.completed ? 'rgba(76,175,80,0.08)' : 'transparent',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemIcon>
                      {step.completed ? (
                        <CheckCircle color="success" />
                      ) : (
                        <RadioButtonUnchecked color={isCurrent ? 'primary' : 'disabled'} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: isCurrent ? 700 : 500 }}>
                            {step.name}
                          </Typography>
                          {step.completed ? (
                            <Chip label={getStepDuration(step)} size="small" color="success" variant="outlined" />
                          ) : null}
                        </Box>
                      }
                      secondary={step.description}
                    />
                  </ListItem>
                );
              })}
            </List>

            {qualitySummary.length > 0 ? (
              <Paper elevation={0} sx={{ p: 2, mt: 1, border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TrendingUp color="primary" sx={{ mr: 1 }} />
                  <Typography variant="subtitle2">Kvalitetsmålinger</Typography>
                </Box>
                <Grid container spacing={2}>
                  {qualitySummary.map((metric) => (
                    <Grid item xs={6} md={3} key={metric.key}>
                      <Typography variant="caption" color="text.secondary">
                        {metric.key}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                        {metric.value >= 0 ? '+' : ''}
                        {metric.value.toFixed(1)}%
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            ) : null}
          </CardContent>
        </Card>
      </Collapse>
    </Box>
  );
}
