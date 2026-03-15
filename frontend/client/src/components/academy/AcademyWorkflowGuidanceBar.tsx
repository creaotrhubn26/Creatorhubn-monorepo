import { ErrorOutline, LightbulbOutlined, WarningAmber } from '@mui/icons-material';
import { Box, Button, Chip, CircularProgress, MenuItem, Select, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ACADEMY_WORKFLOW_INTENTS,
  type AcademyWorkflowIntentId,
  type AcademyWorkflowStepId,
} from './academyToolCore';

type TtFn = (norwegianText: string, englishText: string) => string;

export type AcademyWorkflowMicroHint = {
  messageNo: string;
  messageEn: string;
  tone?: 'info' | 'warning' | 'error';
  actionLabelNo?: string;
  actionLabelEn?: string;
  onAction?: () => void;
};

type AcademyWorkflowGuidanceBarProps = {
  tt: TtFn;
  activeStep: AcademyWorkflowStepId;
  intent: AcademyWorkflowIntentId;
  onIntentChange: (intent: AcademyWorkflowIntentId) => void;
  onApplyIntent: (intent: AcademyWorkflowIntentId) => void;
  applyLabelNo?: string;
  applyLabelEn?: string;
  isApplyingIntent?: boolean;
  applyingStatusLabelNo?: string;
  applyingStatusLabelEn?: string;
  showMicroHints: boolean;
  microHint?: AcademyWorkflowMicroHint | null;
};

const toneColor = (tone: AcademyWorkflowMicroHint['tone']): string => {
  if (tone === 'error') return '#ff9a8f';
  if (tone === 'warning') return '#f8d675';
  return '#9ec8ff';
};

const toneBg = (tone: AcademyWorkflowMicroHint['tone']): string => {
  if (tone === 'error') return 'rgba(255,122,122,0.12)';
  if (tone === 'warning') return 'rgba(248,179,33,0.12)';
  return 'rgba(126,178,255,0.12)';
};

const toneBorder = (tone: AcademyWorkflowMicroHint['tone']): string => {
  if (tone === 'error') return 'rgba(255,122,122,0.44)';
  if (tone === 'warning') return 'rgba(248,179,33,0.44)';
  return 'rgba(126,178,255,0.44)';
};

export default function AcademyWorkflowGuidanceBar({
  tt,
  activeStep: _activeStep,
  intent,
  onIntentChange,
  onApplyIntent,
  applyLabelNo,
  applyLabelEn,
  isApplyingIntent = false,
  applyingStatusLabelNo,
  applyingStatusLabelEn,
  showMicroHints,
  microHint,
}: AcademyWorkflowGuidanceBarProps) {
  const selectedIntent =
    ACADEMY_WORKFLOW_INTENTS.find((option) => option.id === intent) ?? ACADEMY_WORKFLOW_INTENTS[0];
  const hintTone = microHint?.tone || 'info';

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 6,
        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
        borderRadius: 1,
        px: 1,
        py: 0.9,
        bgcolor: 'rgba(11,14,22,0.86)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        gap: 0.85,
      }}
    >
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.9} alignItems={{ xs: 'stretch', lg: 'center' }}>
        <Typography sx={{ color: 'rgba(237,240,247,0.84)', fontSize: 12.8, minWidth: { lg: 120 } }}>
          {tt('Jeg vil lage ...', 'I want to create ...')}
        </Typography>
        <Select
          size="small"
          value={intent}
          disabled={isApplyingIntent}
          onChange={(event) => onIntentChange(event.target.value as AcademyWorkflowIntentId)}
          sx={{
            minWidth: { xs: '100%', lg: 280 },
            color: '#edf0f7',
            bgcolor: 'rgba(255,255,255,0.04)',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(248,179,33,0.42)' },
            '& .MuiSvgIcon-root': { color: 'rgba(237,240,247,0.72)' },
          }}
        >
          {ACADEMY_WORKFLOW_INTENTS.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {tt(option.labelNo, option.labelEn)}
            </MenuItem>
          ))}
        </Select>
        <Button
          size="small"
          variant="outlined"
          disabled={isApplyingIntent}
          onClick={() => onApplyIntent(intent)}
          sx={{
            textTransform: 'none',
            color: '#edf0f7',
            borderColor: 'rgba(255,255,255,0.28)',
            borderRadius: 1,
            minWidth: { xs: '100%', lg: 'auto' },
          }}
        >
          {isApplyingIntent
            ? tt('Samler kontekst ...', 'Collecting context ...')
            : tt(applyLabelNo || 'Bruk oppsett', applyLabelEn || 'Apply setup')}
        </Button>
        {isApplyingIntent && (
          <Chip
            size="small"
            icon={<CircularProgress size={12} sx={{ color: '#f8d675 !important' }} />}
            label={tt(
              applyingStatusLabelNo || 'Samler informasjon for bedre annoteringsforslag ...',
              applyingStatusLabelEn || 'Collecting information for better annotation suggestions ...',
            )}
            sx={{
              bgcolor: 'rgba(248,179,33,0.16)',
              color: '#f8d675',
              border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.36)',
              maxWidth: { xs: '100%', lg: 420 },
            }}
          />
        )}
        <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12.2 }}>
          {tt(selectedIntent.descriptionNo, selectedIntent.descriptionEn)}
        </Typography>
      </Stack>

      {showMicroHints && microHint && (
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={0.8}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          sx={{
            border: `var(--academy-hairline-width, 1px) solid ${toneBorder(hintTone)}`,
            borderRadius: 1,
            px: 0.9,
            py: 0.7,
            bgcolor: toneBg(hintTone),
          }}
        >
          <Stack direction="row" spacing={0.7} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            {hintTone === 'error' ? (
              <ErrorOutline sx={{ color: toneColor(hintTone), fontSize: 17 }} />
            ) : hintTone === 'warning' ? (
              <WarningAmber sx={{ color: toneColor(hintTone), fontSize: 17 }} />
            ) : (
              <LightbulbOutlined sx={{ color: toneColor(hintTone), fontSize: 17 }} />
            )}
            <Typography sx={{ color: alpha(toneColor(hintTone), 0.98), fontSize: 12.6, minWidth: 0 }}>
              {tt(microHint.messageNo, microHint.messageEn)}
            </Typography>
          </Stack>
          {microHint.onAction && microHint.actionLabelNo && microHint.actionLabelEn ? (
            <Button
              size="small"
              variant="outlined"
              onClick={microHint.onAction}
              sx={{
                textTransform: 'none',
                color: toneColor(hintTone),
                borderColor: alpha(toneColor(hintTone), 0.45),
                minWidth: { xs: '100%', lg: 'auto' },
              }}
            >
              {tt(microHint.actionLabelNo, microHint.actionLabelEn)}
            </Button>
          ) : null}
        </Stack>
      )}
    </Box>
  );
}
