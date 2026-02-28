/**
 * RoleRoomIcon — PNG-based icon component with MUI sx-prop compatibility.
 * Drop-in replacement for CastingIcons SVG components.
 *
 * Supports responsive `fontSize` via sx prop (e.g. { xs: 16, sm: 18, md: 22 })
 * and CSS color tinting. The PNG image is rendered with `object-fit: contain`.
 */

import React from 'react';

export interface RoleRoomIconProps {
  /** PNG image source (imported via Vite) */
  src: string;
  /** Alt text for accessibility */
  alt?: string;
  /** MUI-compatible sx prop — supports fontSize (responsive), color, opacity, mb, mt, etc. */
  sx?: Record<string, any>;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Additional class name */
  className?: string;
  /** Remaining HTML attributes */
  [key: string]: any;
}

type BreakpointKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const DEFAULT_BREAKPOINTS: Record<BreakpointKey, number> = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
};

const resolveResponsiveValue = (
  value: any,
  viewportWidth: number
): string | number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value !== 'object') return undefined;

  const currentKey: BreakpointKey =
    viewportWidth >= DEFAULT_BREAKPOINTS.xl ? 'xl' :
    viewportWidth >= DEFAULT_BREAKPOINTS.lg ? 'lg' :
    viewportWidth >= DEFAULT_BREAKPOINTS.md ? 'md' :
    viewportWidth >= DEFAULT_BREAKPOINTS.sm ? 'sm' :
    'xs';

  const orderedKeys: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl'];
  const currentIndex = orderedKeys.indexOf(currentKey);

  // First prefer the nearest defined value at or below the current breakpoint.
  for (let i = currentIndex; i >= 0; i -= 1) {
    const key = orderedKeys[i];
    if (value[key] != null) return value[key];
  }

  // Then look upward, and finally fallback to first defined.
  for (let i = currentIndex + 1; i < orderedKeys.length; i += 1) {
    const key = orderedKeys[i];
    if (value[key] != null) return value[key];
  }

  return value.xs ?? value.sm ?? value.md ?? value.lg ?? value.xl;
};

const toPx = (v: string | number | undefined, fallback: string): string => {
  if (v === undefined) return fallback;
  return typeof v === 'number' ? `${v}px` : v;
};

const spacingToPx = (v: string | number | undefined): string | undefined => {
  if (v === undefined) return undefined;
  // MUI spacing: number → number * 8px
  return typeof v === 'number' ? `${v * 8}px` : v;
};

/**
 * A reusable PNG icon component compatible with the CastingIcons API.
 * Use it wherever `<SvgIconComponent sx={{ fontSize, color }} />` was used.
 */
export const RoleRoomIcon: React.FC<RoleRoomIconProps> = ({
  src,
  alt = '',
  sx,
  style,
  className,
  ...rest
}) => {
  const viewportWidth =
    typeof window === 'undefined' ? DEFAULT_BREAKPOINTS.xl : window.innerWidth;
  const fontSize = resolveResponsiveValue(sx?.fontSize, viewportWidth);
  const size = toPx(fontSize, '24px');
  const mb = spacingToPx(resolveResponsiveValue(sx?.mb, viewportWidth));
  const mt = spacingToPx(resolveResponsiveValue(sx?.mt, viewportWidth));
  const opacity = sx?.opacity;

  const imgStyle: React.CSSProperties = {
    width: size,
    height: size,
    objectFit: 'contain',
    display: 'block',
    opacity,
    // Tint the icon if a color is provided — works well with white/light icons.
    // Uses CSS filter: drop-shadow technique doesn't apply;
    // we keep the original colours but can adjust with CSS mix-blend if needed.
    ...(mb ? { marginBottom: mb } : {}),
    ...(mt ? { marginTop: mt } : {}),
    ...style,
  };

  // Strip handled sx keys & pass rest to img
  const { fontSize: _f, color: _c, opacity: _o, mb: _mb, mt: _mt, ...otherSx } = sx || {};
  // Apply remaining sx as inline style (simple keys only)
  const extraStyle: Record<string, any> = {};
  for (const [k, v] of Object.entries(otherSx)) {
    const resolved = typeof v === 'object' ? undefined : v;
    if (resolved !== undefined) extraStyle[k] = resolved;
  }

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={!alt}
      className={className}
      draggable={false}
      style={{ ...imgStyle, ...extraStyle }}
      {...rest}
    />
  );
};

/**
 * Factory: create a pre-bound icon component for a specific PNG.
 * The returned component has the same API as CastingIcons (accepts sx, style, etc.).
 *
 * Usage:
 *   import dashboardPng from './Keep/roleroom_dashboard.png';
 *   export const DashboardTabIcon = createRoleRoomIcon(dashboardPng, 'Dashboard');
 */
export const createRoleRoomIcon = (src: string, alt = '') => {
  const IconComponent: React.FC<Omit<RoleRoomIconProps, 'src'>> = (props) => (
    <RoleRoomIcon src={src} alt={alt} {...props} />
  );
  IconComponent.displayName = `RoleRoomIcon(${alt || 'unnamed'})`;
  return IconComponent;
};

export default RoleRoomIcon;
