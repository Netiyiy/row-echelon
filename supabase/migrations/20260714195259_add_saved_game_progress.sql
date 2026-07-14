alter table public.row_echelon_players
  add column if not exists saved_progress jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'row_echelon_players_saved_progress_valid'
      and conrelid = 'public.row_echelon_players'::regclass
  ) then
    alter table public.row_echelon_players
      add constraint row_echelon_players_saved_progress_valid
      check (
        saved_progress is null
        or (
          jsonb_typeof(saved_progress) = 'object'
          and octet_length(saved_progress::text) <= 250000
        )
      );
  end if;
end
$$;
