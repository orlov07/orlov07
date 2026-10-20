create extension if not exists pgcrypto;

create type public.match_status as enum ('draft','live','paused','finished','cancelled');
create type public.member_role as enum ('owner','admin','operator','viewer');
create type public.event_type as enum ('MATCH_CREATED','MATCH_STARTED','POINT_CONFIRMED','POINT_CORRECTED','POINT_REVERTED','MATCH_PAUSED','MATCH_RESUMED','MATCH_FINISHED');
create type public.prediction_status as enum ('pending','confirmed','rejected','expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_path text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.arenas (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
  name text not null check (char_length(name) between 1 and 120), created_at timestamptz not null default now()
);
create table public.arena_members (
  arena_id uuid references public.arenas(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
  role public.member_role not null default 'viewer', primary key (arena_id,user_id)
);
create table public.courts (
  id uuid primary key default gen_random_uuid(), arena_id uuid not null references public.arenas(id) on delete cascade,
  name text not null, active boolean not null default true, created_at timestamptz not null default now(), unique(arena_id,name)
);
create table public.matches (
  id uuid primary key default gen_random_uuid(), arena_id uuid references public.arenas(id), court_id uuid references public.courts(id),
  created_by uuid not null references public.profiles(id), operator_id uuid references public.profiles(id), status public.match_status not null default 'draft',
  team_a_name text not null check(char_length(team_a_name) between 1 and 80), team_b_name text not null check(char_length(team_b_name) between 1 and 80),
  rules jsonb not null, state jsonb not null, version bigint not null default 0 check(version >= 0),
  started_at timestamptz, finished_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.match_players (
  match_id uuid references public.matches(id) on delete cascade, user_id uuid references public.profiles(id),
  display_name text not null, team char(1) not null check(team in ('A','B')), position smallint not null check(position between 1 and 2), primary key(match_id,team,position)
);
create table public.match_events (
  id uuid primary key default gen_random_uuid(), match_id uuid not null references public.matches(id) on delete cascade,
  type public.event_type not null, team char(1) check(team in ('A','B')), payload jsonb not null default '{}',
  actor_id uuid not null references public.profiles(id), idempotency_key uuid not null, match_version bigint not null,
  created_at timestamptz not null default now(), unique(match_id,idempotency_key), unique(match_id,match_version)
);
create table public.match_state_snapshots (
  match_id uuid references public.matches(id) on delete cascade, version bigint not null, state jsonb not null,
  created_at timestamptz not null default now(), primary key(match_id,version)
);
create table public.camera_sessions (
  id uuid primary key default gen_random_uuid(), match_id uuid not null references public.matches(id) on delete cascade,
  created_by uuid not null references public.profiles(id), calibration jsonb, started_at timestamptz not null default now(), ended_at timestamptz
);
create table public.video_clips (
  id uuid primary key default gen_random_uuid(), match_id uuid not null references public.matches(id) on delete cascade,
  camera_session_id uuid references public.camera_sessions(id) on delete set null, storage_path text not null unique,
  mime_type text not null, size_bytes bigint not null check(size_bytes between 1 and 52428800), duration_ms integer check(duration_ms > 0),
  retention_until timestamptz not null default (now() + interval '30 days'), created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.ai_predictions (
  id uuid primary key default gen_random_uuid(), match_id uuid not null references public.matches(id) on delete cascade,
  video_clip_id uuid references public.video_clips(id) on delete set null, event_type text not null, suggested_winner char(1) check(suggested_winner in ('A','B')),
  confidence numeric(5,4) not null check(confidence between 0 and 1), model_version text not null, status public.prediction_status not null default 'pending',
  reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table public.match_statistics (
  match_id uuid primary key references public.matches(id) on delete cascade, statistics jsonb not null default '{}', calculated_at timestamptz not null default now()
);
create table public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid references public.profiles(id), action text not null,
  resource_type text not null, resource_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create index matches_created_by_idx on public.matches(created_by,created_at desc);
create index matches_arena_idx on public.matches(arena_id,status);
create index match_events_match_idx on public.match_events(match_id,created_at);
create index ai_predictions_pending_idx on public.ai_predictions(match_id,created_at) where status='pending';
create index video_clips_retention_idx on public.video_clips(retention_until);

alter table public.profiles enable row level security; alter table public.arenas enable row level security;
alter table public.arena_members enable row level security; alter table public.courts enable row level security;
alter table public.matches enable row level security; alter table public.match_players enable row level security;
alter table public.match_events enable row level security; alter table public.match_state_snapshots enable row level security;
alter table public.camera_sessions enable row level security; alter table public.video_clips enable row level security;
alter table public.ai_predictions enable row level security; alter table public.match_statistics enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles read self" on public.profiles for select using (id=auth.uid());
create policy "profiles update self" on public.profiles for update using (id=auth.uid()) with check(id=auth.uid());
create policy "arenas visible to members" on public.arenas for select using (owner_id=auth.uid() or exists(select 1 from public.arena_members m where m.arena_id=id and m.user_id=auth.uid()));
create policy "owners manage arenas" on public.arenas for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy "members visible to arena members" on public.arena_members for select using(user_id=auth.uid() or exists(select 1 from public.arenas a where a.id=arena_id and a.owner_id=auth.uid()));
create policy "owners manage members" on public.arena_members for all using(exists(select 1 from public.arenas a where a.id=arena_id and a.owner_id=auth.uid())) with check(exists(select 1 from public.arenas a where a.id=arena_id and a.owner_id=auth.uid()));
create policy "courts visible to members" on public.courts for select using(exists(select 1 from public.arenas a left join public.arena_members m on m.arena_id=a.id where a.id=arena_id and (a.owner_id=auth.uid() or m.user_id=auth.uid())));
create policy "arena staff manage courts" on public.courts for all using(exists(select 1 from public.arenas a left join public.arena_members m on m.arena_id=a.id where a.id=arena_id and (a.owner_id=auth.uid() or (m.user_id=auth.uid() and m.role in ('admin','operator')))));
create policy "participants read matches" on public.matches for select using(created_by=auth.uid() or operator_id=auth.uid() or exists(select 1 from public.match_players p where p.match_id=id and p.user_id=auth.uid()) or exists(select 1 from public.arena_members m where m.arena_id=arena_id and m.user_id=auth.uid()));
create policy "creators insert matches" on public.matches for insert with check(created_by=auth.uid());
create policy "operators update matches" on public.matches for update using(created_by=auth.uid() or operator_id=auth.uid()) with check(created_by=auth.uid() or operator_id=auth.uid());

-- Child records inherit access through their match. Sensitive writes are intentionally
-- server-only: no INSERT/UPDATE policies are granted for events, predictions, clips or audit logs.
create policy "participants read match players" on public.match_players for select using(exists(select 1 from public.matches m where m.id=match_id and (m.created_by=auth.uid() or m.operator_id=auth.uid())));
create policy "participants read events" on public.match_events for select using(exists(select 1 from public.matches m where m.id=match_id and (m.created_by=auth.uid() or m.operator_id=auth.uid())));
create policy "participants read snapshots" on public.match_state_snapshots for select using(exists(select 1 from public.matches m where m.id=match_id and (m.created_by=auth.uid() or m.operator_id=auth.uid())));
create policy "participants read camera sessions" on public.camera_sessions for select using(exists(select 1 from public.matches m where m.id=match_id and (m.created_by=auth.uid() or m.operator_id=auth.uid())));
create policy "participants read clips" on public.video_clips for select using(exists(select 1 from public.matches m where m.id=match_id and (m.created_by=auth.uid() or m.operator_id=auth.uid())));
create policy "participants read predictions" on public.ai_predictions for select using(exists(select 1 from public.matches m where m.id=match_id and (m.created_by=auth.uid() or m.operator_id=auth.uid())));
create policy "participants read statistics" on public.match_statistics for select using(exists(select 1 from public.matches m where m.id=match_id and (m.created_by=auth.uid() or m.operator_id=auth.uid())));
