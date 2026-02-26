import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Slider,
  FormControlLabel,
  Switch,
  Chip,
  Button,
  LinearProgress,
} from '@mui/material';
import {
  Videocam,
  GridOn,
  Description,
  Event,
  Movie,
  AutoFixHigh,
  SyncAlt,
  Verified,
  Checklist,
} from '@mui/icons-material';
import {
  calculateContinuityScore,
  calculateCoverageScore,
  cloneFrameDecisionData,
} from '../../state/storyboardStore';
import type {
  FrameAnimaticData,
  FrameCinematographyData,
  FrameCoverageData,
  FrameContinuityData,
  FrameDecisionData,
  FrameDecisionVersionData,
  FrameDepartmentViewsData,
  FrameHandoffData,
  FrameOverlayData,
  FrameProductionPlanData,
  FrameScriptLinkData,
  FrameVersioningData,
  FrameApprovalData,
  StoryboardDepartment,
  FrameApprovalStatus,
  ScreenDirection,
} from '../../state/storyboardStore';

export interface VisualDecisionScriptContext {
  sceneId: string | null;
  sceneNumber: number | null;
  sceneHeading: string;
  dialogueCharacter?: string;
  dialogueText?: string;
  actionDescription?: string;
  scriptLineNumber: number;
}

export interface VisualStoryDecisionPanelProps {
  decisionData: FrameDecisionData;
  onDecisionDataChange: (decisionData: FrameDecisionData) => void;
  scriptContext?: VisualDecisionScriptContext | null;
}

const SHOT_SIZES: Array<{ value: FrameCinematographyData['shotSize']; label: string }> = [
  { value: 'EWS', label: 'EWS - Extreme Wide Shot' },
  { value: 'WS', label: 'WS - Wide Shot' },
  { value: 'MS', label: 'MS - Medium Shot' },
  { value: 'CU', label: 'CU - Close-up' },
  { value: 'ECU', label: 'ECU - Extreme Close-up' },
];

const CAMERA_ANGLES: FrameCinematographyData['angle'][] = [
  'Eye Level',
  'High Angle',
  'Low Angle',
  'Birds Eye',
  'Worms Eye',
  'Dutch Angle',
  'Overhead',
];

const CAMERA_MOVEMENTS: FrameCinematographyData['movement'][] = [
  'Static',
  'Pan',
  'Tilt',
  'Dolly',
  'Truck',
  'Crane',
  'Handheld',
  'Steadicam',
  'Zoom',
  'Orbit',
];

const FRAME_RATES: Array<FrameCinematographyData['frameRate']> = [23.976, 24, 25, 30, 48, 60];

const ASPECT_RATIOS: Array<FrameCinematographyData['aspectRatio']> = [
  '2.39:1',
  '2.35:1',
  '16:9',
  '4:3',
  '1:1',
  '9:16',
];

const SCRIPT_SOURCES: FrameScriptLinkData['source'][] = ['manual', 'fountain', 'final-draft', 'celtx'];

const SHOT_STATUSES: FrameProductionPlanData['shotStatus'][] = [
  'planned',
  'scheduled',
  'shooting',
  'completed',
  'approved',
];

const TRANSITION_TYPES: FrameAnimaticData['transitionType'][] = ['cut', 'dissolve', 'fade'];
const MOVE_CURVES: FrameAnimaticData['cameraMoveCurve'][] = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];
const CUT_VARIANTS: FrameAnimaticData['cutVariant'][] = ['director', 'producer', 'edit'];

const SCREEN_DIRECTIONS: ScreenDirection[] = ['ltr', 'rtl', 'neutral'];

const DEPARTMENT_OPTIONS: Array<{ value: StoryboardDepartment; label: string }> = [
  { value: 'director', label: 'Director' },
  { value: 'dp', label: 'DP' },
  { value: 'ad', label: 'AD' },
  { value: 'producer', label: 'Producer' },
  { value: 'art', label: 'Art' },
  { value: 'vfx', label: 'VFX' },
  { value: 'post', label: 'Post' },
];

const APPROVAL_STATUSES: FrameApprovalStatus[] = ['pending', 'approved', 'changes-requested'];

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const normalizeTokens = (value: string): string[] => {
  const next: string[] = [];
  value
    .split(/[\n,]/)
    .map((part) => part.trim())
    .forEach((part) => {
      if (!part) return;
      if (!next.includes(part)) next.push(part);
    });
  return next;
};

const stripTags = (value: string): string => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const isLikelyCharacterCue = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 32) return false;
  if (/^(INT\.|EXT\.|EST\.|CUT TO|FADE)/i.test(trimmed)) return false;
  return trimmed === trimmed.toUpperCase() && !/[.:!?]$/.test(trimmed);
};

interface ParsedScriptExcerpt {
  sceneNumber: string;
  sceneHeading: string;
  location: string;
  dialogueReference: string;
  cast: string[];
  scriptLineStart: number | null;
  scriptLineEnd: number | null;
  compareSummary: string;
}

const extractSceneNumber = (value: string): string => {
  const match = value.match(/(?:SCENE\s*)?#?([0-9]{1,4}[A-Z]?)/i);
  return match?.[1] ?? '';
};

const extractLocationFromHeading = (value: string): string => {
  const match = value.match(/(?:INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.)\s*([^\-\n]+)/i);
  return match?.[1]?.trim() ?? '';
};

const parseScriptExcerpt = (
  source: FrameScriptLinkData['source'],
  rawText: string,
): ParsedScriptExcerpt => {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return {
      sceneNumber: '',
      sceneHeading: '',
      location: '',
      dialogueReference: '',
      cast: [],
      scriptLineStart: null,
      scriptLineEnd: null,
      compareSummary: '',
    };
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let sceneHeading = lines.find((line) => /^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.)/i.test(line)) ?? '';
  let dialogueReference = '';
  let cast: string[] = lines.filter(isLikelyCharacterCue).slice(0, 8);

  if (source === 'final-draft' || source === 'celtx') {
    const sceneHeadingMatch =
      normalized.match(/<SceneHeading[^>]*>([\s\S]*?)<\/SceneHeading>/i) ??
      normalized.match(/<slugline[^>]*>([\s\S]*?)<\/slugline>/i);
    if (sceneHeadingMatch) {
      sceneHeading = stripTags(sceneHeadingMatch[1]);
    }

    const characters = [...normalized.matchAll(/<Character[^>]*>([\s\S]*?)<\/Character>/gi)]
      .map((match) => stripTags(match[1]))
      .filter((name, index, all) => Boolean(name) && all.indexOf(name) === index);

    const dialogues = [...normalized.matchAll(/<Dialogue[^>]*>([\s\S]*?)<\/Dialogue>/gi)]
      .map((match) => stripTags(match[1]))
      .filter(Boolean);

    cast = characters.slice(0, 8);
    if (characters.length > 0 && dialogues.length > 0) {
      dialogueReference = `${characters[0]}: ${dialogues[0]}`;
    } else if (dialogues.length > 0) {
      dialogueReference = dialogues[0];
    }
  } else if (!dialogueReference) {
    const dialogueLineIndex = lines.findIndex((line, index) => index > 0 && isLikelyCharacterCue(lines[index - 1]));
    if (dialogueLineIndex > 0) {
      const character = lines[dialogueLineIndex - 1];
      const dialogue = lines[dialogueLineIndex];
      dialogueReference = `${character}: ${dialogue}`;
    }
  }

  const sceneNumber = extractSceneNumber(sceneHeading || normalized);
  const location = extractLocationFromHeading(sceneHeading);

  return {
    sceneNumber,
    sceneHeading,
    location,
    dialogueReference,
    cast,
    scriptLineStart: 1,
    scriptLineEnd: lines.length,
    compareSummary: `Imported ${source} excerpt (${lines.length} lines).`,
  };
};

const buildVersionSummary = (decisionData: FrameDecisionData): string => {
  const durationSeconds = (decisionData.animatic.frameTimingMs / 1000).toFixed(2);
  return `${decisionData.cinematography.shotSize} ${decisionData.cinematography.lensMm}mm ${durationSeconds}s ${decisionData.production.shotStatus}`;
};

const bumpVersionLabel = (label: string, fallback: number): string => {
  const match = label.trim().match(/^(.*?)([0-9]+)$/);
  if (!match) return `v${fallback}`;
  return `${match[1]}${Number(match[2]) + 1}`;
};

const describeVersionDiff = (
  baseVersion: FrameDecisionVersionData,
  decisionData: FrameDecisionData,
): string => {
  const changes: string[] = [];
  if (baseVersion.shotSize !== decisionData.cinematography.shotSize) {
    changes.push(`Shot ${baseVersion.shotSize}->${decisionData.cinematography.shotSize}`);
  }
  if (baseVersion.lensMm !== decisionData.cinematography.lensMm) {
    changes.push(`Lens ${baseVersion.lensMm}mm->${decisionData.cinematography.lensMm}mm`);
  }
  if (baseVersion.frameTimingMs !== decisionData.animatic.frameTimingMs) {
    changes.push(`Timing ${(baseVersion.frameTimingMs / 1000).toFixed(2)}s->${(decisionData.animatic.frameTimingMs / 1000).toFixed(2)}s`);
  }
  if (baseVersion.shotStatus !== decisionData.production.shotStatus) {
    changes.push(`Status ${baseVersion.shotStatus}->${decisionData.production.shotStatus}`);
  }
  return changes.length > 0 ? changes.join(' | ') : 'No material technical changes.';
};

const cardStyles = {
  p: 1,
  borderRadius: 1,
  border: '1px solid rgba(255,255,255,0.08)',
  bgcolor: 'rgba(8,12,20,0.45)',
} as const;

export const VisualStoryDecisionPanel: React.FC<VisualStoryDecisionPanelProps> = ({
  decisionData,
  onDecisionDataChange,
  scriptContext,
}) => {
  const [riskDraft, setRiskDraft] = useState('');
  const [beatDraft, setBeatDraft] = useState('');
  const [scriptImportText, setScriptImportText] = useState('');
  const [animaticVersionNotes, setAnimaticVersionNotes] = useState('');

  const parsedImportPreview = useMemo(
    () => parseScriptExcerpt(decisionData.script.source, scriptImportText),
    [decisionData.script.source, scriptImportText],
  );

  const castTagsValue = useMemo(
    () => decisionData.production.cast.join(', '),
    [decisionData.production.cast],
  );

  const signOffValue = useMemo(
    () => decisionData.approvals.signOffNames.join(', '),
    [decisionData.approvals.signOffNames],
  );

  const activeDepartment = decisionData.departmentViews.activeDepartment;
  const readyDepartments = useMemo(
    () => Object.values(decisionData.departmentViews.readyByDepartment).filter(Boolean).length,
    [decisionData.departmentViews.readyByDepartment],
  );

  const blockedDepartments = useMemo(
    () => Object.values(decisionData.departmentViews.blockersByDepartment).filter((value) => value.trim().length > 0).length,
    [decisionData.departmentViews.blockersByDepartment],
  );

  const approvedDepartments = useMemo(
    () => Object.values(decisionData.approvals.statusByDepartment).filter((status) => status === 'approved').length,
    [decisionData.approvals.statusByDepartment],
  );

  const completionStepsDone = useMemo(
    () => Object.values(decisionData.handoff.completionTracking).filter(Boolean).length,
    [decisionData.handoff.completionTracking],
  );

  const comparedVersion = useMemo(
    () => decisionData.versioning.versions.find((version) => version.id === decisionData.versioning.compareWithVersionId) ?? null,
    [decisionData.versioning.compareWithVersionId, decisionData.versioning.versions],
  );

  const computedDiffSummary = useMemo(
    () => (comparedVersion ? describeVersionDiff(comparedVersion, decisionData) : ''),
    [comparedVersion, decisionData],
  );

  const selectedAnimaticVersion = useMemo(
    () => decisionData.animatic.versions.find((version) => version.id === decisionData.animatic.selectedVersionId) ?? null,
    [decisionData.animatic.selectedVersionId, decisionData.animatic.versions],
  );

  const updateDecision = useCallback(
    (updater: (nextDecision: FrameDecisionData) => void) => {
      const nextDecision = cloneFrameDecisionData(decisionData);
      updater(nextDecision);
      nextDecision.updatedAt = new Date().toISOString();
      onDecisionDataChange(nextDecision);
    },
    [decisionData, onDecisionDataChange],
  );

  const updateCamera = useCallback(
    (updates: Partial<FrameCinematographyData>) => {
      updateDecision((next) => {
        next.cinematography = { ...next.cinematography, ...updates };
      });
    },
    [updateDecision],
  );

  const updateOverlays = useCallback(
    (updates: Partial<FrameOverlayData>) => {
      updateDecision((next) => {
        next.overlays = { ...next.overlays, ...updates };
      });
    },
    [updateDecision],
  );

  const updateScript = useCallback(
    (updates: Partial<FrameScriptLinkData>) => {
      updateDecision((next) => {
        next.script = { ...next.script, ...updates };
      });
    },
    [updateDecision],
  );

  const updateProduction = useCallback(
    (updates: Partial<FrameProductionPlanData>) => {
      updateDecision((next) => {
        next.production = { ...next.production, ...updates };
      });
    },
    [updateDecision],
  );

  const updateAnimatic = useCallback(
    (updates: Partial<FrameAnimaticData>) => {
      updateDecision((next) => {
        next.animatic = { ...next.animatic, ...updates };
      });
    },
    [updateDecision],
  );

  const updateContinuity = useCallback(
    (updates: Partial<FrameContinuityData>) => {
      updateDecision((next) => {
        const continuity = { ...next.continuity, ...updates };
        continuity.continuityScore = calculateContinuityScore(continuity);
        next.continuity = continuity;
      });
    },
    [updateDecision],
  );

  const updateCoverage = useCallback(
    (updates: Partial<FrameCoverageData>) => {
      updateDecision((next) => {
        const coverage = { ...next.coverage, ...updates };
        coverage.coverageScore = calculateCoverageScore(coverage);
        next.coverage = coverage;
      });
    },
    [updateDecision],
  );

  const updateDepartmentViews = useCallback(
    (updates: Partial<FrameDepartmentViewsData>) => {
      updateDecision((next) => {
        next.departmentViews = { ...next.departmentViews, ...updates };
      });
    },
    [updateDecision],
  );

  const updateApprovals = useCallback(
    (updates: Partial<FrameApprovalData>) => {
      updateDecision((next) => {
        next.approvals = { ...next.approvals, ...updates };
      });
    },
    [updateDecision],
  );

  const updateVersioning = useCallback(
    (updates: Partial<FrameVersioningData>) => {
      updateDecision((next) => {
        next.versioning = { ...next.versioning, ...updates };
      });
    },
    [updateDecision],
  );

  const updateHandoff = useCallback(
    (updates: Partial<FrameHandoffData>) => {
      updateDecision((next) => {
        next.handoff = { ...next.handoff, ...updates };
      });
    },
    [updateDecision],
  );

  const handleCastChange = useCallback(
    (value: string) => {
      updateProduction({ cast: normalizeTokens(value) });
    },
    [updateProduction],
  );

  const handleSignOffChange = useCallback(
    (value: string) => {
      updateApprovals({ signOffNames: normalizeTokens(value) });
    },
    [updateApprovals],
  );

  const handleAutofillFromScript = useCallback(() => {
    if (!scriptContext) return;

    updateDecision((next) => {
      const dialogueRef = scriptContext.dialogueText?.trim()
        ? `${scriptContext.dialogueCharacter ? `${scriptContext.dialogueCharacter}: ` : ''}${scriptContext.dialogueText}`
        : next.script.dialogueReference;

      next.script = {
        ...next.script,
        sceneNumber: scriptContext.sceneNumber !== null ? String(scriptContext.sceneNumber) : next.script.sceneNumber,
        dialogueReference: dialogueRef,
        scriptLineStart: scriptContext.scriptLineNumber > 0 ? scriptContext.scriptLineNumber : next.script.scriptLineStart,
        scriptLineEnd: scriptContext.scriptLineNumber > 0 ? scriptContext.scriptLineNumber : next.script.scriptLineEnd,
        versionCompareSummary: scriptContext.actionDescription || next.script.versionCompareSummary,
      };

      if (!next.production.location && scriptContext.sceneHeading) {
        next.production.location = scriptContext.sceneHeading;
      }
    });
  }, [scriptContext, updateDecision]);

  const handleImportScriptExcerpt = useCallback(() => {
    if (!scriptImportText.trim()) return;
    const parsed = parseScriptExcerpt(decisionData.script.source, scriptImportText);

    updateDecision((next) => {
      next.script = {
        ...next.script,
        sceneNumber: parsed.sceneNumber || next.script.sceneNumber,
        dialogueReference: parsed.dialogueReference || next.script.dialogueReference,
        scriptLineStart: parsed.scriptLineStart,
        scriptLineEnd: parsed.scriptLineEnd,
        versionCompareSummary: parsed.compareSummary || next.script.versionCompareSummary,
      };

      const mergedCast = [...next.production.cast];
      parsed.cast.forEach((name) => {
        if (!mergedCast.includes(name)) mergedCast.push(name);
      });

      next.production = {
        ...next.production,
        location: parsed.location || next.production.location,
        cast: mergedCast,
      };
    });

    setScriptImportText('');
  }, [decisionData.script.source, scriptImportText, updateDecision]);

  const addRiskFactor = useCallback(() => {
    const nextRisk = riskDraft.trim();
    if (!nextRisk) return;
    if (decisionData.continuity.riskFactors.includes(nextRisk)) {
      setRiskDraft('');
      return;
    }
    updateContinuity({ riskFactors: [...decisionData.continuity.riskFactors, nextRisk] });
    setRiskDraft('');
  }, [decisionData.continuity.riskFactors, riskDraft, updateContinuity]);

  const removeRiskFactor = useCallback(
    (risk: string) => {
      updateContinuity({
        riskFactors: decisionData.continuity.riskFactors.filter((item) => item !== risk),
      });
    },
    [decisionData.continuity.riskFactors, updateContinuity],
  );

  const addBeatGoal = useCallback(() => {
    const nextBeat = beatDraft.trim();
    if (!nextBeat) return;
    if (decisionData.coverage.beatGoals.includes(nextBeat)) {
      setBeatDraft('');
      return;
    }
    updateCoverage({ beatGoals: [...decisionData.coverage.beatGoals, nextBeat] });
    setBeatDraft('');
  }, [beatDraft, decisionData.coverage.beatGoals, updateCoverage]);

  const removeBeatGoal = useCallback(
    (beat: string) => {
      updateCoverage({ beatGoals: decisionData.coverage.beatGoals.filter((item) => item !== beat) });
    },
    [decisionData.coverage.beatGoals, updateCoverage],
  );

  const handleDepartmentReadyToggle = useCallback(
    (checked: boolean) => {
      updateDepartmentViews({
        readyByDepartment: {
          ...decisionData.departmentViews.readyByDepartment,
          [activeDepartment]: checked,
        },
      });
    },
    [activeDepartment, decisionData.departmentViews.readyByDepartment, updateDepartmentViews],
  );

  const handleDepartmentNotesChange = useCallback(
    (value: string) => {
      updateDepartmentViews({
        notesByDepartment: {
          ...decisionData.departmentViews.notesByDepartment,
          [activeDepartment]: value,
        },
      });
    },
    [activeDepartment, decisionData.departmentViews.notesByDepartment, updateDepartmentViews],
  );

  const handleDepartmentBlockerChange = useCallback(
    (value: string) => {
      updateDepartmentViews({
        blockersByDepartment: {
          ...decisionData.departmentViews.blockersByDepartment,
          [activeDepartment]: value,
        },
      });
    },
    [activeDepartment, decisionData.departmentViews.blockersByDepartment, updateDepartmentViews],
  );

  const handleApprovalStatusChange = useCallback(
    (department: StoryboardDepartment, status: FrameApprovalStatus) => {
      updateApprovals({
        statusByDepartment: {
          ...decisionData.approvals.statusByDepartment,
          [department]: status,
        },
      });
    },
    [decisionData.approvals.statusByDepartment, updateApprovals],
  );

  const handleVersionSnapshot = useCallback(() => {
    updateDecision((next) => {
      const nextLabel = next.versioning.currentVersionLabel.trim() || `v${next.versioning.versions.length + 1}`;
      const nextVersion: FrameDecisionVersionData = {
        id: `decision-version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: nextLabel,
        createdAt: new Date().toISOString(),
        summary: buildVersionSummary(next),
        shotSize: next.cinematography.shotSize,
        lensMm: next.cinematography.lensMm,
        frameTimingMs: next.animatic.frameTimingMs,
        shotStatus: next.production.shotStatus,
      };

      next.versioning.versions = [...next.versioning.versions, nextVersion];
      next.versioning.compareWithVersionId = next.versioning.compareWithVersionId ?? nextVersion.id;
      next.versioning.currentVersionLabel = bumpVersionLabel(
        next.versioning.currentVersionLabel,
        next.versioning.versions.length + 1,
      );
    });
  }, [updateDecision]);

  const handleCompareVersionChange = useCallback(
    (versionId: string | null) => {
      updateDecision((next) => {
        next.versioning.compareWithVersionId = versionId;
        const selected = next.versioning.versions.find((version) => version.id === versionId) ?? null;
        next.approvals.latestDiffSummary = selected ? describeVersionDiff(selected, next) : '';
      });
    },
    [updateDecision],
  );

  const handleCreateAnimaticVersion = useCallback(() => {
    updateDecision((next) => {
      const versionName = `Cut ${next.animatic.versions.length + 1}`;
      const nextVersion = {
        id: `animatic-version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: versionName,
        timingMs: next.animatic.frameTimingMs,
        notes: animaticVersionNotes || next.animatic.soundMarkers || 'Saved from decision panel',
        createdAt: new Date().toISOString(),
      };
      next.animatic.versions = [...next.animatic.versions, nextVersion];
      next.animatic.selectedVersionId = nextVersion.id;
    });
    setAnimaticVersionNotes('');
  }, [animaticVersionNotes, updateDecision]);

  const handleLoadAnimaticVersion = useCallback(() => {
    if (!selectedAnimaticVersion) return;
    updateAnimatic({
      frameTimingMs: selectedAnimaticVersion.timingMs,
      soundMarkers: selectedAnimaticVersion.notes,
    });
  }, [selectedAnimaticVersion, updateAnimatic]);

  const markHandoffExported = useCallback(() => {
    updateHandoff({ lastExportedAt: new Date().toISOString() });
  }, [updateHandoff]);

  const effectiveDurationSeconds = (decisionData.animatic.frameTimingMs / 1000).toFixed(2);

  return (
    <Box sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoFixHigh sx={{ fontSize: 18, color: '#60a5fa' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Visual Decision Engine
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Chip
            size="small"
            label={`${decisionData.cinematography.shotSize} ${decisionData.cinematography.lensMm}mm`}
            sx={{ height: 22, fontSize: 10 }}
          />
          <Chip
            size="small"
            label={`${effectiveDurationSeconds}s`}
            sx={{ height: 22, fontSize: 10 }}
          />
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        <Box sx={cardStyles}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Videocam sx={{ fontSize: 16, color: '#93c5fd' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
              Cinematography Intelligence
            </Typography>
          </Stack>

          <Stack spacing={1}>
            <FormControl size="small" fullWidth>
              <InputLabel id="decision-shot-size-label">Shot Size</InputLabel>
              <Select
                labelId="decision-shot-size-label"
                label="Shot Size"
                value={decisionData.cinematography.shotSize}
                onChange={(event) => updateCamera({ shotSize: event.target.value as FrameCinematographyData['shotSize'] })}
              >
                {SHOT_SIZES.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Lens (mm)"
                type="number"
                value={decisionData.cinematography.lensMm}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  updateCamera({ lensMm: Number.isFinite(next) ? clamp(next, 8, 400) : decisionData.cinematography.lensMm });
                }}
                fullWidth
              />
              <TextField
                size="small"
                label="Aperture (f)"
                type="number"
                value={decisionData.cinematography.apertureFStop}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  updateCamera({
                    apertureFStop: Number.isFinite(next)
                      ? clamp(next, 0.95, 22)
                      : decisionData.cinematography.apertureFStop,
                  });
                }}
                inputProps={{ step: 0.1 }}
                fullWidth
              />
              <FormControl size="small" fullWidth>
                <InputLabel id="decision-frame-rate-label">FPS</InputLabel>
                <Select
                  labelId="decision-frame-rate-label"
                  label="FPS"
                  value={decisionData.cinematography.frameRate}
                  onChange={(event) => updateCamera({ frameRate: Number(event.target.value) as FrameCinematographyData['frameRate'] })}
                >
                  {FRAME_RATES.map((fps) => (
                    <MenuItem key={fps} value={fps}>{fps}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={1}>
              <FormControl size="small" fullWidth>
                <InputLabel id="decision-angle-label">Angle</InputLabel>
                <Select
                  labelId="decision-angle-label"
                  label="Angle"
                  value={decisionData.cinematography.angle}
                  onChange={(event) => updateCamera({ angle: event.target.value as FrameCinematographyData['angle'] })}
                >
                  {CAMERA_ANGLES.map((angle) => (
                    <MenuItem key={angle} value={angle}>{angle}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel id="decision-movement-label">Movement</InputLabel>
                <Select
                  labelId="decision-movement-label"
                  label="Movement"
                  value={decisionData.cinematography.movement}
                  onChange={(event) => updateCamera({ movement: event.target.value as FrameCinematographyData['movement'] })}
                >
                  {CAMERA_MOVEMENTS.map((movement) => (
                    <MenuItem key={movement} value={movement}>{movement}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <FormControl size="small" fullWidth>
              <InputLabel id="decision-aspect-label">Aspect Ratio</InputLabel>
              <Select
                labelId="decision-aspect-label"
                label="Aspect Ratio"
                value={decisionData.cinematography.aspectRatio}
                onChange={(event) => updateCamera({ aspectRatio: event.target.value as FrameCinematographyData['aspectRatio'] })}
              >
                {ASPECT_RATIOS.map((ratio) => (
                  <MenuItem key={ratio} value={ratio}>{ratio}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Camera Height ({decisionData.cinematography.cameraHeightCm} cm)
              </Typography>
              <Slider
                size="small"
                min={20}
                max={300}
                step={5}
                value={decisionData.cinematography.cameraHeightCm}
                onChange={(_event, value) => {
                  if (typeof value === 'number') updateCamera({ cameraHeightCm: value });
                }}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Key Light Direction ({Math.round(decisionData.cinematography.keyLightDirection)}°)
              </Typography>
              <Slider
                size="small"
                min={0}
                max={360}
                step={1}
                value={decisionData.cinematography.keyLightDirection}
                onChange={(_event, value) => {
                  if (typeof value === 'number') {
                    updateCamera({ keyLightDirection: clamp(value, 0, 360) });
                  }
                }}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Key Light Intensity ({Math.round(decisionData.cinematography.keyLightIntensity * 100)}%)
              </Typography>
              <Slider
                size="small"
                min={0}
                max={1}
                step={0.05}
                value={decisionData.cinematography.keyLightIntensity}
                onChange={(_event, value) => {
                  if (typeof value === 'number') {
                    updateCamera({ keyLightIntensity: clamp(value, 0, 1) });
                  }
                }}
              />
            </Box>
          </Stack>
        </Box>

        <Box sx={cardStyles}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <GridOn sx={{ fontSize: 16, color: '#c4b5fd' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
              Visual Overlays
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <FormControlLabel
              control={<Switch size="small" checked={decisionData.overlays.ruleOfThirds} onChange={(event) => updateOverlays({ ruleOfThirds: event.target.checked })} />}
              label="Thirds"
            />
            <FormControlLabel
              control={<Switch size="small" checked={decisionData.overlays.safeAreas} onChange={(event) => updateOverlays({ safeAreas: event.target.checked })} />}
              label="Safe Areas"
            />
            <FormControlLabel
              control={<Switch size="small" checked={decisionData.overlays.showActionSafe} onChange={(event) => updateOverlays({ showActionSafe: event.target.checked })} />}
              label="Action Safe"
            />
            <FormControlLabel
              control={<Switch size="small" checked={decisionData.overlays.showTitleSafe} onChange={(event) => updateOverlays({ showTitleSafe: event.target.checked })} />}
              label="Title Safe"
            />
            <FormControlLabel
              control={<Switch size="small" checked={decisionData.overlays.grid} onChange={(event) => updateOverlays({ grid: event.target.checked })} />}
              label="Grid"
            />
            <FormControlLabel
              control={<Switch size="small" checked={decisionData.overlays.eyelineMatch} onChange={(event) => updateOverlays({ eyelineMatch: event.target.checked })} />}
              label="Eyeline"
            />
            <FormControlLabel
              control={<Switch size="small" checked={decisionData.overlays.centerCross} onChange={(event) => updateOverlays({ centerCross: event.target.checked })} />}
              label="Center"
            />
            <FormControlLabel
              control={<Switch size="small" checked={decisionData.overlays.perspectiveGrid} onChange={(event) => updateOverlays({ perspectiveGrid: event.target.checked })} />}
              label="Perspective Grid"
            />
            <FormControlLabel
              control={<Switch size="small" checked={decisionData.overlays.vanishingPoints} onChange={(event) => updateOverlays({ vanishingPoints: event.target.checked })} />}
              label="Vanishing Points"
            />
            <FormControlLabel
              control={<Switch size="small" checked={decisionData.overlays.perspectiveSnap} onChange={(event) => updateOverlays({ perspectiveSnap: event.target.checked })} />}
              label="Perspective Snap"
            />
            <FormControlLabel
              control={<Switch size="small" checked={decisionData.overlays.lensFalloff} onChange={(event) => updateOverlays({ lensFalloff: event.target.checked })} />}
              label="Lens Falloff"
            />
            <FormControlLabel
              control={<Switch size="small" checked={decisionData.overlays.lightingVector} onChange={(event) => updateOverlays({ lightingVector: event.target.checked })} />}
              label="Lighting Vector"
            />
          </Stack>

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Overlay Opacity ({Math.round(decisionData.overlays.opacity * 100)}%)
          </Typography>
          <Slider
            size="small"
            min={0.1}
            max={1}
            step={0.05}
            value={decisionData.overlays.opacity}
            onChange={(_event, value) => {
              if (typeof value === 'number') updateOverlays({ opacity: clamp(value, 0.1, 1) });
            }}
          />
        </Box>

        <Divider flexItem />

        <Box sx={cardStyles}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Description sx={{ fontSize: 16, color: '#fde68a' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
              Script Import and Sync
            </Typography>
            {scriptContext && (
              <Button size="small" onClick={handleAutofillFromScript} sx={{ ml: 'auto', minWidth: 0 }}>
                Sync Active Scene
              </Button>
            )}
          </Stack>

          <Stack spacing={1}>
            <FormControl size="small" fullWidth>
              <InputLabel id="decision-script-source-label">Source</InputLabel>
              <Select
                labelId="decision-script-source-label"
                label="Source"
                value={decisionData.script.source}
                onChange={(event) => updateScript({ source: event.target.value as FrameScriptLinkData['source'] })}
              >
                {SCRIPT_SOURCES.map((source) => (
                  <MenuItem key={source} value={source}>{source}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Scene Number"
              value={decisionData.script.sceneNumber}
              onChange={(event) => updateScript({ sceneNumber: event.target.value })}
              fullWidth
            />

            <TextField
              size="small"
              label="Dialogue Link"
              value={decisionData.script.dialogueReference}
              onChange={(event) => updateScript({ dialogueReference: event.target.value })}
              fullWidth
              multiline
              minRows={2}
            />

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Version"
                value={decisionData.script.versionTag}
                onChange={(event) => updateScript({ versionTag: event.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Line Start"
                type="number"
                value={decisionData.script.scriptLineStart ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  updateScript({ scriptLineStart: value === '' ? null : Number(value) });
                }}
                fullWidth
              />
              <TextField
                size="small"
                label="Line End"
                type="number"
                value={decisionData.script.scriptLineEnd ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  updateScript({ scriptLineEnd: value === '' ? null : Number(value) });
                }}
                fullWidth
              />
            </Stack>

            <TextField
              size="small"
              label="Version Compare Summary"
              value={decisionData.script.versionCompareSummary}
              onChange={(event) => updateScript({ versionCompareSummary: event.target.value })}
              fullWidth
            />

            <TextField
              size="small"
              label="Paste screenplay excerpt (Fountain/FDX/Celtx)"
              value={scriptImportText}
              onChange={(event) => setScriptImportText(event.target.value)}
              fullWidth
              multiline
              minRows={4}
            />

            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                variant="outlined"
                disabled={!scriptImportText.trim()}
                onClick={handleImportScriptExcerpt}
              >
                Import Excerpt
              </Button>
              {parsedImportPreview.sceneHeading && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={parsedImportPreview.sceneHeading}
                  sx={{ maxWidth: 180 }}
                />
              )}
            </Stack>

            {scriptContext && (
              <Chip
                size="small"
                variant="outlined"
                label={scriptContext.sceneHeading || `Scene ${scriptContext.sceneId ?? '-'}`}
              />
            )}
          </Stack>
        </Box>

        <Box sx={cardStyles}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Event sx={{ fontSize: 16, color: '#86efac' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
              Scheduling and Production Linkage
            </Typography>
            <Chip
              size="small"
              label={decisionData.production.shotStatus}
              sx={{ ml: 'auto', height: 20, fontSize: 10, textTransform: 'uppercase' }}
            />
          </Stack>

          <Stack spacing={1}>
            <TextField
              size="small"
              label="Shooting Day"
              value={decisionData.production.shootingDay}
              onChange={(event) => updateProduction({ shootingDay: event.target.value })}
              fullWidth
              placeholder="Day 03"
            />

            <TextField
              size="small"
              label="Location"
              value={decisionData.production.location}
              onChange={(event) => updateProduction({ location: event.target.value })}
              fullWidth
              placeholder="Stage B / Exterior Alley"
            />

            <TextField
              size="small"
              label="Cast Filter (comma separated)"
              value={castTagsValue}
              onChange={(event) => handleCastChange(event.target.value)}
              fullWidth
            />

            <FormControl size="small" fullWidth>
              <InputLabel id="decision-shot-status-label">Shot Status</InputLabel>
              <Select
                labelId="decision-shot-status-label"
                label="Shot Status"
                value={decisionData.production.shotStatus}
                onChange={(event) => updateProduction({ shotStatus: event.target.value as FrameProductionPlanData['shotStatus'] })}
              >
                {SHOT_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>{status}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Completion and AD Notes"
              value={decisionData.production.completionNotes}
              onChange={(event) => updateProduction({ completionNotes: event.target.value })}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </Box>

        <Box sx={cardStyles}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <SyncAlt sx={{ fontSize: 16, color: '#fca5a5' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
              Continuity and Intent
            </Typography>
            <Chip
              size="small"
              label={`Score ${decisionData.continuity.continuityScore}`}
              sx={{ ml: 'auto', height: 20, fontSize: 10 }}
            />
          </Stack>

          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Intent Before"
                value={decisionData.continuity.intentBefore}
                onChange={(event) => updateContinuity({ intentBefore: event.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Intent After"
                value={decisionData.continuity.intentAfter}
                onChange={(event) => updateContinuity({ intentAfter: event.target.value })}
                fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Character Before"
                value={decisionData.continuity.characterStateBefore}
                onChange={(event) => updateContinuity({ characterStateBefore: event.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Character After"
                value={decisionData.continuity.characterStateAfter}
                onChange={(event) => updateContinuity({ characterStateAfter: event.target.value })}
                fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Prop Before"
                value={decisionData.continuity.propStateBefore}
                onChange={(event) => updateContinuity({ propStateBefore: event.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Prop After"
                value={decisionData.continuity.propStateAfter}
                onChange={(event) => updateContinuity({ propStateAfter: event.target.value })}
                fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Wardrobe Before"
                value={decisionData.continuity.wardrobeStateBefore}
                onChange={(event) => updateContinuity({ wardrobeStateBefore: event.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Wardrobe After"
                value={decisionData.continuity.wardrobeStateAfter}
                onChange={(event) => updateContinuity({ wardrobeStateAfter: event.target.value })}
                fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={1}>
              <FormControl size="small" fullWidth>
                <InputLabel id="continuity-direction-label">Screen Direction</InputLabel>
                <Select
                  labelId="continuity-direction-label"
                  label="Screen Direction"
                  value={decisionData.continuity.screenDirection}
                  onChange={(event) => updateContinuity({ screenDirection: event.target.value as ScreenDirection })}
                >
                  {SCREEN_DIRECTIONS.map((direction) => (
                    <MenuItem key={direction} value={direction}>{direction}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Eyeline Target"
                value={decisionData.continuity.eyelineTarget}
                onChange={(event) => updateContinuity({ eyelineTarget: event.target.value })}
                fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Add Risk Factor"
                value={riskDraft}
                onChange={(event) => setRiskDraft(event.target.value)}
                fullWidth
              />
              <Button size="small" variant="outlined" onClick={addRiskFactor} disabled={!riskDraft.trim()}>
                Add
              </Button>
            </Stack>

            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
              {decisionData.continuity.riskFactors.map((risk) => (
                <Chip
                  key={risk}
                  size="small"
                  color="warning"
                  label={risk}
                  onDelete={() => removeRiskFactor(risk)}
                />
              ))}
            </Stack>

            <LinearProgress
              variant="determinate"
              value={decisionData.continuity.continuityScore}
              sx={{ height: 6, borderRadius: 999 }}
            />
          </Stack>
        </Box>

        <Box sx={cardStyles}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Checklist sx={{ fontSize: 16, color: '#fdba74' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
              Coverage Completeness
            </Typography>
            <Chip
              size="small"
              label={`Score ${decisionData.coverage.coverageScore}`}
              sx={{ ml: 'auto', height: 20, fontSize: 10 }}
            />
          </Stack>

          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Emotional Beat"
                value={decisionData.coverage.emotionalBeat}
                onChange={(event) => updateCoverage({ emotionalBeat: event.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Continuity Beat"
                value={decisionData.coverage.continuityBeat}
                onChange={(event) => updateCoverage({ continuityBeat: event.target.value })}
                fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Add Beat Goal"
                value={beatDraft}
                onChange={(event) => setBeatDraft(event.target.value)}
                fullWidth
              />
              <Button size="small" variant="outlined" onClick={addBeatGoal} disabled={!beatDraft.trim()}>
                Add
              </Button>
            </Stack>

            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
              {decisionData.coverage.beatGoals.map((beat) => (
                <Chip
                  key={beat}
                  size="small"
                  color="info"
                  label={beat}
                  onDelete={() => removeBeatGoal(beat)}
                />
              ))}
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.coverage.hasWide} onChange={(event) => updateCoverage({ hasWide: event.target.checked })} />}
                label="Wide"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.coverage.hasMedium} onChange={(event) => updateCoverage({ hasMedium: event.target.checked })} />}
                label="Medium"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.coverage.hasClose} onChange={(event) => updateCoverage({ hasClose: event.target.checked })} />}
                label="Close"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.coverage.hasInsert} onChange={(event) => updateCoverage({ hasInsert: event.target.checked })} />}
                label="Insert"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.coverage.hasCutaway} onChange={(event) => updateCoverage({ hasCutaway: event.target.checked })} />}
                label="Cutaway"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.coverage.hasMove} onChange={(event) => updateCoverage({ hasMove: event.target.checked })} />}
                label="Move"
              />
            </Stack>

            <TextField
              size="small"
              label="Coverage Gap Notes"
              value={decisionData.coverage.gapNotes}
              onChange={(event) => updateCoverage({ gapNotes: event.target.value })}
              fullWidth
              multiline
              minRows={2}
            />

            <LinearProgress
              variant="determinate"
              value={decisionData.coverage.coverageScore}
              sx={{ height: 6, borderRadius: 999 }}
            />
          </Stack>
        </Box>

        <Box sx={cardStyles}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Movie sx={{ fontSize: 16, color: '#fca5a5' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
              Animatic Engine
            </Typography>
            <Chip
              size="small"
              label={`${(decisionData.animatic.frameTimingMs / 1000).toFixed(2)}s`}
              sx={{ ml: 'auto', height: 20, fontSize: 10 }}
            />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Frame Timing ({decisionData.animatic.frameTimingMs} ms)
            </Typography>
            <Slider
              size="small"
              min={250}
              max={8000}
              step={50}
              value={decisionData.animatic.frameTimingMs}
              onChange={(_event, value) => {
                if (typeof value === 'number') updateAnimatic({ frameTimingMs: value });
              }}
            />

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Lead In (ms)"
                type="number"
                value={decisionData.animatic.leadInMs}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  updateAnimatic({ leadInMs: Number.isFinite(next) ? clamp(next, 0, 5000) : decisionData.animatic.leadInMs });
                }}
                fullWidth
              />
              <TextField
                size="small"
                label="Lead Out (ms)"
                type="number"
                value={decisionData.animatic.leadOutMs}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  updateAnimatic({ leadOutMs: Number.isFinite(next) ? clamp(next, 0, 5000) : decisionData.animatic.leadOutMs });
                }}
                fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={1}>
              <FormControl size="small" fullWidth>
                <InputLabel id="animatic-transition-label">Transition</InputLabel>
                <Select
                  labelId="animatic-transition-label"
                  label="Transition"
                  value={decisionData.animatic.transitionType}
                  onChange={(event) => updateAnimatic({ transitionType: event.target.value as FrameAnimaticData['transitionType'] })}
                >
                  {TRANSITION_TYPES.map((transition) => (
                    <MenuItem key={transition} value={transition}>{transition}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel id="animatic-curve-label">Move Curve</InputLabel>
                <Select
                  labelId="animatic-curve-label"
                  label="Move Curve"
                  value={decisionData.animatic.cameraMoveCurve}
                  onChange={(event) => updateAnimatic({ cameraMoveCurve: event.target.value as FrameAnimaticData['cameraMoveCurve'] })}
                >
                  {MOVE_CURVES.map((curve) => (
                    <MenuItem key={curve} value={curve}>{curve}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel id="animatic-cut-variant-label">Cut Variant</InputLabel>
                <Select
                  labelId="animatic-cut-variant-label"
                  label="Cut Variant"
                  value={decisionData.animatic.cutVariant}
                  onChange={(event) => updateAnimatic({ cutVariant: event.target.value as FrameAnimaticData['cutVariant'] })}
                >
                  {CUT_VARIANTS.map((variant) => (
                    <MenuItem key={variant} value={variant}>{variant}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.animatic.motionArrows} onChange={(event) => updateAnimatic({ motionArrows: event.target.checked })} />}
                label="Motion Arrows"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.animatic.cameraMoveSimulation} onChange={(event) => updateAnimatic({ cameraMoveSimulation: event.target.checked })} />}
                label="Camera Sim"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.animatic.pacingPreview} onChange={(event) => updateAnimatic({ pacingPreview: event.target.checked })} />}
                label="Pacing Preview"
              />
            </Stack>

            <TextField
              size="small"
              label="Sound Markers"
              value={decisionData.animatic.soundMarkers}
              onChange={(event) => updateAnimatic({ soundMarkers: event.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="Dialogue Audio Cue"
              value={decisionData.animatic.dialogueAudioCue}
              onChange={(event) => updateAnimatic({ dialogueAudioCue: event.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="Temp Music"
              value={decisionData.animatic.tempMusicCue}
              onChange={(event) => updateAnimatic({ tempMusicCue: event.target.value })}
              fullWidth
            />

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Animatic Version Notes"
                value={animaticVersionNotes}
                onChange={(event) => setAnimaticVersionNotes(event.target.value)}
                fullWidth
              />
              <Button size="small" variant="outlined" onClick={handleCreateAnimaticVersion}>
                Save Cut
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" fullWidth>
                <InputLabel id="animatic-version-select-label">Saved Cuts</InputLabel>
                <Select
                  labelId="animatic-version-select-label"
                  label="Saved Cuts"
                  value={decisionData.animatic.selectedVersionId ?? ''}
                  onChange={(event) => {
                    const nextValue = String(event.target.value);
                    updateAnimatic({ selectedVersionId: nextValue || null });
                  }}
                >
                  <MenuItem value="">None</MenuItem>
                  {decisionData.animatic.versions.map((version) => (
                    <MenuItem key={version.id} value={version.id}>
                      {version.name} ({(version.timingMs / 1000).toFixed(2)}s)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button size="small" variant="outlined" disabled={!selectedAnimaticVersion} onClick={handleLoadAnimaticVersion}>
                Load
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Box sx={cardStyles}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <SyncAlt sx={{ fontSize: 16, color: '#67e8f9' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
              Department Views
            </Typography>
            <Chip size="small" label={`${readyDepartments}/7 ready`} sx={{ ml: 'auto', height: 20, fontSize: 10 }} />
            {blockedDepartments > 0 && (
              <Chip size="small" color="warning" label={`${blockedDepartments} blockers`} sx={{ height: 20, fontSize: 10 }} />
            )}
          </Stack>

          <Stack spacing={1}>
            <FormControl size="small" fullWidth>
              <InputLabel id="department-active-label">Active Department</InputLabel>
              <Select
                labelId="department-active-label"
                label="Active Department"
                value={activeDepartment}
                onChange={(event) => updateDepartmentViews({ activeDepartment: event.target.value as StoryboardDepartment })}
              >
                {DEPARTMENT_OPTIONS.map((department) => (
                  <MenuItem key={department.value} value={department.value}>{department.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={<Switch size="small" checked={decisionData.departmentViews.readyByDepartment[activeDepartment]} onChange={(event) => handleDepartmentReadyToggle(event.target.checked)} />}
              label="Department ready"
            />

            <TextField
              size="small"
              label="Department Notes"
              value={decisionData.departmentViews.notesByDepartment[activeDepartment]}
              onChange={(event) => handleDepartmentNotesChange(event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />

            <TextField
              size="small"
              label="Blocking Issues"
              value={decisionData.departmentViews.blockersByDepartment[activeDepartment]}
              onChange={(event) => handleDepartmentBlockerChange(event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </Box>

        <Box sx={cardStyles}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Verified sx={{ fontSize: 16, color: '#86efac' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
              Approvals and Version Compare
            </Typography>
            <Chip
              size="small"
              label={`${approvedDepartments}/7 approved`}
              sx={{ ml: 'auto', height: 20, fontSize: 10 }}
            />
          </Stack>

          <Stack spacing={1}>
            {DEPARTMENT_OPTIONS.map((department) => (
              <Stack key={department.value} direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" sx={{ width: 72, color: 'text.secondary' }}>
                  {department.label}
                </Typography>
                <FormControl size="small" fullWidth>
                  <Select
                    value={decisionData.approvals.statusByDepartment[department.value]}
                    onChange={(event) => handleApprovalStatusChange(department.value, event.target.value as FrameApprovalStatus)}
                  >
                    {APPROVAL_STATUSES.map((status) => (
                      <MenuItem key={status} value={status}>{status}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            ))}

            <TextField
              size="small"
              label="Sign-off Names (comma separated)"
              value={signOffValue}
              onChange={(event) => handleSignOffChange(event.target.value)}
              fullWidth
            />

            <FormControlLabel
              control={<Switch size="small" checked={decisionData.approvals.lockAfterApproval} onChange={(event) => updateApprovals({ lockAfterApproval: event.target.checked })} />}
              label="Lock frame after approvals"
            />

            <Divider flexItem />

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Next Version Label"
                value={decisionData.versioning.currentVersionLabel}
                onChange={(event) => updateVersioning({ currentVersionLabel: event.target.value })}
                fullWidth
              />
              <Button size="small" variant="outlined" onClick={handleVersionSnapshot}>
                Snapshot
              </Button>
            </Stack>

            <FormControl size="small" fullWidth>
              <InputLabel id="version-compare-select-label">Compare With</InputLabel>
              <Select
                labelId="version-compare-select-label"
                label="Compare With"
                value={decisionData.versioning.compareWithVersionId ?? ''}
                onChange={(event) => {
                  const nextValue = String(event.target.value);
                  handleCompareVersionChange(nextValue || null);
                }}
              >
                <MenuItem value="">None</MenuItem>
                {decisionData.versioning.versions.map((version) => (
                  <MenuItem key={version.id} value={version.id}>
                    {version.label} - {version.summary}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Diff Summary"
              value={decisionData.approvals.latestDiffSummary || computedDiffSummary}
              onChange={(event) => updateApprovals({ latestDiffSummary: event.target.value })}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </Box>

        <Box sx={cardStyles}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Checklist sx={{ fontSize: 16, color: '#a5b4fc' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
              Handoff and Delivery
            </Typography>
            <Chip
              size="small"
              label={`${completionStepsDone}/3 complete`}
              sx={{ ml: 'auto', height: 20, fontSize: 10 }}
            />
          </Stack>

          <Stack spacing={1}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.handoff.includePdfBoardBook} onChange={(event) => updateHandoff({ includePdfBoardBook: event.target.checked })} />}
                label="PDF Board Book"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.handoff.includeAnimaticVideo} onChange={(event) => updateHandoff({ includeAnimaticVideo: event.target.checked })} />}
                label="Animatic"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.handoff.includeShotListCsv} onChange={(event) => updateHandoff({ includeShotListCsv: event.target.checked })} />}
                label="Shot List CSV"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.handoff.includeCallSheetIntegration} onChange={(event) => updateHandoff({ includeCallSheetIntegration: event.target.checked })} />}
                label="Call Sheet"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.handoff.includeCameraData3D} onChange={(event) => updateHandoff({ includeCameraData3D: event.target.checked })} />}
                label="3D Camera"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.handoff.includeEditReference} onChange={(event) => updateHandoff({ includeEditReference: event.target.checked })} />}
                label="Edit Ref"
              />
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.handoff.completionTracking.prep} onChange={(event) => updateHandoff({ completionTracking: { ...decisionData.handoff.completionTracking, prep: event.target.checked } })} />}
                label="Prep"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.handoff.completionTracking.shoot} onChange={(event) => updateHandoff({ completionTracking: { ...decisionData.handoff.completionTracking, shoot: event.target.checked } })} />}
                label="Shoot"
              />
              <FormControlLabel
                control={<Switch size="small" checked={decisionData.handoff.completionTracking.post} onChange={(event) => updateHandoff({ completionTracking: { ...decisionData.handoff.completionTracking, post: event.target.checked } })} />}
                label="Post"
              />
            </Stack>

            <TextField
              size="small"
              label="Delivery Notes"
              value={decisionData.handoff.deliveryNotes}
              onChange={(event) => updateHandoff({ deliveryNotes: event.target.value })}
              fullWidth
              multiline
              minRows={2}
            />

            <Stack direction="row" spacing={1} alignItems="center">
              <Button size="small" variant="outlined" onClick={markHandoffExported}>
                Mark Exported
              </Button>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {decisionData.handoff.lastExportedAt
                  ? `Last exported ${new Date(decisionData.handoff.lastExportedAt).toLocaleString()}`
                  : 'No exports logged yet'}
              </Typography>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default VisualStoryDecisionPanel;
