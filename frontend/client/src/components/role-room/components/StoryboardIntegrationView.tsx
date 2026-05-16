// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Chip,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Image as ImageIcon,
  List as ListIcon,
  Add as AddIcon,
  ContentCopy as ContentCopyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CameraAlt as CameraIcon,
  Lightbulb as LightIcon,
  Brush as BrushIcon,
  AutoAwesome as AutoAwesomeIcon,
  Create as CreateIcon,
  TouchApp as TouchAppIcon,
  Link as LinkIcon,
  Sync as SyncIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  CollectionsBookmark as CollectionsBookmarkIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import type { SceneBreakdown, StoryboardFrame as StoryboardFrameModel } from '../models/casting';
import { FrameDrawingEditor } from './FrameDrawingEditor';
// Sprint A.7: Creative Studio-panel — shot-forslag, coverage-gaps, refs
import { CreativeSuggestionsPanel } from './drawing/CreativeSuggestionsPanel';
// Sprint A.7: Continuity strip + style consistency
import { ContinuityStrip } from './drawing/ContinuityStrip';
import { StyleConsistencyIndicator } from './drawing/StyleConsistencyIndicator';
// Sprint A.7: Mood-board + pose-library
import { MoodBoardPanel } from './drawing/MoodBoardPanel';
import { PoseLibraryPanel } from './drawing/PoseLibraryPanel';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import type { PencilStroke } from '../hooks/useApplePencil';
import type { FrameDrawingData } from '../state/storyboardStore';
import {
  getPrimaryStoryboardDocumentReferenceImage,
  getPrimaryStoryboardDocumentStrokes,
  restoreStoryboardDrawingDocumentFromLegacy,
  type StoryboardDrawingDocument,
} from '../state/storyboardDrawingDocument';
import { useScriptStoryboardOptional } from '../contexts/ScriptStoryboardContext';
import { useToast } from './ToastStack';
import { useAuth } from '../../../hooks/useAuth';
import {
  loadRawStoryboardLibraryPayloadForProject,
  saveStoryboardLibraryPayloadForProject,
} from '../services/storyboardLibraryService';
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import storyboardEmptyPng from './icons/Keep/roleroom_storyboard.png';

interface StoryboardIntegrationViewProps {
  scene: SceneBreakdown;
  onUpdate: (scene: SceneBreakdown) => void;
  projectId?: string;
  /**
   * Prosjekt-nivå cinema-format som propageres til FrameDrawingEditor.
   * Storyboard-artister for film/commercial trenger 2.39:1/1.85:1 osv. —
   * tidligere var dette hardkodet til 16:9.
   */
  projectCinemaFormat?: '16:9' | '4:3' | '2.39:1' | '2.35:1' | '1.85:1' | '2.76:1' | '1:1' | '9:16';
  /** Alle scener — for cross-scene coverage-sammenligning i Creative Studio. */
  allScenes?: SceneBreakdown[];
  /** Dialog-linjer — for shot-suggestions (2-shot, OTS, reaction). */
  sceneDialogue?: import('../models/casting').DialogueLine[];
  /** Vis Creative Studio-panelet ved siden av storyboard. Default true. */
  showCreativeStudio?: boolean;
  // Script integration
  scriptContent?: string;
  onScriptChange?: (content: string) => void;
  showScriptPanel?: boolean;
  storyboardOnly?: boolean;
  activeFrameIndex?: number;
  onFrameSelect?: (index: number) => void;
}

type ViewMode = 'script' | 'storyboard' | 'shotlist' | 'split';
type StoryboardWorkspaceMode = 'thumbnail' | 'scene' | 'review';
type StoryboardDetailLevel = 'idea' | 'blocking' | 'shot' | 'presentation';
type StoryboardAssistFlag =
  | 'perspectiveGrid'
  | 'eyelineGuide'
  | 'silhouetteCheck'
  | 'focusPoint'
  | 'screenDirection'
  | 'negativeSpace';
type ScreenDirection = 'left-to-right' | 'right-to-left' | 'static';
type StoryboardAssistSettings = Partial<Record<StoryboardAssistFlag, boolean>>;

interface StoryboardFrame {
  id: string;
  shotNumber: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  sketch?: string;
  drawingData?: FrameDrawingData; // iPad drawing data
  imageSource?: 'ai' | 'captured' | 'drawn' | 'uploaded' | 'generated';
  description: string;
  cameraAngle: string;
  movement: string;
  duration: number;
  notes?: string;
  // Script linking
  sceneId?: string;
  scriptLineRange?: [number, number];
  dialogueCharacter?: string;
  detailLevel?: StoryboardDetailLevel;
  blockingNotes?: string;
  focusPoint?: string;
  screenDirection?: ScreenDirection;
  assist?: StoryboardAssistSettings;
  variantGroupId?: string;
  variantLabel?: string;
  createdAt?: string;
  updatedAt?: string;
}

const DETAIL_LEVEL_OPTIONS: Array<{
  value: StoryboardDetailLevel;
  label: string;
  shortLabel: string;
  editorLabel: string;
}> = [
  { value: 'idea', label: 'Thumbnail', shortLabel: 'Thumb', editorLabel: 'Idé / thumbnail' },
  { value: 'blocking', label: 'Blocking', shortLabel: 'Block', editorLabel: 'Scene / blocking' },
  { value: 'shot', label: 'Shot', shortLabel: 'Shot', editorLabel: 'Shot / acting' },
  { value: 'presentation', label: 'Review', shortLabel: 'Review', editorLabel: 'Presentasjon' },
];

const WORKSPACE_MODE_OPTIONS: Array<{ value: StoryboardWorkspaceMode; label: string }> = [
  { value: 'thumbnail', label: 'Thumbnails' },
  { value: 'scene', label: 'Scene' },
  { value: 'review', label: 'Review' },
];

const STORYBOARD_LANGUAGE_OPTIONS = ['Wide', 'Medium', 'Close-up', 'Insert', 'Over-shoulder', 'Top shot'] as const;
const SCREEN_DIRECTION_OPTIONS: ScreenDirection[] = ['left-to-right', 'right-to-left', 'static'];

const DEFAULT_ASSIST_BY_LEVEL: Record<StoryboardDetailLevel, StoryboardAssistSettings> = {
  idea: {
    negativeSpace: true,
    silhouetteCheck: true,
  },
  blocking: {
    perspectiveGrid: true,
    eyelineGuide: true,
    screenDirection: true,
  },
  shot: {
    perspectiveGrid: true,
    focusPoint: true,
    eyelineGuide: true,
  },
  presentation: {
    focusPoint: true,
    silhouetteCheck: true,
  },
};

const ASSIST_FLAG_OPTIONS: Array<{ key: StoryboardAssistFlag; label: string; levels: StoryboardDetailLevel[] }> = [
  { key: 'perspectiveGrid', label: 'Perspektiv-grid', levels: ['blocking', 'shot'] },
  { key: 'eyelineGuide', label: 'Eyeline', levels: ['blocking', 'shot', 'presentation'] },
  { key: 'silhouetteCheck', label: 'Silhuett', levels: ['idea', 'presentation'] },
  { key: 'focusPoint', label: 'Fokuspunkt', levels: ['shot', 'presentation'] },
  { key: 'screenDirection', label: 'Retning', levels: ['blocking', 'shot'] },
  { key: 'negativeSpace', label: 'Negative spaces', levels: ['idea', 'shot'] },
];

interface StoryboardLibraryItem {
  id: string;
  frame: StoryboardFrame;
  folderId?: string;
  createdAt: string;
  updatedAt?: string;
  authorId?: string;
  authorName?: string;
  sourceSceneId?: string;
  sourceSceneNumber?: number | string;
  sourceSceneHeading?: string;
  tags?: string[];
  creditLog?: StoryboardCreditEvent[];
}

interface StoryboardLibraryFolder {
  id: string;
  name: string;
  createdAt: string;
  createdByName?: string;
}

interface StoryboardLibraryPayload {
  items: StoryboardLibraryItem[];
  folders: StoryboardLibraryFolder[];
}

interface StoryboardCreditEvent {
  id: string;
  action: 'created' | 'updated';
  actorId?: string;
  actorName: string;
  timestamp: string;
  details?: string;
}

const FRAME_SYNC_DEBOUNCE_MS = 220;
const SPLIT_MIN_PANE_WIDTH = 280;
const SPLIT_DEFAULT_RATIO = 46;
const STORYBOARD_LIBRARY_STORAGE_PREFIX = 'role-room:storyboard-library';

const createFrameId = (): string => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `frame-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const cloneStoryboardFrame = (frame: StoryboardFrame): StoryboardFrame => ({ ...frame });

const optimizeFrameForLibraryStorage = (frame: StoryboardFrame): StoryboardFrame => {
  const optimized = cloneStoryboardFrame(frame);
  // Keep library payload lightweight and resilient in localStorage.
  optimized.drawingData = undefined;
  if (optimized.imageUrl?.startsWith('data:') && optimized.thumbnailUrl) {
    optimized.imageUrl = optimized.thumbnailUrl;
  }
  return optimized;
};

const buildStoryboardLibraryStorageKey = (scopeKey: string): string =>
  `${STORYBOARD_LIBRARY_STORAGE_PREFIX}:${scopeKey || 'global'}`;

const normalizeTag = (value: string): string => value.trim().toLowerCase();

const isStoryboardDetailLevel = (value: unknown): value is StoryboardDetailLevel =>
  DETAIL_LEVEL_OPTIONS.some((option) => option.value === value);

const isScreenDirection = (value: unknown): value is ScreenDirection =>
  SCREEN_DIRECTION_OPTIONS.includes(value as ScreenDirection);

const normalizeAssistSettings = (value?: StoryboardAssistSettings): StoryboardAssistSettings | undefined => {
  if (!value) return undefined;
  const normalized = ASSIST_FLAG_OPTIONS.reduce<StoryboardAssistSettings>((acc, option) => {
    const flagValue = value[option.key];
    if (typeof flagValue === 'boolean') {
      acc[option.key] = flagValue;
    }
    return acc;
  }, {});
  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const parseAssistSettings = (value: unknown): StoryboardAssistSettings | undefined => {
  if (!isObject(value)) return undefined;
  return normalizeAssistSettings(value as StoryboardAssistSettings);
};

const mergeAssistSettings = (
  detailLevel?: StoryboardDetailLevel,
  assist?: StoryboardAssistSettings
): StoryboardAssistSettings | undefined =>
  normalizeAssistSettings({
    ...(detailLevel ? DEFAULT_ASSIST_BY_LEVEL[detailLevel] : {}),
    ...(assist || {}),
  });

const serializeAssistSettings = (value?: StoryboardAssistSettings): string =>
  JSON.stringify(normalizeAssistSettings(value) || {});

const getDetailLevelMeta = (value?: StoryboardDetailLevel) =>
  DETAIL_LEVEL_OPTIONS.find((option) => option.value === value) || DETAIL_LEVEL_OPTIONS[0];

const getAssistCount = (value?: StoryboardAssistSettings): number =>
  Object.values(normalizeAssistSettings(value) || {}).filter(Boolean).length;

const getScreenDirectionLabel = (value?: ScreenDirection): string | undefined => {
  if (!value) return undefined;
  switch (value) {
    case 'left-to-right':
      return 'Venstre til hoyre';
    case 'right-to-left':
      return 'Hoyre til venstre';
    case 'static':
      return 'Statisk';
    default:
      return undefined;
  }
};

const buildUniqueShotNumber = (frames: StoryboardFrame[], desiredShotNumber: string): string => {
  const trimmed = desiredShotNumber.trim();
  if (!trimmed) return getNextShotNumber(frames);
  const existing = new Set(frames.map((frame) => frame.shotNumber.trim().toLowerCase()));
  if (!existing.has(trimmed.toLowerCase())) return trimmed;

  let attempt = 2;
  let candidate = `${trimmed}-${attempt}`;
  while (existing.has(candidate.toLowerCase())) {
    attempt += 1;
    candidate = `${trimmed}-${attempt}`;
  }
  return candidate;
};

const createStoryboardDraftFrame = (
  frames: StoryboardFrame[],
  overrides: Partial<StoryboardFrame> = {}
): StoryboardFrame => {
  const now = new Date().toISOString();
  const detailLevel =
    isStoryboardDetailLevel(overrides.detailLevel) ? overrides.detailLevel : 'idea';
  const shotNumber = buildUniqueShotNumber(
    frames,
    typeof overrides.shotNumber === 'string' && overrides.shotNumber.trim().length > 0
      ? overrides.shotNumber
      : getNextShotNumber(frames)
  );

  return {
    id: overrides.id || createFrameId(),
    shotNumber,
    description: overrides.description?.trim() || 'Ny shot',
    cameraAngle: overrides.cameraAngle?.trim() || STORYBOARD_LANGUAGE_OPTIONS[0],
    movement: overrides.movement?.trim() || 'Static',
    duration: Math.max(1, Number(overrides.duration) || 2),
    detailLevel,
    blockingNotes: overrides.blockingNotes?.trim() || undefined,
    focusPoint: overrides.focusPoint?.trim() || undefined,
    screenDirection: isScreenDirection(overrides.screenDirection) ? overrides.screenDirection : undefined,
    assist: mergeAssistSettings(detailLevel, overrides.assist),
    imageUrl: overrides.imageUrl,
    thumbnailUrl: overrides.thumbnailUrl,
    sketch: overrides.sketch,
    drawingData: overrides.drawingData,
    imageSource: overrides.imageSource,
    notes: overrides.notes?.trim() || undefined,
    sceneId: overrides.sceneId,
    scriptLineRange: overrides.scriptLineRange,
    dialogueCharacter: overrides.dialogueCharacter,
    variantGroupId: overrides.variantGroupId,
    variantLabel: overrides.variantLabel?.trim() || undefined,
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
  };
};

const buildLibraryItemTags = (
  frame: StoryboardFrame,
  sceneNumber?: number | string,
  sceneHeading?: string
): string[] => {
  const raw = [
    frame.cameraAngle,
    frame.movement,
    frame.detailLevel ? `nivaa:${frame.detailLevel}` : undefined,
    getScreenDirectionLabel(frame.screenDirection),
    frame.focusPoint ? `fokus:${frame.focusPoint}` : undefined,
    frame.imageSource ? `kilde:${frame.imageSource}` : undefined,
    sceneHeading,
    sceneNumber !== undefined ? `scene ${sceneNumber}` : undefined,
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  const unique = new Map<string, string>();
  for (const tag of raw) {
    const key = normalizeTag(tag);
    if (!unique.has(key)) {
      unique.set(key, tag.trim());
    }
  }
  return Array.from(unique.values());
};

const createCreditEvent = (
  action: StoryboardCreditEvent['action'],
  actorName: string,
  actorId?: string,
  details?: string
): StoryboardCreditEvent => ({
  id: createFrameId(),
  action,
  actorId,
  actorName,
  timestamp: new Date().toISOString(),
  details,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseStoredStrokes = (value: unknown): PencilStroke[] | undefined => {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as PencilStroke[]) : undefined;
  } catch {
    return undefined;
  }
};

const parseFrameDrawingData = (
  drawingDataRaw: unknown,
  options: {
    frameId?: string;
    storyboardId?: string;
    workflowLevel?: StoryboardDetailLevel;
    imageUrl?: string;
  } = {}
): FrameDrawingData | undefined => {
  if (!isObject(drawingDataRaw)) return undefined;

  const brushSettings =
    isObject(drawingDataRaw.brushSettings)
    && typeof drawingDataRaw.brushSettings.type === 'string'
    && typeof drawingDataRaw.brushSettings.size === 'number'
    && typeof drawingDataRaw.brushSettings.color === 'string'
    && typeof drawingDataRaw.brushSettings.opacity === 'number'
      ? {
          type: drawingDataRaw.brushSettings.type,
          size: drawingDataRaw.brushSettings.size,
          color: drawingDataRaw.brushSettings.color,
          opacity: drawingDataRaw.brushSettings.opacity,
        }
      : undefined;

  const createdAt =
    typeof drawingDataRaw.createdAt === 'string'
      ? drawingDataRaw.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof drawingDataRaw.updatedAt === 'string'
      ? drawingDataRaw.updatedAt
      : createdAt;
  const document = restoreStoryboardDrawingDocumentFromLegacy({
    document: drawingDataRaw.document,
    strokes: drawingDataRaw.strokes,
    baseImageUrl:
      typeof drawingDataRaw.baseImageUrl === 'string'
        ? drawingDataRaw.baseImageUrl
        : options.imageUrl,
    originalBaseImageUrl:
      typeof drawingDataRaw.originalBaseImageUrl === 'string'
        ? drawingDataRaw.originalBaseImageUrl
        : options.imageUrl,
    dataUrl: typeof drawingDataRaw.dataUrl === 'string' ? drawingDataRaw.dataUrl : options.imageUrl,
    brushSettings,
  }, {
    frameId: options.frameId,
    storyboardId: options.storyboardId,
    workflowLevel: options.workflowLevel,
    createdAt,
    updatedAt,
  });
  const documentStrokes = getPrimaryStoryboardDocumentStrokes(document);

  return {
    dataUrl: typeof drawingDataRaw.dataUrl === 'string' ? drawingDataRaw.dataUrl : '',
    strokes:
      typeof drawingDataRaw.strokes === 'string'
        ? drawingDataRaw.strokes
        : JSON.stringify(documentStrokes),
    document,
    baseImageUrl:
      typeof drawingDataRaw.baseImageUrl === 'string'
        ? drawingDataRaw.baseImageUrl
        : undefined,
    originalBaseImageUrl:
      typeof drawingDataRaw.originalBaseImageUrl === 'string'
        ? drawingDataRaw.originalBaseImageUrl
        : undefined,
    brushSettings,
    deviceType:
      drawingDataRaw.deviceType === 'pencil'
      || drawingDataRaw.deviceType === 'touch'
      || drawingDataRaw.deviceType === 'mouse'
        ? drawingDataRaw.deviceType
        : undefined,
    createdAt,
    updatedAt,
  };
};

const parseCreditLog = (value: unknown): StoryboardCreditEvent[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): StoryboardCreditEvent | null => {
      if (!isObject(entry)) return null;
      const action = entry.action === 'created' || entry.action === 'updated' ? entry.action : null;
      if (!action) return null;
      const actorName = typeof entry.actorName === 'string' && entry.actorName.trim().length > 0
        ? entry.actorName
        : 'Ukjent bruker';
      const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : new Date().toISOString();
      return {
        id: typeof entry.id === 'string' ? entry.id : createFrameId(),
        action,
        actorId: typeof entry.actorId === 'string' ? entry.actorId : undefined,
        actorName,
        timestamp,
        details: typeof entry.details === 'string' ? entry.details : undefined,
      };
    })
    .filter((entry): entry is StoryboardCreditEvent => Boolean(entry));
};

const toLibraryItem = (value: unknown): StoryboardLibraryItem | null => {
  if (!isObject(value)) return null;
  const frameRaw = value.frame;
  if (!isObject(frameRaw)) return null;

  const id = typeof value.id === 'string' ? value.id : createFrameId();
  const shotNumber = typeof frameRaw.shotNumber === 'string' ? frameRaw.shotNumber : '1A';
  const description = typeof frameRaw.description === 'string' ? frameRaw.description : 'Ny shot';
  const cameraAngle = typeof frameRaw.cameraAngle === 'string' ? frameRaw.cameraAngle : 'Medium';
  const movement = typeof frameRaw.movement === 'string' ? frameRaw.movement : 'Static';
  const duration =
    typeof frameRaw.duration === 'number' && Number.isFinite(frameRaw.duration) && frameRaw.duration > 0
      ? frameRaw.duration
      : 2;

  const frame: StoryboardFrame = optimizeFrameForLibraryStorage({
    id: typeof frameRaw.id === 'string' ? frameRaw.id : createFrameId(),
    shotNumber,
    description,
    cameraAngle,
    movement,
    duration,
    imageUrl: typeof frameRaw.imageUrl === 'string' ? frameRaw.imageUrl : undefined,
    thumbnailUrl: typeof frameRaw.thumbnailUrl === 'string' ? frameRaw.thumbnailUrl : undefined,
    sketch: typeof frameRaw.sketch === 'string' ? frameRaw.sketch : undefined,
    notes: typeof frameRaw.notes === 'string' ? frameRaw.notes : undefined,
    sceneId: typeof frameRaw.sceneId === 'string' ? frameRaw.sceneId : undefined,
    dialogueCharacter: typeof frameRaw.dialogueCharacter === 'string' ? frameRaw.dialogueCharacter : undefined,
    detailLevel: isStoryboardDetailLevel(frameRaw.detailLevel) ? frameRaw.detailLevel : undefined,
    blockingNotes: typeof frameRaw.blockingNotes === 'string' ? frameRaw.blockingNotes : undefined,
    focusPoint: typeof frameRaw.focusPoint === 'string' ? frameRaw.focusPoint : undefined,
    screenDirection: isScreenDirection(frameRaw.screenDirection) ? frameRaw.screenDirection : undefined,
    assist: parseAssistSettings(frameRaw.assist),
    variantGroupId: typeof frameRaw.variantGroupId === 'string' ? frameRaw.variantGroupId : undefined,
    variantLabel: typeof frameRaw.variantLabel === 'string' ? frameRaw.variantLabel : undefined,
    scriptLineRange:
      Array.isArray(frameRaw.scriptLineRange) &&
      frameRaw.scriptLineRange.length === 2 &&
      typeof frameRaw.scriptLineRange[0] === 'number' &&
      typeof frameRaw.scriptLineRange[1] === 'number'
        ? [frameRaw.scriptLineRange[0], frameRaw.scriptLineRange[1]]
        : undefined,
    imageSource:
      frameRaw.imageSource === 'ai' ||
      frameRaw.imageSource === 'captured' ||
      frameRaw.imageSource === 'drawn' ||
      frameRaw.imageSource === 'uploaded' ||
      frameRaw.imageSource === 'generated'
        ? frameRaw.imageSource
        : undefined,
    drawingData: parseFrameDrawingData(frameRaw.drawingData, {
      frameId: typeof frameRaw.id === 'string' ? frameRaw.id : undefined,
      workflowLevel: isStoryboardDetailLevel(frameRaw.detailLevel) ? frameRaw.detailLevel : undefined,
      imageUrl: typeof frameRaw.imageUrl === 'string' ? frameRaw.imageUrl : undefined,
    }),
  });

  const sceneNumber =
    typeof value.sourceSceneNumber === 'string' || typeof value.sourceSceneNumber === 'number'
      ? value.sourceSceneNumber
      : undefined;
  const sceneHeading = typeof value.sourceSceneHeading === 'string' ? value.sourceSceneHeading : undefined;
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : createdAt;
  const authorName = typeof value.authorName === 'string' ? value.authorName : 'Ukjent bruker';
  const authorId = typeof value.authorId === 'string' ? value.authorId : undefined;
  const persistedTags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    : undefined;
  const tags = persistedTags && persistedTags.length > 0 ? persistedTags : buildLibraryItemTags(frame, sceneNumber, sceneHeading);
  const parsedCreditLog = parseCreditLog(value.creditLog);
  const creditLog =
    parsedCreditLog.length > 0
      ? parsedCreditLog
      : [
          {
            id: createFrameId(),
            action: 'created',
            actorId: authorId,
            actorName,
            timestamp: createdAt,
            details: 'Migrert fra tidligere bibliotek-versjon',
          },
        ];

  return {
    id,
    frame,
    folderId: typeof value.folderId === 'string' ? value.folderId : undefined,
    createdAt,
    updatedAt,
    authorId,
    authorName,
    sourceSceneId: typeof value.sourceSceneId === 'string' ? value.sourceSceneId : undefined,
    sourceSceneNumber: sceneNumber,
    sourceSceneHeading: sceneHeading,
    tags,
    creditLog,
  };
};

const toLibraryFolder = (value: unknown): StoryboardLibraryFolder | null => {
  if (!isObject(value)) return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name) return null;
  return {
    id: typeof value.id === 'string' ? value.id : createFrameId(),
    name,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    createdByName: typeof value.createdByName === 'string' ? value.createdByName : undefined,
  };
};

const parseStoryboardLibraryPayload = (parsed: unknown): StoryboardLibraryPayload => {
  // Backward compatibility: old format stored as plain item array.
  if (Array.isArray(parsed)) {
    const items = parsed
      .map((entry) => toLibraryItem(entry))
      .filter((entry): entry is StoryboardLibraryItem => Boolean(entry));
    return { items, folders: [] };
  }

  if (!isObject(parsed)) return { items: [], folders: [] };
  const parsedItemsRaw = Array.isArray(parsed.items) ? parsed.items : [];
  const parsedFoldersRaw = Array.isArray(parsed.folders) ? parsed.folders : [];
  const items = parsedItemsRaw
    .map((entry) => toLibraryItem(entry))
    .filter((entry): entry is StoryboardLibraryItem => Boolean(entry));
  const folders = parsedFoldersRaw
    .map((entry) => toLibraryFolder(entry))
    .filter((entry): entry is StoryboardLibraryFolder => Boolean(entry));

  const folderIds = new Set(folders.map((folder) => folder.id));
  const normalizedItems = items.map((item) =>
    item.folderId && folderIds.has(item.folderId)
      ? item
      : {
          ...item,
          folderId: undefined,
        }
  );

  return { items: normalizedItems, folders };
};

const loadStoryboardLibrary = (storageKey: string): StoryboardLibraryPayload => {
  if (typeof window === 'undefined') return { items: [], folders: [] };
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { items: [], folders: [] };
    return parseStoryboardLibraryPayload(JSON.parse(raw));
  } catch {
    return { items: [], folders: [] };
  }
};

const getNextShotNumber = (frames: StoryboardFrame[]): string => {
  const maxShot = frames.reduce((acc, frame) => {
    const match = frame.shotNumber?.match(/^(\d+)/);
    const current = match ? Number(match[1]) : 0;
    return Number.isFinite(current) ? Math.max(acc, current) : acc;
  }, 0);
  return `${maxShot + 1}A`;
};

const STORYBOARD_THUMBNAIL_MAX_WIDTH = 640;
const STORYBOARD_THUMBNAIL_QUALITY = 0.82;

const createDrawingThumbnail = async (imageUrl: string): Promise<string | undefined> => {
  if (!imageUrl) return undefined;

  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      try {
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;

        if (!sourceWidth || !sourceHeight) {
          resolve(undefined);
          return;
        }

        const scale = Math.min(1, STORYBOARD_THUMBNAIL_MAX_WIDTH / sourceWidth);
        const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
        const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext('2d');
        if (!context) {
          resolve(undefined);
          return;
        }

        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL('image/webp', STORYBOARD_THUMBNAIL_QUALITY));
      } catch {
        resolve(undefined);
      }
    };

    image.onerror = () => resolve(undefined);
    image.src = imageUrl;
  });
};

const toLocalFrames = (frames?: StoryboardFrameModel[]): StoryboardFrame[] => {
  if (!Array.isArray(frames) || frames.length === 0) return [];
  return frames.map((f): StoryboardFrame => ({
    id: f.id,
    shotNumber: f.shotNumber,
    imageUrl: f.imageUrl,
    thumbnailUrl: f.thumbnailUrl as string | undefined,
    sketch: f.sketch,
    description: f.description,
    cameraAngle: f.cameraAngle,
    movement: f.movement,
    duration: f.duration,
    notes: f.notes,
    sceneId: f.sceneId,
    scriptLineRange: f.scriptLineRange,
    dialogueCharacter: f.dialogueCharacter,
    drawingData: f.drawingData as FrameDrawingData | undefined,
    imageSource: f.imageSource as StoryboardFrame['imageSource'],
    detailLevel: isStoryboardDetailLevel(f.detailLevel) ? f.detailLevel : undefined,
    blockingNotes: typeof f.blockingNotes === 'string' ? f.blockingNotes : undefined,
    focusPoint: typeof f.focusPoint === 'string' ? f.focusPoint : undefined,
    screenDirection: isScreenDirection(f.screenDirection) ? f.screenDirection : undefined,
    assist: parseAssistSettings(f.assist),
    variantGroupId: typeof f.variantGroupId === 'string' ? f.variantGroupId : undefined,
    variantLabel: typeof f.variantLabel === 'string' ? f.variantLabel : undefined,
    createdAt: typeof f.createdAt === 'string' ? f.createdAt : undefined,
    updatedAt: typeof f.updatedAt === 'string' ? f.updatedAt : undefined,
  }));
};

const toModelFrames = (frames: StoryboardFrame[], defaultSceneId: string): StoryboardFrameModel[] =>
  frames.map((f): StoryboardFrameModel => ({
    id: f.id,
    shotNumber: f.shotNumber,
    imageUrl: f.imageUrl,
    thumbnailUrl: f.thumbnailUrl,
    sketch: f.sketch,
    description: f.description,
    cameraAngle: f.cameraAngle,
    movement: f.movement,
    duration: f.duration,
    notes: f.notes,
    sceneId: f.sceneId || defaultSceneId,
    scriptLineRange: f.scriptLineRange,
    dialogueCharacter: f.dialogueCharacter,
    drawingData: f.drawingData as StoryboardFrameModel['drawingData'],
    imageSource: f.imageSource,
    detailLevel: f.detailLevel,
    blockingNotes: f.blockingNotes,
    focusPoint: f.focusPoint,
    screenDirection: f.screenDirection,
    assist: normalizeAssistSettings(f.assist),
    variantGroupId: f.variantGroupId,
    variantLabel: f.variantLabel,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }));

const rangeEqual = (a?: [number, number], b?: [number, number]): boolean =>
  (!a && !b) || (!!a && !!b && a[0] === b[0] && a[1] === b[1]);

const framesEqual = (a: StoryboardFrame[], b: StoryboardFrame[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.id !== right.id ||
      left.shotNumber !== right.shotNumber ||
      left.imageUrl !== right.imageUrl ||
      left.thumbnailUrl !== right.thumbnailUrl ||
      left.sketch !== right.sketch ||
      left.imageSource !== right.imageSource ||
      left.description !== right.description ||
      left.cameraAngle !== right.cameraAngle ||
      left.movement !== right.movement ||
      left.duration !== right.duration ||
      left.notes !== right.notes ||
      left.sceneId !== right.sceneId ||
      left.dialogueCharacter !== right.dialogueCharacter ||
      left.detailLevel !== right.detailLevel ||
      left.blockingNotes !== right.blockingNotes ||
      left.focusPoint !== right.focusPoint ||
      left.screenDirection !== right.screenDirection ||
      left.variantGroupId !== right.variantGroupId ||
      left.variantLabel !== right.variantLabel ||
      serializeAssistSettings(left.assist) !== serializeAssistSettings(right.assist) ||
      !rangeEqual(left.scriptLineRange, right.scriptLineRange) ||
      left.createdAt !== right.createdAt ||
      left.updatedAt !== right.updatedAt ||
      left.drawingData?.dataUrl !== right.drawingData?.dataUrl ||
      left.drawingData?.strokes !== right.drawingData?.strokes ||
      left.drawingData?.baseImageUrl !== right.drawingData?.baseImageUrl ||
      left.drawingData?.document?.updatedAt !== right.drawingData?.document?.updatedAt ||
      left.drawingData?.updatedAt !== right.drawingData?.updatedAt
    ) {
      return false;
    }
  }
  return true;
};

export const StoryboardIntegrationView: React.FC<StoryboardIntegrationViewProps> = ({
  scene,
  onUpdate,
  projectId,
  projectCinemaFormat,
  allScenes,
  sceneDialogue,
  showCreativeStudio = true,
  scriptContent,
  onScriptChange,
  showScriptPanel = false,
  storyboardOnly = false,
  activeFrameIndex: propActiveFrameIndex,
  onFrameSelect,
}) => {
  const storyboardPanelOnly = storyboardOnly || showScriptPanel;
  const [viewMode, setViewMode] = useState<ViewMode>(
    storyboardPanelOnly ? 'storyboard' : 'script'
  );
  const [storyboardFrames, setStoryboardFrames] = useState<StoryboardFrame[]>(() =>
    toLocalFrames(scene.storyboardFrames)
  );
  const [activeFrameIdx, setActiveFrameIdx] = useState(propActiveFrameIndex || 0);
  const [splitRatio, setSplitRatio] = useState(SPLIT_DEFAULT_RATIO);
  const [splitDragging, setSplitDragging] = useState(false);
  const device = useDeviceDetection();
  const latestSceneRef = useRef(scene);
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Try to use script-storyboard context if available
  const scriptStoryboard = useScriptStoryboardOptional();
  const currentScene = scriptStoryboard?.currentScene;
  const currentDialogue = scriptStoryboard?.currentDialogue;
  const syncEnabled = scriptStoryboard?.syncEnabled ?? false;
  
  // Sync active frame with context
  useEffect(() => {
    if (propActiveFrameIndex !== undefined && propActiveFrameIndex !== activeFrameIdx) {
      setActiveFrameIdx(propActiveFrameIndex);
    }
  }, [propActiveFrameIndex, activeFrameIdx]);

  // Lock view mode when production tab should only expose storyboard.
  useEffect(() => {
    if (storyboardPanelOnly && viewMode !== 'storyboard') {
      setViewMode('storyboard');
    }
  }, [storyboardPanelOnly, viewMode]);

  // Keep scene ref fresh for debounced updates.
  useEffect(() => {
    latestSceneRef.current = scene;
  }, [scene]);

  // Re-sync local frames when incoming scene changes externally.
  useEffect(() => {
    const incomingFrames = toLocalFrames(scene.storyboardFrames);
    setStoryboardFrames((prev) => (framesEqual(prev, incomingFrames) ? prev : incomingFrames));
    setActiveFrameIdx((prev) => {
      if (incomingFrames.length === 0) return 0;
      return Math.min(prev, incomingFrames.length - 1);
    });
  }, [scene.id, scene.storyboardFrames]);

  // Debounced sync storyboard frames back to parent scene.
  useEffect(() => {
    const currentFramesLocal = toLocalFrames(latestSceneRef.current.storyboardFrames);
    if (framesEqual(storyboardFrames, currentFramesLocal)) return;

    const timeoutId = window.setTimeout(() => {
      const modelFrames = toModelFrames(storyboardFrames, latestSceneRef.current.id);
      onUpdateRef.current({
        ...latestSceneRef.current,
        storyboardFrames: modelFrames,
      });
    }, FRAME_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [storyboardFrames]);

  const handleSplitResizeStart = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setSplitDragging(true);
  }, []);

  useEffect(() => {
    if (!splitDragging) return undefined;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (event: MouseEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      if (!rect.width) return;

      const rawRatio = ((event.clientX - rect.left) / rect.width) * 100;
      const minRatio = (SPLIT_MIN_PANE_WIDTH / rect.width) * 100;
      const maxRatio = 100 - minRatio;
      const clampedRatio = Math.max(minRatio, Math.min(maxRatio, rawRatio));
      setSplitRatio(clampedRatio);
    };

    const handleMouseUp = () => {
      setSplitDragging(false);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [splitDragging]);
  
  // Handle frame selection with script sync
  const handleFrameSelect = useCallback((index: number) => {
    setActiveFrameIdx(index);
    onFrameSelect?.(index);
    
    const frame = storyboardFrames[index];
    if (frame && scriptStoryboard) {
      scriptStoryboard.setActiveFrame(frame.id, index);
      
      // If frame has script line range and sync is enabled, scroll script
      if (syncEnabled && frame.scriptLineRange) {
        scriptStoryboard.goToScriptLine(frame.scriptLineRange[0]);
      }
    }
  }, [storyboardFrames, scriptStoryboard, syncEnabled, onFrameSelect]);
  
  // Link current frame to current script position
  const linkFrameToCurrentPosition = useCallback(() => {
    if (!scriptStoryboard || !currentScene) return;
    
    const frame = storyboardFrames[activeFrameIdx];
    if (!frame) return;
    
    const lineNumber = scriptStoryboard.scriptPosition.lineNumber;
    
    setStoryboardFrames(frames =>
      frames.map(f =>
        f.id === frame.id
          ? {
              ...f,
              sceneId: currentScene.sceneId,
              scriptLineRange: [lineNumber, lineNumber] as [number, number],
              dialogueCharacter: currentDialogue?.characterName,
              updatedAt: new Date().toISOString(),
            }
          : f
      )
    );
    
    scriptStoryboard.linkFrameToScript(
      frame.id,
      currentScene.sceneId,
      [lineNumber, lineNumber]
    );
  }, [scriptStoryboard, currentScene, currentDialogue, storyboardFrames, activeFrameIdx]);

  // Handle drawing completion for a frame
  const handleFrameDrawingComplete = useCallback(
    (frameId: string, drawingData: FrameDrawingData, imageUrl: string) => {
      void (async () => {
        const generatedThumbnail = await createDrawingThumbnail(imageUrl);
        const thumbnailUrl = generatedThumbnail || imageUrl;

        setStoryboardFrames((frames) =>
          frames.map((frame) =>
            frame.id === frameId
              ? {
                  ...frame,
                  imageUrl,
                  thumbnailUrl,
                  drawingData,
                  imageSource: 'drawn' as const,
                  updatedAt: new Date().toISOString(),
                }
              : frame
          )
        );
      })();
    },
    []
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Script Context Banner when synced */}
      {syncEnabled && currentDialogue && (
        <Alert 
          severity="info" 
          icon={<SyncIcon sx={{ fontSize: 18 }} />}
          sx={{ 
            borderRadius: 0, 
            py: 0.5,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
          }}
          action={
            <Tooltip title="Koble frame til denne posisjonen i manus">
              <IconButton size="small" onClick={linkFrameToCurrentPosition} aria-label="Koble frame til denne posisjonen i manus">
                <LinkIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          }
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Chip 
              label={currentDialogue.characterName} 
              size="small" 
              sx={{ fontWeight: 600, fontSize: 11, height: 20 }}
            />
            <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
              "{currentDialogue.dialogueText?.slice(0, 60)}..."
            </Typography>
          </Stack>
        </Alert>
      )}
      
      {/* View Mode Selector */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={2}>
            <Typography variant="h6">Scene {scene.sceneNumber}</Typography>
            <Chip
              size="small"
              variant="outlined"
              icon={device.hasPencilSupport ? <CreateIcon sx={{ fontSize: 14 }} /> : <TouchAppIcon sx={{ fontSize: 14 }} />}
              label={device.hasPencilSupport ? 'iPad/Pencil klar' : device.hasTouchScreen ? 'Touch-klar' : 'Desktop'}
              sx={{ fontSize: 11 }}
            />
            {storyboardFrames[activeFrameIdx]?.scriptLineRange && (
              <Chip
                icon={<LinkIcon sx={{ fontSize: 14 }} />}
                label={`Linjer ${storyboardFrames[activeFrameIdx].scriptLineRange![0]}-${storyboardFrames[activeFrameIdx].scriptLineRange![1]}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: 10 }}
              />
            )}
          </Stack>
          
          {!storyboardPanelOnly && (
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, mode) => mode && setViewMode(mode)}
              size="small"
            >
              <ToggleButton value="script">
                <DescriptionIcon sx={{ mr: 1 }} />
                Manus
              </ToggleButton>
              <ToggleButton value="storyboard">
                <ImageIcon sx={{ mr: 1 }} />
                Storyboard
              </ToggleButton>
              <ToggleButton value="shotlist">
                <ListIcon sx={{ mr: 1 }} />
                Shot-liste
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        </Stack>
      </Paper>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {!storyboardPanelOnly && viewMode === 'script' && (
          <ScriptView scene={scene} scriptContent={scriptContent} onScriptChange={onScriptChange} />
        )}
        {(storyboardPanelOnly || viewMode === 'storyboard') && (
          <StoryboardView
            frames={storyboardFrames}
            onUpdate={setStoryboardFrames}
            onFrameDrawingComplete={handleFrameDrawingComplete}
            sceneId={scene.id}
            projectId={projectId || scene.projectId}
            sceneNumber={scene.sceneNumber}
            sceneHeading={scene.heading || scene.sceneName}
            libraryScopeKey={String(scene.projectId || scene.manuscriptId || 'global')}
            activeFrameIndex={activeFrameIdx}
            onSelectFrame={handleFrameSelect}
          />
        )}
        {!storyboardPanelOnly && viewMode === 'split' && (
          <Box
            ref={splitContainerRef}
            sx={{
              display: 'flex',
              flexWrap: { xs: 'wrap', md: 'nowrap' },
              alignItems: 'stretch',
              gap: { xs: 2, md: 0 },
              userSelect: splitDragging ? 'none' : 'auto',
            }}
          >
            <Box
              sx={{
                flex: { xs: '1 1 100%', md: '0 0 auto' },
                width: { xs: '100%', md: `${splitRatio}%` },
                minWidth: { xs: 0, md: SPLIT_MIN_PANE_WIDTH },
                pr: { md: 1 },
              }}
            >
              <ScriptView scene={scene} scriptContent={scriptContent} onScriptChange={onScriptChange} />
            </Box>
            <Box
              onMouseDown={handleSplitResizeStart}
              sx={{
                display: { xs: 'none', md: 'flex' },
                width: 8,
                cursor: 'col-resize',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: splitDragging ? 'rgba(96, 165, 250, 0.22)' : 'rgba(148, 163, 184, 0.08)',
                transition: 'background-color 120ms ease',
                '&:hover': {
                  backgroundColor: 'rgba(96, 165, 250, 0.2)',
                },
                '&::before': {
                  content: '""',
                  width: 2,
                  height: '100%',
                  backgroundColor: splitDragging ? 'rgba(147, 197, 253, 0.9)' : 'rgba(148, 163, 184, 0.45)',
                },
              }}
            />
            <Box
              sx={{
                flex: { xs: '1 1 100%', md: '1 1 auto' },
                width: { xs: '100%', md: `${100 - splitRatio}%` },
                minWidth: { xs: 0, md: SPLIT_MIN_PANE_WIDTH },
                pl: { md: 1 },
              }}
            >
              <StoryboardView
                frames={storyboardFrames}
                onUpdate={setStoryboardFrames}
                onFrameDrawingComplete={handleFrameDrawingComplete}
                sceneId={scene.id}
                projectId={projectId || scene.projectId}
                sceneNumber={scene.sceneNumber}
                sceneHeading={scene.heading || scene.sceneName}
                libraryScopeKey={String(scene.projectId || scene.manuscriptId || 'global')}
                activeFrameIndex={activeFrameIdx}
                onSelectFrame={handleFrameSelect}
              />
            </Box>
          </Box>
        )}
        {!storyboardPanelOnly && viewMode === 'shotlist' && (
          <ShotListView
            frames={storyboardFrames}
            onUpdate={setStoryboardFrames}
          />
        )}
      </Box>
    </Box>
  );
};

const ScriptView: React.FC<{
  scene: SceneBreakdown;
  scriptContent?: string;
  onScriptChange?: (content: string) => void;
}> = ({ scene, scriptContent, onScriptChange }) => {
  const hasScriptEditor = typeof scriptContent === 'string';
  return (
    <Paper sx={{ p: 3, fontFamily: 'Courier, monospace', bgcolor: '#FFFFF8' }}>
      <Stack spacing={3}>
        {hasScriptEditor && (
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Manus for scenen
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={12}
              value={scriptContent}
              onChange={(event) => onScriptChange?.(event.target.value)}
              InputProps={{ readOnly: !onScriptChange }}
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: 'Courier, monospace',
                  fontSize: 14,
                  backgroundColor: 'rgba(255,255,255,0.75)',
                },
              }}
            />
          </Stack>
        )}

        {/* Scene Heading */}
        <Typography variant="h6" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
          {scene.intExt}. {scene.locationName} - {scene.timeOfDay}
        </Typography>

        {/* Scene Description */}
        {scene.description && (
          <Typography sx={{ lineHeight: 2 }}>
            {scene.description}
          </Typography>
        )}

        {/* Dialogue */}
        {scene.characters && scene.characters.length > 0 && (
          <Stack spacing={2}>
            {scene.characters.map((char, i) => (
              <Box key={i}>
                <Typography
                  sx={{
                    textAlign: 'center',
                    fontWeight: 'bold',
                    mb: 1,
                  }}
                >
                  {char.toUpperCase()}
                </Typography>
                <Typography
                  sx={{
                    textAlign: 'center',
                    maxWidth: '60%',
                    mx: 'auto',
                    fontStyle: 'italic',
                    color: 'text.secondary',
                  }}
                >
                  (eksempel dialog for {char})
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};

const StoryboardView: React.FC<{
  frames: StoryboardFrame[];
  onUpdate: (frames: StoryboardFrame[]) => void;
  onFrameDrawingComplete: (frameId: string, drawingData: FrameDrawingData, imageUrl: string) => void;
  sceneId: string;
  projectId?: string;
  sceneNumber?: number | string;
  sceneHeading?: string;
  libraryScopeKey: string;
  activeFrameIndex: number;
  onSelectFrame: (index: number) => void;
}> = ({
  frames,
  onUpdate,
  onFrameDrawingComplete,
  sceneId,
  projectId,
  sceneNumber,
  sceneHeading,
  libraryScopeKey,
  activeFrameIndex,
  onSelectFrame,
}) => {
  const device = useDeviceDetection();
  const { showSuccess, showInfo } = useToast();
  const { user } = useAuth();
  const [workspaceMode, setWorkspaceMode] = useState<StoryboardWorkspaceMode>('thumbnail');
  const [drawingFrameId, setDrawingFrameId] = useState<string | null>(null);
  const [pendingPoseStrokes, setPendingPoseStrokes] = useState<PencilStroke[] | null>(null);
  const [quickViewFrameId, setQuickViewFrameId] = useState<string | null>(null);
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [deletingFrameId, setDeletingFrameId] = useState<string | null>(null);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [creditHistoryItemId, setCreditHistoryItemId] = useState<string | null>(null);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryTagFilter, setLibraryTagFilter] = useState<string>('alle');
  const [libraryAuthorFilter, setLibraryAuthorFilter] = useState<string>('alle');
  const [libraryLayoutMode, setLibraryLayoutMode] = useState<'grid' | 'kanban'>('grid');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [libraryFolderFilter, setLibraryFolderFilter] = useState<string>('alle');
  const [newFolderName, setNewFolderName] = useState('');
  const [editDraft, setEditDraft] = useState<StoryboardFrame | null>(null);
  const libraryStorageKey = useMemo(
    () => buildStoryboardLibraryStorageKey(libraryScopeKey),
    [libraryScopeKey]
  );
  const [libraryItems, setLibraryItems] = useState<StoryboardLibraryItem[]>(() => {
    const payload = loadStoryboardLibrary(libraryStorageKey);
    return payload.items;
  });
  const [libraryFolders, setLibraryFolders] = useState<StoryboardLibraryFolder[]>(() => {
    const payload = loadStoryboardLibrary(libraryStorageKey);
    return payload.folders;
  });
  const [libraryHydrated, setLibraryHydrated] = useState(false);

  const editingFrame = frames.find((frame) => frame.id === editingFrameId) || null;
  const quickViewFrame = frames.find((frame) => frame.id === quickViewFrameId) || null;
  const activeFrame = frames[activeFrameIndex] || null;
  const activeDetailLevel: StoryboardDetailLevel = activeFrame?.detailLevel || 'idea';
  const activeAssist = mergeAssistSettings(activeDetailLevel, activeFrame?.assist);
  const creditHistoryItem = libraryItems.find((item) => item.id === creditHistoryItemId) || null;
  const sceneLabel =
    sceneHeading?.trim() ||
    (sceneNumber !== undefined && sceneNumber !== null ? `Scene ${sceneNumber}` : `Scene ${sceneId}`);
  const currentAuthorName = user?.displayName || user?.name || user?.email || 'Ukjent bruker';
  const currentAuthorId = user?.id || user?.email;
  const folderNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const folder of libraryFolders) {
      map.set(folder.id, folder.name);
    }
    return map;
  }, [libraryFolders]);
  const availableLibraryTags = useMemo(() => {
    const tags = new Map<string, string>();
    for (const item of libraryItems) {
      for (const tag of item.tags || []) {
        const key = normalizeTag(tag);
        if (!tags.has(key)) {
          tags.set(key, tag);
        }
      }
    }
    return Array.from(tags.values()).sort((a, b) => a.localeCompare(b, 'nb'));
  }, [libraryItems]);
  const availableLibraryAuthors = useMemo(() => {
    const authors = new Map<string, string>();
    for (const item of libraryItems) {
      const authorName = item.authorName || 'Ukjent forfatter';
      const key = normalizeTag(authorName);
      if (!authors.has(key)) {
        authors.set(key, authorName);
      }
    }
    return Array.from(authors.values()).sort((a, b) => a.localeCompare(b, 'nb'));
  }, [libraryItems]);
  const availableLibraryFolders = useMemo(
    () => [...libraryFolders].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
    [libraryFolders]
  );
  const kanbanColumns = useMemo(
    () => [
      { id: 'uten-mappe', name: 'Uten mappe' },
      ...availableLibraryFolders.map((folder) => ({ id: folder.id, name: folder.name })),
    ],
    [availableLibraryFolders]
  );
  const activeAssistOptions = useMemo(
    () => ASSIST_FLAG_OPTIONS.filter((option) => option.levels.includes(activeDetailLevel)),
    [activeDetailLevel]
  );
  const filteredLibraryItems = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return libraryItems.filter((item) => {
      const folderName = item.folderId ? folderNameById.get(item.folderId) : undefined;
      const searchHaystack = [
        item.frame.description,
        item.frame.cameraAngle,
        item.frame.movement,
        folderName,
        item.sourceSceneHeading,
        item.sourceSceneNumber !== undefined ? `scene ${item.sourceSceneNumber}` : '',
        item.authorName,
        ...(item.creditLog || []).map((entry) => entry.actorName),
        ...(item.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const queryMatch = query.length === 0 || searchHaystack.includes(query);
      const tagMatch =
        libraryTagFilter === 'alle' ||
        (item.tags || []).some((tag) => normalizeTag(tag) === normalizeTag(libraryTagFilter));
      const authorName = item.authorName || 'Ukjent forfatter';
      const authorMatch =
        libraryAuthorFilter === 'alle' || normalizeTag(authorName) === normalizeTag(libraryAuthorFilter);
      const folderMatch =
        libraryFolderFilter === 'alle' ||
        (libraryFolderFilter === 'uten-mappe'
          ? !item.folderId
          : item.folderId === libraryFolderFilter);
      return queryMatch && tagMatch && authorMatch && folderMatch;
    });
  }, [folderNameById, libraryAuthorFilter, libraryFolderFilter, libraryItems, libraryQuery, libraryTagFilter]);

  useEffect(() => {
    let cancelled = false;
    const fallbackPayload = loadStoryboardLibrary(libraryStorageKey);
    setLibraryItems(fallbackPayload.items);
    setLibraryFolders(fallbackPayload.folders);
    setLibraryFolderFilter('alle');
    setLibraryHydrated(!projectId);

    if (!projectId) {
      setLibraryHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    void loadRawStoryboardLibraryPayloadForProject(projectId, libraryScopeKey).then((payload) => {
      if (cancelled) return;
      if (payload) {
        const parsedPayload = parseStoryboardLibraryPayload(payload);
        setLibraryItems(parsedPayload.items);
        setLibraryFolders(parsedPayload.folders);
      }
      setLibraryHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [libraryScopeKey, libraryStorageKey, projectId]);

  useEffect(() => {
    if (!libraryHydrated) return;
    void saveStoryboardLibraryPayloadForProject(projectId, libraryScopeKey, {
      items: libraryItems,
      folders: libraryFolders,
    });
  }, [libraryFolders, libraryHydrated, libraryItems, libraryScopeKey, projectId]);

  useEffect(() => {
    if (!editingFrame) {
      setEditDraft(null);
      return;
    }
    setEditDraft({ ...editingFrame });
  }, [editingFrame]);

  const patchFrame = useCallback(
    (frameId: string, patch: Partial<StoryboardFrame>) => {
      const hasDetailLevel = Object.prototype.hasOwnProperty.call(patch, 'detailLevel');
      const hasAssist = Object.prototype.hasOwnProperty.call(patch, 'assist');
      const hasScreenDirection = Object.prototype.hasOwnProperty.call(patch, 'screenDirection');
      onUpdate(
        frames.map((frame) =>
          frame.id === frameId
            ? {
                ...frame,
                ...patch,
                detailLevel:
                  hasDetailLevel && isStoryboardDetailLevel(patch.detailLevel)
                    ? patch.detailLevel
                    : frame.detailLevel || 'idea',
                screenDirection: hasScreenDirection
                  ? (isScreenDirection(patch.screenDirection) ? patch.screenDirection : undefined)
                  : frame.screenDirection,
                assist:
                  hasDetailLevel || hasAssist
                    ? mergeAssistSettings(
                        hasDetailLevel && isStoryboardDetailLevel(patch.detailLevel)
                          ? patch.detailLevel
                          : frame.detailLevel || 'idea',
                        hasAssist ? patch.assist : frame.assist
                      )
                    : frame.assist,
                updatedAt: new Date().toISOString(),
              }
            : frame
        )
      );
    },
    [frames, onUpdate]
  );

  const removeFrame = useCallback(
    (frameId: string) => {
      onUpdate(frames.filter((frame) => frame.id !== frameId));
      setDeletingFrameId(null);
    },
    [frames, onUpdate]
  );

  const handleAddFrame = () => {
    const newFrame = createStoryboardDraftFrame(frames, {
      sceneId,
      detailLevel: workspaceMode === 'review' ? 'presentation' : workspaceMode === 'scene' ? 'blocking' : 'idea',
    });
    const nextFrames = [...frames, newFrame];
    onUpdate(nextFrames);
    onSelectFrame(nextFrames.length - 1);
  };

  const duplicateFrame = useCallback(
    (
      sourceFrame: StoryboardFrame,
      existingFrames: StoryboardFrame[],
      overrides: Partial<StoryboardFrame> = {}
    ): StoryboardFrame => {
      const now = new Date().toISOString();
      const nextDetailLevel =
        overrides.detailLevel && isStoryboardDetailLevel(overrides.detailLevel)
          ? overrides.detailLevel
          : sourceFrame.detailLevel || 'idea';
      const hasBlockingNotes = Object.prototype.hasOwnProperty.call(overrides, 'blockingNotes');
      const hasFocusPoint = Object.prototype.hasOwnProperty.call(overrides, 'focusPoint');
      const hasScreenDirection = Object.prototype.hasOwnProperty.call(overrides, 'screenDirection');
      const hasAssist = Object.prototype.hasOwnProperty.call(overrides, 'assist');
      const hasVariantLabel = Object.prototype.hasOwnProperty.call(overrides, 'variantLabel');
      const shotNumberCandidate =
        typeof overrides.shotNumber === 'string' && overrides.shotNumber.trim().length > 0
          ? overrides.shotNumber
          : `${sourceFrame.shotNumber || getNextShotNumber(existingFrames)}-copy`;

      return {
        ...cloneStoryboardFrame(sourceFrame),
        ...overrides,
        id: createFrameId(),
        shotNumber: buildUniqueShotNumber(existingFrames, shotNumberCandidate),
        detailLevel: nextDetailLevel,
        blockingNotes: hasBlockingNotes
          ? (typeof overrides.blockingNotes === 'string' ? overrides.blockingNotes.trim() || undefined : undefined)
          : sourceFrame.blockingNotes,
        focusPoint: hasFocusPoint
          ? (typeof overrides.focusPoint === 'string' ? overrides.focusPoint.trim() || undefined : undefined)
          : sourceFrame.focusPoint,
        screenDirection: hasScreenDirection
          ? (isScreenDirection(overrides.screenDirection) ? overrides.screenDirection : undefined)
          : sourceFrame.screenDirection,
        assist: mergeAssistSettings(nextDetailLevel, hasAssist ? overrides.assist : sourceFrame.assist),
        variantLabel: hasVariantLabel
          ? (typeof overrides.variantLabel === 'string' ? overrides.variantLabel.trim() || undefined : undefined)
          : sourceFrame.variantLabel,
        createdAt: now,
        updatedAt: now,
        drawingData: sourceFrame.drawingData
          ? {
              ...sourceFrame.drawingData,
              createdAt: now,
              updatedAt: now,
            }
          : undefined,
      };
    },
    []
  );

  const handleDuplicateActiveFrame = useCallback(() => {
    if (!activeFrame) {
      showInfo('Velg en frame for å duplisere den.');
      return;
    }
    const duplicate = duplicateFrame(activeFrame, frames, {
      shotNumber: `${activeFrame.shotNumber}-copy`,
      variantGroupId: undefined,
      variantLabel: undefined,
    });
    const insertIndex = activeFrameIndex + 1;
    const nextFrames = [...frames];
    nextFrames.splice(insertIndex, 0, duplicate);
    onUpdate(nextFrames);
    onSelectFrame(insertIndex);
    showSuccess(`Dupliserte shot ${activeFrame.shotNumber}.`);
  }, [activeFrame, activeFrameIndex, duplicateFrame, frames, onSelectFrame, onUpdate, showInfo, showSuccess]);

  const handleCreateVariantsForActiveFrame = useCallback(() => {
    if (!activeFrame) {
      showInfo('Velg en frame for å lage varianter.');
      return;
    }

    const variantGroupId = activeFrame.variantGroupId || createFrameId();
    const updatedActiveFrame: StoryboardFrame = {
      ...activeFrame,
      variantGroupId,
      variantLabel: activeFrame.variantLabel || 'Original',
      assist: mergeAssistSettings(activeDetailLevel, activeFrame.assist),
      updatedAt: new Date().toISOString(),
    };

    const variants: StoryboardFrame[] = [];
    ['A', 'B', 'C'].forEach((suffix, index) => {
      variants.push(
        duplicateFrame(activeFrame, [...frames, ...variants], {
          shotNumber: `${activeFrame.shotNumber}-${suffix}`,
          variantGroupId,
          variantLabel: `Variant ${suffix}`,
          description: activeFrame.description,
          detailLevel: activeDetailLevel,
          notes:
            index === 0
              ? activeFrame.notes
              : `${activeFrame.notes ? `${activeFrame.notes}\n` : ''}Utforsk alternativ ${suffix}`,
        })
      );
    });

    const nextFrames = frames.map((frame, index) =>
      index === activeFrameIndex ? updatedActiveFrame : frame
    );
    nextFrames.splice(activeFrameIndex + 1, 0, ...variants);
    onUpdate(nextFrames);
    onSelectFrame(activeFrameIndex + 1);
    showSuccess(`La til 3 varianter for shot ${activeFrame.shotNumber}.`);
  }, [
    activeDetailLevel,
    activeFrame,
    activeFrameIndex,
    duplicateFrame,
    frames,
    onSelectFrame,
    onUpdate,
    showInfo,
    showSuccess,
  ]);

  const handleSetActiveDetailLevel = useCallback(
    (detailLevel: StoryboardDetailLevel) => {
      if (!activeFrame) {
        showInfo('Velg en frame for å endre detaljnivaa.');
        return;
      }
      patchFrame(activeFrame.id, { detailLevel });
    },
    [activeFrame, patchFrame, showInfo]
  );

  const handleToggleAssistFlag = useCallback(
    (flag: StoryboardAssistFlag) => {
      if (!activeFrame) {
        showInfo('Velg en frame for å justere guide-lagene.');
        return;
      }
      const nextAssist = {
        ...(mergeAssistSettings(activeDetailLevel, activeFrame.assist) || {}),
        [flag]: !(mergeAssistSettings(activeDetailLevel, activeFrame.assist)?.[flag] ?? false),
      };
      patchFrame(activeFrame.id, { assist: nextAssist });
    },
    [activeDetailLevel, activeFrame, patchFrame, showInfo]
  );

  const saveFrameToLibrary = useCallback(
    (frame: StoryboardFrame) => {
      const optimizedFrame = optimizeFrameForLibraryStorage(frame);
      const tags = buildLibraryItemTags(optimizedFrame, sceneNumber, sceneHeading);
      const authorName = currentAuthorName;
      const authorId = currentAuthorId;
      const shotLabel = frame.shotNumber || frame.description;

      const existingIdx = libraryItems.findIndex(
        (item) =>
          item.sourceSceneId === sceneId &&
          item.frame.shotNumber === frame.shotNumber &&
          item.frame.description === frame.description
      );

      if (existingIdx >= 0) {
        const updateEvent = createCreditEvent(
          'updated',
          authorName,
          authorId,
          `Oppdaterte storyboard ${shotLabel} i bibliotek`
        );
        setLibraryItems((prev) =>
          prev.map((item, index) =>
            index === existingIdx
              ? {
                  ...item,
                  frame: optimizedFrame,
                  tags,
                  updatedAt: updateEvent.timestamp,
                  creditLog: [...(item.creditLog || []), updateEvent].slice(-120),
                }
              : item
          )
        );
        showInfo(`Oppdatert i storyboard-bibliotek: ${shotLabel}`);
        return;
      }

      const createEvent = createCreditEvent(
        'created',
        authorName,
        authorId,
        `Opprettet storyboard ${shotLabel} i bibliotek`
      );
      const savedItem: StoryboardLibraryItem = {
        id: createFrameId(),
        frame: optimizedFrame,
        folderId:
          libraryFolderFilter !== 'alle' && libraryFolderFilter !== 'uten-mappe'
            ? libraryFolderFilter
            : undefined,
        createdAt: createEvent.timestamp,
        updatedAt: createEvent.timestamp,
        authorId,
        authorName,
        sourceSceneId: sceneId,
        sourceSceneNumber: sceneNumber,
        sourceSceneHeading: sceneHeading,
        tags,
        creditLog: [createEvent],
      };

      setLibraryItems((prev) => [savedItem, ...prev]);
      showSuccess(`Lagt til i storyboard-bibliotek: ${shotLabel}`);
    },
    [
      currentAuthorId,
      currentAuthorName,
      libraryItems,
      libraryFolderFilter,
      sceneHeading,
      sceneId,
      sceneNumber,
      showInfo,
      showSuccess,
    ]
  );

  const handleSaveActiveFrameToLibrary = useCallback(() => {
    if (!activeFrame) {
      showInfo('Velg en storyboard-frame først for å lagre i biblioteket.');
      return;
    }
    saveFrameToLibrary(activeFrame);
  }, [activeFrame, saveFrameToLibrary, showInfo]);

  const handleSaveFrameCardToLibrary = useCallback(
    (frame: StoryboardFrame) => {
      saveFrameToLibrary(frame);
    },
    [saveFrameToLibrary]
  );

  const handleInsertFromLibrary = useCallback(
    (item: StoryboardLibraryItem, mode: 'append' | 'replace') => {
      if (mode === 'replace' && frames.length > 0 && frames[activeFrameIndex]) {
        const currentFrame = frames[activeFrameIndex];
        const replacementFrame: StoryboardFrame = {
          ...cloneStoryboardFrame(item.frame),
          id: currentFrame.id,
          shotNumber: currentFrame.shotNumber,
          sceneId,
          createdAt: currentFrame.createdAt,
          updatedAt: new Date().toISOString(),
        };
        onUpdate(
          frames.map((frame, index) => (index === activeFrameIndex ? replacementFrame : frame))
        );
        onSelectFrame(activeFrameIndex);
        showSuccess(`Erstattet shot ${currentFrame.shotNumber} fra bibliotek.`);
        return;
      }

      const now = new Date().toISOString();
      const insertedFrame: StoryboardFrame = {
        ...cloneStoryboardFrame(item.frame),
        id: createFrameId(),
        shotNumber: getNextShotNumber(frames),
        sceneId,
        createdAt: now,
        updatedAt: now,
      };
      const updatedFrames = [...frames, insertedFrame];
      onUpdate(updatedFrames);
      onSelectFrame(updatedFrames.length - 1);
      showSuccess(`La til storyboard fra bibliotek som shot ${insertedFrame.shotNumber}.`);
    },
    [activeFrameIndex, frames, onSelectFrame, onUpdate, sceneId, showSuccess]
  );

  const handleDeleteLibraryItem = useCallback(
    (itemId: string) => {
      setLibraryItems((prev) => prev.filter((item) => item.id !== itemId));
      showInfo('Storyboard fjernet fra biblioteket.');
    },
    [showInfo]
  );

  const handleCreateLibraryFolder = useCallback(() => {
    const normalizedName = newFolderName.trim();
    if (!normalizedName) {
      showInfo('Skriv inn et mappenavn først.');
      return;
    }
    const exists = libraryFolders.some(
      (folder) => normalizeTag(folder.name) === normalizeTag(normalizedName)
    );
    if (exists) {
      showInfo('En mappe med dette navnet finnes allerede.');
      return;
    }
    const folder: StoryboardLibraryFolder = {
      id: createFrameId(),
      name: normalizedName,
      createdAt: new Date().toISOString(),
      createdByName: currentAuthorName,
    };
    setLibraryFolders((prev) => [folder, ...prev]);
    setNewFolderName('');
    setLibraryFolderFilter(folder.id);
    showSuccess(`Opprettet mappe: ${normalizedName}`);
  }, [currentAuthorName, libraryFolders, newFolderName, showInfo, showSuccess]);

  const handleAssignItemToFolder = useCallback(
    (itemId: string, folderId: string) => {
      const normalizedFolderId = folderId === 'uten-mappe' || folderId === '' ? undefined : folderId;
      const folderName = normalizedFolderId
        ? folderNameById.get(normalizedFolderId) || 'Ukjent mappe'
        : 'Uten mappe';
      setLibraryItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          const updateEvent = createCreditEvent(
            'updated',
            currentAuthorName,
            currentAuthorId,
            `Flyttet storyboard til mappe: ${folderName}`
          );
          return {
            ...item,
            folderId: normalizedFolderId,
            updatedAt: updateEvent.timestamp,
            creditLog: [...(item.creditLog || []), updateEvent].slice(-120),
          };
        })
      );
      showInfo(`Storyboard flyttet til: ${folderName}`);
    },
    [currentAuthorId, currentAuthorName, folderNameById, showInfo]
  );

  const handleDeleteLibraryFolder = useCallback(
    (folderId: string) => {
      const folder = libraryFolders.find((entry) => entry.id === folderId);
      if (!folder) return;
      const affectedItems = libraryItems.filter((item) => item.folderId === folderId);
      const updateTimestamp = new Date().toISOString();
      setLibraryFolders((prev) => prev.filter((entry) => entry.id !== folderId));
      setLibraryItems((prev) =>
        prev.map((item) => {
          if (item.folderId !== folderId) return item;
          const updateEvent: StoryboardCreditEvent = {
            id: createFrameId(),
            action: 'updated',
            actorId: currentAuthorId,
            actorName: currentAuthorName,
            timestamp: updateTimestamp,
            details: `Mappe "${folder.name}" ble slettet. Storyboard flyttet til Uten mappe`,
          };
          return {
            ...item,
            folderId: undefined,
            updatedAt: updateTimestamp,
            creditLog: [...(item.creditLog || []), updateEvent].slice(-120),
          };
        })
      );
      if (libraryFolderFilter === folderId) {
        setLibraryFolderFilter('alle');
      }
      showInfo(
        affectedItems.length > 0
          ? `Slettet mappe "${folder.name}". ${affectedItems.length} storyboard flyttet til Uten mappe.`
          : `Slettet mappe "${folder.name}".`
      );
    },
    [currentAuthorId, currentAuthorName, libraryFolderFilter, libraryFolders, libraryItems, showInfo]
  );

  const handleLibraryCardDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, itemId: string) => {
      event.dataTransfer.setData('text/storyboard-library-item-id', itemId);
      event.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const handleLibraryColumnDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>, folderId: string) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (dragOverFolderId !== folderId) {
        setDragOverFolderId(folderId);
      }
    },
    [dragOverFolderId]
  );

  const handleLibraryColumnDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>, folderId: string) => {
      event.preventDefault();
      const itemId = event.dataTransfer.getData('text/storyboard-library-item-id');
      if (itemId) {
        handleAssignItemToFolder(itemId, folderId);
      }
      setDragOverFolderId(null);
    },
    [handleAssignItemToFolder]
  );

  const getItemsForFolder = useCallback(
    (folderId: string) =>
      filteredLibraryItems.filter((item) =>
        folderId === 'uten-mappe' ? !item.folderId : item.folderId === folderId
      ),
    [filteredLibraryItems]
  );

  const drawingFrame = frames.find((frame) => frame.id === drawingFrameId);
  const drawingFrameDocument = useMemo<StoryboardDrawingDocument | undefined>(() => {
    if (!drawingFrame?.drawingData) return undefined;
    return restoreStoryboardDrawingDocumentFromLegacy({
      document: drawingFrame.drawingData.document,
      strokes: drawingFrame.drawingData.strokes,
      baseImageUrl: drawingFrame.drawingData.baseImageUrl || drawingFrame.imageUrl,
      originalBaseImageUrl: drawingFrame.drawingData.originalBaseImageUrl || drawingFrame.imageUrl,
      dataUrl: drawingFrame.drawingData.dataUrl || drawingFrame.imageUrl,
      brushSettings: drawingFrame.drawingData.brushSettings,
    }, {
      frameId: drawingFrame.id,
      workflowLevel: drawingFrame.detailLevel,
      createdAt: drawingFrame.drawingData.createdAt,
      updatedAt: drawingFrame.drawingData.updatedAt,
    });
  }, [drawingFrame]);
  const drawingFrameInitialStrokes = useMemo(
    () => parseStoredStrokes(drawingFrame?.drawingData?.strokes) || (
      drawingFrameDocument ? getPrimaryStoryboardDocumentStrokes(drawingFrameDocument) : undefined
    ),
    [drawingFrame?.drawingData?.strokes, drawingFrameDocument]
  );
  const drawingFrameBaseImage = useMemo(() => {
    if (!drawingFrame) return undefined;
    return drawingFrameInitialStrokes !== undefined
      ? drawingFrame.drawingData?.baseImageUrl
      : drawingFrame.imageUrl;
  }, [drawingFrame, drawingFrameInitialStrokes]);
  const drawingFrameReferenceImage = useMemo(() => {
    const reference = drawingFrameDocument
      ? getPrimaryStoryboardDocumentReferenceImage(drawingFrameDocument)
      : undefined;
    if (!reference) return undefined;
    return {
      src: reference.src,
      opacity: reference.opacity,
      visible: reference.visible,
      x: reference.x,
      y: reference.y,
      width: reference.width,
      height: reference.height,
    };
  }, [drawingFrameDocument]);
  const cameraAngles = Array.from(STORYBOARD_LANGUAGE_OPTIONS);

  return (
    <Box>
      <Paper
        sx={{
          p: 2,
          mb: 2,
          border: '1px solid rgba(59, 130, 246, 0.25)',
          background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        }}
      >
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h6">Storyboard-rutenett</Typography>
              <Chip size="small" color="primary" variant="outlined" label={`${frames.length} frames`} />
              <Chip
                size="small"
                color="secondary"
                variant="outlined"
                label={`Modus: ${WORKSPACE_MODE_OPTIONS.find((option) => option.value === workspaceMode)?.label || 'Thumbnails'}`}
              />
              {(device.isIPad || device.hasTouchScreen) && (
                <Chip
                  icon={device.hasPencilSupport ? <CreateIcon /> : <TouchAppIcon />}
                  label={device.hasPencilSupport ? 'Apple Pencil klar' : 'Touch-tegning'}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              )}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch">
              <Button
                startIcon={<SaveIcon />}
                variant="outlined"
                size="small"
                onClick={handleSaveActiveFrameToLibrary}
                disabled={!activeFrame}
              >
                Lagre valgt i bibliotek
              </Button>
              <Button
                startIcon={<CollectionsBookmarkIcon />}
                variant="outlined"
                size="small"
                onClick={() => setLibraryDialogOpen(true)}
              >
                Storyboard-bibliotek ({libraryItems.length})
              </Button>
              <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={handleAddFrame}>
                Ny storyboard
              </Button>
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', lg: 'center' }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={workspaceMode}
              onChange={(_, mode: StoryboardWorkspaceMode | null) => {
                if (mode) setWorkspaceMode(mode);
              }}
            >
              {WORKSPACE_MODE_OPTIONS.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch" sx={{ flex: 1 }}>
              <Button
                startIcon={<ContentCopyIcon />}
                variant="outlined"
                size="small"
                disabled={!activeFrame}
                onClick={handleDuplicateActiveFrame}
              >
                Dupliser valgt
              </Button>
              <Button
                startIcon={<AutoAwesomeIcon />}
                variant="outlined"
                size="small"
                disabled={!activeFrame}
                onClick={handleCreateVariantsForActiveFrame}
              >
                Lag 3 varianter
              </Button>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={activeDetailLevel}
                onChange={(_, value: StoryboardDetailLevel | null) => {
                  if (value) handleSetActiveDetailLevel(value);
                }}
                sx={{ flexWrap: 'wrap' }}
              >
                {DETAIL_LEVEL_OPTIONS.map((option) => (
                  <ToggleButton key={option.value} value={option.value}>
                    {option.shortLabel}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>
          </Stack>

          {activeFrame && (
            <Stack spacing={1}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField
                  select
                  size="small"
                  label="Shot language"
                  value={activeFrame.cameraAngle || STORYBOARD_LANGUAGE_OPTIONS[0]}
                  onChange={(event) => patchFrame(activeFrame.id, { cameraAngle: event.target.value })}
                  sx={{ minWidth: { xs: '100%', md: 180 } }}
                >
                  {STORYBOARD_LANGUAGE_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Screen direction"
                  value={activeFrame.screenDirection || ''}
                  onChange={(event) =>
                    patchFrame(activeFrame.id, {
                      screenDirection: event.target.value ? (event.target.value as ScreenDirection) : undefined,
                    })
                  }
                  sx={{ minWidth: { xs: '100%', md: 180 } }}
                >
                  <MenuItem value="">Ingen</MenuItem>
                  {SCREEN_DIRECTION_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {getScreenDirectionLabel(option)}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="Fokuspunkt"
                  value={activeFrame.focusPoint || ''}
                  onChange={(event) => patchFrame(activeFrame.id, { focusPoint: event.target.value })}
                  sx={{ minWidth: { xs: '100%', md: 200 } }}
                />
                <TextField
                  size="small"
                  label="Blocking"
                  value={activeFrame.blockingNotes || ''}
                  onChange={(event) => patchFrame(activeFrame.id, { blockingNotes: event.target.value })}
                  sx={{ flex: 1, minWidth: { xs: '100%', md: 240 } }}
                />
              </Stack>

              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {activeAssistOptions.map((option) => {
                  const enabled = Boolean(activeAssist?.[option.key]);
                  return (
                    <Chip
                      key={option.key}
                      label={option.label}
                      size="small"
                      color={enabled ? 'primary' : 'default'}
                      variant={enabled ? 'filled' : 'outlined'}
                      onClick={() => handleToggleAssistFlag(option.key)}
                    />
                  );
                })}
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${getAssistCount(activeAssist)} aktive guider`}
                />
                {activeFrame.variantLabel && (
                  <Chip size="small" color="secondary" variant="outlined" label={activeFrame.variantLabel} />
                )}
              </Stack>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: workspaceMode === 'thumbnail' ? 1.5 : 2,
          gridTemplateColumns: {
            xs: workspaceMode === 'thumbnail' ? 'repeat(2, minmax(0, 1fr))' : '1fr',
            sm: workspaceMode === 'thumbnail' ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
            lg: workspaceMode === 'thumbnail' ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
            xl: workspaceMode === 'thumbnail' ? 'repeat(5, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        {frames.length === 0 && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <RoleRoomEmptyState
              iconSrc={storyboardEmptyPng}
              title="Bygg storyboardet ditt"
              subtitle="Hver frame representerer ett shot. Start med å legge til det første — du kan tegne, importere bilder og koble frames til manus."
              color="#b86bff"
              buttonLabel="Opprett første frame"
              onAction={handleAddFrame}
            />
          </Box>
        )}

        {frames.map((frame, index) => (
          <Box key={frame.id} sx={{ minWidth: 0 }}>
            <StoryboardFrameCard
              frame={frame}
              index={index}
              workspaceMode={workspaceMode}
              isActive={index === activeFrameIndex}
              onSelect={() => onSelectFrame(index)}
              onQuickViewClick={() => setQuickViewFrameId(frame.id)}
              onDrawClick={() => setDrawingFrameId(frame.id)}
              onEditClick={() => setEditingFrameId(frame.id)}
              onDeleteClick={() => setDeletingFrameId(frame.id)}
              onDuplicateClick={() => {
                onSelectFrame(index);
                const duplicate = duplicateFrame(frame, frames, {
                  shotNumber: `${frame.shotNumber}-copy`,
                  variantGroupId: undefined,
                  variantLabel: undefined,
                });
                const nextFrames = [...frames];
                nextFrames.splice(index + 1, 0, duplicate);
                onUpdate(nextFrames);
                onSelectFrame(index + 1);
              }}
              onCreateVariantsClick={() => {
                onSelectFrame(index);
                const variantGroupId = frame.variantGroupId || createFrameId();
                const updatedFrame: StoryboardFrame = {
                  ...frame,
                  variantGroupId,
                  variantLabel: frame.variantLabel || 'Original',
                  assist: mergeAssistSettings(frame.detailLevel || 'idea', frame.assist),
                  updatedAt: new Date().toISOString(),
                };
                const variants: StoryboardFrame[] = [];
                ['A', 'B', 'C'].forEach((suffix, variantIndex) => {
                  variants.push(
                    duplicateFrame(frame, [...frames, ...variants], {
                      shotNumber: `${frame.shotNumber}-${suffix}`,
                      variantGroupId,
                      variantLabel: `Variant ${suffix}`,
                      notes:
                        variantIndex === 0
                          ? frame.notes
                          : `${frame.notes ? `${frame.notes}\n` : ''}Utforsk alternativ ${suffix}`,
                    })
                  );
                });
                const nextFrames = frames.map((entry, entryIndex) =>
                  entryIndex === index ? updatedFrame : entry
                );
                nextFrames.splice(index + 1, 0, ...variants);
                onUpdate(nextFrames);
                onSelectFrame(index + 1);
              }}
              onSaveToLibraryClick={() => handleSaveFrameCardToLibrary(frame)}
              onCameraClick={() => {
                const current = cameraAngles.indexOf(frame.cameraAngle);
                const next = cameraAngles[(current + 1 + cameraAngles.length) % cameraAngles.length];
                patchFrame(frame.id, { cameraAngle: next });
              }}
              onLightClick={() => {
                const tag = '[Lys: planlagt]';
                const notes = frame.notes || '';
                const hasTag = notes.includes(tag);
                const nextNotes = hasTag
                  ? notes.replace(tag, '').replace(/\n{2,}/g, '\n').trim()
                  : `${notes}${notes ? '\n' : ''}${tag}`;
                patchFrame(frame.id, { notes: nextNotes || undefined });
              }}
              showDrawButton={true}
              drawPrompt={
                device.hasPencilSupport
                  ? 'Trykk for å tegne med Apple Pencil'
                  : device.hasTouchScreen
                    ? 'Trykk for å tegne'
                    : 'Klikk for å tegne'
              }
            />
          </Box>
        ))}
      </Box>

      {/* Sprint A.7: Continuity strip — ±2 nabo-frames synlige + style-drift. */}
      {storyboardFrames.length > 1 && (
        <Box sx={{ mt: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }} data-testid="continuity-mount">
          <ContinuityStrip
            frames={storyboardFrames.map((f) => ({
              id: f.id,
              imageUrl: f.imageUrl,
              thumbnailUrl: f.thumbnailUrl,
              description: f.description,
              shotNumber: f.shotNumber,
            }))}
            activeIndex={activeFrameIdx}
            onSelectFrame={handleFrameSelect}
            compact
          />
          <StyleConsistencyIndicator
            frames={storyboardFrames}
            activeFrameId={storyboardFrames[activeFrameIdx]?.id}
            compact
          />
        </Box>
      )}

      {/* Sprint A.7: Creative Studio — shot-forslag, coverage, refs,
          mood-board, pose-bibliotek. Vises som sticky-sidepanel når
          showCreativeStudio er på. */}
      {showCreativeStudio && (
        <Box
          sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}
          data-testid="creative-studio-mount"
        >
          <CreativeSuggestionsPanel
            activeScene={scene}
            allScenes={allScenes ?? [scene]}
            dialogue={sceneDialogue ?? []}
            compact
          />
          <MoodBoardPanel sceneId={scene.id} compact />
          <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
            <PoseLibraryPanel
              canvasWidth={1280}
              canvasHeight={720}
              compact
              onInsertPose={(poseStrokes) => {
                const targetFrame = frames[activeFrameIndex] ?? frames[0];
                if (!targetFrame) return;
                const converted: PencilStroke[] = poseStrokes.map((s) => ({
                  inputType: 'pen',
                  color: s.color,
                  width: s.width,
                  opacity: s.opacity,
                  points: s.points.map((p) => ({
                    x: p.x,
                    y: p.y,
                    pressure: p.pressure,
                    tiltX: 0,
                    tiltY: 0,
                    timestamp: p.t,
                  })),
                }));
                setPendingPoseStrokes(converted);
                setDrawingFrameId(targetFrame.id);
              }}
            />
          </Box>
        </Box>
      )}

      {/* iPad Drawing Editor Dialog */}
      {drawingFrame && (
        <FrameDrawingEditor
          frameId={drawingFrame.id}
          // Arver cinema-format fra prosjektnivå (CastingProject.cinemaFormat).
          // Faller tilbake til frame-spesifikk lagret aspectRatio i drawing-data,
          // og til 16:9 først hvis intet annet er definert.
          aspectRatio={
            projectCinemaFormat
              ?? drawingFrame.drawingData?.document?.aspectRatio
              ?? '16:9'
          }
          initialImage={drawingFrameBaseImage}
          initialStrokes={drawingFrameInitialStrokes}
          additionalInitialStrokes={pendingPoseStrokes ?? undefined}
          initialDrawingData={drawingFrame.drawingData}
          workflowLevel={drawingFrame.detailLevel || 'idea'}
          mode="dialog"
          sceneId={sceneId}
          referenceImage={drawingFrameReferenceImage}
          onSave={async (drawingData, imageUrl) => {
            // Lokalt callback (oppdaterer frame-state i parent)
            onFrameDrawingComplete(drawingFrame.id, drawingData, imageUrl);
            setDrawingFrameId(null);
            setPendingPoseStrokes(null);

            // Persistens til backend — "fire and forget", logger feil men
            // blokkerer ikke UI. Bruker upsert via frame_id slik at samme
            // frame ikke duplikat-lagres ved gjentatte save.
            if (projectId) {
              try {
                const { upsertStoryboard } = await import('../services/storyboardApiService');
                const drawingObj = drawingData as { strokes?: unknown[]; width?: number; height?: number } | null;
                await upsertStoryboard(projectId, {
                  sceneId: sceneId ?? null,
                  frameId: drawingFrame.id,
                  title: drawingFrame.title ?? null,
                  strokes: drawingObj?.strokes ?? [],
                  imageData: imageUrl ?? null,
                  width: drawingObj?.width ?? null,
                  height: drawingObj?.height ?? null,
                  workflowLevel: drawingFrame.detailLevel ?? 'idea',
                });
              } catch (err) {
                console.warn('[Storyboard] Persist to API failed (frame still saved locally):', err);
              }
            }
          }}
          onCancel={() => {
            setDrawingFrameId(null);
            setPendingPoseStrokes(null);
          }}
        />
      )}

      <Dialog
        open={libraryDialogOpen}
        onClose={() => setLibraryDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Storyboard-bibliotek</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="caption" color="text.secondary">
                Visning
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={libraryLayoutMode}
                onChange={(_, mode) => {
                  if (mode) setLibraryLayoutMode(mode);
                }}
              >
                <ToggleButton value="grid">Rutenett</ToggleButton>
                <ToggleButton value="kanban">Mapper (drag & drop)</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <TextField
              fullWidth
              size="small"
              label="Søk i storyboard-bibliotek"
              placeholder="Søk på beskrivelse, scene, tagg eller forfatter…"
              value={libraryQuery}
              onChange={(event) => setLibraryQuery(event.target.value)}
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                label="Alle"
                size="small"
                color={libraryTagFilter === 'alle' ? 'primary' : 'default'}
                onClick={() => setLibraryTagFilter('alle')}
                variant={libraryTagFilter === 'alle' ? 'filled' : 'outlined'}
              />
              {availableLibraryTags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  color={normalizeTag(libraryTagFilter) === normalizeTag(tag) ? 'primary' : 'default'}
                  onClick={() => setLibraryTagFilter(tag)}
                  variant={normalizeTag(libraryTagFilter) === normalizeTag(tag) ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
            <Stack spacing={0.75}>
              <Typography variant="caption" color="text.secondary">
                Forfatter
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  label="Alle"
                  size="small"
                  color={libraryAuthorFilter === 'alle' ? 'primary' : 'default'}
                  onClick={() => setLibraryAuthorFilter('alle')}
                  variant={libraryAuthorFilter === 'alle' ? 'filled' : 'outlined'}
                />
                {availableLibraryAuthors.map((author) => (
                  <Chip
                    key={author}
                    label={author}
                    size="small"
                    color={normalizeTag(libraryAuthorFilter) === normalizeTag(author) ? 'primary' : 'default'}
                    onClick={() => setLibraryAuthorFilter(author)}
                    variant={normalizeTag(libraryAuthorFilter) === normalizeTag(author) ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            </Stack>
            <Stack spacing={0.75}>
              <Typography variant="caption" color="text.secondary">
                Mapper
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  size="small"
                  label="Ny mappe"
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleCreateLibraryFolder();
                    }
                  }}
                  sx={{ minWidth: { xs: '100%', sm: 220 } }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleCreateLibraryFolder}
                >
                  Opprett mappe
                </Button>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  label="Alle mapper"
                  size="small"
                  color={libraryFolderFilter === 'alle' ? 'primary' : 'default'}
                  onClick={() => setLibraryFolderFilter('alle')}
                  variant={libraryFolderFilter === 'alle' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Uten mappe"
                  size="small"
                  color={libraryFolderFilter === 'uten-mappe' ? 'primary' : 'default'}
                  onClick={() => setLibraryFolderFilter('uten-mappe')}
                  variant={libraryFolderFilter === 'uten-mappe' ? 'filled' : 'outlined'}
                />
                {availableLibraryFolders.map((folder) => (
                  <Chip
                    key={folder.id}
                    label={folder.name}
                    size="small"
                    color={libraryFolderFilter === folder.id ? 'primary' : 'default'}
                    onClick={() => setLibraryFolderFilter(folder.id)}
                    onDelete={() => handleDeleteLibraryFolder(folder.id)}
                    variant={libraryFolderFilter === folder.id ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            </Stack>
          </Stack>

          {libraryItems.length === 0 ? (
            <Alert severity="info">
              Biblioteket er tomt. Lagre en valgt storyboard-frame for å bygge opp biblioteket.
            </Alert>
          ) : filteredLibraryItems.length === 0 ? (
            <Alert severity="info">
              Ingen treff i biblioteket for dette søket/filteret.
            </Alert>
          ) : libraryLayoutMode === 'grid' ? (
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            >
              {filteredLibraryItems.map((item) => {
                const previewUrl = item.frame.thumbnailUrl || item.frame.imageUrl;
                const sourceLabel =
                  item.sourceSceneHeading ||
                  (item.sourceSceneNumber !== undefined ? `Scene ${item.sourceSceneNumber}` : 'Ukjent scene');
                const authorLabel = item.authorName || 'Ukjent forfatter';
                const lastCreditEvent = (item.creditLog || [])[item.creditLog ? item.creditLog.length - 1 : -1];
                const lastEditorLabel = lastCreditEvent?.actorName || authorLabel;
                const lastEditedAt = lastCreditEvent?.timestamp || item.updatedAt || item.createdAt;
                const folderLabel = item.folderId ? folderNameById.get(item.folderId) || 'Ukjent mappe' : 'Uten mappe';

                return (
                  <Card
                    key={item.id}
                    sx={{
                      border: '1px solid rgba(148,163,184,0.28)',
                      background:
                        'linear-gradient(180deg, rgba(2,6,23,0.96), rgba(15,23,42,0.96))',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'relative',
                        paddingTop: '56.25%',
                        borderBottom: '1px solid rgba(148,163,184,0.2)',
                        bgcolor: 'rgba(2,6,23,0.6)',
                      }}
                    >
                      {previewUrl ? (
                        <CardMedia
                          component="img"
                          image={previewUrl}
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <Stack
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ImageIcon sx={{ color: 'rgba(148,163,184,0.92)', fontSize: 32 }} />
                          <Typography variant="caption" color="rgba(148,163,184,0.95)">
                            Ingen thumbnail
                          </Typography>
                        </Stack>
                      )}
                    </Box>
                    <CardContent sx={{ pb: 1.5 }}>
                      <Stack spacing={1}>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(241,245,249,0.98)' }}>
                          {item.frame.description}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip
                            label={`Kamera: ${item.frame.cameraAngle}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(56,189,248,0.16)', color: 'rgba(224,242,254,0.95)' }}
                          />
                          <Chip
                            label={`Varighet: ${item.frame.duration}s`}
                            size="small"
                            sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: 'rgba(254,243,199,0.95)' }}
                          />
                          <Chip
                            label={`Av: ${authorLabel}`}
                            size="small"
                            onClick={() => setLibraryAuthorFilter(authorLabel)}
                            sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: 'rgba(243,232,255,0.95)' }}
                          />
                          <Chip
                            label={`Mappe: ${folderLabel}`}
                            size="small"
                            onClick={() => setLibraryFolderFilter(item.folderId || 'uten-mappe')}
                            sx={{ bgcolor: 'rgba(34,197,94,0.16)', color: 'rgba(220,252,231,0.98)' }}
                          />
                        </Stack>
                        <Typography variant="caption" color="rgba(148,163,184,0.9)">
                          Kilde: {sourceLabel}
                        </Typography>
                        <Typography variant="caption" color="rgba(148,163,184,0.9)">
                          Sist endret av: {lastEditorLabel}
                        </Typography>
                        {(item.tags || []).length > 0 && (
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            {(item.tags || []).slice(0, 4).map((tag) => (
                              <Chip
                                key={`${item.id}-${tag}`}
                                label={tag}
                                size="small"
                                variant="outlined"
                                onClick={() => setLibraryTagFilter(tag)}
                              />
                            ))}
                          </Stack>
                        )}
                        <Typography variant="caption" color="rgba(148,163,184,0.8)">
                          Opprettet: {new Date(item.createdAt).toLocaleString('nb-NO')}
                        </Typography>
                        <Typography variant="caption" color="rgba(148,163,184,0.8)">
                          Oppdatert: {new Date(lastEditedAt).toLocaleString('nb-NO')}
                        </Typography>
                      </Stack>
                    </CardContent>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ px: 2, pb: 2 }}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Button size="small" variant="contained" onClick={() => handleInsertFromLibrary(item, 'append')}>
                        Sett inn
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleInsertFromLibrary(item, 'replace')}
                        disabled={frames.length === 0}
                      >
                        Erstatt valgt
                      </Button>
                      <TextField
                        select
                        size="small"
                        label="Mappe"
                        value={item.folderId || 'uten-mappe'}
                        onChange={(event) => handleAssignItemToFolder(item.id, event.target.value)}
                        sx={{ minWidth: 170 }}
                      >
                        <MenuItem value="uten-mappe">Uten mappe</MenuItem>
                        {availableLibraryFolders.map((folder) => (
                          <MenuItem key={`move-${folder.id}`} value={folder.id}>
                            {folder.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Tooltip title="Slett fra bibliotek">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteLibraryItem(item.id)}
                          aria-label="Slett fra bibliotek"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Vis krediteringshistorikk">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => setCreditHistoryItemId(item.id)}
                          aria-label="Vis krediteringshistorikk"
                        >
                          <HistoryIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Card>
                );
              })}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                overflowX: 'auto',
                alignItems: 'stretch',
                pb: 1,
              }}
            >
              {kanbanColumns.map((column) => {
                const columnItems = getItemsForFolder(column.id);
                const isDropTarget = dragOverFolderId === column.id;
                const isRealFolder = column.id !== 'uten-mappe';
                return (
                  <Paper
                    key={column.id}
                    variant="outlined"
                    onDragOver={(event) => handleLibraryColumnDragOver(event, column.id)}
                    onDrop={(event) => handleLibraryColumnDrop(event, column.id)}
                    onDragLeave={() => setDragOverFolderId(null)}
                    sx={{
                      minWidth: 320,
                      maxWidth: 320,
                      p: 1.25,
                      borderColor: isDropTarget ? 'rgba(59,130,246,0.9)' : 'rgba(148,163,184,0.35)',
                      background: isDropTarget
                        ? 'linear-gradient(180deg, rgba(30,58,138,0.28), rgba(15,23,42,0.96))'
                        : 'linear-gradient(180deg, rgba(2,6,23,0.96), rgba(15,23,42,0.96))',
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                      <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
                        <Typography variant="subtitle2" noWrap>
                          {column.name}
                        </Typography>
                        <Chip size="small" label={columnItems.length} />
                      </Stack>
                      {isRealFolder && (
                        <Tooltip title={`Slett mappe "${column.name}"`}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteLibraryFolder(column.id)}
                            aria-label={`Slett mappe ${column.name}`}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                    <Stack
                      spacing={1}
                      sx={{
                        mt: 1.25,
                        minHeight: 260,
                        maxHeight: 520,
                        overflowY: 'auto',
                        pr: 0.5,
                      }}
                    >
                      {columnItems.length === 0 ? (
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.25,
                            borderStyle: 'dashed',
                            borderColor: 'rgba(148,163,184,0.45)',
                            bgcolor: 'rgba(15,23,42,0.5)',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            Dra storyboard hit for å flytte til denne mappen.
                          </Typography>
                        </Paper>
                      ) : (
                        columnItems.map((item) => {
                          const previewUrl = item.frame.thumbnailUrl || item.frame.imageUrl;
                          const authorLabel = item.authorName || 'Ukjent forfatter';
                          return (
                            <Box
                              key={`kanban-${item.id}`}
                              draggable
                              onDragStart={(event) => handleLibraryCardDragStart(event, item.id)}
                              onDragEnd={() => setDragOverFolderId(null)}
                              sx={{ cursor: 'grab' }}
                            >
                              <Paper
                                variant="outlined"
                                sx={{
                                  p: 1.1,
                                  borderColor: 'rgba(148,163,184,0.35)',
                                  bgcolor: 'rgba(15,23,42,0.8)',
                                }}
                              >
                                <Stack spacing={1}>
                                  <Box
                                    sx={{
                                      position: 'relative',
                                      width: '100%',
                                      pt: '56.25%',
                                      borderRadius: 1,
                                      overflow: 'hidden',
                                      bgcolor: 'rgba(2,6,23,0.55)',
                                    }}
                                  >
                                    {previewUrl ? (
                                      <CardMedia
                                        component="img"
                                        image={previewUrl}
                                        sx={{
                                          position: 'absolute',
                                          inset: 0,
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover',
                                        }}
                                      />
                                    ) : (
                                      <Stack
                                        sx={{
                                          position: 'absolute',
                                          inset: 0,
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                        }}
                                      >
                                        <ImageIcon sx={{ color: 'rgba(148,163,184,0.92)' }} />
                                      </Stack>
                                    )}
                                  </Box>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {item.frame.description}
                                  </Typography>
                                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                    <Chip size="small" label={item.frame.shotNumber} />
                                    <Chip size="small" label={authorLabel} variant="outlined" />
                                  </Stack>
                                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      onClick={() => handleInsertFromLibrary(item, 'append')}
                                    >
                                      Sett inn
                                    </Button>
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() => setCreditHistoryItemId(item.id)}
                                      aria-label="Vis krediteringshistorikk"
                                    >
                                      <HistoryIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleDeleteLibraryItem(item.id)}
                                      aria-label="Slett fra bibliotek"
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Stack>
                                </Stack>
                              </Paper>
                            </Box>
                          );
                        })
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
            {sceneLabel}
          </Typography>
          <Button
            startIcon={<SaveIcon />}
            onClick={handleSaveActiveFrameToLibrary}
            disabled={!activeFrame}
          >
            Lagre valgt frame
          </Button>
          <Button variant="contained" onClick={() => setLibraryDialogOpen(false)}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(creditHistoryItem)}
        onClose={() => setCreditHistoryItemId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Krediteringshistorikk{creditHistoryItem ? `: ${creditHistoryItem.frame.description}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          {creditHistoryItem && (creditHistoryItem.creditLog || []).length > 0 ? (
            <Stack spacing={1.25}>
              {[...(creditHistoryItem.creditLog || [])]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((entry) => (
                  <Paper
                    key={entry.id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderColor: 'rgba(148,163,184,0.3)',
                      backgroundColor: 'rgba(15,23,42,0.45)',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={entry.action === 'created' ? 'Opprettet' : 'Oppdatert'}
                        color={entry.action === 'created' ? 'success' : 'primary'}
                        variant="outlined"
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {entry.actorName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(entry.timestamp).toLocaleString('nb-NO')}
                      </Typography>
                    </Stack>
                    {entry.details && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                        {entry.details}
                      </Typography>
                    )}
                  </Paper>
                ))}
            </Stack>
          ) : (
            <Alert severity="info">Ingen historikk registrert ennå.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCreditHistoryItemId(null)}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(quickViewFrame)}
        onClose={() => setQuickViewFrameId(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Hurtigvisning: Shot {quickViewFrame?.shotNumber}
        </DialogTitle>
        <DialogContent dividers>
          {quickViewFrame?.imageUrl || quickViewFrame?.thumbnailUrl ? (
            <Stack spacing={2}>
              <Box
                component="img"
                src={quickViewFrame.imageUrl || quickViewFrame.thumbnailUrl || ''}
                alt={`Storyboard shot ${quickViewFrame.shotNumber}`}
                sx={{
                  width: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'rgba(2,6,23,0.85)',
                }}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Kamera: ${quickViewFrame.cameraAngle}`} size="small" />
                <Chip label={`Bevegelse: ${quickViewFrame.movement}`} size="small" />
                <Chip label={`Varighet: ${quickViewFrame.duration}s`} size="small" />
                <Chip label={getDetailLevelMeta(quickViewFrame.detailLevel).editorLabel} size="small" />
                {quickViewFrame.screenDirection && (
                  <Chip label={getScreenDirectionLabel(quickViewFrame.screenDirection)} size="small" />
                )}
                {quickViewFrame.variantLabel && <Chip label={quickViewFrame.variantLabel} size="small" color="secondary" />}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {quickViewFrame.description}
              </Typography>
              {quickViewFrame.focusPoint && (
                <Typography variant="body2">
                  Fokuspunkt: {quickViewFrame.focusPoint}
                </Typography>
              )}
              {quickViewFrame.blockingNotes && (
                <Typography variant="body2">
                  Blocking: {quickViewFrame.blockingNotes}
                </Typography>
              )}
              {quickViewFrame.notes && (
                <Typography variant="body2">
                  {quickViewFrame.notes}
                </Typography>
              )}
            </Stack>
          ) : (
            <Alert severity="info">
              Ingen forhåndsvisning tilgjengelig for denne storyboarden ennå.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<BrushIcon />}
            onClick={() => {
              if (!quickViewFrame) return;
              const frameIndex = frames.findIndex((frame) => frame.id === quickViewFrame.id);
              if (frameIndex >= 0) {
                onSelectFrame(frameIndex);
              }
              setQuickViewFrameId(null);
              setDrawingFrameId(quickViewFrame.id);
            }}
            disabled={!quickViewFrame}
          >
            Åpne tegning
          </Button>
          <Button variant="contained" onClick={() => setQuickViewFrameId(null)}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(editingFrameId && editDraft)}
        onClose={() => setEditingFrameId(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ 'data-testid': 'scene-storyboard-edit-dialog' }}
      >
        <DialogTitle data-testid="scene-storyboard-edit-title">Rediger frame</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Shot-nummer"
              value={editDraft?.shotNumber || ''}
              onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, shotNumber: event.target.value } : prev))}
              fullWidth
            />
            <TextField
              label="Beskrivelse"
              value={editDraft?.description || ''}
              onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
              fullWidth
              inputProps={{ 'data-testid': 'scene-storyboard-edit-description' }}
            />
            <Stack direction="row" gap={2}>
              <TextField
                select
                label="Detaljnivaa"
                value={editDraft?.detailLevel || 'idea'}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev && isStoryboardDetailLevel(event.target.value)
                      ? { ...prev, detailLevel: event.target.value }
                      : prev
                  )
                }
                fullWidth
              >
                {DETAIL_LEVEL_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.editorLabel}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Kamera"
                value={editDraft?.cameraAngle || ''}
                onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, cameraAngle: event.target.value } : prev))}
                fullWidth
              />
              <TextField
                label="Bevegelse"
                value={editDraft?.movement || ''}
                onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, movement: event.target.value } : prev))}
                fullWidth
              />
            </Stack>
            <Stack direction="row" gap={2}>
              <TextField
                select
                label="Screen direction"
                value={editDraft?.screenDirection || ''}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          screenDirection: event.target.value
                            ? (event.target.value as ScreenDirection)
                            : undefined,
                        }
                      : prev
                  )
                }
                fullWidth
              >
                <MenuItem value="">Ingen</MenuItem>
                {SCREEN_DIRECTION_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {getScreenDirectionLabel(option)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Fokuspunkt"
                value={editDraft?.focusPoint || ''}
                onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, focusPoint: event.target.value } : prev))}
                fullWidth
              />
            </Stack>
            <TextField
              label="Blocking"
              value={editDraft?.blockingNotes || ''}
              onChange={(event) =>
                setEditDraft((prev) => (prev ? { ...prev, blockingNotes: event.target.value } : prev))
              }
              multiline
              minRows={2}
              fullWidth
            />
            <TextField
              label="Varighet (sekunder)"
              type="number"
              inputProps={{ min: 1, max: 999 }}
              value={editDraft?.duration ?? 1}
              onChange={(event) =>
                setEditDraft((prev) => {
                  if (!prev) return prev;
                  const parsed = Number(event.target.value);
                  return { ...prev, duration: Number.isFinite(parsed) && parsed > 0 ? parsed : 1 };
                })
              }
              fullWidth
            />
            <TextField
              label="Notater"
              value={editDraft?.notes || ''}
              onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, notes: event.target.value } : prev))}
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingFrameId(null)} data-testid="scene-storyboard-edit-cancel">
            Avbryt
          </Button>
          <Button
            variant="contained"
            data-testid="scene-storyboard-edit-save"
            onClick={() => {
              if (!editingFrameId || !editDraft) return;
              const detailLevel = isStoryboardDetailLevel(editDraft.detailLevel)
                ? editDraft.detailLevel
                : 'idea';
              patchFrame(editingFrameId, {
                shotNumber: editDraft.shotNumber.trim() || '1A',
                description: editDraft.description.trim() || 'Ny shot',
                cameraAngle: editDraft.cameraAngle.trim() || 'Medium',
                movement: editDraft.movement.trim() || 'Static',
                duration: Math.max(1, Number(editDraft.duration) || 1),
                detailLevel,
                screenDirection: editDraft.screenDirection,
                focusPoint: editDraft.focusPoint?.trim() || undefined,
                blockingNotes: editDraft.blockingNotes?.trim() || undefined,
                notes: editDraft.notes?.trim() || undefined,
              });
              setEditingFrameId(null);
            }}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deletingFrameId)} onClose={() => setDeletingFrameId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Slett frame</DialogTitle>
        <DialogContent>
          <Typography>
            Er du sikker på at du vil slette denne framen?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingFrameId(null)}>Avbryt</Button>
          <Button color="error" variant="contained" onClick={() => deletingFrameId && removeFrame(deletingFrameId)}>
            Slett
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const StoryboardFrameCard: React.FC<{
  frame: StoryboardFrame;
  index: number;
  workspaceMode: StoryboardWorkspaceMode;
  isActive?: boolean;
  onSelect?: () => void;
  onQuickViewClick?: () => void;
  onDrawClick?: () => void;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  onDuplicateClick?: () => void;
  onCreateVariantsClick?: () => void;
  onSaveToLibraryClick?: () => void;
  onCameraClick?: () => void;
  onLightClick?: () => void;
  showDrawButton?: boolean;
  drawPrompt?: string;
}> = ({
  frame,
  index,
  workspaceMode,
  isActive,
  onSelect,
  onQuickViewClick,
  onDrawClick,
  onEditClick,
  onDeleteClick,
  onDuplicateClick,
  onCreateVariantsClick,
  onSaveToLibraryClick,
  onCameraClick,
  onLightClick,
  showDrawButton,
  drawPrompt,
}) => {
  const previewImageUrl = frame.thumbnailUrl || frame.imageUrl;
  const hasPreviewImage = Boolean(previewImageUrl);
  const detailMeta = getDetailLevelMeta(frame.detailLevel);
  const assistCount = getAssistCount(mergeAssistSettings(frame.detailLevel || 'idea', frame.assist));
  const isThumbnailMode = workspaceMode === 'thumbnail';
  const supportText = frame.blockingNotes || frame.focusPoint || frame.notes;

  return (
    <Card
      data-testid={isActive ? 'scene-storyboard-active-frame-card' : `scene-storyboard-frame-card-${frame.id}`}
      data-frame-id={frame.id}
      aria-label={`Storyboard frame ${index + 1}`}
      onClick={onSelect}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        borderRadius: isThumbnailMode ? 2 : 3,
        border: isActive ? '1px solid rgba(14, 165, 233, 0.95)' : '1px solid rgba(148,163,184,0.22)',
        background: 'linear-gradient(180deg, rgba(2,6,23,0.96), rgba(15,23,42,0.96))',
        boxShadow: isActive
          ? '0 0 0 1px rgba(14, 165, 233, 0.45), 0 16px 28px rgba(2,6,23,0.46)'
          : '0 8px 20px rgba(2,6,23,0.35)',
        transition: 'transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: 'rgba(14, 165, 233, 0.75)',
          boxShadow: '0 14px 24px rgba(2,6,23,0.42)',
        },
      }}
    >
      {/* Frame Image/Sketch Area */}
      <Box
        sx={{
          position: 'relative',
          paddingTop: isThumbnailMode ? '62%' : '56.25%',
          bgcolor: 'rgba(15,23,42,0.7)',
          borderBottom: 1,
          borderColor: 'divider',
          cursor: showDrawButton ? 'pointer' : 'default',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
          if (showDrawButton && !hasPreviewImage) {
            onDrawClick?.();
          }
        }}
      >
        {hasPreviewImage ? (
          <CardMedia
            component="img"
            image={previewImageUrl || ''}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(2,6,23,0.55)',
            }}
          >
            <Stack spacing={1} alignItems="center">
              {showDrawButton ? (
                <>
                  <BrushIcon sx={{ fontSize: 48, color: 'rgba(56, 189, 248, 0.95)' }} />
                  <Typography variant="caption" color="rgba(226,232,240,0.88)">
                    {drawPrompt || 'Trykk for å tegne med Apple Pencil'}
                  </Typography>
                </>
              ) : (
                <>
                  <ImageIcon sx={{ fontSize: 48, color: 'rgba(148,163,184,0.9)' }} />
                  <Typography variant="caption" color="rgba(148,163,184,0.95)">
                    Klikk for å legge til skisse
                  </Typography>
                </>
              )}
            </Stack>
          </Box>
        )}

        {/* Shot Number Overlay */}
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            maxWidth: 'calc(100% - 92px)',
            flexWrap: 'wrap',
          }}
        >
          <Chip
            label={`Shot ${frame.shotNumber}`}
            size="small"
            sx={{
              bgcolor: 'rgba(0,0,0,0.7)',
              color: 'white',
            }}
          />
          <Chip
            label={detailMeta.shortLabel}
            size="small"
            sx={{
              bgcolor: 'rgba(15,23,42,0.78)',
              color: 'rgba(226,232,240,0.95)',
            }}
          />
          {frame.variantLabel && (
            <Chip
              label={frame.variantLabel}
              size="small"
              sx={{
                bgcolor: 'rgba(139,92,246,0.9)',
                color: 'white',
              }}
            />
          )}
        </Stack>

        {/* Image Source Badge */}
        {frame.imageSource === 'drawn' && (
          <Chip
            icon={<BrushIcon sx={{ fontSize: 12 }} />}
            label="Tegnet"
            size="small"
            sx={{
              position: 'absolute',
              top: hasPreviewImage ? 48 : 42,
              right: 8,
              bgcolor: 'rgba(139,92,246,0.9)',
              color: 'white',
              '& .MuiChip-icon': { color: 'white' },
            }}
          />
        )}

        {/* Quick View Button */}
        {hasPreviewImage && (
          <Tooltip title="Hurtigvisning">
            <IconButton
              size="small"
              aria-label="Hurtigvisning"
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.();
                onQuickViewClick?.();
              }}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'rgba(2,6,23,0.82)',
                color: 'rgba(226,232,240,0.95)',
                border: '1px solid rgba(148,163,184,0.38)',
                '&:hover': {
                  bgcolor: 'rgba(15,23,42,0.95)',
                  borderColor: 'rgba(56,189,248,0.75)',
                },
              }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Draw/Edit Button */}
        {showDrawButton && hasPreviewImage && (
          <Tooltip title="Rediger tegning">
            <IconButton
              size="small"
              aria-label="Rediger tegning"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.();
                onDrawClick?.();
              }}
              sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                bgcolor: 'rgba(139,92,246,0.9)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(139,92,246,1)' },
              }}
            >
              <BrushIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Camera & Light Indicators */}
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
          }}
        >
          <IconButton
            size="small"
            aria-label="Kamerainnstillinger"
            sx={{
              bgcolor: 'rgba(15,23,42,0.92)',
              color: 'rgba(125,211,252,0.98)',
              border: '1px solid rgba(56,189,248,0.65)',
              boxShadow: '0 4px 12px rgba(2,6,23,0.55)',
              backdropFilter: 'blur(4px)',
              transition: 'all 140ms ease',
              '&:hover': {
                bgcolor: 'rgba(30,41,59,0.95)',
                borderColor: 'rgba(56,189,248,0.95)',
                transform: 'translateY(-1px)',
              },
            }}
            onClick={(event) => {
              event.stopPropagation();
              onCameraClick?.();
            }}
          >
            <CameraIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Lysinnstillinger"
            sx={{
              bgcolor: 'rgba(15,23,42,0.92)',
              color: 'rgba(253,230,138,0.98)',
              border: '1px solid rgba(251,191,36,0.68)',
              boxShadow: '0 4px 12px rgba(2,6,23,0.55)',
              backdropFilter: 'blur(4px)',
              transition: 'all 140ms ease',
              '&:hover': {
                bgcolor: 'rgba(30,41,59,0.95)',
                borderColor: 'rgba(251,191,36,0.95)',
                transform: 'translateY(-1px)',
              },
            }}
            onClick={(event) => {
              event.stopPropagation();
              onLightClick?.();
            }}
          >
            <LightIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: isThumbnailMode ? 1.25 : 2 }}>
        <Stack spacing={1}>
          <Typography
            variant={isThumbnailMode ? 'caption' : 'body2'}
            fontWeight="medium"
            color="rgba(248,250,252,0.95)"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: isThumbnailMode ? 2 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {frame.description}
          </Typography>

          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Chip label={frame.cameraAngle} size="small" sx={{ bgcolor: 'rgba(56,189,248,0.18)', color: 'rgba(224,242,254,0.95)' }} />
            <Chip label={frame.movement} size="small" sx={{ bgcolor: 'rgba(14,165,233,0.16)', color: 'rgba(224,242,254,0.95)' }} />
            <Chip label={`${frame.duration}s`} size="small" sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: 'rgba(254,243,199,0.95)' }} />
            {frame.screenDirection && (
              <Chip
                label={getScreenDirectionLabel(frame.screenDirection)}
                size="small"
                sx={{ bgcolor: 'rgba(16,185,129,0.16)', color: 'rgba(209,250,229,0.98)' }}
              />
            )}
            {assistCount > 0 && (
              <Chip
                label={`${assistCount} guider`}
                size="small"
                variant="outlined"
                sx={{ color: 'rgba(226,232,240,0.9)', borderColor: 'rgba(148,163,184,0.35)' }}
              />
            )}
          </Stack>

          {supportText && (
            <Typography variant="caption" color="rgba(148,163,184,0.95)">
              {supportText}
            </Typography>
          )}

          <Divider sx={{ borderColor: 'rgba(148,163,184,0.22)' }} />

          <Stack direction="row" spacing={0.5} mt={1} sx={{ mt: 'auto', flexWrap: 'wrap' }} useFlexGap>
            <Tooltip title="Lagre i storyboard-bibliotek">
              <IconButton
                size="small"
                color="secondary"
                aria-label="Lagre i storyboard-bibliotek"
                onClick={(event) => {
                  event.stopPropagation();
                  onSaveToLibraryClick?.();
                }}
              >
                <CollectionsBookmarkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Dupliser panel">
              <IconButton
                size="small"
                color="primary"
                aria-label="Dupliser panel"
                onClick={(event) => {
                  event.stopPropagation();
                  onDuplicateClick?.();
                }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Lag 3 varianter">
              <IconButton
                size="small"
                color="primary"
                aria-label="Lag 3 varianter"
                onClick={(event) => {
                  event.stopPropagation();
                  onCreateVariantsClick?.();
                }}
              >
                <AutoAwesomeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              color="primary"
              data-testid={isActive ? 'scene-storyboard-active-edit-button' : `scene-storyboard-edit-button-${frame.id}`}
              onClick={(event) => {
                event.stopPropagation();
                onEditClick?.();
              }}
              aria-label="Rediger storyboard-frame"
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={(event) => {
              event.stopPropagation();
              onDeleteClick?.();
            }} aria-label="Slett storyboard-frame">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

const ShotListView: React.FC<{
  frames: StoryboardFrame[];
  onUpdate: (frames: StoryboardFrame[]) => void;
}> = ({ frames, onUpdate }) => {
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<StoryboardFrame | null>(null);

  const beginEdit = (frame: StoryboardFrame) => {
    setEditingFrameId(frame.id);
    setEditDraft({ ...frame });
  };

  const cancelEdit = () => {
    setEditingFrameId(null);
    setEditDraft(null);
  };

  const commitEdit = () => {
    if (!editingFrameId || !editDraft) return;
    onUpdate(
      frames.map((frame) =>
        frame.id === editingFrameId
          ? {
              ...frame,
              shotNumber: editDraft.shotNumber.trim() || frame.shotNumber,
              description: editDraft.description.trim() || frame.description,
              cameraAngle: editDraft.cameraAngle.trim() || frame.cameraAngle,
              movement: editDraft.movement.trim() || frame.movement,
              duration: Math.max(1, Number(editDraft.duration) || frame.duration),
              notes: editDraft.notes?.trim() || undefined,
            }
          : frame
      )
    );
    cancelEdit();
  };

  return (
    <Paper>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Shot #</TableCell>
            <TableCell>Beskrivelse</TableCell>
            <TableCell>Kamera</TableCell>
            <TableCell>Bevegelse</TableCell>
            <TableCell>Varighet</TableCell>
            <TableCell>Notater</TableCell>
            <TableCell>Handlinger</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {frames.map((frame) => (
            <TableRow key={frame.id} hover>
              <TableCell>
                {editingFrameId === frame.id ? (
                  <TextField
                    size="small"
                    value={editDraft?.shotNumber || ''}
                    onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, shotNumber: event.target.value } : prev))}
                  />
                ) : (
                  <Chip label={frame.shotNumber} size="small" />
                )}
              </TableCell>
              <TableCell>
                {editingFrameId === frame.id ? (
                  <TextField
                    size="small"
                    fullWidth
                    value={editDraft?.description || ''}
                    onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
                  />
                ) : (
                  frame.description
                )}
              </TableCell>
              <TableCell>
                {editingFrameId === frame.id ? (
                  <TextField
                    size="small"
                    value={editDraft?.cameraAngle || ''}
                    onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, cameraAngle: event.target.value } : prev))}
                  />
                ) : (
                  frame.cameraAngle
                )}
              </TableCell>
              <TableCell>
                {editingFrameId === frame.id ? (
                  <TextField
                    size="small"
                    value={editDraft?.movement || ''}
                    onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, movement: event.target.value } : prev))}
                  />
                ) : (
                  frame.movement
                )}
              </TableCell>
              <TableCell>
                {editingFrameId === frame.id ? (
                  <TextField
                    type="number"
                    size="small"
                    inputProps={{ min: 1 }}
                    value={editDraft?.duration ?? frame.duration}
                    onChange={(event) =>
                      setEditDraft((prev) => {
                        if (!prev) return prev;
                        const parsed = Number(event.target.value);
                        return { ...prev, duration: Number.isFinite(parsed) && parsed > 0 ? parsed : 1 };
                      })
                    }
                  />
                ) : (
                  `${frame.duration}s`
                )}
              </TableCell>
              <TableCell>
                {editingFrameId === frame.id ? (
                  <TextField
                    size="small"
                    fullWidth
                    value={editDraft?.notes || ''}
                    onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, notes: event.target.value } : prev))}
                  />
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {frame.notes || '-'}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1}>
                  {editingFrameId === frame.id ? (
                    <>
                      <IconButton size="small" color="primary" onClick={commitEdit} aria-label="Lagre endringer">
                        <SaveIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="inherit" onClick={cancelEdit} aria-label="Avbryt redigering">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <IconButton size="small" color="primary" onClick={() => beginEdit(frame)} aria-label="Rediger frame">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onUpdate(frames.filter((item) => item.id !== frame.id))}
                        aria-label="Slett frame"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box sx={{ p: 2 }}>
        <Button
          startIcon={<AddIcon />}
          variant="outlined"
          fullWidth
          onClick={() => {
            const now = new Date().toISOString();
            const newFrame: StoryboardFrame = {
              id: createFrameId(),
              shotNumber: getNextShotNumber(frames),
              description: 'Ny shot',
              cameraAngle: 'Medium',
              movement: 'Static',
              duration: 2,
              createdAt: now,
              updatedAt: now,
            };
            onUpdate([...frames, newFrame]);
          }}
        >
          Legg til Shot
        </Button>
      </Box>
    </Paper>
  );
};

export default StoryboardIntegrationView;
