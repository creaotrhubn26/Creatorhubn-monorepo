/**
 * FabricCanvas Component
 * Integrates Fabric.js canvas with VisualEditorContext for visual element manipulation
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as fabric from 'fabric';
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CenterFocusStrong,
  GridOff,
  GridOn,
  PanTool,
  ZoomIn,
  ZoomOut,
} from '@mui/icons-material';
import { useVisualEditor, type EditorElement } from './VisualEditorContext';
import {
  getDisplayViewport,
  getProjectViewport,
  resolveEditorDeviceProfile,
  resolveEditorBrowserViewportMetrics,
  resolveRenderableElements,
  type EditorDeviceProfile,
  type ResolvedEditorElement,
} from './visualEditorModel';

interface CollaborativeCursor {
  userId: string;
  userName: string;
  userColor: string;
  x: number;
  y: number;
  lastUpdate: Date;
}

interface ExtendedState {
  collaborativeCursors?: Record<string, CollaborativeCursor>;
}

interface FabricObjectWithId extends fabric.Object {
  id?: string;
}

interface FabricObjectWithCursor extends fabric.Object {
  isCursor?: boolean;
}

interface FabricCanvasWithMethods extends fabric.Canvas {
  sendToBack?: (obj: fabric.Object) => fabric.Canvas;
}

type FabricModifiedEvent = fabric.ModifiedEvent<fabric.TPointerEvent>;
type FabricSelectionEvent = Partial<fabric.TEvent<fabric.TPointerEvent>> & {
  selected?: fabric.FabricObject[];
};

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.1;

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === 'INPUT'
    || target.tagName === 'TEXTAREA'
    || target.isContentEditable
  );
};

const parseNumericStyle = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

const parseBorderColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  const tokens = value.trim().split(/\s+/);
  return tokens[tokens.length - 1] || fallback;
};

const parseBorderWidth = (value: unknown, fallback: number) => {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  const tokens = value.trim().split(/\s+/);
  const parsed = Number.parseFloat(tokens[0] ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

const selectionsMatch = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

interface DeviceButtonDetail {
  side: 'left' | 'right' | 'top' | 'bottom';
  offset: number;
  length: number;
  thickness: number;
}

interface DeviceCameraDetail {
  width: number;
  height: number;
  top?: number | string;
  right?: number | string;
  left?: number | string;
  bottom?: number | string;
  transform?: string;
}

interface DeviceCutoutDetail {
  width: number;
  height: number;
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
  transform?: string;
  radius: string;
}

interface DeviceHomeIndicatorDetail {
  width: number;
  height: number;
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
  transform?: string;
}

interface DeviceSurfaceRailDetail {
  width: number;
  height: number;
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
  transform?: string;
}

interface DeviceBrowserChrome {
  topBarHeight: number;
  bottomBarHeight: number;
  topInset: number;
  bottomInset: number;
  contentInsetTop: number;
  contentInsetRight: number;
  contentInsetBottom: number;
  contentInsetLeft: number;
  contentWidth: number;
  contentHeight: number;
  addressBarWidth: number;
  addressBarHeight: number;
  toolbarWidth: number;
  chipWidth: number;
  borderRadius: number;
}

interface DesktopDeckDetail {
  gap: number;
  height: number;
  width: number;
  keyboardWidth: number;
  keyboardHeight: number;
  keyWidth: number;
  keyHeight: number;
  keyGap: number;
  trackpadWidth: number;
  trackpadHeight: number;
  trackpadTop: number;
  speakerWidth: number;
}

interface DevicePreviewFrame {
  label: string;
  model: string;
  viewportLabel: string;
  contentViewportLabel: string;
  displayLabel: string;
  nativeLabel: string;
  densityLabel: string;
  physicalLabel: string;
  shellPadding: { top: number; right: number; bottom: number; left: number };
  frameRadius: number;
  screenRadius: number;
  shellBackground: string;
  shellBorder: string;
  shellShadow: string;
  accentGlow: string;
  bodyWidth: number;
  bodyHeight: number;
  footprintWidth: number;
  footprintHeight: number;
  bottomOverflow: number;
  topCamera?: DeviceCameraDetail;
  cutout?: DeviceCutoutDetail;
  homeIndicator?: DeviceHomeIndicatorDetail;
  surfaceRail?: DeviceSurfaceRailDetail;
  browserChrome?: DeviceBrowserChrome;
  sideButtons: DeviceButtonDetail[];
  desktopDeck?: DesktopDeckDetail;
}

const inchesToMm = (value: number) => value * 25.4;

const roundMetric = (value: number) =>
  Number.isInteger(value) ? value.toFixed(0) : value.toFixed(value < 10 ? 2 : 1);

const getScreenPhysicalDimensions = (deviceProfile: EditorDeviceProfile) => {
  const nativeWidthInches =
    deviceProfile.viewport.nativeWidth / Math.max(deviceProfile.displayPixelsPerInch, 1);
  const nativeHeightInches =
    deviceProfile.viewport.nativeHeight / Math.max(deviceProfile.displayPixelsPerInch, 1);

  if (Number.isFinite(nativeWidthInches) && Number.isFinite(nativeHeightInches)) {
    return {
      widthMm: inchesToMm(nativeWidthInches),
      heightMm: inchesToMm(nativeHeightInches),
    };
  }

  const diagonal = Math.sqrt(
    deviceProfile.viewport.nativeWidth ** 2 + deviceProfile.viewport.nativeHeight ** 2,
  );
  const diagonalMm = inchesToMm(deviceProfile.physical.screenDiagonalInches);

  return {
    widthMm: diagonalMm * (deviceProfile.viewport.nativeWidth / Math.max(diagonal, 1)),
    heightMm: diagonalMm * (deviceProfile.viewport.nativeHeight / Math.max(diagonal, 1)),
  };
};

const mmToPx = (millimeters: number, pxPerMm: number) =>
  Math.max(1, Math.round(millimeters * pxPerMm));

const getScaledBrowserViewport = (
  deviceProfile: EditorDeviceProfile,
  screenWidth: number,
  screenHeight: number,
) => {
  const baseMetrics = resolveEditorBrowserViewportMetrics(
    deviceProfile.breakpoint,
    deviceProfile.viewport.orientation,
  );
  const widthScale = screenWidth / Math.max(baseMetrics.screenWidth, 1);
  const heightScale = screenHeight / Math.max(baseMetrics.screenHeight, 1);

  return {
    topBarHeight: Math.max(1, Math.round(baseMetrics.topBarHeight * heightScale)),
    bottomBarHeight: Math.max(0, Math.round(baseMetrics.bottomBarHeight * heightScale)),
    contentInsetTop: Math.max(0, Math.round(baseMetrics.contentInsetTop * heightScale)),
    contentInsetRight: Math.max(0, Math.round(baseMetrics.contentInsetRight * widthScale)),
    contentInsetBottom: Math.max(0, Math.round(baseMetrics.contentInsetBottom * heightScale)),
    contentInsetLeft: Math.max(0, Math.round(baseMetrics.contentInsetLeft * widthScale)),
    contentWidth: Math.max(1, Math.round(baseMetrics.contentWidth * widthScale)),
    contentHeight: Math.max(1, Math.round(baseMetrics.contentHeight * heightScale)),
  };
};

const buildHandheldFrame = (
  deviceProfile: EditorDeviceProfile,
  screenWidth: number,
  screenHeight: number,
): DevicePreviewFrame => {
  const screenPhysical = getScreenPhysicalDimensions(deviceProfile);
  const pxPerMm = screenWidth / Math.max(screenPhysical.widthMm, 1);
  const bodyWidth = Math.round(deviceProfile.physical.widthMm * pxPerMm);
  const bodyHeight = Math.round(deviceProfile.physical.heightMm * pxPerMm);
  const isPhone = deviceProfile.formFactor === 'mobile';
  const minimumBezel = isPhone ? 6 : 8;
  const horizontalPadding = Math.max(minimumBezel, Math.round((bodyWidth - screenWidth) / 2));
  const verticalPadding = Math.max(minimumBezel, Math.round((bodyHeight - screenHeight) / 2));
  const isLandscape = deviceProfile.viewport.orientation === 'landscape';
  const browserViewport = getScaledBrowserViewport(deviceProfile, screenWidth, screenHeight);
  const cameraSize = isPhone ? mmToPx(2.1, pxPerMm) : mmToPx(2.2, pxPerMm);
  const cameraInset = isPhone
    ? Math.max(12, Math.round(verticalPadding * 0.58))
    : Math.max(12, Math.round(Math.min(horizontalPadding, verticalPadding) * 0.58));
  const bodyCornerRadius = isPhone
    ? Math.max(42, mmToPx(13.5, pxPerMm))
    : Math.max(30, mmToPx(12.5, pxPerMm));
  const screenCornerRadius = isPhone
    ? Math.max(28, mmToPx(8.6, pxPerMm))
    : Math.max(20, mmToPx(6.8, pxPerMm));

  const phonePortraitButtons: DeviceButtonDetail[] = [
    { side: 'left', offset: Math.round(bodyHeight * 0.165), length: Math.round(bodyHeight * 0.048), thickness: 4 },
    { side: 'left', offset: Math.round(bodyHeight * 0.252), length: Math.round(bodyHeight * 0.088), thickness: 4 },
    { side: 'left', offset: Math.round(bodyHeight * 0.348), length: Math.round(bodyHeight * 0.088), thickness: 4 },
    { side: 'right', offset: Math.round(bodyHeight * 0.25), length: Math.round(bodyHeight * 0.14), thickness: 4 },
  ];
  const phoneLandscapeButtons: DeviceButtonDetail[] = [
    { side: 'top', offset: Math.round(bodyWidth * 0.18), length: Math.round(bodyWidth * 0.065), thickness: 4 },
    { side: 'top', offset: Math.round(bodyWidth * 0.33), length: Math.round(bodyWidth * 0.11), thickness: 4 },
    { side: 'top', offset: Math.round(bodyWidth * 0.46), length: Math.round(bodyWidth * 0.11), thickness: 4 },
    { side: 'bottom', offset: Math.round(bodyWidth * 0.29), length: Math.round(bodyWidth * 0.16), thickness: 4 },
  ];
  const tabletLandscapeButtons: DeviceButtonDetail[] = [
    { side: 'top', offset: Math.round(bodyWidth * 0.63), length: Math.round(bodyWidth * 0.08), thickness: 4 },
    { side: 'top', offset: Math.round(bodyWidth * 0.75), length: Math.round(bodyWidth * 0.1), thickness: 4 },
  ];
  const tabletPortraitButtons: DeviceButtonDetail[] = [
    { side: 'right', offset: Math.round(bodyHeight * 0.2), length: Math.round(bodyHeight * 0.07), thickness: 4 },
    { side: 'right', offset: Math.round(bodyHeight * 0.3), length: Math.round(bodyHeight * 0.09), thickness: 4 },
  ];
  const phoneIslandLength = isLandscape
    ? Math.max(30, Math.round(screenHeight * 0.32))
    : Math.max(108, Math.round(screenWidth * 0.305));
  const phoneIslandThickness = isLandscape
    ? Math.max(28, Math.round(screenWidth * 0.07))
    : Math.max(30, Math.round(screenHeight * 0.035));
  const phoneIslandInset = Math.max(12, Math.round((isLandscape ? horizontalPadding : verticalPadding) * 0.48));
  const phoneHomeIndicatorLength = isLandscape
    ? Math.max(54, Math.round(screenHeight * 0.2))
    : Math.max(86, Math.round(screenWidth * 0.22));
  const browserInset = isPhone ? Math.max(12, Math.round(screenWidth * 0.045)) : Math.max(18, Math.round(screenWidth * 0.04));

  return {
    label: `${deviceProfile.label} Preview`,
    model: deviceProfile.model,
    viewportLabel: `Viewport ${screenWidth} × ${screenHeight} pt`,
    contentViewportLabel: `Web viewport ${browserViewport.contentWidth} × ${browserViewport.contentHeight} pt`,
    displayLabel: `${deviceProfile.physical.screenDiagonalInches}" display • ${deviceProfile.viewport.orientation}`,
    nativeLabel: `Native ${deviceProfile.viewport.nativeWidth} × ${deviceProfile.viewport.nativeHeight} px`,
    densityLabel: `Retina @${deviceProfile.viewport.devicePixelRatio}x`,
    physicalLabel: `${roundMetric(deviceProfile.physical.widthMm)} × ${roundMetric(deviceProfile.physical.heightMm)} × ${roundMetric(deviceProfile.physical.thicknessMm)} mm`,
    shellPadding: {
      top: verticalPadding,
      right: horizontalPadding,
      bottom: verticalPadding,
      left: horizontalPadding,
    },
    frameRadius: bodyCornerRadius,
    screenRadius: screenCornerRadius,
    shellBackground: isPhone
      ? 'linear-gradient(180deg, #b9b8b4 0%, #7b7b76 8%, #45484c 19%, #1d2128 36%, #090b0f 100%)'
      : 'linear-gradient(180deg, #8a9099 0%, #555d68 14%, #242a31 42%, #0a0d12 100%)',
    shellBorder: isPhone ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.18)',
    shellShadow: isPhone
      ? '0 40px 100px rgba(10, 13, 18, 0.34)'
      : '0 34px 86px rgba(14, 20, 28, 0.28)',
    accentGlow: isPhone
      ? '0 0 0 1px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -2px 8px rgba(0,0,0,0.38)'
      : '0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 8px rgba(0,0,0,0.3)',
    bodyWidth,
    bodyHeight,
    footprintWidth: bodyWidth,
    footprintHeight: bodyHeight,
    bottomOverflow: 0,
    topCamera: isPhone
      ? isLandscape
        ? {
            width: cameraSize,
            height: cameraSize,
            left: Math.max(12, Math.round(horizontalPadding * 0.54)),
            top: Math.round(bodyHeight * 0.5),
            transform: 'translateY(-50%)',
          }
        : {
            width: cameraSize,
            height: cameraSize,
            top: cameraInset,
            transform: 'translateX(-50%)',
          }
      : isLandscape
        ? {
            width: cameraSize,
            height: cameraSize,
            top: cameraInset,
            transform: 'translateX(-50%)',
          }
        : {
            width: cameraSize,
            height: cameraSize,
            right: cameraInset,
            top: Math.round(bodyHeight * 0.5),
            transform: 'translateY(-50%)',
          },
    cutout: isPhone
      ? isLandscape
        ? {
            width: phoneIslandThickness,
            height: phoneIslandLength,
            left: phoneIslandInset,
            top: '50%',
            transform: 'translateY(-50%)',
            radius: '999px',
          }
        : {
            width: phoneIslandLength,
            height: phoneIslandThickness,
            top: phoneIslandInset,
            transform: 'translateX(-50%)',
            radius: '999px',
          }
      : undefined,
    homeIndicator: isPhone
      ? isLandscape
        ? {
            width: 5,
            height: phoneHomeIndicatorLength,
            right: Math.max(8, Math.round(horizontalPadding * 0.45)),
            top: '50%',
            transform: 'translateY(-50%)',
          }
        : {
            width: phoneHomeIndicatorLength,
            height: 5,
            bottom: Math.max(8, Math.round(verticalPadding * 0.46)),
            left: '50%',
            transform: 'translateX(-50%)',
          }
      : undefined,
    surfaceRail: isPhone
      ? undefined
      : isLandscape
        ? {
            width: Math.round(bodyWidth * 0.2),
            height: 4,
            top: Math.max(8, Math.round(verticalPadding * 0.4)),
            left: '50%',
            transform: 'translateX(-50%)',
          }
        : {
            width: 4,
            height: Math.round(bodyHeight * 0.18),
            right: Math.max(8, Math.round(horizontalPadding * 0.44)),
            top: '50%',
            transform: 'translateY(-50%)',
          },
    browserChrome: {
      topBarHeight: browserViewport.topBarHeight,
      bottomBarHeight: browserViewport.bottomBarHeight,
      topInset: browserInset,
      bottomInset: browserInset,
      contentInsetTop: browserViewport.contentInsetTop,
      contentInsetRight: browserViewport.contentInsetRight,
      contentInsetBottom: browserViewport.contentInsetBottom,
      contentInsetLeft: browserViewport.contentInsetLeft,
      contentWidth: browserViewport.contentWidth,
      contentHeight: browserViewport.contentHeight,
      addressBarWidth: isPhone
        ? Math.round(screenWidth * (isLandscape ? 0.44 : 0.66))
        : Math.round(screenWidth * (isLandscape ? 0.32 : 0.48)),
      addressBarHeight: isPhone
        ? Math.max(28, Math.round(browserViewport.topBarHeight * 0.56))
        : Math.max(30, Math.round(browserViewport.topBarHeight * 0.58)),
      toolbarWidth: isPhone
        ? Math.round(screenWidth * (isLandscape ? 0.28 : 0.5))
        : Math.round(screenWidth * (isLandscape ? 0.24 : 0.36)),
      chipWidth: isPhone ? Math.round(screenWidth * 0.18) : Math.round(screenWidth * 0.14),
      borderRadius: isPhone ? 18 : 20,
    },
    sideButtons: isPhone
      ? (isLandscape ? phoneLandscapeButtons : phonePortraitButtons)
      : (isLandscape ? tabletLandscapeButtons : tabletPortraitButtons),
  };
};

const buildDesktopFrame = (
  deviceProfile: EditorDeviceProfile,
  screenWidth: number,
  screenHeight: number,
): DevicePreviewFrame => {
  const screenPhysical = getScreenPhysicalDimensions(deviceProfile);
  const pxPerMm = screenWidth / Math.max(screenPhysical.widthMm, 1);
  const browserViewport = getScaledBrowserViewport(deviceProfile, screenWidth, screenHeight);
  const lidWidth = Math.round(deviceProfile.physical.widthMm * pxPerMm);
  const sideBezel = Math.max(12, Math.round((lidWidth - screenWidth) / 2));
  const topBezel = Math.max(12, Math.round(sideBezel * 0.95));
  const bottomBezel = Math.max(16, Math.round(sideBezel * 1.3));
  const lidHeight = screenHeight + topBezel + bottomBezel;
  const deckGap = Math.max(14, Math.round(screenHeight * 0.02));
  const deckHeight = Math.max(92, Math.round(deviceProfile.physical.heightMm * pxPerMm * 0.12));
  const deckWidth = Math.round(lidWidth * 1.015);
  const keyboardWidth = Math.round(deckWidth * 0.72);
  const keyboardHeight = Math.round(deckHeight * 0.38);
  const keyGap = Math.max(4, Math.round(deckWidth * 0.004));
  const keyWidth = Math.max(12, Math.round((keyboardWidth - keyGap * 13) / 14));
  const keyHeight = Math.max(10, Math.round(deckHeight * 0.1));
  const bottomOverflow = deckGap + deckHeight + Math.max(12, Math.round(deckHeight * 0.14));

  return {
    label: `${deviceProfile.label} Preview`,
    model: deviceProfile.model,
    viewportLabel: `Viewport ${screenWidth} × ${screenHeight} pt`,
    contentViewportLabel: `Web viewport ${browserViewport.contentWidth} × ${browserViewport.contentHeight} pt`,
    displayLabel: `${deviceProfile.physical.screenDiagonalInches}" display • ${deviceProfile.viewport.orientation}`,
    nativeLabel: `Native ${deviceProfile.viewport.nativeWidth} × ${deviceProfile.viewport.nativeHeight} px`,
    densityLabel: `Retina @${deviceProfile.viewport.devicePixelRatio}x`,
    physicalLabel: `${roundMetric(deviceProfile.physical.widthMm)} × ${roundMetric(deviceProfile.physical.heightMm)} × ${roundMetric(deviceProfile.physical.thicknessMm)} mm`,
    shellPadding: {
      top: topBezel,
      right: sideBezel,
      bottom: bottomBezel,
      left: sideBezel,
    },
    frameRadius: Math.max(30, Math.round(lidWidth * 0.022)),
    screenRadius: Math.max(18, Math.round(screenWidth * 0.02)),
    shellBackground: 'linear-gradient(180deg, #66707d 0%, #39404a 14%, #1e232b 48%, #0f1318 100%)',
    shellBorder: 'rgba(255,255,255,0.18)',
    shellShadow: '0 54px 120px rgba(18, 22, 29, 0.32)',
    accentGlow: '0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 8px rgba(0,0,0,0.25)',
    bodyWidth: lidWidth,
    bodyHeight: lidHeight,
    footprintWidth: deckWidth,
    footprintHeight: lidHeight + bottomOverflow,
    bottomOverflow,
    topCamera: {
      width: 10,
      height: 10,
      top: Math.max(10, Math.round(topBezel * 0.5)),
      transform: 'translateX(-50%)',
    },
    cutout: {
      width: Math.round(screenWidth * 0.11),
      height: Math.max(26, Math.round(screenHeight * 0.03)),
      top: 0,
      radius: '0 0 14px 14px',
    },
    sideButtons: [],
    browserChrome: {
      topBarHeight: browserViewport.topBarHeight,
      bottomBarHeight: 0,
      topInset: Math.max(18, Math.round(screenWidth * 0.02)),
      bottomInset: 0,
      contentInsetTop: browserViewport.contentInsetTop,
      contentInsetRight: browserViewport.contentInsetRight,
      contentInsetBottom: browserViewport.contentInsetBottom,
      contentInsetLeft: browserViewport.contentInsetLeft,
      contentWidth: browserViewport.contentWidth,
      contentHeight: browserViewport.contentHeight,
      addressBarWidth: Math.round(screenWidth * 0.38),
      addressBarHeight: Math.max(26, Math.round(browserViewport.topBarHeight * 0.54)),
      toolbarWidth: Math.round(screenWidth * 0.18),
      chipWidth: Math.round(screenWidth * 0.09),
      borderRadius: 16,
    },
    desktopDeck: {
      gap: deckGap,
      height: deckHeight,
      width: deckWidth,
      keyboardWidth,
      keyboardHeight,
      keyWidth,
      keyHeight,
      keyGap,
      trackpadWidth: Math.round(deckWidth * 0.28),
      trackpadHeight: Math.round(deckHeight * 0.22),
      trackpadTop: Math.round(deckHeight * 0.56),
      speakerWidth: Math.round(deckWidth * 0.1),
    },
  };
};

const buildDevicePreviewFrame = (
  deviceProfile: EditorDeviceProfile,
  screenWidth: number,
  screenHeight: number,
): DevicePreviewFrame =>
  deviceProfile.formFactor === 'desktop'
    ? buildDesktopFrame(deviceProfile, screenWidth, screenHeight)
    : buildHandheldFrame(deviceProfile, screenWidth, screenHeight);

export const FabricCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<FabricCanvasWithMethods | null>(null);
  const panStartRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const isPanningRef = useRef(false);
  const livePanRef = useRef({ x: 0, y: 0 });
  const lastFittedProjectRef = useRef<string | null>(null);
  const suppressSelectionEventsRef = useRef(false);
  const {
    state,
    updateElement,
    moveElement,
    selectElements,
    dispatch,
    setZoom,
    setPan,
    setGridVisible,
  } = useVisualEditor();

  const viewport = useMemo(
    () => getProjectViewport(state.currentProject, state.currentBreakpoint, state.currentOrientation),
    [state.currentBreakpoint, state.currentOrientation, state.currentProject],
  );
  const displayViewport = useMemo(
    () => getDisplayViewport(state.currentBreakpoint, state.currentOrientation),
    [state.currentBreakpoint, state.currentOrientation],
  );
  const projectWidth = viewport.width;
  const projectHeight = viewport.height;
  const displayWidth = displayViewport.width;
  const displayHeight = displayViewport.height;
  const zoomPercent = Math.round(state.zoom * 100);
  const scaledCanvasWidth = Math.round(projectWidth * state.zoom);
  const scaledCanvasHeight = Math.round(projectHeight * state.zoom);
  const scaledDisplayWidth = Math.round(displayWidth * state.zoom);
  const scaledDisplayHeight = Math.round(displayHeight * state.zoom);
  const projectBackground = state.currentProject?.settings.backgroundColor || '#ffffff';
  const extendedState = state as typeof state & ExtendedState;
  const renderableElements = useMemo(
    () => resolveRenderableElements(
      state.elements,
      state.currentBreakpoint,
      state.styleClasses,
      state.designTokens,
    ),
    [state.currentBreakpoint, state.elements, state.styleClasses, state.designTokens],
  );
  const renderableElementMap = useMemo(
    () => new Map(renderableElements.map((element) => [element.id, element])),
    [renderableElements],
  );
  const deviceProfile = useMemo(
    () => resolveEditorDeviceProfile(state.currentBreakpoint, state.currentOrientation),
    [state.currentBreakpoint, state.currentOrientation],
  );
  const baseDeviceFrame = useMemo(
    () => buildDevicePreviewFrame(deviceProfile, displayWidth, displayHeight),
    [deviceProfile, displayHeight, displayWidth],
  );
  const deviceFrame = useMemo(
    () => buildDevicePreviewFrame(deviceProfile, scaledDisplayWidth, scaledDisplayHeight),
    [deviceProfile, scaledDisplayHeight, scaledDisplayWidth],
  );
  const browserChrome = deviceFrame.browserChrome;
  const desktopDeck = deviceFrame.desktopDeck;
  const stageMarginBottom = deviceFrame.bottomOverflow + 12;

  const [isInitialized, setIsInitialized] = useState(false);
  const [handToolEnabled, setHandToolEnabled] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [isStagePanning, setIsStagePanning] = useState(false);
  const [livePan, setLivePan] = useState(state.pan);

  const isPanMode = handToolEnabled || spacePressed;

  const updateLivePan = useCallback((nextPan: { x: number; y: number }) => {
    livePanRef.current = nextPan;
    setLivePan(nextPan);
  }, []);

  const commitPan = useCallback((nextPan: { x: number; y: number }) => {
    updateLivePan(nextPan);
    setPan(nextPan.x, nextPan.y);
  }, [setPan, updateLivePan]);

  const addHistoryEntry = useCallback((type: string, description: string) => {
    dispatch({
      type: 'ADD_HISTORY_ENTRY',
      payload: {
        action: type,
        description,
        timestamp: new Date().toISOString(),
      },
    });
  }, [dispatch]);

  const updateCollaborativeCursor = useCallback((cursor: CollaborativeCursor) => {
    dispatch({
      type: 'UPDATE_COLLABORATIVE_CURSORS',
      payload: {
        userId: cursor.userId,
        userName: cursor.userName,
        userColor: cursor.userColor,
        x: cursor.x,
        y: cursor.y,
        timestamp: cursor.lastUpdate.toISOString(),
      },
    });
  }, [dispatch]);

  const getAutoLayoutInsertionIndex = useCallback((
    elementId: string,
    parentId: string,
    nextLeft: number,
    nextTop: number,
    nextWidth: number,
    nextHeight: number,
  ) => {
    const siblings = state.elements.filter((element) => element.parent === parentId);
    const currentIndex = siblings.findIndex((element) => element.id === elementId);
    if (currentIndex === -1 || siblings.length < 2) {
      return null;
    }

    const parentSource = state.elements.find((element) => element.id === parentId);
    const parentRenderable = renderableElementMap.get(parentId);
    if (!parentSource || !parentRenderable) {
      return currentIndex;
    }

    const movedCenterX = nextLeft + nextWidth / 2;
    const movedCenterY = nextTop + nextHeight / 2;
    const siblingRenderables = siblings
      .map((element) => ({
        element,
        renderable: renderableElementMap.get(element.id),
      }))
      .filter(
        (entry): entry is { element: EditorElement; renderable: ResolvedEditorElement } =>
          Boolean(entry.renderable),
      )
      .filter((entry) => entry.element.id !== elementId);

    if (siblingRenderables.length === 0) {
      return currentIndex;
    }

    if (parentRenderable.layoutMode === 'flex') {
      const isRow = parentSource.styles.flexDirection === 'row';
      const targetIndex = siblingRenderables.reduce((count, entry) => {
        const siblingCenter = isRow
          ? entry.renderable.x + entry.renderable.width / 2
          : entry.renderable.y + entry.renderable.height / 2;
        const movedCenter = isRow ? movedCenterX : movedCenterY;
        return movedCenter > siblingCenter ? count + 1 : count;
      }, 0);

      return targetIndex;
    }

    const verticalThreshold = Math.max(
      18,
      siblingRenderables.reduce(
        (maxValue, entry) => Math.max(maxValue, entry.renderable.height * 0.4),
        nextHeight * 0.4,
      ),
    );

    const targetIndex = siblingRenderables.reduce((count, entry) => {
      const siblingCenterX = entry.renderable.x + entry.renderable.width / 2;
      const siblingCenterY = entry.renderable.y + entry.renderable.height / 2;
      const sameRow = Math.abs(movedCenterY - siblingCenterY) <= verticalThreshold;
      const isAfterSibling = movedCenterY > siblingCenterY || (sameRow && movedCenterX > siblingCenterX);
      return isAfterSibling ? count + 1 : count;
    }, 0);

    return targetIndex;
  }, [renderableElementMap, state.elements]);

  const applyCommonObjectSettings = useCallback((obj: fabric.Object, element: EditorElement | ResolvedEditorElement) => {
    const isLocked = Boolean(element.locked);
    const isAutoPositioned = 'autoPositioned' in element && Boolean(element.autoPositioned);
    const fabricObj = obj as FabricObjectWithId;

    fabricObj.set({
      id: element.id,
      selectable: !isLocked,
      hasControls: true,
      hasBorders: true,
      hoverCursor: isLocked ? 'default' : isAutoPositioned ? 'grab' : 'move',
      moveCursor: isLocked ? 'default' : isAutoPositioned ? 'grabbing' : 'grabbing',
      lockMovementX: isLocked,
      lockMovementY: isLocked,
      lockScalingX: isLocked,
      lockScalingY: isLocked,
      lockRotation: isLocked,
      transparentCorners: false,
      cornerStyle: 'circle',
      cornerColor: '#ff6b35',
      cornerStrokeColor: '#ffffff',
      cornerSize: 12,
      padding: 8,
      borderColor: '#ff6b35',
      borderDashArray: [6, 4],
    });

    return fabricObj;
  }, []);

  const createFabricObject = useCallback((element: ResolvedEditorElement): fabric.Object | null => {
    const border = element.styles.border;
    const borderRadius = parseNumericStyle(element.styles.borderRadius, 16);
    const shadowEnabled = typeof element.styles.boxShadow === 'string' && element.styles.boxShadow.trim().length > 0;
    const opacity = typeof element.styles.opacity === 'number' ? element.styles.opacity : 1;

    let obj: fabric.Object | null = null;

    switch (element.type) {
      case 'button':
      case 'card':
      case 'container':
        obj = new fabric.Rect({
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          fill: typeof element.styles.backgroundColor === 'string'
            ? element.styles.backgroundColor
            : element.type === 'button'
              ? '#ff6b35'
              : '#ffffff',
          stroke: parseBorderColor(border, element.type === 'button' ? '#ef5b24' : '#e2c5a7'),
          strokeWidth: parseBorderWidth(border, element.type === 'button' ? 2 : 1),
          rx: borderRadius,
          ry: borderRadius,
          opacity,
          shadow: shadowEnabled
            ? new fabric.Shadow({
                color: 'rgba(43, 28, 13, 0.22)',
                blur: 24,
                offsetX: 0,
                offsetY: 14,
              })
            : undefined,
        });
        break;

      case 'text': {
        const textContent = typeof element.props.text === 'string' ? element.props.text : 'Text';
        const textAlignValue = (element.styles as Record<string, unknown>).textAlign;
        obj = new fabric.IText(textContent, {
          left: element.x,
          top: element.y,
          width: element.width,
          fontSize: parseNumericStyle(element.styles.fontSize, 16),
          fontFamily: typeof element.styles.fontFamily === 'string' ? element.styles.fontFamily : 'Arial',
          fontWeight: typeof element.styles.fontWeight === 'string' ? element.styles.fontWeight : 'normal',
          lineHeight: parseNumericStyle(element.styles.lineHeight, 1.2),
          textAlign: typeof textAlignValue === 'string'
            ? textAlignValue as fabric.TextboxProps['textAlign']
            : 'left',
          fill: typeof element.styles.color === 'string' ? element.styles.color : '#1f1a15',
          opacity,
          editable: true,
        });
        break;
      }

      case 'image': {
        const imgSrc = element.props.src as string | undefined;
        if (imgSrc) {
          const placeholder = applyCommonObjectSettings(new fabric.Rect({
            left: element.x,
            top: element.y,
            width: element.width,
            height: element.height,
            fill: '#f4ede4',
            stroke: '#d7b693',
            strokeWidth: 1,
            rx: 24,
            ry: 24,
          }), element);

          const imgElement = new Image();
          imgElement.crossOrigin = 'anonymous';
          imgElement.onload = () => {
            if (!fabricCanvasRef.current) {
              return;
            }

            const canvas = fabricCanvasRef.current;
            const fabricImg = applyCommonObjectSettings(new fabric.FabricImage(imgElement, {
              left: element.x,
              top: element.y,
              scaleX: element.width / (imgElement.naturalWidth || element.width),
              scaleY: element.height / (imgElement.naturalHeight || element.height),
              opacity,
            }), element);

            canvas.remove(placeholder);
            canvas.add(fabricImg);
            canvas.requestRenderAll();
          };

          imgElement.onerror = () => {
            // Keep placeholder on error.
          };

          imgElement.src = imgSrc;
          return placeholder;
        }

        obj = new fabric.Rect({
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          fill: '#f4ede4',
          stroke: '#d7b693',
          strokeWidth: 1,
          rx: 24,
          ry: 24,
        });
        break;
      }

      default:
        obj = new fabric.Rect({
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          fill: '#ede3d5',
          stroke: '#d7b693',
          strokeWidth: 1,
          rx: 18,
          ry: 18,
        });
        break;
    }

    if (obj) {
      applyCommonObjectSettings(obj, element);
    }

    return obj;
  }, [applyCommonObjectSettings]);

  const fitCanvasToViewport = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }

    const bounds = workspace.getBoundingClientRect();
    const availableWidth = Math.max(bounds.width - 176, 320);
    const availableHeight = Math.max(bounds.height - 176, 240);
    const nextZoom = clampZoom(
      Math.min(
        availableWidth / Math.max(baseDeviceFrame.footprintWidth, 1),
        availableHeight / Math.max(baseDeviceFrame.footprintHeight, 1),
        1,
      ),
    );

    setZoom(nextZoom);
    commitPan({ x: 0, y: 0 });
  }, [baseDeviceFrame.footprintHeight, baseDeviceFrame.footprintWidth, commitPan, setZoom]);

  const resetViewport = useCallback(() => {
    setZoom(1);
    commitPan({ x: 0, y: 0 });
  }, [commitPan, setZoom]);

  const changeZoom = useCallback((direction: 'in' | 'out') => {
    const delta = direction === 'in' ? ZOOM_STEP : -ZOOM_STEP;
    setZoom(clampZoom(state.zoom + delta));
  }, [setZoom, state.zoom]);

  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) {
      return undefined;
    }

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: scaledCanvasWidth,
      height: scaledCanvasHeight,
      backgroundColor: projectBackground,
      selection: !isPanMode,
      preserveObjectStacking: true,
    });

    canvas.defaultCursor = isPanMode ? 'grab' : 'default';
    canvas.hoverCursor = isPanMode ? 'grab' : 'move';
    canvas.skipTargetFind = isPanMode;

    fabricCanvasRef.current = canvas;
    setIsInitialized(true);

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [isPanMode, projectBackground, scaledCanvasHeight, scaledCanvasWidth]);

  useEffect(() => {
    if (!fabricCanvasRef.current || !isInitialized) {
      return;
    }

    const canvas = fabricCanvasRef.current;
    canvas.setDimensions({
      width: scaledCanvasWidth,
      height: scaledCanvasHeight,
    });
    canvas.setZoom(state.zoom);
    canvas.backgroundColor = projectBackground;
    canvas.selection = !isPanMode;
    canvas.skipTargetFind = isPanMode;
    canvas.defaultCursor = isStagePanning ? 'grabbing' : isPanMode ? 'grab' : 'default';
    canvas.hoverCursor = isPanMode ? 'grab' : 'move';
    canvas.requestRenderAll();
  }, [
    isInitialized,
    isPanMode,
    isStagePanning,
    projectBackground,
    scaledCanvasHeight,
    scaledCanvasWidth,
    state.zoom,
  ]);

  useEffect(() => {
    if (!fabricCanvasRef.current || !isInitialized) {
      return;
    }

    const canvas = fabricCanvasRef.current;
    const activeId = (canvas.getActiveObject() as FabricObjectWithId | null)?.id;

    canvas.clear();
    canvas.backgroundColor = projectBackground;
    canvas.setDimensions({
      width: scaledCanvasWidth,
      height: scaledCanvasHeight,
    });
    canvas.setZoom(state.zoom);

    renderableElements.forEach((element) => {
      const obj = createFabricObject(element);
      if (obj) {
        canvas.add(obj);
      }
    });

    suppressSelectionEventsRef.current = true;

    try {
      if (state.selectedElements.length > 1) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }

      const nextSelectedId = state.selectedElements[0] ?? state.selectedElement ?? activeId;
      if (nextSelectedId) {
        const selectedObj = canvas.getObjects().find((obj) => (obj as FabricObjectWithId).id === nextSelectedId);
        if (selectedObj && activeId !== nextSelectedId) {
          canvas.setActiveObject(selectedObj);
        }
      }

      canvas.requestRenderAll();
    } finally {
      suppressSelectionEventsRef.current = false;
    }
  }, [
    createFabricObject,
    isInitialized,
    projectBackground,
    scaledCanvasHeight,
    scaledCanvasWidth,
    renderableElements,
    state.selectedElements,
    state.selectedElement,
    state.zoom,
  ]);

  useEffect(() => {
    if (!fabricCanvasRef.current || !isInitialized) {
      return;
    }

    const canvas = fabricCanvasRef.current;

    const handleObjectModified = (event: FabricModifiedEvent) => {
      const obj = event.target as FabricObjectWithId | undefined;
      if (!obj || !obj.id) {
        return;
      }

      const sourceElement = state.elements.find((element) => element.id === obj.id);
      const parentRenderable = sourceElement?.parent
        ? renderableElementMap.get(sourceElement.parent)
        : undefined;
      const nextX = (obj.left || 0) - (parentRenderable?.x ?? 0);
      const nextY = (obj.top || 0) - (parentRenderable?.y ?? 0);
      const nextWidth = (obj.width || 0) * (obj.scaleX || 1);
      const nextHeight = (obj.height || 0) * (obj.scaleY || 1);
      const isAutoPositionedChild = parentRenderable?.layoutMode === 'flex' || parentRenderable?.layoutMode === 'grid';

      if (isAutoPositionedChild && sourceElement?.parent) {
        const targetIndex = getAutoLayoutInsertionIndex(
          obj.id,
          sourceElement.parent,
          obj.left || 0,
          obj.top || 0,
          nextWidth,
          nextHeight,
        );
        const siblingIds = state.elements
          .filter((element) => element.parent === sourceElement.parent)
          .map((element) => element.id);
        const currentIndex = siblingIds.indexOf(obj.id);

        if (targetIndex !== null && targetIndex !== currentIndex) {
          moveElement(obj.id, sourceElement.parent, targetIndex);
        }

        const widthChanged = Math.abs(nextWidth - sourceElement.width) > 0.5;
        const heightChanged = Math.abs(nextHeight - sourceElement.height) > 0.5;

        if (widthChanged || heightChanged) {
          updateElement(obj.id, {
            width: nextWidth,
            height: nextHeight,
          });
        }

        if ((targetIndex === null || targetIndex === currentIndex) && !widthChanged && !heightChanged) {
          const currentRenderable = renderableElementMap.get(obj.id);
          if (currentRenderable) {
            obj.set({
              left: currentRenderable.x,
              top: currentRenderable.y,
              scaleX: 1,
              scaleY: 1,
            });
            obj.setCoords();
            fabricCanvasRef.current?.requestRenderAll();
          }
        }
      } else {
        updateElement(obj.id, {
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight,
        });
      }

      addHistoryEntry('MODIFY', `Modified element ${obj.id}`);
    };

    const handleSelection = (event: FabricSelectionEvent) => {
      if (suppressSelectionEventsRef.current) {
        return;
      }

      const selectedIds = (event.selected ?? [])
        .map((obj) => (obj as FabricObjectWithId).id)
        .filter((id): id is string => Boolean(id));

      const currentSelection = state.selectedElements.length > 0
        ? state.selectedElements
        : state.selectedElement
          ? [state.selectedElement]
          : [];

      if (selectionsMatch(selectedIds, currentSelection)) {
        return;
      }

      if (selectedIds.length > 0) {
        selectElements(selectedIds);
      }
    };

    const handleSelectionCleared = () => {
      if (suppressSelectionEventsRef.current) {
        return;
      }

      if (!isStagePanning) {
        if (state.selectedElements.length === 0 && state.selectedElement === null) {
          return;
        }
        selectElements([]);
      }
    };

    const handleCanvasMouseDown = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      const nativeEvent = event.e as MouseEvent;
      if (!(isPanMode || nativeEvent.button === 1)) {
        return;
      }

      nativeEvent.preventDefault();
      nativeEvent.stopPropagation();

      isPanningRef.current = true;
      setIsStagePanning(true);
      panStartRef.current = {
        x: nativeEvent.clientX,
        y: nativeEvent.clientY,
        originX: livePanRef.current.x,
        originY: livePanRef.current.y,
      };

      canvas.discardActiveObject();
      canvas.selection = false;
      canvas.defaultCursor = 'grabbing';
      canvas.hoverCursor = 'grabbing';
      canvas.requestRenderAll();
    };

    const handleCanvasMouseMove = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (event.pointer) {
        updateCollaborativeCursor({
          userId: 'current-user',
          userName: 'Current User',
          userColor: '#ff6b35',
          x: event.pointer.x,
          y: event.pointer.y,
          lastUpdate: new Date(),
        });
      }

      if (!isPanningRef.current || !panStartRef.current) {
        return;
      }

      const nativeEvent = event.e as MouseEvent;
      const deltaX = nativeEvent.clientX - panStartRef.current.x;
      const deltaY = nativeEvent.clientY - panStartRef.current.y;

      updateLivePan({
        x: panStartRef.current.originX + deltaX,
        y: panStartRef.current.originY + deltaY,
      });
    };

    const stopPanning = () => {
      if (!isPanningRef.current) {
        return;
      }

      isPanningRef.current = false;
      panStartRef.current = null;
      setIsStagePanning(false);
      setPan(livePanRef.current.x, livePanRef.current.y);
      canvas.selection = !isPanMode;
      canvas.defaultCursor = isPanMode ? 'grab' : 'default';
      canvas.hoverCursor = isPanMode ? 'grab' : 'move';
      canvas.requestRenderAll();
    };

    canvas.on('object:modified', handleObjectModified);
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleSelectionCleared);
    canvas.on('mouse:down', handleCanvasMouseDown);
    canvas.on('mouse:move', handleCanvasMouseMove);
    canvas.on('mouse:up', stopPanning);

    return () => {
      canvas.off('object:modified', handleObjectModified);
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
      canvas.off('selection:cleared', handleSelectionCleared);
      canvas.off('mouse:down', handleCanvasMouseDown);
      canvas.off('mouse:move', handleCanvasMouseMove);
      canvas.off('mouse:up', stopPanning);
    };
  }, [
    addHistoryEntry,
    isInitialized,
    isPanMode,
    isStagePanning,
    selectElements,
    setPan,
    state.elements,
    state.selectedElement,
    state.selectedElements,
    updateCollaborativeCursor,
    updateElement,
    updateLivePan,
    moveElement,
    getAutoLayoutInsertionIndex,
    renderableElementMap,
  ]);

  useEffect(() => {
    if (!fabricCanvasRef.current || !isInitialized) {
      return;
    }

    const canvas = fabricCanvasRef.current;
    const cursorsMap = extendedState.collaborativeCursors || {};
    const cursors = Object.values(cursorsMap).filter((cursor) => cursor.userId !== 'current-user');

    const oldCursors = canvas.getObjects().filter((obj) => (obj as FabricObjectWithCursor).isCursor);
    oldCursors.forEach((obj) => canvas.remove(obj));

    cursors.forEach((cursor) => {
      const cursorCircle = new fabric.Circle({
        left: cursor.x,
        top: cursor.y,
        radius: 8,
        fill: cursor.userColor,
        stroke: '#ffffff',
        strokeWidth: 2,
        selectable: false,
        evented: false,
        originX: 'center',
        originY: 'center',
      });

      (cursorCircle as FabricObjectWithCursor).isCursor = true;

      const cursorLabel = new fabric.FabricText(cursor.userName, {
        left: cursor.x + 12,
        top: cursor.y - 20,
        fontSize: 12,
        fill: '#ffffff',
        backgroundColor: cursor.userColor,
        selectable: false,
        evented: false,
      });

      (cursorLabel as FabricObjectWithCursor).isCursor = true;

      canvas.add(cursorCircle, cursorLabel);
    });

    canvas.requestRenderAll();
  }, [extendedState.collaborativeCursors, isInitialized]);

  useEffect(() => {
    if (!isInitialized) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setSpacePressed(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }

      setSpacePressed(false);
    };

    const handleWindowBlur = () => {
      setSpacePressed(false);
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setIsStagePanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isInitialized]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return undefined;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      setZoom(clampZoom(state.zoom + direction * ZOOM_STEP));
    };

    workspace.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      workspace.removeEventListener('wheel', handleWheel);
    };
  }, [setZoom, state.zoom]);

  useEffect(() => {
    const handleFitCanvas = (event: Event) => {
      event.preventDefault();
      fitCanvasToViewport();
    };

    window.addEventListener('visual-editor:fit-canvas', handleFitCanvas as EventListener);

    return () => {
      window.removeEventListener('visual-editor:fit-canvas', handleFitCanvas as EventListener);
    };
  }, [fitCanvasToViewport]);

  useEffect(() => {
    if (isStagePanning) {
      return;
    }

    updateLivePan(state.pan);
  }, [isStagePanning, state.pan, updateLivePan]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const projectKey = `${state.currentProject?.id ?? 'default'}:${state.currentBreakpoint}:${state.currentOrientation}:${projectWidth}:${projectHeight}`;
    if (lastFittedProjectRef.current === projectKey) {
      return;
    }

    lastFittedProjectRef.current = projectKey;
    const frame = window.requestAnimationFrame(() => {
      fitCanvasToViewport();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    fitCanvasToViewport,
    isInitialized,
    projectHeight,
    projectWidth,
    state.currentBreakpoint,
    state.currentOrientation,
    state.currentProject?.id,
  ]);

  return (
    <Box
      ref={workspaceRef}
      sx={{
        position: 'relative',
        overflow: 'auto',
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        px: { xs: 1.5, md: 3 },
        py: { xs: 3, md: 4 },
        background: `
          linear-gradient(rgba(111, 83, 54, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(111, 83, 54, 0.08) 1px, transparent 1px),
          radial-gradient(circle at top, rgba(255,255,255,0.72), rgba(255,255,255,0.18))
        `,
        backgroundSize: '28px 28px, 28px 28px, auto',
        cursor: isStagePanning ? 'grabbing' : isPanMode ? 'grab' : 'default',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 20,
          left: 24,
          zIndex: 2,
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            px: 1.25,
            py: 0.6,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.78)',
            border: '1px solid rgba(113, 87, 59, 0.12)',
            boxShadow: '0 12px 24px rgba(61, 38, 16, 0.08)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', fontWeight: 700 }}>
            {baseDeviceFrame.label}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1.25,
            py: 0.6,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(113, 87, 59, 0.1)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', fontWeight: 600 }}>
            {baseDeviceFrame.model}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1.25,
            py: 0.6,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(113, 87, 59, 0.1)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', fontWeight: 600 }}>
            {baseDeviceFrame.viewportLabel}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1.25,
            py: 0.6,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(113, 87, 59, 0.1)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', fontWeight: 600 }}>
            {baseDeviceFrame.contentViewportLabel}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1.25,
            py: 0.6,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(113, 87, 59, 0.1)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', fontWeight: 600 }}>
            {baseDeviceFrame.displayLabel}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1.25,
            py: 0.6,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(113, 87, 59, 0.1)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', fontWeight: 600 }}>
            {baseDeviceFrame.nativeLabel}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1.25,
            py: 0.6,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(113, 87, 59, 0.1)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', fontWeight: 600 }}>
            {baseDeviceFrame.densityLabel}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1.25,
            py: 0.6,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(113, 87, 59, 0.1)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', fontWeight: 600 }}>
            {baseDeviceFrame.physicalLabel}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1.25,
            py: 0.6,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(113, 87, 59, 0.1)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', fontWeight: 600 }}>
            {zoomPercent}% zoom
          </Typography>
        </Box>
      </Box>

      <Box
        data-testid="visual-editor-device-frame"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          mt: { xs: 6, md: 5 },
          mb: `${stageMarginBottom}px`,
          pt: `${deviceFrame.shellPadding.top}px`,
          pr: `${deviceFrame.shellPadding.right}px`,
          pb: `${deviceFrame.shellPadding.bottom}px`,
          pl: `${deviceFrame.shellPadding.left}px`,
          position: 'relative',
          borderRadius: `${deviceFrame.frameRadius}px`,
          background: deviceFrame.shellBackground,
          border: `1px solid ${deviceFrame.shellBorder}`,
          boxShadow: deviceFrame.shellShadow,
          backdropFilter: 'blur(14px)',
          transform: `translate3d(${livePan.x}px, ${livePan.y}px, 0)`,
          transition: isStagePanning ? 'none' : 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          boxSizing: 'content-box',
          overflow: 'visible',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 2,
            borderRadius: `${Math.max(deviceFrame.frameRadius - 2, 0)}px`,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 16%, transparent 34%, transparent 100%)',
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: `${deviceFrame.frameRadius}px`,
            boxShadow: deviceFrame.accentGlow,
            pointerEvents: 'none',
          },
        }}
      >
        {deviceFrame.topCamera && (
          <Box
            data-testid="visual-editor-device-camera"
            sx={{
              position: 'absolute',
              top: deviceFrame.topCamera.top,
              left: deviceFrame.topCamera.left ?? (deviceFrame.topCamera.right == null ? '50%' : undefined),
              right: deviceFrame.topCamera.right,
              bottom: deviceFrame.topCamera.bottom,
              transform: deviceFrame.topCamera.transform,
              width: `${deviceFrame.topCamera.width}px`,
              height: `${deviceFrame.topCamera.height}px`,
              borderRadius: '50%',
              bgcolor: '#090b10',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12), 0 0 0 3px rgba(0,0,0,0.14)',
              zIndex: 2,
            }}
          />
        )}
        {deviceFrame.cutout && (
          <Box
            data-testid="visual-editor-device-cutout"
            sx={{
              position: 'absolute',
              top: deviceFrame.cutout.top,
              left: deviceFrame.cutout.left ?? (deviceFrame.cutout.right == null ? '50%' : undefined),
              right: deviceFrame.cutout.right,
              bottom: deviceFrame.cutout.bottom,
              transform: deviceFrame.cutout.transform ?? (deviceFrame.cutout.left == null && deviceFrame.cutout.right == null ? 'translateX(-50%)' : undefined),
              width: `${deviceFrame.cutout.width}px`,
              height: `${deviceFrame.cutout.height}px`,
              borderRadius: deviceFrame.cutout.radius,
              bgcolor: '#04060a',
              boxShadow: '0 8px 18px rgba(0,0,0,0.24)',
              zIndex: 2,
            }}
          />
        )}
        {deviceFrame.surfaceRail && (
          <Box
            data-testid="visual-editor-device-rail"
            sx={{
              position: 'absolute',
              top: deviceFrame.surfaceRail.top,
              left: deviceFrame.surfaceRail.left,
              right: deviceFrame.surfaceRail.right,
              bottom: deviceFrame.surfaceRail.bottom,
              transform: deviceFrame.surfaceRail.transform,
              width: `${deviceFrame.surfaceRail.width}px`,
              height: `${deviceFrame.surfaceRail.height}px`,
              borderRadius: 999,
              bgcolor: 'rgba(255,255,255,0.26)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
              opacity: 0.72,
            }}
          />
        )}
        {deviceFrame.sideButtons.map((button, index) => (
          <Box
            key={`${button.side}-${button.offset}-${index}`}
            sx={{
              position: 'absolute',
              top: button.side === 'top' ? -2 : button.side === 'bottom' ? undefined : `${button.offset}px`,
              bottom: button.side === 'bottom' ? -2 : undefined,
              left: button.side === 'top' || button.side === 'bottom' ? `${button.offset}px` : button.side === 'left' ? -2 : undefined,
              right: button.side === 'right' ? -2 : undefined,
              width: `${button.side === 'top' || button.side === 'bottom' ? button.length : button.thickness}px`,
              height: `${button.side === 'top' || button.side === 'bottom' ? button.thickness : button.length}px`,
              borderRadius: 999,
              bgcolor: 'rgba(255,255,255,0.28)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
              opacity: 0.92,
            }}
          />
        ))}
        <Box
          data-testid="visual-editor-device-screen"
          sx={{
            position: 'relative',
            overflow: 'hidden',
            width: `${scaledDisplayWidth}px`,
            height: `${scaledDisplayHeight}px`,
            borderRadius: `${deviceFrame.screenRadius}px`,
            border: '1px solid rgba(113, 87, 59, 0.08)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 12px 18px rgba(255,255,255,0.04)',
            bgcolor: projectBackground,
          }}
        >
          {deviceFrame.browserChrome && (
            <>
              <Box
                data-testid="visual-editor-browser-top-bar"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: `${deviceFrame.browserChrome.topBarHeight}px`,
                  px: `${deviceFrame.browserChrome.topInset}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  background: 'linear-gradient(180deg, rgba(246, 240, 232, 0.94), rgba(246, 240, 232, 0.78))',
                  borderBottom: '1px solid rgba(113, 87, 59, 0.08)',
                  backdropFilter: 'blur(18px)',
                  zIndex: 2,
                  pointerEvents: 'none',
                }}
              >
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {[0, 1, 2].map((chip) => (
                    <Box
                      key={`browser-chip-${chip}`}
                      sx={{
                        width: `${Math.max(8, Math.round((browserChrome?.chipWidth ?? 48) * 0.16))}px`,
                        height: `${Math.max(8, Math.round((browserChrome?.chipWidth ?? 48) * 0.16))}px`,
                        borderRadius: '50%',
                        bgcolor: chip === 0 ? '#ff8a65' : chip === 1 ? '#ffd166' : '#7ed6a5',
                        opacity: 0.92,
                      }}
                    />
                  ))}
                </Box>
                <Box
                  data-testid="visual-editor-browser-address-bar"
                  sx={{
                    width: `${deviceFrame.browserChrome.addressBarWidth}px`,
                    height: `${deviceFrame.browserChrome.addressBarHeight}px`,
                    borderRadius: `${deviceFrame.browserChrome.borderRadius}px`,
                    bgcolor: 'rgba(255,255,255,0.8)',
                    border: '1px solid rgba(113, 87, 59, 0.1)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                  }}
                />
                <Box
                  sx={{
                    width: `${deviceFrame.browserChrome.chipWidth}px`,
                    height: `${Math.max(10, Math.round(deviceFrame.browserChrome.addressBarHeight * 0.42))}px`,
                    borderRadius: 999,
                    bgcolor: 'rgba(113, 87, 59, 0.12)',
                  }}
                />
              </Box>
              {deviceFrame.browserChrome.bottomBarHeight > 0 && (
                <Box
                  data-testid="visual-editor-browser-bottom-bar"
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: `${deviceFrame.browserChrome.bottomBarHeight}px`,
                    px: `${deviceFrame.browserChrome.bottomInset}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(180deg, rgba(246, 240, 232, 0.72), rgba(246, 240, 232, 0.9))',
                    borderTop: '1px solid rgba(113, 87, 59, 0.08)',
                    backdropFilter: 'blur(18px)',
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}
                >
                  <Box
                    sx={{
                      width: `${deviceFrame.browserChrome.toolbarWidth}px`,
                      height: `${Math.max(8, Math.round(deviceFrame.browserChrome.bottomBarHeight * 0.12))}px`,
                      borderRadius: 999,
                      bgcolor: 'rgba(113, 87, 59, 0.18)',
                    }}
                  />
                </Box>
              )}
            </>
          )}
          <Box
            data-testid="visual-editor-browser-viewport"
            sx={{
              position: 'absolute',
              top: `${deviceFrame.browserChrome?.contentInsetTop ?? 0}px`,
              right: `${deviceFrame.browserChrome?.contentInsetRight ?? 0}px`,
              bottom: `${deviceFrame.browserChrome?.contentInsetBottom ?? 0}px`,
              left: `${deviceFrame.browserChrome?.contentInsetLeft ?? 0}px`,
              overflow: 'hidden',
              borderRadius: `${Math.max(deviceFrame.screenRadius - 8, 12)}px`,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                borderRadius: `${Math.max(deviceFrame.screenRadius - 8, 12)}px`,
                pointerEvents: 'none',
                opacity: state.gridVisible ? 1 : 0,
                transition: 'opacity 160ms ease',
                backgroundImage: `
                  linear-gradient(rgba(255, 107, 53, 0.08) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255, 107, 53, 0.08) 1px, transparent 1px)
                `,
                backgroundSize: `${Math.max(18, 20 * state.zoom)}px ${Math.max(18, 20 * state.zoom)}px`,
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 18%, transparent 100%)',
              }}
            />
            <canvas ref={canvasRef} />
          </Box>
        </Box>
        {deviceFrame.homeIndicator && (
          <Box
            data-testid="visual-editor-device-home-indicator"
            sx={{
              position: 'absolute',
              top: deviceFrame.homeIndicator.top,
              right: deviceFrame.homeIndicator.right,
              bottom: deviceFrame.homeIndicator.bottom,
              left: deviceFrame.homeIndicator.left,
              transform: deviceFrame.homeIndicator.transform,
              width: `${deviceFrame.homeIndicator.width}px`,
              height: `${deviceFrame.homeIndicator.height}px`,
              borderRadius: 999,
              bgcolor: 'rgba(255,255,255,0.56)',
            }}
          />
        )}
        {deviceFrame.desktopDeck && (
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: `calc(100% + ${deviceFrame.desktopDeck.gap}px)`,
              transform: 'translateX(-50%)',
              width: `${deviceFrame.desktopDeck.width}px`,
              height: `${deviceFrame.desktopDeck.height}px`,
              borderRadius: `${Math.max(20, Math.round(deviceFrame.desktopDeck.height * 0.22))}px`,
              background: 'linear-gradient(180deg, #d7dbe2 0%, #a8b0bc 18%, #7f8896 100%)',
              border: '1px solid rgba(255,255,255,0.38)',
              boxShadow: '0 22px 38px rgba(21, 24, 30, 0.22)',
              overflow: 'hidden',
              pointerEvents: 'none',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 1,
                borderRadius: 'inherit',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.08) 26%, transparent 54%)',
              },
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                width: `${deviceFrame.desktopDeck.keyboardWidth}px`,
                height: `${deviceFrame.desktopDeck.keyboardHeight}px`,
                display: 'grid',
                gridTemplateColumns: 'repeat(14, 1fr)',
                gap: `${deviceFrame.desktopDeck.keyGap}px`,
              }}
            >
              {Array.from({ length: 56 }, (_, keyIndex) => (
                <Box
                  key={`keyboard-key-${keyIndex}`}
                  sx={{
                    width: `${desktopDeck?.keyWidth ?? 16}px`,
                    height: `${desktopDeck?.keyHeight ?? 16}px`,
                    borderRadius: `${Math.max(4, Math.round((desktopDeck?.keyHeight ?? 16) * 0.34))}px`,
                    bgcolor: 'rgba(28, 31, 37, 0.82)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
                  }}
                />
              ))}
            </Box>
            <Box
              sx={{
                position: 'absolute',
                top: 14,
                left: `calc(50% - ${Math.round(deviceFrame.desktopDeck.keyboardWidth / 2 + deviceFrame.desktopDeck.speakerWidth + 14)}px)`,
                width: `${deviceFrame.desktopDeck.speakerWidth}px`,
                height: `${deviceFrame.desktopDeck.keyboardHeight}px`,
                borderRadius: 10,
                backgroundImage: 'radial-gradient(rgba(28,31,37,0.82) 26%, transparent 28%)',
                backgroundSize: '6px 6px',
                opacity: 0.72,
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: 14,
                right: `calc(50% - ${Math.round(deviceFrame.desktopDeck.keyboardWidth / 2 + deviceFrame.desktopDeck.speakerWidth + 14)}px)`,
                width: `${deviceFrame.desktopDeck.speakerWidth}px`,
                height: `${deviceFrame.desktopDeck.keyboardHeight}px`,
                borderRadius: 10,
                backgroundImage: 'radial-gradient(rgba(28,31,37,0.82) 26%, transparent 28%)',
                backgroundSize: '6px 6px',
                opacity: 0.72,
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: `${deviceFrame.desktopDeck.trackpadTop}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                width: `${deviceFrame.desktopDeck.trackpadWidth}px`,
                height: `${deviceFrame.desktopDeck.trackpadHeight}px`,
                borderRadius: `${Math.max(12, Math.round(deviceFrame.desktopDeck.trackpadHeight * 0.22))}px`,
                border: '1px solid rgba(44, 48, 58, 0.28)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(213,219,228,0.1) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
              }}
            />
          </Box>
        )}
      </Box>

      <Paper
        elevation={0}
        sx={{
          position: 'absolute',
          right: 24,
          bottom: 24,
          zIndex: 2,
          px: 1,
          py: 0.85,
          borderRadius: 999,
          bgcolor: 'rgba(255,255,255,0.84)',
          border: '1px solid rgba(113, 87, 59, 0.12)',
          boxShadow: '0 18px 36px rgba(56, 35, 14, 0.14)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Stack direction="row" spacing={0.25} alignItems="center">
          <Tooltip title={isPanMode ? 'Switch back to select mode' : 'Pan canvas'}>
            <IconButton
              size="small"
              onClick={() => setHandToolEnabled((prev) => !prev)}
              sx={{
                bgcolor: isPanMode ? 'rgba(255, 107, 53, 0.14)' : 'transparent',
                color: isPanMode ? 'var(--ve-accent, #ff6b35)' : 'var(--ve-muted, #6f6358)',
                '&:hover': {
                  bgcolor: 'rgba(255, 107, 53, 0.12)',
                },
              }}
            >
              <PanTool fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Fit canvas to viewport">
            <IconButton
              size="small"
              onClick={fitCanvasToViewport}
              sx={{
                color: 'var(--ve-muted, #6f6358)',
                '&:hover': {
                  bgcolor: 'rgba(255, 107, 53, 0.1)',
                  color: 'var(--ve-accent, #ff6b35)',
                },
              }}
            >
              <CenterFocusStrong fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Zoom out">
            <IconButton
              size="small"
              onClick={() => changeZoom('out')}
              disabled={state.zoom <= MIN_ZOOM}
              sx={{ color: 'var(--ve-muted, #6f6358)' }}
            >
              <ZoomOut fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Reset viewport to 100%">
            <Box
              onClick={resetViewport}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  resetViewport();
                }
              }}
              sx={{
                minWidth: 62,
                px: 1.25,
                py: 0.7,
                borderRadius: 999,
                cursor: 'pointer',
                textAlign: 'center',
                color: 'var(--ve-ink, #2b2016)',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.01em',
                transition: 'background-color 160ms ease, color 160ms ease',
                '&:hover': {
                  bgcolor: 'rgba(255, 107, 53, 0.12)',
                  color: 'var(--ve-accent, #ff6b35)',
                },
              }}
            >
              {zoomPercent}%
            </Box>
          </Tooltip>

          <Tooltip title="Zoom in">
            <IconButton
              size="small"
              onClick={() => changeZoom('in')}
              disabled={state.zoom >= MAX_ZOOM}
              sx={{ color: 'var(--ve-muted, #6f6358)' }}
            >
              <ZoomIn fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={state.gridVisible ? 'Hide grid' : 'Show grid'}>
            <IconButton
              size="small"
              onClick={() => setGridVisible(!state.gridVisible)}
              sx={{
                color: state.gridVisible ? 'var(--ve-accent, #ff6b35)' : 'var(--ve-muted, #6f6358)',
                '&:hover': {
                  bgcolor: 'rgba(255, 107, 53, 0.12)',
                },
              }}
            >
              {state.gridVisible ? <GridOn fontSize="small" /> : <GridOff fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>
    </Box>
  );
};
