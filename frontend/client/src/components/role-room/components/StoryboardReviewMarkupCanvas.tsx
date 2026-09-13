import React, { useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import type {
  StoryboardReviewAnnotation,
  StoryboardReviewAnnotationColor,
  StoryboardReviewAnnotationPoint,
  StoryboardReviewAnnotationTool,
  StoryboardReviewComment,
  StoryboardReviewSnapshotFrame,
} from '@shared/storyboard-review';

const VIEWBOX_WIDTH = 1_000;
const VIEWBOX_HEIGHT = 562.5;

export type StoryboardReviewMarkupTool = 'pin' | StoryboardReviewAnnotationTool;

export interface StoryboardReviewMarkupDraft {
  anchorX: number | null;
  anchorY: number | null;
  annotations: StoryboardReviewAnnotation[];
}

export const EMPTY_STORYBOARD_REVIEW_MARKUP: StoryboardReviewMarkupDraft = {
  anchorX: null,
  anchorY: null,
  annotations: [],
};

interface StoryboardReviewMarkupCanvasProps {
  frame: StoryboardReviewSnapshotFrame;
  comments?: StoryboardReviewComment[];
  activeCommentId?: string | null;
  showMarkup?: boolean;
  draft?: StoryboardReviewMarkupDraft;
  tool?: StoryboardReviewMarkupTool;
  color?: StoryboardReviewAnnotationColor;
  interactive?: boolean;
  height?: number;
  onDraftChange?: (draft: StoryboardReviewMarkupDraft) => void;
  onCommentSelect?: (commentId: string) => void;
  onCommentAnchorChange?: (
    commentId: string,
    anchor: StoryboardReviewAnnotationPoint | null,
  ) => void | Promise<void>;
}

function scaled(point: StoryboardReviewAnnotationPoint) {
  return { x: point.x * VIEWBOX_WIDTH, y: point.y * VIEWBOX_HEIGHT };
}

function pointsAttribute(points: StoryboardReviewAnnotationPoint[]): string {
  return points.map((point) => {
    const next = scaled(point);
    return `${next.x},${next.y}`;
  }).join(' ');
}

function annotationElement(annotation: StoryboardReviewAnnotation, key: React.Key, active = false) {
  const strokeWidth = Math.max(2, annotation.strokeWidth) + (active ? 2 : 0);
  const common = {
    fill: 'none',
    stroke: annotation.color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  if (annotation.tool === 'freehand') {
    return <polyline key={key} points={pointsAttribute(annotation.points)} {...common} />;
  }
  const [startPoint, endPoint] = annotation.points;
  if (!startPoint || !endPoint) return null;
  const start = scaled(startPoint);
  const end = scaled(endPoint);
  if (annotation.tool === 'rectangle') {
    return (
      <rect
        key={key}
        x={Math.min(start.x, end.x)}
        y={Math.min(start.y, end.y)}
        width={Math.abs(end.x - start.x)}
        height={Math.abs(end.y - start.y)}
        {...common}
      />
    );
  }
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = 18 + strokeWidth;
  const left = {
    x: end.x - Math.cos(angle - Math.PI / 6) * head,
    y: end.y - Math.sin(angle - Math.PI / 6) * head,
  };
  const right = {
    x: end.x - Math.cos(angle + Math.PI / 6) * head,
    y: end.y - Math.sin(angle + Math.PI / 6) * head,
  };
  return (
    <g key={key}>
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} {...common} />
      <polyline points={`${left.x},${left.y} ${end.x},${end.y} ${right.x},${right.y}`} {...common} />
    </g>
  );
}

function makeAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mark-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function StoryboardReviewMarkupCanvas({
  frame,
  comments = [],
  activeCommentId = null,
  showMarkup = true,
  draft,
  tool = 'pin',
  color = '#fbbf24',
  interactive = false,
  height,
  onDraftChange,
  onCommentSelect,
  onCommentAnchorChange,
}: StoryboardReviewMarkupCanvasProps) {
  const [activeAnnotation, setActiveAnnotation] = useState<StoryboardReviewAnnotation | null>(null);
  const [draggedPins, setDraggedPins] = useState<Record<string, StoryboardReviewAnnotationPoint>>({});
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pinDragRef = useRef<{
    commentId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    point: StoryboardReviewAnnotationPoint;
    moved: boolean;
  } | null>(null);
  const pinPlacementRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
  } | null>(null);
  const imageUrl = frame.thumbnailUrl || frame.imageUrl;

  const pointFromClient = (clientX: number, clientY: number): StoryboardReviewAnnotationPoint => {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0.5, y: 0.5 };
    return {
      x: Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(1, bounds.width))),
      y: Math.max(0, Math.min(1, (clientY - bounds.top) / Math.max(1, bounds.height))),
    };
  };

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement>) => (
    pointFromClient(event.clientX, event.clientY)
  );

  const selectComment = (commentId: string) => {
    onCommentSelect?.(commentId);
    document.getElementById(`storyboard-review-comment-${commentId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const beginPinDrag = (
    comment: StoryboardReviewComment,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    // Velg med en gang, men ikke scroll tråden mens en finger kan være i ferd
    // med å dra. Et vanlig klikk kaller selectComment etter pointer-sekvensen.
    onCommentSelect?.(comment.id);
    if (!interactive || !comment.canEdit || !onCommentAnchorChange
        || comment.anchorX == null || comment.anchorY == null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pinDragRef.current = {
      commentId: comment.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      point: { x: comment.anchorX, y: comment.anchorY },
      moved: false,
    };
  };

  const movePin = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = pinDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointFromClient(event.clientX, event.clientY);
    drag.point = point;
    drag.moved = drag.moved
      || Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) >= 4;
    setDraggedPins((current) => ({ ...current, [drag.commentId]: point }));
  };

  const finishPinDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = pinDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pinDragRef.current = null;
    setDraggedPins((current) => {
      const next = { ...current };
      delete next[drag.commentId];
      return next;
    });
    if (drag.moved) void onCommentAnchorChange?.(drag.commentId, drag.point);
  };

  const cancelPinDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = pinDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pinDragRef.current = null;
    setDraggedPins((current) => {
      const next = { ...current };
      delete next[drag.commentId];
      return next;
    });
  };

  const nudgePin = (
    comment: StoryboardReviewComment,
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction || !interactive || !comment.canEdit || !onCommentAnchorChange
        || comment.anchorX == null || comment.anchorY == null) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.05 : 0.01;
    void onCommentAnchorChange(comment.id, {
      x: Math.max(0, Math.min(1, comment.anchorX + direction[0] * step)),
      y: Math.max(0, Math.min(1, comment.anchorY + direction[1] * step)),
    });
  };

  const beginMarkup = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || !draft || !onDraftChange) return;
    const point = pointFromEvent(event);
    if (tool === 'pin') {
      event.currentTarget.setPointerCapture(event.pointerId);
      pinPlacementRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        moved: false,
      };
      return;
    }
    if (draft.annotations.length >= 12) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveAnnotation({
      id: makeAnnotationId(),
      tool,
      color,
      strokeWidth: 3,
      points: [point, point],
    });
  };

  const continueMarkup = (event: React.PointerEvent<SVGSVGElement>) => {
    const pendingPinPlacement = pinPlacementRef.current;
    if (pendingPinPlacement?.pointerId === event.pointerId) {
      pendingPinPlacement.moved = pendingPinPlacement.moved
        || Math.hypot(
          event.clientX - pendingPinPlacement.startClientX,
          event.clientY - pendingPinPlacement.startClientY,
        ) >= 6;
      return;
    }
    if (!activeAnnotation || !interactive) return;
    const point = pointFromEvent(event);
    setActiveAnnotation((current) => {
      if (!current) return null;
      if (current.tool !== 'freehand') return { ...current, points: [current.points[0], point] };
      const previous = current.points.at(-1) ?? point;
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.004 || current.points.length >= 160) {
        return current;
      }
      return { ...current, points: [...current.points, point] };
    });
  };

  const finishMarkup = (event: React.PointerEvent<SVGSVGElement>) => {
    const pendingPinPlacement = pinPlacementRef.current;
    if (pendingPinPlacement?.pointerId === event.pointerId) {
      pinPlacementRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (!pendingPinPlacement.moved && draft && onDraftChange) {
        const point = pointFromEvent(event);
        onDraftChange({ ...draft, anchorX: point.x, anchorY: point.y });
      }
      return;
    }
    if (!activeAnnotation || !draft || !onDraftChange) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const endPoint = pointFromEvent(event);
    const firstPoint = activeAnnotation.points[0];
    if (!firstPoint || Math.hypot(endPoint.x - firstPoint.x, endPoint.y - firstPoint.y) < 0.003) {
      setActiveAnnotation(null);
      return;
    }
    const points = activeAnnotation.tool === 'freehand'
      ? [...activeAnnotation.points.slice(0, 159), endPoint]
      : [firstPoint, endPoint];
    const annotation = { ...activeAnnotation, points };
    const focus = annotation.points.at(-1) ?? annotation.points[0];
    onDraftChange({
      anchorX: focus?.x ?? draft.anchorX,
      anchorY: focus?.y ?? draft.anchorY,
      annotations: [...draft.annotations, annotation],
    });
    setActiveAnnotation(null);
  };

  const cancelMarkup = (event: React.PointerEvent<SVGSVGElement>) => {
    if (pinPlacementRef.current?.pointerId === event.pointerId) {
      pinPlacementRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setActiveAnnotation(null);
  };

  const keyboardPin = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (!interactive || tool !== 'pin' || !draft || !onDraftChange) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onDraftChange({ ...draft, anchorX: 0.5, anchorY: 0.5 });
  };

  return (
    <Box
      ref={stageRef}
      data-testid={`storyboard-review-markup-canvas-${frame.id}`}
      sx={{
        position: 'relative', width: '100%', aspectRatio: '16 / 9', height,
        bgcolor: '#08080d', borderRadius: 1.5, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,.16)',
      }}
    >
      {imageUrl ? (
        <Box
          component="img"
          src={imageUrl}
          alt={frame.description || frame.shotNumber || 'Storyboard-ramme'}
          referrerPolicy="no-referrer"
          draggable={false}
          sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', userSelect: 'none' }}
        />
      ) : (
        <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
          <Typography variant="caption" color="rgba(255,255,255,.58)">Ingen forhåndsvisning</Typography>
        </Box>
      )}
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        role={interactive ? 'application' : 'img'}
        aria-label={interactive ? 'Plasser eller tegn visuell storyboard-kommentar' : 'Visuell storyboard-kommentar'}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={keyboardPin}
        onPointerDown={beginMarkup}
        onPointerMove={continueMarkup}
        onPointerUp={finishMarkup}
        onPointerCancel={cancelMarkup}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          cursor: interactive ? (tool === 'pin' ? 'crosshair' : 'cell') : 'default',
          touchAction: interactive ? (tool === 'pin' ? 'pan-y' : 'none') : 'auto',
        }}
      >
        {showMarkup && comments.map((comment) => {
          const active = activeCommentId === comment.id;
          return (
            <g
              key={comment.id}
              data-testid={`storyboard-review-persisted-markup-${comment.id}`}
              onClick={(event) => { event.stopPropagation(); onCommentSelect?.(comment.id); }}
              style={{ cursor: onCommentSelect ? 'pointer' : 'default', opacity: comment.status === 'resolved' ? 0.58 : 1 }}
            >
              {(comment.annotations ?? []).map((entry) => annotationElement(entry, entry.id, active))}
            </g>
          );
        })}
        {draft && showMarkup && (
          <g data-testid="storyboard-review-draft-markup">
            {draft.annotations.map((entry) => annotationElement(entry, entry.id, true))}
            {activeAnnotation && annotationElement(activeAnnotation, activeAnnotation.id, true)}
            {draft.anchorX != null && draft.anchorY != null && (
              <g transform={`translate(${draft.anchorX * VIEWBOX_WIDTH} ${draft.anchorY * VIEWBOX_HEIGHT})`}>
                <circle r="16" fill={color} stroke="#111827" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                <circle r="4" fill="#111827" />
              </g>
            )}
          </g>
        )}
      </svg>
      {showMarkup && comments
        .filter((entry) => entry.anchorX != null && entry.anchorY != null)
        .map((entry, pinIndex) => {
          const position = draggedPins[entry.id] ?? { x: entry.anchorX ?? 0, y: entry.anchorY ?? 0 };
          const active = activeCommentId === entry.id;
          const movable = interactive && Boolean(entry.canEdit) && Boolean(onCommentAnchorChange);
          return (
            <button
              key={entry.id}
              type="button"
              data-testid={`storyboard-review-pin-${entry.id}`}
              aria-label={`Kommentar ${pinIndex + 1} fra ${entry.authorDisplayName}${movable ? '. Dra eller bruk piltastene for å flytte pinnen.' : ''}`}
              onPointerDown={(event) => beginPinDrag(entry, event)}
              onPointerMove={movePin}
              onPointerUp={finishPinDrag}
              onPointerCancel={cancelPinDrag}
              onKeyDown={(event) => nudgePin(entry, event)}
              onClick={(event) => { event.stopPropagation(); selectComment(entry.id); }}
              style={{
                position: 'absolute', left: `${position.x * 100}%`, top: `${position.y * 100}%`,
                width: 48, height: 48, padding: 0, border: 0, borderRadius: '50%',
                transform: 'translate(-50%, -50%)', background: 'transparent', zIndex: 3,
                display: 'grid', placeItems: 'center', touchAction: movable ? 'none' : 'manipulation',
                cursor: movable ? (draggedPins[entry.id] ? 'grabbing' : 'grab') : 'pointer',
              }}
            >
              <span style={{
                width: active ? 36 : 30, height: active ? 36 : 30, borderRadius: '50%',
                display: 'grid', placeItems: 'center', color: '#111827', fontSize: 14,
                fontWeight: 800, background: entry.status === 'resolved' ? '#34d399' : '#fbbf24',
                border: '3px solid #111827', boxShadow: active
                  ? '0 0 0 3px rgba(255,255,255,.9), 0 6px 18px rgba(0,0,0,.45)'
                  : '0 4px 12px rgba(0,0,0,.4)',
              }}>{pinIndex + 1}</span>
            </button>
          );
        })}
    </Box>
  );
}

export default StoryboardReviewMarkupCanvas;
