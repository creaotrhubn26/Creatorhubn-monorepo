-- Story Arc Studio Narrative Engine V2 foundation tables

create table if not exists storyarc_analysis_runs (
  analysis_id text primary key,
  project_id text,
  analysis_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storyarc_clip_semantic_profiles (
  profile_id text primary key,
  analysis_id text,
  clip_id text not null,
  profile_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storyarc_clip_semantic_profiles_analysis_id
  on storyarc_clip_semantic_profiles (analysis_id);
create index if not exists idx_storyarc_clip_semantic_profiles_clip_id
  on storyarc_clip_semantic_profiles (clip_id);

create table if not exists storyarc_person_identities (
  identity_id text primary key,
  analysis_id text,
  person_label text,
  identity_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storyarc_person_identities_analysis_id
  on storyarc_person_identities (analysis_id);

create table if not exists storyarc_story_scripts (
  script_id text primary key,
  analysis_id text,
  script_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storyarc_story_scripts_analysis_id
  on storyarc_story_scripts (analysis_id);

create table if not exists storyarc_script_nodes (
  node_id text primary key,
  script_id text,
  node_index integer not null default 0,
  node_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storyarc_script_nodes_script_id
  on storyarc_script_nodes (script_id, node_index);

create table if not exists storyarc_timeline_proposals (
  proposal_id text primary key,
  script_id text,
  proposal_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storyarc_timeline_proposals_script_id
  on storyarc_timeline_proposals (script_id);

create table if not exists storyarc_feedback_events (
  event_id text primary key,
  script_id text,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storyarc_feedback_events_script_id
  on storyarc_feedback_events (script_id, created_at desc);

create table if not exists storyarc_job_checkpoints (
  job_id text primary key,
  checkpoint_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
