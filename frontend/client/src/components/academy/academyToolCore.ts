import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type ToolAutoSaveState = 'saved' | 'saving' | 'dirty';

export type ToolVersionEntry<T> = {
  id: string;
  label: string;
  createdAt: string;
  items: T[];
};

const cloneItems = <T,>(items: T[]): T[] => {
  try {
    return JSON.parse(JSON.stringify(items)) as T[];
  } catch {
    return [...items];
  }
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (target.isContentEditable) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.closest('[contenteditable="true"], [role="textbox"], [role="combobox"]'));
};

export const syncCourseIdInLocation = (
  location: string,
  setLocation: (value: string) => void,
  nextCourseId: string,
): void => {
  const normalizedCourseId = String(nextCourseId || '').trim();
  const [pathname, rawQuery = ''] = String(location || '').split('?');
  const params = new URLSearchParams(rawQuery);

  if (normalizedCourseId) {
    params.set('courseId', normalizedCourseId);
  } else {
    params.delete('courseId');
  }
  params.delete('course_id');

  const suffix = params.toString();
  const target = suffix ? `${pathname}?${suffix}` : pathname;
  if (target !== location) {
    setLocation(target);
  }
};

export const useToolAutoSaveState = () => {
  const [autoSaveState, setAutoSaveState] = useState<ToolAutoSaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string>(new Date().toISOString());

  const markDirty = useCallback(() => {
    setAutoSaveState((prev) => (prev === 'dirty' ? prev : 'dirty'));
  }, []);

  const markSaving = useCallback(() => {
    setAutoSaveState('saving');
  }, []);

  const markSaved = useCallback(() => {
    setAutoSaveState('saved');
    setLastSavedAt(new Date().toISOString());
  }, []);

  return {
    autoSaveState,
    lastSavedAt,
    markDirty,
    markSaving,
    markSaved,
  };
};

type ToolUxPreferencesPayload = {
  simpleMode: boolean;
  onboardingDismissed: boolean;
  workflowIntent: AcademyWorkflowIntentId;
  profileSeed?: string;
};

const TOOL_UX_PREFS_VERSION = 1;
const ACADEMY_USER_SETTINGS_STORAGE_KEY = 'academy_user_settings_v1';
const ACADEMY_ACTIVE_INTENT_STORAGE_KEY = 'academy_workflow_active_intent_v1';

type AcademyWorkflowProfileMode = 'simple' | 'pro';
export type AcademyWorkflowStepId = 'plan' | 'create' | 'refine' | 'quality' | 'publish';
export type AcademyWorkflowIntentId =
  | 'quick-publish'
  | 'interactive-lesson'
  | 'quality-first'
  | 'story-led';

export const ACADEMY_WORKFLOW_STEPS: Array<{
  id: AcademyWorkflowStepId;
  labelNo: string;
  labelEn: string;
}> = [
  { id: 'plan', labelNo: 'Planlegg', labelEn: 'Plan' },
  { id: 'create', labelNo: 'Lag', labelEn: 'Create' },
  { id: 'refine', labelNo: 'Finjuster', labelEn: 'Refine' },
  { id: 'quality', labelNo: 'Kvalitet', labelEn: 'Quality' },
  { id: 'publish', labelNo: 'Publiser', labelEn: 'Publish' },
];

export const ACADEMY_WORKFLOW_INTENTS: Array<{
  id: AcademyWorkflowIntentId;
  labelNo: string;
  labelEn: string;
  descriptionNo: string;
  descriptionEn: string;
}> = [
  {
    id: 'quick-publish',
    labelNo: 'Rask publisering',
    labelEn: 'Quick publish',
    descriptionNo: 'Enkel modus, færre avbrudd, fokus på rask levering.',
    descriptionEn: 'Simple mode, fewer interruptions, focus on fast delivery.',
  },
  {
    id: 'interactive-lesson',
    labelNo: 'Interaktiv leksjon',
    labelEn: 'Interactive lesson',
    descriptionNo: 'Mer redigering og bedre elevengasjement gjennom verktøyene.',
    descriptionEn: 'More editing and stronger learner engagement across tools.',
  },
  {
    id: 'quality-first',
    labelNo: 'Kvalitet først',
    labelEn: 'Quality first',
    descriptionNo: 'Setter opp flyt for kvalitetssjekk og trygg publisering.',
    descriptionEn: 'Sets the flow up for quality checks and safer publishing.',
  },
  {
    id: 'story-led',
    labelNo: 'Historiedrevet',
    labelEn: 'Story-led',
    descriptionNo: 'Mer kreativ kontroll for narrativ og visuell gjennomføring.',
    descriptionEn: 'More creative control for narrative and visual execution.',
  },
];

const sanitizeWorkflowIntentId = (value: string): AcademyWorkflowIntentId => {
  if (value === 'quick-publish') return value;
  if (value === 'interactive-lesson') return value;
  if (value === 'quality-first') return value;
  if (value === 'story-led') return value;
  return 'interactive-lesson';
};

const readActiveWorkflowIntent = (fallbackIntent: AcademyWorkflowIntentId): AcademyWorkflowIntentId => {
  if (typeof window === 'undefined') return fallbackIntent;
  try {
    const raw = window.localStorage.getItem(ACADEMY_ACTIVE_INTENT_STORAGE_KEY);
    if (!raw) return fallbackIntent;
    return sanitizeWorkflowIntentId(String(raw));
  } catch {
    return fallbackIntent;
  }
};

const writeActiveWorkflowIntent = (intent: AcademyWorkflowIntentId): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACADEMY_ACTIVE_INTENT_STORAGE_KEY, intent);
  } catch {
    // Ignore storage write failures.
  }
};

type AcademyWorkflowProfilePrefs = {
  preferredMode: AcademyWorkflowProfileMode;
  showQuickStart: boolean;
  showNextAction: boolean;
  microHintsEnabled: boolean;
  defaultIntent: AcademyWorkflowIntentId;
  seed: string;
};

const readAcademyWorkflowProfilePrefs = (): AcademyWorkflowProfilePrefs => {
  const fallback: AcademyWorkflowProfilePrefs = {
    preferredMode: 'simple',
    showQuickStart: true,
    showNextAction: true,
    microHintsEnabled: true,
    defaultIntent: 'interactive-lesson',
    seed: 'simple|1|1|interactive-lesson',
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(ACADEMY_USER_SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<{
      academyPreferredMode: AcademyWorkflowProfileMode;
      academyShowQuickStart: boolean;
      academyShowNextAction: boolean;
      academyMicroHintsEnabled: boolean;
      academyDefaultIntent: AcademyWorkflowIntentId;
    }>;
    const preferredMode: AcademyWorkflowProfileMode =
      parsed.academyPreferredMode === 'pro' ? 'pro' : 'simple';
    const showQuickStart = parsed.academyShowQuickStart !== false;
    const showNextAction = parsed.academyShowNextAction !== false;
    const microHintsEnabled = parsed.academyMicroHintsEnabled !== false;
    const defaultIntent = sanitizeWorkflowIntentId(String(parsed.academyDefaultIntent || ''));
    const seed = `${preferredMode}|${showQuickStart ? '1' : '0'}|${showNextAction ? '1' : '0'}|${defaultIntent}`;
    return {
      preferredMode,
      showQuickStart,
      showNextAction,
      microHintsEnabled,
      defaultIntent,
      seed,
    };
  } catch {
    return fallback;
  }
};

const buildToolUxPrefsKey = (toolId: string): string =>
  `academy_tool_ux_${String(toolId || 'default').trim().toLowerCase()}_v${TOOL_UX_PREFS_VERSION}`;

const readToolUxPrefs = (toolId: string): ToolUxPreferencesPayload => {
  const workflowPrefs = readAcademyWorkflowProfilePrefs();
  const sharedIntent = readActiveWorkflowIntent(workflowPrefs.defaultIntent);
  const defaults: ToolUxPreferencesPayload = {
    simpleMode: workflowPrefs.preferredMode !== 'pro',
    onboardingDismissed: !workflowPrefs.showQuickStart,
    workflowIntent: sharedIntent,
    profileSeed: workflowPrefs.seed,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(buildToolUxPrefsKey(toolId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ToolUxPreferencesPayload>;
    if (String(parsed.profileSeed || '') !== workflowPrefs.seed) {
      return defaults;
    }
    return {
      simpleMode: typeof parsed.simpleMode === 'boolean' ? parsed.simpleMode : defaults.simpleMode,
      onboardingDismissed:
        typeof parsed.onboardingDismissed === 'boolean'
          ? parsed.onboardingDismissed
          : defaults.onboardingDismissed,
      workflowIntent: sanitizeWorkflowIntentId(
        String(parsed.workflowIntent || sharedIntent || defaults.workflowIntent),
      ),
      profileSeed: workflowPrefs.seed,
    };
  } catch {
    return defaults;
  }
};

const writeToolUxPrefs = (toolId: string, payload: ToolUxPreferencesPayload): void => {
  if (typeof window === 'undefined') return;
  try {
    const workflowPrefs = readAcademyWorkflowProfilePrefs();
    window.localStorage.setItem(
      buildToolUxPrefsKey(toolId),
      JSON.stringify({
        ...payload,
        profileSeed: workflowPrefs.seed,
      }),
    );
    writeActiveWorkflowIntent(sanitizeWorkflowIntentId(String(payload.workflowIntent)));
  } catch {
    // Ignore local storage write failures.
  }
};

export const useAcademyToolUx = (toolId: string) => {
  const workflowPrefs = useMemo(() => readAcademyWorkflowProfilePrefs(), [toolId]);
  const initialPrefs = useMemo(() => readToolUxPrefs(toolId), [toolId]);
  const [simpleMode, setSimpleMode] = useState<boolean>(initialPrefs.simpleMode);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(
    initialPrefs.onboardingDismissed,
  );
  const [workflowIntent, setWorkflowIntent] = useState<AcademyWorkflowIntentId>(
    sanitizeWorkflowIntentId(String(initialPrefs.workflowIntent || workflowPrefs.defaultIntent)),
  );
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    initialPrefs.onboardingDismissed !== true,
  );

  useEffect(() => {
    writeToolUxPrefs(toolId, {
      simpleMode,
      onboardingDismissed,
      workflowIntent,
    });
  }, [onboardingDismissed, simpleMode, toolId, workflowIntent]);

  const toggleSimpleMode = useCallback(() => {
    setSimpleMode((previous) => {
      const next = !previous;
      if (next) setAdvancedOpen(false);
      return next;
    });
  }, []);

  const toggleAdvancedOpen = useCallback(() => {
    setAdvancedOpen((previous) => !previous);
  }, []);

  const openOnboarding = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setOnboardingDismissed(true);
  }, []);

  return {
    simpleMode,
    setSimpleMode,
    toggleSimpleMode,
    advancedOpen,
    setAdvancedOpen,
    toggleAdvancedOpen,
    showOnboarding,
    openOnboarding,
    dismissOnboarding,
    shouldShowAdvanced: !simpleMode || advancedOpen,
    showNextAction: workflowPrefs.showNextAction,
    microHintsEnabled: workflowPrefs.microHintsEnabled,
    workflowIntent,
    setWorkflowIntent,
    workflowPreferredMode: workflowPrefs.preferredMode,
  };
};

export const formatToolSavedTime = (isoString: string, locale: string): string => {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return '--:--';
  try {
    return new Intl.DateTimeFormat(locale || 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  } catch {
    return parsed.toLocaleTimeString();
  }
};

export const hasSavedDraftNewerThanPublished = (
  updatedAt?: string | null,
  publishedAt?: string | null,
): boolean => {
  const publishedMs = Date.parse(String(publishedAt || ''));
  if (!Number.isFinite(publishedMs) || publishedMs <= 0) return false;
  const updatedMs = Date.parse(String(updatedAt || ''));
  return Number.isFinite(updatedMs) && updatedMs > publishedMs;
};

type UseToolHistoryOptions<T> = {
  items: T[];
  setItems: (items: T[]) => void;
  maxStack?: number;
  maxVersions?: number;
  coalesceMs?: number;
};

export const useToolHistory = <T,>({
  items,
  setItems,
  maxStack = 80,
  maxVersions = 24,
  coalesceMs = 700,
}: UseToolHistoryOptions<T>) => {
  const undoStackRef = useRef<T[][]>([]);
  const redoStackRef = useRef<T[][]>([]);
  const lastSnapshotAtRef = useRef<number>(0);
  const lastSnapshotLabelRef = useRef<string>('');
  const [versions, setVersions] = useState<Array<ToolVersionEntry<T>>>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');

  const normalizedItems = useMemo(() => cloneItems(items), [items]);

  const addVersion = useCallback(
    (label: string, snapshot: T[]) => {
      const versionId = `tool-version-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const cloned = cloneItems(snapshot);
      setVersions((prev) => {
        const next: ToolVersionEntry<T> = {
          id: versionId,
          label,
          createdAt: new Date().toISOString(),
          items: cloned,
        };
        return [next, ...prev].slice(0, maxVersions);
      });
      setSelectedVersionId(versionId);
    },
    [maxVersions],
  );

  const snapshotBeforeChange = useCallback(
    (label: string, options?: { force?: boolean }) => {
      const now = Date.now();
      const shouldCoalesce =
        !options?.force &&
        lastSnapshotLabelRef.current === label &&
        now - lastSnapshotAtRef.current <= coalesceMs;
      if (shouldCoalesce) return;

      const snapshot = cloneItems(normalizedItems);
      undoStackRef.current = [...undoStackRef.current, snapshot].slice(-maxStack);
      redoStackRef.current = [];
      addVersion(label, snapshot);
      lastSnapshotAtRef.current = now;
      lastSnapshotLabelRef.current = label;
    },
    [addVersion, coalesceMs, maxStack, normalizedItems],
  );

  const replaceWithoutHistory = useCallback(
    (nextItems: T[]) => {
      setItems(cloneItems(nextItems));
    },
    [setItems],
  );

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    const current = cloneItems(normalizedItems);
    redoStackRef.current = [...redoStackRef.current, current].slice(-maxStack);
    setItems(cloneItems(previous));
  }, [maxStack, normalizedItems, setItems]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    const current = cloneItems(normalizedItems);
    undoStackRef.current = [...undoStackRef.current, current].slice(-maxStack);
    setItems(cloneItems(next));
  }, [maxStack, normalizedItems, setItems]);

  const restoreVersion = useCallback(
    (versionId: string) => {
      const target = versions.find((version) => version.id === versionId);
      if (!target) return;
      snapshotBeforeChange('restore-version', { force: true });
      setItems(cloneItems(target.items));
      setSelectedVersionId(target.id);
    },
    [setItems, snapshotBeforeChange, versions],
  );

  const bindUndoRedoShortcuts = useCallback(
    (options?: { enabled?: boolean }) => {
      if (options?.enabled === false) return () => undefined;

      const handleKeyDown = (event: KeyboardEvent): void => {
        if (isEditableTarget(event.target)) return;
        const commandKey = event.metaKey || event.ctrlKey;
        if (!commandKey || event.altKey) return;

        const lowerKey = event.key.toLowerCase();
        if (lowerKey === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }

        if (lowerKey === 'y') {
          event.preventDefault();
          redo();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    },
    [redo, undo],
  );

  return {
    versions,
    selectedVersionId,
    setSelectedVersionId,
    snapshotBeforeChange,
    addVersion,
    replaceWithoutHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    restoreVersion,
    bindUndoRedoShortcuts,
  };
};

export const useToolUndoRedoShortcuts = (
  bindUndoRedoShortcuts: (options?: { enabled?: boolean }) => () => void,
  enabled = true,
) => {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    return bindUndoRedoShortcuts({ enabled });
  }, [bindUndoRedoShortcuts, enabled]);
};
