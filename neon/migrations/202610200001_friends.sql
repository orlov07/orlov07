create extension if not exists pgcrypto;

create table if not exists public.setra_profiles (
  user_id text primary key,
  email text not null unique,
  username text not null,
  friend_code varchar(12) not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.setra_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null references public.setra_profiles(user_id) on delete cascade,
  recipient_id text not null references public.setra_profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint setra_friend_request_not_self check (sender_id <> recipient_id),
  constraint setra_friend_request_pair_unique unique (sender_id, recipient_id)
);

create table if not exists public.setra_friendships (
  user_a text not null references public.setra_profiles(user_id) on delete cascade,
  user_b text not null references public.setra_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint setra_friendship_order check (user_a < user_b)
);

create table if not exists public.setra_matches (
  match_id text primary key,
  owner_id text not null references public.setra_profiles(user_id) on delete cascade,
  state jsonb not null,
  status text not null check (status in ('draft', 'live', 'paused', 'finished', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists setra_friend_requests_recipient_idx
  on public.setra_friend_requests(recipient_id, status, created_at desc);
create index if not exists setra_friend_requests_sender_idx
  on public.setra_friend_requests(sender_id, status, created_at desc);
create index if not exists setra_matches_owner_idx
  on public.setra_matches(owner_id, updated_at desc);

revoke all on public.setra_profiles from public;
revoke all on public.setra_friend_requests from public;
revoke all on public.setra_friendships from public;
revoke all on public.setra_matches from public;
