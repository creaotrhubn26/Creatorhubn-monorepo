import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography, type SxProps, type Theme } from '@mui/material';
import type {
  GuideAnnotationLabelPosition,
  GuideAnnotationStyle,
  GuideStepAnnotation,
} from '../../admin/visual-editor/guideTypes';

export interface GuideAnnotationStyleOption {
  id: GuideAnnotationStyle;
  label: string;
  group: 'Frame' | 'Corners' | 'Brackets' | 'Arrows' | 'Lines' | 'Markers' | 'Effects';
}

export const GUIDE_ANNOTATION_STYLE_OPTIONS: GuideAnnotationStyleOption[] = [
  { id: 'precise-box', label: 'Precise Box', group: 'Frame' },
  { id: 'tight-box', label: 'Tight Box', group: 'Frame' },
  { id: 'rounded-box', label: 'Rounded Box', group: 'Frame' },
  { id: 'dashed-box', label: 'Dashed Box', group: 'Frame' },
  { id: 'dotted-box', label: 'Dotted Box', group: 'Frame' },
  { id: 'double-box', label: 'Double Box', group: 'Frame' },
  { id: 'glow-box', label: 'Glow Box', group: 'Frame' },
  { id: 'soft-fill-box', label: 'Soft Fill Box', group: 'Frame' },
  { id: 'thick-outline-box', label: 'Thick Outline Box', group: 'Frame' },
  { id: 'neon-box', label: 'Neon Box', group: 'Frame' },
  { id: 'corners-sharp', label: 'Corner Markers (Sharp)', group: 'Corners' },
  { id: 'corners-rounded', label: 'Corner Markers (Rounded)', group: 'Corners' },
  { id: 'bracket-horizontal', label: 'Horizontal Brackets', group: 'Brackets' },
  { id: 'bracket-vertical', label: 'Vertical Brackets', group: 'Brackets' },
  { id: 'bracket-left', label: 'Left Bracket', group: 'Brackets' },
  { id: 'bracket-right', label: 'Right Bracket', group: 'Brackets' },
  { id: 'arrow-right', label: 'Arrow Right', group: 'Arrows' },
  { id: 'arrow-left', label: 'Arrow Left', group: 'Arrows' },
  { id: 'arrow-up', label: 'Arrow Up', group: 'Arrows' },
  { id: 'arrow-down', label: 'Arrow Down', group: 'Arrows' },
  { id: 'line-horizontal', label: 'Horizontal Line', group: 'Lines' },
  { id: 'line-vertical', label: 'Vertical Line', group: 'Lines' },
  { id: 'diagonal-down', label: 'Diagonal Line (↘)', group: 'Lines' },
  { id: 'diagonal-up', label: 'Diagonal Line (↗)', group: 'Lines' },
  { id: 'badge-number', label: 'Number Badge', group: 'Markers' },
  { id: 'badge-dot', label: 'Dot Marker', group: 'Markers' },
  { id: 'badge-pill', label: 'Pill Label', group: 'Markers' },
  { id: 'highlight-stripe', label: 'Highlight Stripe', group: 'Effects' },
  { id: 'focus-ring', label: 'Focus Ring', group: 'Effects' },
  { id: 'dim-spotlight', label: 'Dim Spotlight', group: 'Effects' },
];

const STYLE_LABEL_MAP = GUIDE_ANNOTATION_STYLE_OPTIONS.reduce<Record<string, string>>((acc, style) => {
  acc[style.id] = style.label;
  return acc;
}, {});

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function getLabelPositionSx(position: GuideAnnotationLabelPosition): Record<string, string | number> {
  switch (position) {
    case 'top-left':
      return { left: 0, top: -6, transform: 'translate(0,-100%)' };
    case 'top-center':
      return { left: '50%', top: -6, transform: 'translate(-50%,-100%)' };
    case 'top-right':
      return { right: 0, top: -6, transform: 'translate(0,-100%)' };
    case 'bottom-left':
      return { left: 0, bottom: -6, transform: 'translate(0,100%)' };
    case 'bottom-center':
      return { left: '50%', bottom: -6, transform: 'translate(-50%,100%)' };
    case 'bottom-right':
      return { right: 0, bottom: -6, transform: 'translate(0,100%)' };
    case 'center':
    default:
      return { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' };
  }
}

function swapVerticalPosition(position: GuideAnnotationLabelPosition): GuideAnnotationLabelPosition {
  if (position === 'top-left') return 'bottom-left';
  if (position === 'top-center') return 'bottom-center';
  if (position === 'top-right') return 'bottom-right';
  if (position === 'bottom-left') return 'top-left';
  if (position === 'bottom-center') return 'top-center';
  if (position === 'bottom-right') return 'top-right';
  return position;
}

function swapHorizontalPosition(position: GuideAnnotationLabelPosition): GuideAnnotationLabelPosition {
  if (position === 'top-left') return 'top-right';
  if (position === 'bottom-left') return 'bottom-right';
  if (position === 'top-right') return 'top-left';
  if (position === 'bottom-right') return 'bottom-left';
  return position;
}

function resolveAdaptiveLabelPosition(
  requested: GuideAnnotationLabelPosition,
  x: number,
  y: number,
  width: number,
  height: number,
): GuideAnnotationLabelPosition {
  let resolved = requested;
  const nearTopEdge = y < 4;
  const nearBottomEdge = y + height > 96;
  const nearLeftEdge = x < 4;
  const nearRightEdge = x + width > 96;

  if (resolved.startsWith('top') && nearTopEdge) {
    resolved = swapVerticalPosition(resolved);
  } else if (resolved.startsWith('bottom') && nearBottomEdge) {
    resolved = swapVerticalPosition(resolved);
  }

  if (resolved.endsWith('left') && nearRightEdge) {
    resolved = swapHorizontalPosition(resolved);
  } else if (resolved.endsWith('right') && nearLeftEdge) {
    resolved = swapHorizontalPosition(resolved);
  }

  return resolved;
}

function renderCornerBlocks(color: string, thickness: number, rounded: boolean) {
  const cornerLen = 22;
  const radius = rounded ? 4 : 0;
  return (
    <>
      <Box sx={{ position: 'absolute', left: 0, top: 0, width: cornerLen, height: thickness, bgcolor: color, borderRadius: radius }} />
      <Box sx={{ position: 'absolute', left: 0, top: 0, width: thickness, height: cornerLen, bgcolor: color, borderRadius: radius }} />
      <Box sx={{ position: 'absolute', right: 0, top: 0, width: cornerLen, height: thickness, bgcolor: color, borderRadius: radius }} />
      <Box sx={{ position: 'absolute', right: 0, top: 0, width: thickness, height: cornerLen, bgcolor: color, borderRadius: radius }} />
      <Box sx={{ position: 'absolute', left: 0, bottom: 0, width: cornerLen, height: thickness, bgcolor: color, borderRadius: radius }} />
      <Box sx={{ position: 'absolute', left: 0, bottom: 0, width: thickness, height: cornerLen, bgcolor: color, borderRadius: radius }} />
      <Box sx={{ position: 'absolute', right: 0, bottom: 0, width: cornerLen, height: thickness, bgcolor: color, borderRadius: radius }} />
      <Box sx={{ position: 'absolute', right: 0, bottom: 0, width: thickness, height: cornerLen, bgcolor: color, borderRadius: radius }} />
    </>
  );
}

function renderLineSvg(style: GuideAnnotationStyle, color: string, secondary: string, thickness: number) {
  const strokeWidth = clamp(thickness, 1, 12);
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (style === 'line-horizontal') {
    return <line x1="4" y1="50" x2="96" y2="50" {...common} />;
  }
  if (style === 'line-vertical') {
    return <line x1="50" y1="4" x2="50" y2="96" {...common} />;
  }
  if (style === 'diagonal-down') {
    return <line x1="4" y1="4" x2="96" y2="96" {...common} />;
  }
  if (style === 'diagonal-up') {
    return <line x1="4" y1="96" x2="96" y2="4" {...common} />;
  }
  if (style === 'arrow-right') {
    return (
      <>
        <line x1="8" y1="50" x2="88" y2="50" {...common} />
        <polyline points="74,35 92,50 74,65" fill="none" stroke={secondary} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  }
  if (style === 'arrow-left') {
    return (
      <>
        <line x1="92" y1="50" x2="12" y2="50" {...common} />
        <polyline points="26,35 8,50 26,65" fill="none" stroke={secondary} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  }
  if (style === 'arrow-up') {
    return (
      <>
        <line x1="50" y1="92" x2="50" y2="12" {...common} />
        <polyline points="35,26 50,8 65,26" fill="none" stroke={secondary} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  }
  return (
    <>
      <line x1="50" y1="8" x2="50" y2="88" {...common} />
      <polyline points="35,74 50,92 65,74" fill="none" stroke={secondary} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function renderAnnotationShape(annotation: GuideStepAnnotation, index: number) {
  const color = annotation.color ?? '#00d4ff';
  const secondary = annotation.secondaryColor ?? '#ffb800';
  const thickness = clamp(annotation.thickness ?? 3, 1, 12);
  const radius = clamp(annotation.radius ?? 12, 0, 32);
  const opacity = clamp((annotation.opacity ?? 100) / 100, 0.05, 1);
  const style = annotation.style;

  const boxCommon: SxProps<Theme> = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius / 2,
    opacity,
    pointerEvents: 'none',
  };

  if (style === 'precise-box' || style === 'tight-box' || style === 'rounded-box') {
    return (
      <Box
        sx={{
          ...boxCommon,
          border: `${thickness}px solid ${color}`,
          borderRadius: style === 'rounded-box' ? radius : 4,
        }}
      />
    );
  }

  if (style === 'dashed-box' || style === 'dotted-box' || style === 'double-box') {
    return (
      <Box
        sx={{
          ...boxCommon,
          border: `${thickness}px ${style === 'double-box' ? 'double' : style === 'dashed-box' ? 'dashed' : 'dotted'} ${color}`,
        }}
      />
    );
  }

  if (style === 'glow-box' || style === 'neon-box') {
    return (
      <Box
        sx={{
          ...boxCommon,
          border: `${thickness}px solid ${color}`,
          boxShadow: style === 'neon-box'
            ? `0 0 8px ${color}, 0 0 18px ${secondary}, inset 0 0 12px ${color}55`
            : `0 0 0 1px ${color}, 0 0 14px ${color}`,
        }}
      />
    );
  }

  if (style === 'soft-fill-box' || style === 'thick-outline-box') {
    return (
      <Box
        sx={{
          ...boxCommon,
          border: `${style === 'thick-outline-box' ? Math.max(thickness + 2, 4) : thickness}px solid ${color}`,
          bgcolor: `${color}${style === 'soft-fill-box' ? '26' : '10'}`,
        }}
      />
    );
  }

  if (style === 'corners-sharp' || style === 'corners-rounded') {
    return (
      <Box sx={{ ...boxCommon }}>
        {renderCornerBlocks(color, thickness, style === 'corners-rounded')}
      </Box>
    );
  }

  if (style === 'bracket-horizontal') {
    return (
      <Box sx={{ ...boxCommon }}>
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: thickness, bgcolor: color }} />
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: thickness, bgcolor: color }} />
      </Box>
    );
  }

  if (style === 'bracket-vertical') {
    return (
      <Box sx={{ ...boxCommon }}>
        <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: thickness, bgcolor: color }} />
        <Box sx={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: thickness, bgcolor: color }} />
      </Box>
    );
  }

  if (style === 'bracket-left' || style === 'bracket-right') {
    const isLeft = style === 'bracket-left';
    return (
      <Box sx={{ ...boxCommon }}>
        <Box sx={{ position: 'absolute', top: 0, bottom: 0, [isLeft ? 'left' : 'right']: 0, width: thickness, bgcolor: color }} />
        <Box sx={{ position: 'absolute', top: 0, [isLeft ? 'left' : 'right']: 0, width: 24, height: thickness, bgcolor: color }} />
        <Box sx={{ position: 'absolute', bottom: 0, [isLeft ? 'left' : 'right']: 0, width: 24, height: thickness, bgcolor: color }} />
      </Box>
    );
  }

  if (
    style === 'arrow-right' ||
    style === 'arrow-left' ||
    style === 'arrow-up' ||
    style === 'arrow-down' ||
    style === 'line-horizontal' ||
    style === 'line-vertical' ||
    style === 'diagonal-down' ||
    style === 'diagonal-up'
  ) {
    return (
      <Box sx={{ ...boxCommon }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          {renderLineSvg(style, color, secondary, thickness)}
        </svg>
      </Box>
    );
  }

  if (style === 'badge-number') {
    return (
      <Box sx={{ ...boxCommon, border: 'none' }}>
        <Box
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            bgcolor: '#0b1220',
            border: `${thickness}px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            fontWeight: 800,
            fontSize: '0.95rem',
          }}
        >
          {annotation.label?.trim() || String(index + 1)}
        </Box>
      </Box>
    );
  }

  if (style === 'badge-dot') {
    return (
      <Box sx={{ ...boxCommon, border: 'none' }}>
        <Box
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            bgcolor: color,
            boxShadow: `0 0 0 3px ${color}55, 0 0 14px ${color}`,
          }}
        />
      </Box>
    );
  }

  if (style === 'badge-pill') {
    return (
      <Box sx={{ ...boxCommon, border: 'none' }}>
        <Box
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: 999,
            bgcolor: '#0b1220d9',
            border: `${Math.max(thickness - 1, 1)}px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            fontWeight: 700,
            fontSize: '0.72rem',
            px: 1,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {annotation.label?.trim() || STYLE_LABEL_MAP[annotation.style]}
        </Box>
      </Box>
    );
  }

  if (style === 'highlight-stripe') {
    return (
      <Box sx={{ ...boxCommon, border: 'none' }}>
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '30%',
            height: '40%',
            bgcolor: `${color}55`,
            borderTop: `${Math.max(thickness - 1, 1)}px solid ${color}`,
            borderBottom: `${Math.max(thickness - 1, 1)}px solid ${color}`,
          }}
        />
      </Box>
    );
  }

  if (style === 'focus-ring') {
    return (
      <Box sx={{ ...boxCommon }}>
        <Box sx={{ position: 'absolute', inset: 0, borderRadius: radius, border: `${thickness}px solid ${color}` }} />
        <Box sx={{ position: 'absolute', inset: 6, borderRadius: Math.max(radius - 4, 4), border: `1px solid ${secondary}` }} />
      </Box>
    );
  }

  return (
    <Box sx={{ ...boxCommon }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          border: `${Math.max(thickness, 2)}px solid ${color}`,
          boxShadow: `0 0 0 9999px rgba(2,6,23,0.52)`,
          bgcolor: 'transparent',
        }}
      />
    </Box>
  );
}

function shouldRenderExternalLabel(style: GuideAnnotationStyle): boolean {
  return style !== 'badge-number' && style !== 'badge-pill';
}

export function GuideAnnotationOverlay({
  annotations,
}: {
  annotations?: GuideStepAnnotation[];
}) {
  if (!annotations?.length) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {annotations.map((annotation, index) => {
        const x = clamp(annotation.x ?? 0, 0, 100);
        const y = clamp(annotation.y ?? 0, 0, 100);
        const width = clamp(annotation.width ?? 10, 1, 100);
        const height = clamp(annotation.height ?? 10, 1, 100);
        const rotation = clamp(annotation.rotation ?? 0, -180, 180);
        const label = annotation.label?.trim();
        const labelPosition = resolveAdaptiveLabelPosition(
          annotation.labelPosition ?? 'top-left',
          x,
          y,
          width,
          height,
        );
        const tinyTarget = width <= 3.5 || height <= 2.6;

        return (
          <Box
            key={annotation.id || `${annotation.style}-${index}`}
            sx={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: `${width}%`,
              height: `${height}%`,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center',
            }}
          >
            {renderAnnotationShape(annotation, index)}
            {label && shouldRenderExternalLabel(annotation.style) && (
              <Box sx={{ position: 'absolute', ...getLabelPositionSx(labelPosition) }}>
                <Typography
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 0.75,
                    py: 0.2,
                    borderRadius: 0.75,
                    bgcolor: '#0b1220d9',
                    border: `1px solid ${annotation.color ?? '#00d4ff'}`,
                    color: annotation.color ?? '#00d4ff',
                    fontSize: tinyTarget ? '0.58rem' : '0.64rem',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    maxWidth: tinyTarget ? 96 : 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {label}
                </Typography>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export function GuideAnnotatedScreenshot({
  src,
  alt,
  annotations,
  containerSx,
  imageSx,
  onActivate,
}: {
  src: string;
  alt: string;
  annotations?: GuideStepAnnotation[];
  containerSx?: SxProps<Theme>;
  imageSx?: SxProps<Theme>;
  onActivate?: () => void;
}) {
  const interactive = Boolean(onActivate);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [overlayRect, setOverlayRect] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const syncOverlayRect = useCallback(() => {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;

    setOverlayRect({
      left: image.offsetLeft,
      top: image.offsetTop,
      width: image.clientWidth,
      height: image.clientHeight,
    });
  }, []);

  useEffect(() => {
    syncOverlayRect();

    const handleResize = () => syncOverlayRect();
    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => syncOverlayRect());
      if (containerRef.current) resizeObserver.observe(containerRef.current);
      if (imageRef.current) resizeObserver.observe(imageRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [src, syncOverlayRect]);

  return (
    <Box
      ref={containerRef}
      tabIndex={interactive ? 0 : -1}
      role={interactive ? 'button' : undefined}
      onClick={interactive ? onActivate : undefined}
      onKeyDown={
        interactive
          ? (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onActivate?.();
              }
            }
          : undefined
      }
      sx={[
        {
          position: 'relative',
          width: '100%',
          outline: 'none',
          cursor: interactive ? 'zoom-in' : 'default',
        },
        ...(Array.isArray(containerSx) ? containerSx : containerSx ? [containerSx] : []),
      ]}
    >
      <Box
        component="img"
        ref={imageRef}
        src={src}
        alt={alt}
        onLoad={syncOverlayRect}
        sx={[
          { width: '100%', maxWidth: '100%', height: 'auto', display: 'block', mx: 'auto' },
          ...(Array.isArray(imageSx) ? imageSx : imageSx ? [imageSx] : []),
        ]}
      />
      {overlayRect.width > 0 && overlayRect.height > 0 && (
        <Box
          sx={{
            position: 'absolute',
            left: overlayRect.left,
            top: overlayRect.top,
            width: overlayRect.width,
            height: overlayRect.height,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <GuideAnnotationOverlay annotations={annotations} />
        </Box>
      )}
    </Box>
  );
}
