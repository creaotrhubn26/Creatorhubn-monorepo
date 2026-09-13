import React, { useState } from 'react';
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
}: StoryboardReviewMarkupCanvasProps) {
  const [activeAnnotation, setActiveAnnotation] = useState<StoryboardReviewAnnotation | null>(null);
  const imageUrl = frame.thumbnailUrl || frame.imageUrl;

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement>): StoryboardReviewAnnotationPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width))),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height))),
    };
  };

  const beginMarkup = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || !draft || !onDraftChange) return;
    const point = pointFromEvent(event);
    if (tool === 'pin') {
      onDraftChange({ ...draft, anchorX: point.x, anchorY: point.y });
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
          touchAction: interactive ? 'none' : 'auto',
        }}
      >
        {showMarkup && comments.map((comment, commentIndex) => {
          const active = activeCommentId === comment.id;
          return (
            <g
              key={comment.id}
              data-testid={`storyboard-review-persisted-markup-${comment.id}`}
              onClick={(event) => { event.stopPropagation(); onCommentSelect?.(comment.id); }}
              style={{ cursor: onCommentSelect ? 'pointer' : 'default', opacity: comment.status === 'resolved' ? 0.58 : 1 }}
            >
              {(comment.annotations ?? []).map((entry) => annotationElement(entry, entry.id, active))}
              {comment.anchorX != null && comment.anchorY != null && (
                <g transform={`translate(${comment.anchorX * VIEWBOX_WIDTH} ${comment.anchorY * VIEWBOX_HEIGHT})`}>
                  <circle r={active ? 17 : 14} fill={comment.status === 'resolved' ? '#34d399' : '#fbbf24'} stroke="#111827" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                  <text textAnchor="middle" dominantBaseline="central" fill="#111827" fontSize="15" fontWeight="800">
                    {commentIndex + 1}
                  </text>
                </g>
              )}
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
    </Box>
  );
}

export default StoryboardReviewMarkupCanvas;
