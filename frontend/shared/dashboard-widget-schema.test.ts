import { describe, expect, it } from 'vitest';

import {
  WIDGET_TYPES,
  createDefaultWidgetInstance,
  validateWidgetInstance,
  WidgetInstanceSchema,
} from './dashboard-widget-schema';

describe('createDefaultWidgetInstance', () => {
  it('builds a valid instance from minimal input', () => {
    const instance = createDefaultWidgetInstance({
      id: 'widget-1',
      widgetType: 'kpi_card',
      title: 'Total mulighetsscore',
      dataSource: 'market_scan_opportunities',
      metrics: ['opportunity_score_avg'],
    });
    expect(instance.widgetType).toBe('kpi_card');
    expect(instance.loadingState).toBe('idle');
    expect(instance.layoutSize).toEqual({ w: 4, h: 2 });
    expect(instance.queryDefinition.timeRange.relativeWindow).toBe('last_30_days');
  });

  it('does not hardcode any industry-specific content', () => {
    const instance = createDefaultWidgetInstance({
      id: 'widget-2',
      widgetType: 'ranking_table',
      title: 'Top problems',
      dataSource: 'market_scan_problems',
      metrics: ['pain_score'],
    });
    const serialized = JSON.stringify(instance).toLowerCase();
    expect(serialized).not.toContain('tannlege');
    expect(serialized).not.toContain('dental');
  });

  it('accepts caller-supplied layout and time range overrides', () => {
    const instance = createDefaultWidgetInstance({
      id: 'widget-3',
      widgetType: 'market_map',
      title: 'Market map',
      dataSource: 'market_scan_competitors',
      metrics: ['market_size', 'competition_score'],
      layoutPosition: { x: 2, y: 1 },
      layoutSize: { w: 6, h: 4 },
      timeRange: { kind: 'absolute', from: '2020-01-01T00:00:00.000Z', to: '2024-12-31T00:00:00.000Z' },
    });
    expect(instance.layoutPosition).toEqual({ x: 2, y: 1 });
    expect(instance.layoutSize).toEqual({ w: 6, h: 4 });
    expect(instance.queryDefinition.timeRange.kind).toBe('absolute');
  });
});

describe('validateWidgetInstance', () => {
  it('accepts every widget type in WIDGET_TYPES', () => {
    for (const widgetType of WIDGET_TYPES) {
      const instance = createDefaultWidgetInstance({
        id: `widget-${widgetType}`,
        widgetType,
        title: widgetType,
        dataSource: 'test-source',
        metrics: ['count'],
      });
      const result = validateWidgetInstance(instance);
      expect(result.valid, `${widgetType} should validate: ${result.errors.join(', ')}`).toBe(true);
    }
  });

  it('rejects an unknown widgetType', () => {
    const result = validateWidgetInstance({
      id: 'bad-widget',
      widgetType: 'dental_appointment_calendar',
      title: 'Bad',
      dataSource: 'x',
      queryDefinition: { metrics: ['x'], timeRange: { kind: 'relative' } },
      visualizationType: 'x',
      layoutPosition: { x: 0, y: 0 },
      layoutSize: { w: 1, h: 1 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a widget with no metrics', () => {
    const result = WidgetInstanceSchema.safeParse({
      id: 'no-metrics',
      widgetType: 'kpi_card',
      title: 'Empty',
      dataSource: 'x',
      queryDefinition: { metrics: [], timeRange: { kind: 'relative' } },
      visualizationType: 'kpi_card',
      layoutPosition: { x: 0, y: 0 },
      layoutSize: { w: 1, h: 1 },
    });
    expect(result.success).toBe(false);
  });

  it('reports field-level error paths', () => {
    const result = validateWidgetInstance({
      id: '',
      widgetType: 'kpi_card',
      title: 'X',
      dataSource: 'x',
      queryDefinition: { metrics: ['a'], timeRange: { kind: 'relative' } },
      visualizationType: 'kpi_card',
      layoutPosition: { x: 0, y: 0 },
      layoutSize: { w: 1, h: 1 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('id:'))).toBe(true);
  });
});
