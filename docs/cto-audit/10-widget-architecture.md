# 10. Widget Architecture

## Why this is net-new

No widget registry, enum, or generic renderer exists anywhere in the reviewed
frontend. The current Market Intelligence panels
(`MarketIntelligenceOverviewPanel.tsx` etc.) are bespoke MUI components with
hardcoded copy and layout. Building the screenshot's dashboard means building this
system, not migrating an existing one.

## Contract (shipped in this PR as `frontend/shared/dashboard-widget-schema.ts`)

A `WidgetInstance` carries every field the request's §6 lists:

```ts
{
  id: string;
  widgetType: WidgetType;               // 'kpi_card' | 'line_chart' | 'ranking_table' | ...
  title: string;
  description?: string;
  dataSource: string;                   // references a Data Source entity (see Data Model)
  queryDefinition: {
    dimensions: string[];
    metrics: string[];
    filters: WidgetFilter[];
    sorting?: { field: string; direction: 'asc' | 'desc' };
    grouping?: string[];
    timeRange: TimeRangeConfig;
  };
  visualizationType: string;
  refreshInterval?: number;             // seconds; undefined = manual only
  permissions: { roles?: string[]; minPlan?: string };
  layoutPosition: { x: number; y: number };
  layoutSize: { w: number; h: number };
  displaySettings: Record<string, unknown>;
  loadingState: 'idle' | 'loading' | 'loaded' | 'error';
  emptyState?: { message: string };
  errorState?: { message: string; retryable: boolean };
  lastUpdated?: string;                 // ISO timestamp
  dataFreshness?: 'live' | 'cached' | 'stale';
  sourceAttribution?: string;
}
```

Validated with Zod (`WidgetInstanceSchema`), plus `createDefaultWidgetInstance()`
and `validateWidgetInstance()` helpers, unit-tested in
`frontend/shared/dashboard-widget-schema.test.ts`.

## Widget types covered by the schema's `WidgetType` enum

Matches the request's list directly: `kpi_card`, `line_chart`, `bar_chart`,
`ranking_table`, `trend_monitor`, `opportunity_score`, `problem_ranking`,
`competitor_comparison`, `market_map`, `geographic_map`, `ai_insight`,
`recommendation`, `alert_feed`, `saved_ideas`, `evidence_panel`,
`source_quality`, `confidence_meter`, `funnel`, `pipeline`,
`conversion_analysis`, `route_performance`, `territory_performance`. The last two
are Leadgrid-specific visualization types living in the same generic contract —
proof the widget system is shared infrastructure, not MI-only.

## What's deliberately NOT in this PR

- **No `WidgetRenderer` component or drag/drop layout engine.** Building a real
  generic renderer that dispatches on `widgetType` to a chart library, handles
  resize/reorder, and persists layout is a multi-week frontend project on its own
  — sequencing it before the schema is validated against real data sources would
  risk building the wrong abstraction. The schema in this PR is the contract every
  future widget (and the eventual renderer) is built against.
- **No `dashboard_layouts`/`widget_instances` database tables yet** — these belong
  in the next PR once at least one widget type (recommend starting with `kpi_card`
  and `ranking_table`, the two the current MI panels already approximate) is built
  against the schema end-to-end.
- **No admin "add widget" UI** — depends on the renderer existing first.

## Sequencing recommendation

1. Land this schema (this PR).
2. Build one working widget end-to-end (`kpi_card`, backed by
   `market_scan_opportunities` counts) using the schema, including loading/empty/
   error states — proves the contract before generalizing further.
3. Add the `WidgetRenderer` dispatch component once 2-3 widget types exist, not
   before (avoids over-abstracting from a sample size of one).
4. Add persistence (`dashboard_layouts`) and the admin add/remove/resize/save-layout
   UX once the renderer is stable.

This mirrors the request's own emphasis (§6: "hver widget skal minimum støtte...")
— the contract is defined completely up front; the renderer is grown incrementally
against real widgets rather than speculatively.
