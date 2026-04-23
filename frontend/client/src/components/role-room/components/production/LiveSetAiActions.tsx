import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import {
  useLiveSetAi,
  type CoverageCheckResult,
  type ReplanDayResult,
  type ContinuityCheckResult,
  type EndOfDayBrief,
  type LiveSetAiAction,
} from '../../hooks/useLiveSetAi';

type ActionKey = LiveSetAiAction;

interface ShotInput {
  id: string;
  shotType?: string;
  cameraAngle?: string;
  description?: string;
  notes?: string;
  priority?: string;
  status?: string;
  estimatedTime?: number;
  completedAt?: string;
  sceneId?: string;
}

interface Props {
  projectId: string;
  sceneId: string;
  scene: {
    sceneNumber?: string | number;
    heading?: string;
    description?: string;
    intExt?: string;
    timeOfDay?: string;
    characters?: string[];
  };
  shotsCompleted: ShotInput[];
  plannedShots: ShotInput[];
  shotsRemaining: ShotInput[];
  newShot?: ShotInput & { notes: string };
  previousShots?: Array<ShotInput & { notes: string }>;
  dayId: string;
  minutesRemaining: number;
  shotsMissing?: ShotInput[];
  crew?: Array<{ name: string; role?: string; contact?: string }>;
  nextDayFirstCall?: string;
  issues?: string[];
}

const severityColor = (s: string): string => {
  if (s === 'critical') return '#f87171';
  if (s === 'warning' || s === 'recommended') return '#fbbf24';
  if (s === 'info' || s === 'nice-to-have') return '#9ca3af';
  return '#9ca3af';
};

const riskColor = (r: string): string =>
  r === 'high' ? '#f87171' : r === 'medium' ? '#fbbf24' : '#34d399';

export const LiveSetAiActions: React.FC<Props> = (props) => {
  const ai = useLiveSetAi();
  const [open, setOpen] = useState<ActionKey | null>(null);

  const closeDialog = (): void => {
    if (open) ai.reset(open);
    setOpen(null);
  };

  const runAction = (key: ActionKey): void => {
    setOpen(key);
    switch (key) {
      case 'coverage-check':
        void ai.runCoverageCheck({
          projectId: props.projectId,
          sceneId: props.sceneId,
          scene: props.scene,
          shotsCompleted: props.shotsCompleted,
          plannedShots: props.plannedShots,
        });
        break;
      case 'replan-day':
        void ai.runReplanDay({
          projectId: props.projectId,
          dayId: props.dayId,
          shotsCompleted: props.shotsCompleted,
          shotsRemaining: props.shotsRemaining,
          minutesRemaining: props.minutesRemaining,
        });
        break;
      case 'continuity-check':
        if (!props.newShot) return;
        void ai.runContinuityCheck({
          projectId: props.projectId,
          sceneId: props.sceneId,
          newShot: props.newShot,
          previousShots: props.previousShots ?? [],
        });
        break;
      case 'end-of-day':
        void ai.runEndOfDay({
          projectId: props.projectId,
          dayId: props.dayId,
          shotsCompleted: props.shotsCompleted,
          shotsMissing: props.shotsMissing ?? [],
          crew: props.crew ?? [],
          nextDayFirstCall: props.nextDayFirstCall,
          issues: props.issues ?? [],
        });
        break;
    }
  };

  const currentCall =
    open === 'coverage-check'
      ? ai.coverageCheck
      : open === 'replan-day'
        ? ai.replanDay
        : open === 'continuity-check'
          ? ai.continuityCheck
          : open === 'end-of-day'
            ? ai.endOfDay
            : null;

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        data-testid="live-set-ai-actions"
        sx={{
          p: 1,
          borderRadius: 1,
          bgcolor: 'rgba(139,92,246,0.06)',
          border: '1px solid rgba(139,92,246,0.25)',
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <AutoAwesomeIcon sx={{ fontSize: 14, color: '#a78bfa' }} />
          <Typography
            sx={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: 1 }}
          >
            CLAUDE AI
          </Typography>
        </Stack>
        <Button
          size="small"
          data-testid="live-set-ai-coverage"
          onClick={() => runAction('coverage-check')}
          sx={{ textTransform: 'none', color: '#c4b5fd' }}
        >
          Coverage-sjekk
        </Button>
        <Button
          size="small"
          data-testid="live-set-ai-replan"
          onClick={() => runAction('replan-day')}
          sx={{ textTransform: 'none', color: '#c4b5fd' }}
        >
          Re-planlegg
        </Button>
        <Button
          size="small"
          data-testid="live-set-ai-continuity"
          onClick={() => runAction('continuity-check')}
          disabled={!props.newShot}
          sx={{ textTransform: 'none', color: '#c4b5fd' }}
        >
          Kontinuitet
        </Button>
        <Button
          size="small"
          data-testid="live-set-ai-end-of-day"
          onClick={() => runAction('end-of-day')}
          sx={{ textTransform: 'none', color: '#c4b5fd' }}
        >
          Dagsbrief
        </Button>
      </Stack>

      <Dialog
        open={!!open}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e2536', color: '#e5e7eb' } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid #2a3142', pb: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <AutoAwesomeIcon sx={{ color: '#a78bfa', fontSize: 18 }} />
              <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
                {open === 'coverage-check' && 'Coverage-sjekk'}
                {open === 'replan-day' && 'Re-planlegging'}
                {open === 'continuity-check' && 'Kontinuitet'}
                {open === 'end-of-day' && 'Dagsbrief'}
              </Typography>
            </Stack>
            <IconButton onClick={closeDialog} size="small" aria-label="Lukk" sx={{ color: '#9ca3af' }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#2a3142', minHeight: 200 }}>
          {currentCall?.status === 'loading' && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 4, justifyContent: 'center' }}>
              <CircularProgress size={18} />
              <Typography sx={{ color: '#a78bfa' }}>Claude analyserer…</Typography>
            </Stack>
          )}
          {currentCall?.status === 'error' && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {currentCall.error}
            </Alert>
          )}
          {open === 'coverage-check' && currentCall?.status === 'ready' && (
            <CoverageView data={(currentCall as { data: CoverageCheckResult }).data} />
          )}
          {open === 'replan-day' && currentCall?.status === 'ready' && (
            <ReplanView data={(currentCall as { data: ReplanDayResult }).data} />
          )}
          {open === 'continuity-check' && currentCall?.status === 'ready' && (
            <ContinuityView data={(currentCall as { data: ContinuityCheckResult }).data} />
          )}
          {open === 'end-of-day' && currentCall?.status === 'ready' && (
            <EndOfDayView data={(currentCall as { data: EndOfDayBrief }).data} />
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #2a3142' }}>
          <Button onClick={closeDialog} sx={{ color: '#9ca3af' }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ─── sub views ───────────────────────────────────────────────────────────────

const CoverageView: React.FC<{ data: CoverageCheckResult }> = ({ data }) => (
  <Stack spacing={1.5} data-testid="live-set-ai-coverage-result">
    <Chip
      label={
        data.status === 'complete'
          ? 'Coverage OK'
          : data.status === 'gaps'
            ? 'Gaps funnet'
            : 'Kritisk mangler'
      }
      size="small"
      sx={{
        alignSelf: 'flex-start',
        bgcolor: `${severityColor(data.status === 'critical' ? 'critical' : data.status === 'gaps' ? 'warning' : 'info')}20`,
        color: severityColor(data.status === 'critical' ? 'critical' : data.status === 'gaps' ? 'warning' : 'info'),
        border: `1px solid ${severityColor(data.status === 'critical' ? 'critical' : data.status === 'gaps' ? 'warning' : 'info')}55`,
      }}
    />
    {data.summary && (
      <Typography sx={{ fontSize: 13, color: '#cbd5e1' }}>{data.summary}</Typography>
    )}
    {data.missingCoverage.length > 0 && (
      <List dense sx={{ p: 0 }}>
        {data.missingCoverage.map((m, i) => (
          <ListItem key={i} sx={{ px: 0, alignItems: 'flex-start' }}>
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    size="small"
                    label={m.severity}
                    sx={{
                      height: 18,
                      fontSize: 9,
                      bgcolor: `${severityColor(m.severity)}20`,
                      color: severityColor(m.severity),
                      border: `1px solid ${severityColor(m.severity)}55`,
                    }}
                  />
                  <Typography sx={{ fontSize: 12, color: '#e5e7eb', fontWeight: 600 }}>
                    {m.type}
                  </Typography>
                </Stack>
              }
              secondary={
                <Typography sx={{ fontSize: 12, color: '#9ca3af', mt: 0.5 }}>{m.reason}</Typography>
              }
            />
          </ListItem>
        ))}
      </List>
    )}
  </Stack>
);

const ReplanView: React.FC<{ data: ReplanDayResult }> = ({ data }) => (
  <Stack spacing={1.5} data-testid="live-set-ai-replan-result">
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip
        label={`Risiko: ${data.riskLevel}`}
        size="small"
        sx={{
          bgcolor: `${riskColor(data.riskLevel)}20`,
          color: riskColor(data.riskLevel),
          border: `1px solid ${riskColor(data.riskLevel)}55`,
        }}
      />
    </Stack>
    {data.summary && (
      <Typography sx={{ fontSize: 13, color: '#cbd5e1' }}>{data.summary}</Typography>
    )}
    {data.recommendation.keep.length > 0 && (
      <Box>
        <Typography sx={{ fontSize: 11, color: '#34d399', fontWeight: 700, letterSpacing: 1 }}>
          BEHOLD ({data.recommendation.keep.length})
        </Typography>
        <Typography sx={{ fontSize: 12, color: '#cbd5e1' }}>
          {data.recommendation.keep.join(', ')}
        </Typography>
      </Box>
    )}
    {data.recommendation.combine.length > 0 && (
      <Box>
        <Typography sx={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, letterSpacing: 1 }}>
          KOMBINER ({data.recommendation.combine.length})
        </Typography>
        {data.recommendation.combine.map((c, i) => (
          <Typography key={i} sx={{ fontSize: 12, color: '#cbd5e1' }}>
            {c.shotIds.join(' + ')} — {c.note}
          </Typography>
        ))}
      </Box>
    )}
    {data.recommendation.push.length > 0 && (
      <Box>
        <Typography sx={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, letterSpacing: 1 }}>
          SKYV TIL PICKUP ({data.recommendation.push.length})
        </Typography>
        {data.recommendation.push.map((p, i) => (
          <Typography key={i} sx={{ fontSize: 12, color: '#cbd5e1' }}>
            {p.shotId} — {p.suggestedPickupNote}
          </Typography>
        ))}
      </Box>
    )}
    {data.recommendation.drop.length > 0 && (
      <Box>
        <Typography sx={{ fontSize: 11, color: '#f87171', fontWeight: 700, letterSpacing: 1 }}>
          DROPP ({data.recommendation.drop.length})
        </Typography>
        {data.recommendation.drop.map((d, i) => (
          <Typography key={i} sx={{ fontSize: 12, color: '#cbd5e1' }}>
            {d.shotId} — {d.reasoning}
          </Typography>
        ))}
      </Box>
    )}
  </Stack>
);

const ContinuityView: React.FC<{ data: ContinuityCheckResult }> = ({ data }) => (
  <Stack spacing={1.5} data-testid="live-set-ai-continuity-result">
    <Chip
      label={
        data.status === 'clean'
          ? 'Ingen konflikter'
          : data.status === 'warnings'
            ? 'Advarsler'
            : 'Konflikter'
      }
      size="small"
      sx={{
        alignSelf: 'flex-start',
        bgcolor: `${severityColor(data.status === 'conflicts' ? 'critical' : data.status === 'warnings' ? 'warning' : 'info')}20`,
        color: severityColor(data.status === 'conflicts' ? 'critical' : data.status === 'warnings' ? 'warning' : 'info'),
        border: `1px solid ${severityColor(data.status === 'conflicts' ? 'critical' : data.status === 'warnings' ? 'warning' : 'info')}55`,
      }}
    />
    {data.conflicts.length === 0 ? (
      <Typography sx={{ fontSize: 13, color: '#cbd5e1' }}>
        Claude fant ingen continuity-drift mot tidligere shots.
      </Typography>
    ) : (
      <List dense sx={{ p: 0 }}>
        {data.conflicts.map((c, i) => (
          <ListItem key={i} sx={{ px: 0, alignItems: 'flex-start' }}>
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    size="small"
                    label={c.severity}
                    sx={{
                      height: 18,
                      fontSize: 9,
                      bgcolor: `${severityColor(c.severity)}20`,
                      color: severityColor(c.severity),
                      border: `1px solid ${severityColor(c.severity)}55`,
                    }}
                  />
                  <Typography sx={{ fontSize: 12, color: '#e5e7eb', fontWeight: 600 }}>
                    {c.type}
                  </Typography>
                </Stack>
              }
              secondary={
                <Box>
                  <Typography sx={{ fontSize: 12, color: '#cbd5e1', mt: 0.5 }}>
                    {c.description}
                  </Typography>
                  {c.referenceShotIds.length > 0 && (
                    <Typography sx={{ fontSize: 10, color: '#9ca3af', mt: 0.25 }}>
                      Ref: {c.referenceShotIds.join(', ')}
                    </Typography>
                  )}
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>
    )}
  </Stack>
);

const EndOfDayView: React.FC<{ data: EndOfDayBrief }> = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const copyMessage = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(data.crewMessageDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Stack spacing={2} data-testid="live-set-ai-end-of-day-result">
      <Stack direction="row" spacing={2}>
        <Chip
          size="small"
          label={`Ferdig: ${data.summary.shotsCompleted}`}
          sx={{ bgcolor: 'rgba(52,211,153,0.15)', color: '#34d399' }}
        />
        <Chip
          size="small"
          label={`Mangler: ${data.summary.shotsMissing}`}
          sx={{ bgcolor: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
        />
      </Stack>
      {data.summary.highlights.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: 11, color: '#34d399', fontWeight: 700, letterSpacing: 1 }}>
            HØYDEPUNKTER
          </Typography>
          <List dense sx={{ p: 0 }}>
            {data.summary.highlights.map((h, i) => (
              <ListItem key={i} sx={{ px: 0, py: 0.25 }}>
                <ListItemText primary={<Typography sx={{ fontSize: 12 }}>• {h}</Typography>} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
      {data.summary.concerns.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, letterSpacing: 1 }}>
            BEKYMRINGER
          </Typography>
          <List dense sx={{ p: 0 }}>
            {data.summary.concerns.map((c, i) => (
              <ListItem key={i} sx={{ px: 0, py: 0.25 }}>
                <ListItemText primary={<Typography sx={{ fontSize: 12 }}>• {c}</Typography>} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
      {data.tomorrowBrief.priority.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, letterSpacing: 1 }}>
            I MORGEN
          </Typography>
          <List dense sx={{ p: 0 }}>
            {data.tomorrowBrief.priority.map((p, i) => (
              <ListItem key={i} sx={{ px: 0, py: 0.25 }}>
                <ListItemText
                  primary={<Typography sx={{ fontSize: 12 }}>{i + 1}. {p}</Typography>}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
      {data.tomorrowBrief.editorNeeds.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: 11, color: '#a78bfa', fontWeight: 700, letterSpacing: 1 }}>
            KLIPPER TRENGER
          </Typography>
          <List dense sx={{ p: 0 }}>
            {data.tomorrowBrief.editorNeeds.map((n, i) => (
              <ListItem key={i} sx={{ px: 0, py: 0.25 }}>
                <ListItemText primary={<Typography sx={{ fontSize: 12 }}>• {n}</Typography>} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
      {data.crewMessageDraft && (
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1,
            bgcolor: '#0f1318',
            border: '1px solid #2a3142',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, letterSpacing: 1 }}>
              CREW-MELDING (UTKAST)
            </Typography>
            <Button
              size="small"
              startIcon={<CopyIcon sx={{ fontSize: 14 }} />}
              onClick={copyMessage}
              data-testid="live-set-ai-copy-crew-message"
              sx={{ fontSize: 11, textTransform: 'none', color: copied ? '#34d399' : '#a78bfa' }}
            >
              {copied ? 'Kopiert!' : 'Kopier'}
            </Button>
          </Stack>
          <TextField
            fullWidth
            multiline
            value={data.crewMessageDraft}
            InputProps={{ readOnly: true, sx: { color: '#e5e7eb', fontSize: 12 } }}
            variant="standard"
          />
        </Box>
      )}
    </Stack>
  );
};

export default LiveSetAiActions;
