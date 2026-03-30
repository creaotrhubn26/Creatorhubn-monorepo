/**
 * Enhanced Visual Editor Page - Integrates all advanced features
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Tooltip,
  Fab,
  Drawer,
  Tabs,
  Tab,
  Typography,
  Divider,
  Button,
  Stack,
  TextField,
  Chip,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Code,
  Visibility,
  Accessible,
  CloudUpload,
  Keyboard,
  Folder,
  DashboardCustomize,
  AutoAwesome,
  Tune,
  Settings as SettingsIcon,
  StayCurrentLandscape,
  StayCurrentPortrait,
  TextFields,
  SmartButton,
  ViewQuilt,
  WebAsset,
} from '@mui/icons-material';

// Existing components
import {
  VisualEditorProvider,
  type EditorDesignTokenMap,
  useVisualEditor,
  type EditorElement,
  type EditorStyleClassMap,
  type Project,
} from './VisualEditorContext';
import { EnhancedTopToolbar } from './EnhancedTopToolbar';
import { FabricCanvas } from './FabricCanvas';
import VisualEditorSidebar from './VisualEditorSidebar';
import { EnhancedPropertiesPanel } from './EnhancedPropertiesPanel';

// New enhanced components
import { CodeEditorPanel } from './CodeEditorPanel';
import { LivePreviewPanel } from './LivePreviewPanel';
import { AccessibilityChecker } from './AccessibilityChecker';
import { PlatformExporter } from './PlatformExporter';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { ComponentLibrary, type ComponentLibrarySnapshot, type LibraryComponent } from './ComponentLibrary';
import { UnifiedCodeStudio } from './UnifiedCodeStudio';
import { getVisualEditorTokens } from './visualEditorTokens';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useDatabase } from '@/hooks/useDatabase';
import ModalCreator from './ModalCreator';
import DashboardComponentManager from './DashboardComponentManager';
import LibrarySuggestionDialog from './LibrarySuggestionDialog';
import ProfessionConfigWizard, { type ProfessionConfiguration } from './ProfessionConfigWizard';
import ToastDesigner from './ToastDesigner';
import TemplateDashboard from './TemplateDashboard';
import ExportPresetsDashboard from './ExportPresetsDashboard';
import CloudSyncDashboard from './CloudSyncDashboard';
import TeamCollaborationDashboard from './TeamCollaborationDashboard';
import PluginDashboard from './PluginDashboard';
import AnimationDashboard from './AnimationDashboard';
import ComponentLibraryDashboard from './ComponentLibraryDashboard';
import DesignSystemDashboard from './DesignSystemDashboard';
import AnalyticsDashboard from './AnalyticsDashboard';
import AuditDashboard from './AuditDashboard';
import MonitoringDashboard from './MonitoringDashboard';
import SystemManagementDashboard from './SystemManagementDashboard';
import MLOptimizationDashboard from './MLOptimizationDashboard';
import AdvancedAnalyticsDashboard from './AdvancedAnalyticsDashboard';
import AIAssistanceDashboard from './AIAssistanceDashboard';
import TemplatePresetDashboard from './TemplatePresetDashboard';
import ClientCommunicationDashboard from './ClientCommunicationDashboard';
import RevenueOptimizationDashboard from './RevenueOptimizationDashboard';
import SEODashboard from './SEODashboard';
import BrandingWorkflowPanel from './BrandingWorkflowPanel';
import { LogoManagementPanel } from './LogoManagementPanel';
import ThemingAdminPanel from './ThemingAdminPanel';
import LandingSettingsPanel from './LandingSettingsPanel';
import ShowcasePublisherPanel from '../../showcase/ShowcasePublisherPanel';
import {
  BREAKPOINT_MEDIA_QUERIES,
  buildComponentManifest,
  extractDesignTokenNameFromReference,
  EDITOR_BREAKPOINTS,
  getDesignTokenCssVariableName,
  getDesignTokenReference,
  getElementComponentBinding,
  getElementClassNames,
  getDisplayViewport,
  getEditorLayoutMode,
  getProjectViewport,
  resolveEditorBrowserViewportMetrics,
  resolveEditorDeviceProfile,
  sanitizeComponentSlotName,
  stripComponentBindingFromProps,
  type EditorResponsiveOverride,
  withComponentBinding,
} from './visualEditorModel';

interface EnhancedVisualEditorPageProps {
  projectId?: string;
}

interface IntegrationMessage {
  type?: unknown;
  from?: unknown;
  to?: unknown;
  data?: unknown;
  [key: string]: unknown;
}

type GeneratedCodeState = {
  html: string;
  react: string;
  css: string;
  javascript: string;
  manifest: string;
};

interface IntegrationStateSnapshot {
  projectId: string;
  projectName: string;
  elements: EditorElement[];
  activeTab: AdvancedWorkspaceTab;
  timestamp: number;
}

type AdvancedWorkspaceTab =
  | 'templates'
  | 'export-presets'
  | 'cloud-sync'
  | 'team-collaboration'
  | 'plugins'
  | 'animations'
  | 'component-library'
  | 'design-system'
  | 'analytics'
  | 'audit'
  | 'monitoring'
  | 'system-management'
  | 'ml-optimization'
  | 'advanced-analytics'
  | 'ai-assistance'
  | 'templates-presets'
  | 'template-presets'
  | 'client-communication'
  | 'revenue-optimization'
  | 'seo'
  | 'modals'
  | 'dashboard-components'
  | 'toasts'
  | 'branding'
  | 'landing-settings'
  | 'showcase-publisher'
  | 'theming-admin'
  | 'integration-tools';

const VALID_ELEMENT_TYPES: EditorElement['type'][] = [
  'button', 'text', 'image', 'card', 'container', 'grid', 'audio', 'video',
];

const toElementType = (raw: string): EditorElement['type'] => {
  const lower = raw.toLowerCase() as EditorElement['type'];
  return VALID_ELEMENT_TYPES.includes(lower) ? lower : 'container';
};

const createEditorElementId = () =>
  `component-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const cloneEditorElement = (element: EditorElement): EditorElement => ({
  ...element,
  styles: { ...element.styles },
  props: { ...element.props },
  children: [...(element.children ?? [])],
  responsive: element.responsive
    ? {
        tablet: element.responsive.tablet
          ? {
              ...element.responsive.tablet,
              styles: { ...(element.responsive.tablet.styles ?? {}) },
            }
          : undefined,
        mobile: element.responsive.mobile
          ? {
              ...element.responsive.mobile,
              styles: { ...(element.responsive.mobile.styles ?? {}) },
            }
          : undefined,
      }
    : undefined,
});

const cloneStyleClassMap = (styleClasses: EditorStyleClassMap): EditorStyleClassMap =>
  Object.entries(styleClasses).reduce<EditorStyleClassMap>((acc, [name, styleClass]) => {
    acc[name] = {
      name: styleClass.name,
      styles: { ...styleClass.styles },
      responsive: styleClass.responsive
        ? {
            tablet: styleClass.responsive.tablet
              ? { ...styleClass.responsive.tablet }
              : undefined,
            mobile: styleClass.responsive.mobile
              ? { ...styleClass.responsive.mobile }
              : undefined,
          }
        : undefined,
    };
    return acc;
  }, {});

const cloneDesignTokenMap = (designTokens: EditorDesignTokenMap): EditorDesignTokenMap =>
  Object.entries(designTokens).reduce<EditorDesignTokenMap>((acc, [name, token]) => {
    acc[name] = {
      name: token.name,
      value: token.value,
      type: token.type,
      description: token.description,
    };
    return acc;
  }, {});

const buildComponentSlotNameMap = (
  elements: EditorElement[],
  rootElementIds: string[],
): Map<string, string> => {
  const slotCounts = new Map<string, number>();

  return elements.reduce<Map<string, string>>((acc, element) => {
    const fallbackName = rootElementIds.includes(element.id)
      ? element.name ?? 'root'
      : element.name ?? `${element.type}-slot`;
    const normalizedBase = sanitizeComponentSlotName(fallbackName);
    const nextCount = (slotCounts.get(normalizedBase) ?? 0) + 1;
    slotCounts.set(normalizedBase, nextCount);
    acc.set(element.id, nextCount === 1 ? normalizedBase : `${normalizedBase}-${nextCount}`);
    return acc;
  }, new Map());
};

const collectUsedDesignTokenNames = (
  styleMap: Partial<EditorElement['styles']>,
  tokenNames: Set<string>,
) => {
  Object.values(styleMap).forEach((value) => {
    if (typeof value !== 'string') {
      return;
    }

    const tokenName = extractDesignTokenNameFromReference(value);
    if (tokenName) {
      tokenNames.add(tokenName);
    }
  });
};

const rewriteTokenReferencesInStyleMap = (
  styleMap: Partial<EditorElement['styles']>,
  tokenNameMap: Map<string, string>,
): Partial<EditorElement['styles']> =>
  Object.entries(styleMap).reduce<Partial<EditorElement['styles']>>((acc, [key, value]) => {
    const styleKey = key as keyof EditorElement['styles'];
    const mutableAcc = acc as Record<string, EditorElement['styles'][keyof EditorElement['styles']] | undefined>;
    if (typeof value !== 'string') {
      mutableAcc[styleKey] = value as EditorElement['styles'][typeof styleKey];
      return acc;
    }

    const currentTokenName = extractDesignTokenNameFromReference(value);
    if (!currentTokenName) {
      mutableAcc[styleKey] = value as EditorElement['styles'][typeof styleKey];
      return acc;
    }

    const rewrittenTokenName = tokenNameMap.get(currentTokenName) ?? currentTokenName;
    mutableAcc[styleKey] = getDesignTokenReference(rewrittenTokenName) as EditorElement['styles'][typeof styleKey];
    return acc;
  }, {});

const buildSelectionSnapshot = (
  elements: EditorElement[],
  selectedIds: string[],
  styleClasses: EditorStyleClassMap,
  designTokens: EditorDesignTokenMap,
): ComponentLibrarySnapshot | null => {
  if (selectedIds.length === 0) {
    return null;
  }

  const elementsById = new Map(elements.map((element) => [element.id, element]));
  const selectedSet = new Set(selectedIds);
  const rootElementIds = selectedIds.filter((id) => {
    let parentId = elementsById.get(id)?.parent;
    while (parentId) {
      if (selectedSet.has(parentId)) {
        return false;
      }
      parentId = elementsById.get(parentId)?.parent;
    }
    return true;
  });

  if (rootElementIds.length === 0) {
    return null;
  }

  const includedIds = new Set<string>();
  const visit = (id: string) => {
    if (includedIds.has(id)) {
      return;
    }

    const element = elementsById.get(id);
    if (!element) {
      return;
    }

    includedIds.add(id);
    (element.children ?? []).forEach((childId) => visit(childId));
  };
  rootElementIds.forEach((id) => visit(id));

  const snapshotElements = elements
    .filter((element) => includedIds.has(element.id))
    .map((element) => {
      const clonedElement = cloneEditorElement(element);
      return {
        ...clonedElement,
        props: stripComponentBindingFromProps(clonedElement.props),
      };
    });
  const usedClassNames = new Set(
    snapshotElements.flatMap((element) => getElementClassNames(element.className)),
  );
  const snapshotStyleClasses = Array.from(usedClassNames).reduce<EditorStyleClassMap>((acc, className) => {
    const styleClass = styleClasses[className];
    if (styleClass) {
      acc[className] = {
        name: styleClass.name,
        styles: { ...styleClass.styles },
        responsive: styleClass.responsive
          ? {
              tablet: styleClass.responsive.tablet
                ? { ...styleClass.responsive.tablet }
                : undefined,
              mobile: styleClass.responsive.mobile
                ? { ...styleClass.responsive.mobile }
                : undefined,
            }
          : undefined,
      };
    }
    return acc;
  }, {});
  const usedTokenNames = new Set<string>();
  snapshotElements.forEach((element) => {
    collectUsedDesignTokenNames(element.styles, usedTokenNames);
    collectUsedDesignTokenNames(element.responsive?.tablet?.styles ?? {}, usedTokenNames);
    collectUsedDesignTokenNames(element.responsive?.mobile?.styles ?? {}, usedTokenNames);
  });
  Object.values(snapshotStyleClasses).forEach((styleClass) => {
    collectUsedDesignTokenNames(styleClass.styles, usedTokenNames);
    collectUsedDesignTokenNames(styleClass.responsive?.tablet ?? {}, usedTokenNames);
    collectUsedDesignTokenNames(styleClass.responsive?.mobile ?? {}, usedTokenNames);
  });
  const snapshotDesignTokens = Array.from(usedTokenNames).reduce<EditorDesignTokenMap>((acc, tokenName) => {
    const token = designTokens[tokenName];
    if (token) {
      acc[tokenName] = {
        name: token.name,
        value: token.value,
        type: token.type,
        description: token.description,
      };
    }
    return acc;
  }, {});

  return {
    rootElementIds: [...rootElementIds],
    elements: snapshotElements,
    styleClasses: snapshotStyleClasses,
    designTokens: snapshotDesignTokens,
  };
};

const instantiateSnapshotComponent = (
  component: LibraryComponent,
  existingStyleClasses: EditorStyleClassMap,
  existingDesignTokens: EditorDesignTokenMap,
  insertionIndex: number,
): { elements: EditorElement[]; styleClasses: EditorStyleClassMap; designTokens: EditorDesignTokenMap; rootIds: string[] } | null => {
  if (!component.snapshot) {
    return null;
  }

  const snapshot = {
    rootElementIds: [...component.snapshot.rootElementIds],
    elements: component.snapshot.elements.map((element) => cloneEditorElement(element)),
    styleClasses: cloneStyleClassMap(component.snapshot.styleClasses),
    designTokens: cloneDesignTokenMap(component.snapshot.designTokens ?? {}),
  };
  const instanceId = `${component.familyId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const componentSlotNameMap = buildComponentSlotNameMap(snapshot.elements, snapshot.rootElementIds);

  const elementIdMap = new Map(snapshot.elements.map((element) => [element.id, createEditorElementId()]));
  const mergedStyleClasses = cloneStyleClassMap(existingStyleClasses);
  const mergedDesignTokens = cloneDesignTokenMap(existingDesignTokens);
  const styleClassNameMap = new Map<string, string>();
  const designTokenNameMap = new Map<string, string>();

  Object.entries(snapshot.designTokens).forEach(([name, token]) => {
    let resolvedName = name;
    const existing = mergedDesignTokens[resolvedName];

    if (existing && JSON.stringify(existing) !== JSON.stringify(token)) {
      let suffix = 2;
      while (mergedDesignTokens[`${name}-${suffix}`]) {
        suffix += 1;
      }
      resolvedName = `${name}-${suffix}`;
    }

    designTokenNameMap.set(name, resolvedName);
    mergedDesignTokens[resolvedName] = {
      name: resolvedName,
      value: token.value,
      type: token.type,
      description: token.description,
    };
  });

  Object.entries(snapshot.styleClasses).forEach(([name, styleClass]) => {
    let resolvedName = name;
    const existing = mergedStyleClasses[resolvedName];
    const existingSignature = existing ? JSON.stringify(existing) : null;
    const snapshotSignature = JSON.stringify(styleClass);

    if (existingSignature && existingSignature !== snapshotSignature) {
      let suffix = 2;
      while (mergedStyleClasses[`${name}-${suffix}`]) {
        suffix += 1;
      }
      resolvedName = `${name}-${suffix}`;
    }

    styleClassNameMap.set(name, resolvedName);
    mergedStyleClasses[resolvedName] = {
      name: resolvedName,
      styles: rewriteTokenReferencesInStyleMap(styleClass.styles, designTokenNameMap) as EditorElement['styles'],
      responsive: styleClass.responsive
        ? {
            tablet: styleClass.responsive.tablet
              ? rewriteTokenReferencesInStyleMap(styleClass.responsive.tablet, designTokenNameMap)
              : undefined,
            mobile: styleClass.responsive.mobile
              ? rewriteTokenReferencesInStyleMap(styleClass.responsive.mobile, designTokenNameMap)
              : undefined,
          }
        : undefined,
    };
  });

  const rootElements = snapshot.rootElementIds
    .map((id) => snapshot.elements.find((element) => element.id === id))
    .filter((element): element is EditorElement => Boolean(element));
  const minRootX = rootElements.reduce((minValue, element) => Math.min(minValue, element.x), Number.POSITIVE_INFINITY);
  const minRootY = rootElements.reduce((minValue, element) => Math.min(minValue, element.y), Number.POSITIVE_INFINITY);
  const offsetX = 96 + (insertionIndex % 5) * 24 - (Number.isFinite(minRootX) ? minRootX : 0);
  const offsetY = 96 + (insertionIndex % 4) * 24 - (Number.isFinite(minRootY) ? minRootY : 0);

  const clonedElements = snapshot.elements.map((element) => {
    const nextId = elementIdMap.get(element.id) ?? createEditorElementId();
    const isRootElement = snapshot.rootElementIds.includes(element.id);
    const nextClassName = getElementClassNames(element.className)
      .map((className) => styleClassNameMap.get(className) ?? className)
      .join(' ') || undefined;

    return withComponentBinding({
      ...cloneEditorElement(element),
      id: nextId,
      parent: element.parent ? elementIdMap.get(element.parent) : undefined,
      children: (element.children ?? []).map((childId) => elementIdMap.get(childId) ?? childId),
      className: nextClassName,
      styles: rewriteTokenReferencesInStyleMap(element.styles, designTokenNameMap) as EditorElement['styles'],
      responsive: element.responsive
        ? {
            tablet: element.responsive.tablet
              ? {
                  ...element.responsive.tablet,
                  styles: rewriteTokenReferencesInStyleMap(
                    element.responsive.tablet.styles ?? {},
                    designTokenNameMap,
                  ) as Partial<EditorElement['styles']>,
                }
              : undefined,
            mobile: element.responsive.mobile
              ? {
                  ...element.responsive.mobile,
                  styles: rewriteTokenReferencesInStyleMap(
                    element.responsive.mobile.styles ?? {},
                    designTokenNameMap,
                  ) as Partial<EditorElement['styles']>,
                }
              : undefined,
          }
        : undefined,
      x: isRootElement ? element.x + offsetX : element.x,
      y: isRootElement ? element.y + offsetY : element.y,
    }, {
      componentId: component.id,
      componentName: component.name,
      familyId: component.familyId,
      variantName: component.variantName,
      instanceId,
      slotName: componentSlotNameMap.get(element.id) ?? 'slot',
      isRoot: isRootElement,
    });
  });

  return {
    elements: clonedElements,
    styleClasses: mergedStyleClasses,
    designTokens: mergedDesignTokens,
    rootIds: snapshot.rootElementIds.map((id) => elementIdMap.get(id) ?? id),
  };
};

export const EnhancedVisualEditorContent: React.FC = () => {
  const {
    state,
    dispatch,
    saveProject,
    loadProject,
    createTemplate,
    loadTemplate,
    setCurrentBreakpoint,
    setCurrentOrientation,
    setElements,
    selectElements,
  } = useVisualEditor();
  const { integration, communication, dataFlow } = useEnhancedMasterIntegration();
  const {
    isConnected: dbConnected,
    error: dbError,
    loadProject: loadProjectFromDatabase,
    saveAsTemplate,
    trackProjectUsage,
  } = useDatabase();
  const tokens = getVisualEditorTokens();
  useKeyboardShortcuts();

  // Panel visibility states
  const [showUnifiedStudio, setShowUnifiedStudio] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showExporter, setShowExporter] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showComponentLibrary, setShowComponentLibrary] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [showLivePreviewPanel, setShowLivePreviewPanel] = useState(false);
  const [showAdvancedWorkspace, setShowAdvancedWorkspace] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<AdvancedWorkspaceTab>('templates');
  const [showLibrarySuggestions, setShowLibrarySuggestions] = useState(false);
  const [suggestedComponentType, setSuggestedComponentType] = useState('video-player');
  const [showProfessionWizard, setShowProfessionWizard] = useState(false);
  const [logoManagerOpen, setLogoManagerOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'html' | 'react' | 'vue'>('react');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [integrationProjectId, setIntegrationProjectId] = useState('default-project');
  const [templateName, setTemplateName] = useState('My template name');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [lastIntegrationEvent, setLastIntegrationEvent] = useState('Idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedProjectForPanels = {
    id: state.currentProject?.id ?? 'visual-editor-project',
    name: state.currentProject?.name ?? 'Visual Editor Project',
  };
  const selectedCanvasIds = state.selectedElements.length > 0
    ? state.selectedElements
    : state.selectedElement
      ? [state.selectedElement]
      : [];
  const componentSelectionSnapshot = useMemo(
    () => buildSelectionSnapshot(state.elements, selectedCanvasIds, state.styleClasses, state.designTokens),
    [selectedCanvasIds, state.elements, state.styleClasses, state.designTokens],
  );

  // Generated code state
  const [generatedCode, setGeneratedCode] = useState<GeneratedCodeState>({
    html: '',
    react: '',
    css: '',
    javascript: '',
    manifest: '[]',
  });

  const generateCodeFromElements = useCallback((elements: EditorElement[]) => {
    const componentManifest = buildComponentManifest(elements);
    const instanceClassNameForElement = (element: EditorElement) => `el-${element.id}`;
    const classTokensForElement = (element: EditorElement) => {
      const sharedTokens = getElementClassNames(element.className);
      return [...sharedTokens, instanceClassNameForElement(element)];
    };
    const escapeAttributeValue = (value: string): string =>
      value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const toCssRule = (selector: string, styles: Record<string, unknown>) => {
      const styleEntries = Object.entries(styles).filter(([, value]) => value !== undefined);
      if (styleEntries.length === 0) {
        return '';
      }

      let rule = `${selector} {\n`;
      styleEntries.forEach(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        rule += `  ${cssKey}: ${String(value)};\n`;
      });
      rule += '}\n';
      return rule;
    };

    const elementsById = new Map(elements.map((element) => [element.id, element]));
    const childIdsByParent = new Map<string | undefined, string[]>();
    elements.forEach((element) => {
      const bucket = childIdsByParent.get(element.parent) ?? [];
      bucket.push(element.id);
      childIdsByParent.set(element.parent, bucket);
    });

    const getParentLayoutMode = (element: EditorElement): ReturnType<typeof getEditorLayoutMode> => {
      if (!element.parent) {
        return 'absolute';
      }

      const parent = elementsById.get(element.parent);
      return parent ? getEditorLayoutMode(parent) : 'absolute';
    };

    const getBaseStylesForElement = (element: EditorElement): Record<string, unknown> => {
      const parentLayoutMode = getParentLayoutMode(element);
      const layoutMode = getEditorLayoutMode(element);
      const baseStyles: Record<string, unknown> = {
        width: `${element.width}px`,
        height: `${element.height}px`,
        ...(element.styles ?? {}),
      };

      if (!element.parent || parentLayoutMode === 'absolute') {
        baseStyles.position = 'absolute';
        baseStyles.left = `${element.x}px`;
        baseStyles.top = `${element.y}px`;
      } else {
        baseStyles.position = 'relative';
      }

      if (layoutMode === 'absolute' && !element.parent) {
        baseStyles.position = 'absolute';
      }

      return baseStyles;
    };

    const getResponsiveOverrideStyles = (
      element: EditorElement,
      override: EditorResponsiveOverride,
    ): Record<string, unknown> => {
      const parentLayoutMode = getParentLayoutMode(element);

      return {
        ...(parentLayoutMode === 'absolute'
          ? {
              ...(override.x !== undefined ? { left: `${override.x}px` } : {}),
              ...(override.y !== undefined ? { top: `${override.y}px` } : {}),
            }
          : {}),
        ...(override.width !== undefined ? { width: `${override.width}px` } : {}),
        ...(override.height !== undefined ? { height: `${override.height}px` } : {}),
        ...(override.styles ?? {}),
        ...(override.visible === false ? { display: 'none' } : {}),
      };
    };

    const getComponentDataAttributes = (element: EditorElement): Record<string, string> => {
      const binding = getElementComponentBinding(element);
      if (!binding) {
        return {};
      }

      return {
        'data-ve-component-id': binding.componentId,
        'data-ve-component-name': binding.componentName,
        'data-ve-component-family': binding.familyId,
        'data-ve-component-variant': binding.variantName,
        'data-ve-component-instance': binding.instanceId,
        'data-ve-component-slot': binding.slotName,
        'data-ve-component-root': String(binding.isRoot),
      };
    };

    const renderAttributeString = (attributes: Record<string, string>): string =>
      Object.entries(attributes)
        .map(([name, value]) => `${name}="${escapeAttributeValue(value)}"`)
        .join(' ');

    const renderHtmlNode = (element: EditorElement, depth: number): string => {
      const className = classTokensForElement(element).join(' ');
      const indent = '  '.repeat(depth);
      const dataAttributes = renderAttributeString({
        'data-ve-element-id': element.id,
        ...getComponentDataAttributes(element),
      });
      const attributeSuffix = dataAttributes ? ` ${dataAttributes}` : '';
      const childIds = childIdsByParent.get(element.id) ?? [];
      const children = childIds
        .map((childId) => elementsById.get(childId))
        .filter((child): child is EditorElement => Boolean(child))
        .map((child) => renderHtmlNode(child, depth + 1))
        .join('');

      if (element.type === 'image') {
        const alt = typeof element.props?.alt === 'string' ? element.props.alt : '';
        const src = typeof element.props?.src === 'string' ? element.props.src : '';
        return `${indent}<img class="${className}"${attributeSuffix} src="${src}" alt="${alt}" />\n`;
      }

      const tag = element.type === 'button' ? 'button' : 'div';
      const text = typeof element.props?.text === 'string' ? element.props.text : '';
      return `${indent}<${tag} class="${className}"${attributeSuffix}>${text}${children ? `\n${children}${indent}` : ''}</${tag}>\n`;
    };

    const renderReactNode = (element: EditorElement, depth: number): string => {
      const className = classTokensForElement(element).join(' ');
      const indent = '  '.repeat(depth);
      const dataAttributes = renderAttributeString({
        'data-ve-element-id': element.id,
        ...getComponentDataAttributes(element),
      });
      const attributeSuffix = dataAttributes ? ` ${dataAttributes}` : '';
      const childIds = childIdsByParent.get(element.id) ?? [];
      const children = childIds
        .map((childId) => elementsById.get(childId))
        .filter((child): child is EditorElement => Boolean(child))
        .map((child) => renderReactNode(child, depth + 1))
        .join('');

      if (element.type === 'image') {
        const alt = typeof element.props?.alt === 'string' ? element.props.alt : '';
        const src = typeof element.props?.src === 'string' ? element.props.src : '';
        return `${indent}<img className="${className}"${attributeSuffix} src="${src}" alt="${alt}" />\n`;
      }

      const tag = element.type === 'button' ? 'button' : 'div';
      const text = typeof element.props?.text === 'string' ? element.props.text : '';
      return `${indent}<${tag} className="${className}"${attributeSuffix}>${text}${children ? `\n${children}${indent}` : ''}</${tag}>\n`;
    };

    const sharedClassCss = Object.values(state.styleClasses)
      .map((styleClass) => toCssRule(`.${styleClass.name}`, styleClass.styles))
      .filter(Boolean)
      .join('\n');
    const designTokenCss = Object.values(state.designTokens)
      .map((token) => `  ${getDesignTokenCssVariableName(token.name)}: ${token.value};`)
      .join('\n');
    const sharedResponsiveCss = Object.values(state.styleClasses)
      .flatMap((styleClass) =>
        Object.entries(styleClass.responsive ?? {}).flatMap(([breakpoint, styles]) => {
          if ((breakpoint !== 'tablet' && breakpoint !== 'mobile') || !styles) {
            return [];
          }

          const rule = toCssRule(`.${styleClass.name}`, styles);
          return rule ? [`${BREAKPOINT_MEDIA_QUERIES[breakpoint]} {\n${rule}}\n`] : [];
        }),
      )
      .join('\n');

    // Generate HTML
    let html = `<!DOCTYPE html>\n<html>\n<head><style>\n`;
    html += designTokenCss ? `:root {\n${designTokenCss}\n}\n` : '';
    html += `.container { position: relative; width: 100%; min-height: 100vh; }\n`;
    html += sharedClassCss ? `${sharedClassCss}\n` : '';
    elements.forEach((element) => {
      html += toCssRule(`.${instanceClassNameForElement(element)}`, getBaseStylesForElement(element));
    });

    const responsiveCss = elements
      .flatMap((element) =>
        Object.entries(element.responsive ?? {}).flatMap(([breakpoint, override]) => {
          if ((breakpoint !== 'tablet' && breakpoint !== 'mobile') || !override) {
            return [];
          }

          return [
            `${BREAKPOINT_MEDIA_QUERIES[breakpoint]} {\n${toCssRule(
              `.${instanceClassNameForElement(element)}`,
              getResponsiveOverrideStyles(element, override),
            )}}\n`,
          ];
        }),
      )
      .join('\n');

    html += sharedResponsiveCss ? `${sharedResponsiveCss}\n` : '';
    html += responsiveCss ? `${responsiveCss}\n` : '';
    html += `</style></head>\n<body>\n`;
    html += componentManifest.length > 0
      ? `<!-- ve-component-manifest ${componentManifest.length} instance${componentManifest.length === 1 ? '' : 's'} -->\n`
      : '';
    html += `<div class="container" data-ve-export="creatorhub-visual-editor">\n`;
    const rootElements = childIdsByParent.get(undefined) ?? [];
    rootElements
      .map((elementId) => elementsById.get(elementId))
      .filter((element): element is EditorElement => Boolean(element))
      .forEach((element) => {
        html += renderHtmlNode(element, 1);
      });
    html += `</div>\n</body>\n</html>`;

    // Generate React code
    let react = `import React from 'react';\n\nexport default function GeneratedComponent() {\n  return (\n    <div className="container" data-ve-export="creatorhub-visual-editor">\n`;
    rootElements
      .map((elementId) => elementsById.get(elementId))
      .filter((element): element is EditorElement => Boolean(element))
      .forEach((element) => {
        react += renderReactNode(element, 3);
      });
    react += `    </div>\n  );\n}`;

    // Generate CSS
    let css = designTokenCss ? `:root {\n${designTokenCss}\n}\n\n` : '';
    css += `.container {\n  position: relative;\n  width: 100%;\n  min-height: 100vh;\n}\n\n`;
    css += sharedClassCss ? `${sharedClassCss}\n\n` : '';
    elements.forEach((element) => {
      const rule = toCssRule(`.${instanceClassNameForElement(element)}`, getBaseStylesForElement(element));
      if (rule) {
        css += `${rule}\n`;
      }
    });

    if (sharedResponsiveCss) {
      css += `${sharedResponsiveCss}\n`;
    }
    elements.forEach((element) => {
      Object.entries(element.responsive ?? {}).forEach(([breakpoint, override]) => {
        if ((breakpoint !== 'tablet' && breakpoint !== 'mobile') || !override) {
          return;
        }

        css += `${BREAKPOINT_MEDIA_QUERIES[breakpoint]} {\n`;
        css += toCssRule(`.${instanceClassNameForElement(element)}`, getResponsiveOverrideStyles(element, override));
        css += '}\n\n';
      });
    });

    // Generate JavaScript
    let javascript = `// Auto-generated event handlers\n`;
    elements.forEach((element) => {
      if (element.type === 'button') {
        javascript += `document.querySelector('.el-${element.id}')?.addEventListener('click', () => {\n  console.log('${String(element.props?.text ?? element.id)} clicked');\n});\n\n`;
      }
    });

    return {
      html,
      react,
      css,
      javascript,
      manifest: JSON.stringify(componentManifest, null, 2),
    };
  }, [state.designTokens, state.styleClasses]);

  // Update generated code when elements change
  useEffect(() => {
    if (state.elements) {
      const code = generateCodeFromElements(state.elements);
      setGeneratedCode(code);
    }
  }, [generateCodeFromElements, state.elements, state.styleClasses]);

  const callIfFunction = useCallback((candidate: unknown, ...args: unknown[]) => {
    if (typeof candidate === 'function') {
      (candidate as (...fnArgs: unknown[]) => unknown)(...args);
    }
  }, []);

  const toRecord = useCallback((value: unknown): Record<string, unknown> | null => {
    if (typeof value === 'object' && value !== null) {
      return value as Record<string, unknown>;
    }
    return null;
  }, []);

  const getIntegrationRecords = useCallback(() => ({
    communicationRecord: communication as unknown as Record<string, unknown>,
    integrationRecord: integration as unknown as Record<string, unknown>,
    dataFlowRecord: dataFlow as unknown as Record<string, unknown>,
  }), [communication, dataFlow, integration]);

  const notify = useCallback((
    type: 'info' | 'success' | 'warning' | 'error',
    title: string,
    message: string,
  ) => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        id: `notif-${Date.now()}`,
        type,
        title,
        message,
        timestamp: new Date(),
        read: false,
      },
    });
  }, [dispatch]);

  const updateAnyComponent = useCallback((targetComponent: string, action: string, data: Record<string, unknown>) => {
    const { communicationRecord, integrationRecord, dataFlowRecord } = getIntegrationRecords();

    callIfFunction(communicationRecord.sendMessage, {
      from: 'enhanced-visual-editor',
      to: targetComponent,
      type: action,
      data,
      priority: 'high',
    });
    callIfFunction(communicationRecord.sendBroadcast, `${targetComponent}:${action}`, data, 'enhanced-visual-editor', 'all');
    callIfFunction(integrationRecord.emit, `${targetComponent}:${action}`, data, 'enhanced-visual-editor', 'all');
    callIfFunction(dataFlowRecord.syncData, `${targetComponent}:${action}`, data, 'enhanced-visual-editor', 'all');
    callIfFunction(integrationRecord.executeAction, action, { target: targetComponent, data }, 'high', 'enhanced-visual-editor', 'all');
  }, [callIfFunction, getIntegrationRecords]);

  const getDataFromComponent = useCallback(async (targetComponent: string, dataKey: string) => {
    const { communicationRecord } = getIntegrationRecords();
    const sendMessage = communicationRecord.sendMessage;
    const onMessage = communicationRecord.onMessage;

    if (typeof sendMessage !== 'function' || typeof onMessage !== 'function') {
      return null;
    }

    return new Promise<Record<string, unknown> | null>((resolve) => {
      let finished = false;

      const finalize = (payload: Record<string, unknown> | null) => {
        if (finished) {
          return;
        }
        finished = true;
        resolve(payload);
      };

      const unsubscribeResult = (onMessage as (handler: (message: Record<string, unknown>) => void) => unknown)((message) => {
        const from = message.from;
        const type = message.type;
        if (from === targetComponent && type === `${dataKey}:response`) {
          const data = message.data;
          if (typeof data === 'object' && data !== null) {
            finalize(data as Record<string, unknown>);
          } else {
            finalize(null);
          }
        }
      });

      (sendMessage as (message: Record<string, unknown>) => unknown)({
        from: 'enhanced-visual-editor',
        to: targetComponent,
        type: `${dataKey}:request`,
        data: { requestId: Date.now() },
        priority: 'medium',
      });

      setTimeout(() => {
        if (typeof unsubscribeResult === 'function') {
          (unsubscribeResult as () => void)();
        }
        finalize(null);
      }, 2000);
    });
  }, [getIntegrationRecords]);

  const workspaceAction = useCallback((panel: string, action: string) => {
    notify('info', `${panel} action`, action);
    updateAnyComponent(panel.toLowerCase().replace(/\s+/g, '-'), action.toLowerCase().replace(/\s+/g, '-'), {
      panel,
      action,
      timestamp: Date.now(),
    });
  }, [notify, updateAnyComponent]);

  const isVisualEditorProject = useCallback((candidate: unknown): candidate is Project => {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }
    const candidateRecord = candidate as Record<string, unknown>;
    if (typeof candidateRecord.id !== 'string' || typeof candidateRecord.name !== 'string') {
      return false;
    }
    if (!Array.isArray(candidateRecord.elements)) {
      return false;
    }
    if (typeof candidateRecord.settings !== 'object' || candidateRecord.settings === null) {
      return false;
    }
    if (typeof candidateRecord.metadata !== 'object' || candidateRecord.metadata === null) {
      return false;
    }
    const status = candidateRecord.status;
    return status === 'draft' || status === 'review' || status === 'published' || status === 'archived';
  }, []);

  const handlePanelProjectUpdate = useCallback((project: Record<string, unknown>) => {
    if (isVisualEditorProject(project)) {
      loadProject(project);
      notify('success', 'Project Synced', `Loaded project ${project.name} from advanced panel`);
      return;
    }
    notify('info', 'Project Update', 'Panel sent update payload');
  }, [isVisualEditorProject, loadProject, notify]);

  const handlePanelNotification = useCallback((notification: Record<string, unknown>) => {
    const title = typeof notification.title === 'string' ? notification.title : 'Panel Notification';
    const message = typeof notification.message === 'string' ? notification.message : 'Action completed';
    const type = notification.type;
    if (type === 'success' || type === 'warning' || type === 'error' || type === 'info') {
      notify(type, title, message);
      return;
    }
    notify('info', title, message);
  }, [notify]);

  const handleEnableFeatures = useCallback((featureIds: string[]) => {
    const normalized = featureIds
      .map((featureId) => featureId.trim())
      .filter((featureId) => featureId.length > 0);

    const storageKey = 'visual-editor:enabled-features';
    let mergedFeatures = normalized;
    try {
      const raw = localStorage.getItem(storageKey);
      const existing = raw ? JSON.parse(raw) : [];
      if (Array.isArray(existing)) {
        const existingFeatures = existing.filter((item): item is string => typeof item === 'string');
        mergedFeatures = Array.from(new Set([...existingFeatures, ...normalized]));
      }
      localStorage.setItem(storageKey, JSON.stringify(mergedFeatures));
    } catch {
      localStorage.setItem(storageKey, JSON.stringify(normalized));
    }

    notify(
      'success',
      'Features Enabled',
      mergedFeatures.length > 0
        ? `Enabled ${mergedFeatures.length} feature flags for this workspace`
        : 'No new features were selected',
    );
  }, [notify]);

  const handleSaveProfession = useCallback((config: ProfessionConfiguration) => {
    const storageKey = 'visual-editor:profession-configs';
    try {
      const raw = localStorage.getItem(storageKey);
      const existing = raw ? JSON.parse(raw) : {};
      const existingRecord = typeof existing === 'object' && existing !== null
        ? (existing as Record<string, unknown>)
        : {};
      const nextRecord: Record<string, unknown> = { ...existingRecord, [config.professionId]: config };
      localStorage.setItem(storageKey, JSON.stringify(nextRecord));
      notify('success', 'Profession Saved', `${config.displayName} was saved to local workspace profiles`);
    } catch {
      notify('error', 'Save Failed', 'Could not persist profession configuration');
    }
  }, [notify]);

  const openSmartSuggestions = useCallback((componentType: string) => {
    setSuggestedComponentType(componentType);
    setShowLibrarySuggestions(true);
  }, []);

  const handleLoadProjectFromDb = useCallback(async () => {
    if (!dbConnected) {
      notify('warning', 'Database Offline', 'Database connection is not available');
      return;
    }
    const projectId = state.currentProject?.id;
    if (!projectId) {
      notify('warning', 'No Project', 'No active project id to load from database');
      return;
    }

    try {
      const loaded = await loadProjectFromDatabase(projectId);
      if (loaded && isVisualEditorProject(loaded)) {
        loadProject(loaded);
        notify('success', 'Project Loaded', `Loaded ${loaded.name} from database`);
      } else {
        notify('warning', 'Load Skipped', 'Database returned no compatible project payload');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load project';
      notify('error', 'Load Failed', message);
    }
  }, [dbConnected, isVisualEditorProject, loadProject, loadProjectFromDatabase, notify, state.currentProject?.id]);

  const handleSaveCurrentAsTemplate = useCallback(async () => {
    const projectToSave: Project = state.currentProject
      ? {
          ...state.currentProject,
          elements: state.elements,
          styleClasses: state.styleClasses,
          designTokens: state.designTokens,
        }
      : {
          id: selectedProjectForPanels.id,
          name: selectedProjectForPanels.name,
          elements: state.elements,
          styleClasses: state.styleClasses,
          designTokens: state.designTokens,
          settings: {
            width: 1200,
            height: 800,
            backgroundColor: '#ffffff',
            gridSize: 10,
            snapToGrid: true,
          },
          metadata: {
            createdBy: 'local-user',
            createdAt: new Date(),
            lastModified: new Date(),
            version: 1,
          },
          status: 'draft',
        };

    try {
      const templateLabel = `${projectToSave.name}-template`;

      createTemplate({
        name: templateLabel,
        description: projectToSave.description ?? `Template generated from ${projectToSave.name}`,
        category: 'project',
        elements: projectToSave.elements,
        tags: ['visual-editor', 'saved-template'],
      });

      if (dbConnected) {
        await saveAsTemplate(projectToSave, templateLabel);
        await trackProjectUsage(projectToSave.id, 'template_saved', { source: 'enhanced-visual-editor' });
      }

      notify(
        'success',
        'Template Saved',
        dbConnected
          ? `Saved ${projectToSave.name} as template`
          : `Saved ${projectToSave.name} locally as template`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save template';
      notify('error', 'Template Save Failed', message);
    }
  }, [
    createTemplate,
    dbConnected,
    notify,
    saveAsTemplate,
    selectedProjectForPanels.id,
    selectedProjectForPanels.name,
    state.currentProject,
    state.designTokens,
    state.elements,
    state.styleClasses,
    trackProjectUsage,
  ]);

  const handleProbeAdminData = useCallback(async () => {
    const data = await getDataFromComponent('admin-dashboard', 'selectedUser');
    if (data) {
      notify('info', 'Admin Data', 'Received admin payload response');
      return;
    }
    notify('warning', 'No Admin Data', 'No response from admin-dashboard');
  }, [getDataFromComponent, notify]);

  const triggerComponentAction = useCallback((targetComponent: string, action: string, ...args: unknown[]) => {
    const { communicationRecord, integrationRecord } = getIntegrationRecords();
    callIfFunction(integrationRecord.executeAction, action, { target: targetComponent, args }, 'high', 'enhanced-visual-editor', 'all');
    callIfFunction(communicationRecord.sendMessage, {
      from: 'enhanced-visual-editor',
      to: targetComponent,
      type: `action:${action}`,
      data: { args },
      priority: 'high',
    });
    callIfFunction(integrationRecord.emit, `${targetComponent}:action:${action}`, { args }, 'enhanced-visual-editor', 'all');
    setLastIntegrationEvent(`Triggered action ${action} on ${targetComponent}`);
  }, [callIfFunction, getIntegrationRecords]);

  const getIntegrationSnapshot = useCallback((): IntegrationStateSnapshot => ({
    projectId: selectedProjectForPanels.id,
    projectName: selectedProjectForPanels.name,
    elements: state.elements,
    activeTab: activeWorkspaceTab,
    timestamp: Date.now(),
  }), [activeWorkspaceTab, selectedProjectForPanels.id, selectedProjectForPanels.name, state.elements]);

  const syncIntegrationState = useCallback((reason: string) => {
    const snapshot = getIntegrationSnapshot();
    const { communicationRecord, integrationRecord, dataFlowRecord } = getIntegrationRecords();
    callIfFunction(
      communicationRecord.sendBroadcast,
      'visual-editor:state-synced',
      { reason, snapshot },
      'enhanced-visual-editor',
      'all',
    );
    callIfFunction(
      integrationRecord.emit,
      'visual-editor:state-synced',
      { reason, snapshot },
      'enhanced-visual-editor',
      'all',
    );
    callIfFunction(
      dataFlowRecord.syncData,
      'visual-editor:project-state',
      snapshot,
      'enhanced-visual-editor',
      'all',
    );
    setLastSyncedAt(snapshot.timestamp);
    setLastIntegrationEvent(`Synced: ${reason}`);
  }, [callIfFunction, getIntegrationRecords, getIntegrationSnapshot]);

  const handleSyncProjectChanges = useCallback((changes: Record<string, unknown>) => {
    const snapshot = getIntegrationSnapshot();
    updateAnyComponent('project-sync', 'changes', {
      projectId: snapshot.projectId,
      changes,
      timestamp: Date.now(),
    });
    syncIntegrationState('project-changes');
    setLastIntegrationEvent('Project changes synced');
  }, [getIntegrationSnapshot, syncIntegrationState, updateAnyComponent]);

  const handleOpenScrollStories = useCallback(() => {
    setShowLivePreviewPanel(true);
    updateAnyComponent('scroll-stories', 'open', { source: 'enhanced-visual-editor' });
  }, [updateAnyComponent]);

  const handleOpenAssetLibrary = useCallback(() => {
    setShowComponentLibrary(true);
    updateAnyComponent('asset-library', 'open', { source: 'enhanced-visual-editor' });
  }, [updateAnyComponent]);

  const handleOpenQualityAnalysis = useCallback(() => {
    setShowAccessibility(true);
    updateAnyComponent('quality-analysis', 'run', { source: 'enhanced-visual-editor' });
  }, [updateAnyComponent]);

  const handleOpenGoogleServices = useCallback(() => {
    setShowSettings(true);
    setShowAdvancedWorkspace(true);
    setActiveWorkspaceTab('cloud-sync');
    updateAnyComponent('google-services', 'open', { source: 'enhanced-visual-editor' });
  }, [updateAnyComponent]);

  const handleOpenNoteEditor = useCallback(() => {
    setShowCodeEditor(true);
    updateAnyComponent('note-editor', 'open', { source: 'enhanced-visual-editor' });
  }, [updateAnyComponent]);

  const handleOpenSEODashboard = useCallback(() => {
    setShowAdvancedWorkspace(true);
    setActiveWorkspaceTab('seo');
    updateAnyComponent('seo-dashboard', 'open', { source: 'enhanced-visual-editor' });
  }, [updateAnyComponent]);

  const handleLoadProjectById = useCallback(async (projectId: string) => {
    if (!dbConnected) {
      notify('warning', 'Database Offline', 'Cannot load project while database is disconnected');
      return;
    }
    try {
      const loaded = await loadProjectFromDatabase(projectId);
      if (loaded && isVisualEditorProject(loaded)) {
        loadProject(loaded);
        notify('success', 'Project Loaded', `Loaded ${loaded.name}`);
        syncIntegrationState('manual-project-load');
      } else {
        notify('warning', 'Project Not Found', `No compatible project for id ${projectId}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load project';
      notify('error', 'Load Failed', message);
    }
  }, [dbConnected, isVisualEditorProject, loadProject, loadProjectFromDatabase, notify, syncIntegrationState]);

  const handleSaveAsTemplateByName = useCallback(async (name: string) => {
    setTemplateName(name);
    const projectToSave: Project = state.currentProject
      ? {
          ...state.currentProject,
          elements: state.elements,
          styleClasses: state.styleClasses,
          designTokens: state.designTokens,
        }
      : {
          id: selectedProjectForPanels.id,
          name: selectedProjectForPanels.name,
          elements: state.elements,
          styleClasses: state.styleClasses,
          designTokens: state.designTokens,
          settings: {
            width: 1200,
            height: 800,
            backgroundColor: '#ffffff',
            gridSize: 10,
            snapToGrid: true,
          },
          metadata: {
            createdBy: 'local-user',
            createdAt: new Date(),
            lastModified: new Date(),
            version: 1,
          },
          status: 'draft',
        };

    try {
      createTemplate({
        name,
        description: projectToSave.description ?? `Template generated from ${projectToSave.name}`,
        category: 'project',
        elements: projectToSave.elements,
        tags: ['visual-editor', 'named-template'],
      });

      if (dbConnected) {
        await saveAsTemplate(projectToSave, name);
        await trackProjectUsage(projectToSave.id, 'template_saved', { source: 'enhanced-visual-editor', templateName: name });
      }

      notify(
        'success',
        'Template Saved',
        dbConnected ? `Saved template ${name}` : `Saved template ${name} locally`,
      );
      syncIntegrationState('manual-template-save');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save template';
      notify('error', 'Template Save Failed', message);
    }
  }, [
    createTemplate,
    dbConnected,
    notify,
    saveAsTemplate,
    selectedProjectForPanels.id,
    selectedProjectForPanels.name,
    state.currentProject,
    state.designTokens,
    state.elements,
    state.styleClasses,
    syncIntegrationState,
    trackProjectUsage,
  ]);

  const handleBroadcastCursorPosition = useCallback((position: { x: number; y: number }) => {
    const { communicationRecord } = getIntegrationRecords();
    callIfFunction(
      communicationRecord.sendBroadcast,
      'visual-editor:cursor:update',
      {
        userId: 'local-user',
        cursor: position,
        timestamp: Date.now(),
      },
      'enhanced-visual-editor',
      'all',
    );
    setLastIntegrationEvent(`Broadcast cursor (${position.x}, ${position.y})`);
  }, [callIfFunction, getIntegrationRecords]);

  useEffect(() => {
    const { communicationRecord, dataFlowRecord } = getIntegrationRecords();
    callIfFunction(
      communicationRecord.registerComponent,
      'enhanced-visual-editor',
      'visual-editor',
      ['data:read', 'data:write', 'event:emit', 'event:listen', 'action:execute', 'ui:update'],
    );
    callIfFunction(
      dataFlowRecord.registerNode,
      'source',
      'enhanced-visual-editor',
      'visual-editor:project-state',
      (data: Record<string, unknown>) => ({ ...data, lastUpdated: Date.now() }),
    );
    setLastIntegrationEvent('Registered with integration system');

    const onMessage = communicationRecord.onMessage;
    let unsubscribeResult: unknown;
    if (typeof onMessage === 'function') {
      unsubscribeResult = (onMessage as (handler: (message: IntegrationMessage) => void) => unknown)((message) => {
        const type = typeof message.type === 'string' ? message.type : '';
        const dataRecord = toRecord(message.data);
        if (!dataRecord) {
          return;
        }

        if (type === 'project:selected' && isVisualEditorProject(dataRecord)) {
          loadProject(dataRecord);
          notify('info', 'Project Selected', `Loaded ${dataRecord.name}`);
          setLastIntegrationEvent('Loaded project:selected event');
          return;
        }

        if (type === 'data:sync') {
          const dataKey = dataRecord.dataKey;
          const payload = dataRecord.data;
          if (dataKey === 'visual-editor:project' && isVisualEditorProject(payload)) {
            loadProject(payload);
            notify('info', 'Project Synced', `Loaded ${payload.name} from synced payload`);
            setLastIntegrationEvent('Loaded data:sync payload');
            return;
          }
        }

        if (type === 'new-components-available') {
          setShowComponentLibrary(true);
          notify('success', 'New Components', 'Generated components are ready in library');
          setLastIntegrationEvent('Received new-components-available');
          return;
        }

        if (type === 'code-generation:complete') {
          notify('success', 'Code Generation', 'Code generation completed and synced');
          setLastIntegrationEvent('Received code-generation:complete');
        }
      });
    }

    return () => {
      if (typeof unsubscribeResult === 'function') {
        (unsubscribeResult as () => void)();
      }
      callIfFunction(communicationRecord.unregisterComponent, 'enhanced-visual-editor');
      setLastIntegrationEvent('Unregistered from integration system');
    };
  }, [
    callIfFunction,
    getIntegrationRecords,
    isVisualEditorProject,
    loadProject,
    notify,
    toRecord,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      syncIntegrationState('state-change');
    }, 250);
    return () => clearTimeout(timer);
  }, [activeWorkspaceTab, state.elements, syncIntegrationState]);

  useEffect(() => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    if (!state.settings.autoSave) {
      autoSaveIntervalRef.current = null;
      return undefined;
    }

    autoSaveIntervalRef.current = setInterval(() => {
      if (!state.currentProject) {
        return;
      }

      syncIntegrationState('autosave');

      if (dbConnected) {
        trackProjectUsage(state.currentProject.id, 'autosave', {
          source: 'enhanced-visual-editor',
          elementCount: state.elements.length,
        }).catch(() => {
          notify('warning', 'Autosave Metrics', 'Project saved but usage metric failed');
        });
      }
    }, state.settings.autoSaveInterval);

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
    };
  }, [
    dbConnected,
    notify,
    state.currentProject,
    state.elements.length,
    state.settings.autoSave,
    state.settings.autoSaveInterval,
    syncIntegrationState,
    trackProjectUsage,
  ]);

  const renderAdvancedWorkspace = useCallback(() => {
    switch (activeWorkspaceTab) {
      case 'templates':
        return (
          <TemplateDashboard
            onTemplatesClick={() => workspaceAction('Templates', 'Open templates')}
            onCategoriesClick={() => workspaceAction('Templates', 'Open categories')}
            onSearchClick={() => workspaceAction('Templates', 'Open search')}
            onPreviewClick={() => workspaceAction('Templates', 'Open preview')}
          />
        );
      case 'export-presets':
        return (
          <ExportPresetsDashboard
            onPresetsClick={() => workspaceAction('Export Presets', 'Open presets')}
            onPlatformsClick={() => workspaceAction('Export Presets', 'Open platforms')}
            onFormatsClick={() => workspaceAction('Export Presets', 'Open formats')}
            onPreviewClick={() => workspaceAction('Export Presets', 'Open preview')}
          />
        );
      case 'cloud-sync':
        return (
          <CloudSyncDashboard
            onProvidersClick={() => workspaceAction('Cloud Sync', 'Open providers')}
            onBackupsClick={() => workspaceAction('Cloud Sync', 'Open backups')}
            onSyncClick={() => workspaceAction('Cloud Sync', 'Start sync')}
            onConflictsClick={() => workspaceAction('Cloud Sync', 'Open conflicts')}
          />
        );
      case 'team-collaboration':
        return (
          <TeamCollaborationDashboard
            onSettingsClick={() => workspaceAction('Team Collaboration', 'Open settings')}
            onMembersClick={() => workspaceAction('Team Collaboration', 'Open members')}
            onWorkloadClick={() => workspaceAction('Team Collaboration', 'Open workload')}
            onSessionsClick={() => workspaceAction('Team Collaboration', 'Open sessions')}
            onMobileClick={() => workspaceAction('Team Collaboration', 'Open mobile tools')}
            onAnalyticsClick={() => workspaceAction('Team Collaboration', 'Open analytics')}
          />
        );
      case 'plugins':
        return (
          <PluginDashboard
            onHooksClick={() => workspaceAction('Plugins', 'Open hooks')}
            onComponentsClick={() => workspaceAction('Plugins', 'Open components')}
            onUtilitiesClick={() => workspaceAction('Plugins', 'Open utilities')}
            onThemesClick={() => workspaceAction('Plugins', 'Open themes')}
            onIntegrationsClick={() => workspaceAction('Plugins', 'Open integrations')}
          />
        );
      case 'animations':
        return (
          <AnimationDashboard
            onAnimationsClick={() => workspaceAction('Animations', 'Open animation list')}
            onTimelineClick={() => workspaceAction('Animations', 'Open timeline')}
            onKeyframesClick={() => workspaceAction('Animations', 'Open keyframes')}
            onPreviewClick={() => workspaceAction('Animations', 'Open preview')}
          />
        );
      case 'component-library':
        return (
          <ComponentLibraryDashboard
            onComponentsClick={() => workspaceAction('Component Library', 'Open components')}
            onCategoriesClick={() => workspaceAction('Component Library', 'Open categories')}
            onTagsClick={() => workspaceAction('Component Library', 'Open tags')}
            onDocumentationClick={() => workspaceAction('Component Library', 'Open docs')}
          />
        );
      case 'design-system':
        return (
          <DesignSystemDashboard
            onTokensClick={() => workspaceAction('Design System', 'Open tokens')}
            onGuidelinesClick={() => workspaceAction('Design System', 'Open guidelines')}
            onThemesClick={() => workspaceAction('Design System', 'Open themes')}
            onDocumentationClick={() => workspaceAction('Design System', 'Open docs')}
          />
        );
      case 'analytics':
        return (
          <AnalyticsDashboard
            onSettingsClick={() => workspaceAction('Analytics', 'Open settings')}
            onExportClick={() => workspaceAction('Analytics', 'Export report')}
          />
        );
      case 'audit':
        return (
          <AuditDashboard
            onSettingsClick={() => workspaceAction('Audit', 'Open settings')}
            onManagementClick={() => workspaceAction('Audit', 'Open management')}
            onMonitoringClick={() => workspaceAction('Audit', 'Open monitoring')}
            onEventsClick={() => workspaceAction('Audit', 'Open events')}
            onStatsClick={() => workspaceAction('Audit', 'Open stats')}
            onAlertsClick={() => workspaceAction('Audit', 'Open alerts')}
            onExportClick={() => workspaceAction('Audit', 'Export logs')}
          />
        );
      case 'monitoring':
        return (
          <MonitoringDashboard
            onSettingsClick={() => workspaceAction('Monitoring', 'Open settings')}
            onAlertsClick={() => workspaceAction('Monitoring', 'Open alerts')}
            onMetricsClick={() => workspaceAction('Monitoring', 'Open metrics')}
            onPerformanceClick={() => workspaceAction('Monitoring', 'Open performance')}
            onCachingClick={() => workspaceAction('Monitoring', 'Open cache metrics')}
            onSystemClick={() => workspaceAction('Monitoring', 'Open system')}
          />
        );
      case 'system-management':
        return (
          <SystemManagementDashboard
            onSettingsClick={() => workspaceAction('System Management', 'Open settings')}
            onAlertsClick={() => workspaceAction('System Management', 'Open alerts')}
            onMetricsClick={() => workspaceAction('System Management', 'Open metrics')}
            onScalingClick={() => workspaceAction('System Management', 'Open scaling')}
            onBackupClick={() => workspaceAction('System Management', 'Open backups')}
            onRecoveryClick={() => workspaceAction('System Management', 'Open recovery')}
          />
        );
      case 'ml-optimization':
        return (
          <MLOptimizationDashboard
            onSettingsClick={() => workspaceAction('ML Optimization', 'Open settings')}
            onModelsClick={() => workspaceAction('ML Optimization', 'Open models')}
            onPredictionsClick={() => workspaceAction('ML Optimization', 'Open predictions')}
            onOptimizationsClick={() => workspaceAction('ML Optimization', 'Open optimizations')}
            onAnalyticsClick={() => workspaceAction('ML Optimization', 'Open analytics')}
            onTrainingClick={() => workspaceAction('ML Optimization', 'Start training')}
          />
        );
      case 'advanced-analytics':
        return (
          <AdvancedAnalyticsDashboard
            onSettingsClick={() => workspaceAction('Advanced Analytics', 'Open settings')}
            onHeatmapsClick={() => workspaceAction('Advanced Analytics', 'Open heatmaps')}
            onBehaviorClick={() => workspaceAction('Advanced Analytics', 'Open behavior')}
            onFunnelsClick={() => workspaceAction('Advanced Analytics', 'Open funnels')}
            onTestsClick={() => workspaceAction('Advanced Analytics', 'Open tests')}
            onInsightsClick={() => workspaceAction('Advanced Analytics', 'Open insights')}
          />
        );
      case 'ai-assistance':
        return (
          <AIAssistanceDashboard
            onSettingsClick={() => workspaceAction('AI Assistance', 'Open settings')}
            onSuggestionsClick={() => workspaceAction('AI Assistance', 'Open suggestions')}
            onConversationsClick={() => workspaceAction('AI Assistance', 'Open conversations')}
            onCodeGenerationClick={() => workspaceAction('AI Assistance', 'Generate code')}
            onDesignSuggestionsClick={() => workspaceAction('AI Assistance', 'Generate design suggestions')}
            onWorkflowsClick={() => workspaceAction('AI Assistance', 'Open workflows')}
          />
        );
      case 'templates-presets':
      case 'template-presets':
        return (
          <TemplatePresetDashboard
            onSettingsClick={() => workspaceAction('Template Presets', 'Open settings')}
            onTemplatesClick={() => workspaceAction('Template Presets', 'Open templates')}
            onPresetsClick={() => workspaceAction('Template Presets', 'Open presets')}
            onCategoriesClick={() => workspaceAction('Template Presets', 'Open categories')}
            onImportClick={() => workspaceAction('Template Presets', 'Import preset')}
            onExportClick={() => workspaceAction('Template Presets', 'Export preset')}
          />
        );
      case 'client-communication':
        return (
          <ClientCommunicationDashboard
            onSettingsClick={() => workspaceAction('Client Communication', 'Open settings')}
            onTemplatesClick={() => workspaceAction('Client Communication', 'Open templates')}
            onSegmentsClick={() => workspaceAction('Client Communication', 'Open segments')}
            onAutomationClick={() => workspaceAction('Client Communication', 'Open automation')}
            onAnalyticsClick={() => workspaceAction('Client Communication', 'Open analytics')}
            onDeadlinesClick={() => workspaceAction('Client Communication', 'Open deadlines')}
          />
        );
      case 'revenue-optimization':
        return (
          <RevenueOptimizationDashboard
            onSettingsClick={() => workspaceAction('Revenue Optimization', 'Open settings')}
            onPricingClick={() => workspaceAction('Revenue Optimization', 'Open pricing')}
            onUpsellingClick={() => workspaceAction('Revenue Optimization', 'Open upselling')}
            onForecastingClick={() => workspaceAction('Revenue Optimization', 'Open forecasting')}
            onAnalysisClick={() => workspaceAction('Revenue Optimization', 'Open analysis')}
            onMarketRatesClick={() => workspaceAction('Revenue Optimization', 'Open market rates')}
          />
        );
      case 'seo':
        return (
          <SEODashboard
            onCrawlClick={() => workspaceAction('SEO', 'Start crawl')}
            onAnalyzeClick={() => workspaceAction('SEO', 'Open analysis')}
            onKeywordsClick={() => workspaceAction('SEO', 'Open keywords')}
            onCompetitorsClick={() => workspaceAction('SEO', 'Open competitors')}
            onSchemaClick={() => workspaceAction('SEO', 'Open schema')}
            onReportsClick={() => workspaceAction('SEO', 'Open reports')}
            onSettingsClick={() => workspaceAction('SEO', 'Open settings')}
          />
        );
      case 'modals':
        return (
          <ModalCreator
            selectedProject={selectedProjectForPanels}
            onProjectUpdate={handlePanelProjectUpdate}
            onNotificationCreate={handlePanelNotification}
          />
        );
      case 'dashboard-components':
        return (
          <DashboardComponentManager
            selectedProject={selectedProjectForPanels}
            onProjectUpdate={handlePanelProjectUpdate}
            onNotificationCreate={handlePanelNotification}
            profession="admin"
          />
        );
      case 'toasts':
        return <ToastDesigner />;
      case 'branding':
        return (
          <BrandingWorkflowPanel
            onBrandingApplied={(branding) => {
              const appliedName = typeof branding.name === 'string' ? branding.name : 'custom branding';
              notify('success', 'Branding Applied', `Applied ${appliedName}`);
            }}
            onNotification={(notification) => {
              const level = notification.type;
              if (level === 'success' || level === 'warning' || level === 'error' || level === 'info') {
                notify(level, notification.title, notification.message);
                return;
              }
              notify('info', notification.title, notification.message);
            }}
          />
        );
      case 'landing-settings':
        return <LandingSettingsPanel />;
      case 'showcase-publisher':
        return <ShowcasePublisherPanel userId="local-user" />;
      case 'theming-admin':
        return <ThemingAdminPanel />;
      case 'integration-tools':
        return (
          <Box sx={{ p: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Integration Tools
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small"
                label="Project Id"
                value={integrationProjectId}
                onChange={(event) => setIntegrationProjectId(event.target.value)}
              />
              <Button variant="outlined" onClick={() => void handleLoadProjectById(integrationProjectId)}>
                Load Project
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small"
                label="Template Name"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
              />
              <Button variant="outlined" onClick={() => void handleSaveAsTemplateByName(templateName)}>
                Save Template
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                select
                size="small"
                label="Saved Template"
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                sx={{ minWidth: 220 }}
              >
                {state.templates.length === 0 && (
                  <MenuItem value="" disabled>
                    No saved templates
                  </MenuItem>
                )}
                {state.templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                disabled={!selectedTemplateId}
                onClick={() => {
                  loadTemplate(selectedTemplateId);
                  notify('success', 'Template Loaded', 'Loaded selected template into the editor');
                  syncIntegrationState('manual-template-load');
                }}
              >
                Load Template
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap">
              <Button variant="outlined" onClick={() => updateAnyComponent('admin-dashboard', 'refresh', { source: 'enhanced-visual-editor' })}>
                Refresh Admin
              </Button>
              <Button variant="outlined" onClick={() => updateAnyComponent('analytics-panel', 'track', { event: 'element_created', count: state.elements.length })}>
                Track Analytics
              </Button>
              <Button variant="outlined" onClick={() => triggerComponentAction('notification-widget', 'show', { message: 'Project updated', type: 'success' })}>
                Notify
              </Button>
              <Button variant="outlined" onClick={() => updateAnyComponent('client-portal', 'updateProject', { projectId: selectedProjectForPanels.id })}>
                Sync Client Portal
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap">
              <Button variant="outlined" onClick={() => void handleProbeAdminData()}>
                Probe Admin Data
              </Button>
              <Button variant="outlined" onClick={() => handleBroadcastCursorPosition({ x: 100, y: 200 })}>
                Broadcast Cursor
              </Button>
              <Button variant="outlined" onClick={handleOpenSEODashboard}>
                Open SEO
              </Button>
              <Button variant="outlined" onClick={handleOpenQualityAnalysis}>
                Quality Analysis
              </Button>
              <Button variant="outlined" onClick={handleOpenAssetLibrary}>
                Open Asset Library
              </Button>
              <Button variant="outlined" onClick={handleOpenScrollStories}>
                Open Scroll Stories
              </Button>
              <Button variant="outlined" onClick={handleOpenGoogleServices}>
                Open Google Services
              </Button>
              <Button variant="outlined" onClick={handleOpenNoteEditor}>
                Open Note Editor
              </Button>
            </Stack>
            <Button
              variant="contained"
              onClick={() => handleSyncProjectChanges({ elements: state.elements, activeTab: activeWorkspaceTab })}
            >
              Sync Project Changes
            </Button>
          </Box>
        );
      default:
        return null;
    }
  }, [
    activeWorkspaceTab,
    handleBroadcastCursorPosition,
    handleLoadProjectById,
    handleOpenAssetLibrary,
    handleOpenGoogleServices,
    handleOpenNoteEditor,
    handleOpenQualityAnalysis,
    handleOpenScrollStories,
    handleOpenSEODashboard,
    handlePanelNotification,
    handlePanelProjectUpdate,
    notify,
    integrationProjectId,
    state.elements,
    selectedProjectForPanels,
    templateName,
    triggerComponentAction,
    handleProbeAdminData,
    handleSaveAsTemplateByName,
    handleSyncProjectChanges,
    updateAnyComponent,
    workspaceAction,
  ]);

  const handleCommandExecute = useCallback((commandId: string) => {
    switch (commandId) {
      case 'save':
        saveProject();
        break;
      case 'export': setShowExporter(true);
        break;
      case 'accessibility-check': setShowAccessibility(true);
        break;
      case 'format-code': {
        // Re-generate code from current elements to get a clean formatted version
        const freshCode = generateCodeFromElements(state.elements);
        setGeneratedCode(freshCode);
        break;
      }
      case 'refresh-preview': setShowLivePreview(false);
        setTimeout(() => setShowLivePreview(true), 100);
        break;
      case 'export-html': setExportFormat('html');
        setShowExporter(true);
        break;
      case 'export-react': setExportFormat('react');
        setShowExporter(true);
        break;
      case 'export-vue': setExportFormat('vue');
        setShowExporter(true);
        break;
      case 'toggle-format': 
        setExportFormat(prev => {
          if (prev === 'html') return 'react';
          if (prev === 'react') return 'vue';
          return 'html';
        });
        break;
      case 'toggle-code-editor': setShowCodeEditor(prev => !prev);
        break;
      case 'toggle-preview': setShowLivePreviewPanel(prev => !prev);
        break;
      case 'rotate-device':
        if (state.currentBreakpoint !== 'desktop') {
          setCurrentOrientation(state.currentOrientation === 'portrait' ? 'landscape' : 'portrait');
        }
        break;
      case 'toggle-settings': setShowSettings(prev => !prev);
        setShowAdvancedWorkspace(true);
        setActiveWorkspaceTab('system-management');
        break;
      default: break;
    }
  }, [
    generateCodeFromElements,
    saveProject,
    setCurrentOrientation,
    state.currentBreakpoint,
    state.currentOrientation,
    state.elements,
  ]);

  const handleUseComponent = useCallback((component: LibraryComponent) => {
    const snapshotInstance = instantiateSnapshotComponent(
      component,
      state.styleClasses,
      state.designTokens,
      state.elements.length,
    );

    if (snapshotInstance) {
      dispatch({ type: 'SET_STYLE_CLASSES', payload: snapshotInstance.styleClasses });
      dispatch({ type: 'SET_DESIGN_TOKENS', payload: snapshotInstance.designTokens });
      setElements([...state.elements, ...snapshotInstance.elements]);
      selectElements(snapshotInstance.rootIds);
      setShowComponentLibrary(false);
      return;
    }

    dispatch({
      type: 'ADD_ELEMENT',
      payload: {
        id: createEditorElementId(),
        type: toElementType(component.category ?? 'container'),
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        styles: {},
        props: { ...(component.props ?? {}) },
        name: component.name,
      },
    });
    setShowComponentLibrary(false);
  }, [dispatch, selectElements, setElements, state.designTokens, state.elements, state.styleClasses]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowShortcuts(true);
      }

      // Cmd/Ctrl + E for export
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setShowExporter(true);
      }

      // Cmd/Ctrl + Shift + A for accessibility
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        setShowAccessibility(true);
      }

      // Cmd/Ctrl + Shift + C for unified code studio
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        setShowUnifiedStudio(!showUnifiedStudio);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUnifiedStudio]);

  const selectedElementCount = state.selectedElements.length > 0
    ? state.selectedElements.length
    : state.selectedElement
      ? 1
      : 0;
  const deviceProfile = resolveEditorDeviceProfile(state.currentBreakpoint, state.currentOrientation);
  const viewport = getProjectViewport(
    state.currentProject,
    state.currentBreakpoint,
    state.currentOrientation,
  );
  const displayViewport = getDisplayViewport(state.currentBreakpoint, state.currentOrientation);
  const browserViewport = resolveEditorBrowserViewportMetrics(
    state.currentBreakpoint,
    state.currentOrientation,
  );
  const projectWidth = viewport.width;
  const projectHeight = viewport.height;
  const isPreviewMode = showLivePreview;

  const addCanvasElement = useCallback((
    componentType: string,
    position?: { x: number; y: number },
    overrides?: Partial<EditorElement>,
  ) => {
    const elementType = toElementType(componentType);
    const elementId = overrides?.id ?? `component-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const canvasCenterX = Math.max(48, Math.round(projectWidth * 0.14));
    const canvasCenterY = Math.max(88, Math.round(projectHeight * 0.16)) + state.elements.length * 20;

    const presets: Record<EditorElement['type'], Omit<EditorElement, 'id'>> = {
      text: {
        type: 'text',
        x: canvasCenterX,
        y: canvasCenterY,
        width: 520,
        height: 92,
        styles: {
          color: '#2b2016',
          fontSize: '52px',
          fontWeight: '800',
          lineHeight: '1.05',
          fontFamily: '"IBM Plex Sans", sans-serif',
        },
        props: { text: 'Write a bold headline' },
      },
      button: {
        type: 'button',
        x: canvasCenterX,
        y: canvasCenterY,
        width: 220,
        height: 56,
        styles: {
          backgroundColor: '#ff6b35',
          color: '#ffffff',
          borderRadius: '18px',
          fontSize: '16px',
          fontWeight: '700',
          boxShadow: '0 16px 30px rgba(255,107,53,0.18)',
        },
        props: { text: 'Primary action' },
      },
      image: {
        type: 'image',
        x: canvasCenterX,
        y: canvasCenterY,
        width: 360,
        height: 240,
        styles: {
          backgroundColor: '#f2e6d8',
          borderRadius: '24px',
          boxShadow: '0 24px 40px rgba(64, 42, 18, 0.12)',
        },
        props: { src: '', alt: 'Visual placeholder', text: 'Add image' },
      },
      card: {
        type: 'card',
        x: canvasCenterX,
        y: canvasCenterY,
        width: 320,
        height: 220,
        styles: {
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 24px 44px rgba(64, 42, 18, 0.1)',
          padding: '28px',
        },
        props: { text: 'Feature card\n\nUse this for highlights, pricing or benefits.' },
      },
      container: {
        type: 'container',
        x: 72,
        y: 72,
        width: Math.min(projectWidth - 144, 720),
        height: 320,
        styles: {
          backgroundColor: '#1f1812',
          borderRadius: '32px',
          boxShadow: '0 28px 52px rgba(31,24,18,0.18)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          gap: '24px',
          padding: '28px',
        },
        props: { text: '' },
      },
      grid: {
        type: 'grid',
        x: canvasCenterX,
        y: canvasCenterY,
        width: 540,
        height: 280,
        styles: {
          backgroundColor: '#ffffff',
          borderRadius: '28px',
          boxShadow: '0 18px 36px rgba(64, 42, 18, 0.08)',
          display: 'grid',
          gap: '24px',
          padding: '24px',
          alignItems: 'stretch',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        },
        props: { text: 'Grid layout' },
      },
      audio: {
        type: 'audio',
        x: canvasCenterX,
        y: canvasCenterY,
        width: 320,
        height: 100,
        styles: {
          backgroundColor: '#ffffff',
          borderRadius: '22px',
          boxShadow: '0 18px 36px rgba(64, 42, 18, 0.08)',
        },
        props: { text: 'Audio player' },
      },
      video: {
        type: 'video',
        x: canvasCenterX,
        y: canvasCenterY,
        width: 420,
        height: 240,
        styles: {
          backgroundColor: '#171717',
          borderRadius: '24px',
          boxShadow: '0 18px 36px rgba(0,0,0,0.2)',
        },
        props: { text: 'Video block' },
      },
    };

    const preset = presets[elementType] ?? presets.container;
    const payload: EditorElement = {
      ...preset,
      ...overrides,
      id: elementId,
      type: elementType,
      x: position?.x ?? overrides?.x ?? preset.x,
      y: position?.y ?? overrides?.y ?? preset.y,
      width: overrides?.width ?? preset.width,
      height: overrides?.height ?? preset.height,
      styles: {
        ...preset.styles,
        ...overrides?.styles,
      },
      props: {
        ...preset.props,
        ...(overrides?.props ?? {}),
      },
    };

    dispatch({ type: 'ADD_ELEMENT', payload });
    dispatch({ type: 'SET_SELECTED_ELEMENT', payload: elementId });

    updateAnyComponent('timeline', 'element-added', {
      id: elementId,
      componentType: elementType,
      position: { x: payload.x, y: payload.y },
      timestamp: Date.now(),
    });
  }, [dispatch, projectHeight, projectWidth, state.elements.length, updateAnyComponent]);

  const addHeroStarter = useCallback(() => {
    const heroContainerId = `component-${Date.now()}-hero`;
    addCanvasElement('container', { x: 72, y: 72 }, {
      id: heroContainerId,
      name: 'Hero Section',
      width: Math.min(projectWidth - 144, 860),
      height: 360,
      styles: {
        backgroundColor: '#1f1812',
        borderRadius: '36px',
        boxShadow: '0 32px 60px rgba(31,24,18,0.2)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: '20px',
        padding: '48px',
      },
    });
    addCanvasElement('text', { x: 44, y: 56 }, {
      parent: heroContainerId,
      name: 'Hero Heading',
      width: 540,
      height: 120,
      styles: {
        color: '#ffffff',
        fontSize: '58px',
        fontWeight: '800',
        lineHeight: '1.02',
      },
      props: { text: 'Build a cinematic landing page' },
    });
    addCanvasElement('text', { x: 48, y: 188 }, {
      parent: heroContainerId,
      name: 'Hero Subcopy',
      width: 420,
      height: 80,
      styles: {
        color: 'rgba(255,255,255,0.78)',
        fontSize: '18px',
        fontWeight: '400',
        lineHeight: '1.6',
      },
      props: { text: 'Start with a strong headline, a concise pitch and one clear action.' },
    });
    addCanvasElement('button', { x: 48, y: 252 }, {
      parent: heroContainerId,
      name: 'Hero CTA',
      props: { text: 'Start free trial' },
    });
  }, [addCanvasElement, projectWidth]);

  const addFeatureGridStarter = useCallback(() => {
    const gridContainerId = `component-${Date.now()}-grid`;
    addCanvasElement('grid', { x: 72, y: 72 }, {
      id: gridContainerId,
      name: 'Feature Grid',
      width: Math.min(projectWidth - 144, 980),
      height: 320,
      styles: {
        backgroundColor: '#fffaf4',
        borderRadius: '32px',
        boxShadow: '0 24px 54px rgba(64,42,18,0.12)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '22px',
        padding: '28px',
        alignItems: 'stretch',
      },
    });

    ['Fast setup', 'Responsive by default', 'Production ready'].forEach((title, index) => {
      addCanvasElement('card', { x: 0, y: 0 }, {
        parent: gridContainerId,
        name: `Feature Card ${index + 1}`,
        width: 220,
        height: 220,
        styles: {
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 18px 34px rgba(64, 42, 18, 0.08)',
          padding: '20px',
        },
        props: {
          text: `${title}\n\nUse structured sections, clean spacing and reusable patterns to ship pages faster.`,
        },
      });
    });
  }, [addCanvasElement, projectWidth]);

  return (
    <Box
      data-testid="visual-editor-shell"
      sx={{
        '--ve-shell-bg': '#f4ebdd',
        '--ve-panel-bg': 'rgba(255,255,255,0.82)',
        '--ve-panel-bg-strong': 'rgba(255,255,255,0.94)',
        '--ve-panel-border': 'rgba(113, 87, 59, 0.14)',
        '--ve-panel-shadow': '0 24px 60px rgba(66, 42, 17, 0.12)',
        '--ve-accent': '#ff6b35',
        '--ve-accent-soft': 'rgba(255, 107, 53, 0.12)',
        '--ve-deep': '#221c16',
        '--ve-ink': '#2b2016',
        '--ve-muted': '#6f6358',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        px: { xs: 1, md: 2 },
        py: { xs: 1, md: 1.5 },
        gap: 1.5,
        bgcolor: 'var(--ve-shell-bg)',
        background: `
          radial-gradient(circle at top left, rgba(255, 183, 94, 0.28), transparent 26%),
          radial-gradient(circle at top right, rgba(249, 220, 165, 0.24), transparent 22%),
          linear-gradient(180deg, #f8f2e8 0%, #f1e9db 100%)
        `,
      }}
    >
      {/* Top Toolbar */}
      <EnhancedTopToolbar
        previewOpen={showLivePreview}
        onTogglePreview={() => setShowLivePreview((prev) => !prev)}
      />

      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', lg: 'center' },
          justifyContent: 'space-between',
          gap: 1,
          px: { xs: 0.5, md: 1 },
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip
            label={`${state.elements.length} elementer`}
            sx={{
              bgcolor: 'rgba(255,255,255,0.72)',
              color: 'var(--ve-ink)',
              fontWeight: 600,
              border: '1px solid var(--ve-panel-border)',
            }}
          />
          <Chip
            label={`${Math.round(state.zoom * 100)}% zoom`}
            sx={{
              bgcolor: 'rgba(255,255,255,0.62)',
              color: 'var(--ve-muted)',
              border: '1px solid rgba(113, 87, 59, 0.1)',
            }}
          />
          <Chip
            label={`${deviceProfile.model} • Web ${projectWidth} × ${projectHeight}`}
            sx={{
              bgcolor: 'rgba(255,255,255,0.62)',
              color: 'var(--ve-muted)',
              border: '1px solid rgba(113, 87, 59, 0.1)',
            }}
          />
          <Chip
            label={`Display ${displayViewport.width} × ${displayViewport.height} pt`}
            sx={{
              bgcolor: 'rgba(255,255,255,0.62)',
              color: 'var(--ve-muted)',
              border: '1px solid rgba(113, 87, 59, 0.1)',
            }}
          />
          <Chip
            label={`Browser UI ${browserViewport.topBarHeight + browserViewport.bottomBarHeight} pt`}
            sx={{
              bgcolor: 'rgba(255,255,255,0.62)',
              color: 'var(--ve-muted)',
              border: '1px solid rgba(113, 87, 59, 0.1)',
            }}
          />
          <Chip
            label={`${deviceProfile.viewport.nativeWidth} × ${deviceProfile.viewport.nativeHeight} px • @${deviceProfile.viewport.devicePixelRatio}x`}
            sx={{
              bgcolor: 'rgba(255,255,255,0.62)',
              color: 'var(--ve-muted)',
              border: '1px solid rgba(113, 87, 59, 0.1)',
            }}
          />
        </Stack>

        <ToggleButtonGroup
          exclusive
          size="small"
          value={state.currentBreakpoint}
          onChange={(_, breakpoint) => {
            if (breakpoint) {
              setCurrentBreakpoint(breakpoint);
            }
          }}
          aria-label="Editor breakpoint switcher"
          sx={{
            bgcolor: 'rgba(255,255,255,0.56)',
            borderRadius: 999,
            '& .MuiToggleButton-root': {
              border: 0,
              px: 1.5,
              textTransform: 'none',
              color: 'var(--ve-muted)',
              fontWeight: 700,
            },
            '& .Mui-selected': {
              bgcolor: 'rgba(255,107,53,0.14) !important',
              color: 'var(--ve-accent) !important',
            },
          }}
        >
          {EDITOR_BREAKPOINTS.map((breakpoint) => (
            <ToggleButton
              key={breakpoint.id}
              value={breakpoint.id}
              aria-label={`${breakpoint.label} breakpoint`}
            >
              {breakpoint.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {state.currentBreakpoint !== 'desktop' && (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={state.currentOrientation}
            onChange={(_, orientation) => {
              if (orientation) {
                setCurrentOrientation(orientation);
              }
            }}
            aria-label="Editor orientation switcher"
            sx={{
              bgcolor: 'rgba(255,255,255,0.56)',
              borderRadius: 999,
              '& .MuiToggleButton-root': {
                border: 0,
                px: 1.25,
                textTransform: 'none',
                color: 'var(--ve-muted)',
                fontWeight: 700,
                gap: 0.75,
              },
              '& .Mui-selected': {
                bgcolor: 'rgba(255,107,53,0.14) !important',
                color: 'var(--ve-accent) !important',
              },
            }}
          >
            <ToggleButton value="portrait" aria-label="Portrait orientation">
              <StayCurrentPortrait fontSize="small" />
              Portrait
            </ToggleButton>
            <ToggleButton value="landscape" aria-label="Landscape orientation">
              <StayCurrentLandscape fontSize="small" />
              Landscape
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        <Typography variant="body2" sx={{ color: 'var(--ve-muted)', px: 0.5 }}>
          {isPreviewMode
            ? 'Preview mode aktiv. Sidepanelene er skjult for et renere lerret.'
            : selectedElementCount > 0
            ? `${selectedElementCount} valgt${selectedElementCount > 1 ? 'e' : ''}`
            : 'Velg et element for å redigere egenskaper'}
        </Typography>
      </Box>

      {/* Main Editor Area */}
      <Box
        data-testid="visual-editor-main-area"
        sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', gap: isPreviewMode ? 0 : 2 }}
      >
        {/* Left Sidebar - Component Library */}
        {!isPreviewMode && (
          <VisualEditorSidebar
            onClientSelect={(clientId) => {
              dispatch({ type: 'ADD_NOTIFICATION', payload: { id: `notif-${Date.now()}`, type: 'info', title: 'Client Selected', message: `Client selected: ${clientId}`, timestamp: new Date(), read: false } });
            }}
            onComponentDrag={(componentType) => {
              dispatch({ type: 'ADD_NOTIFICATION', payload: { id: `notif-${Date.now()}`, type: 'info', title: 'Component Drag', message: `Dragging: ${componentType}`, timestamp: new Date(), read: false } });
              updateAnyComponent('component-library', 'drag-start', { componentType, timestamp: Date.now() });
            }}
            onComponentAdd={(componentType, position) => {
              addCanvasElement(componentType, position);
            }}
            searchQuery={sidebarSearch}
            onSearchChange={setSidebarSearch}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            onOpenAssetLibrary={handleOpenAssetLibrary}
            onOpenScrollStories={handleOpenScrollStories}
            onOpenGoogleServices={handleOpenGoogleServices}
            onOpenNoteEditor={handleOpenNoteEditor}
            onOpenSettings={handleOpenGoogleServices}
          />
        )}

        {/* Canvas Area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            minWidth: 0,
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              px: 2.25,
              py: 1.5,
              borderRadius: 999,
              border: '1px solid rgba(113, 87, 59, 0.1)',
              bgcolor: 'rgba(255,255,255,0.56)',
              backdropFilter: 'blur(14px)',
              boxShadow: '0 18px 36px rgba(76, 48, 17, 0.08)',
              display: 'flex',
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Box>
              <Typography
                variant="overline"
                sx={{ color: 'var(--ve-accent)', letterSpacing: '0.18em', fontWeight: 700 }}
              >
                {isPreviewMode ? 'Live Preview' : 'Canvas Stage'}
              </Typography>
              <Typography variant="h6" sx={{ color: 'var(--ve-ink)', fontWeight: 700 }}>
                {isPreviewMode
                  ? 'Focused preview workspace'
                  : state.elements.length === 0
                    ? 'Start with a polished section or build from scratch'
                    : 'Responsive design workspace'}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {isPreviewMode && (
                <Button
                  variant="contained"
                  onClick={() => setShowLivePreview(false)}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 999,
                    bgcolor: 'var(--ve-accent)',
                    '&:hover': {
                      bgcolor: '#ef5b24',
                    },
                  }}
                >
                  Back to editing
                </Button>
              )}
              <Chip
                label={showLivePreview ? 'Preview live' : 'Edit mode'}
                sx={{
                  bgcolor: showLivePreview ? 'var(--ve-accent-soft)' : 'rgba(255,255,255,0.72)',
                  color: showLivePreview ? 'var(--ve-accent)' : 'var(--ve-muted)',
                  fontWeight: 600,
                }}
              />
              <Chip
                label={state.gridVisible ? 'Grid on' : 'Grid off'}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.72)',
                  color: 'var(--ve-muted)',
                }}
              />
              <Chip
                label={dbConnected ? 'Synced to database' : 'Local session'}
                sx={{
                  bgcolor: dbConnected ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255,255,255,0.72)',
                  color: dbConnected ? '#15803d' : 'var(--ve-muted)',
                  fontWeight: 600,
                }}
              />
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 5,
              border: '1px solid var(--ve-panel-border)',
              bgcolor: 'rgba(255,255,255,0.3)',
              boxShadow: 'var(--ve-panel-shadow)',
              backdropFilter: 'blur(12px)',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background: `
                  radial-gradient(circle at center, rgba(255,255,255,0.12), transparent 56%),
                  linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))
                `,
                pointerEvents: 'none',
              },
            }}
          >
            <FabricCanvas />

            {state.elements.length === 0 && !isPreviewMode && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 3,
                  py: 4,
                  pointerEvents: 'none',
                }}
              >
                <Box
                  sx={{
                    width: 'min(640px, 100%)',
                    p: { xs: 2.5, md: 3 },
                    borderRadius: 4,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    border: '1px solid rgba(113, 87, 59, 0.1)',
                    boxShadow: '0 24px 60px rgba(66, 42, 17, 0.12)',
                    backdropFilter: 'blur(18px)',
                    pointerEvents: 'auto',
                  }}
                >
                  <Typography
                    variant="overline"
                    sx={{ color: 'var(--ve-accent)', letterSpacing: '0.18em', fontWeight: 700 }}
                  >
                    Quick Start
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'var(--ve-ink)', fontWeight: 800, mb: 1 }}>
                    Build your first section in seconds
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'var(--ve-muted)', mb: 3 }}>
                    Start with a ready-made hero, or drop in a few foundational blocks and shape the page from there.
                  </Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<WebAsset />}
                      onClick={addHeroStarter}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 999,
                        bgcolor: 'var(--ve-accent)',
                        px: 2,
                        py: 1.1,
                        '&:hover': {
                          bgcolor: '#ef5b24',
                        },
                      }}
                    >
                      Add hero section
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<TextFields />}
                      onClick={() => addCanvasElement('text')}
                      sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                      Add headline
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<SmartButton />}
                      onClick={() => addCanvasElement('button')}
                      sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                      Add CTA
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<ViewQuilt />}
                      onClick={addFeatureGridStarter}
                      sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                      Add feature grid
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<ViewQuilt />}
                      onClick={() => addCanvasElement('card')}
                      sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                      Add card
                    </Button>
                  </Stack>

                  <Button
                    variant="text"
                    startIcon={<Folder />}
                    onClick={() => setShowComponentLibrary(true)}
                    sx={{ textTransform: 'none', color: 'var(--ve-accent)' }}
                  >
                    Open component library
                  </Button>
                </Box>
              </Box>
            )}

            {/* Floating Action Buttons */}
            {!isPreviewMode && (
              <Box
                sx={{
                  position: 'absolute',
                  right: { xs: 12, lg: 20 },
                  bottom: { xs: 12, lg: 20 },
                  top: 'auto',
                  transform: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  zIndex: 100,
                  p: 1,
                  maxHeight: 'calc(100% - 96px)',
                  pointerEvents: 'none',
                  borderRadius: 999,
                  bgcolor: 'rgba(29, 22, 17, 0.82)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 24px 60px rgba(32, 20, 9, 0.28)',
                  '& .MuiFab-root': {
                    width: 44,
                    height: 44,
                    minHeight: 44,
                    bgcolor: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.92)',
                    boxShadow: 'none',
                    border: '1px solid rgba(255,255,255,0.08)',
                    pointerEvents: 'auto',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.16)',
                    },
                  },
                  '& .MuiFab-primary': {
                    bgcolor: 'var(--ve-accent)',
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.18)',
                    '&:hover': {
                      bgcolor: '#ef5b24',
                    },
                  },
                }}
              >
                <Tooltip title={tokens.enhancedPage.fabs.unifiedStudio} placement="left">
                  <Fab
                    size="small"
                    color={showUnifiedStudio ? 'primary' : 'default'}
                    onClick={() => setShowUnifiedStudio(!showUnifiedStudio)}
                  >
                    <Code />
                  </Fab>
                </Tooltip>

                <Tooltip title={tokens.enhancedPage.fabs.accessibility} placement="left">
                  <Fab
                    size="small"
                    color={showAccessibility ? 'primary' : 'default'}
                    onClick={() => setShowAccessibility(!showAccessibility)}
                  >
                    <Accessible />
                  </Fab>
                </Tooltip>

                <Tooltip title={tokens.enhancedPage.fabs.exportPanel} placement="left">
                  <Fab size="small" aria-label="Open export panel" onClick={() => setShowExporter(true)}>
                    <CloudUpload />
                  </Fab>
                </Tooltip>

                <Tooltip title={tokens.enhancedPage.fabs.componentLibrary} placement="left">
                  <Fab
                    size="small"
                    color={showComponentLibrary ? 'primary' : 'default'}
                    aria-label={showComponentLibrary ? 'Close component library drawer' : 'Open component library drawer'}
                    onClick={() => setShowComponentLibrary(!showComponentLibrary)}
                  >
                    <Folder />
                  </Fab>
                </Tooltip>

                <Tooltip title="Advanced Workspace" placement="left">
                  <Fab
                    size="small"
                    color={showAdvancedWorkspace ? 'primary' : 'default'}
                    aria-label={showAdvancedWorkspace ? 'Close advanced workspace' : 'Open advanced workspace'}
                    onClick={() => setShowAdvancedWorkspace((prev) => !prev)}
                  >
                    <DashboardCustomize />
                  </Fab>
                </Tooltip>

                <Tooltip title="Smart Library Suggestions" placement="left">
                  <Fab
                    size="small"
                    color={showLibrarySuggestions ? 'primary' : 'default'}
                    aria-label="Open smart library suggestions"
                    onClick={() => openSmartSuggestions('video-player')}
                  >
                    <AutoAwesome />
                  </Fab>
                </Tooltip>

                <Tooltip title="Profession Config Wizard" placement="left">
                  <Fab
                    size="small"
                    color={showProfessionWizard ? 'primary' : 'default'}
                    aria-label="Open profession config wizard"
                    onClick={() => setShowProfessionWizard(true)}
                  >
                    <Tune />
                  </Fab>
                </Tooltip>

                <Tooltip title={tokens.enhancedPage.fabs.shortcuts} placement="left">
                  <Fab size="small" aria-label="Open keyboard shortcuts" onClick={() => setShowShortcuts(true)}>
                    <Keyboard />
                  </Fab>
                </Tooltip>

                <Tooltip title={tokens.enhancedPage.fabs.codeEditor} placement="left">
                  <Fab
                    size="small"
                    color={showCodeEditor ? 'primary' : 'default'}
                    aria-label={showCodeEditor ? 'Close code editor' : 'Open code editor'}
                    onClick={() => setShowCodeEditor(!showCodeEditor)}
                  >
                    <Code />
                  </Fab>
                </Tooltip>

                <Tooltip title={tokens.enhancedPage.fabs.livePreviewPanel} placement="left">
                  <Fab
                    size="small"
                    color={showLivePreviewPanel ? 'primary' : 'default'}
                    aria-label={showLivePreviewPanel ? 'Close live preview panel' : 'Open live preview panel'}
                    onClick={() => setShowLivePreviewPanel(!showLivePreviewPanel)}
                  >
                    <Visibility />
                  </Fab>
                </Tooltip>

                <Tooltip title={tokens.enhancedPage.fabs.previewMode} placement="left">
                  <Fab
                    size="small"
                    color={showLivePreview ? 'primary' : 'default'}
                    aria-label={showLivePreview ? 'Exit preview mode' : 'Enter preview mode'}
                    onClick={() => setShowLivePreview(!showLivePreview)}
                  >
                    <Visibility />
                  </Fab>
                </Tooltip>

                <Tooltip title={tokens.enhancedPage.fabs.settings} placement="left">
                  <Fab
                    size="small"
                    color={showSettings ? 'primary' : 'default'}
                    aria-label={showSettings ? 'Close system settings workspace' : 'Open system settings workspace'}
                    onClick={() => {
                      setShowSettings((prev) => !prev);
                      setShowAdvancedWorkspace(true);
                      setActiveWorkspaceTab('system-management');
                    }}
                  >
                    <SettingsIcon />
                  </Fab>
                </Tooltip>
              </Box>
            )}
          </Box>
        </Box>

        {/* Right Properties Panel */}
        {!isPreviewMode && <EnhancedPropertiesPanel />}
      </Box>

      {/* Advanced Workspace Drawer */}
      {showAdvancedWorkspace && (
        <Drawer
          anchor="bottom"
          open={showAdvancedWorkspace}
          onClose={() => setShowAdvancedWorkspace(false)}
          variant="persistent"
          PaperProps={{
            sx: {
              height: '48vh',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTop: '1px solid',
              borderColor: 'var(--ve-panel-border)',
              bgcolor: 'rgba(255,255,255,0.96)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,238,227,0.98))',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 -24px 60px rgba(54, 34, 13, 0.12)',
            },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            <Box
              sx={{
                px: 2,
                py: 1,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                position: 'relative',
                zIndex: 2,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.25,
                  flex: 1,
                  pr: { xs: 2, sm: 3 },
                  minWidth: 0,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Advanced Workspace
                </Typography>
                <Typography variant="caption" color={dbConnected ? 'success.main' : 'warning.main'}>
                  {dbConnected ? 'Database connected' : 'Database disconnected'}
                </Typography>
                {dbError && (
                  <Typography variant="caption" color="error.main">
                    {dbError}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {lastIntegrationEvent}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {lastSyncedAt ? `Last sync: ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Last sync: never'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, pt: 0.5, flexWrap: 'wrap' }}>
                  <Fab
                    size="small"
                    onClick={handleLoadProjectFromDb}
                    title="Load current project from database"
                  >
                    <CloudUpload />
                  </Fab>
                  <Fab
                    size="small"
                    onClick={handleSaveCurrentAsTemplate}
                    title="Save current project as template"
                  >
                    <Folder />
                  </Fab>
                  <Fab
                    size="small"
                    onClick={handleProbeAdminData}
                    title="Probe admin component data"
                  >
                    <AutoAwesome />
                  </Fab>
                  <Fab
                    size="small"
                    onClick={() => syncIntegrationState('manual-sync')}
                    title="Manual integration sync"
                  >
                    <Code />
                  </Fab>
                  <Fab
                    size="small"
                    onClick={() => updateAnyComponent('admin-dashboard', 'refresh', { source: 'enhanced-visual-editor' })}
                    title="Refresh admin dashboard"
                  >
                    <DashboardCustomize />
                  </Fab>
                  <Fab
                    size="small"
                    onClick={() => updateAnyComponent('client-portal', 'project-sync', { projectId: selectedProjectForPanels.id })}
                    title="Sync to client portal"
                  >
                    <Visibility />
                  </Fab>
                  <Fab
                    size="small"
                    aria-label="Open logo manager"
                    onClick={() => setLogoManagerOpen(true)}
                    title="Open logo manager"
                  >
                    <Folder />
                  </Fab>
                  <Button
                    size="small"
                    variant="outlined"
                    aria-label="Close advanced workspace drawer"
                    onClick={() => setShowAdvancedWorkspace(false)}
                    sx={{ textTransform: 'none', borderRadius: 999 }}
                  >
                    Close workspace
                  </Button>
                </Box>
              </Box>
            </Box>

            <Tabs
              value={activeWorkspaceTab}
              onChange={(_, value: AdvancedWorkspaceTab) => setActiveWorkspaceTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ px: 1 }}
            >
              <Tab value="templates" label="Templates" />
              <Tab value="export-presets" label="Export" />
              <Tab value="cloud-sync" label="Cloud" />
              <Tab value="team-collaboration" label="Team" />
              <Tab value="plugins" label="Plugins" />
              <Tab value="animations" label="Animation" />
              <Tab value="component-library" label="Library" />
              <Tab value="design-system" label="Design System" />
              <Tab value="analytics" label="Analytics" />
              <Tab value="audit" label="Audit" />
              <Tab value="monitoring" label="Monitoring" />
              <Tab value="system-management" label="System" />
              <Tab value="ml-optimization" label="ML" />
              <Tab value="advanced-analytics" label="Adv Analytics" />
              <Tab value="ai-assistance" label="AI" />
              <Tab value="templates-presets" label="Templates & Presets" />
              <Tab value="template-presets" label="Presets" />
              <Tab value="client-communication" label="Client Comms" />
              <Tab value="revenue-optimization" label="Revenue" />
              <Tab value="seo" label="SEO" />
              <Tab value="modals" label="Modals" />
              <Tab value="dashboard-components" label="Components" />
              <Tab value="toasts" label="Toasts" />
              <Tab value="branding" label="Branding" />
              <Tab value="landing-settings" label="Landing" />
              <Tab value="showcase-publisher" label="Publish" />
              <Tab value="theming-admin" label="Theming" />
              <Tab value="integration-tools" label="Integration" />
            </Tabs>
            <Divider />

            <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
              {renderAdvancedWorkspace()}
            </Box>
          </Box>
        </Drawer>
      )}

      {/* Enhanced Panels - Overlays */}

      {/* Unified Code Studio (replaces separate Code Editor + Live Preview) */}
      {showUnifiedStudio && (
        <UnifiedCodeStudio
          open={showUnifiedStudio}
          onClose={() => setShowUnifiedStudio(false)}
          initialCode={generatedCode}
        />
      )}

      {/* Accessibility Checker Drawer */}
      {showAccessibility && (
        <AccessibilityChecker
          open={showAccessibility}
          onClose={() => setShowAccessibility(false)}
          iframeRef={React.createRef()}
        />
      )}

      {/* Platform Exporter Dialog */}
      {showExporter && (
        <PlatformExporter
          open={showExporter}
          onClose={() => setShowExporter(false)}
          code={generatedCode}
          exportFormat={exportFormat}
        />
      )}

      {/* Component Library Drawer */}
      {showComponentLibrary && (
        <ComponentLibrary
          open={showComponentLibrary}
          onClose={() => setShowComponentLibrary(false)}
          onUseComponent={handleUseComponent}
          selectionSnapshot={componentSelectionSnapshot}
        />
      )}

      {/* Keyboard Shortcuts Dialog */}
      {showShortcuts && (
        <KeyboardShortcuts
          open={showShortcuts}
          onClose={() => setShowShortcuts(false)}
          onExecuteCommand={handleCommandExecute}
        />
      )}

      {/* Code Editor Panel - conditionally rendered */}
      {showCodeEditor && (
        <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '50vh', zIndex: 1000 }}>
          <CodeEditorPanel
            onCodeChange={(code: string, language: string) => {
              if (language === 'javascript' || language === 'typescript') {
                setGeneratedCode(prev => ({ ...prev, react: code }));
              } else if (language === 'css') {
                setGeneratedCode(prev => ({ ...prev, css: code }));
              }
            }}
            readOnly={false}
          />
        </Box>
      )}

      {/* Live Preview Panel - conditionally rendered */}
      {showLivePreviewPanel && (
        <Box sx={{ position: 'fixed', top: 64, right: 300, width: 400, height: 'calc(100vh - 64px)', zIndex: 1000 }}>
          <LivePreviewPanel
            code={generatedCode}
            mode={exportFormat === 'react' ? 'react' : 'html'}
          />
        </Box>
      )}

      {showLibrarySuggestions && (
        <LibrarySuggestionDialog
          open={showLibrarySuggestions}
          onClose={() => setShowLibrarySuggestions(false)}
          componentType={suggestedComponentType}
          profession="videographer"
          onEnableFeatures={handleEnableFeatures}
        />
      )}

      {showProfessionWizard && (
        <ProfessionConfigWizard
          open={showProfessionWizard}
          onClose={() => setShowProfessionWizard(false)}
          onSave={handleSaveProfession}
          enableClone
          enableImportExport
          enablePreview
          enableABTesting
          enableAnalytics
        />
      )}

      {logoManagerOpen && (
        <LogoManagementPanel open={logoManagerOpen} onClose={() => setLogoManagerOpen(false)} />
      )}
    </Box>
  );
};

// Main component with provider
export const EnhancedVisualEditorPage: React.FC<EnhancedVisualEditorPageProps> = ({
  projectId,
}) => {
  return (
    <VisualEditorProvider>
      <EnhancedVisualEditorPageLoader projectId={projectId} />
    </VisualEditorProvider>
  );
};

/** Inner component that can access the visual editor context to load a project */
const EnhancedVisualEditorPageLoader: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const { loadProject } = useVisualEditor();
  const lastLoadedProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    const nextProjectId = projectId ?? 'visual-editor-project';
    if (lastLoadedProjectIdRef.current === nextProjectId) {
      return;
    }

    lastLoadedProjectIdRef.current = nextProjectId;
    const nextProjectName = projectId ? `Project ${projectId}` : 'Visual Editor Project';

    loadProject({
      id: nextProjectId,
      name: nextProjectName,
      elements: [],
      settings: {
        width: 1200,
        height: 800,
        backgroundColor: '#ffffff',
        gridSize: 10,
        snapToGrid: true,
      },
      metadata: {
        createdBy: 'current-user',
        createdAt: new Date(),
        lastModified: new Date(),
        version: 1,
      },
      status: 'draft',
    });
  }, [projectId, loadProject]);

  return <EnhancedVisualEditorContent />;
};
