alter table public.row_echelon_players
  add column if not exists total_solved integer not null default 0
  check (total_solved >= 0);

update public.row_echelon_players as players
set total_solved = totals.solved
from (
  select
    player_id,
    sum(solved)::integer as solved
  from public.row_echelon_daily_scores
  group by player_id
) as totals
where totals.player_id = players.id;

create or replace function public.row_echelon_track_lifetime_solved()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  solved_delta integer;
begin
  solved_delta := case
    when tg_op = 'INSERT' then greatest(new.solved, 0)
    else greatest(new.solved - old.solved, 0)
  end;

  if solved_delta > 0 then
    update public.row_echelon_players
    set total_solved = total_solved + solved_delta
    where id = new.player_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.row_echelon_track_lifetime_solved() from public, anon, authenticated;

drop trigger if exists row_echelon_track_lifetime_solved
  on public.row_echelon_daily_scores;

create trigger row_echelon_track_lifetime_solved
after insert or update of solved on public.row_echelon_daily_scores
for each row
execute function public.row_echelon_track_lifetime_solved();
