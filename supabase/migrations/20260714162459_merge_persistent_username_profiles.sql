create temporary table row_echelon_player_merge_map on commit drop as
select
  id,
  first_value(id) over (
    partition by lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
    order by
      case
        when token_hash not like 'ended:%'
          and last_active_at > now() - interval '30 minutes'
          then 0
        else 1
      end,
      created_at,
      id
  ) as canonical_id
from public.row_echelon_players;

insert into public.row_echelon_daily_scores (
  score_date,
  player_id,
  solved,
  total_score,
  total_steps,
  total_time,
  best_steps,
  best_level,
  last_level,
  updated_at
)
select
  scores.score_date,
  merge_map.canonical_id,
  sum(scores.solved)::integer,
  sum(scores.total_score)::integer,
  sum(scores.total_steps)::integer,
  sum(scores.total_time)::integer,
  min(scores.best_steps),
  max(scores.best_level),
  (array_agg(scores.last_level order by scores.updated_at desc, scores.player_id))[1],
  max(scores.updated_at)
from public.row_echelon_daily_scores as scores
join row_echelon_player_merge_map as merge_map
  on merge_map.id = scores.player_id
group by scores.score_date, merge_map.canonical_id
on conflict (score_date, player_id) do update
set
  solved = excluded.solved,
  total_score = excluded.total_score,
  total_steps = excluded.total_steps,
  total_time = excluded.total_time,
  best_steps = excluded.best_steps,
  best_level = excluded.best_level,
  last_level = excluded.last_level,
  updated_at = excluded.updated_at;

delete from public.row_echelon_daily_scores as scores
using row_echelon_player_merge_map as merge_map
where scores.player_id = merge_map.id
  and merge_map.id <> merge_map.canonical_id;

delete from public.row_echelon_players as players
using row_echelon_player_merge_map as merge_map
where players.id = merge_map.id
  and merge_map.id <> merge_map.canonical_id;

update public.row_echelon_players
set name_key = lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
where name_key is distinct from lower(regexp_replace(btrim(name), '\s+', ' ', 'g'));

do $$
begin
  if exists (
    select 1
    from public.row_echelon_players
    group by lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
    having count(*) > 1
  ) then
    raise exception 'Duplicate row echelon usernames remain after profile merge.';
  end if;
end
$$;
