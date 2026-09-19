-- THE GRID — Supabase schema
-- Run ONCE: Supabase dashboard → SQL Editor → New query → paste all of this → Run.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS).

-- ── 1. The store: one row per user holding the whole app state as JSON ──────────
create table if not exists public.grid_store (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb       not null,
  revision   bigint      not null default 1,   -- bumped server-side on every update (optimistic concurrency)
  updated_at timestamptz not null default now()
);

alter table public.grid_store enable row level security;

drop policy if exists "own row: select" on public.grid_store;
drop policy if exists "own row: insert" on public.grid_store;
drop policy if exists "own row: update" on public.grid_store;

create policy "own row: select" on public.grid_store for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own row: insert" on public.grid_store for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own row: update" on public.grid_store for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Deliberately NO delete policy: the app can never delete your row.

revoke all on public.grid_store from anon;
grant select, insert, update on public.grid_store to authenticated;

-- ── 2. Daily version history: a safety net against a bad write or a code bug ────
create table if not exists public.grid_store_history (
  id       bigint generated always as identity primary key,
  user_id  uuid   not null references auth.users(id) on delete cascade,
  data     jsonb  not null,
  revision bigint not null,
  saved_at timestamptz not null default now()
);

alter table public.grid_store_history enable row level security;
drop policy if exists "own history: select" on public.grid_store_history;
create policy "own history: select" on public.grid_store_history for select to authenticated
  using ((select auth.uid()) = user_id);
-- No insert/update/delete policies: only the trigger below can write history.

revoke all on public.grid_store_history from anon;
grant select on public.grid_store_history to authenticated;

-- Runs before every update of grid_store:
--   • bumps revision + updated_at
--   • on the FIRST update of each UTC day, saves the row's previous contents to history
--     (so you always have "how it looked before today's first change"), and prunes >30 days.
create or replace function public.grid_store_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.grid_store_history h
    where h.user_id = old.user_id and h.saved_at::date = now()::date
  ) then
    insert into public.grid_store_history (user_id, data, revision) values (old.user_id, old.data, old.revision);
    delete from public.grid_store_history where user_id = old.user_id and saved_at < now() - interval '30 days';
  end if;
  new.revision   := old.revision + 1;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists grid_store_before_update on public.grid_store;
create trigger grid_store_before_update before update on public.grid_store
  for each row execute function public.grid_store_before_update();
