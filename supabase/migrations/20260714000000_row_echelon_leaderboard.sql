create extension if not exists pgcrypto;

create table if not exists public.row_echelon_players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.row_echelon_daily_scores (
  score_date date not null,
  player_id uuid not null references public.row_echelon_players(id) on delete cascade,
  solved integer not null default 0 check (solved >= 0),
  total_score integer not null default 0 check (total_score >= 0),
  total_steps integer not null default 0 check (total_steps >= 0),
  total_time integer not null default 0 check (total_time >= 0),
  best_steps integer check (best_steps is null or best_steps > 0),
  best_level integer not null default 0 check (best_level >= 0),
  last_level integer not null default 0 check (last_level >= 0),
  updated_at timestamptz not null default now(),
  primary key (score_date, player_id)
);

create index if not exists row_echelon_daily_scores_rank_idx
  on public.row_echelon_daily_scores (
    score_date,
    total_score desc,
    solved desc,
    total_steps asc,
    total_time asc,
    updated_at asc
  );

alter table public.row_echelon_players enable row level security;
alter table public.row_echelon_daily_scores enable row level security;
