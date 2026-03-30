import type {
  EditorDesignTokenMap,
  EditorElement,
  EditorStyleClass,
  EditorStyleClassMap,
  Project,
} from './VisualEditorContext';

export type EditorBreakpoint = 'desktop' | 'tablet' | 'mobile';
export type EditorDeviceOrientation = 'portrait' | 'landscape';
export type EditorLayoutMode = 'absolute' | 'flex' | 'grid';

export interface EditorResponsiveOverride {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  visible?: boolean;
  styles?: Partial<EditorElement['styles']>;
}

export interface ResolvedEditorElement extends EditorElement {
  visible: boolean;
  locked: boolean;
  layoutMode: EditorLayoutMode;
  autoPositioned: boolean;
}

export interface BreakpointOption {
  id: EditorBreakpoint;
  label: string;
  shortLabel: string;
}

export interface EditorDeviceProfile {
  breakpoint: EditorBreakpoint;
  label: string;
  shortLabel: string;
  model: string;
  formFactor: 'desktop' | 'tablet' | 'mobile';
  displayPixelsPerInch: number;
  viewport: {
    width: number;
    height: number;
    nativeWidth: number;
    nativeHeight: number;
    devicePixelRatio: number;
    orientation: EditorDeviceOrientation;
  };
  physical: {
    widthMm: number;
    heightMm: number;
    thicknessMm: number;
    screenDiagonalInches: number;
  };
}

export interface EditorBrowserViewportMetrics {
  screenWidth: number;
  screenHeight: number;
  contentWidth: number;
  contentHeight: number;
  contentInsetTop: number;
  contentInsetRight: number;
  contentInsetBottom: number;
  contentInsetLeft: number;
  topBarHeight: number;
  bottomBarHeight: number;
}

export interface EditorComponentBinding {
  componentId: string;
  componentName: string;
  familyId: string;
  variantName: string;
  instanceId: string;
  slotName: string;
  isRoot: boolean;
}

export interface EditorComponentManifestEntry {
  componentId: string;
  componentName: string;
  familyId: string;
  variantName: string;
  instanceId: string;
  rootElementIds: string[];
  slotNames: string[];
}

export const EDITOR_COMPONENT_BINDING_PROP = '__veComponentBinding';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const getElementClassNames = (className: string | undefined): string[] =>
  typeof className === 'string'
    ? className
        .split(/\s+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

export const sanitizeDesignTokenName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

export const getDesignTokenCssVariableName = (tokenName: string): string =>
  `--ve-token-${sanitizeDesignTokenName(tokenName)}`;

export const getDesignTokenReference = (tokenName: string): string =>
  `var(${getDesignTokenCssVariableName(tokenName)})`;

export const sanitizeComponentSlotName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'slot';

export const getElementComponentBinding = (
  element: Pick<EditorElement, 'props'> | null | undefined,
): EditorComponentBinding | null => {
  if (!element || !isRecord(element.props)) {
    return null;
  }

  const candidate = element.props[EDITOR_COMPONENT_BINDING_PROP];
  if (!isRecord(candidate)) {
    return null;
  }

  const {
    componentId,
    componentName,
    familyId,
    variantName,
    instanceId,
    slotName,
    isRoot,
  } = candidate;

  if (
    typeof componentId !== 'string'
    || typeof componentName !== 'string'
    || typeof familyId !== 'string'
    || typeof variantName !== 'string'
    || typeof instanceId !== 'string'
    || typeof slotName !== 'string'
    || typeof isRoot !== 'boolean'
  ) {
    return null;
  }

  return {
    componentId,
    componentName,
    familyId,
    variantName,
    instanceId,
    slotName,
    isRoot,
  };
};

export const stripComponentBindingFromProps = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const nextProps = { ...props };
  delete nextProps[EDITOR_COMPONENT_BINDING_PROP];
  return nextProps;
};

export const withComponentBinding = (
  element: EditorElement,
  binding: EditorComponentBinding,
): EditorElement => ({
  ...element,
  props: {
    ...stripComponentBindingFromProps(element.props),
    [EDITOR_COMPONENT_BINDING_PROP]: binding,
  },
});

export const buildComponentManifest = (
  elements: EditorElement[],
): EditorComponentManifestEntry[] => {
  const manifestMap = new Map<string, EditorComponentManifestEntry>();

  elements.forEach((element) => {
    const binding = getElementComponentBinding(element);
    if (!binding) {
      return;
    }

    const existingEntry = manifestMap.get(binding.instanceId);
    if (existingEntry) {
      if (binding.isRoot && !existingEntry.rootElementIds.includes(element.id)) {
        existingEntry.rootElementIds.push(element.id);
      }
      if (!existingEntry.slotNames.includes(binding.slotName)) {
        existingEntry.slotNames.push(binding.slotName);
      }
      return;
    }

    manifestMap.set(binding.instanceId, {
      componentId: binding.componentId,
      componentName: binding.componentName,
      familyId: binding.familyId,
      variantName: binding.variantName,
      instanceId: binding.instanceId,
      rootElementIds: binding.isRoot ? [element.id] : [],
      slotNames: [binding.slotName],
    });
  });

  return Array.from(manifestMap.values()).sort((left, right) =>
    left.componentName.localeCompare(right.componentName)
    || left.variantName.localeCompare(right.variantName)
    || left.instanceId.localeCompare(right.instanceId),
  );
};

export const extractDesignTokenNameFromReference = (value: string): string | null => {
  const match = value.trim().match(/^var\(\s*(--ve-token-[a-z0-9-]+)\s*\)$/i);
  if (!match?.[1]) {
    return null;
  }

  return match[1].replace(/^--ve-token-/, '');
};

const normalizeDesignTokens = (designTokens: EditorDesignTokenMap = {}): EditorDesignTokenMap =>
  Object.values(designTokens).reduce<EditorDesignTokenMap>((acc, token) => {
    const normalizedName = sanitizeDesignTokenName(token.name);
    if (!normalizedName) {
      return acc;
    }

    acc[normalizedName] = {
      ...token,
      name: normalizedName,
      value: String(token.value ?? '').trim(),
    };
    return acc;
  }, {});

const resolveTokenizedStyleValue = (
  value: unknown,
  designTokens: EditorDesignTokenMap = {},
): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const tokenName = extractDesignTokenNameFromReference(value);
  if (!tokenName) {
    return value;
  }

  const normalizedTokens = normalizeDesignTokens(designTokens);
  return normalizedTokens[tokenName]?.value ?? value;
};

const resolveTokenizedStyles = (
  styles: Partial<EditorElement['styles']>,
  designTokens: EditorDesignTokenMap = {},
): Partial<EditorElement['styles']> =>
  Object.entries(styles).reduce<Partial<EditorElement['styles']>>((acc, [key, value]) => {
    const styleKey = key as keyof EditorElement['styles'];
    const mutableAcc = acc as Record<string, EditorElement['styles'][keyof EditorElement['styles']] | undefined>;
    mutableAcc[styleKey] = resolveTokenizedStyleValue(value, designTokens) as EditorElement['styles'][typeof styleKey];
    return acc;
  }, {});

// Apple publishes native resolution and physical dimensions for these devices.
// The CSS viewport values here are derived from the native resolution and the
// platform scale factor for each class of Retina display.
export const EDITOR_DEVICE_PROFILES: Record<EditorBreakpoint, EditorDeviceProfile> = {
  desktop: {
    breakpoint: 'desktop',
    label: 'Desktop',
    shortLabel: 'D',
    model: 'MacBook Pro 14-inch',
    formFactor: 'desktop',
    displayPixelsPerInch: 254,
    viewport: {
      width: 1512,
      height: 982,
      nativeWidth: 3024,
      nativeHeight: 1964,
      devicePixelRatio: 2,
      orientation: 'landscape',
    },
    physical: {
      widthMm: 312.6,
      heightMm: 221.2,
      thicknessMm: 15.5,
      screenDiagonalInches: 14.2,
    },
  },
  tablet: {
    breakpoint: 'tablet',
    label: 'Tablet',
    shortLabel: 'T',
    model: 'iPad Pro 11-inch',
    formFactor: 'tablet',
    displayPixelsPerInch: 264,
    viewport: {
      width: 834,
      height: 1210,
      nativeWidth: 1668,
      nativeHeight: 2420,
      devicePixelRatio: 2,
      orientation: 'portrait',
    },
    physical: {
      widthMm: 177.5,
      heightMm: 249.7,
      thicknessMm: 5.3,
      screenDiagonalInches: 11,
    },
  },
  mobile: {
    breakpoint: 'mobile',
    label: 'Mobile',
    shortLabel: 'M',
    model: 'iPhone 15 Pro',
    formFactor: 'mobile',
    displayPixelsPerInch: 460,
    viewport: {
      width: 393,
      height: 852,
      nativeWidth: 1179,
      nativeHeight: 2556,
      devicePixelRatio: 3,
      orientation: 'portrait',
    },
    physical: {
      widthMm: 70.6,
      heightMm: 146.6,
      thicknessMm: 8.25,
      screenDiagonalInches: 6.1,
    },
  },
};

export const EDITOR_BREAKPOINTS: BreakpointOption[] = [
  { id: 'desktop', label: EDITOR_DEVICE_PROFILES.desktop.label, shortLabel: EDITOR_DEVICE_PROFILES.desktop.shortLabel },
  { id: 'tablet', label: EDITOR_DEVICE_PROFILES.tablet.label, shortLabel: EDITOR_DEVICE_PROFILES.tablet.shortLabel },
  { id: 'mobile', label: EDITOR_DEVICE_PROFILES.mobile.label, shortLabel: EDITOR_DEVICE_PROFILES.mobile.shortLabel },
];

export const BREAKPOINT_MEDIA_QUERIES: Record<Exclude<EditorBreakpoint, 'desktop'>, string> = {
  tablet: `@media (max-width: ${EDITOR_DEVICE_PROFILES.tablet.viewport.width}px)`,
  mobile: `@media (max-width: ${EDITOR_DEVICE_PROFILES.mobile.viewport.width}px)`,
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const parseSizeValue = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

type BoxSpacing = { top: number; right: number; bottom: number; left: number };

const parseSpacing = (value: unknown): BoxSpacing => {
  if (typeof value !== 'string' || !value.trim()) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .map((part) => parseSizeValue(part, 0));

  switch (parts.length) {
    case 1:
      return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    case 2:
      return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    case 3:
      return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    default:
      return {
        top: parts[0] ?? 0,
        right: parts[1] ?? 0,
        bottom: parts[2] ?? 0,
        left: parts[3] ?? 0,
      };
  }
};

const parseGap = (value: unknown): number => parseSizeValue(value, 0);

export const getEditorLayoutMode = (element: Pick<EditorElement, 'type' | 'styles'>): EditorLayoutMode => {
  if (element.type === 'grid' || element.styles.display === 'grid') {
    return 'grid';
  }

  if (element.styles.display === 'flex') {
    return 'flex';
  }

  return 'absolute';
};

const getFlexDirection = (element: Pick<EditorElement, 'styles'>): 'row' | 'column' =>
  element.styles.flexDirection === 'row' ? 'row' : 'column';

const getLayoutJustify = (element: Pick<EditorElement, 'styles'>): string => {
  const value = element.styles.justifyContent;
  return typeof value === 'string' && value.trim() ? value : 'flex-start';
};

const getLayoutAlign = (element: Pick<EditorElement, 'styles'>, layoutMode: EditorLayoutMode): string => {
  const value = element.styles.alignItems;
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return layoutMode === 'grid' ? 'stretch' : 'flex-start';
};

type GridTrack = { kind: 'fr' | 'px'; value: number };

const parseGridTracks = (value: unknown): GridTrack[] => {
  if (typeof value !== 'string' || !value.trim()) {
    return [{ kind: 'fr', value: 1 }];
  }

  const normalized = value.trim();
  const repeatMatch = normalized.match(/^repeat\(\s*(\d+)\s*,\s*minmax\(0\s*,\s*(\d+(?:\.\d+)?)fr\)\s*\)$/i)
    || normalized.match(/^repeat\(\s*(\d+)\s*,\s*(\d+(?:\.\d+)?)fr\s*\)$/i);

  if (repeatMatch) {
    const count = Number.parseInt(repeatMatch[1] ?? '1', 10);
    const fraction = Number.parseFloat(repeatMatch[2] ?? '1');
    return Array.from({ length: Math.max(1, count) }, () => ({
      kind: 'fr' as const,
      value: Number.isFinite(fraction) && fraction > 0 ? fraction : 1,
    }));
  }

  const tokens = normalized.split(/\s+/);
  const tracks = tokens
    .map((token): GridTrack | null => {
      const frMatch = token.match(/^(\d+(?:\.\d+)?)fr$/i);
      if (frMatch) {
        return { kind: 'fr', value: Number.parseFloat(frMatch[1] ?? '1') || 1 };
      }

      const pxValue = parseSizeValue(token, Number.NaN);
      if (Number.isFinite(pxValue)) {
        return { kind: 'px', value: pxValue };
      }

      return null;
    })
    .filter((track): track is GridTrack => track !== null);

  return tracks.length > 0 ? tracks : [{ kind: 'fr', value: 1 }];
};

const resolveGridTrackWidths = (tracks: GridTrack[], availableWidth: number): number[] => {
  const fixedWidth = tracks
    .filter((track) => track.kind === 'px')
    .reduce((sum, track) => sum + track.value, 0);
  const fractionalTracks = tracks.filter((track) => track.kind === 'fr');
  const totalFractions = fractionalTracks.reduce((sum, track) => sum + track.value, 0);
  const fractionalWidth = Math.max(availableWidth - fixedWidth, 0);

  return tracks.map((track) => {
    if (track.kind === 'px') {
      return track.value;
    }

    if (totalFractions <= 0) {
      return fractionalTracks.length > 0 ? fractionalWidth / fractionalTracks.length : fractionalWidth;
    }

    return fractionalWidth * (track.value / totalFractions);
  });
};

type LayoutSlot = {
  x: number;
  y: number;
  width: number;
  height: number;
  autoPositioned: boolean;
};

const getAlignedOffset = (available: number, used: number, align: string): number => {
  const freeSpace = Math.max(available - used, 0);

  switch (align) {
    case 'center':
      return freeSpace / 2;
    case 'flex-end':
    case 'end':
      return freeSpace;
    default:
      return 0;
  }
};

export const getEditorDeviceProfile = (breakpoint: EditorBreakpoint): EditorDeviceProfile =>
  EDITOR_DEVICE_PROFILES[breakpoint];

export const resolveEditorDeviceProfile = (
  breakpoint: EditorBreakpoint,
  orientation: EditorDeviceOrientation,
): EditorDeviceProfile => {
  const profile = getEditorDeviceProfile(breakpoint);

  if (profile.formFactor === 'desktop' || profile.viewport.orientation === orientation) {
    return profile;
  }

  return {
    ...profile,
    viewport: {
      ...profile.viewport,
      width: profile.viewport.height,
      height: profile.viewport.width,
      nativeWidth: profile.viewport.nativeHeight,
      nativeHeight: profile.viewport.nativeWidth,
      orientation,
    },
    physical: {
      ...profile.physical,
      widthMm: profile.physical.heightMm,
      heightMm: profile.physical.widthMm,
    },
  };
};

export const resolveEditorBrowserViewportMetrics = (
  breakpoint: EditorBreakpoint,
  orientation: EditorDeviceOrientation,
): EditorBrowserViewportMetrics => {
  const deviceProfile = resolveEditorDeviceProfile(breakpoint, orientation);
  const screenWidth = deviceProfile.viewport.width;
  const screenHeight = deviceProfile.viewport.height;
  const isPhone = deviceProfile.formFactor === 'mobile';
  const isTablet = deviceProfile.formFactor === 'tablet';
  const isLandscape = deviceProfile.viewport.orientation === 'landscape';

  const topBarHeight =
    deviceProfile.formFactor === 'desktop'
      ? Math.max(44, Math.round(screenHeight * 0.045))
      : isPhone
        ? (isLandscape
            ? Math.max(40, Math.round(screenHeight * 0.13))
            : Math.max(52, Math.round(screenHeight * 0.072)))
        : (isLandscape
            ? Math.max(44, Math.round(screenHeight * 0.08))
            : Math.max(52, Math.round(screenHeight * 0.055)));

  const bottomBarHeight =
    deviceProfile.formFactor === 'desktop'
      ? 0
      : isPhone
        ? (isLandscape
            ? Math.max(26, Math.round(screenHeight * 0.075))
            : Math.max(48, Math.round(screenHeight * 0.06)))
        : (isLandscape
            ? Math.max(28, Math.round(screenHeight * 0.06))
            : Math.max(42, Math.round(screenHeight * 0.045)));

  const contentInsetLeft =
    isPhone && isLandscape
      ? Math.max(24, Math.round(screenWidth * 0.038))
      : isTablet && isLandscape
        ? Math.max(12, Math.round(screenWidth * 0.012))
        : 0;
  const contentInsetRight =
    isPhone && isLandscape
      ? Math.max(20, Math.round(screenWidth * 0.032))
      : isTablet && isLandscape
        ? Math.max(12, Math.round(screenWidth * 0.012))
        : 0;

  const contentInsetTop = topBarHeight;
  const contentInsetBottom = bottomBarHeight;

  return {
    screenWidth,
    screenHeight,
    contentWidth: Math.max(screenWidth - contentInsetLeft - contentInsetRight, 1),
    contentHeight: Math.max(screenHeight - contentInsetTop - contentInsetBottom, 1),
    contentInsetTop,
    contentInsetRight,
    contentInsetBottom,
    contentInsetLeft,
    topBarHeight,
    bottomBarHeight,
  };
};

export const getDisplayViewport = (
  breakpoint: EditorBreakpoint,
  orientation: EditorDeviceOrientation,
): { width: number; height: number } => {
  const deviceProfile = resolveEditorDeviceProfile(breakpoint, orientation);
  return {
    width: deviceProfile.viewport.width,
    height: deviceProfile.viewport.height,
  };
};

export const getProjectViewport = (
  _project: Project | null,
  breakpoint: EditorBreakpoint,
  orientation: EditorDeviceOrientation,
): { width: number; height: number } => {
  const browserViewport = resolveEditorBrowserViewportMetrics(breakpoint, orientation);
  return {
    width: browserViewport.contentWidth,
    height: browserViewport.contentHeight,
  };
};

export const normalizeEditorElement = (element: EditorElement): EditorElement => ({
  ...element,
  styles: { ...element.styles },
  props: { ...element.props },
  children: Array.isArray(element.children) ? [...element.children] : [],
  className: getElementClassNames(element.className).join(' ') || undefined,
  visible: element.visible ?? true,
  locked: element.locked ?? false,
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

export const resolveStyleClassForBreakpoint = (
  styleClass: EditorStyleClass | undefined,
  breakpoint: EditorBreakpoint,
  designTokens: EditorDesignTokenMap = {},
): Partial<EditorElement['styles']> => {
  if (!styleClass) {
    return {};
  }

  return resolveTokenizedStyles({
    ...styleClass.styles,
    ...(breakpoint === 'desktop' ? {} : (styleClass.responsive?.[breakpoint] ?? {})),
  }, designTokens);
};

export const resolveSharedClassStyles = (
  element: Pick<EditorElement, 'className'>,
  breakpoint: EditorBreakpoint,
  styleClasses: EditorStyleClassMap = {},
  designTokens: EditorDesignTokenMap = {},
): Partial<EditorElement['styles']> =>
  getElementClassNames(element.className).reduce<Partial<EditorElement['styles']>>((acc, className) => ({
    ...acc,
    ...resolveStyleClassForBreakpoint(styleClasses[className], breakpoint, designTokens),
  }), {});

export const resolveElementStylesForBreakpoint = (
  element: EditorElement,
  breakpoint: EditorBreakpoint,
  styleClasses: EditorStyleClassMap = {},
  designTokens: EditorDesignTokenMap = {},
): EditorElement['styles'] => {
  const normalized = normalizeEditorElement(element);
  const override = breakpoint === 'desktop' ? undefined : normalized.responsive?.[breakpoint];

  return resolveTokenizedStyles({
    ...resolveSharedClassStyles(normalized, breakpoint, styleClasses, designTokens),
    ...normalized.styles,
    ...(override?.styles ?? {}),
  }, designTokens) as EditorElement['styles'];
};

export const synchronizeElementChildren = (elements: EditorElement[]): EditorElement[] => {
  const normalized: EditorElement[] = elements.map((element) => ({
    ...normalizeEditorElement(element),
    children: [] as string[],
  }));
  const elementsById = new Map(normalized.map((element) => [element.id, element]));

  normalized.forEach((element) => {
    if (!element.parent) {
      return;
    }

    const parent = elementsById.get(element.parent);
    if (!parent) {
      element.parent = undefined;
      return;
    }

    parent.children = [...(parent.children ?? []), element.id];
  });

  return normalized;
};

export const resolveElementForBreakpoint = (
  element: EditorElement,
  breakpoint: EditorBreakpoint,
  styleClasses: EditorStyleClassMap = {},
  designTokens: EditorDesignTokenMap = {},
): ResolvedEditorElement => {
  const normalized = normalizeEditorElement(element);
  const override = breakpoint === 'desktop' ? undefined : normalized.responsive?.[breakpoint];
  const resolvedStyles = resolveElementStylesForBreakpoint(normalized, breakpoint, styleClasses, designTokens);
  const resolvedElementBase = {
    ...normalized,
    x: isFiniteNumber(override?.x) ? override.x : normalized.x,
    y: isFiniteNumber(override?.y) ? override.y : normalized.y,
    width: isFiniteNumber(override?.width) ? override.width : normalized.width,
    height: isFiniteNumber(override?.height) ? override.height : normalized.height,
    styles: resolvedStyles,
    visible: override?.visible ?? normalized.visible ?? true,
    locked: normalized.locked ?? false,
  };

  return {
    ...resolvedElementBase,
    layoutMode: getEditorLayoutMode(resolvedElementBase),
    autoPositioned: false,
  };
};

export const applyResponsiveUpdates = (
  element: EditorElement,
  updates: Partial<EditorElement>,
  breakpoint: EditorBreakpoint,
): EditorElement => {
  const normalized = normalizeEditorElement(element);
  const nextStyles = updates.styles
    ? { ...normalized.styles, ...updates.styles }
    : normalized.styles;

  if (breakpoint === 'desktop') {
    return normalizeEditorElement({
      ...normalized,
      ...updates,
      styles: nextStyles,
    });
  }

  const currentOverride = normalized.responsive?.[breakpoint] ?? {};
  const nextOverride: EditorResponsiveOverride = {
    ...currentOverride,
  };

  if (isFiniteNumber(updates.x)) {
    nextOverride.x = updates.x;
  }
  if (isFiniteNumber(updates.y)) {
    nextOverride.y = updates.y;
  }
  if (isFiniteNumber(updates.width)) {
    nextOverride.width = updates.width;
  }
  if (isFiniteNumber(updates.height)) {
    nextOverride.height = updates.height;
  }
  if (typeof updates.visible === 'boolean') {
    nextOverride.visible = updates.visible;
  }
  if (updates.styles) {
    nextOverride.styles = {
      ...(currentOverride.styles ?? {}),
      ...updates.styles,
    };
  }

  return normalizeEditorElement({
    ...normalized,
    ...updates,
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
    visible: normalized.visible,
    styles: normalized.styles,
    responsive: {
      ...normalized.responsive,
      [breakpoint]: nextOverride,
    },
  });
};

const resolveChildLayoutSlots = (
  parent: ResolvedEditorElement,
  children: ResolvedEditorElement[],
): Map<string, LayoutSlot> => {
  const slots = new Map<string, LayoutSlot>();
  const parentLayoutMode = parent.layoutMode;

  if (parentLayoutMode === 'absolute') {
    children.forEach((child) => {
      slots.set(child.id, {
        x: parent.x + child.x,
        y: parent.y + child.y,
        width: child.width,
        height: child.height,
        autoPositioned: false,
      });
    });
    return slots;
  }

  const padding = parseSpacing(parent.styles.padding);
  const gap = parseGap(parent.styles.gap);
  const contentX = parent.x + padding.left;
  const contentY = parent.y + padding.top;
  const contentWidth = Math.max(parent.width - padding.left - padding.right, 0);
  const contentHeight = Math.max(parent.height - padding.top - padding.bottom, 0);

  if (parentLayoutMode === 'flex') {
    const direction = getFlexDirection(parent);
    const align = getLayoutAlign(parent, parentLayoutMode);
    const justify = getLayoutJustify(parent);
    const mainSizes = children.map((child) => (direction === 'row' ? child.width : child.height));
    const totalBaseMain = mainSizes.reduce((sum, size) => sum + size, 0);
    const totalGap = gap * Math.max(children.length - 1, 0);
    const availableMain = direction === 'row' ? contentWidth : contentHeight;
    const freeMain = Math.max(availableMain - totalBaseMain - totalGap, 0);
    const gapSize =
      justify === 'space-between' && children.length > 1
        ? gap + freeMain / (children.length - 1)
        : gap;
    const mainStart =
      justify === 'center'
        ? freeMain / 2
        : justify === 'flex-end' || justify === 'end'
          ? freeMain
          : 0;

    let cursor = mainStart;
    children.forEach((child) => {
      const crossAvailable = direction === 'row' ? contentHeight : contentWidth;
      const childWidth =
        direction === 'column' && align === 'stretch'
          ? contentWidth
          : child.width;
      const childHeight =
        direction === 'row' && align === 'stretch'
          ? contentHeight
          : child.height;
      const crossSize = direction === 'row' ? childHeight : childWidth;
      const crossOffset = align === 'stretch'
        ? 0
        : getAlignedOffset(crossAvailable, crossSize, align);

      const x = direction === 'row' ? contentX + cursor : contentX + crossOffset;
      const y = direction === 'row' ? contentY + crossOffset : contentY + cursor;

      slots.set(child.id, {
        x,
        y,
        width: childWidth,
        height: childHeight,
        autoPositioned: true,
      });

      cursor += (direction === 'row' ? childWidth : childHeight) + gapSize;
    });

    return slots;
  }

  const tracks = parseGridTracks(parent.styles.gridTemplateColumns);
  const columns = Math.max(1, tracks.length);
  const trackWidths = resolveGridTrackWidths(
    tracks,
    Math.max(contentWidth - gap * Math.max(columns - 1, 0), 0),
  );
  const align = getLayoutAlign(parent, parentLayoutMode);
  const rows = Array.from({ length: Math.ceil(children.length / columns) }, () => [] as ResolvedEditorElement[]);

  children.forEach((child, index) => {
    rows[Math.floor(index / columns)]?.push(child);
  });

  const rowHeights = rows.map((row) =>
    row.reduce((maxHeight, child) => Math.max(maxHeight, child.height), 0),
  );
  const totalRowsHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  const totalRowGaps = gap * Math.max(rows.length - 1, 0);
  const verticalFree = Math.max(contentHeight - totalRowsHeight - totalRowGaps, 0);
  const justify = getLayoutJustify(parent);
  const rowGap =
    justify === 'space-between' && rows.length > 1
      ? gap + verticalFree / (rows.length - 1)
      : gap;
  let rowCursor =
    justify === 'center'
      ? verticalFree / 2
      : justify === 'flex-end' || justify === 'end'
        ? verticalFree
        : 0;

  rows.forEach((row, rowIndex) => {
    let columnCursor = 0;
    const rowHeight = rowHeights[rowIndex] ?? 0;

    row.forEach((child, columnIndex) => {
      const trackWidth = trackWidths[columnIndex] ?? trackWidths[trackWidths.length - 1] ?? contentWidth;
      const childWidth = align === 'stretch'
        ? trackWidth
        : Math.min(child.width, trackWidth);
      const childHeight = child.height;
      const xOffset = align === 'stretch'
        ? 0
        : getAlignedOffset(trackWidth, childWidth, align);

      slots.set(child.id, {
        x: contentX + columnCursor + xOffset,
        y: contentY + rowCursor,
        width: childWidth,
        height: childHeight,
        autoPositioned: true,
      });

      columnCursor += trackWidth + gap;
    });

    rowCursor += rowHeight + rowGap;
  });

  return slots;
};

export const resolveRenderableElements = (
  elements: EditorElement[],
  breakpoint: EditorBreakpoint,
  styleClasses: EditorStyleClassMap = {},
  designTokens: EditorDesignTokenMap = {},
): ResolvedEditorElement[] => {
  const syncedElements = synchronizeElementChildren(elements);
  const elementsById = new Map(syncedElements.map((element) => [element.id, element]));
  const resolvedById = new Map(
    syncedElements.map((element) => {
      const resolved = resolveElementForBreakpoint(element, breakpoint, styleClasses, designTokens);
      const normalizedResolved: ResolvedEditorElement = {
        ...resolved,
        layoutMode: getEditorLayoutMode(resolved),
        autoPositioned: false,
      };
      return [
        element.id,
        normalizedResolved,
      ];
    }),
  );
  const renderables: ResolvedEditorElement[] = [];

  const visitElement = (
    elementId: string,
    parentRenderable?: ResolvedEditorElement,
    inheritedVisible = true,
    inheritedLocked = false,
    layoutSlot?: LayoutSlot,
  ) => {
    const source = elementsById.get(elementId);
    const baseResolved = resolvedById.get(elementId);
    if (!source || !baseResolved) {
      throw new Error(`Unable to resolve editor element: ${elementId}`);
    }

    const renderable: ResolvedEditorElement = {
      ...baseResolved,
      x: layoutSlot
        ? layoutSlot.x
        : parentRenderable
          ? parentRenderable.x + baseResolved.x
          : baseResolved.x,
      y: layoutSlot
        ? layoutSlot.y
        : parentRenderable
          ? parentRenderable.y + baseResolved.y
          : baseResolved.y,
      width: layoutSlot?.width ?? baseResolved.width,
      height: layoutSlot?.height ?? baseResolved.height,
      visible: baseResolved.visible && inheritedVisible,
      locked: baseResolved.locked || inheritedLocked,
      autoPositioned: layoutSlot?.autoPositioned ?? false,
    };

    renderables.push(renderable);

    const childIds = source.children ?? [];
    if (childIds.length === 0) {
      return;
    }

    const childResolved = childIds
      .map((childId) => resolvedById.get(childId))
      .filter((child): child is ResolvedEditorElement => Boolean(child));
    const childSlots = resolveChildLayoutSlots(renderable, childResolved);

    childIds.forEach((childId) => {
      visitElement(
        childId,
        renderable,
        renderable.visible,
        renderable.locked,
        childSlots.get(childId),
      );
    });
  };

  syncedElements
    .filter((element) => !element.parent || !elementsById.has(element.parent))
    .forEach((element) => visitElement(element.id));

  return renderables.filter((element) => element.visible);
};

export const getElementDisplayName = (element: EditorElement): string => {
  if (typeof element.name === 'string' && element.name.trim()) {
    return element.name.trim();
  }

  if (typeof element.props.name === 'string' && element.props.name.trim()) {
    return element.props.name.trim();
  }

  if (typeof element.props.text === 'string' && element.props.text.trim()) {
    const normalized = element.props.text.trim().replace(/\s+/g, ' ');
    return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
  }

  return element.type.charAt(0).toUpperCase() + element.type.slice(1);
};
