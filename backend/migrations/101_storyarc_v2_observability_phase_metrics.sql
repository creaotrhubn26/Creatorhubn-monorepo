-- Story Arc V2 observability: phase latency + fail-rate event log

create table if not exists storyarc_observability_phase_metrics (
  metric_id text primary key,
  phase text not null,
  status text not null,
  latency_ms integer not null check (latency_ms > 0),
  metric_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storyarc_observability_phase_metrics_phase_chk
    check (phase in ('analyze', 'script', 'timeline', 'apply', 'export')),
  constraint storyarc_observability_phase_metrics_status_chk
    check (status in ('completed', 'failed', 'cancelled'))
);

create index if not exists idx_storyarc_observability_phase_metrics_phase
  on storyarc_observability_phase_metrics (phase, created_at desc);

create index if not exists idx_storyarc_observability_phase_metrics_status
  on storyarc_observability_phase_metrics (status, created_at desc);
