/**
 * Role Room producer design-system primitives.
 *
 * The cohesion layer for the producer panels — shared tokens plus the repeated
 * header / empty-state / loading / metric / error building blocks. Import from
 * here rather than copying raw rgba strings or re-implementing the header row.
 *
 * @example
 * import {
 *   PanelHeader, EmptyState, LoadingSkeleton, MetricCard, ErrorAlert,
 *   RR_COLORS, RR_RADIUS, RR_TYPE,
 * } from './ui';
 */
export { RR_COLORS, RR_RADIUS, RR_TYPE } from './tokens';
export type { RrColors, RrRadius, RrType } from './tokens';

export { default as PanelHeader } from './PanelHeader';
export type { PanelHeaderProps } from './PanelHeader';

export { default as EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateHint, EmptyStateHintTone } from './EmptyState';

export { default as LoadingSkeleton } from './LoadingSkeleton';
export type { LoadingSkeletonProps, LoadingSkeletonVariant } from './LoadingSkeleton';

export { default as MetricCard } from './MetricCard';
export type { MetricCardProps } from './MetricCard';

export { default as ErrorAlert } from './ErrorAlert';
export type { ErrorAlertProps } from './ErrorAlert';
