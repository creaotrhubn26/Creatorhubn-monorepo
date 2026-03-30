/**
 * Visual Editor Context Provider
 * Unified data context for all visual editor components to communicate
 */

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { useDynamicProfessions, type DynamicProfessionConfig } from '../../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs, type ProfessionConfig as ApiProfessionConfig } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useTheming } from '@/utils/theming-helper';
import {
  applyResponsiveUpdates,
  EDITOR_DEVICE_PROFILES,
  type EditorBreakpoint,
  type EditorDeviceOrientation,
  type EditorResponsiveOverride,
  getElementDisplayName,
  normalizeEditorElement,
  resolveElementForBreakpoint,
  resolveRenderableElements,
  synchronizeElementChildren,
} from './visualEditorModel';

const DEFAULT_DESKTOP_VIEWPORT = EDITOR_DEVICE_PROFILES.desktop.viewport;

// Types for the visual editor context
export interface EditorElement {
  id: string;
  type: 'button' | 'text' | 'image' | 'card' | 'container' | 'grid' | 'audio' | 'video';
  x: number;
  y: number;
  width: number;
  height: number;
  styles: {
    backgroundColor?: string;
    color?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
    fontSize?: string;
    fontWeight?: string;
    lineHeight?: string;
    transform?: string;
    textShadow?: string;
    opacity?: number;
    boxShadow?: string;
    border?: string;
    display?: string;
    flexDirection?: string;
    justifyContent?: string;
    alignItems?: string;
    gap?: string;
    gridTemplateColumns?: string;
    fontFamily?: string;
    fontStyle?: string;
    textStroke?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
  };
  props: Record<string, unknown>;
  children?: string[];
  parent?: string;
  icon?: string;
  name?: string;
  className?: string;
  visible?: boolean;
  locked?: boolean;
  responsive?: Partial<Record<'tablet' | 'mobile', EditorResponsiveOverride>>;
}

export interface EditorStyleClass {
  name: string;
  styles: EditorElement['styles'];
  responsive?: Partial<Record<'tablet' | 'mobile', Partial<EditorElement['styles']>>>;
}

export type EditorStyleClassMap = Record<string, EditorStyleClass>;

export type EditorDesignTokenType =
  | 'color'
  | 'spacing'
  | 'radius'
  | 'shadow'
  | 'typography'
  | 'size'
  | 'border'
  | 'custom';

export interface EditorDesignToken {
  name: string;
  value: string;
  type: EditorDesignTokenType;
  description?: string;
}

export type EditorDesignTokenMap = Record<string, EditorDesignToken>;

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'project' | 'workflow' | 'dashboard' | 'ui' | 'showcase';
  elements: EditorElement[];
  styleClasses?: EditorStyleClassMap;
  designTokens?: EditorDesignTokenMap;
  metadata: {
    createdBy: string;
    createdAt: Date;
    downloads: number;
    rating: number;
    featured: boolean;
};
  tags: string[];
  preview?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  elements: EditorElement[];
  styleClasses?: EditorStyleClassMap;
  designTokens?: EditorDesignTokenMap;
  settings: {
    width: number;
    height: number;
    backgroundColor: string;
    gridSize: number;
    snapToGrid: boolean;
};
  metadata: {
    createdBy: string;
    createdAt: Date;
    lastModified: Date;
    version: number;
};
  collaborators?: string[];
  status: 'draft' | 'review' | 'published' | 'archived';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar?: string;
  permissions: string[];
}

export interface CollaborationSession {
  id: string;
  projectId: string;
  users: User[];
  activeUsers: string[];
  cursors: Record<string, { x: number; y: number; color: string }>;
  selections: Record<string, string[]>;
  lastActivity: Date;
}

export interface AnalyticsData {
  projectId: string;
  views: number;
  interactions: number;
  timeSpent: number;
  userActions: Array<{
    action: string;
    timestamp: Date;
    userId: string;
    elementId?: string;
}>;
  performance: {
    loadTime: number;
    renderTime: number;
    memoryUsage: number;
};
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    callback: () => void;
};
}

export interface HistoryEntry {
  id: string;
  action: string;
  description: string;
  timestamp: string;
}

// State interface
export interface VisualEditorState {
  // Core editor state
  selectedElement: string | null;
  selectedElements: string[];
  elements: EditorElement[];
  styleClasses: EditorStyleClassMap;
  designTokens: EditorDesignTokenMap;
  clipboard: EditorElement[];
  history: EditorElement[][];
  historyIndex: number;
  
  // Project state
  currentProject: Project | null;
  projects: Project[];
  templates: Template[];
  
  // UI state
  activeTab: string;
  sidebarOpen: boolean;
  propertiesOpen: boolean;
  gridVisible: boolean;
  snapToGrid: boolean;
  zoom: number;
  pan: { x: number; y: number };
  currentBreakpoint: EditorBreakpoint;
  currentOrientation: EditorDeviceOrientation;
  breakpointOrientations: Record<Exclude<EditorBreakpoint, 'desktop'>, EditorDeviceOrientation>;
  
  // Collaboration state
  collaborationSession: CollaborationSession | null;
  onlineUsers: User[];
  cursors: Record<string, { x: number; y: number; color: string }>;
  
  // Analytics state
  analytics: AnalyticsData | null;
  performanceMetrics: {
    fps: number;
    memoryUsage: number;
    renderTime: number;
};
  
  // Notifications
  notifications: Notification[];
  
  // History entries (descriptive log)
  historyEntries: HistoryEntry[];
  
  // Settings
  settings: {
    autoSave: boolean;
    autoSaveInterval: number;
    theme: 'light' | 'dark';
    language: string;
    shortcuts: Record<string, string>;
};
  
  // Loading states
  loading: {
    project: boolean;
    templates: boolean;
    collaboration: boolean;
    analytics: boolean;
};
  
  // Error states
  errors: {
    project: string | null;
    templates: string | null;
    collaboration: string | null;
    analytics: string | null;
};
}

// Action types
export type VisualEditorAction =
  | { type: 'SET_SELECTED_ELEMENT'; payload: string | null }
  | { type: 'SET_SELECTED_ELEMENTS'; payload: string[] }
  | { type: 'ADD_ELEMENT'; payload: EditorElement }
  | { type: 'UPDATE_ELEMENT'; payload: { id: string; updates: Partial<EditorElement> } }
  | { type: 'SET_STYLE_CLASSES'; payload: EditorStyleClassMap }
  | { type: 'UPSERT_STYLE_CLASS'; payload: EditorStyleClass }
  | { type: 'DELETE_STYLE_CLASS'; payload: string }
  | { type: 'SET_DESIGN_TOKENS'; payload: EditorDesignTokenMap }
  | { type: 'UPSERT_DESIGN_TOKEN'; payload: EditorDesignToken }
  | { type: 'DELETE_DESIGN_TOKEN'; payload: string }
  | { type: 'DELETE_ELEMENT'; payload: string }
  | { type: 'DUPLICATE_ELEMENT'; payload: string }
  | { type: 'COPY_ELEMENTS'; payload: string[] }
  | { type: 'PASTE_ELEMENTS'; payload: { x: number; y: number } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_CURRENT_PROJECT'; payload: Project | null }
  | { type: 'UPDATE_PROJECT'; payload: Partial<Project> }
  | { type: 'SET_TEMPLATES'; payload: Template[] }
  | { type: 'ADD_TEMPLATE'; payload: Template }
  | { type: 'UPDATE_TEMPLATE'; payload: { id: string; updates: Partial<Template> } }
  | { type: 'DELETE_TEMPLATE'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_SIDEBAR_OPEN'; payload: boolean }
  | { type: 'SET_PROPERTIES_OPEN'; payload: boolean }
  | { type: 'SET_GRID_VISIBLE'; payload: boolean }
  | { type: 'SET_SNAP_TO_GRID'; payload: boolean }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_PAN'; payload: { x: number; y: number } }
  | { type: 'SET_CURRENT_BREAKPOINT'; payload: EditorBreakpoint }
  | { type: 'SET_CURRENT_ORIENTATION'; payload: EditorDeviceOrientation }
  | { type: 'SET_ELEMENTS'; payload: EditorElement[] }
  | { type: 'SET_COLLABORATION_SESSION'; payload: CollaborationSession | null }
  | { type: 'UPDATE_CURSORS'; payload: Record<string, { x: number; y: number; color: string }> }
  | { type: 'SET_ONLINE_USERS'; payload: User[] }
  | { type: 'SET_ANALYTICS'; payload: AnalyticsData | null }
  | { type: 'UPDATE_PERFORMANCE_METRICS'; payload: Partial<VisualEditorState['performanceMetrics']> }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<VisualEditorState['settings']> }
  | { type: 'SET_LOADING'; payload: { key: keyof VisualEditorState['loading']; value: boolean } }
  | { type: 'SET_ERROR'; payload: { key: keyof VisualEditorState['errors']; value: string | null } }
  | { type: 'ADD_HISTORY_ENTRY'; payload: { action: string; description: string; timestamp: string } }
  | { type: 'UPDATE_COLLABORATIVE_CURSORS'; payload: { userId: string; userName: string; userColor: string; x: number; y: number; timestamp: string } }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: VisualEditorState = {
  selectedElement: null,
  selectedElements:  [],
  elements:  [],
  styleClasses: {},
  designTokens: {},
  clipboard:  [],
  history: [[]],
  historyIndex:  0,
  currentProject: null,
  projects:  [],
  templates:  [],
  activeTab: 'elements',
  sidebarOpen: true,
  propertiesOpen: true,
  gridVisible: true,
  snapToGrid: true,
  zoom: 1,
  pan: { x: 0, y: 0 },
  currentBreakpoint: 'desktop',
  currentOrientation: 'portrait',
  breakpointOrientations: {
    tablet: 'portrait',
    mobile: 'portrait',
  },
  collaborationSession: null,
  onlineUsers: [],
  cursors: {},
  analytics: null,
  performanceMetrics: {
    fps: 60,
    memoryUsage: 0,
    renderTime: 0
  },
  notifications: [],
  historyEntries: [],
  settings: {
    autoSave: true,
    autoSaveInterval: 30000,
    theme: 'light',
    language: 'en',
    shortcuts: {}
  },
  loading: {
    project: false,
    templates: false,
    collaboration: false,
    analytics: false
  },
  errors: {
    project: null,
    templates: null,
    collaboration: null,
    analytics: null
}
};

const VISUAL_EDITOR_PROJECT_STORAGE_PREFIX = 'visual-editor:project:';
const VISUAL_EDITOR_PUBLISHED_STORAGE_PREFIX = 'visual-editor:published:';
const VISUAL_EDITOR_REVISIONS_STORAGE_PREFIX = 'visual-editor:revisions:';
const VISUAL_EDITOR_TEMPLATES_STORAGE_KEY = 'visual-editor:templates';

const canUseLocalStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isProjectStatus = (value: unknown): value is Project['status'] =>
  value === 'draft' || value === 'review' || value === 'published' || value === 'archived';

const isTemplateCategory = (value: unknown): value is Template['category'] =>
  value === 'project'
  || value === 'workflow'
  || value === 'dashboard'
  || value === 'ui'
  || value === 'showcase';

const parseDate = (value: unknown, fallback: Date): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
};

const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const normalizeClassNameList = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(' ');

  return normalized || undefined;
};

const normalizeStyleClass = (value: EditorStyleClass): EditorStyleClass => ({
  name: value.name.trim(),
  styles: { ...value.styles },
  responsive: value.responsive
    ? {
        tablet: value.responsive.tablet ? { ...value.responsive.tablet } : undefined,
        mobile: value.responsive.mobile ? { ...value.responsive.mobile } : undefined,
      }
    : undefined,
});

const normalizeDesignToken = (value: EditorDesignToken): EditorDesignToken => ({
  name: value.name.trim(),
  value: String(value.value ?? '').trim(),
  type: value.type,
  description: typeof value.description === 'string' && value.description.trim()
    ? value.description.trim()
    : undefined,
});

const parseStyleClassMap = (value: unknown): EditorStyleClassMap => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<EditorStyleClassMap>((acc, [key, entry]) => {
    if (!isRecord(entry)) {
      return acc;
    }

    const className = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : key.trim();
    if (!className) {
      return acc;
    }

    const styles = isRecord(entry.styles)
      ? ({ ...entry.styles } as EditorElement['styles'])
      : {};
    const responsive = isRecord(entry.responsive)
      ? ({
          tablet: isRecord(entry.responsive.tablet)
            ? ({ ...entry.responsive.tablet } as Partial<EditorElement['styles']>)
            : undefined,
          mobile: isRecord(entry.responsive.mobile)
            ? ({ ...entry.responsive.mobile } as Partial<EditorElement['styles']>)
            : undefined,
        } satisfies EditorStyleClass['responsive'])
      : undefined;

    acc[className] = normalizeStyleClass({
      name: className,
      styles,
      responsive,
    });
    return acc;
  }, {});
};

const parseDesignTokenMap = (value: unknown): EditorDesignTokenMap => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<EditorDesignTokenMap>((acc, [key, entry]) => {
    if (!isRecord(entry)) {
      return acc;
    }

    const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : key.trim();
    const tokenType = entry.type;
    const tokenValue = entry.value;
    if (
      !name
      || typeof tokenValue !== 'string'
      || (
        tokenType !== 'color'
        && tokenType !== 'spacing'
        && tokenType !== 'radius'
        && tokenType !== 'shadow'
        && tokenType !== 'typography'
        && tokenType !== 'size'
        && tokenType !== 'border'
        && tokenType !== 'custom'
      )
    ) {
      return acc;
    }

    acc[name] = normalizeDesignToken({
      name,
      value: tokenValue,
      type: tokenType,
      description: typeof entry.description === 'string' ? entry.description : undefined,
    });
    return acc;
  }, {});
};

const getDesignTokenReference = (tokenName: string) => `var(--ve-token-${tokenName.trim()})`;

const replaceTokenReferenceValue = (
  value: unknown,
  tokenName: string,
  replacement: string,
) => (
  typeof value === 'string' && value.trim() === getDesignTokenReference(tokenName)
    ? replacement
    : value
);

const replaceTokenReferencesInStyles = (
  styles: EditorElement['styles'],
  tokenName: string,
  replacement: string,
): EditorElement['styles'] =>
  Object.entries(styles).reduce<EditorElement['styles']>((acc, [key, value]) => {
    const styleKey = key as keyof EditorElement['styles'];
    const nextValue = replaceTokenReferenceValue(value, tokenName, replacement) as EditorElement['styles'][typeof styleKey];
    const mutableAcc = acc as Record<string, EditorElement['styles'][keyof EditorElement['styles']] | undefined>;
    mutableAcc[styleKey] = nextValue;
    return acc;
  }, {} as EditorElement['styles']);

const parseEditorElement = (value: unknown): EditorElement | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== 'string'
    || typeof value.type !== 'string'
    || typeof value.x !== 'number'
    || typeof value.y !== 'number'
    || typeof value.width !== 'number'
    || typeof value.height !== 'number'
  ) {
    return null;
  }

  const styles = isRecord(value.styles)
    ? ({ ...value.styles } as EditorElement['styles'])
    : {};
  const props = isRecord(value.props) ? { ...value.props } : {};
  const responsive = isRecord(value.responsive)
    ? ({
        tablet: isRecord(value.responsive.tablet)
          ? {
              ...value.responsive.tablet,
              styles: isRecord(value.responsive.tablet.styles)
                ? { ...value.responsive.tablet.styles }
                : {},
            }
          : undefined,
        mobile: isRecord(value.responsive.mobile)
          ? {
              ...value.responsive.mobile,
              styles: isRecord(value.responsive.mobile.styles)
                ? { ...value.responsive.mobile.styles }
                : {},
            }
          : undefined,
      } satisfies EditorElement['responsive'])
    : undefined;

  return normalizeEditorElement({
    id: value.id,
    type: value.type as EditorElement['type'],
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    styles,
    props,
    children: parseStringArray(value.children),
    parent: typeof value.parent === 'string' ? value.parent : undefined,
    icon: typeof value.icon === 'string' ? value.icon : undefined,
    name: typeof value.name === 'string' ? value.name : undefined,
    className: normalizeClassNameList(typeof value.className === 'string' ? value.className : undefined),
    visible: typeof value.visible === 'boolean' ? value.visible : true,
    locked: typeof value.locked === 'boolean' ? value.locked : false,
    responsive,
  });
};

const deserializeProject = (value: unknown): Project | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null;
  }

  const now = new Date();
  const elements = Array.isArray(value.elements)
    ? value.elements
        .map((element) => parseEditorElement(element))
        .filter((element): element is EditorElement => element !== null)
    : [];
  const settings = isRecord(value.settings) ? value.settings : {};
  const metadata = isRecord(value.metadata) ? value.metadata : {};

  return {
    id: value.id,
    name: value.name,
    description: typeof value.description === 'string' ? value.description : undefined,
    elements: synchronizeElementChildren(elements),
    styleClasses: parseStyleClassMap(value.styleClasses),
    designTokens: parseDesignTokenMap(value.designTokens),
    settings: {
      width: typeof settings.width === 'number' ? settings.width : DEFAULT_DESKTOP_VIEWPORT.width,
      height: typeof settings.height === 'number' ? settings.height : DEFAULT_DESKTOP_VIEWPORT.height,
      backgroundColor:
        typeof settings.backgroundColor === 'string' ? settings.backgroundColor : '#ffffff',
      gridSize: typeof settings.gridSize === 'number' ? settings.gridSize : 10,
      snapToGrid: typeof settings.snapToGrid === 'boolean' ? settings.snapToGrid : true,
    },
    metadata: {
      createdBy: typeof metadata.createdBy === 'string' ? metadata.createdBy : 'local-user',
      createdAt: parseDate(metadata.createdAt, now),
      lastModified: parseDate(metadata.lastModified, now),
      version: typeof metadata.version === 'number' ? metadata.version : 1,
    },
    collaborators: parseStringArray(value.collaborators),
    status: isProjectStatus(value.status) ? value.status : 'draft',
  };
};

const deserializeTemplate = (value: unknown): Template | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null;
  }

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const now = new Date();
  const elements = Array.isArray(value.elements)
    ? value.elements
        .map((element) => parseEditorElement(element))
        .filter((element): element is EditorElement => element !== null)
    : [];

  return {
    id: value.id,
    name: value.name,
    description: typeof value.description === 'string' ? value.description : '',
    category: isTemplateCategory(value.category) ? value.category : 'project',
    elements: synchronizeElementChildren(elements),
    styleClasses: parseStyleClassMap(value.styleClasses),
    designTokens: parseDesignTokenMap(value.designTokens),
    metadata: {
      createdBy: typeof metadata.createdBy === 'string' ? metadata.createdBy : 'local-user',
      createdAt: parseDate(metadata.createdAt, now),
      downloads: typeof metadata.downloads === 'number' ? metadata.downloads : 0,
      rating: typeof metadata.rating === 'number' ? metadata.rating : 0,
      featured: typeof metadata.featured === 'boolean' ? metadata.featured : false,
    },
    tags: parseStringArray(value.tags),
    preview: typeof value.preview === 'string' ? value.preview : undefined,
  };
};

const readStoredProject = (projectId: string): Project | null => {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(`${VISUAL_EDITOR_PROJECT_STORAGE_PREFIX}${projectId}`);
    if (!raw) {
      return null;
    }

    return deserializeProject(JSON.parse(raw));
  } catch {
    return null;
  }
};

const writeStoredProject = (project: Project): void => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      `${VISUAL_EDITOR_PROJECT_STORAGE_PREFIX}${project.id}`,
      JSON.stringify(project),
    );
  } catch {
    // Ignore local persistence errors; editor should remain usable.
  }
};

const writeStoredPublishedProject = (project: Project): void => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      `${VISUAL_EDITOR_PUBLISHED_STORAGE_PREFIX}${project.id}`,
      JSON.stringify(project),
    );
  } catch {
    // Ignore local persistence errors; editor should remain usable.
  }
};

const appendStoredProjectRevision = (project: Project): void => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    const storageKey = `${VISUAL_EDITOR_REVISIONS_STORAGE_PREFIX}${project.id}`;
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    const revisions = Array.isArray(parsed) ? parsed : [];
    const nextRevisions = revisions.concat(project).slice(-20);
    window.localStorage.setItem(storageKey, JSON.stringify(nextRevisions));
  } catch {
    // Ignore local persistence errors; editor should remain usable.
  }
};

const readStoredTemplates = (): Template[] => {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(VISUAL_EDITOR_TEMPLATES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => deserializeTemplate(entry))
      .filter((entry): entry is Template => entry !== null);
  } catch {
    return [];
  }
};

const writeStoredTemplates = (templates: Template[]): void => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(VISUAL_EDITOR_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Ignore local persistence errors; editor should remain usable.
  }
};

const buildProjectSnapshot = (
  currentProject: Project | null,
  elements: EditorElement[],
  styleClasses: EditorStyleClassMap,
  designTokens: EditorDesignTokenMap,
  overrides: Partial<Project> = {},
): Project => {
  const now = new Date();
  const normalizedElements = synchronizeElementChildren(
    elements.map((element) => normalizeEditorElement(element)),
  );
  const baseProject = currentProject ?? {
    id: 'visual-editor-project',
    name: 'Visual Editor Project',
    elements: normalizedElements,
    styleClasses,
    designTokens,
    settings: {
      width: DEFAULT_DESKTOP_VIEWPORT.width,
      height: DEFAULT_DESKTOP_VIEWPORT.height,
      backgroundColor: '#ffffff',
      gridSize: 10,
      snapToGrid: true,
    },
    metadata: {
      createdBy: 'local-user',
      createdAt: now,
      lastModified: now,
      version: 0,
    },
    status: 'draft' as const,
  };

  return {
    ...baseProject,
    ...overrides,
    elements: normalizedElements,
    styleClasses: Object.values(overrides.styleClasses ?? styleClasses).reduce<EditorStyleClassMap>((acc, styleClass) => {
      acc[styleClass.name] = normalizeStyleClass(styleClass);
      return acc;
    }, {}),
    designTokens: Object.values(overrides.designTokens ?? designTokens).reduce<EditorDesignTokenMap>((acc, token) => {
      acc[token.name] = normalizeDesignToken(token);
      return acc;
    }, {}),
    settings: {
      ...baseProject.settings,
      ...(overrides.settings ?? {}),
    },
    metadata: {
      ...baseProject.metadata,
      ...(overrides.metadata ?? {}),
    },
    collaborators: overrides.collaborators ?? baseProject.collaborators,
    status: overrides.status ?? baseProject.status,
  };
};

// Reducer
function visualEditorReducer(state: VisualEditorState, action: VisualEditorAction): VisualEditorState {
  switch (action.type) {
    case 'SET_SELECTED_ELEMENT':
      return { ...state, selectedElement: action.payload, selectedElements: [] };
    
    case 'SET_SELECTED_ELEMENTS':
      return {
        ...state,
        selectedElements: action.payload,
        selectedElement: action.payload.length === 1 ? action.payload[0] : null,
      };
    
    case 'ADD_ELEMENT': {
      const newElements = synchronizeElementChildren([
        ...state.elements,
        normalizeEditorElement(action.payload),
      ]);
      return {
        ...state,
        elements: newElements,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1 };
    }
    
    case 'UPDATE_ELEMENT': {
      const updatedElements = synchronizeElementChildren(
        state.elements.map((el) =>
          el.id === action.payload.id
            ? normalizeEditorElement({
                ...el,
                ...action.payload.updates,
                styles: action.payload.updates.styles
                  ? { ...el.styles, ...action.payload.updates.styles }
                  : el.styles,
              })
            : el,
        ),
      );
      return {
        ...state,
        elements: updatedElements,
        history: [...state.history.slice(0, state.historyIndex + 1), updatedElements],
        historyIndex: state.historyIndex + 1 };
    }

    case 'SET_STYLE_CLASSES':
      return {
        ...state,
        styleClasses: Object.values(action.payload).reduce<EditorStyleClassMap>((acc, styleClass) => {
          acc[styleClass.name] = normalizeStyleClass(styleClass);
          return acc;
        }, {}),
      };

    case 'SET_DESIGN_TOKENS':
      return {
        ...state,
        designTokens: Object.values(action.payload).reduce<EditorDesignTokenMap>((acc, token) => {
          acc[token.name] = normalizeDesignToken(token);
          return acc;
        }, {}),
      };

    case 'UPSERT_STYLE_CLASS': {
      const normalizedStyleClass = normalizeStyleClass(action.payload);
      return {
        ...state,
        styleClasses: {
          ...state.styleClasses,
          [normalizedStyleClass.name]: normalizedStyleClass,
        },
      };
    }

    case 'UPSERT_DESIGN_TOKEN': {
      const normalizedToken = normalizeDesignToken(action.payload);
      return {
        ...state,
        designTokens: {
          ...state.designTokens,
          [normalizedToken.name]: normalizedToken,
        },
      };
    }

    case 'DELETE_STYLE_CLASS': {
      const nextStyleClasses = { ...state.styleClasses };
      delete nextStyleClasses[action.payload];

      const nextElements = state.elements.map((element) => {
        const nextClassName = normalizeClassNameList(
          (element.className ?? '')
            .split(/\s+/)
            .filter(Boolean)
            .filter((className) => className !== action.payload)
            .join(' '),
        );

        return nextClassName !== element.className
          ? normalizeEditorElement({ ...element, className: nextClassName })
          : element;
      });

      return {
        ...state,
        styleClasses: nextStyleClasses,
        elements: nextElements,
        history: [...state.history.slice(0, state.historyIndex + 1), nextElements],
        historyIndex: state.historyIndex + 1,
      };
    }

    case 'DELETE_DESIGN_TOKEN': {
      const deletedToken = state.designTokens[action.payload];
      if (!deletedToken) {
        return state;
      }

      const nextDesignTokens = { ...state.designTokens };
      delete nextDesignTokens[action.payload];

      const nextElements = state.elements.map((element) =>
        normalizeEditorElement({
          ...element,
          styles: replaceTokenReferencesInStyles(element.styles, action.payload, deletedToken.value),
          responsive: element.responsive
            ? {
                tablet: element.responsive.tablet
                  ? {
                      ...element.responsive.tablet,
                      styles: replaceTokenReferencesInStyles(
                        element.responsive.tablet.styles ?? {},
                        action.payload,
                        deletedToken.value,
                      ),
                    }
                  : undefined,
                mobile: element.responsive.mobile
                  ? {
                      ...element.responsive.mobile,
                      styles: replaceTokenReferencesInStyles(
                        element.responsive.mobile.styles ?? {},
                        action.payload,
                        deletedToken.value,
                      ),
                    }
                  : undefined,
              }
            : undefined,
        }),
      );

      const nextStyleClasses = Object.values(state.styleClasses).reduce<EditorStyleClassMap>((acc, styleClass) => {
        acc[styleClass.name] = normalizeStyleClass({
          ...styleClass,
          styles: replaceTokenReferencesInStyles(styleClass.styles, action.payload, deletedToken.value),
          responsive: styleClass.responsive
            ? {
                tablet: styleClass.responsive.tablet
                  ? replaceTokenReferencesInStyles(
                      styleClass.responsive.tablet,
                      action.payload,
                      deletedToken.value,
                    )
                  : undefined,
                mobile: styleClass.responsive.mobile
                  ? replaceTokenReferencesInStyles(
                      styleClass.responsive.mobile,
                      action.payload,
                      deletedToken.value,
                    )
                  : undefined,
              }
            : undefined,
        });
        return acc;
      }, {});

      return {
        ...state,
        designTokens: nextDesignTokens,
        elements: nextElements,
        styleClasses: nextStyleClasses,
        history: [...state.history.slice(0, state.historyIndex + 1), nextElements],
        historyIndex: state.historyIndex + 1,
      };
    }
    
    case 'DELETE_ELEMENT': {
      const deletedIds = new Set<string>([action.payload]);
      let hasChanges = true;

      while (hasChanges) {
        hasChanges = false;
        state.elements.forEach((element) => {
          if (element.parent && deletedIds.has(element.parent) && !deletedIds.has(element.id)) {
            deletedIds.add(element.id);
            hasChanges = true;
          }
        });
      }

      const filteredElements = synchronizeElementChildren(
        state.elements.filter((el) => !deletedIds.has(el.id)),
      );
      return {
        ...state,
        elements: filteredElements,
        selectedElement:
          state.selectedElement && deletedIds.has(state.selectedElement)
            ? null
            : state.selectedElement,
        selectedElements: state.selectedElements.filter((id) => !deletedIds.has(id)),
        history: [...state.history.slice(0, state.historyIndex + 1), filteredElements],
        historyIndex: state.historyIndex + 1 };
    }
    
    case 'DUPLICATE_ELEMENT': {
      const elementToDuplicate = state.elements.find(el => el.id === action.payload);
      if (elementToDuplicate) {
        const duplicatedElement = normalizeEditorElement({
          ...elementToDuplicate,
          id: `element-${Date.now()}`,
          x: elementToDuplicate.x + 20,
          y: elementToDuplicate.y + 20,
          parent: elementToDuplicate.parent,
          children: [],
          name: `${getElementDisplayName(elementToDuplicate)} Copy`,
        });
        const elementsWithDuplicate = synchronizeElementChildren([
          ...state.elements,
          duplicatedElement,
        ]);
        return {
          ...state,
          elements: elementsWithDuplicate,
          selectedElement: duplicatedElement.id,
          selectedElements: [],
          history: [...state.history.slice(0, state.historyIndex + 1), elementsWithDuplicate],
          historyIndex: state.historyIndex + 1 };
      }
      return state;
    }
    
    case 'COPY_ELEMENTS': {
      const elementsToCopy = state.elements.filter(el => action.payload.includes(el.id));
      return { ...state, clipboard: elementsToCopy };
    }
    
    case 'PASTE_ELEMENTS': {
      const pastedElements = state.clipboard.map((el, index) =>
        normalizeEditorElement({
          ...el,
          id: `element-${Date.now()}-${index}`,
          x: el.x + action.payload.x,
          y: el.y + action.payload.y,
          children: [],
          parent: undefined,
        }),
      );
      const elementsWithPasted = synchronizeElementChildren([
        ...state.elements,
        ...pastedElements,
      ]);
      return {
        ...state,
        elements: elementsWithPasted,
        history: [...state.history.slice(0, state.historyIndex + 1), elementsWithPasted],
        historyIndex: state.historyIndex + 1 };
    }
    
    case 'UNDO':
      if (state.historyIndex > 0) {
        return {
          ...state,
          elements: state.history[state.historyIndex - 1],
          historyIndex: state.historyIndex - 1 };
    }
      return state;
    
    case 'REDO':
      if (state.historyIndex < state.history.length - 1) {
        return {
          ...state,
          elements: state.history[state.historyIndex + 1],
          historyIndex: state.historyIndex + 1 };
    }
      return state;
    
    case 'SET_CURRENT_PROJECT': {
      const projectElements = synchronizeElementChildren(
        (action.payload?.elements ?? []).map((element) => normalizeEditorElement(element)),
      );
      return {
        ...state,
        currentProject: action.payload
          ? {
              ...action.payload,
              elements: projectElements,
              styleClasses: parseStyleClassMap(action.payload.styleClasses),
              designTokens: parseDesignTokenMap(action.payload.designTokens),
            }
          : null,
        elements: projectElements,
        styleClasses: action.payload?.styleClasses ? parseStyleClassMap(action.payload.styleClasses) : {},
        designTokens: action.payload?.designTokens ? parseDesignTokenMap(action.payload.designTokens) : {},
        history: [projectElements],
        historyIndex: 0,
      };
    }

    case 'SET_ELEMENTS': {
      const nextElements = synchronizeElementChildren(
        action.payload.map((element) => normalizeEditorElement(element)),
      );
      return {
        ...state,
        elements: nextElements,
        history: [...state.history.slice(0, state.historyIndex + 1), nextElements],
        historyIndex: state.historyIndex + 1,
      };
    }
    
    case 'UPDATE_PROJECT':
      return {
        ...state,
        currentProject: state.currentProject
          ? {
              ...state.currentProject,
              ...action.payload,
              styleClasses: action.payload.styleClasses
                ? parseStyleClassMap(action.payload.styleClasses)
                : state.currentProject.styleClasses,
              designTokens: action.payload.designTokens
                ? parseDesignTokenMap(action.payload.designTokens)
                : state.currentProject.designTokens,
            }
          : null
    };
    
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };
    
    case 'ADD_TEMPLATE':
      return { ...state, templates: [...state.templates, action.payload] };
    
    case 'UPDATE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.map(template =>
          template.id === action.payload.id ? { ...template, ...action.payload.updates } : template
        )
    };
    
    case 'DELETE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.filter(template => template.id !== action.payload)
  };
    
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    
    case 'SET_SIDEBAR_OPEN':
      return { ...state, sidebarOpen: action.payload };
    
    case 'SET_PROPERTIES_OPEN':
      return { ...state, propertiesOpen: action.payload };
    
    case 'SET_GRID_VISIBLE':
      return { ...state, gridVisible: action.payload };
    
    case 'SET_SNAP_TO_GRID':
      return { ...state, snapToGrid: action.payload };
    
    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };
    
    case 'SET_PAN':
      return { ...state, pan: action.payload };

    case 'SET_CURRENT_BREAKPOINT':
      return {
        ...state,
        currentBreakpoint: action.payload,
        currentOrientation:
          action.payload === 'desktop'
            ? state.currentOrientation
            : state.breakpointOrientations[action.payload],
      };

    case 'SET_CURRENT_ORIENTATION':
      return state.currentBreakpoint === 'desktop'
        ? { ...state, currentOrientation: action.payload }
        : {
            ...state,
            currentOrientation: action.payload,
            breakpointOrientations: {
              ...state.breakpointOrientations,
              [state.currentBreakpoint]: action.payload,
            },
          };
    
    case 'SET_COLLABORATION_SESSION':
      return { ...state, collaborationSession: action.payload };
    
    case 'UPDATE_CURSORS':
      return { ...state, cursors: action.payload };
    
    case 'SET_ONLINE_USERS':
      return { ...state, onlineUsers: action.payload };
    
    case 'SET_ANALYTICS':
      return { ...state, analytics: action.payload };
    
    case 'UPDATE_PERFORMANCE_METRICS':
      return {
        ...state,
        performanceMetrics: { ...state.performanceMetrics, ...action.payload }
    };
    
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.payload] };
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(notification => notification.id !== action.payload)
  };
    
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload ? { ...notification, read: true } : notification
        )
    };
    
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload }
    };
    
    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, [action.payload.key]: action.payload.value }
    };
    
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload.key]: action.payload.value }
    };
    
    case 'ADD_HISTORY_ENTRY': {
      const entry: HistoryEntry = {
        id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        action: action.payload.action,
        description: action.payload.description,
        timestamp: action.payload.timestamp,
      };
      return {
        ...state,
        historyEntries: [...state.historyEntries, entry],
      };
    }
    
    case 'UPDATE_COLLABORATIVE_CURSORS': {
      const { userId, userName: _userName, userColor, x, y } = action.payload;
      return {
        ...state,
        cursors: {
          ...state.cursors,
          [userId]: { x, y, color: userColor },
        },
        collaborationSession: state.collaborationSession
          ? {
              ...state.collaborationSession,
              cursors: {
                ...state.collaborationSession.cursors,
                [userId]: { x, y, color: userColor },
              },
              lastActivity: new Date(),
            }
          : null,
      };
    }

    case 'RESET_STATE':
      return initialState;
    
    default: return state;
}
}

// Context
const VisualEditorContext = createContext<{
  state: VisualEditorState;
  dispatch: React.Dispatch<VisualEditorAction>;
  // Helper functions
  addElement: (element: Omit<EditorElement, 'id'>) => void;
  updateElement: (id: string, updates: Partial<EditorElement>) => void;
  deleteElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  selectElements: (ids: string[]) => void;
  copyElements: (ids: string[]) => void;
  pasteElements: (x: number, y: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  addToast: (toast: { message: string; type: 'success' | 'error' | 'warning' | 'info'; duration?: number; actions?: Array<{label: string; action: () => void}> }) => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  setActiveTab: (tab: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setPropertiesOpen: (open: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setCurrentBreakpoint: (breakpoint: EditorBreakpoint) => void;
  setCurrentOrientation: (orientation: EditorDeviceOrientation) => void;
  setElements: (elements: EditorElement[]) => void;
  upsertStyleClass: (styleClass: EditorStyleClass) => void;
  deleteStyleClass: (name: string) => void;
  upsertDesignToken: (token: EditorDesignToken) => void;
  deleteDesignToken: (name: string) => void;
  moveElement: (id: string, parentId: string | undefined, targetIndex: number) => void;
  reorderElement: (id: string, direction: 'up' | 'down') => void;
  renameElement: (id: string, name: string) => void;
  setElementClassName: (id: string, className: string) => void;
  toggleElementVisibility: (id: string) => void;
  toggleElementLock: (id: string) => void;
  groupElements: (ids: string[]) => void;
  ungroupElement: (containerId: string) => void;
  loadProject: (project: Project) => void;
  saveProject: () => void;
  publishProject: () => void;
  createTemplate: (template: Omit<Template, 'id' | 'metadata'>) => void;
  loadTemplate: (templateId: string) => void;
  updateSettings: (settings: Partial<VisualEditorState['settings']>) => void;
  // Profession system
  professionIcon: React.ReactNode;
  professionConfig: DynamicProfessionConfig | undefined;
  enhancedProfessionConfig: DynamicProfessionConfig | ApiProfessionConfig | undefined;
  professionColor: string;
  currentProfession: string;
  theming: ReturnType<typeof useTheming>;
} | null>(null);

// Provider component
export function VisualEditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(visualEditorReducer, initialState);
  const { communication, dataFlow } = useEnhancedMasterIntegration();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const templatesHydratedRef = useRef(false);

  // Helper functions
  const addElement = useCallback((element: Omit<EditorElement, 'id'>) => {
    const newElement: EditorElement = {
      ...element,
      id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    dispatch({ type: 'ADD_ELEMENT', payload: newElement });

    // Broadcast to other components
    communication.sendBroadcast('element:added', { element: newElement });
    dataFlow.syncData('visual-editor:elements', state.elements.concat(newElement));
  }, [communication, dataFlow, state.elements]);

  const updateElement = useCallback((id: string, updates: Partial<EditorElement>) => {
    const existingElement = state.elements.find((element) => element.id === id);
    if (!existingElement) {
      return;
    }

    const nextElement = applyResponsiveUpdates(existingElement, updates, state.currentBreakpoint);
    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: { id, updates: nextElement },
    });

    // Broadcast to other components
    communication.sendBroadcast('element:updated', { id, updates: nextElement });
    dataFlow.syncData('visual-editor:elements', state.elements.map(el =>
      el.id === id ? nextElement : el
    ));
  }, [communication, dataFlow, state.currentBreakpoint, state.elements]);

  const setElements = useCallback((elements: EditorElement[]) => {
    dispatch({ type: 'SET_ELEMENTS', payload: elements });
    communication.sendBroadcast('elements:replaced', { elements });
    dataFlow.syncData('visual-editor:elements', elements);
  }, [communication, dataFlow]);

  const upsertStyleClass = useCallback((styleClass: EditorStyleClass) => {
    const normalizedStyleClass = normalizeStyleClass(styleClass);
    dispatch({ type: 'UPSERT_STYLE_CLASS', payload: normalizedStyleClass });
    communication.sendBroadcast('style-class:upserted', { styleClass: normalizedStyleClass });
    dataFlow.syncData('visual-editor:styleClasses', {
      ...state.styleClasses,
      [normalizedStyleClass.name]: normalizedStyleClass,
    });
  }, [communication, dataFlow, state.styleClasses]);

  const deleteStyleClass = useCallback((name: string) => {
    dispatch({ type: 'DELETE_STYLE_CLASS', payload: name });
    const nextStyleClasses = { ...state.styleClasses };
    delete nextStyleClasses[name];
    communication.sendBroadcast('style-class:deleted', { name });
    dataFlow.syncData('visual-editor:styleClasses', nextStyleClasses);
  }, [communication, dataFlow, state.styleClasses]);

  const upsertDesignToken = useCallback((token: EditorDesignToken) => {
    const normalizedToken = normalizeDesignToken(token);
    dispatch({ type: 'UPSERT_DESIGN_TOKEN', payload: normalizedToken });
    communication.sendBroadcast('design-token:upserted', { token: normalizedToken });
    dataFlow.syncData('visual-editor:designTokens', {
      ...state.designTokens,
      [normalizedToken.name]: normalizedToken,
    });
  }, [communication, dataFlow, state.designTokens]);

  const deleteDesignToken = useCallback((name: string) => {
    dispatch({ type: 'DELETE_DESIGN_TOKEN', payload: name });
    const nextDesignTokens = { ...state.designTokens };
    delete nextDesignTokens[name];
    communication.sendBroadcast('design-token:deleted', { name });
    dataFlow.syncData('visual-editor:designTokens', nextDesignTokens);
  }, [communication, dataFlow, state.designTokens]);

  const moveElement = useCallback((
    id: string,
    parentId: string | undefined,
    targetIndex: number,
  ) => {
    const normalizedElements = state.elements.map((element) => normalizeEditorElement(element));
    const elementsById = new Map(normalizedElements.map((element) => [element.id, element]));
    const elementToMove = elementsById.get(id);
    if (!elementToMove) {
      return;
    }

    const currentParentId = elementToMove.parent;
    const siblingBuckets = new Map<string | undefined, string[]>();

    normalizedElements.forEach((element) => {
      const bucketKey = element.parent;
      const currentBucket = siblingBuckets.get(bucketKey) ?? [];
      siblingBuckets.set(bucketKey, [...currentBucket, element.id]);
    });

    const currentSiblings = [...(siblingBuckets.get(currentParentId) ?? [])];
    const currentSiblingIndex = currentSiblings.indexOf(id);
    if (currentSiblingIndex === -1) {
      return;
    }

    const nextSourceSiblings = currentSiblings.filter((siblingId) => siblingId !== id);
    siblingBuckets.set(currentParentId, nextSourceSiblings);

    const targetSiblings = currentParentId === parentId
      ? nextSourceSiblings
      : [...(siblingBuckets.get(parentId) ?? [])];
    const clampedIndex = Math.max(0, Math.min(targetIndex, targetSiblings.length));
    const nextTargetSiblings = [...targetSiblings];
    nextTargetSiblings.splice(clampedIndex, 0, id);
    siblingBuckets.set(parentId, nextTargetSiblings);

    const nextElementsById = new Map(elementsById);
    nextElementsById.set(id, normalizeEditorElement({
      ...elementToMove,
      parent: parentId,
    }));

    const visited = new Set<string>();
    const orderedElements: EditorElement[] = [];

    const visitNode = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return;
      }

      const node = nextElementsById.get(nodeId);
      if (!node) {
        return;
      }

      visited.add(nodeId);
      orderedElements.push(node);
      const childIds = siblingBuckets.get(nodeId) ?? [];
      childIds.forEach((childId) => visitNode(childId));
    };

    (siblingBuckets.get(undefined) ?? []).forEach((rootId) => visitNode(rootId));
    normalizedElements.forEach((element) => visitNode(element.id));

    setElements(orderedElements);
  }, [setElements, state.elements]);

  const deleteElement = useCallback((id: string) => {
    dispatch({ type: 'DELETE_ELEMENT', payload: id });

    // Broadcast to other components
    communication.sendBroadcast('element:deleted', { id });
    dataFlow.syncData('visual-editor:elements', state.elements.filter(el => el.id !== id));
  }, [communication, dataFlow, state.elements]);

  const duplicateElement = useCallback((id: string) => {
    dispatch({ type: 'DUPLICATE_ELEMENT', payload: id });
}, []);

  const selectElement = useCallback((id: string | null) => {
    dispatch({ type: 'SET_SELECTED_ELEMENT', payload: id });
    
    // Broadcast to other components
    communication.sendBroadcast('element:selected', { id });
    dataFlow.syncData('visual-editor:selectedElement', id);
}, [communication, dataFlow]);

  const selectElements = useCallback((ids: string[]) => {
    dispatch({ type: 'SET_SELECTED_ELEMENTS', payload: ids });
    
    // Broadcast to other components
    communication.sendBroadcast('elements:selected', { ids });
    dataFlow.syncData('visual-editor:selectedElements', ids);
}, [communication, dataFlow]);

  const copyElements = useCallback((ids: string[]) => {
    dispatch({ type: 'COPY_ELEMENTS', payload: ids });
}, []);

  const pasteElements = useCallback((x: number, y: number) => {
    dispatch({ type: 'PASTE_ELEMENTS', payload: { x, y } });
}, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
}, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });
  }, []);

  const addToast = useCallback((toast: { message: string; type: 'success' | 'error' | 'warning' | 'info'; duration?: number; actions?: Array<{label: string; action: () => void}> }) => {
    const newNotification: Notification = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: toast.type,
      title: toast.type.charAt(0).toUpperCase() + toast.type.slice(1),
      message: toast.message,
      timestamp: new Date(),
      read: false,
      action: toast.actions && toast.actions.length > 0 ? {
        label: toast.actions[0].label,
        callback: toast.actions[0].action
      } : undefined
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });
  }, []);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });

    // Broadcast to other components
    communication.sendBroadcast('tab:changed', { tab });
    dataFlow.syncData('visual-editor:activeTab', tab);
  }, [communication, dataFlow]);

  const setSidebarOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_SIDEBAR_OPEN', payload: open });
}, []);

  const setPropertiesOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_PROPERTIES_OPEN', payload: open });
}, []);

  const setGridVisible = useCallback((visible: boolean) => {
    dispatch({ type: 'SET_GRID_VISIBLE', payload: visible });
}, []);

  const setSnapToGrid = useCallback((snap: boolean) => {
    dispatch({ type: 'SET_SNAP_TO_GRID', payload: snap });
}, []);

  const setZoom = useCallback((zoom: number) => {
    dispatch({ type: 'SET_ZOOM', payload: zoom });
}, []);

  const setPan = useCallback((x: number, y: number) => {
    dispatch({ type: 'SET_PAN', payload: { x, y } });
}, []);

  const setCurrentBreakpoint = useCallback((breakpoint: EditorBreakpoint) => {
    dispatch({ type: 'SET_CURRENT_BREAKPOINT', payload: breakpoint });
    communication.sendBroadcast('visual-editor:breakpoint', { breakpoint });
    dataFlow.syncData('visual-editor:breakpoint', breakpoint);
  }, [communication, dataFlow]);

  const setCurrentOrientation = useCallback((orientation: EditorDeviceOrientation) => {
    dispatch({ type: 'SET_CURRENT_ORIENTATION', payload: orientation });
    communication.sendBroadcast('visual-editor:orientation', { orientation });
    dataFlow.syncData('visual-editor:orientation', orientation);
  }, [communication, dataFlow]);

  const reorderElement = useCallback((id: string, direction: 'up' | 'down') => {
    const targetElement = state.elements.find((element) => element.id === id);
    if (!targetElement) {
      return;
    }

    const siblings = state.elements.filter((element) => element.parent === targetElement.parent);
    const siblingPosition = siblings.findIndex((element) => element.id === id);
    if (siblingPosition === -1) {
      return;
    }

    const targetIndex =
      direction === 'up'
        ? siblingPosition - 1
        : siblingPosition + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      return;
    }

    moveElement(id, targetElement.parent, targetIndex);
  }, [moveElement, state.elements]);

  const renameElement = useCallback((id: string, name: string) => {
    const existingElement = state.elements.find((element) => element.id === id);
    if (!existingElement) {
      return;
    }

    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        id,
        updates: {
          name,
          props: {
            ...existingElement.props,
            name,
          },
        },
      },
    });
  }, [state.elements]);

  const setElementClassName = useCallback((id: string, className: string) => {
    const normalizedClassName = normalizeClassNameList(className);
    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        id,
        updates: { className: normalizedClassName },
      },
    });
  }, []);

  const toggleElementVisibility = useCallback((id: string) => {
    const existingElement = state.elements.find((element) => element.id === id);
    if (!existingElement) {
      return;
    }

    const resolvedElement = resolveElementForBreakpoint(
      existingElement,
      state.currentBreakpoint,
      state.styleClasses,
      state.designTokens,
    );
    updateElement(id, { visible: !resolvedElement.visible });
  }, [state.currentBreakpoint, state.elements, state.styleClasses, state.designTokens, updateElement]);

  const toggleElementLock = useCallback((id: string) => {
    const existingElement = state.elements.find((element) => element.id === id);
    if (!existingElement) {
      return;
    }

    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        id,
        updates: { locked: !(existingElement.locked ?? false) },
      },
    });
  }, [state.elements]);

  const groupElements = useCallback((ids: string[]) => {
    if (ids.length < 2) {
      return;
    }

    const selectedIds = new Set(ids);
    const selectedElements = state.elements.filter((element) => selectedIds.has(element.id));
    if (selectedElements.length < 2) {
      return;
    }

    const sharedParent = selectedElements.every(
      (element) => element.parent === selectedElements[0].parent,
    )
      ? selectedElements[0].parent
      : undefined;
    const renderableElements = resolveRenderableElements(
      state.elements,
      state.currentBreakpoint,
      state.styleClasses,
      state.designTokens,
    );
    const renderableMap = new Map(
      renderableElements.map((element) => [element.id, element]),
    );
    const selectedRenderable = selectedElements
      .map((element) => renderableMap.get(element.id))
      .filter((element): element is NonNullable<typeof element> => Boolean(element));

    if (selectedRenderable.length < 2) {
      return;
    }

    const minX = Math.min(...selectedRenderable.map((element) => element.x));
    const minY = Math.min(...selectedRenderable.map((element) => element.y));
    const maxX = Math.max(...selectedRenderable.map((element) => element.x + element.width));
    const maxY = Math.max(...selectedRenderable.map((element) => element.y + element.height));
    const parentRenderable = sharedParent ? renderableMap.get(sharedParent) : undefined;
    const parentOffsetX = parentRenderable?.x ?? 0;
    const parentOffsetY = parentRenderable?.y ?? 0;
    const containerId = `element-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const orderedElements = state.elements.map((element) => normalizeEditorElement(element));
    const firstSelectedIndex = orderedElements.findIndex((element) => selectedIds.has(element.id));

    const nextElements = orderedElements.map((element) => {
      if (!selectedIds.has(element.id)) {
        return element;
      }

      const absoluteElement = renderableMap.get(element.id);
      if (!absoluteElement) {
        return element;
      }

      return normalizeEditorElement({
        ...element,
        parent: containerId,
        x: absoluteElement.x - minX,
        y: absoluteElement.y - minY,
      });
    });

    const containerElement = normalizeEditorElement({
      id: containerId,
      type: 'container',
      x: minX - parentOffsetX,
      y: minY - parentOffsetY,
      width: maxX - minX,
      height: maxY - minY,
      styles: {
        backgroundColor: 'transparent',
        border: '1px dashed rgba(255, 107, 53, 0.4)',
      },
      props: {
        text: '',
        name: 'Group',
      },
      name: 'Group',
      visible: true,
      locked: false,
      parent: sharedParent,
      children: ids,
      responsive: {},
      className: '',
    });

    nextElements.splice(firstSelectedIndex, 0, containerElement);
    setElements(nextElements);
    dispatch({ type: 'SET_SELECTED_ELEMENT', payload: containerId });
  }, [setElements, state.currentBreakpoint, state.elements, state.styleClasses, state.designTokens]);

  const ungroupElement = useCallback((containerId: string) => {
    const elements = state.elements.map((element) => normalizeEditorElement(element));
    const container = elements.find((element) => element.id === containerId);
    if (!container || !container.children || container.children.length === 0) {
      return;
    }

    const renderableMap = new Map(
      resolveRenderableElements(
        elements,
        state.currentBreakpoint,
        state.styleClasses,
        state.designTokens,
      ).map((element) => [element.id, element]),
    );
    const grandParentRenderable = container.parent
      ? renderableMap.get(container.parent)
      : undefined;
    const grandParentOffsetX = grandParentRenderable?.x ?? 0;
    const grandParentOffsetY = grandParentRenderable?.y ?? 0;

    const nextElements = elements
      .filter((element) => element.id !== containerId)
      .map((element) => {
        if (!container.children?.includes(element.id)) {
          return element;
        }

        const absoluteElement = renderableMap.get(element.id);
        if (!absoluteElement) {
          return element;
        }

        return normalizeEditorElement({
          ...element,
          parent: container.parent,
          x: absoluteElement.x - grandParentOffsetX,
          y: absoluteElement.y - grandParentOffsetY,
        });
      });

    setElements(nextElements);
    dispatch({ type: 'SET_SELECTED_ELEMENTS', payload: container.children });
  }, [setElements, state.currentBreakpoint, state.elements, state.styleClasses, state.designTokens]);

  const loadProject = useCallback((project: Project) => {
    const storedProject = readStoredProject(project.id);
    const projectToLoad = storedProject ?? deserializeProject(project) ?? project;

    dispatch({ type: 'SET_CURRENT_PROJECT', payload: projectToLoad });
    dispatch({ type: 'SET_SELECTED_ELEMENT', payload: null });
    dispatch({ type: 'SET_SELECTED_ELEMENTS', payload: [] });

    if (!storedProject) {
      writeStoredProject(projectToLoad);
    }
    
    // Broadcast to other components
    communication.sendBroadcast('project:loaded', { project: projectToLoad });
    dataFlow.syncData('visual-editor:currentProject', projectToLoad);
}, [communication, dataFlow]);

  const saveProject = useCallback(() => {
    const updatedProject = buildProjectSnapshot(
      state.currentProject,
      state.elements,
      state.styleClasses,
      state.designTokens,
      {
      metadata: {
        ...(state.currentProject?.metadata ?? {
          createdBy: 'local-user',
          createdAt: new Date(),
          version: 0,
        }),
        lastModified: new Date(),
        version: (state.currentProject?.metadata.version ?? 0) + 1,
      },
      },
    );

    writeStoredProject(updatedProject);
    appendStoredProjectRevision(updatedProject);
    dispatch({
      type: state.currentProject ? 'UPDATE_PROJECT' : 'SET_CURRENT_PROJECT',
      payload: updatedProject,
    });
    dispatch({
      type: 'ADD_HISTORY_ENTRY',
      payload: {
        action: 'save',
        description: `Saved ${updatedProject.name}`,
        timestamp: new Date().toISOString(),
      },
    });
    
    // Broadcast to other components
    communication.sendBroadcast('project:saved', { project: updatedProject });
    dataFlow.syncData('visual-editor:currentProject', updatedProject);
  }, [state.currentProject, state.elements, state.styleClasses, state.designTokens, communication, dataFlow]);

  const publishProject = useCallback(() => {
    const publishedProject = buildProjectSnapshot(state.currentProject, state.elements, state.styleClasses, state.designTokens, {
      status: 'published',
      metadata: {
        ...(state.currentProject?.metadata ?? {
          createdBy: 'local-user',
          createdAt: new Date(),
          version: 0,
        }),
        lastModified: new Date(),
        version: (state.currentProject?.metadata.version ?? 0) + 1,
      },
    });

    writeStoredProject(publishedProject);
    writeStoredPublishedProject(publishedProject);
    appendStoredProjectRevision(publishedProject);
    dispatch({
      type: state.currentProject ? 'UPDATE_PROJECT' : 'SET_CURRENT_PROJECT',
      payload: publishedProject,
    });
    dispatch({
      type: 'ADD_HISTORY_ENTRY',
      payload: {
        action: 'publish',
        description: `Published ${publishedProject.name}`,
        timestamp: new Date().toISOString(),
      },
    });

    communication.sendBroadcast('project:published', { project: publishedProject });
    dataFlow.syncData('visual-editor:currentProject', publishedProject);
  }, [communication, dataFlow, state.currentProject, state.elements, state.styleClasses, state.designTokens]);

  const createTemplate = useCallback((template: Omit<Template, 'id' | 'metadata'>) => {
    const newTemplate: Template = {
      ...template,
      elements: synchronizeElementChildren(
        template.elements.map((element) => normalizeEditorElement(element)),
      ),
      styleClasses: template.styleClasses ? parseStyleClassMap(template.styleClasses) : state.styleClasses,
      designTokens: template.designTokens ? parseDesignTokenMap(template.designTokens) : state.designTokens,
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        createdBy: 'current-user', // TODO: Get from auth context
        createdAt: new Date(),
        downloads: 0,
        rating: 0,
        featured: false
      }
    };
    dispatch({ type: 'ADD_TEMPLATE', payload: newTemplate });
    writeStoredTemplates(state.templates.concat(newTemplate));
    dispatch({
      type: 'ADD_HISTORY_ENTRY',
      payload: {
        action: 'template:create',
        description: `Created template ${newTemplate.name}`,
        timestamp: new Date().toISOString(),
      },
    });

    // Broadcast to other components
    communication.sendBroadcast('template:created', { template: newTemplate });
    dataFlow.syncData('visual-editor:templates', state.templates.concat(newTemplate));
  }, [communication, dataFlow, state.styleClasses, state.designTokens, state.templates]);

  const loadTemplate = useCallback((templateId: string) => {
    const template = state.templates.find(t => t.id === templateId);
    if (template) {
      const templateProject = buildProjectSnapshot(
        state.currentProject,
        template.elements,
        template.styleClasses ? parseStyleClassMap(template.styleClasses) : state.styleClasses,
        template.designTokens ? parseDesignTokenMap(template.designTokens) : state.designTokens,
        {
          name: state.currentProject?.name ?? template.name,
          description: state.currentProject?.description ?? template.description,
          status: 'draft',
          metadata: {
            ...(state.currentProject?.metadata ?? {
              createdBy: template.metadata.createdBy,
              createdAt: template.metadata.createdAt,
              version: 0,
            }),
            lastModified: new Date(),
            version: (state.currentProject?.metadata.version ?? 0) + 1,
          },
        },
      );
      writeStoredProject(templateProject);
      dispatch({ type: 'SET_CURRENT_PROJECT', payload: templateProject });
      dispatch({ type: 'SET_SELECTED_ELEMENT', payload: null });
      dispatch({ type: 'SET_SELECTED_ELEMENTS', payload: [] });
      dispatch({
        type: 'ADD_HISTORY_ENTRY',
        payload: {
          action: 'template:load',
          description: `Loaded template ${template.name}`,
          timestamp: new Date().toISOString(),
        },
      });
      
      // Broadcast to other components
      communication.sendBroadcast('template:loaded', { template });
      dataFlow.syncData('visual-editor:currentTemplate', template);
      dataFlow.syncData('visual-editor:currentProject', templateProject);
  }
}, [state.templates, state.currentProject, state.styleClasses, state.designTokens, communication, dataFlow]);

  const updateSettings = useCallback((settings: Partial<VisualEditorState['settings']>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    
    // Broadcast to other components
    communication.sendBroadcast('settings:updated', { settings });
    dataFlow.syncData('visual-editor:settings', { ...state.settings, ...settings });
}, [communication, dataFlow, state.settings]);

  useEffect(() => {
    const storedTemplates = readStoredTemplates();
    if (storedTemplates.length > 0) {
      dispatch({ type: 'SET_TEMPLATES', payload: storedTemplates });
    }
    templatesHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!templatesHydratedRef.current) {
      return;
    }

    writeStoredTemplates(state.templates);
  }, [state.templates]);

  useEffect(() => {
    if (!state.currentProject) {
      return;
    }

    const draftProject = buildProjectSnapshot(
      state.currentProject,
      state.elements,
      state.styleClasses,
      state.designTokens,
    );

    writeStoredProject(draftProject);
  }, [
    state.currentProject,
    state.elements,
    state.styleClasses,
    state.designTokens,
  ]);

  // Auto-save functionality
  useEffect(() => {
    if (state.settings.autoSave && state.currentProject) {
      autoSaveIntervalRef.current = setInterval(() => {
        saveProject();
    }, state.settings.autoSaveInterval);
  }

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [state.settings.autoSave, state.settings.autoSaveInterval, state.currentProject, saveProject]);

  // Listen for external changes
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: { type: string; data: Record<string, unknown>; from?: string }) => {
      switch (message.type) {
        case 'element:added':
          // Handle external element addition
          {
            const externalElement = parseEditorElement(message.data.element);
            if (externalElement) {
              dispatch({ type: 'ADD_ELEMENT', payload: externalElement });
            }
          }
          break;
        case 'element:updated':
          // Handle external element updates
          if (typeof message.data.id === 'string' && isRecord(message.data.updates)) {
            dispatch({ type: 'UPDATE_ELEMENT', payload: { id: message.data.id, updates: message.data.updates } });
          }
          break;
        case 'element:deleted':
          // Handle external element deletion
          if (typeof message.data.id === 'string') {
            dispatch({ type: 'DELETE_ELEMENT', payload: message.data.id });
          }
          break;
        case 'project:loaded':
          // Handle external project loading
          {
            const externalProject = deserializeProject(message.data.project);
            if (externalProject) {
              dispatch({ type: 'SET_CURRENT_PROJECT', payload: externalProject });
            }
          }
          break;
        case 'template:loaded':
          // Handle external template loading
          if (message.data && message.data.template) {
            // Load template elements into editor
            dispatch({ type: 'SET_SELECTED_ELEMENT', payload: null });
            dispatch({ type: 'SET_SELECTED_ELEMENTS', payload: [] });
          }
          break;
        case 'tab:changed':
          // Handle external tab changes
          if (typeof message.data.tab === 'string') {
            dispatch({ type: 'SET_ACTIVE_TAB', payload: message.data.tab });
          }
          break;
        case 'project:selected':
          // Handle project selection from other components
          {
            const externalProject = deserializeProject(message.data.project);
            if (externalProject) {
              dispatch({ type: 'SET_CURRENT_PROJECT', payload: externalProject });
            }
          }
          break;
        case 'client:selected':
          // Handle client selection from other components
          if (isRecord(message.data.client)) {
            const clientName =
              typeof message.data.client.name === 'string' ? message.data.client.name : 'Unknown';
            addNotification({
              type: 'info',
              title: 'Client Selected',
              message: `Selected client: ${clientName}`,
              read: false,
            });
          }
          break;
      }
    });

    return unsubscribe;
}, [communication, state.currentProject]);

  const contextValue = {
    state,
    dispatch,
    addElement,
    updateElement,
    deleteElement,
    duplicateElement,
    selectElement,
    selectElements,
    copyElements,
    pasteElements,
    undo,
    redo,
    canUndo,
    canRedo,
    addNotification,
    addToast,
    removeNotification,
    markNotificationRead,
    setActiveTab,
    setSidebarOpen,
    setPropertiesOpen,
    setGridVisible,
    setSnapToGrid,
    setZoom,
    setPan,
    setCurrentBreakpoint,
    setCurrentOrientation,
    setElements,
    upsertStyleClass,
    deleteStyleClass,
    upsertDesignToken,
    deleteDesignToken,
    moveElement,
    reorderElement,
    renameElement,
    setElementClassName,
    toggleElementVisibility,
    toggleElementLock,
    groupElements,
    ungroupElement,
    loadProject,
    saveProject,
    publishProject,
    createTemplate,
    loadTemplate,
    updateSettings,
    // Profession system
    professionIcon,
    professionConfig,
    enhancedProfessionConfig,
    professionColor,
    currentProfession,
    theming,
};

  return (
    <VisualEditorContext.Provider value={contextValue}>
      {children}
    </VisualEditorContext.Provider>
  );
}

// Hook to use the context
export function useVisualEditor() {
  const context = useContext(VisualEditorContext);
  if (!context) {
    throw new Error('useVisualEditor must be used within a VisualEditorProvider');
}
  return context;
}

// Types are already exported via interface declarations above
