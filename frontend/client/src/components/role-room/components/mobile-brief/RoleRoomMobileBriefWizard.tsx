// @ts-nocheck
/**
 * RoleRoomMobileBriefWizard — five-step client brief wizard for mobile + iPad.
 *
 * Covers backlog items:
 *  - 102: fem mobilsteg (mål, målgruppe, leveranser, referanser, oppsummering)
 *  - 103: progress indicator via MUI Stepper
 *  - 104: per-step lokal draft i localStorage
 *  - 112: "sist endret av / tidspunkt" i header
 *  - 113: inline skeleton, ikke fullskjermspinner
 *  - 115: "hopp til manglende felt" chips i oppsummering
 *  - 116: store tekstfelt + sticky lagreknapp
 *  - 124: ikke resync mens bruker skriver
 *
 * The wizard is deliberately "dumb" about media uploads and approval-lock.
 * Those are follow-up items (105, 110) that need additional backend support.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Skeleton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowForward as ArrowForwardIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';

import { useClientIntake } from '../../hooks/useClientIntake';
import type { ProducerClientIntake } from '../../models/casting';
import {
  BRIEF_STEPS,
  BriefFieldDescriptor,
  BriefStepKey,
  getMissingFields,
  stepCompletion,
  stepFor,
} from './briefStepDefinitions';
import {
  clearBriefDraft,
  readBriefDraft,
  writeBriefDraft,
} from './briefDraftPersistence';

interface RoleRoomMobileBriefWizardProps {
  projectId: string | null;
  /** When 'tabletLandscape', a live summary is rendered in a right pane. */
  mode?: 'mobile' | 'tabletPortrait' | 'tabletLandscape' | 'desktop';
}

function formatTimestamp(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export const RoleRoomMobileBriefWizard: React.FC<RoleRoomMobileBriefWizardProps> = ({
  projectId,
  mode = 'mobile',
}) => {
  const { intake, loading, saving, error, saveError, save, reload } = useClientIntake(projectId ?? undefined);
  const [draft, setDraft] = useState<Partial<ProducerClientIntake>>({});
  const [activeStep, setActiveStep] = useState(0);
  const [focusField, setFocusField] = useState<keyof ProducerClientIntake | null>(null);
  const isEditingRef = useRef(false);

  // Item 113: inline skeleton only on first load (no fullscreen spinner).
  const showSkeleton = loading && !intake;

  // Merge server intake + local draft on load; local wins on a per-field basis
  // since the draft represents edits that haven't been persisted yet.
  useEffect(() => {
    if (!projectId) {
      setDraft({});
      return;
    }
    const localDraft = readBriefDraft(projectId) ?? {};
    setDraft({ ...(intake ?? {}), ...localDraft });
  }, [projectId, intake]);

  const handleFieldChange = useCallback(
    (field: keyof ProducerClientIntake, value: string) => {
      isEditingRef.current = true;
      setDraft((prev) => {
        const next = { ...prev, [field]: value };
        if (projectId) writeBriefDraft(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  const handleSaveStep = useCallback(async () => {
    if (!projectId) return;
    try {
      await save(draft);
      clearBriefDraft(projectId);
      isEditingRef.current = false;
      if (activeStep < BRIEF_STEPS.length - 1) {
        setActiveStep((step) => step + 1);
      }
    } catch {
      /* saveError is already surfaced by the hook */
    }
  }, [projectId, save, draft, activeStep]);

  const handleSubmitBrief = useCallback(async () => {
    if (!projectId) return;
    try {
      await save(draft);
      clearBriefDraft(projectId);
      isEditingRef.current = false;
    } catch {
      /* saveError surfaced below */
    }
  }, [projectId, save, draft]);

  const handleJumpToMissing = useCallback((descriptor: BriefFieldDescriptor) => {
    const key = stepFor(descriptor.field);
    if (!key) return;
    const stepIndex = BRIEF_STEPS.findIndex((s) => s.key === key);
    if (stepIndex >= 0) {
      setActiveStep(stepIndex);
      setFocusField(descriptor.field);
    }
  }, []);

  // Item 124: defer any external reload while the user is editing.
  useEffect(() => {
    if (!projectId) return;
    const interval = window.setInterval(() => {
      if (!isEditingRef.current) {
        void reload();
      }
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [projectId, reload]);

  const missingFields = useMemo(() => getMissingFields(draft as ProducerClientIntake), [draft]);
  const canSubmit = missingFields.length === 0;

  if (!projectId) {
    return (
      <Alert severity="info" variant="outlined">
        Velg et prosjekt for å åpne klientbriefen.
      </Alert>
    );
  }

  if (showSkeleton) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={48} />
        <Skeleton variant="rounded" height={180} />
        <Skeleton variant="rounded" height={48} />
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const step = BRIEF_STEPS[activeStep];
  const lastUpdatedLabel = formatTimestamp(intake?.updatedAt);
  const showLivePreview = mode === 'tabletLandscape';

  const wizardBody = (
    <Stack spacing={2}>
      {/* Item 112: last-updated header */}
      {lastUpdatedLabel ? (
        <Typography variant="caption" color="text.secondary">
          Sist endret {lastUpdatedLabel}
          {intake?.updatedByRole ? ` av ${intake.updatedByRole}` : ''}
        </Typography>
      ) : null}

      {/* Item 103: progress */}
      <Stepper activeStep={activeStep} alternativeLabel sx={{ '& .MuiStepLabel-label': { fontSize: 12 } }}>
        {BRIEF_STEPS.map((s) => {
          const { complete } = stepCompletion(s, draft as ProducerClientIntake);
          return (
            <Step key={s.key} completed={complete && s.key !== 'summary'}>
              <StepLabel>{s.label}</StepLabel>
            </Step>
          );
        })}
      </Stepper>

      <Box>
        <Typography variant="h6" fontWeight={700}>
          {step.label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {step.description}
        </Typography>
      </Box>

      {step.key === 'summary' ? (
        <BriefSummary
          draft={draft}
          missingFields={missingFields}
          onJumpToMissing={handleJumpToMissing}
        />
      ) : (
        <Stack spacing={2}>
          {step.fields.map((descriptor) => (
            <BriefField
              key={String(descriptor.field)}
              descriptor={descriptor}
              value={typeof draft[descriptor.field] === 'string' ? (draft[descriptor.field] as string) : ''}
              onChange={(value) => handleFieldChange(descriptor.field, value)}
              autoFocus={focusField === descriptor.field}
              onFocused={() => setFocusField(null)}
            />
          ))}
        </Stack>
      )}

      {saveError ? <Alert severity="error">{saveError}</Alert> : null}

      {/* Item 116: sticky save bar */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          pt: 1.5,
          pb: 'calc(var(--rr-safe-bottom, 0px) + 8px)',
          mt: 2,
          display: 'flex',
          gap: 1,
        }}
      >
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          disabled={activeStep === 0 || saving}
          onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
          sx={{ minHeight: 'var(--rr-touch-target-min, 44px)' }}
        >
          Forrige
        </Button>
        <Box sx={{ flex: 1 }} />
        {step.key === 'summary' ? (
          <Button
            variant="contained"
            onClick={handleSubmitBrief}
            disabled={!canSubmit || saving}
            sx={{ minHeight: 'var(--rr-touch-target-min, 44px)', fontWeight: 700 }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : 'Send brief'}
          </Button>
        ) : (
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={handleSaveStep}
            disabled={saving}
            sx={{ minHeight: 'var(--rr-touch-target-min, 44px)', fontWeight: 700 }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : 'Lagre og neste'}
          </Button>
        )}
      </Box>
    </Stack>
  );

  // iPad landscape: two-column with live summary on the right (item 107).
  if (showLivePreview) {
    return (
      <Box
        className="rr-ipad-split rr-ipad-split--landscape"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 380px)',
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box>{wizardBody}</Box>
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            p: 2,
            borderRadius: 'var(--rr-card-radius, 16px)',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            maxHeight: 'calc(100dvh - 120px)',
            overflowY: 'auto',
          }}
        >
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
            Live oppsummering
          </Typography>
          <BriefSummary
            draft={draft}
            missingFields={missingFields}
            onJumpToMissing={handleJumpToMissing}
          />
        </Box>
      </Box>
    );
  }

  return wizardBody;
};

interface BriefFieldProps {
  descriptor: BriefFieldDescriptor;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  onFocused?: () => void;
}

const BriefField: React.FC<BriefFieldProps> = ({ descriptor, value, onChange, autoFocus, onFocused }) => {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus({ preventScroll: false });
      ref.current.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      onFocused?.();
    }
  }, [autoFocus, onFocused]);

  return (
    <TextField
      inputRef={ref}
      label={descriptor.label}
      helperText={descriptor.helperText}
      required={descriptor.required}
      multiline={descriptor.multiline}
      minRows={descriptor.minRows}
      placeholder={descriptor.placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      fullWidth
      sx={{
        '& .MuiOutlinedInput-root': {
          minHeight: 'var(--rr-touch-target-min, 44px)',
        },
      }}
    />
  );
};

interface BriefSummaryProps {
  draft: Partial<ProducerClientIntake>;
  missingFields: BriefFieldDescriptor[];
  onJumpToMissing: (descriptor: BriefFieldDescriptor) => void;
}

const BriefSummary: React.FC<BriefSummaryProps> = ({ draft, missingFields, onJumpToMissing }) => {
  return (
    <Stack spacing={2}>
      {missingFields.length > 0 ? (
        <Alert severity="warning" variant="outlined">
          <Typography variant="body2" sx={{ mb: 1 }}>
            Disse feltene mangler før briefen kan sendes:
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {missingFields.map((descriptor) => (
              <Chip
                key={String(descriptor.field)}
                label={descriptor.label}
                onClick={() => onJumpToMissing(descriptor)}
                clickable
                color="warning"
                variant="outlined"
                size="small"
              />
            ))}
          </Stack>
        </Alert>
      ) : (
        <Alert severity="success" variant="outlined">
          Briefen er klar for innsending.
        </Alert>
      )}

      {BRIEF_STEPS.filter((step) => step.key !== 'summary').map((step) => (
        <Box key={step.key}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
            {step.label}
          </Typography>
          {step.fields.map((descriptor) => {
            const value = draft[descriptor.field];
            return (
              <Box key={String(descriptor.field)} sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {descriptor.label}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {typeof value === 'string' && value.trim().length > 0 ? value : '—'}
                </Typography>
              </Box>
            );
          })}
        </Box>
      ))}
    </Stack>
  );
};

export default RoleRoomMobileBriefWizard;
