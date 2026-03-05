-- Story Arc Studio Narrative Engine V2 apply/revert audit trail

create table if not exists storyarc_timeline_apply_events (
  event_id text primary key,
  proposal_id text not null,
  script_id text,
  revision integer not null default 0,
  apply_key text not null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storyarc_timeline_apply_events_type_chk check (event_type in ('apply', 'revert'))
);

create index if not exists idx_storyarc_timeline_apply_events_proposal
  on storyarc_timeline_apply_events (proposal_id, created_at desc);

create index if not exists idx_storyarc_timeline_apply_events_apply_key
  on storyarc_timeline_apply_events (apply_key, created_at desc);
