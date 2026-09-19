-- PlayForge cloud sync. Paste this whole file into the Supabase SQL Editor and run it once.
-- There are no secrets in here. Safe to keep in a public repo.
--
-- One table holds every synced row (formations, plays, playbooks) as JSON, one copy per user.
-- Row Level Security means a signed-in user can only ever see and write their own rows.

create sequence if not exists public.items_rev_seq;

create table if not exists public.items (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('formation', 'play', 'playbook')),
  id         text        not null check (char_length(id) between 1 and 80),
  data       jsonb,                           -- null once the row is deleted
  updated_at timestamptz not null,            -- the app's own edit time: the newest edit wins
  deleted    boolean     not null default false,
  rev        bigint      not null default 0,  -- server-side counter, set by the trigger: devices pull "rev > last seen"
  primary key (user_id, kind, id),
  check (deleted or data is not null),
  check (data is null or pg_column_size(data) < 300000)
);

create index if not exists items_user_rev_idx on public.items (user_id, rev);

-- Every write gets a fresh rev. A write that is OLDER than what is stored keeps the stored copy,
-- but still bumps rev so the device that lost pulls the winner on its next sync.
create or replace function public.items_before_write() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    new.data := old.data;
    new.updated_at := old.updated_at;
    new.deleted := old.deleted;
  end if;
  new.rev := nextval('public.items_rev_seq');
  return new;
end
$$;

drop trigger if exists items_before_write on public.items;
create trigger items_before_write
  before insert or update on public.items
  for each row execute function public.items_before_write();

alter table public.items enable row level security;

drop policy if exists items_select on public.items;
drop policy if exists items_insert on public.items;
drop policy if exists items_update on public.items;
create policy items_select on public.items for select to authenticated using ((select auth.uid()) = user_id);
create policy items_insert on public.items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy items_update on public.items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- No delete policy on purpose: the app marks rows deleted, it never removes them.

revoke all on public.items from anon, public;
grant select, insert, update on public.items to authenticated;
grant usage on sequence public.items_rev_seq to authenticated;
