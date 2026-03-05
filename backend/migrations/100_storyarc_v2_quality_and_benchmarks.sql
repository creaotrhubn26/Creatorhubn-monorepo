-- Story Arc V2 quality scorecards + golden benchmark runs

create table if not exists storyarc_quality_scorecards (
  scorecard_id text primary key,
  proposal_id text not null,
  script_id text not null,
  analysis_id text not null,
  project_id text,
  scorecard_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storyarc_quality_scorecards_project
  on storyarc_quality_scorecards (project_id, created_at desc);

create index if not exists idx_storyarc_quality_scorecards_script
  on storyarc_quality_scorecards (script_id, created_at desc);

create table if not exists storyarc_golden_benchmark_runs (
  run_id text primary key,
  dataset_name text not null,
  run_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storyarc_golden_benchmark_runs_dataset
  on storyarc_golden_benchmark_runs (dataset_name, created_at desc);
