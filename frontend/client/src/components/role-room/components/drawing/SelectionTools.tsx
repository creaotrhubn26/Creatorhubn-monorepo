// @ts-nocheck
/**
 * SelectionTools - Selection and transformation for canvas objects
 * 
 * Features:
 * - Lasso selection
 * - Rectangle selection
 * - Move selected objects
 * - Scale with handles
 * - Rotate with corner rotation
 * - Group/Ungroup selection
 * - Copy/Paste/Delete
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Tooltip,
  Divider,
  Typography,
  Slider,
  Popover,
} from '@mui/material';
import {
  HighlightAlt,
  CropFree,
  OpenWith,
  Rotate90DegreesCcw,
  PanoramaFishEye,
  SwapHoriz,
  FilterCenterFocus,
  Flip,
  FlipCameraAndroid,
  ContentCopy,
  ContentPaste,
  Delete,
  SelectAll,
  Deselect,
  GroupWork,
  CallSplit,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import type { PencilPoint, PencilStroke } from '../../hooks/useApplePencil';

// =============================================================================
// Types
// =============================================================================

export type SelectionMode = 'none' | 'rectangle' | 'ellipse' | 'lasso' | 'move' | 'scale' | 'rotate';

export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  pivotX?: number;
  pivotY?: number;
  customPivot?: boolean;
}

export type CornerWarpCorner = 'nw' | 'ne' | 'se' | 'sw';

export interface CornerWarpOffset {
  x: number;
  y: number;
}

export interface CornerWarp {
  nw: CornerWarpOffset;
  ne: CornerWarpOffset;
  se: CornerWarpOffset;
  sw: CornerWarpOffset;
}

export interface Transform {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  perspectiveX: number;
  perspectiveY: number;
  cornerWarp?: CornerWarp;
}

export interface SelectionToolsProps {
  mode: SelectionMode;
  onModeChange: (mode: SelectionMode) => void;
  selectedStrokeIds: string[];
  onSelectionChange: (ids: string[]) => void;
  bounds: SelectionBounds | null;
  onTransform: (transform: Transform) => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onInvertSelection?: () => void;
  onResetPivot?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  canPaste: boolean;
  hasSelection: boolean;
  canResetPivot?: boolean;
}

// =============================================================================
// Styled Components
// =============================================================================

const ToolbarContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  backgroundColor: 'rgba(30, 30, 40, 0.95)',
  backdropFilter: 'blur(8px)',
  borderRadius: 8,
});

const ToolButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ active }) => ({
  borderRadius: 6,
  padding: 6,
  backgroundColor: active ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
  border: active ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
  '&:hover': {
    backgroundColor: active ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255,255,255,0.1)',
  },
}));

// =============================================================================
// Selection Box Component
// =============================================================================

export interface SelectionBoxProps {
  bounds: SelectionBounds;
  onTransformStart: (handle: string, e: React.PointerEvent) => void;
  showRotate?: boolean;
}

export const SelectionBox: React.FC<SelectionBoxProps> = ({
  bounds,
  onTransformStart,
  showRotate = true,
}) => {
  const handleSize = 10;
  const rotateHandleOffset = 25;
  const perspectiveHandleSize = 12;
  const perspectiveHandleOffset = 18;
  const pivotHandleSize = 12;
  const pivotX = (Number.isFinite(bounds.pivotX) ? bounds.pivotX : bounds.x + (bounds.width / 2)) - bounds.x;
  const pivotY = (Number.isFinite(bounds.pivotY) ? bounds.pivotY : bounds.y + (bounds.height / 2)) - bounds.y;

  const handles = [
    { id: 'nw', x: -handleSize/2, y: -handleSize/2, cursor: 'nwse-resize' },
    { id: 'n', x: bounds.width/2 - handleSize/2, y: -handleSize/2, cursor: 'ns-resize' },
    { id: 'ne', x: bounds.width - handleSize/2, y: -handleSize/2, cursor: 'nesw-resize' },
    { id: 'e', x: bounds.width - handleSize/2, y: bounds.height/2 - handleSize/2, cursor: 'ew-resize' },
    { id: 'se', x: bounds.width - handleSize/2, y: bounds.height - handleSize/2, cursor: 'nwse-resize' },
    { id: 's', x: bounds.width/2 - handleSize/2, y: bounds.height - handleSize/2, cursor: 'ns-resize' },
    { id: 'sw', x: -handleSize/2, y: bounds.height - handleSize/2, cursor: 'nesw-resize' },
    { id: 'w', x: -handleSize/2, y: bounds.height/2 - handleSize/2, cursor: 'ew-resize' },
  ];

  const perspectiveHandles = [
    {
      id: 'perspective-nw',
      x: -(perspectiveHandleOffset + (perspectiveHandleSize / 2)),
      y: -(perspectiveHandleOffset + (perspectiveHandleSize / 2)),
    },
    {
      id: 'perspective-ne',
      x: bounds.width + perspectiveHandleOffset - (perspectiveHandleSize / 2),
      y: -(perspectiveHandleOffset + (perspectiveHandleSize / 2)),
    },
    {
      id: 'perspective-se',
      x: bounds.width + perspectiveHandleOffset - (perspectiveHandleSize / 2),
      y: bounds.height + perspectiveHandleOffset - (perspectiveHandleSize / 2),
    },
    {
      id: 'perspective-sw',
      x: -(perspectiveHandleOffset + (perspectiveHandleSize / 2)),
      y: bounds.height + perspectiveHandleOffset - (perspectiveHandleSize / 2),
    },
  ];

  return (
    <Box
      data-testid="pencil-canvas-selection-box"
      data-selection-rotation={bounds.rotation}
      data-selection-pivot-x={Number.isFinite(bounds.pivotX) ? bounds.pivotX : bounds.x + (bounds.width / 2)}
      data-selection-pivot-y={Number.isFinite(bounds.pivotY) ? bounds.pivotY : bounds.y + (bounds.height / 2)}
      data-selection-custom-pivot={bounds.customPivot ? 'true' : 'false'}
      sx={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        transform: `rotate(${bounds.rotation}deg)`,
        transformOrigin: 'center center',
        pointerEvents: 'none',
      }}
    >
      {/* Selection border */}
      <Box
        data-testid="pencil-canvas-selection-handle-move"
        sx={{
          position: 'absolute',
          inset: -2,
          border: '2px solid #3b82f6',
          borderRadius: 1,
          pointerEvents: 'auto',
          cursor: 'move',
        }}
        onPointerDown={(e) => onTransformStart('move', e)}
      />

      {/* Dashed inner border */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          border: '1px dashed rgba(255,255,255,0.5)',
          pointerEvents: 'none',
        }}
      />

      {/* Resize handles */}
      {handles.map((handle) => (
        <Box
          key={handle.id}
          data-testid={`pencil-canvas-selection-handle-${handle.id}`}
          sx={{
            position: 'absolute',
            left: handle.x,
            top: handle.y,
            width: handleSize,
            height: handleSize,
            bgcolor: 'white',
            border: '2px solid #3b82f6',
            borderRadius: 0.5,
            cursor: handle.cursor,
            pointerEvents: 'auto',
            '&:hover': {
              bgcolor: '#3b82f6',
            },
          }}
          onPointerDown={(e) => onTransformStart(handle.id, e)}
        />
      ))}

      {perspectiveHandles.map((handle) => (
        <Box
          key={handle.id}
          data-testid={`pencil-canvas-selection-handle-${handle.id}`}
          sx={{
            position: 'absolute',
            left: handle.x,
            top: handle.y,
            width: perspectiveHandleSize,
            height: perspectiveHandleSize,
            bgcolor: '#f59e0b',
            border: '2px solid rgba(255,255,255,0.96)',
            borderRadius: 1,
            cursor: 'alias',
            pointerEvents: 'auto',
            transform: 'rotate(45deg)',
            boxShadow: '0 0 0 1px rgba(15,23,42,0.6), 0 0 18px rgba(245,158,11,0.3)',
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 2,
              borderRadius: 0.5,
              border: '1px solid rgba(15,23,42,0.55)',
            },
            '&:hover': {
              bgcolor: '#fbbf24',
              transform: 'rotate(45deg) scale(1.08)',
            },
          }}
          onPointerDown={(e) => onTransformStart(handle.id, e)}
        />
      ))}

      <Box
        data-testid="pencil-canvas-selection-handle-pivot"
        sx={{
          position: 'absolute',
          left: pivotX - (pivotHandleSize / 2),
          top: pivotY - (pivotHandleSize / 2),
          width: pivotHandleSize,
          height: pivotHandleSize,
          bgcolor: bounds.customPivot ? '#f59e0b' : 'rgba(255,255,255,0.95)',
          border: '2px solid rgba(15,23,42,0.95)',
          borderRadius: '50%',
          cursor: 'grab',
          pointerEvents: 'auto',
          boxShadow: bounds.customPivot
            ? '0 0 0 2px rgba(245,158,11,0.24), 0 0 18px rgba(245,158,11,0.32)'
            : '0 0 0 1px rgba(59,130,246,0.32)',
          '&::before, &::after': {
            content: '""',
            position: 'absolute',
            left: '50%',
            top: '50%',
            bgcolor: '#0f172a',
            transform: 'translate(-50%, -50%)',
          },
          '&::before': {
            width: 1.5,
            height: 8,
          },
          '&::after': {
            width: 8,
            height: 1.5,
          },
        }}
        onPointerDown={(e) => onTransformStart('pivot', e)}
      />

      {/* Rotate handle */}
      {showRotate && (
        <>
          <Box
            sx={{
              position: 'absolute',
              left: bounds.width / 2,
              top: -rotateHandleOffset,
              width: 1,
              height: rotateHandleOffset - handleSize,
              bgcolor: '#3b82f6',
              pointerEvents: 'none',
            }}
          />
          <Box
            data-testid="pencil-canvas-selection-handle-rotate"
            sx={{
              position: 'absolute',
              left: bounds.width / 2 - handleSize/2,
              top: -rotateHandleOffset - handleSize/2,
              width: handleSize,
              height: handleSize,
              bgcolor: '#22c55e',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'crosshair',
              pointerEvents: 'auto',
              '&:hover': {
                transform: 'scale(1.2)',
              },
            }}
            onPointerDown={(e) => onTransformStart('rotate', e)}
          />
        </>
      )}
    </Box>
  );
};

// =============================================================================
// Selection Functions
// =============================================================================

export function getStrokeBounds(strokes: PencilStroke[]): SelectionBounds | null {
  if (strokes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  strokes.forEach(stroke => {
    stroke.points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    rotation: 0,
    pivotX: (minX + maxX) / 2,
    pivotY: (minY + maxY) / 2,
    customPivot: false,
  };
}

export function isPointInBounds(point: { x: number; y: number }, bounds: SelectionBounds): boolean {
  // Simple AABB check (ignoring rotation for now)
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

export function isStrokeInRectangle(
  stroke: PencilStroke,
  rect: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  const minX = Math.min(rect.x1, rect.x2);
  const maxX = Math.max(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxY = Math.max(rect.y1, rect.y2);

  return stroke.points.some(p => 
    p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
  );
}

export function isStrokeInEllipse(
  stroke: PencilStroke,
  rect: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  const minX = Math.min(rect.x1, rect.x2);
  const maxX = Math.max(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxY = Math.max(rect.y1, rect.y2);
  const radiusX = Math.max(0.5, (maxX - minX) / 2);
  const radiusY = Math.max(0.5, (maxY - minY) / 2);
  const centerX = minX + radiusX;
  const centerY = minY + radiusY;

  return stroke.points.some((point) => {
    const normalizedX = (point.x - centerX) / radiusX;
    const normalizedY = (point.y - centerY) / radiusY;
    return ((normalizedX * normalizedX) + (normalizedY * normalizedY)) <= 1;
  });
}

export function isPointInLasso(point: { x: number; y: number }, lassoPoints: PencilPoint[]): boolean {
  if (lassoPoints.length < 3) return false;

  let inside = false;
  for (let i = 0, j = lassoPoints.length - 1; i < lassoPoints.length; j = i++) {
    const xi = lassoPoints[i].x;
    const yi = lassoPoints[i].y;
    const xj = lassoPoints[j].x;
    const yj = lassoPoints[j].y;

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

export function isStrokeInLasso(stroke: PencilStroke, lassoPoints: PencilPoint[]): boolean {
  return stroke.points.some(p => isPointInLasso(p, lassoPoints));
}

export function transformStroke(
  stroke: PencilStroke,
  transform: Transform,
  pivotX: number,
  pivotY: number,
  warpBounds?: Pick<SelectionBounds, 'x' | 'y' | 'width' | 'height'>
): PencilStroke {
  const cosA = Math.cos((transform.rotation * Math.PI) / 180);
  const sinA = Math.sin((transform.rotation * Math.PI) / 180);
  const baseLeft = ((warpBounds?.x ?? pivotX) - pivotX) * transform.scaleX;
  const baseTop = ((warpBounds?.y ?? pivotY) - pivotY) * transform.scaleY;
  const baseWidth = Math.max(0.0001, (warpBounds?.width ?? 0) * Math.max(0.0001, Math.abs(transform.scaleX)));
  const baseHeight = Math.max(0.0001, (warpBounds?.height ?? 0) * Math.max(0.0001, Math.abs(transform.scaleY)));
  const cornerWarp = transform.cornerWarp;

  return {
    ...stroke,
    points: stroke.points.map(p => {
      // Translate to origin
      let x = p.x - pivotX;
      let y = p.y - pivotY;

      // Scale
      x *= transform.scaleX;
      y *= transform.scaleY;

      if (cornerWarp && warpBounds) {
        const u = (x - baseLeft) / baseWidth;
        const v = (y - baseTop) / baseHeight;
        const invU = 1 - u;
        const invV = 1 - v;
        const warpOffsetX =
          (cornerWarp.nw.x * invU * invV) +
          (cornerWarp.ne.x * u * invV) +
          (cornerWarp.se.x * u * v) +
          (cornerWarp.sw.x * invU * v);
        const warpOffsetY =
          (cornerWarp.nw.y * invU * invV) +
          (cornerWarp.ne.y * u * invV) +
          (cornerWarp.se.y * u * v) +
          (cornerWarp.sw.y * invU * v);
        x += warpOffsetX;
        y += warpOffsetY;
      }

      // Two-axis perspective slice modeled as a simple invertible shear matrix.
      const perspectiveXPosition = x + (y * transform.perspectiveX);
      const perspectiveYPosition = (x * transform.perspectiveY) + y;

      // Rotate
      const rx = perspectiveXPosition * cosA - perspectiveYPosition * sinA;
      const ry = perspectiveXPosition * sinA + perspectiveYPosition * cosA;

      // Translate back and apply translation
      return {
        ...p,
        x: rx + pivotX + transform.translateX,
        y: ry + pivotY + transform.translateY,
      };
    }),
  };
}

// =============================================================================
// Component
// =============================================================================

export const SelectionTools: React.FC<SelectionToolsProps> = ({
  mode,
  onModeChange,
  selectedStrokeIds,
  onSelectionChange: _onSelectionChange,
  bounds: _bounds,
  onTransform,
  onCopy,
  onPaste,
  onDelete,
  onSelectAll,
  onDeselectAll,
  onInvertSelection,
  onResetPivot,
  onGroup,
  onUngroup,
  canPaste,
  hasSelection,
  canResetPivot = false,
}) => {
  const [transformAnchor, setTransformAnchor] = useState<HTMLElement | null>(null);
  const [tempTransform, setTempTransform] = useState<Transform>({
    translateX: 0,
    translateY: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    perspectiveX: 0,
    perspectiveY: 0,
  });

  const handleApplyTransform = useCallback(() => {
    onTransform(tempTransform);
    setTransformAnchor(null);
    setTempTransform({
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      perspectiveX: 0,
      perspectiveY: 0,
    });
  }, [tempTransform, onTransform]);

  return (
    <ToolbarContainer>
      {/* Selection mode buttons */}
      <Tooltip title="Rectangle Select" placement="top">
        <ToolButton
          active={mode === 'rectangle'}
          onClick={() => onModeChange(mode === 'rectangle' ? 'none' : 'rectangle')}
        >
          <CropFree sx={{ fontSize: 18 }} />
        </ToolButton>
      </Tooltip>

      <Tooltip title="Lasso Select" placement="top">
        <ToolButton
          active={mode === 'lasso'}
          onClick={() => onModeChange(mode === 'lasso' ? 'none' : 'lasso')}
        >
          <HighlightAlt sx={{ fontSize: 18 }} />
        </ToolButton>
      </Tooltip>

      <Tooltip title="Ellipse Select" placement="top">
        <ToolButton
          active={mode === 'ellipse'}
          onClick={() => onModeChange(mode === 'ellipse' ? 'none' : 'ellipse')}
        >
          <PanoramaFishEye sx={{ fontSize: 18 }} />
        </ToolButton>
      </Tooltip>

      <Tooltip title="Move" placement="top">
        <ToolButton
          active={mode === 'move'}
          onClick={() => onModeChange(mode === 'move' ? 'none' : 'move')}
        >
          <OpenWith sx={{ fontSize: 18 }} />
        </ToolButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Transform actions */}
      <Tooltip title="Rotate 90°" placement="top">
        <span>
          <IconButton 
            size="small" 
            disabled={!hasSelection}
            onClick={() => onTransform({ translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 90, perspectiveX: 0, perspectiveY: 0 })}
          >
            <Rotate90DegreesCcw sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Flip Horizontal" placement="top">
        <span>
          <IconButton 
            size="small" 
            disabled={!hasSelection}
            onClick={() => onTransform({ translateX: 0, translateY: 0, scaleX: -1, scaleY: 1, rotation: 0, perspectiveX: 0, perspectiveY: 0 })}
          >
            <Flip sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Flip Vertical" placement="top">
        <span>
          <IconButton 
            size="small" 
            disabled={!hasSelection}
            onClick={() => onTransform({ translateX: 0, translateY: 0, scaleX: 1, scaleY: -1, rotation: 0, perspectiveX: 0, perspectiveY: 0 })}
          >
            <FlipCameraAndroid sx={{ fontSize: 18, transform: 'rotate(90deg)' }} />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Transform..." placement="top">
        <span>
          <IconButton 
            size="small" 
            disabled={!hasSelection}
            data-testid="pencil-canvas-selection-transform"
            onClick={(e) => setTransformAnchor(e.currentTarget)}
          >
            <OpenWith sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Popover
        open={Boolean(transformAnchor)}
        anchorEl={transformAnchor}
        onClose={() => setTransformAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { bgcolor: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(8px)' } } }}
      >
        <Box sx={{ p: 2, width: 220 }} data-testid="pencil-canvas-selection-transform-popover">
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Transform Selection</Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Rotation: {tempTransform.rotation}°
            </Typography>
            <Slider
              size="small"
              value={tempTransform.rotation}
              min={-180}
              max={180}
              onChange={(_, v) => setTempTransform(prev => ({ ...prev, rotation: v as number }))}
            />
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Scale X: {(tempTransform.scaleX * 100).toFixed(0)}%
            </Typography>
            <Slider
              size="small"
              value={tempTransform.scaleX}
              min={0.1}
              max={3}
              step={0.1}
              onChange={(_, v) => setTempTransform(prev => ({ ...prev, scaleX: v as number }))}
            />
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Scale Y: {(tempTransform.scaleY * 100).toFixed(0)}%
            </Typography>
            <Slider
              size="small"
              value={tempTransform.scaleY}
              min={0.1}
              max={3}
              step={0.1}
              onChange={(_, v) => setTempTransform(prev => ({ ...prev, scaleY: v as number }))}
            />
          </Box>

          <Box sx={{ mb: 2 }} data-testid="pencil-canvas-selection-transform-perspective-x">
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Perspective X: {(tempTransform.perspectiveX * 100).toFixed(0)}%
            </Typography>
            <Slider
              size="small"
              value={tempTransform.perspectiveX}
              min={-1}
              max={1}
              step={0.05}
              onChange={(_, v) => setTempTransform(prev => ({ ...prev, perspectiveX: v as number }))}
            />
          </Box>

          <Box sx={{ mb: 2 }} data-testid="pencil-canvas-selection-transform-perspective-y">
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Perspective Y: {(tempTransform.perspectiveY * 100).toFixed(0)}%
            </Typography>
            <Slider
              size="small"
              value={tempTransform.perspectiveY}
              min={-1}
              max={1}
              step={0.05}
              onChange={(_, v) => setTempTransform(prev => ({ ...prev, perspectiveY: v as number }))}
            />
          </Box>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <IconButton size="small" onClick={() => setTransformAnchor(null)}>
              Cancel
            </IconButton>
            <IconButton
              size="small"
              color="primary"
              onClick={handleApplyTransform}
              data-testid="pencil-canvas-selection-transform-apply"
            >
              Apply
            </IconButton>
          </Stack>
        </Box>
      </Popover>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Selection actions */}
      <Tooltip title="Select All" placement="top">
        <IconButton size="small" onClick={onSelectAll}>
          <SelectAll sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Deselect All" placement="top">
        <span>
          <IconButton size="small" disabled={!hasSelection} onClick={onDeselectAll}>
            <Deselect sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      {onInvertSelection && (
        <Tooltip title="Invert Selection" placement="top">
          <span>
            <IconButton size="small" onClick={onInvertSelection}>
              <SwapHoriz sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      )}

      {onResetPivot && (
        <Tooltip title="Reset Pivot" placement="top">
          <span>
            <IconButton size="small" disabled={!canResetPivot} onClick={onResetPivot}>
              <FilterCenterFocus sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      )}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Clipboard */}
      <Tooltip title="Copy" placement="top">
        <span>
          <IconButton size="small" disabled={!hasSelection} onClick={onCopy}>
            <ContentCopy sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Paste" placement="top">
        <span>
          <IconButton size="small" disabled={!canPaste} onClick={onPaste}>
            <ContentPaste sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Delete" placement="top">
        <span>
          <IconButton size="small" disabled={!hasSelection} onClick={onDelete} sx={{ color: hasSelection ? 'error.main' : 'inherit' }}>
            <Delete sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>

      {/* Group actions */}
      {onGroup && onUngroup && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.1)' }} />
          
          <Tooltip title="Group" placement="top">
            <span>
              <IconButton size="small" disabled={selectedStrokeIds.length < 2} onClick={onGroup}>
                <GroupWork sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Ungroup" placement="top">
            <span>
              <IconButton size="small" disabled={!hasSelection} onClick={onUngroup}>
                <CallSplit sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}
    </ToolbarContainer>
  );
};

export default SelectionTools;
