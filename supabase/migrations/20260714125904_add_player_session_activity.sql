alter table public.row_echelon_players
  add column if not exists last_active_at timestamptz;

update public.row_echelon_players
set last_active_at = created_at
where last_active_at is null;

alter table public.row_echelon_players
  alter column last_active_at set default now(),
  alter column last_active_at set not null;

create index if not exists row_echelon_players_last_active_idx
  on public.row_echelon_players (last_active_at);
