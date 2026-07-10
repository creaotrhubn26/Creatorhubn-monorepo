/**
 * dashboard-widget-schema.ts
 *
 * Generic, industry-agnostic widget contract for the Market Intelligence
 * dashboard (CTO audit, docs/cto-audit/10-widget-architecture.md). Every
 * dashboard widget — for Market Intelligence, Leadgrid, or any future
 * module — is described by a `WidgetInstance`. No widget-specific React
 * component should hardcode titles, data sources, or industry copy; those
 * live in the instance data (config/API/database), not in JSX.
 *
 * This file intentionally ships the contract only (schema + validators).
 * The generic `<WidgetRenderer />` and the `dashboard_layouts` /
 * `widget_instances` persistence tables are a separate, later PR — see the
 * sequencing note in docs/cto-audit/10-widget-architecture.md.
 */

import { z } from 'zod';

export const WIDGET_TYPES = [
  'kpi_card',
  'line_chart',
  'bar_chart',
  'ranking_table',
  'trend_monitor',
  'opportunity_score',
  'problem_ranking',
  'competitor_comparison',
  'market_map',
  'geographic_map',
  'ai_insight',
  'recommendation',
  'alert_feed',
  'saved_ideas',
  'evidence_panel',
  'source_quality',
  'confidence_meter',
  'funnel',
  'pipeline',
  'conversion_analysis',
  'route_performance',
  'territory_performance',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export const LOADING_STATES = ['idle', 'loading', 'loaded', 'error'] as const;
export type WidgetLoadingState = (typeof LOADING_STATES)[number];

export const DATA_FRESHNESS_LEVELS = ['live', 'cached', 'stale'] as const;
export type WidgetDataFreshness = (typeof DATA_FRESHNESS_LEVELS)[number];

export const WidgetFilterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]),
});
export type WidgetFilter = z.infer<typeof WidgetFilterSchema>;

export const TimeRangeConfigSchema = z.object({
  kind: z.enum(['relative', 'absolute']),
  /** e.g. 'last_7_days', 'last_30_days', 'last_5_years' when kind === 'relative' */
  relativeWindow: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type TimeRangeConfig = z.infer<typeof TimeRangeConfigSchema>;

export const WidgetQueryDefinitionSchema = z.object({
  dimensions: z.array(z.string()).default([]),
  metrics: z.array(z.string()).min(1),
  filters: z.array(WidgetFilterSchema).default([]),
  sorting: z
    .object({ field: z.string(), direction: z.enum(['asc', 'desc']) })
    .optional(),
  grouping: z.array(z.string()).default([]),
  timeRange: TimeRangeConfigSchema,
});
export type WidgetQueryDefinition = z.infer<typeof WidgetQueryDefinitionSchema>;

export const WidgetPermissionsSchema = z.object({
  roles: z.array(z.string()).optional(),
  minPlan: z.string().optional(),
});
export type WidgetPermissions = z.infer<typeof WidgetPermissionsSchema>;

export const WidgetLayoutPositionSchema = z.object({ x: z.number().int().min(0), y: z.number().int().min(0) });
export const WidgetLayoutSizeSchema = z.object({ w: z.number().int().min(1), h: z.number().int().min(1) });

export const WidgetErrorStateSchema = z.object({
  message: z.string().min(1),
  retryable: z.boolean().default(true),
});
export type WidgetErrorState = z.infer<typeof WidgetErrorStateSchema>;

export const WidgetEmptyStateSchema = z.object({
  message: z.string().min(1),
});
export type WidgetEmptyState = z.infer<typeof WidgetEmptyStateSchema>;

export const WidgetInstanceSchema = z.object({
  id: z.string().min(1),
  widgetType: z.enum(WIDGET_TYPES),
  title: z.string().min(1),
  description: z.string().optional(),
  /** References a Data Source entity by id/key — never a hardcoded provider name. */
  dataSource: z.string().min(1),
  queryDefinition: WidgetQueryDefinitionSchema,
  visualizationType: z.string().min(1),
  refreshInterval: z.number().int().positive().optional(),
  permissions: WidgetPermissionsSchema.default({}),
  layoutPosition: WidgetLayoutPositionSchema,
  layoutSize: WidgetLayoutSizeSchema,
  displaySettings: z.record(z.string(), z.unknown()).default({}),
  loadingState: z.enum(LOADING_STATES).default('idle'),
  emptyState: WidgetEmptyStateSchema.optional(),
  errorState: WidgetErrorStateSchema.optional(),
  lastUpdated: z.string().datetime().optional(),
  dataFreshness: z.enum(DATA_FRESHNESS_LEVELS).optional(),
  sourceAttribution: z.string().optional(),
});

export type WidgetInstance = z.infer<typeof WidgetInstanceSchema>;

export interface CreateDefaultWidgetInstanceOptions {
  id: string;
  widgetType: WidgetType;
  title: string;
  dataSource: string;
  metrics: string[];
  visualizationType?: string;
  layoutPosition?: { x: number; y: number };
  layoutSize?: { w: number; h: number };
  timeRange?: TimeRangeConfig;
}

/**
 * Builds a valid, minimal WidgetInstance so call sites don't need to repeat
 * the same defaulting boilerplate. Deliberately takes no industry-specific
 * arguments — all vertical-specific content (title text, metric keys, data
 * source) is supplied by the caller (config/API/database), never assumed here.
 */
export function createDefaultWidgetInstance(
  options: CreateDefaultWidgetInstanceOptions,
): WidgetInstance {
  return WidgetInstanceSchema.parse({
    id: options.id,
    widgetType: options.widgetType,
    title: options.title,
    dataSource: options.dataSource,
    queryDefinition: {
      dimensions: [],
      metrics: options.metrics,
      filters: [],
      grouping: [],
      timeRange: options.timeRange ?? { kind: 'relative', relativeWindow: 'last_30_days' },
    },
    visualizationType: options.visualizationType ?? options.widgetType,
    permissions: {},
    layoutPosition: options.layoutPosition ?? { x: 0, y: 0 },
    layoutSize: options.layoutSize ?? { w: 4, h: 2 },
    displaySettings: {},
    loadingState: 'idle',
  });
}

export interface WidgetInstanceValidationResult {
  valid: boolean;
  errors: string[];
  instance?: WidgetInstance;
}

/** Validates unknown input (e.g. from an API response) against the widget contract. */
export function validateWidgetInstance(input: unknown): WidgetInstanceValidationResult {
  const result = WidgetInstanceSchema.safeParse(input);
  if (result.success) {
    return { valid: true, errors: [], instance: result.data };
  }
  return {
    valid: false,
    errors: result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
  };
}
